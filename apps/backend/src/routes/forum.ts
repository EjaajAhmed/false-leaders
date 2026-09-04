import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireAdmin, requireVerified } from '../middleware/auth'
import { emitFeedEvent } from '../services/feed'
import { notifyUser } from '../services/notify'

export const BOARDS = [
  { key: 'general', label: 'General', blurb: 'Anything about power and the people who hold it.' },
  { key: 'leaders', label: 'Leaders', blurb: 'Threads tagged to a specific leader.' },
  { key: 'intel', label: 'Intel', blurb: 'Documents, records, things worth digging into.' },
  { key: 'money', label: 'Money', blurb: 'Funding, contracts, conflicts of interest.' },
  { key: 'media', label: 'Media', blurb: 'Coverage, spin, who is saying what.' },
  { key: 'site', label: 'Site', blurb: 'FalseLeaders itself: bugs, ideas, the score.' },
]
const BOARD_KEYS = BOARDS.map(b => b.key)
const MAX_TITLE = 160, MAX_BODY = 6000

// Identity as shown to other members: never user_id, never both names.
const IDENT = (alias: string) => `CASE WHEN ${alias}.is_anonymous THEN NULL ELSE u.username END AS username, CASE WHEN ${alias}.is_anonymous THEN u.prole_number ELSE NULL END AS prole_number`

