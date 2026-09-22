import test from 'node:test';
import assert from 'node:assert/strict';
import { processCSV } from '../src/processor.js';

test('Stress & Generalization: UTF-8 Byte Order Mark (BOM)', () => {
  // Common artifact when exporting from Excel or pandas on Windows
  const bomCsv = '\uFEFFtimestamp,service_id,status_code,latency,agent,region\n' +
    '2026-03-01T00:00:00Z,svc-custom,200,45ms,agent-us-east,us-east-1\n' +
    '2026-03-01T00:15:00Z,svc-custom,200,50ms,agent-us-east,us-east-1\n';

  const result = processCSV(bomCsv, 'test_bom.csv');
  assert.equal(result.cleanRows, 2);
  assert.equal(result.droppedRows, 0);
  assert.equal(result.records[0].service_id, 'svc-custom');
  assert.equal(result.records[0].status_code, 200);
});

test('Stress & Generalization: Alternative Header Aliases & Case-Insensitivity', () => {
  // Evaluator using alternative column names and mixed casing
  const aliasCsv = 'Time,Service,HTTP_Status,Duration,Lat_Unit,Probe,Location\n' +
    '2026-03-01T01:00:00Z,svc-analytics,200,120,ms,probe-alpha,us-west\n' +
    '2026-03-01T01:15:00Z,svc-analytics,500,1.2,s,probe-alpha,us-west\n';

  const result = processCSV(aliasCsv, 'test_aliases.csv');
  assert.equal(result.cleanRows, 2);
  assert.equal(result.records[0].service_id, 'svc-analytics');
  assert.equal(result.records[0].status_code, 200);
  assert.equal(result.records[0].latency_ms, 120);
  assert.equal(result.records[1].status_code, 500);
  assert.equal(result.records[1].latency_ms, 1200); // 1.2s converted to 1200ms
  assert.equal(result.records[1].is_healthy, 0); // 500 is outage
});

test('Stress & Generalization: Arbitrary Services & Arbitrary Service Counts', () => {
  // 8 distinct microservices - not the 5 default ones
  let csv = 'timestamp,service_id,status_code,latency,agent,region\n';
  const services = ['svc-a', 'svc-b', 'svc-c', 'svc-d', 'svc-e', 'svc-f', 'svc-g', 'svc-h'];
  
  services.forEach((s, idx) => {
    csv += `2026-03-01T00:00:00Z,${s},200,${20 + idx * 5}ms,agent-1,us-east\n`;
  });

  const result = processCSV(csv, 'test_8_services.csv');
  assert.equal(result.cleanRows, 8);
  const foundServices = new Set(result.records.map(r => r.service_id));
  assert.equal(foundServices.size, 8);
});

test('Stress & Generalization: Extreme Date Ranges (1-Day and 45-Day timelines)', () => {
  // 1-day dataset
  const day1Csv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-01-01T00:00:00Z,svc-gateway,200,30ms,agent-1,us-east\n' +
    '2026-01-01T23:45:00Z,svc-gateway,200,35ms,agent-1,us-east\n';

  const r1 = processCSV(day1Csv, '1day.csv');
  assert.equal(r1.dateRange.start, '2026-01-01');
  assert.equal(r1.dateRange.end, '2026-01-01');

  // 45-day dataset
  const day45Csv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-01-01T00:00:00Z,svc-gateway,200,30ms,agent-1,us-east\n' +
    '2026-02-14T23:45:00Z,svc-gateway,200,35ms,agent-1,us-east\n';

  const r45 = processCSV(day45Csv, '45days.csv');
  assert.equal(r45.dateRange.start, '2026-01-01');
  assert.equal(r45.dateRange.end, '2026-02-14');
});

test('Stress & Generalization: 100% Compliant Fleet vs 100% Outage Fleet', () => {
  // 100% healthy
  const healthyCsv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-03-01T00:00:00Z,svc-1,200,40ms,agent-1,us-east\n' +
    '2026-03-01T00:15:00Z,svc-1,200,40ms,agent-1,us-east\n';
  const rH = processCSV(healthyCsv, 'healthy.csv');
  assert.equal(rH.records.every(r => r.is_healthy === 1), true);

  // 100% outage
  const outageCsv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-03-01T00:00:00Z,svc-1,503,40ms,agent-1,us-east\n' +
    '2026-03-01T00:15:00Z,svc-1,500,40ms,agent-1,us-east\n';
  const rO = processCSV(outageCsv, 'outage.csv');
  assert.equal(rO.records.every(r => r.is_healthy === 0), true);
});

test('Stress & Generalization: Corrupted Status Codes & Defensive Fallbacks', () => {
  const corruptedCsv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-03-01T00:00:00Z,svc-test,200,40ms,agent-1,us-east\n' +
    '2026-03-01T00:15:00Z,svc-test,999,40ms,agent-1,us-east\n' +    // Invalid HTTP 999
    '2026-03-01T00:30:00Z,svc-test,-1,40ms,agent-1,us-east\n' +     // Invalid negative
    '2026-03-01T00:45:00Z,svc-test,timeout,40ms,agent-1,us-east\n' +// Non-numeric
    '2026-03-01T01:00:00Z,svc-test,200.0,40ms,agent-1,us-east\n';  // Float status code from pandas

  const result = processCSV(corruptedCsv, 'corrupted.csv');
  assert.equal(result.cleanRows, 2); // 200 and 200.0 are accepted
  assert.equal(result.droppedRows, 3); // 999, -1, and timeout are dropped
  assert.equal(result.records[1].status_code, 200); // 200.0 truncated to integer
});

test('Stress & Generalization: Out-of-Order Shuffled Timestamps and Deduplication', () => {
  // Chronologically shuffled rows + exact duplicate
  const shuffledCsv = 'timestamp,service_id,status_code,latency,agent,region\n' +
    '2026-03-01T03:00:00Z,svc-a,200,40ms,agent-1,us-east\n' +
    '2026-03-01T01:00:00Z,svc-a,200,40ms,agent-1,us-east\n' +
    '2026-03-01T02:00:00Z,svc-a,200,40ms,agent-1,us-east\n' +
    '2026-03-01T01:00:00Z,svc-a,200,40ms,agent-1,us-east\n'; // Duplicate of 01:00

  const result = processCSV(shuffledCsv, 'shuffled.csv');
  assert.equal(result.cleanRows, 3);
  assert.equal(result.droppedRows, 1);
  // Records must be sorted chronologically
  assert.equal(result.records[0].timestamp, '2026-03-01T01:00:00.000Z');
  assert.equal(result.records[1].timestamp, '2026-03-01T02:00:00.000Z');
  assert.equal(result.records[2].timestamp, '2026-03-01T03:00:00.000Z');
});
