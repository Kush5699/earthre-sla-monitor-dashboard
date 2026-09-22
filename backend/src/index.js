import { processCSV } from './processor.js';

/**
 * Cloudflare Worker for SLA Monitoring Dashboard
 * Implements stateless serverless data parsing, validation, persistence, and querying.
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(message, status = 400, details = null) {
  return jsonResponse({ error: message, details, success: false }, status);
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: env.DB ? 'connected' : 'unbound',
        });
      }

      if (pathname === '/api/upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }

      if (pathname === '/api/stats' && request.method === 'GET') {
        return await handleStats(url, env);
      }

      if (pathname === '/api/logs' && request.method === 'GET') {
        return await handleLogs(url, env);
      }

      if (pathname === '/api/uploads' && request.method === 'GET') {
        return await handleListUploads(env);
      }

      if (pathname.startsWith('/api/uploads/') && request.method === 'DELETE') {
        const id = pathname.replace('/api/uploads/', '');
        return await handleDeleteUpload(id, env);
      }

      return errorResponse('Route not found', 404);
    } catch (err) {
      console.error('Unhandled server error:', err);
      return errorResponse('Internal Server Error: ' + err.message, 500);
    }
  },
};

/**
 * Handler: POST /api/upload
 * Accepts multipart/form-data or raw CSV text.
 * Parses, cleans, and batch inserts records into Cloudflare D1.
 */
async function handleUpload(request, env) {
  if (!env.DB) {
    return errorResponse('Database binding missing', 500);
  }

  const contentType = request.headers.get('content-type') || '';
  let csvText = '';
  let filename = 'monitoring_checks.csv';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return errorResponse('No file provided in form data under field "file"');
    }
    if (typeof file === 'string') {
      csvText = file;
    } else {
      filename = file.name || filename;
      csvText = await file.text();
    }
  } else {
    csvText = await request.text();
  }

  if (!csvText || !csvText.trim()) {
    return errorResponse('Uploaded CSV content is empty');
  }

  // Process data through stateless processor
  let processResult;
  try {
    processResult = processCSV(csvText, filename);
  } catch (procErr) {
    return errorResponse('CSV Processing Failed: ' + procErr.message, 422);
  }

  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  // Insert upload record
  await env.DB.prepare(
    `INSERT INTO uploads (
      id, filename, uploaded_at, total_rows, clean_rows, dropped_rows,
      date_range_start, date_range_end, issues_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      uploadId,
      processResult.filename,
      uploadedAt,
      processResult.totalRows,
      processResult.cleanRows,
      processResult.droppedRows,
      processResult.dateRange.start,
      processResult.dateRange.end,
      JSON.stringify(processResult.issues)
    )
    .run();

  // Batch insert cleaned records in chunks of 75 statements
  const records = processResult.records;
  const CHUNK_SIZE = 75;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map(rec =>
      env.DB.prepare(
        `INSERT INTO health_checks (
          upload_id, service_id, service_name, timestamp, status_code,
          latency_ms, agent, region, is_healthy, check_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        uploadId,
        rec.service_id,
        rec.service_name,
        rec.timestamp,
        rec.status_code,
        rec.latency_ms,
        rec.agent,
        rec.region,
        rec.is_healthy,
        rec.check_date
      )
    );

    await env.DB.batch(statements);
  }

  return jsonResponse({
    success: true,
    upload_id: uploadId,
    filename: processResult.filename,
    total_rows: processResult.totalRows,
    clean_rows: processResult.cleanRows,
    dropped_rows: processResult.droppedRows,
    date_range: processResult.dateRange,
    issues: processResult.issues,
  });
}

/**
 * Handler: GET /api/stats
 * Computes availability %, SLA target comparison, latency percentiles, and error code breakdown.
 */
