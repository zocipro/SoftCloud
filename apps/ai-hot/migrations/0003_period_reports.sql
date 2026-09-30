-- Preserve existing daily editions; periodical editions use a separate public identity.
CREATE TABLE IF NOT EXISTS period_reports (
  kind TEXT NOT NULL CHECK(kind IN ('weekly','monthly')),
  key TEXT NOT NULL, title TEXT NOT NULL, lead TEXT NOT NULL,
  item_ids TEXT NOT NULL, created INTEGER NOT NULL, window_start INTEGER NOT NULL, window_end INTEGER NOT NULL,
  PRIMARY KEY(kind,key)
);
CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY,kind TEXT NOT NULL,message TEXT NOT NULL,created INTEGER NOT NULL);
