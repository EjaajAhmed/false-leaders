import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireAdmin, requireVerified } from '../middleware/auth'
import { emitFeedEvent } from '../services/feed'
import { recalculateScore } from '../services/score'
import { notifyPoliticianUpdate } from '../services/notify'

const MAX_BODY = 4000
const STATUSES = ['pending', 'visible', 'escalated', 'removed']

// Leaks never expose user_id or username. Prole number only.
const LEAK_SELECT = (withViewer: boolean) => `
  SELECT l.id, l.politician_id, l.body, l.upvotes, l.status, l.controversy_id, l.created_at,
         u.prole_number,
         ${withViewer ? '(l.user_id = $2)' : 'false'} AS is_own,
         ${withViewer ? 'EXISTS (SELECT 1 FROM leak_upvotes lu WHERE lu.leak_id = l.id AND lu.user_id = $2)' : 'false'} AS user_upvoted
  FROM leaks l
  JOIN users u ON u.id = l.user_id`

// Mounted under /politicians
export async function leaderLeakRoutes(server: FastifyInstance) {
  server.get('/:id/leaks', { onRequest: [optionalAuth] }, async (request) => {
    const { id } = request.params as { id: string }
    const viewer = (request as any).user
    const { rows } = await db.query(
      `${LEAK_SELECT(!!viewer)}
       WHERE l.politician_id = $1 AND l.status IN ('visible', 'escalated')
       ORDER BY l.upvotes DESC, l.created_at DESC`,
      viewer ? [id, viewer.id] : [id]
    )
    return rows
  })

  server.post('/:id/leaks', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { body } = request.body as any
    const text = String(body || '').trim()
    if (!text) return reply.status(400).send({ error: 'Nothing to submit.' })
    if (text.length > MAX_BODY) return reply.status(400).send({ error: `Too long. ${MAX_BODY} characters max.` })

    const { rows: leader } = await db.query('SELECT name FROM politicians WHERE id = $1', [id])
    if (leader.length === 0) return reply.status(404).send({ error: 'No such leader.' })

    const { rows } = await db.query(
      `INSERT INTO leaks (politician_id, user_id, body, status) VALUES ($1, $2, $3, 'visible')
       RETURNING id, politician_id, body, upvotes, status, created_at`,
      [id, user.id, text]
    )
    const { rows: me } = await db.query('SELECT prole_number FROM users WHERE id = $1', [user.id])
    const prole = me[0]?.prole_number

    await emitFeedEvent('leak', id, leader[0].name, { prole_number: prole, leak_id: rows[0].id })

    return reply.status(201).send({ ...rows[0], prole_number: prole, is_own: true, user_upvoted: false })
  })
}

// Mounted under /leaks
export async function leaksRoutes(server: FastifyInstance) {
  server.post('/:id/upvote', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user

    const { rows: existing } = await db.query(
      'SELECT 1 FROM leak_upvotes WHERE leak_id = $1 AND user_id = $2', [id, user.id]
    )
    let upvoted: boolean
    if (existing.length > 0) {
      await db.query('DELETE FROM leak_upvotes WHERE leak_id = $1 AND user_id = $2', [id, user.id])
      upvoted = false
    } else {
      const { rowCount } = await db.query(
        'INSERT INTO leak_upvotes (leak_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, user.id]
      )
      if (!rowCount) return reply.status(404).send({ error: 'Not found.' })
      upvoted = true
    }
    const { rows } = await db.query(
      `UPDATE leaks SET upvotes = (SELECT COUNT(*) FROM leak_upvotes WHERE leak_id = $1)::int WHERE id = $1 RETURNING upvotes`,
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found.' })
    return { upvoted, upvotes: rows[0].upvotes }
  })

  // Admin moderation queue
  server.get('/queue', { onRequest: [requireAdmin] }, async (request) => {
    const { status } = request.query as any
    const filter = STATUSES.includes(status) ? status : null
    const { rows } = await db.query(
      `SELECT l.id, l.politician_id, l.body, l.upvotes, l.status, l.controversy_id, l.created_at,
              u.prole_number, u.username, p.name AS leader_name
       FROM leaks l
       JOIN users u ON u.id = l.user_id
       JOIN politicians p ON p.id = l.politician_id
       WHERE ${filter ? 'l.status = $1' : "l.status IN ('pending', 'visible')"}
       ORDER BY l.created_at DESC
       LIMIT 200`,
      filter ? [filter] : []
    )
    return rows
  })

  server.patch('/:id/status', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { status, title, level } = request.body as any
    if (!STATUSES.includes(status)) return reply.status(400).send({ error: 'Invalid status.' })

    const { rows: existing } = await db.query('SELECT * FROM leaks WHERE id = $1', [id])
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found.' })
    const leak = existing[0]

    if (status === 'escalated') {
      if (leak.status === 'escalated' && leak.controversy_id) {
        return reply.status(400).send({ error: 'Already escalated.' })
      }
      const { rows: leader } = await db.query('SELECT name FROM politicians WHERE id = $1', [leak.politician_id])
      const leaderName = leader[0]?.name || 'a leader'
      const controversyTitle = (title && String(title).trim()) || leak.body.slice(0, 80).trim()
      const controversyLevel = ['confirmed', 'likely', 'maybe', 'speculative'].includes(level) ? level : 'speculative'

      const { rows: created } = await db.query(
        `INSERT INTO controversies (politician_id, title, description, level, source_url)
         VALUES ($1, $2, $3, $4, NULL) RETURNING *`,
        [leak.politician_id, controversyTitle, leak.body, controversyLevel]
      )
      await db.query(
        `UPDATE leaks SET status = 'escalated', controversy_id = $1 WHERE id = $2`,
        [created[0].id, id]
      )
      await emitFeedEvent('controversy_escalated', leak.politician_id, leaderName, {
        title: controversyTitle, level: controversyLevel, controversy_id: created[0].id, leak_id: id,
      })
      await notifyPoliticianUpdate(leak.politician_id, leaderName, [`leak escalated to controversy: "${controversyTitle}"`])
      await recalculateScore(leak.politician_id)
      return { success: true, status: 'escalated', controversy: created[0], reviewed_by: user.id }
    }

    await db.query('UPDATE leaks SET status = $1 WHERE id = $2', [status, id])
    return { success: true, status }
  })
}
