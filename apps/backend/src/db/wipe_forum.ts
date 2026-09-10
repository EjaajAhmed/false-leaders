import 'dotenv/config'
import { db } from './client'
import { ensureDailyThread } from '../services/forum'

/**
 * One-off: wipe test forum content and test accounts so the forum starts empty.
 *   npm run wipe:forum            keeps admin accounts and the system account
 *   npm run wipe:forum -- --all   also removes admin accounts (you will have to register again)
 * Everything removed is summarised in one moderation_log row so the wipe itself is on record.
 */
async function main() {
  const all = process.argv.includes('--all')
  const counts = async () => (await db.query(`SELECT
      (SELECT COUNT(*) FROM threads)::int AS threads, (SELECT COUNT(*) FROM thread_posts)::int AS posts,
      (SELECT COUNT(*) FROM users WHERE NOT is_system)::int AS users, (SELECT COUNT(*) FROM ratings)::int AS ratings,
      (SELECT COUNT(*) FROM comments)::int AS comments, (SELECT COUNT(*) FROM feed_events WHERE type IN ('thread', 'leak', 'rating_public'))::int AS feed`)).rows[0]
  const before = await counts()
  console.log('before', before)
  await db.query('BEGIN')
  try {
    await db.query('DELETE FROM reports')
    await db.query('DELETE FROM thread_upvotes'); await db.query('DELETE FROM post_upvotes')
    await db.query('DELETE FROM thread_posts'); await db.query('DELETE FROM threads')
    await db.query('DELETE FROM comments').catch(() => undefined)
    await db.query(`DELETE FROM feed_events WHERE type IN ('thread', 'leak', 'rating_public', 'verdict_shift', 'score_change')`)
    const { rows: kept } = await db.query(all ? `SELECT username FROM users WHERE is_system` : `SELECT username FROM users WHERE is_system OR is_admin`)
    await db.query(all ? `DELETE FROM users WHERE NOT is_system` : `DELETE FROM users WHERE NOT is_system AND NOT is_admin`)
    await db.query(`DELETE FROM ratings`)  // any ratings left belong to kept accounts' test votes
    await db.query(`UPDATE politicians SET rating_count = 0, rating_avg = NULL`)
    await db.query(`UPDATE users SET username = 'falseleaders' WHERE is_system AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'falseleaders')`)
    await db.query(`SELECT setval('prole_number_seq', GREATEST((SELECT COALESCE(MAX(prole_number), 1) FROM users), 1))`)
    await db.query(`INSERT INTO moderation_log (action, target_type, target_id, actor_id, reason, before, after) VALUES ('wipe_test_data', 'user', NULL, NULL, $1, $2, $3)`,
      [all ? 'forum reset including admin accounts' : 'forum reset, admin accounts kept', JSON.stringify(before), JSON.stringify({ kept_accounts: kept.map(k => k.username) })])
    await db.query('COMMIT')
    console.log('kept accounts:', kept.map(k => k.username).join(', ') || '(none)')
  } catch (e) { await db.query('ROLLBACK'); throw e }
  const daily = await ensureDailyThread()
  console.log('daily thread', daily)
  console.log('after', await counts())
  const { rows: chk } = await db.query(`SELECT
     (SELECT COUNT(*) FROM threads WHERE politician_id IS NOT NULL)::int AS leader_threads,
     (SELECT COUNT(*) FROM politicians WHERE rating_count > 0)::int AS rated_leaders`)
  console.log('leader-page discussion threads:', chk[0].leader_threads, '· leaders with ratings:', chk[0].rated_leaders)
  await db.end?.()
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
