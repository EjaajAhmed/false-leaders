import { requireAdmin } from '../middleware/auth'
import { recalculateScore } from '../services/score'
import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

export async function fundingRoutes(server: FastifyInstance) {
  const auth = { onRequest: [requireAdmin] }

  server.get('/:politicianId', async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT * FROM funding_sources WHERE politician_id = $1 ORDER BY amount DESC`,
      [politicianId]
    )
    return rows
  })

  server.post('/', auth, async (request, reply) => {
    const { politician_id, source_name, source_type, amount } = request.body as any
    const { rows } = await db.query(
      `INSERT INTO funding_sources (politician_id, source_name, source_type, amount)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [politician_id, source_name, source_type, Number(amount)]
    )
    await recalculateScore(politician_id)
    return reply.status(201).send(rows[0])
  })

  server.delete('/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('DELETE FROM funding_sources WHERE id = $1 RETURNING politician_id', [id])
    if (rows[0]) await recalculateScore(rows[0].politician_id)
    return { success: true }
  })
}