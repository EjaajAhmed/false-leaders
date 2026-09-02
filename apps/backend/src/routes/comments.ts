import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireVerified } from '../middleware/auth'
import { notifyCommentReply } from '../services/notify'

const MAX_BODY = 2000

export async function commentsRoutes(server: FastifyInstance) {
  server.get('/:politicianId', { onRequest: [optionalAuth] }, async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const viewer = (request as any).user
    const { rows } = await db.query(
      `SELECT c.id, c.politician_id, c.body, c.is_anonymous, c.created_at,
              CASE WHEN c.is_anonymous THEN NULL ELSE u.username END AS username,
              CASE WHEN c.is_anonymous THEN u.prole_number ELSE NULL END AS prole_number,
              ${viewer ? '(c.user_id = $2)' : 'false'} AS is_own
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.politician_id = $1
       ORDER BY c.created_at DESC`,
      viewer ? [politicianId, viewer.id] : [politicianId]
    )
    return rows
  })

  server.post('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const { politician_id, body, is_anonymous } = request.body as any
    const user = (request as any).user
    const text = String(body || '').trim()
    if (!text) return reply.status(400).send({ error: 'Nothing to post.' })
    if (text.length > MAX_BODY) return reply.status(400).send({ error: `Too long. ${MAX_BODY} characters max.` })

    const anon = !!is_anonymous
    const { rows } = await db.query(
      `INSERT INTO comments (politician_id, user_id, body, is_anonymous)
       VALUES ($1, $2, $3, $4) RETURNING id, politician_id, body, is_anonymous, created_at`,
      [politician_id, user.id, text, anon]
    )

    const { rows: politicianRows } = await db.query('SELECT name FROM politicians WHERE id = $1', [politician_id])
    const leaderName = politicianRows[0]?.name || 'a leader'
    const { rows: me } = await db.query('SELECT prole_number FROM users WHERE id = $1', [user.id])
    const displayName = anon ? `Prole #${me[0]?.prole_number}` : `@${user.username}`

    await notifyCommentReply(user.id, displayName, politician_id, leaderName)

    return reply.status(201).send({ ...rows[0], is_own: true })
  })

  server.delete('/:id', { onRequest: [requireVerified] }, async (request) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    if (user.is_admin) {
      await db.query('DELETE FROM comments WHERE id = $1', [id])
    } else {
      await db.query('DELETE FROM comments WHERE id = $1 AND user_id = $2', [id, user.id])
    }
    return { success: true }
  })
}