export async function forumRoutes(server: FastifyInstance) {
  server.get('/boards', async () => {
    const { rows } = await db.query(`SELECT board, COUNT(*)::int AS threads, MAX(last_activity) AS last_activity FROM threads WHERE status = 'active' GROUP BY board`)
    return BOARDS.map(b => ({ ...b, threads: rows.find(r => r.board === b.key)?.threads || 0, last_activity: rows.find(r => r.board === b.key)?.last_activity || null }))
  })

  server.get('/threads', { onRequest: [optionalAuth] }, async (request) => {
    const { board, leader, sort, page, limit, q } = request.query as any
    const viewer = (request as any).user
    const pageNum = Math.max(1, Number(page) || 1), limitNum = Math.min(50, Number(limit) || 25)
    const params: any[] = []
    let where = `WHERE t.status = 'active'`
    if (board && BOARD_KEYS.includes(board)) { params.push(board); where += ` AND t.board = $${params.length}` }
    if (leader) { params.push(leader); where += ` AND t.politician_id = $${params.length}` }
    if (q) { params.push(`%${q}%`); where += ` AND (t.title ILIKE $${params.length} OR t.body ILIKE $${params.length})` }
    const order = sort === 'new' ? 't.created_at DESC' : sort === 'top' ? 't.upvotes DESC, t.last_activity DESC' : 't.pinned DESC, t.last_activity DESC'
    const viewerIdx = viewer ? (params.push(viewer.id), params.length) : null
    params.push(limitNum, (pageNum - 1) * limitNum)
    const { rows } = await db.query(
      `SELECT t.id, t.board, t.politician_id, p.name AS leader_name, t.title, LEFT(t.body, 240) AS excerpt, t.is_anonymous, t.upvotes, t.reply_count, t.pinned, t.locked, t.last_activity, t.created_at,
              ${IDENT('t')},
              ${viewerIdx ? `(t.user_id = $${viewerIdx})` : 'false'} AS is_own,
              ${viewerIdx ? `EXISTS (SELECT 1 FROM thread_upvotes tu WHERE tu.thread_id = t.id AND tu.user_id = $${viewerIdx})` : 'false'} AS user_upvoted
       FROM threads t JOIN users u ON u.id = t.user_id LEFT JOIN politicians p ON p.id = t.politician_id
       ${where} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const { rows: c } = await db.query(`SELECT COUNT(*)::int AS total FROM threads t ${where}`, params.slice(0, viewerIdx ? viewerIdx - 1 : params.length - 2))
    return { threads: rows, total: c[0].total, page: pageNum, hasMore: pageNum * limitNum < c[0].total }
  })

  server.post('/threads', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { title, body, board, politician_id, is_anonymous } = request.body as any
    const t = String(title || '').trim(), b = String(body || '').trim()
    if (t.length < 4 || b.length < 2) return reply.status(400).send({ error: 'Title and body required.' })
    if (t.length > MAX_TITLE || b.length > MAX_BODY) return reply.status(400).send({ error: 'Too long.' })
    let brd = BOARD_KEYS.includes(board) ? board : 'general'
    let leaderName: string | null = null
    if (politician_id) {
      const { rows } = await db.query('SELECT name FROM politicians WHERE id = $1', [politician_id])
      if (!rows.length) return reply.status(400).send({ error: 'No such leader.' })
      leaderName = rows[0].name
      if (brd === 'general') brd = 'leaders'
    }
    const { rows: recent } = await db.query(`SELECT 1 FROM threads WHERE user_id = $1 AND created_at > NOW() - INTERVAL '3 minutes'`, [user.id])
    if (recent.length) return reply.status(429).send({ error: 'Slow down. One new thread every few minutes.' })
    const anon = is_anonymous !== false
    const { rows } = await db.query(
      `INSERT INTO threads (board, politician_id, user_id, title, body, is_anonymous) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, board, title, created_at`,
      [brd, politician_id || null, user.id, t, b, anon]
    )
    const { rows: me } = await db.query('SELECT prole_number FROM users WHERE id = $1', [user.id])
    const who = anon ? `Prole #${me[0]?.prole_number}` : `@${user.username}`
    if (politician_id) await emitFeedEvent('thread', politician_id, leaderName!, { title: t, thread_id: rows[0].id, who, board: brd })
    return reply.status(201).send(rows[0])
  })

  server.get('/threads/:id', { onRequest: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const viewer = (request as any).user
    const v = viewer ? [viewer.id] : []
    const { rows } = await db.query(
      `SELECT t.id, t.board, t.politician_id, p.name AS leader_name, t.title, t.body, t.is_anonymous, t.upvotes, t.reply_count, t.pinned, t.locked, t.status, t.last_activity, t.created_at,
              ${IDENT('t')},
              ${viewer ? '(t.user_id = $2)' : 'false'} AS is_own,
              ${viewer ? 'EXISTS (SELECT 1 FROM thread_upvotes tu WHERE tu.thread_id = t.id AND tu.user_id = $2)' : 'false'} AS user_upvoted
       FROM threads t JOIN users u ON u.id = t.user_id LEFT JOIN politicians p ON p.id = t.politician_id WHERE t.id = $1`,
      [id, ...v]
    )
    if (!rows.length || (rows[0].status === 'removed' && !viewer?.is_admin)) return reply.status(404).send({ error: 'No such thread.' })
    const { rows: posts } = await db.query(
      `SELECT po.id, po.seq, po.body, po.is_anonymous, po.reply_to, po.upvotes, po.status, po.created_at,
              ${IDENT('po')},
              ${viewer ? '(po.user_id = $2)' : 'false'} AS is_own,
              ${viewer ? 'EXISTS (SELECT 1 FROM post_upvotes pu WHERE pu.post_id = po.id AND pu.user_id = $2)' : 'false'} AS user_upvoted
       FROM thread_posts po JOIN users u ON u.id = po.user_id WHERE po.thread_id = $1 ORDER BY po.seq ASC`,
      [id, ...v]
    )
    return { thread: rows[0], posts: posts.map(p => p.status === 'removed' ? { ...p, body: '[removed]', username: null, prole_number: null } : p) }
  })

  server.post('/threads/:id/posts', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { body, is_anonymous, reply_to } = request.body as any
    const b = String(body || '').trim()
    if (!b) return reply.status(400).send({ error: 'Nothing to post.' })
    if (b.length > MAX_BODY) return reply.status(400).send({ error: 'Too long.' })
    const { rows: t } = await db.query('SELECT id, user_id, title, locked, status FROM threads WHERE id = $1', [id])
    if (!t.length || t[0].status !== 'active') return reply.status(404).send({ error: 'No such thread.' })
    if (t[0].locked && !user.is_admin) return reply.status(403).send({ error: 'Thread is locked.' })
    const { rows: recent } = await db.query(`SELECT 1 FROM thread_posts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '15 seconds'`, [user.id])
    if (recent.length) return reply.status(429).send({ error: 'Slow down.' })
    const anon = is_anonymous !== false
    const { rows } = await db.query(
      `INSERT INTO thread_posts (thread_id, user_id, seq, body, is_anonymous, reply_to)
       VALUES ($1, $2, (SELECT COALESCE(MAX(seq), 0) + 1 FROM thread_posts WHERE thread_id = $1), $3, $4, $5) RETURNING id, seq, body, is_anonymous, reply_to, created_at`,
      [id, user.id, b, anon, reply_to != null && reply_to !== "" && !isNaN(Number(reply_to)) ? Number(reply_to) : null]
    )
    await db.query(`UPDATE threads SET reply_count = reply_count + 1, last_activity = NOW() WHERE id = $1`, [id])
    if (t[0].user_id !== user.id) {
      const { rows: me } = await db.query('SELECT prole_number FROM users WHERE id = $1', [user.id])
      const who = anon ? `Prole #${me[0]?.prole_number}` : `@${user.username}`
      await notifyUser(t[0].user_id, 'comment_reply', `${who} replied to your thread "${t[0].title.slice(0, 60)}"`, `/forum/${id}`)
    }
    return reply.status(201).send({ ...rows[0], is_own: true })
  })

  const toggle = async (table: string, col: string, targetTable: string, id: string, userId: string) => {
    const { rows: ex } = await db.query(`SELECT 1 FROM ${table} WHERE ${col} = $1 AND user_id = $2`, [id, userId])
    if (ex.length) await db.query(`DELETE FROM ${table} WHERE ${col} = $1 AND user_id = $2`, [id, userId])
    else await db.query(`INSERT INTO ${table} (${col}, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, userId])
    const { rows } = await db.query(`UPDATE ${targetTable} SET upvotes = (SELECT COUNT(*) FROM ${table} WHERE ${col} = $1)::int WHERE id = $1 RETURNING upvotes`, [id])
    return { upvoted: !ex.length, upvotes: rows[0]?.upvotes ?? 0 }
  }
  server.post('/threads/:id/upvote', { onRequest: [requireVerified] }, async (request) => toggle('thread_upvotes', 'thread_id', 'threads', (request.params as any).id, (request as any).user.id))
  server.post('/posts/:id/upvote', { onRequest: [requireVerified] }, async (request) => toggle('post_upvotes', 'post_id', 'thread_posts', (request.params as any).id, (request as any).user.id))

  server.delete('/posts/:id', { onRequest: [requireVerified] }, async (request) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await db.query(user.is_admin ? `UPDATE thread_posts SET status = 'removed' WHERE id = $1` : `UPDATE thread_posts SET status = 'removed' WHERE id = $1 AND user_id = $2`, user.is_admin ? [id] : [id, user.id])
    return { success: true }
  })

  server.patch('/threads/:id', { onRequest: [requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string }
    const { locked, pinned, status, board } = request.body as any
    const { rows } = await db.query(
      `UPDATE threads SET locked = COALESCE($2, locked), pinned = COALESCE($3, pinned), status = COALESCE($4, status), board = COALESCE($5, board) WHERE id = $1 RETURNING id, locked, pinned, status, board`,
      [id, locked ?? null, pinned ?? null, ['active', 'removed'].includes(status) ? status : null, BOARD_KEYS.includes(board) ? board : null]
    )
    return rows[0]
  })

  server.delete('/threads/:id', { onRequest: [requireVerified] }, async (request) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await db.query(user.is_admin ? `UPDATE threads SET status = 'removed' WHERE id = $1` : `UPDATE threads SET status = 'removed' WHERE id = $1 AND user_id = $2 AND reply_count = 0`, user.is_admin ? [id] : [id, user.id])
    return { success: true }
  })
}
