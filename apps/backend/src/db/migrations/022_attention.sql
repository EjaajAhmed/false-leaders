-- Layer 6: daily Wikipedia page views per language edition
CREATE TABLE IF NOT EXISTS attention_daily (
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  day DATE NOT NULL,
  views INT NOT NULL DEFAULT 0,
  PRIMARY KEY (politician_id, lang, day)
);
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wiki_sitelinks JSONB;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS wiki_sitelinks_at TIMESTAMPTZ;
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS attention_synced_at TIMESTAMPTZ;
