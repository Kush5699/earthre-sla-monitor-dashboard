import { processCSV } from './processor.js';

/**
 * Cloudflare Worker for SLA Monitoring Dashboard
 * Implements stateless serverless data parsing, validation, persistence, and querying.
 * Uses high-efficiency edge storage (Cloudflare KV + D1) designed to stay well within free tier limits.
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
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if ((pathname === '/' || pathname === '') && request.method === 'GET') {
        const accept = (request.headers.get('accept') || '').toLowerCase();
        const wantsJson = accept.includes('application/json') || url.searchParams.get('format') === 'json';
        if (!wantsJson) {
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EarthRe - SLA Monitoring API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 600px; width: 100%; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 20px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; border: 1px solid #a7f3d0; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    h1 { font-size: 18px; font-weight: 800; margin: 0; color: #0f172a; }
    p { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
    .metric-title { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .metric-val { font-size: 13px; color: #0f172a; font-weight: 700; margin-top: 4px; }
    .ep-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .method { font-family: monospace; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
    .get { background: #e0f2fe; color: #0369a1; }
    .post { background: #fef3c7; color: #92400e; }
    .path { font-family: monospace; color: #334155; font-size: 12px; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; margin-top: 24px; text-align: center; }
    .btn:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1>EarthRe SLA Monitoring API</h1>
        <p>Serverless Edge Processing &amp; Storage Engine</p>
      </div>
      <div class="badge"><span class="dot"></span> Online</div>
    </div>
    <div class="grid">
      <div class="metric">
        <div class="metric-title">Cloud Runtime</div>
        <div class="metric-val">Cloudflare Workers (Edge)</div>
      </div>
      <div class="metric">
        <div class="metric-title">Data Storage</div>
        <div class="metric-val">Workers KV + D1 SQLite</div>
      </div>
    </div>
    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin: 18px 0 8px 0;">Available API Routes</div>
    <div class="ep-row">
      <div><span class="method get">GET</span> <span class="path">/api/health</span></div>
      <a href="/api/health" style="color: #0284c7; text-decoration: none; font-size: 12px; font-weight: 600;">Test &rarr;</a>
    </div>
    <div class="ep-row">
      <div><span class="method get">GET</span> <span class="path">/api/uploads</span></div>
      <a href="/api/uploads" style="color: #0284c7; text-decoration: none; font-size: 12px; font-weight: 600;">View &rarr;</a>
    </div>
    <div class="ep-row">
      <div><span class="method get">GET</span> <span class="path">/api/stats</span></div>
      <a href="/api/stats" style="color: #0284c7; text-decoration: none; font-size: 12px; font-weight: 600;">View &rarr;</a>
    </div>
    <div class="ep-row">
      <div><span class="method post">POST</span> <span class="path">/api/upload</span></div>
      <span style="font-size: 11px; color: #94a3b8;">Multipart CSV</span>
    </div>
    <div style="text-align: center;">
      <a href="https://sla-monitor-dashboard.sla-monitor-backend.workers.dev" class="btn">Launch Dashboard UI &rarr;</a>
    </div>
  </div>
</body>
</html>`;
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              ...corsHeaders,
            },
          });
        }

        return jsonResponse({
          service: 'EarthRe SLA Monitoring Serverless API',
          status: 'online',
          runtime: 'Cloudflare Workers (Edge Serverless)',
          storage: {
            kv_storage: env.SLA_STORAGE ? 'connected' : 'unbound',
            d1_database: env.DB ? 'connected' : 'unbound',
          },
          endpoints: {
            health: 'GET /api/health',
            upload: 'POST /api/upload (multipart/form-data with "file")',
            stats: 'GET /api/stats?upload_id={id}',
            logs: 'GET /api/logs?upload_id={id}&date={YYYY-MM-DD}&service_id={id}&status={healthy|unhealthy}&page={n}&limit={n}',
            uploads: 'GET /api/uploads',
            reset: 'POST /api/reset',
          },
          frontend_dashboard: 'https://sla-monitor-dashboard.sla-monitor-backend.workers.dev',
          timestamp: new Date().toISOString(),
        });
      }

      if (pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          kv_storage: env.SLA_STORAGE ? 'connected' : 'unbound',
          d1_database: env.DB ? 'connected' : 'unbound',
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

      if (pathname === '/api/reset' && request.method === 'POST') {
        return await handleResetAll(env);
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
 * Computes complete SLA stats from cleaned records
 */
