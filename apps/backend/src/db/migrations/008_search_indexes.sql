CREATE INDEX IF NOT EXISTS idx_politicians_name ON politicians USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_politicians_party ON politicians(party);
CREATE INDEX IF NOT EXISTS idx_politicians_country ON politicians(country);
CREATE INDEX IF NOT EXISTS idx_politicians_region ON politicians(region);
CREATE INDEX IF NOT EXISTS idx_politicians_truth_score ON politicians(truth_score);