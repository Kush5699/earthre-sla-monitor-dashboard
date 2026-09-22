-- Schema for SLA Monitoring Dashboard

CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    clean_rows INTEGER NOT NULL,
    dropped_rows INTEGER NOT NULL,
    date_range_start TEXT,
    date_range_end TEXT,
    issues_json TEXT
);

CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms REAL,
    agent TEXT NOT NULL,
    region TEXT NOT NULL,
    is_healthy INTEGER NOT NULL,
    check_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_checks_upload_date ON health_checks(upload_id, check_date);
CREATE INDEX IF NOT EXISTS idx_health_checks_upload_service ON health_checks(upload_id, service_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_upload_healthy ON health_checks(upload_id, is_healthy);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp DESC);
