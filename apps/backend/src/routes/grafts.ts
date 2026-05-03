import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { authenticate, requireVerified } from '../middleware/auth'

export async function graftsRoutes(server: FastifyInstance) {
  server.get('/', { onRequest: [authenticate] }, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT g.*, COUNT(b.id) AS bookmark_count
       FROM grafts g
       LEFT JOIN bookmarks b ON b.graft_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [user.id]
    )
    return rows
  })

  server.post('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { name, description } = request.body as any
    const { rows } = await db.query(
      `INSERT INTO grafts (user_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [user.id, name, description]
    )
    return reply.status(201).send(rows[0])
  })

  server.delete('/:id', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await db.query('DELETE FROM grafts WHERE id = $1 AND user_id = $2', [id, user.id])
    return { success: true }
  })

  server.get('/:id/politicians', { onRequest: [authenticate] }, async (request) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { rows } = await db.query(
      `SELECT p.*, b.id AS bookmark_id, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN politicians p ON p.id = b.politician_id
       WHERE b.graft_id = $1 AND b.user_id = $2
       ORDER BY b.created_at DESC`,
      [id, user.id]
    )
    return rows
  })
}