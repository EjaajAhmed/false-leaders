-- Provenance-first data model: Wikidata identity, office history, per-field sources,
-- score event ledger, country indicators, ingest job log.

ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wikidata_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_politicians_wikidata ON politicians(wikidata_id) WHERE wikidata_id IS NOT NULL;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS country_code TEXT;          -- ISO 3166-1 alpha-3
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS term_start DATE;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS term_end DATE;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS current_office TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wikidata_synced_at TIMESTAMPTZ;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS score_components JSONB NOT NULL DEFAULT '{}';

-- Offices held (Wikidata P39 with qualifiers)
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  position_qid TEXT,
  position_label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  replaces_qid TEXT,
  replaces_label TEXT,
  replaced_by_qid TEXT,
  replaced_by_label TEXT,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politician_id, position_qid, start_date)
);
CREATE INDEX IF NOT EXISTS idx_positions_politician ON positions(politician_id);

-- Every displayed value traces to a source, stored per field
CREATE TABLE IF NOT EXISTS field_sources (
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value JSONB,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  license TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (politician_id, field)
);

-- Ledger of everything that has ever moved a TruthScore. A deduction without a source cannot exist.
CREATE TABLE IF NOT EXISTS score_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  points NUMERIC(6,2) NOT NULL,
  score_before INT,
  score_after INT,
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_score_events_politician ON score_events(politician_id, created_at DESC);

-- Annual country indicators (World Bank now; V-Dem, Freedom House, RSF, TI later)
CREATE TABLE IF NOT EXISTS country_indicators (
  country_code TEXT NOT NULL,
  indicator TEXT NOT NULL,
  year INT NOT NULL,
  value NUMERIC,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  license TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country_code, indicator, year)
);

-- Ingest job log
CREATE TABLE IF NOT EXISTS ingest_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  detail JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_job ON ingest_runs(job, started_at DESC);
