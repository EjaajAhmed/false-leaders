CREATE TABLE IF NOT EXISTS funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('Corporate', 'Individual', 'PAC', 'Personal', 'Government', 'Union', 'Other')),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foreign_influence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  country_code TEXT,
  influence_score INTEGER NOT NULL CHECK (influence_score >= 0 AND influence_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(politician_id, country)
);

CREATE INDEX IF NOT EXISTS idx_funding_politician ON funding_sources(politician_id);
CREATE INDEX IF NOT EXISTS idx_influence_politician ON foreign_influence(politician_id);