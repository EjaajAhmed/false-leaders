ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_politician_id_key;

ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_id_politician_id_graft_id_key 
  UNIQUE (user_id, politician_id, graft_id);