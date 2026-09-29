CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, tier TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1, last_checked INTEGER NOT NULL DEFAULT 0,
  last_success INTEGER, error TEXT, etag TEXT, modified TEXT
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL, discovered INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prefilter', score1 INTEGER, score2 INTEGER,
  title_zh TEXT, summary_zh TEXT, reason TEXT, category TEXT NOT NULL DEFAULT 'industry',
  tags TEXT NOT NULL DEFAULT '[]', selected INTEGER NOT NULL DEFAULT 0,
  event_id TEXT, next_attempt INTEGER NOT NULL DEFAULT 0, error TEXT
);
CREATE INDEX IF NOT EXISTS items_public ON items(stage, selected, published DESC);
CREATE INDEX IF NOT EXISTS items_pending ON items(stage, next_attempt, discovered DESC);
CREATE INDEX IF NOT EXISTS items_event ON items(event_id, published DESC);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY, day TEXT NOT NULL, reserved INTEGER NOT NULL,
  state TEXT NOT NULL, result TEXT, error TEXT, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS budgets (day TEXT PRIMARY KEY, reserved INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reports (
  date TEXT PRIMARY KEY, title TEXT NOT NULL, lead TEXT NOT NULL, item_ids TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS runs_created ON runs(created DESC);

CREATE INDEX IF NOT EXISTS items_discovered ON items(discovered);
CREATE INDEX IF NOT EXISTS receipts_day ON receipts(day);
CREATE INDEX IF NOT EXISTS reports_created ON reports(created);
