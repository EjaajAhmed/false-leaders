-- Retire TruthScore. The old values are archived, not converted; the community rating
-- (average of member ratings, published once enough members have voted) replaces it.

CREATE TABLE IF NOT EXISTS archived_scores AS
  SELECT id AS politician_id, truth_score, score_components, score_history, NOW() AS archived_at
  FROM politicians;

ALTER TABLE IF EXISTS score_events RENAME TO archived_score_events;
ALTER TABLE IF EXISTS truth_score_config RENAME TO archived_score_config;

ALTER TABLE politicians
  DROP COLUMN IF EXISTS truth_score,
  DROP COLUMN IF EXISTS score_components,
  DROP COLUMN IF EXISTS score_history;

-- Denormalised community rating. rating_avg stays NULL until rating_count reaches the
-- publication threshold, so a lone vote never displays as "the" rating.
ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS rating_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_avg INT;

UPDATE politicians p
SET rating_count = s.n, rating_avg = CASE WHEN s.n >= 5 THEN s.avg END
FROM (SELECT politician_id, COUNT(*)::int AS n, FLOOR(AVG(score))::int AS avg FROM ratings GROUP BY politician_id) s
WHERE s.politician_id = p.id;

CREATE INDEX IF NOT EXISTS idx_politicians_rating_avg ON politicians(rating_avg) WHERE rating_avg IS NOT NULL;

-- External approval polling, shown beside (never blended into) the community rating.
CREATE TABLE IF NOT EXISTS approval_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  pollster TEXT NOT NULL,
  approve NUMERIC(5,1) NOT NULL CHECK (approve >= 0 AND approve <= 100),
  disapprove NUMERIC(5,1) CHECK (disapprove IS NULL OR (disapprove >= 0 AND disapprove <= 100)),
  sample_size INT,
  fieldwork_end DATE NOT NULL,
  source_url TEXT NOT NULL CHECK (length(trim(source_url)) > 0),
  note TEXT,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (politician_id, pollster, fieldwork_end)
);
CREATE INDEX IF NOT EXISTS idx_approval_polls_leader ON approval_polls(politician_id, fieldwork_end DESC);
