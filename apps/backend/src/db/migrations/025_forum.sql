-- Forum: boards → threads → posts. Anonymous by default via the Prole identity. Leader pages surface threads tagged to them.
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board TEXT NOT NULL DEFAULT 'general' CHECK (board IN ('general', 'leaders', 'intel', 'money', 'media', 'site')),
  politician_id UUID REFERENCES politicians(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  upvotes INT NOT NULL DEFAULT 0,
  reply_count INT NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threads_activity ON threads(status, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_threads_board ON threads(board, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_threads_leader ON threads(politician_id, last_activity DESC);

CREATE TABLE IF NOT EXISTS thread_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  reply_to INT,
  upvotes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_posts_thread ON thread_posts(thread_id, seq);

CREATE TABLE IF NOT EXISTS thread_upvotes (thread_id UUID REFERENCES threads(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (thread_id, user_id));
CREATE TABLE IF NOT EXISTS post_upvotes (post_id UUID REFERENCES thread_posts(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (post_id, user_id));

-- Migrate existing leader comments into one open thread per leader, keeping the original author, identity choice and dates.
DO $$
DECLARE
  l RECORD; first_comment RECORD; t_id UUID; n INT;
BEGIN
  FOR l IN SELECT c.politician_id, p.name FROM comments c JOIN politicians p ON p.id = c.politician_id GROUP BY c.politician_id, p.name LOOP
    SELECT * INTO first_comment FROM comments WHERE politician_id = l.politician_id ORDER BY created_at ASC LIMIT 1;
    INSERT INTO threads (board, politician_id, user_id, title, body, is_anonymous, pinned, created_at, last_activity)
      VALUES ('leaders', l.politician_id, first_comment.user_id, l.name || ' — open thread', first_comment.body, COALESCE(first_comment.is_anonymous, false), true, first_comment.created_at,
              (SELECT MAX(created_at) FROM comments WHERE politician_id = l.politician_id))
      RETURNING id INTO t_id;
    n := 0;
    INSERT INTO thread_posts (thread_id, user_id, seq, body, is_anonymous, created_at)
      SELECT t_id, c.user_id, row_number() OVER (ORDER BY c.created_at), c.body, COALESCE(c.is_anonymous, false), c.created_at
      FROM comments c WHERE c.politician_id = l.politician_id AND c.id <> first_comment.id;
    UPDATE threads SET reply_count = (SELECT COUNT(*) FROM thread_posts WHERE thread_id = t_id) WHERE id = t_id;
  END LOOP;
END $$;
