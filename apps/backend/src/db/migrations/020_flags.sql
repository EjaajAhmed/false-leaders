-- Layer 5: OpenSanctions flags (sanctions, PEP, crime) and the network of connected entities
CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('sanction', 'pep', 'crime', 'other')),
  entity_id TEXT NOT NULL,
  authority TEXT,
  program TEXT,
  reason TEXT,
  start_date DATE,
  listing_date DATE,
  dataset TEXT,
  match_tier TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flags_politician ON flags(politician_id);

CREATE TABLE IF NOT EXISTS network_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  role TEXT,
  other_id TEXT NOT NULL,
  other_name TEXT NOT NULL,
  other_schema TEXT,
  other_topics TEXT[] DEFAULT '{}',
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politician_id, other_id, relation)
);
CREATE INDEX IF NOT EXISTS idx_edges_politician ON network_edges(politician_id);

ALTER TABLE politicians ADD COLUMN IF NOT EXISTS opensanctions_id TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS opensanctions_checked_at TIMESTAMPTZ;

INSERT INTO truth_score_config (key, value, label) VALUES
  ('sanction_weight', 15, 'Deduction per sanctioning authority'),
  ('sanction_max_penalty', 30, 'Maximum total deduction from sanctions')
ON CONFLICT DO NOTHING;
