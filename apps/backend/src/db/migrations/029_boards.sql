-- Consolidate boards: general, leaders, leaks, conspiracy, media, offtopic.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_board_check;
UPDATE threads SET board = 'leaders', kind = 'discussion' WHERE board = 'verdicts';
UPDATE threads SET board = 'general' WHERE board IN ('intel', 'money');
UPDATE threads SET board = 'offtopic' WHERE board = 'site';
ALTER TABLE threads ADD CONSTRAINT threads_board_check CHECK (board IN ('general', 'leaders', 'leaks', 'conspiracy', 'media', 'offtopic'));
