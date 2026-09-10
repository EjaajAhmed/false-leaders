import { db } from '../db/client'
import { registerJob, runJob } from './jobs'

/**
 * Hot ranking: (capped upvotes + capped replies * 2) / (hours since last activity + 2) ^ 1.5
 * - Upvotes from the thread author are ignored.
 * - Replies count only from accounts other than the author, at most REPLY_CAP per account, active posts only.
 * Recomputed on write for the affected thread; the periodic job only applies decay to recently active threads.
 */
export const REPLY_CAP = 3
export const HOT_WINDOW_DAYS = 30
export const HOT_INTERVAL_MS = 10 * 60 * 1000
/** The forum day rolls over at 05:00 UTC (midnight Eastern), so the daily thread lands at the start of a US day. */
export const DAILY_ROLLOVER_UTC_HOUR = 5

const HOT_SQL = `
  UPDATE threads t SET
    hot_score = (
      (SELECT COUNT(*) FROM thread_upvotes tu WHERE tu.thread_id = t.id AND tu.user_id <> t.user_id)
      + 2 * (SELECT COALESCE(SUM(LEAST(c, ${REPLY_CAP})), 0) FROM (
              SELECT COUNT(*) AS c FROM thread_posts po WHERE po.thread_id = t.id AND po.status = 'active' AND po.user_id <> t.user_id GROUP BY po.user_id
            ) x)
    )::float / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - t.last_activity)) / 3600.0, 0) + 2, 1.5),
    hot_computed_at = NOW()`

export async function recomputeHot(threadId: string) {
  await db.query(`${HOT_SQL} WHERE t.id = $1`, [threadId])
}

export async function recomputeHotRecent(): Promise<number> {
  const { rowCount } = await db.query(`${HOT_SQL} WHERE t.status = 'active' AND t.last_activity > NOW() - INTERVAL '${HOT_WINDOW_DAYS} days'`)
  return rowCount || 0
}

// ── Moderation log ──
export type ModTarget = 'thread' | 'post' | 'user' | 'report' | 'takedown'
export async function logModeration(action: string, targetType: ModTarget, targetId: string | null, actorId: string | null, reason?: string | null, before?: unknown, after?: unknown) {
  await db.query(
    `INSERT INTO moderation_log (action, target_type, target_id, actor_id, reason, before, after) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [action, targetType, targetId, actorId, reason || null, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)]
  )
}

/**
 * Hard delete: the only path that physically removes forum content. Reserved for legal removal.
 * Writes the full record to the moderation log first so the action itself stays on record.
 */
export async function hardDeleteThread(threadId: string, actorId: string | null, reason: string) {
  const { rows } = await db.query('SELECT * FROM threads WHERE id = $1', [threadId])
  if (!rows.length) return false
  const { rows: posts } = await db.query('SELECT id, user_id, seq, body, created_at FROM thread_posts WHERE thread_id = $1', [threadId])
  await logModeration('hard_delete', 'thread', threadId, actorId, reason, { thread: rows[0], posts }, null)
  await db.query('DELETE FROM threads WHERE id = $1', [threadId])
  return true
}
export async function hardDeletePost(postId: string, actorId: string | null, reason: string) {
  const { rows } = await db.query('SELECT * FROM thread_posts WHERE id = $1', [postId])
  if (!rows.length) return false
  await logModeration('hard_delete', 'post', postId, actorId, reason, rows[0], null)
  await db.query('DELETE FROM thread_posts WHERE id = $1', [postId])
  await db.query(`UPDATE threads SET reply_count = (SELECT COUNT(*) FROM thread_posts WHERE thread_id = $1 AND status = 'active') WHERE id = $1`, [rows[0].thread_id])
  await recomputeHot(rows[0].thread_id)
  return true
}

// ── Daily discussion thread ──
export function forumDay(now = new Date()): string {
  const shifted = new Date(now.getTime() - DAILY_ROLLOVER_UTC_HOUR * 3600 * 1000)
  return shifted.toISOString().slice(0, 10)
}
const longDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export async function ensureDailyThread(day = forumDay()): Promise<{ created: boolean; id: string }> {
  const { rows: existing } = await db.query('SELECT id FROM threads WHERE daily_date = $1', [day])
  if (existing.length) return { created: false, id: existing[0].id }
  const { rows: sys } = await db.query('SELECT id FROM users WHERE is_system LIMIT 1')
  if (!sys.length) throw new Error('No system user; run migration 031')
  const { rows: prev } = await db.query('SELECT id, daily_date FROM threads WHERE daily_date IS NOT NULL AND daily_date < $1 ORDER BY daily_date DESC LIMIT 1', [day])
  const title = `Daily discussion · ${longDate(day)}`
  const body = `Open floor for ${longDate(day)}. Anything about the people in power that does not need its own thread goes here. Posts are members' own opinions, not statements of fact by FalseLeaders.${prev.length ? `\n\nYesterday's thread is linked above.` : ''}`
  const { rows } = await db.query(
    `INSERT INTO threads (board, kind, user_id, title, body, is_anonymous, pinned, is_system, daily_date, previous_daily_id)
     VALUES ('general', 'discussion', $1, $2, $3, FALSE, TRUE, TRUE, $4, $5) RETURNING id`,
    [sys[0].id, title, body, day, prev[0]?.id || null]
  )
  if (prev.length) {
    await db.query('UPDATE threads SET pinned = FALSE WHERE id = $1', [prev[0].id])
    await logModeration('unpin', 'thread', prev[0].id, null, 'daily rollover', { pinned: true }, { pinned: false })
  }
  await logModeration('daily_thread_created', 'thread', rows[0].id, null, `forum day ${day}`, null, { title, previous_daily_id: prev[0]?.id || null })
  await recomputeHot(rows[0].id)
  return { created: true, id: rows[0].id }
}

registerJob('forum_hot', async (log) => {
  const n = await recomputeHotRecent()
  log(`recomputed hot score for ${n} threads active in the last ${HOT_WINDOW_DAYS} days`)
  return { threads: n }
})
registerJob('daily_thread', async (log) => {
  const r = await ensureDailyThread()
  log(r.created ? `created daily thread ${r.id}` : `daily thread already exists (${r.id})`)
  return r
})

/** Decay job every 10 minutes; daily thread at the rollover hour and once on boot so a redeploy cannot skip a day. */
export function startForumSchedules() {
  if (process.env.DISABLE_SCHEDULER === '1') return
  runJob('daily_thread')
  setInterval(() => runJob('forum_hot'), HOT_INTERVAL_MS)
  const scheduleDaily = () => {
    const now = new Date()
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_ROLLOVER_UTC_HOUR, 0, 30))
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    setTimeout(async () => { await runJob('daily_thread'); scheduleDaily() }, next.getTime() - now.getTime())
    console.log(`[scheduler] next daily thread in ${Math.round((next.getTime() - now.getTime()) / 60000)} min`)
  }
  scheduleDaily()
}
