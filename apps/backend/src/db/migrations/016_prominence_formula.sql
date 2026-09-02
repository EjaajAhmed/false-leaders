-- Prominence ranks non-political figures for the "main view" (world leaders + top 50 figures)
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS prominence INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_politicians_prominence ON politicians(prominence DESC);
UPDATE politicians SET prominence = 50 WHERE category = 'world_leader' AND prominence = 0;

-- Community-driven TruthScore formula. Controversy/funding/influence keys stay in the table but are archived.
INSERT INTO truth_score_config (key, value, label) VALUES
  ('verdict_min_count', 3, 'Verdicts needed before they affect the score'),
  ('verdict_confidence_n', 25, 'Verdicts needed for full confidence'),
  ('verdict_guilty_weight', 60, 'Max deduction when 100% of verdicts are Guilty'),
  ('verdict_suspicious_weight', 30, 'Max deduction when 100% of verdicts are Suspicious'),
  ('leak_upvote_threshold', 3, 'Upvotes a leak needs before it counts'),
  ('leak_weight', 2, 'Deduction per counted leak'),
  ('leak_max_penalty', 20, 'Maximum total deduction from leaks')
ON CONFLICT DO NOTHING;