function computeStatsFromRecords(records, uploadMetadata, issues) {
  const SLA_TARGET = 99.9;
  const serviceMap = {};

  for (const rec of records) {
    if (!serviceMap[rec.service_id]) {
      serviceMap[rec.service_id] = {
        service_id: rec.service_id,
        service_name: rec.service_name,
        total_checks: 0,
        healthy_checks: 0,
        error_checks: 0,
        latencies: [],
        error_breakdown: {},
      };
    }

    const s = serviceMap[rec.service_id];
    s.total_checks++;
    if (rec.is_healthy === 1) {
      s.healthy_checks++;
    } else {
      s.error_checks++;
      const code = String(rec.status_code);
      s.error_breakdown[code] = (s.error_breakdown[code] || 0) + 1;
    }

    if (rec.latency_ms !== null && rec.latency_ms !== undefined) {
      s.latencies.push(rec.latency_ms);
    }
  }

  let breachingCount = 0;
  let totalChecks = 0;
  let totalHealthy = 0;

  const services = Object.values(serviceMap)
    .sort((a, b) => a.service_id.localeCompare(b.service_id))
    .map(s => {
      const total = s.total_checks;
      const healthy = s.healthy_checks;
      const availabilityPct = total > 0 ? Math.round((healthy / total) * 100000) / 1000 : 0;
      const slaBreached = availabilityPct < SLA_TARGET;

      if (slaBreached) {
        breachingCount++;
      }
      totalChecks += total;
      totalHealthy += healthy;

      s.latencies.sort((a, b) => a - b);
      const n = s.latencies.length;
      const sum = s.latencies.reduce((acc, v) => acc + v, 0);
      const avg = n > 0 ? Math.round((sum / n) * 100) / 100 : null;
      const min = n > 0 ? s.latencies[0] : null;
      const max = n > 0 ? s.latencies[n - 1] : null;
      const p50 = n > 0 ? s.latencies[Math.floor(n * 0.5)] : null;
      const p95 = n > 0 ? s.latencies[Math.floor(n * 0.95)] : null;
      const p99 = n > 0 ? s.latencies[Math.floor(n * 0.99)] : null;

      return {
        service_id: s.service_id,
        service_name: s.service_name,
        total_checks: total,
        healthy_checks: healthy,
        error_checks: s.error_checks,
        availability_pct: availabilityPct,
        sla_target: SLA_TARGET,
        sla_breached: slaBreached,
        avg_latency_ms: avg,
        min_latency_ms: min,
        max_latency_ms: max,
        p50_latency_ms: p50,
        p95_latency_ms: p95,
        p99_latency_ms: p99,
        error_breakdown: s.error_breakdown,
      };
    });

  const overallAvailability = totalChecks > 0 ? Math.round((totalHealthy / totalChecks) * 100000) / 1000 : 0;

  // Compute daily trends for visual time-series charts
  const dailyMap = {};
  for (const rec of records) {
    const d = rec.check_date;
    if (!d) continue;
    if (!dailyMap[d]) {
      dailyMap[d] = {
        date: d,
        total_checks: 0,
        healthy_checks: 0,
        error_checks: 0,
        services: {},
      };
    }
    const day = dailyMap[d];
    day.total_checks++;
    if (rec.is_healthy === 1) {
      day.healthy_checks++;
    } else {
      day.error_checks++;
    }

    if (!day.services[rec.service_id]) {
      day.services[rec.service_id] = { total: 0, healthy: 0, errors: 0 };
    }
    day.services[rec.service_id].total++;
    if (rec.is_healthy === 1) {
      day.services[rec.service_id].healthy++;
    } else {
      day.services[rec.service_id].errors++;
    }
  }

  const dailyTrends = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      date: d.date,
      total_checks: d.total_checks,
      healthy_checks: d.healthy_checks,
      error_checks: d.error_checks,
      availability_pct: d.total_checks > 0 ? Math.round((d.healthy_checks / d.total_checks) * 100000) / 1000 : 0,
      services: d.services,
    }));

  return {
    upload_id: uploadMetadata.id,
    filename: uploadMetadata.filename,
    uploaded_at: uploadMetadata.uploaded_at,
    overall: {
      total_services: services.length,
      services_breaching_sla: breachingCount,
      total_checks: totalChecks,
      total_healthy: totalHealthy,
      overall_availability_pct: overallAvailability,
      sla_target: SLA_TARGET,
      date_range: {
        start: uploadMetadata.date_range_start,
        end: uploadMetadata.date_range_end,
      },
    },
    services,
    daily_trends: dailyTrends,
    issues_summary: issues || [],
  };
}

