CREATE TABLE feedback_bans (source_hash TEXT PRIMARY KEY,reason TEXT,created INTEGER NOT NULL);
CREATE INDEX feedback_source_created ON feedback(source_hash,created);
CREATE TABLE selectbenches (id TEXT PRIMARY KEY,label TEXT NOT NULL,report TEXT NOT NULL,created INTEGER NOT NULL);
