-- Forum ranking, system daily thread, moderation log, reports, takedown requests, terms acceptance.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS hot_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hot_computed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_date DATE,
  ADD COLUMN IF NOT EXISTS previous_daily_id UUID REFERENCES threads(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_daily_date ON threads(daily_date) WHERE daily_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_hot ON threads(status, hot_score DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- The system account posts the daily thread. It has no usable password and cannot sign in.
INSERT INTO users (email, username, password_hash, email_verified, is_system)
SELECT 'system@falseleaders.internal',
       CASE WHEN EXISTS (SELECT 1 FROM users WHERE username = 'falseleaders') THEN 'system' ELSE 'falseleaders' END,
       '!', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_system);

-- Every moderation action, by whom and when. actor_id NULL means the system.
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post', 'user', 'report', 'takedown')),
  target_id UUID,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log(target_type, target_id);

-- Member reports on threads and posts. One per member per target.
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('thread', 'post')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'private_info', 'illegal', 'defamation', 'other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- Notice-and-takedown requests from anyone, signed in or not.
CREATE TABLE IF NOT EXISTS takedown_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_review', 'actioned', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_takedown_status ON takedown_requests(status, created_at DESC);