/**
 * Handler: POST /api/upload
 */
async function handleUpload(request, env) {
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

  // Stateless processing
  let processResult;
  try {
    processResult = processCSV(csvText, filename);
  } catch (procErr) {
    return errorResponse('CSV Processing Failed: ' + procErr.message, 422);
  }

  const uploadId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();

  const uploadMetadata = {
    id: uploadId,
    filename: processResult.filename,
    uploaded_at: uploadedAt,
    total_rows: processResult.totalRows,
    clean_rows: processResult.cleanRows,
    dropped_rows: processResult.droppedRows,
    date_range_start: processResult.dateRange.start,
    date_range_end: processResult.dateRange.end,
  };

  const computedStats = computeStatsFromRecords(processResult.records, uploadMetadata, processResult.issues);

  // Persist to Cloudflare KV (1 write operation per file, no row limits)
  if (env.SLA_STORAGE) {
    // 1. Get existing uploads list
    let uploadsList = [];
    try {
      const existing = await env.SLA_STORAGE.get('uploads_index', 'json');
      if (Array.isArray(existing)) {
        uploadsList = existing;
      }
    } catch {
      uploadsList = [];
    }

    // Prepend new upload
    uploadsList = [uploadMetadata, ...uploadsList.filter(u => u.id !== uploadId)];

    await Promise.all([
      env.SLA_STORAGE.put('uploads_index', JSON.stringify(uploadsList)),
      env.SLA_STORAGE.put(`upload:${uploadId}:stats`, JSON.stringify(computedStats)),
      env.SLA_STORAGE.put(`upload:${uploadId}:records`, JSON.stringify(processResult.records)),
    ]);
  }

  // Attempt D1 insert if DB bound and quota allows (best-effort)
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO uploads (
          id, filename, uploaded_at, total_rows, clean_rows, dropped_rows,
          date_range_start, date_range_end, issues_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        uploadId,
        processResult.filename,
        uploadedAt,
        processResult.totalRows,
        processResult.cleanRows,
        processResult.droppedRows,
        processResult.dateRange.start,
        processResult.dateRange.end,
        JSON.stringify(processResult.issues)
      ).run();
    } catch (e) {
      // D1 limit reached, KV has successfully persisted the data
      console.log('D1 insert skipped:', e.message);
    }
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
 */
async function handleStats(url, env) {
  let uploadId = url.searchParams.get('upload_id');

  // Try fetching from KV first
  if (env.SLA_STORAGE) {
    let uploadsList = [];
    try {
      uploadsList = (await env.SLA_STORAGE.get('uploads_index', 'json')) || [];
    } catch {
      uploadsList = [];
    }

    if (!uploadId && uploadsList.length > 0) {
      uploadId = uploadsList[0].id;
    }

    if (uploadId) {
      try {
        const stats = await env.SLA_STORAGE.get(`upload:${uploadId}:stats`, 'json');
        if (stats) {
          return jsonResponse(stats);
        }
      } catch (e) {
        console.log('KV stats fetch error:', e);
      }
    }
  }

  // Fallback to D1 if available
  if (env.DB) {
    if (!uploadId) {
      const latest = await env.DB.prepare(
        `SELECT id FROM uploads WHERE clean_rows > 10 ORDER BY uploaded_at DESC LIMIT 1`
      ).first();
      if (!latest) {
        return jsonResponse({ overall: null, services: [], message: 'No uploads found' });
      }
      uploadId = latest.id;
    }

    const upload = await env.DB.prepare(`SELECT * FROM uploads WHERE id = ?`).bind(uploadId).first();
    if (!upload) {
      return errorResponse(`Upload ${uploadId} not found`, 404);
    }

    const recordsQuery = await env.DB.prepare(
      `SELECT * FROM health_checks WHERE upload_id = ? ORDER BY timestamp ASC`
    ).bind(uploadId).all();

    const issues = upload.issues_json ? JSON.parse(upload.issues_json) : [];
    const stats = computeStatsFromRecords(recordsQuery.results || [], upload, issues);
    return jsonResponse(stats);
  }

  return jsonResponse({ overall: null, services: [] });
}

