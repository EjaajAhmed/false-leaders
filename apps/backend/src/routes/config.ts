import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin } from '../middleware/auth'
import { ARCHIVED_CONFIG_KEYS } from '../services/score'

export async function configRoutes(server: FastifyInstance) {

  server.get('/truth-score', async () => {
    const { rows } = await db.query(
      'SELECT key, value, label FROM truth_score_config ORDER BY key'
    )
    return rows.map(r => ({ ...r, archived: ARCHIVED_CONFIG_KEYS.includes(r.key) }))
  })

  server.put('/truth-score', { onRequest: [requireAdmin] }, async (request) => {
    const updates = request.body as { key: string; value: number }[]
    for (const { key, value } of updates) {
      await db.query(
        `UPDATE truth_score_config SET value = $1, updated_at = NOW() WHERE key = $2`,
        [value, key]
      )
    }
    const { rows } = await db.query('SELECT key, value, label FROM truth_score_config ORDER BY key')
    return rows.map(r => ({ ...r, archived: ARCHIVED_CONFIG_KEYS.includes(r.key) }))
  })
}