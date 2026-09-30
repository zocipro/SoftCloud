ALTER TABLE items ADD COLUMN group_pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN group_next_attempt INTEGER NOT NULL DEFAULT 0;
UPDATE items SET group_pending=1 WHERE stage='done' AND visibility='public';
CREATE INDEX group_backlog ON items(group_pending,group_next_attempt);