/**
 * Handler: GET /api/logs
 */
async function handleLogs(url, env) {
  let uploadId = url.searchParams.get('upload_id');
  const singleDate = url.searchParams.get('date');
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const serviceId = url.searchParams.get('service_id');
  const statusFilter = url.searchParams.get('status');

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  // Try KV first
  if (env.SLA_STORAGE) {
    if (!uploadId) {
      const list = (await env.SLA_STORAGE.get('uploads_index', 'json')) || [];
      if (list.length > 0) uploadId = list[0].id;
    }

    if (uploadId) {
      const allRecords = (await env.SLA_STORAGE.get(`upload:${uploadId}:records`, 'json')) || [];
      if (allRecords.length > 0) {
        let filtered = allRecords;

        if (singleDate) {
          filtered = filtered.filter(r => r.check_date === singleDate);
        } else if (startDate && endDate) {
          filtered = filtered.filter(r => r.check_date >= startDate && r.check_date <= endDate);
        } else if (startDate) {
          filtered = filtered.filter(r => r.check_date >= startDate);
        } else if (endDate) {
          filtered = filtered.filter(r => r.check_date <= endDate);
        }

        if (serviceId && serviceId !== 'all') {
          filtered = filtered.filter(r => r.service_id === serviceId);
        }

        if (statusFilter === 'healthy') {
          filtered = filtered.filter(r => r.is_healthy === 1);
        } else if (statusFilter === 'unhealthy') {
          filtered = filtered.filter(r => r.is_healthy === 0);
        }

        // Sort descending (newest first)
        filtered.sort((a, b) => (a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0));

        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const pagedLogs = filtered.slice(offset, offset + limit);

        return jsonResponse({
          logs: pagedLogs,
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
    }
  }

  // Fallback to D1
  if (env.DB) {
    if (!uploadId) {
      const latest = await env.DB.prepare(
        `SELECT id FROM uploads WHERE clean_rows > 10 ORDER BY uploaded_at DESC LIMIT 1`
      ).first();
      if (!latest) {
        return jsonResponse({ logs: [], pagination: { page: 1, limit: 50, total: 0, total_pages: 0 } });
      }
      uploadId = latest.id;
    }

    const conditions = ['upload_id = ?'];
    const params = [uploadId];

    if (singleDate) {
      conditions.push('check_date = ?');
      params.push(singleDate);
    } else if (startDate && endDate) {
      conditions.push('check_date >= ? AND check_date <= ?');
      params.push(startDate, endDate);
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
    const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM health_checks WHERE ${whereClause}`).bind(...params).first();
    const total = countRes ? Number(countRes.total) : 0;
    const totalPages = Math.ceil(total / limit);

    const dataRes = await env.DB.prepare(
      `SELECT * FROM health_checks WHERE ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return jsonResponse({
      logs: dataRes.results || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    });
  }

  return jsonResponse({ logs: [], pagination: { page: 1, limit: 50, total: 0, total_pages: 0 } });
}

/**
 * Handler: GET /api/uploads
 */
async function handleListUploads(env) {
  if (env.SLA_STORAGE) {
    try {
      const list = await env.SLA_STORAGE.get('uploads_index', 'json');
      if (Array.isArray(list)) {
        return jsonResponse({ uploads: list });
      }
    } catch (e) {
      console.log('KV list error:', e);
    }
  }

  return jsonResponse({ uploads: [] });
}

/**
 * Handler: POST /api/reset
 * Resets uploads index so user starts with a clean slate
 */
async function handleResetAll(env) {
  if (env.SLA_STORAGE) {
    await env.SLA_STORAGE.put('uploads_index', JSON.stringify([]));
  }
  return jsonResponse({ success: true, message: 'All uploads reset. Clean slate ready.' });
}

/**
 * Handler: DELETE /api/uploads/:id
 */
async function handleDeleteUpload(id, env) {
  if (env.SLA_STORAGE) {
    let list = (await env.SLA_STORAGE.get('uploads_index', 'json')) || [];
    list = list.filter(u => u.id !== id);
    await Promise.all([
      env.SLA_STORAGE.put('uploads_index', JSON.stringify(list)),
      env.SLA_STORAGE.delete(`upload:${id}:stats`),
      env.SLA_STORAGE.delete(`upload:${id}:records`),
    ]);
  }
  return jsonResponse({ success: true, message: `Upload ${id} deleted` });
}
