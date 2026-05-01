import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

export async function influenceRoutes(server: FastifyInstance) {
  const auth = { onRequest: [(server as any).authenticate] }

  server.get('/:politicianId', async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT * FROM foreign_influence WHERE politician_id = $1 ORDER BY influence_score DESC`,
      [politicianId]
    )
    return rows
  })

  server.post('/', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })
    const { politician_id, country, country_code, influence_score, notes } = request.body as any
    const { rows } = await db.query(
      `INSERT INTO foreign_influence (politician_id, country, country_code, influence_score, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (politician_id, country) DO UPDATE SET influence_score=$4, notes=$5
       RETURNING *`,
      [politician_id, country, country_code || null, Number(influence_score), notes || null]
    )
    return reply.status(201).send(rows[0])
  })

  server.delete('/:id', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })
    const { id } = request.params as { id: string }
    await db.query('DELETE FROM foreign_influence WHERE id = $1', [id])
    return { success: true }
  })
}