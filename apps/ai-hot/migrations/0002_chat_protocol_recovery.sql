-- Retry only first-run format failures after switching from raw prompt to chat JSON.
-- Keep every old inference receipt and budget reservation.
UPDATE items SET stage='prefilter',error=NULL,next_attempt=0
WHERE stage='failed' AND id IN (SELECT substr(id,1,24) FROM receipts WHERE id LIKE '%:prefilter' AND state='error' AND result IS NOT NULL);