async function handleStats(url, env) {
  if (!env.DB) {
    return errorResponse('Database binding missing', 500);
  }

  let uploadId = url.searchParams.get('upload_id');

  // If no upload_id given, use the latest upload
  if (!uploadId) {
    const latest = await env.DB.prepare(
      `SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1`
    ).first();
    if (!latest) {
      return jsonResponse({
        overall: null,
        services: [],
        message: 'No uploads found in database',
      });
    }
    uploadId = latest.id;
  }

  // Get upload metadata
  const upload = await env.DB.prepare(
    `SELECT * FROM uploads WHERE id = ?`
  ).bind(uploadId).first();

  if (!upload) {
    return errorResponse(`Upload with ID ${uploadId} not found`, 404);
  }

  // Query per-service availability & base latency
  const serviceStatsQuery = await env.DB.prepare(
    `SELECT
      service_id,
      service_name,
      COUNT(*) as total_checks,
      SUM(CASE WHEN is_healthy = 1 THEN 1 ELSE 0 END) as healthy_checks,
      SUM(CASE WHEN is_healthy = 0 THEN 1 ELSE 0 END) as error_checks,
      AVG(latency_ms) as avg_latency_ms,
      MIN(latency_ms) as min_latency_ms,
      MAX(latency_ms) as max_latency_ms
    FROM health_checks
    WHERE upload_id = ?
    GROUP BY service_id, service_name
    ORDER BY service_id ASC`
  ).bind(uploadId).all();

  const serviceStats = serviceStatsQuery.results || [];

  // Query error breakdown per service
  const errorBreakdownQuery = await env.DB.prepare(
    `SELECT
      service_id,
      status_code,
      COUNT(*) as count
    FROM health_checks
    WHERE upload_id = ? AND is_healthy = 0
    GROUP BY service_id, status_code
    ORDER BY count DESC`
  ).bind(uploadId).all();

  const errorMap = {};
  for (const row of errorBreakdownQuery.results || []) {
    if (!errorMap[row.service_id]) {
      errorMap[row.service_id] = {};
    }
    errorMap[row.service_id][String(row.status_code)] = row.count;
  }

  // Query latencies for percentile calculation (p50, p95, p99)
  const latenciesQuery = await env.DB.prepare(
    `SELECT service_id, latency_ms
     FROM health_checks
     WHERE upload_id = ? AND latency_ms IS NOT NULL
     ORDER BY latency_ms ASC`
  ).bind(uploadId).all();

  const serviceLatencies = {};
  for (const row of latenciesQuery.results || []) {
    if (!serviceLatencies[row.service_id]) {
      serviceLatencies[row.service_id] = [];
    }
    serviceLatencies[row.service_id].push(row.latency_ms);
  }

  const SLA_TARGET = 99.9;
  let breachingCount = 0;
  let totalChecks = 0;
  let totalHealthy = 0;

  const services = serviceStats.map(s => {
    const total = Number(s.total_checks) || 0;
    const healthy = Number(s.healthy_checks) || 0;
    const availabilityPct = total > 0 ? Math.round((healthy / total) * 100000) / 1000 : 0;
    const slaBreached = availabilityPct < SLA_TARGET;

    if (slaBreached) {
      breachingCount++;
    }
    totalChecks += total;
    totalHealthy += healthy;

    const latList = serviceLatencies[s.service_id] || [];
    const n = latList.length;
    const p50 = n > 0 ? latList[Math.floor(n * 0.5)] : null;
    const p95 = n > 0 ? latList[Math.floor(n * 0.95)] : null;
    const p99 = n > 0 ? latList[Math.floor(n * 0.99)] : null;

    return {
      service_id: s.service_id,
      service_name: s.service_name,
      total_checks: total,
      healthy_checks: healthy,
      error_checks: Number(s.error_checks) || 0,
      availability_pct: availabilityPct,
      sla_target: SLA_TARGET,
      sla_breached: slaBreached,
      avg_latency_ms: s.avg_latency_ms ? Math.round(s.avg_latency_ms * 100) / 100 : null,
      min_latency_ms: s.min_latency_ms,
      max_latency_ms: s.max_latency_ms,
      p50_latency_ms: p50,
      p95_latency_ms: p95,
      p99_latency_ms: p99,
      error_breakdown: errorMap[s.service_id] || {},
    };
  });

  const overallAvailability = totalChecks > 0 ? Math.round((totalHealthy / totalChecks) * 100000) / 1000 : 0;

  let issues = [];
  try {
    issues = upload.issues_json ? JSON.parse(upload.issues_json) : [];
  } catch {
    issues = [];
  }

  return jsonResponse({
    upload_id: upload.id,
    filename: upload.filename,
    uploaded_at: upload.uploaded_at,
    overall: {
      total_services: services.length,
      services_breaching_sla: breachingCount,
      total_checks: totalChecks,
      total_healthy: totalHealthy,
      overall_availability_pct: overallAvailability,
      sla_target: SLA_TARGET,
      date_range: {
        start: upload.date_range_start,
        end: upload.date_range_end,
      },
    },
    services,
    issues_summary: issues,
  });
}

