-- Layer 7: country adapters (votes, money, courts) behind one interface
CREATE TABLE IF NOT EXISTS country_records (
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('votes', 'money', 'courts')),
  adapter TEXT NOT NULL,
  external_id TEXT,
  summary JSONB NOT NULL DEFAULT '{}',
  items JSONB NOT NULL DEFAULT '[]',
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  license TEXT,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'no_match', 'error')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (politician_id, kind)
);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS records_synced_at TIMESTAMPTZ;
