import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { authenticate, requireVerified } from '../middleware/auth'

export async function commentsRoutes(server: FastifyInstance) {
  server.get('/:politicianId', async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.politician_id = $1
       ORDER BY c.created_at DESC`,
      [politicianId]
    )
    return rows
  })

  server.post('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const { politician_id, body } = request.body as any
    const user = (request as any).user

    const { rows } = await db.query(
      `INSERT INTO comments (politician_id, user_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [politician_id, user.id, body]
    )

    const { rows: politicianRows } = await db.query(
      `SELECT name FROM politicians WHERE id = $1`, [politician_id]
    )
    const politicianName = politicianRows[0]?.name || 'a politician'

    const { rows: otherCommenters } = await db.query(
      `SELECT DISTINCT user_id FROM comments WHERE politician_id = $1 AND user_id != $2`,
      [politician_id, user.id]
    )

    for (const commenter of otherCommenters) {
      await db.query(
        `INSERT INTO notifications (user_id, type, message, link)
         VALUES ($1, 'comment_reply', $2, $3)`,
        [commenter.user_id, `@${user.username} also commented on ${politicianName}`, `/politicians/${politician_id}`]
      )
    }

    return reply.status(201).send(rows[0])
  })

  server.delete('/:id', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    await db.query('DELETE FROM comments WHERE id = $1 AND user_id = $2', [id, user.id])
    return { success: true }
  })
}