-- Layer 4: media coverage from GDELT (daily volume and negative-tone share), spikes, source-country sample
CREATE TABLE IF NOT EXISTS media_daily (
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  articles INT NOT NULL DEFAULT 0,
  negative INT NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (politician_id, day)
);

CREATE TABLE IF NOT EXISTS media_summary (
  politician_id UUID PRIMARY KEY REFERENCES politicians(id) ON DELETE CASCADE,
  articles_30d INT NOT NULL DEFAULT 0,
  negative_30d INT NOT NULL DEFAULT 0,
  home_country TEXT,
  home_articles INT,
  home_negative INT,
  abroad_articles INT,
  abroad_negative INT,
  source_countries JSONB NOT NULL DEFAULT '[]',
  sample_size INT NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coverage_spikes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  articles INT NOT NULL,
  baseline NUMERIC(10,2) NOT NULL,
  ratio NUMERIC(6,2) NOT NULL,
  headlines JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'dismissed')),
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (politician_id, day)
);
CREATE INDEX IF NOT EXISTS idx_spikes_status ON coverage_spikes(status, created_at DESC);
