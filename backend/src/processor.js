/**
 * Core Data Processing & Cleaning Engine for SLA Monitoring
 * Stateless, deterministic, and modular.
 */

/**
 * Parses raw CSV string handling quoted values, escaped quotes, and CRLF/LF line endings.
 * @param {string} csvText
 * @returns {Array<string[]>} array of rows, where each row is an array of string values
 */
export function parseCSVToRows(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present (common in Windows/Excel CSVs)
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  const len = text.length;
  for (let i = 0; i < len; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && csvText[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted section
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (i + 1 < len && csvText[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Normalizes timestamp string or epoch number to UTC ISO8601 string and YYYY-MM-DD date.
 * Returns { utcTimestamp, checkDate, formatType, error }
 */
export function normalizeTimestamp(rawTimestamp) {
  if (!rawTimestamp || typeof rawTimestamp !== 'string' || !rawTimestamp.trim()) {
    return { error: 'MISSING_TIMESTAMP' };
  }

  const trimmed = rawTimestamp.trim();

  // Check for pure numeric epoch
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return { error: 'UNPARSEABLE_TIMESTAMP' };
    }

    let dt;
    let formatType = 'epoch_seconds';
    if (num > 1e11) {
      // Millisecond epoch (e.g. 1744349400000)
      dt = new Date(num);
      formatType = 'epoch_ms';
    } else if (num > 1e8 && num < 1e11) {
      // Second epoch (e.g. 1744349400)
      dt = new Date(num * 1000);
    } else {
      return { error: 'SUSPICIOUS_TIMESTAMP' };
    }

    if (isNaN(dt.getTime())) {
      return { error: 'UNPARSEABLE_TIMESTAMP' };
    }

    const iso = dt.toISOString();
    return {
      utcTimestamp: iso,
      checkDate: iso.slice(0, 10),
      formatType,
    };
  }

  // Check for ISO offset (e.g., +05:30, -04:00, or Z)
  const dt = new Date(trimmed);
  if (isNaN(dt.getTime())) {
    return { error: 'UNPARSEABLE_TIMESTAMP' };
  }

  let formatType = 'utc_z';
  if (trimmed.includes('+') || (trimmed.includes('-') && trimmed.indexOf('-') > 10)) {
    formatType = 'timezone_offset';
  } else if (!trimmed.endsWith('Z') && !trimmed.endsWith('z')) {
    formatType = 'unspecified_tz_assumed_utc';
  }

  const iso = dt.toISOString();
  return {
    utcTimestamp: iso,
    checkDate: iso.slice(0, 10),
    formatType,
  };
}

/**
 * Normalizes latency to milliseconds based on unit and value.
 * Returns { latencyMs, issues: string[] }
 */
export function normalizeLatency(rawLatency, rawUnit) {
  const issues = [];
  const trimmedLat = rawLatency ? String(rawLatency).trim() : '';
  const trimmedUnit = rawUnit ? String(rawUnit).trim().toLowerCase() : '';

  if (!trimmedLat) {
    issues.push('EMPTY_LATENCY');
    return { latencyMs: null, issues };
  }

  // Detect unit if embedded in latency string
  let unit = trimmedUnit;
  let numericStr = trimmedLat;
  const match = trimmedLat.match(/^([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)\s*([a-zA-Z]+)?$/);
  if (match) {
    numericStr = match[1];
    if (match[3] && !unit) {
      unit = match[3].toLowerCase();
    }
  }

  const num = Number(numericStr);
  if (!Number.isFinite(num) || isNaN(num)) {
    issues.push('INVALID_LATENCY_FORMAT');
    return { latencyMs: null, issues };
  }

  let multiplier = 1;
  if (unit === 's' || unit === 'sec' || unit === 'seconds') {
    multiplier = 1000;
    issues.push('LATENCY_UNIT_SECONDS');
  } else if (unit === 'us' || unit === 'microseconds') {
    multiplier = 0.001;
    issues.push('LATENCY_UNIT_MICROSECONDS');
  } else if (unit === 'ms' || unit === 'milliseconds' || !unit) {
    multiplier = 1;
  } else {
    issues.push(`UNKNOWN_LATENCY_UNIT_${unit}`);
    multiplier = 1;
  }

  const latencyMs = Math.round(num * multiplier * 100) / 100;

  if (latencyMs < 0) {
    issues.push('NEGATIVE_LATENCY');
    return { latencyMs: null, issues };
  }

  if (latencyMs === 0) {
    issues.push('ZERO_LATENCY');
  } else if (latencyMs > 30000) {
    issues.push('EXTREME_LATENCY_GT_30S');
  }

  return { latencyMs, issues };
}

/**
 * Validates and classifies HTTP status code for SLA availability.
 * Returns { statusCode, isHealthy, issues: string[], shouldDrop: boolean }
 */
export function classifyStatusCode(rawStatus) {
  const issues = [];
  const trimmed = rawStatus ? String(rawStatus).trim() : '';

  if (!trimmed) {
    issues.push('MISSING_STATUS_CODE');
    return { statusCode: null, isHealthy: null, issues, shouldDrop: true };
  }

  const num = Number(trimmed);
  if (!Number.isInteger(num)) {
    // Try truncating if float
    if (Number.isFinite(num)) {
      const code = Math.trunc(num);
      if (code >= 100 && code <= 599) {
        issues.push('FLOAT_STATUS_CODE_TRUNCATED');
        const isHealthy = code >= 500 ? 0 : 1;
        return { statusCode: code, isHealthy, issues, shouldDrop: false };
      }
    }
    issues.push('NON_NUMERIC_STATUS_CODE');
    return { statusCode: null, isHealthy: null, issues, shouldDrop: true };
  }

  if (num < 100 || num > 599) {
    issues.push(`INVALID_HTTP_STATUS_${num}`);
    return { statusCode: num, isHealthy: null, issues, shouldDrop: true };
  }

  // 1xx, 2xx, 3xx, 4xx are reachable/available (4xx means service is up and responding)
  // 5xx indicates server failure / outage
  const isHealthy = num >= 500 ? 0 : 1;
  return { statusCode: num, isHealthy, issues, shouldDrop: false };
}

/**
 * Main CSV processing function.
 * Parses, validates, cleans, deduplicates, and aggregates metrics.
 * @param {string} csvText - Raw CSV text
 * @param {string} filename - Name of uploaded file
 */
export function processCSV(csvText, filename = 'monitoring_checks.csv') {
  const rawRows = parseCSVToRows(csvText);

  if (rawRows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Filter out blank trailing rows
  const nonEmptyRows = rawRows.filter(r => r.some(f => f.trim() !== ''));
  if (nonEmptyRows.length < 2) {
    throw new Error('CSV file contains no data rows besides header');
  }

  const rawHeaders = nonEmptyRows[0].map(h => h.trim().toLowerCase().replace(/^\uFEFF/, ''));
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const findCol = (aliases) => {
    for (const a of aliases) {
      if (a in headerMap) return headerMap[a];
    }
    return undefined;
  };

  const tsIdx = findCol(['timestamp', 'time', 'datetime', 'date', 'ts']);
  const statusIdx = findCol(['status_code', 'status', 'statuscode', 'http_status', 'code']);
  const svcIdIdx = findCol(['service_id', 'serviceid', 'service', 'service_name', 'servicename']);
  const svcNameIdx = findCol(['service_name', 'servicename', 'name', 'service_display_name']);
  const latIdx = findCol(['latency', 'latency_ms', 'latency_seconds', 'duration', 'response_time']);
  const unitIdx = findCol(['latency_unit', 'unit', 'lat_unit']);
  const agentIdx = findCol(['agent', 'agent_id', 'probe', 'collector']);
  const regionIdx = findCol(['region', 'location', 'datacenter', 'dc']);

  if (tsIdx === undefined || statusIdx === undefined) {
    throw new Error('CSV is missing required columns: timestamp and status_code');
  }

  const cleanedRecords = [];
  const droppedRecords = [];
  const issueCounts = {};

  const recordIssue = (issueType, sample = '') => {
    if (!issueCounts[issueType]) {
      issueCounts[issueType] = { count: 0, samples: [] };
    }
    issueCounts[issueType].count++;
    if (issueCounts[issueType].samples.length < 5 && sample) {
      issueCounts[issueType].samples.push(sample);
    }
  };

  const seenKeys = new Set();
  const dataRows = nonEmptyRows.slice(1);

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const rowNumber = rowIdx + 2;

    // Check column count mismatch
    if (row.length !== rawHeaders.length) {
      recordIssue('MALFORMED_ROW_COLUMN_MISMATCH', `Row ${rowNumber}: expected ${rawHeaders.length} columns, got ${row.length}`);
    }

    const rawSvcId = svcIdIdx !== undefined ? row[svcIdIdx] : '';
    const rawSvcName = svcNameIdx !== undefined ? row[svcNameIdx] : '';
    const rawTs = row[tsIdx] || '';
    const rawStatus = row[statusIdx] || '';
    const rawLat = latIdx !== undefined ? row[latIdx] : '';
    const rawUnit = unitIdx !== undefined ? row[unitIdx] : '';
    const rawAgent = agentIdx !== undefined ? row[agentIdx] : '';
    const rawRegion = regionIdx !== undefined ? row[regionIdx] : '';

    const serviceId = (rawSvcId || '').trim();
    if (!serviceId) {
      recordIssue('MISSING_SERVICE_ID', `Row ${rowNumber}`);
      droppedRecords.push({ rowNumber, reason: 'MISSING_SERVICE_ID' });
      continue;
    }

    const serviceName = (rawSvcName || '').trim() || serviceId;
    const agent = (rawAgent || '').trim() || 'unknown';
    const region = (rawRegion || '').trim() || 'unknown';

    // Normalize timestamp
    const tsResult = normalizeTimestamp(rawTs);
    if (tsResult.error) {
      recordIssue(tsResult.error, `Row ${rowNumber}: ${rawTs}`);
      droppedRecords.push({ rowNumber, reason: tsResult.error, raw: rawTs });
      continue;
    }
    if (tsResult.formatType && tsResult.formatType !== 'utc_z') {
      recordIssue(`TIMESTAMP_${tsResult.formatType.toUpperCase()}`, rawTs);
    }

    // Classify status code
    const statusResult = classifyStatusCode(rawStatus);
    statusResult.issues.forEach(iss => recordIssue(iss, `Row ${rowNumber}: status ${rawStatus}`));
    if (statusResult.shouldDrop) {
      droppedRecords.push({ rowNumber, reason: statusResult.issues.join(', '), raw: rawStatus });
      continue;
    }

    // Normalize latency
    const latResult = normalizeLatency(rawLat, rawUnit);
    latResult.issues.forEach(iss => recordIssue(iss, `Row ${rowNumber}: latency ${rawLat} ${rawUnit}`));

    // Deduplication check
    const dedupKey = `${serviceId}|${tsResult.utcTimestamp}|${agent}`;
    if (seenKeys.has(dedupKey)) {
      recordIssue('DUPLICATE_ROW', `Row ${rowNumber}: ${dedupKey}`);
      droppedRecords.push({ rowNumber, reason: 'DUPLICATE_ROW', key: dedupKey });
      continue;
    }
    seenKeys.add(dedupKey);

    cleanedRecords.push({
      service_id: serviceId,
      service_name: serviceName,
      timestamp: tsResult.utcTimestamp,
      status_code: statusResult.statusCode,
      latency_ms: latResult.latencyMs,
      agent,
      region,
      is_healthy: statusResult.isHealthy,
      check_date: tsResult.checkDate,
    });
  }

  // Sort records chronologically
  cleanedRecords.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

  const dateStart = cleanedRecords.length > 0 ? cleanedRecords[0].check_date : null;
  const dateEnd = cleanedRecords.length > 0 ? cleanedRecords[cleanedRecords.length - 1].check_date : null;

  return {
    filename,
    totalRows: dataRows.length,
    cleanRows: cleanedRecords.length,
    droppedRows: droppedRecords.length,
    dateRange: {
      start: dateStart,
      end: dateEnd,
    },
    issues: Object.entries(issueCounts).map(([type, data]) => ({
      type,
      count: data.count,
      samples: data.samples,
    })),
    records: cleanedRecords,
    dropped: droppedRecords,
  };
}
