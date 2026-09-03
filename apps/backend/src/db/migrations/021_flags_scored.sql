-- Which sanctions listings count toward the score (multilateral and named national authorities only)
ALTER TABLE flags ADD COLUMN IF NOT EXISTS scored BOOLEAN NOT NULL DEFAULT false;
