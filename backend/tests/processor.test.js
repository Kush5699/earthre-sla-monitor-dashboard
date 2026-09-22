import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSVToRows,
  normalizeTimestamp,
  normalizeLatency,
  classifyStatusCode,
  processCSV,
} from '../src/processor.js';

describe('CSV Parser', () => {
  it('correctly handles quoted fields, commas, and newlines', () => {
    const csv = 'col1,col2,"col3,with,commas","col4 ""with quotes"""\r\nval1,val2,"hello, world","quote ""test"""\n';
    const rows = parseCSVToRows(csv);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['col1', 'col2', 'col3,with,commas', 'col4 "with quotes"']);
    assert.deepEqual(rows[1], ['val1', 'val2', 'hello, world', 'quote "test"']);
  });

  it('handles empty input gracefully', () => {
    assert.deepEqual(parseCSVToRows(''), []);
    assert.deepEqual(parseCSVToRows(null), []);
  });
});

describe('Timestamp Normalization', () => {
  it('normalizes standard UTC ISO timestamps with Z', () => {
    const res = normalizeTimestamp('2025-04-11T17:30:00Z');
    assert.equal(res.error, undefined);
    assert.equal(res.utcTimestamp, '2025-04-11T17:30:00.000Z');
    assert.equal(res.checkDate, '2025-04-11');
    assert.equal(res.formatType, 'utc_z');
  });

  it('normalizes timezone offset timestamps (e.g. +05:30) to UTC', () => {
    const res = normalizeTimestamp('2025-04-12T14:15:00+05:30');
    assert.equal(res.error, undefined);
    // 14:15 IST is 08:45 UTC
    assert.equal(res.utcTimestamp, '2025-04-12T08:45:00.000Z');
    assert.equal(res.checkDate, '2025-04-12');
    assert.equal(res.formatType, 'timezone_offset');
  });

  it('normalizes Unix epoch timestamps in seconds', () => {
    const res = normalizeTimestamp('1744349400');
    assert.equal(res.error, undefined);
    assert.equal(res.utcTimestamp, '2025-04-11T05:30:00.000Z');
    assert.equal(res.checkDate, '2025-04-11');
    assert.equal(res.formatType, 'epoch_seconds');
  });

  it('rejects invalid or empty timestamps', () => {
    assert.equal(normalizeTimestamp('').error, 'MISSING_TIMESTAMP');
    assert.equal(normalizeTimestamp('not-a-timestamp').error, 'UNPARSEABLE_TIMESTAMP');
  });
});

describe('Latency Normalization', () => {
  it('keeps millisecond values intact', () => {
    const res = normalizeLatency('258', 'ms');
    assert.equal(res.latencyMs, 258);
    assert.equal(res.issues.length, 0);
  });

  it('normalizes second values by multiplying by 1000', () => {
    const res = normalizeLatency('0.486', 's');
    assert.equal(res.latencyMs, 486);
    assert.ok(res.issues.includes('LATENCY_UNIT_SECONDS'));
  });

  it('handles empty latency gracefully (sets null, flags EMPTY_LATENCY)', () => {
    const res = normalizeLatency('', 'ms');
    assert.equal(res.latencyMs, null);
    assert.ok(res.issues.includes('EMPTY_LATENCY'));
  });

  it('flags negative latency and nullifies value', () => {
    const res = normalizeLatency('-296', 'ms');
    assert.equal(res.latencyMs, null);
    assert.ok(res.issues.includes('NEGATIVE_LATENCY'));
  });

  it('flags zero latency', () => {
    const res = normalizeLatency('0', 'ms');
    assert.equal(res.latencyMs, 0);
    assert.ok(res.issues.includes('ZERO_LATENCY'));
  });

  it('flags extreme latency (>30s)', () => {
    const res = normalizeLatency('35000', 'ms');
    assert.equal(res.latencyMs, 35000);
    assert.ok(res.issues.includes('EXTREME_LATENCY_GT_30S'));
  });
});

describe('Status Code Classification', () => {
  it('classifies 2xx as healthy', () => {
    const res = classifyStatusCode('200');
    assert.equal(res.statusCode, 200);
    assert.equal(res.isHealthy, 1);
    assert.equal(res.shouldDrop, false);
  });

  it('classifies 4xx as healthy (reachable service)', () => {
    const res = classifyStatusCode('404');
    assert.equal(res.statusCode, 404);
    assert.equal(res.isHealthy, 1);
    assert.equal(res.shouldDrop, false);
  });

  it('classifies 5xx as unhealthy (downtime)', () => {
    ['500', '502', '503'].forEach(code => {
      const res = classifyStatusCode(code);
      assert.equal(res.statusCode, Number(code));
      assert.equal(res.isHealthy, 0);
      assert.equal(res.shouldDrop, false);
    });
  });

  it('drops invalid HTTP status codes like 999, negative, or non-numeric', () => {
    assert.equal(classifyStatusCode('999').shouldDrop, true);
    assert.equal(classifyStatusCode('-1').shouldDrop, true);
    assert.equal(classifyStatusCode('error').shouldDrop, true);
    assert.equal(classifyStatusCode('').shouldDrop, true);
  });
});

