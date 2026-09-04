-- Layer 8: source documents, promises, contradictions. Everything extracted is a draft until a person publishes it.
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('manifesto', 'speech', 'interview', 'article', 'statement', 'other')),
  spoken_on DATE,
  text TEXT NOT NULL,
  claims JSONB NOT NULL DEFAULT '[]',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_politician ON documents(politician_id);

CREATE TABLE IF NOT EXISTS promises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  quote TEXT,
  topic TEXT,
  promised_on DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'broken', 'unclear')),
  evidence_url TEXT,
  evidence_note TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'published', 'rejected')),
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT broken_needs_evidence CHECK (status <> 'broken' OR review_status <> 'published' OR (evidence_url IS NOT NULL AND length(trim(evidence_url)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises(politician_id, review_status);

CREATE TABLE IF NOT EXISTS contradictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  topic TEXT,
  quote_a TEXT NOT NULL,
  date_a DATE,
  source_a TEXT NOT NULL CHECK (length(trim(source_a)) > 0),
  quote_b TEXT NOT NULL,
  date_b DATE,
  source_b TEXT NOT NULL CHECK (length(trim(source_b)) > 0),
  explanation TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contradictions_politician ON contradictions(politician_id, review_status);

INSERT INTO truth_score_config (key, value, label) VALUES
  ('promise_broken_weight', 3, 'Deduction per published broken promise'),
  ('promise_max_penalty', 15, 'Maximum total deduction from broken promises')
ON CONFLICT DO NOTHING;
