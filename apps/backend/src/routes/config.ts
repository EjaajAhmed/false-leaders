import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { authenticate } from '../middleware/auth'

export async function configRoutes(server: FastifyInstance) {

  server.get('/truth-score', async () => {
    const { rows } = await db.query(
      'SELECT key, value, label FROM truth_score_config ORDER BY key'
    )
    return rows
  })

  server.put('/truth-score', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const updates = request.body as { key: string; value: number }[]
    for (const { key, value } of updates) {
      await db.query(
        `UPDATE truth_score_config SET value = $1, updated_at = NOW() WHERE key = $2`,
        [value, key]
      )
    }
    const { rows } = await db.query('SELECT key, value, label FROM truth_score_config ORDER BY key')
    return rows
  })
}