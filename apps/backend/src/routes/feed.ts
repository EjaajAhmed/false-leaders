import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

const TYPES = ['score_change', 'leak', 'controversy', 'controversy_escalated', 'verdict_shift']

export async function feedRoutes(server: FastifyInstance) {
  server.get('/recent', async (request) => {
    const { type, before, limit } = request.query as any
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 30))
    const params: any[] = []
    let where = 'WHERE 1=1'
    let i = 1

    if (type && TYPES.includes(type)) {
      where += ` AND type = $${i}`; params.push(type); i++
    } else if (type === 'controversy') {
      where += ` AND type IN ('controversy', 'controversy_escalated')`
    }
    if (before) {
      const d = new Date(before)
      if (!isNaN(d.getTime())) { where += ` AND created_at < $${i}`; params.push(d.toISOString()); i++ }
    }

    const { rows } = await db.query(
      `SELECT id, type, leader_id, leader_name, meta, created_at
       FROM feed_events ${where}
       ORDER BY created_at DESC
       LIMIT $${i}`,
      [...params, limitNum]
    )
    return { events: rows, hasMore: rows.length === limitNum }
  })
}
