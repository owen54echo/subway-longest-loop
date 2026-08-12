CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    received_at TEXT NOT NULL,
    report_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    device_type TEXT NOT NULL,
    country_code TEXT NOT NULL,
    tab_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_received_at ON events(received_at);
CREATE INDEX IF NOT EXISTS idx_events_report_date ON events(report_date);

CREATE TABLE IF NOT EXISTS daily_metrics (
    report_date TEXT PRIMARY KEY,
    page_views INTEGER NOT NULL DEFAULT 0,
    approx_unique_visitors INTEGER NOT NULL DEFAULT 0,
    route_generations INTEGER NOT NULL DEFAULT 0,
    mobile_page_views INTEGER NOT NULL DEFAULT 0,
    desktop_page_views INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_visitors (
    report_date TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    PRIMARY KEY (report_date, visitor_hash)
);

CREATE TABLE IF NOT EXISTS daily_country_metrics (
    report_date TEXT NOT NULL,
    country_code TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 0,
    approx_unique_visitors INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (report_date, country_code)
);

CREATE TABLE IF NOT EXISTS daily_country_visitors (
    report_date TEXT NOT NULL,
    country_code TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    PRIMARY KEY (report_date, country_code, visitor_hash)
);

CREATE TABLE IF NOT EXISTS daily_tab_metrics (
    report_date TEXT NOT NULL,
    tab_id TEXT NOT NULL,
    open_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (report_date, tab_id)
);

CREATE TABLE IF NOT EXISTS daily_hour_metrics (
    report_date TEXT NOT NULL,
    hour_shanghai INTEGER NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (report_date, hour_shanghai)
);

CREATE TABLE IF NOT EXISTS login_attempts (
    rate_key TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_expiry ON login_attempts(expires_at);
