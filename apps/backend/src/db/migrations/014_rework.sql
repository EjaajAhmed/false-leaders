-- FalseLeaders rework: identities, verdicts, leaks, feed, proposals, upvotes

-- Leaders: aliases + score history
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
ALTER TABLE politicians ADD COLUMN IF NOT EXISTS score_history JSONB DEFAULT '[]';

-- Prole identity: sequential, permanent, assigned on registration
CREATE SEQUENCE IF NOT EXISTS prole_number_seq START 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS prole_number INT UNIQUE;

UPDATE users u
SET prole_number = sub.rn + 999
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM users WHERE prole_number IS NULL
) sub
WHERE u.id = sub.id;

SELECT setval('prole_number_seq', COALESCE((SELECT MAX(prole_number) FROM users), 999) + 1, false);
ALTER TABLE users ALTER COLUMN prole_number SET DEFAULT nextval('prole_number_seq');

-- Comments may be posted as Prole
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Controversies: community upvotes
ALTER TABLE controversies ADD COLUMN IF NOT EXISTS upvotes INT DEFAULT 0;
CREATE TABLE IF NOT EXISTS controversy_upvotes (
  controversy_id UUID NOT NULL REFERENCES controversies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (controversy_id, user_id)
);

-- Community verdicts: one per user per leader
CREATE TABLE IF NOT EXISTS verdicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('guilty', 'suspicious', 'unclear', 'clean')),
  body TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (politician_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_verdicts_politician ON verdicts(politician_id);
CREATE INDEX IF NOT EXISTS idx_verdicts_user ON verdicts(user_id);

CREATE TABLE IF NOT EXISTS verdict_upvotes (
  verdict_id UUID NOT NULL REFERENCES verdicts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (verdict_id, user_id)
);

-- Leaks: always anonymous to viewers
CREATE TABLE IF NOT EXISTS leaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('pending', 'visible', 'escalated', 'removed')),
  controversy_id UUID REFERENCES controversies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaks_politician ON leaks(politician_id);
CREATE INDEX IF NOT EXISTS idx_leaks_status ON leaks(status);

CREATE TABLE IF NOT EXISTS leak_upvotes (
  leak_id UUID NOT NULL REFERENCES leaks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (leak_id, user_id)
);

-- Controversy proposals (pending mod approval)
CREATE TABLE IF NOT EXISTS controversy_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  politician_id UUID NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('confirmed', 'likely', 'maybe', 'speculative')),
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON controversy_proposals(status);

-- The Wall
CREATE TABLE IF NOT EXISTS feed_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  leader_id UUID REFERENCES politicians(id) ON DELETE CASCADE,
  leader_name TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_events_created ON feed_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_events_type ON feed_events(type, created_at DESC);
