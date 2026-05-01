CREATE TABLE IF NOT EXISTS controversies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_url TEXT,
  level TEXT NOT NULL CHECK (level IN ('confirmed', 'likely', 'maybe', 'speculative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controversies_politician ON controversies(politician_id);