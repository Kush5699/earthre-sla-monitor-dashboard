# SLA Monitoring Dashboard

An end-to-end, production-grade SLA monitoring system designed to turn raw, multi-agent health check logs into trustworthy availability numbers and actionable billing credit insights.

**Live Deployment URL:** [https://sla-monitor-dashboard.sla-monitor-backend.workers.dev](https://sla-monitor-dashboard.sla-monitor-backend.workers.dev)  
**Live Backend API URL:** [https://sla-monitor-api.sla-monitor-backend.workers.dev](https://sla-monitor-api.sla-monitor-backend.workers.dev)

---

## 1. Architecture Overview

```
 [ Browser / User ]
         │
         │ 1. Upload CSV / Query Dashboard
         ▼
 [ Cloudflare Pages / Workers Static Assets ]
   - React 19 + Vite + Tailwind CSS (Clean White Enterprise UI)
   - Single-screen dashboard (Collapsible Stats + Filterable Logs)
         │
         │ 2. HTTPS REST Calls
         ▼
 [ Cloudflare Workers (APAC Edge) ]
   - Stateless Serverless Function (src/index.js)
   - Modular Data Processing & Cleaning Engine (src/processor.js)
   - Normalizes timestamps (UTC, offsets, epochs)
   - Standardizes latency units (seconds to milliseconds)
   - Classifies HTTP status ranges (2xx vs 5xx downtime)
   - De-duplicates multi-agent check collisions
         │
         │ 3. Parameterized Batch SQL (D1 Driver)
         ▼
 [ Cloudflare D1 (Serverless SQLite at the Edge) ]
   - Table `uploads`: session metadata, row counts, data findings
   - Table `health_checks`: cleaned records with indexed query support
```

### Why This Stack?

1. **Cloudflare Workers (Stateless Serverless Execution):**
   - True cloud serverless execution running at the edge across 300+ data centers.
   - Zero cold-start delay (V8 isolates instead of heavy container spin-up).
   - Fully stateless: each CSV upload is processed deterministically without relying on local server state or memory leaks.

2. **Cloudflare D1 (Serverless SQLite Storage):**
   - Re-queryable persistent relational database co-located with the Workers execution runtime.
   - Full SQL query power for fast date-range filtering, aggregation, and group-by calculations.
   - 100% free-tier compliant (5GB storage, 5M reads/day, 100K writes/day, no credit card lock-in).

3. **React 19 + Vite + Tailwind CSS (Enterprise Light Theme):**
   - Built with a clean, high-contrast white and slate palette inspired by Datadog, Stripe, and AWS CloudWatch, intentionally avoiding generic AI dark themes.
   - Single-screen layout satisfying the core product workflow: top collapsible stats panel and bottom filterable logs view.

---

## 2. Data Findings: Issues Discovered and Resolution Strategy

Real-world monitoring agents produce messy telemetry when operating across distributed networks and multiple days. Analyzing all provided datasets (from 9-day to 30-day logs) uncovered 9 distinct data quality issues that scale consistently with dataset size:

| # | Data Quality Issue | Discovered Pattern & Sample | Handling & Resolution Strategy |
|---|---|---|---|
| 1 | **Mixed Timezone Formats** | Most rows use UTC ISO strings (`2025-04-11T17:30:00Z`), but ~1.5% use 10-digit Unix epochs (e.g. `1744349400`) and ~0.7% use local timezone offsets (e.g. `+05:30`). | Parsed via multi-stage format detector: epoch seconds and milliseconds are converted to valid UTC Date objects, and timezone offsets are converted to UTC ISO8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`). A `check_date` (`YYYY-MM-DD`) is extracted for indexed SQL date queries. |
| 2 | **Mixed Latency Units** | ~80% of rows report latency in milliseconds (`ms`), but ~20% of rows (specifically all records for `svc-search`) report in seconds (`0.486 s`). | Normalized to a uniform unit (milliseconds) at ingestion. Seconds are multiplied by 1000; microseconds are divided by 1000. All downstream database queries and percentile computations operate on consistent millisecond values. |
| 3 | **Empty / Unrecorded Latencies** | ~1.2% of checks have blank latency strings (e.g. `latency=""`), representing network timeouts or agent reporting lapses. | Flagged as `EMPTY_LATENCY`. The check is retained for availability calculations (a status 200 response still confirms service reachability), while `latency_ms` is stored as `NULL` so it does not distort average or percentile latency calculations. |
| 4 | **Negative Latency Values** | Exactly 1 record per dataset contains negative latency (e.g. `-296 ms`), caused by agent clock skew or synchronization glitches. | Physically impossible response time. Flagged as `NEGATIVE_LATENCY`. Retained for availability counting if status code is valid, but excluded from latency metrics (`latency_ms` set to `NULL`). |
| 5 | **Bogus HTTP Status Code 999** | Exactly 1 record per dataset contains HTTP status `999`, which is outside standard RFC specifications. | Identified as corrupt telemetry. Dropped entirely from the dataset because true reachability cannot be determined. |
| 6 | **Exact Duplicate Checks** | Multi-agent collisions where identical timestamp, service, and agent checks were logged multiple times (6 to 24 duplicates per file). | De-duplicated using a composite set key: `service_id + "|" + timestamp + "|" + agent`. The first record is preserved and subsequent duplicates are safely dropped. |
| 7 | **Out-of-Order Records** | Records across services and days are completely shuffled in the raw export. | The ingestion pipeline sorts all cleaned records chronologically before persisting to D1, guaranteeing predictable time-series queries. |
| 8 | **Secondary Agent Sparsity** | Primary agent (`agent-1`) covers all 96 daily 15-minute slots, while secondary agent (`agent-2`) contributes ~7.4% spot-checks with time gaps. | Validated that `agent-2` represents valid spot-checks rather than data loss. Both agents' records are preserved and tagged. |
| 9 | **Malformed Rows / Boundary Checks** | Handled trailing empty rows, comma escaping in quoted fields, and carriage return line breaks (`\r\n`). | Robust RFC-4180 compliant CSV state machine parser handles escaped quotes, embedded commas, and cross-platform line endings without external parser dependencies. |

---

## 3. Key Design Decisions & Assumptions

### A. HTTP Status Code Range Classification for SLA Availability

The SLA availability metric decides automatic financial billing credits. We classify HTTP status codes by RFC standard range:

- **2xx (Success):** Healthy. Service responded successfully.
- **1xx / 3xx (Informational / Redirect):** Healthy. Service is reachable and responding.
- **4xx (Client Error):** Classified as Healthy. A `401 Unauthorized` or `404 Not Found` indicates the service itself is online and processing requests; the issue lies with the client request rather than server downtime.
- **5xx (Server Error):** Unhealthy / Outage. Internal server error (`500`), bad gateway (`502`), or service unavailable (`503`) represent legitimate downtime that counts against the SLA.
- **Availability Formula:**  
  `Availability Percentage = (Healthy Checks / Total Valid Evaluated Checks) * 100`

### B. What Stats Matter on the Dashboard (Product Thinking)

The brief tasks the engineer with deciding what stats matter for an on-call engineer or billing team:

1. **Overall Availability vs 99.9% Target:** The primary contractual benchmark that triggers financial credits.
2. **SLA Breach Count & Financial Credit Badge:** Clear visual signal declaring whether customer billing credits are required.
3. **Per-Service Availability Cards:** Individual availability figures with color-coded status (emerald if compliant, crimson if breached) and visual progress bars marking the 99.9% target threshold.
4. **Latency Percentiles (Avg, P50, P95, P99):** Crucial because a service can report HTTP 200 while suffering severe latency degradation.
5. **Outage Code Breakdown:** Granular counts of 500 (crash), 502 (gateway/network), and 503 (capacity overload) to guide root-cause triage.

---

## 4. Requirement Verification & Implementation Mapping

| Problem Statement Requirement | Implementation Details | Verified Status |
|---|---|---|
| **R1: Upload UI** | `frontend/src/components/UploadModal.jsx` provides drag-and-drop CSV upload with validation and issue breakdown cards. | Verified Live |
| **R2: Stateless Serverless Cloud Function** | `backend/src/index.js` & `src/processor.js` deployed to Cloudflare Workers (`workers.dev`). Parses, validates, and normalizes data in the cloud. | Verified Live |
| **R3: Persistent Database** | Cloudflare D1 (SQLite) with schema in `backend/schema.sql`. Persists `uploads` and `health_checks` records with indexes. | Verified Live |
| **R4: Single-Screen Dashboard (Top: Collapsible Stats)** | `frontend/src/components/StatsSection.jsx` features toggleable collapse/expand, SLA breach badges, and per-service metrics. | Verified Live |
| **R4: Single-Screen Dashboard (Bottom: Filterable Logs)** | `frontend/src/components/LogsSection.jsx` supports filtering by single date, date range, service, and status with pagination. | Verified Live |
| **R5: 100% Free-Tier Deployment** | Cloudflare Workers, Cloudflare D1, and Cloudflare Pages all operate within free limits with zero cost. | Verified Live |
| **R6: Live Reachable URLs** | Web Dashboard: `https://sla-monitor-dashboard.sla-monitor-backend.workers.dev` <br> API Endpoint: `https://sla-monitor-api.sla-monitor-backend.workers.dev` | Verified Live |
| **R7: Data Quality Problem Handling** | Comprehensive data cleaning engine in `backend/src/processor.js` handles timezones, latency units, negative latency, 999 codes, and duplicates. | Verified (18 Unit Tests) |
| **R8: Multi-Day Dynamic CSV Support** | Verified across all 5 provided CSV files (9d, 12d, 14d, 21d, and 30d with 15,577 rows). | Verified Live |
| **R9: Incremental Commit History** | Structured git commit log documenting milestones from initialization to deployment. | Verified in Git |

---

## 5. Local Setup and Redeployment Guide

### Prerequisites
- Node.js v18+ (tested on v24)
- Wrangler CLI (`npm install -g wrangler`)

### Running Backend Locally
```bash
cd backend
npm install
npm test                  # Runs 18 unit tests on data processing engine
npx wrangler dev          # Starts local Cloudflare Worker with local D1 emulation
```

### Running Frontend Locally
```bash
cd frontend
npm install
npm run dev               # Starts Vite dev server at http://localhost:3000
```

### Deploying to Cloudflare from Scratch
```bash
# 1. Authenticate with Cloudflare
wrangler login

# 2. Create and apply D1 database schema
wrangler d1 create sla-monitor-db
wrangler d1 execute sla-monitor-db --remote --file=./backend/schema.sql

# 3. Deploy Backend Worker
cd backend
npx wrangler deploy

# 4. Deploy Frontend
cd ../frontend
npm run build
npx wrangler deploy
```

---

## 6. What I Would Improve With More Time

1. **Streaming CSV Ingestion for Very Large Files (>100MB):** While the current system easily processes 30-day logs (15,500+ rows) in seconds, streaming CSV parser with Web Streams API would handle gigabyte-scale enterprise log dumps without memory limits.
2. **Interactive Time-Series Visualization:** Add charts showing availability and P95 latency over rolling 15-minute intervals to highlight the exact duration of outage spikes.
3. **Automated Incident Window Detection:** Implement an algorithm that correlates consecutive failed checks and automatically highlights incident windows matching root causes.
4. **CSV / JSON Export:** Allow support and billing teams to export filtered log slices and SLA summary compliance reports directly from the dashboard.
