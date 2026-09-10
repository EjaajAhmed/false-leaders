-- Member-chosen UI theme, applied on every device they sign in on.
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT '1984';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users ADD CONSTRAINT users_theme_check CHECK (theme IN ('1984', 'samizdat', 'echelon', 'blackout'));