/**
 * Handler: GET /api/logs
 * Returns paginated logs filtered by single date or date range, service, and health status.
 */
async function handleLogs(url, env) {
  if (!env.DB) {
    return errorResponse('Database binding missing', 500);
  }

  let uploadId = url.searchParams.get('upload_id');
  if (!uploadId) {
    const latest = await env.DB.prepare(
      `SELECT id FROM uploads ORDER BY uploaded_at DESC LIMIT 1`
    ).first();
    if (!latest) {
      return jsonResponse({ logs: [], pagination: { page: 1, limit: 50, total: 0, total_pages: 0 } });
    }
    uploadId = latest.id;
  }

  const singleDate = url.searchParams.get('date');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const serviceId = url.searchParams.get('service_id');
  const statusFilter = url.searchParams.get('status'); // 'healthy', 'unhealthy', or all

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  const conditions = ['upload_id = ?'];
  const params = [uploadId];

  if (singleDate) {
    conditions.push('check_date = ?');
    params.push(singleDate);
  } else if (startDate && endDate) {
    conditions.push('check_date >= ? AND check_date <= ?');
    params.push(startDate, endDate);
  } else if (startDate) {
    conditions.push('check_date >= ?');
    params.push(startDate);
  } else if (endDate) {
    conditions.push('check_date <= ?');
    params.push(endDate);
  }

  if (serviceId && serviceId !== 'all') {
    conditions.push('service_id = ?');
    params.push(serviceId);
  }

  if (statusFilter === 'healthy') {
    conditions.push('is_healthy = 1');
  } else if (statusFilter === 'unhealthy') {
    conditions.push('is_healthy = 0');
  }

  const whereClause = conditions.join(' AND ');

  // Count query
  const countQuery = `SELECT COUNT(*) as total FROM health_checks WHERE ${whereClause}`;
  const countStmt = env.DB.prepare(countQuery).bind(...params);
  const countRes = await countStmt.first();
  const total = countRes ? Number(countRes.total) : 0;
  const totalPages = Math.ceil(total / limit);

  // Data query
  const dataQuery = `
    SELECT
      id, service_id, service_name, timestamp, status_code,
      latency_ms, agent, region, is_healthy, check_date
    FROM health_checks
    WHERE ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;
  const dataStmt = env.DB.prepare(dataQuery).bind(...params, limit, offset);
  const dataRes = await dataStmt.all();

  return jsonResponse({
    logs: dataRes.results || [],
    pagination: {
      page,
      limit,
      total,
      total_pages: totalPages,
    },
    filters: {
      upload_id: uploadId,
      date: singleDate,
      start_date: startDate,
      end_date: endDate,
      service_id: serviceId,
      status: statusFilter,
    },
  });
}

/**
 * Handler: GET /api/uploads
 * Lists all previous upload sessions.
 */
async function handleListUploads(env) {
  if (!env.DB) {
    return errorResponse('Database binding missing', 500);
  }

  const result = await env.DB.prepare(
    `SELECT
      id, filename, uploaded_at, total_rows, clean_rows, dropped_rows,
      date_range_start, date_range_end
    FROM uploads
    ORDER BY uploaded_at DESC`
  ).all();

  return jsonResponse({ uploads: result.results || [] });
}

/**
 * Handler: DELETE /api/uploads/:id
 */
async function handleDeleteUpload(id, env) {
  if (!env.DB) {
    return errorResponse('Database binding missing', 500);
  }

  await env.DB.prepare(`DELETE FROM uploads WHERE id = ?`).bind(id).run();
  return jsonResponse({ success: true, message: `Upload ${id} deleted` });
}