describe('Full CSV Pipeline Processing', () => {
  it('processes, cleans, deduplicates and summarizes a mixed CSV correctly', () => {
    const sampleCSV = `service_id,service_name,timestamp,status_code,latency,latency_unit,agent,region
svc-payments,payments-api,2025-04-11T17:30:00Z,200,258,ms,agent-1,ap-south-1
svc-search,search-api,2025-04-10T13:15:00Z,200,0.486,s,agent-1,ap-south-1
svc-auth,auth-api,1744349400,200,,ms,agent-1,ap-south-1
svc-reports,reports-api,2025-04-12T14:15:00+05:30,500,819,ms,agent-1,ap-south-1
svc-notify,notify-worker,2025-04-11T17:30:00Z,999,100,ms,agent-1,ap-south-1
svc-payments,payments-api,2025-04-11T17:30:00Z,200,258,ms,agent-1,ap-south-1
svc-search,search-api,2025-04-12T10:00:00Z,200,-50,ms,agent-1,ap-south-1
`;

    const res = processCSV(sampleCSV, 'test.csv');
    assert.equal(res.totalRows, 7);
    // Row 5 has status 999 -> dropped
    // Row 6 is duplicate of Row 1 -> dropped
    // 5 clean rows remain
    assert.equal(res.cleanRows, 5);
    assert.equal(res.droppedRows, 2);

    // Verify search latency was normalized to ms (0.486s -> 486ms)
    const searchRow = res.records.find(r => r.service_id === 'svc-search' && r.status_code === 200 && r.latency_ms === 486);
    assert.ok(searchRow, 'Search row with normalized 486ms should exist');

    // Verify auth row has null latency due to empty value, but isHealthy = 1
    const authRow = res.records.find(r => r.service_id === 'svc-auth');
    assert.ok(authRow);
    assert.equal(authRow.latency_ms, null);
    assert.equal(authRow.is_healthy, 1);

    // Verify reports row has status 500 and isHealthy = 0
    const reportsRow = res.records.find(r => r.service_id === 'svc-reports');
    assert.ok(reportsRow);
    assert.equal(reportsRow.status_code, 500);
    assert.equal(reportsRow.is_healthy, 0);

    // Verify negative latency row: latency is null, but isHealthy = 1
    const negLatRow = res.records.find(r => r.service_id === 'svc-search' && r.check_date === '2025-04-12');
    assert.ok(negLatRow);
    assert.equal(negLatRow.latency_ms, null);
    assert.equal(negLatRow.is_healthy, 1);

    // Verify date range
    assert.ok(res.dateRange.start);
    assert.ok(res.dateRange.end);
  });

  it('successfully cleans and processes all 5 real assignment CSVs', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const files = [
      'monitoring_checks_9d_seed101.csv',
      'monitoring_checks_12d_seed505.csv',
      'monitoring_checks_14d_seed202.csv',
      'monitoring_checks_21d_seed303.csv',
      'monitoring_checks_30d_seed404.csv',
    ];

    for (const file of files) {
      const filePath = path.resolve('..', file);
      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch {
        content = await fs.readFile(path.resolve(file), 'utf8');
      }

      const res = processCSV(content, file);
      assert.ok(res.cleanRows > 4000, `${file} should have > 4000 clean rows`);
      assert.ok(res.droppedRows > 0, `${file} should catch and drop invalid rows`);
      assert.ok(res.issues.length >= 5, `${file} should detect at least 5 issue categories`);
      assert.ok(res.dateRange.start && res.dateRange.end);
      
      // Verify every cleaned record has a valid date and is_healthy flag (0 or 1)
      for (const rec of res.records.slice(0, 100)) {
        assert.ok(['svc-auth', 'svc-notify', 'svc-payments', 'svc-reports', 'svc-search'].includes(rec.service_id));
        assert.ok(rec.is_healthy === 0 || rec.is_healthy === 1);
        assert.ok(rec.check_date.length === 10);
      }
    }
  });
});

