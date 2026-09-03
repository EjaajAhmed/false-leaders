-- External enrichment: Wikipedia/Wikidata profile data, attention metric, cached headlines
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wiki_title TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wiki_url TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS born DATE;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS net_worth NUMERIC(16,0);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS attention INT NOT NULL DEFAULT 0;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_politicians_attention ON politicians(attention DESC);

CREATE TABLE IF NOT EXISTS leader_news (
  politician_id UUID PRIMARY KEY REFERENCES politicians(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
