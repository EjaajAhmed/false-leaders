import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

// score_change and verdict_shift events belong to the retired TruthScore and are kept in the table but no longer served.
const TYPES = ['controversy', 'controversy_escalated', 'thread', 'rating_public']

export async function feedRoutes(server: FastifyInstance) {
  server.get('/recent', async (request) => {
    const { type, before, limit } = request.query as any
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 30))
    const params: any[] = []
    // A thread event is only served while its thread is live: removal and hard deletion take the title off the Wall too.
    let where = `WHERE type NOT IN ('score_change', 'verdict_shift')
      AND NOT (type = 'thread' AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id::text = meta->>'thread_id' AND t.status = 'active'))`
    let i = 1

    if (type === 'thread') {
      where += ` AND type IN ('thread', 'leak')` // older leak events were threads too
    } else if (type && TYPES.includes(type)) {
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
