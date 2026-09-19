-- Revocable sessions: tokens carry token_version and are rejected once it moves on; suspended accounts cannot authenticate.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
