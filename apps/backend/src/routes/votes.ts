import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

export async function votesRoutes(server: FastifyInstance) {
  server.post('/', { onRequest: [(server as any).authenticate] }, async (request, reply) => {
    const { politician_id, type } = request.body as any
    const user = (request as any).user

    try {
      const { rows } = await db.query(
        `INSERT INTO votes (politician_id, user_id, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (politician_id, user_id)
         DO UPDATE SET type = $3
         RETURNING *`,
        [politician_id, user.id, type]
      )
      return rows[0]
    } catch (err: any) {
      throw err
    }
  })

  server.get('/:politicianId', async (request, reply) => {
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE type = 'up') as upvotes,
        COUNT(*) FILTER (WHERE type = 'down') as downvotes
       FROM votes WHERE politician_id = $1`,
      [politicianId]
    )
    return rows[0]
  })
}