ALTER TABLE receipts ADD COLUMN owner TEXT;
CREATE TABLE budget_calls (id TEXT PRIMARY KEY,cost INTEGER NOT NULL,created INTEGER NOT NULL);
CREATE INDEX budget_call_time ON budget_calls(created);
