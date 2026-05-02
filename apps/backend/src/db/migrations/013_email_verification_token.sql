ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;