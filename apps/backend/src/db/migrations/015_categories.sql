-- Leaders are no longer politicians-only. Category groups them; country is no longer Canada by default.
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'politician';
CREATE INDEX IF NOT EXISTS idx_politicians_category ON politicians(category);
ALTER TABLE politicians ALTER COLUMN country DROP DEFAULT;

-- Sitting heads of government already on file
UPDATE politicians SET category = 'world_leader' WHERE name = 'Mark Carney' AND category = 'politician';
