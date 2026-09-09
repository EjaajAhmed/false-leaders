-- Score = 60% members' rating + 40% outside signal. Leaks and verdicts move to the forum.
CREATE TABLE IF NOT EXISTS ratings (
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (politician_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_politician ON ratings(politician_id);

-- Carry existing verdicts over as ratings
INSERT INTO ratings (politician_id, user_id, score, created_at, updated_at)
SELECT politician_id, user_id, CASE verdict WHEN 'guilty' THEN 10 WHEN 'suspicious' THEN 35 WHEN 'unclear' THEN 50 ELSE 85 END, created_at, updated_at FROM verdicts
ON CONFLICT DO NOTHING;

-- Forum: thread kinds and a Leaks board
ALTER TABLE threads ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'discussion' CHECK (kind IN ('discussion', 'leak', 'verdict'));
ALTER TABLE threads ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 0 AND rating <= 100);
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_board_check;
ALTER TABLE threads ADD CONSTRAINT threads_board_check CHECK (board IN ('general', 'leaders', 'leaks', 'intel', 'money', 'media', 'site'));

-- Carry visible leaks over as anonymous leak threads
INSERT INTO threads (board, kind, politician_id, user_id, title, body, is_anonymous, upvotes, created_at, last_activity)
SELECT 'leaks', 'leak', l.politician_id, l.user_id, 'Leak: ' || p.name, l.body, true, l.upvotes, l.created_at, l.created_at
FROM leaks l JOIN politicians p ON p.id = l.politician_id WHERE l.status IN ('visible', 'escalated');

-- Carry verdict explanations over as verdict threads
INSERT INTO threads (board, kind, politician_id, user_id, title, body, is_anonymous, rating, upvotes, created_at, last_activity)
SELECT 'leaders', 'verdict', v.politician_id, v.user_id, 'Verdict on ' || p.name, v.body, v.is_anonymous, CASE v.verdict WHEN 'guilty' THEN 10 WHEN 'suspicious' THEN 35 WHEN 'unclear' THEN 50 ELSE 85 END, v.upvotes, v.created_at, v.updated_at
FROM verdicts v JOIN politicians p ON p.id = v.politician_id WHERE v.body IS NOT NULL AND length(trim(v.body)) > 0;

-- Score weights
INSERT INTO truth_score_config (key, value, label) VALUES
  ('weight_community', 60, 'Weight of members'' ratings (%)'),
  ('weight_external', 40, 'Weight of the outside signal (%)'),
  ('rating_prior_weight', 5, 'Ratings needed before the average is trusted (shrinks toward 50)'),
  ('external_min_articles', 20, 'Minimum articles in 30 days before coverage tone counts')
ON CONFLICT DO NOTHING;
