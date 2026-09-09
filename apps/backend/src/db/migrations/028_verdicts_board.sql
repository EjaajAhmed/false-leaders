-- Leaks and verdicts are ordinary boards. Nothing special is enforced on them.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_board_check;
ALTER TABLE threads ADD CONSTRAINT threads_board_check CHECK (board IN ('general', 'leaders', 'leaks', 'verdicts', 'intel', 'money', 'media', 'site'));
UPDATE threads SET board = 'verdicts' WHERE kind = 'verdict' AND board <> 'verdicts';
