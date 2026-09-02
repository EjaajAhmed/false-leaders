import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireAdmin, requireVerified } from '../middleware/auth'
import { notifyPoliticianUpdate } from '../services/notify'
import { recalculateScore } from '../services/score'
import { emitFeedEvent } from '../services/feed'

const LEVELS = ['confirmed', 'likely', 'maybe', 'speculative']

export async function controversiesRoutes(server: FastifyInstance) {
  const admin = { onRequest: [requireAdmin] }

  server.get('/:politicianId', { onRequest: [optionalAuth] }, async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT c.*,
              ${user ? `EXISTS (SELECT 1 FROM controversy_upvotes cu WHERE cu.controversy_id = c.id AND cu.user_id = $2)` : 'false'} AS user_upvoted
       FROM controversies c
       WHERE c.politician_id = $1
       ORDER BY CASE c.level WHEN 'confirmed' THEN 0 WHEN 'likely' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END,
                c.upvotes DESC, c.created_at DESC`,
      user ? [politicianId, user.id] : [politicianId]
    )
    return rows
  })

  server.post('/', admin, async (request, reply) => {
    const { politician_id, title, description, source_url, level } = request.body as any
    if (!LEVELS.includes(level)) return reply.status(400).send({ error: 'Invalid level.' })

    const { rows } = await db.query(
      `INSERT INTO controversies (politician_id, title, description, source_url, level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [politician_id, title, description, source_url || null, level]
    )

    const { rows: politicianRows } = await db.query('SELECT name FROM politicians WHERE id = $1', [politician_id])
    const leaderName = politicianRows[0]?.name || 'a leader'

    await emitFeedEvent('controversy', politician_id, leaderName, { title, level, controversy_id: rows[0].id })
    await notifyPoliticianUpdate(politician_id, leaderName, [`new controversy added: "${title}"`])
    await recalculateScore(politician_id)

    return reply.status(201).send(rows[0])
  })

  server.put('/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { title, description, source_url, level } = request.body as any
    if (!LEVELS.includes(level)) return reply.status(400).send({ error: 'Invalid level.' })

    const { rows: existing } = await db.query('SELECT * FROM controversies WHERE id = $1', [id])
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found.' })
    const prev = existing[0]

    const { rows } = await db.query(
      `UPDATE controversies SET title=$1, description=$2, source_url=$3, level=$4 WHERE id=$5 RETURNING *`,
      [title, description, source_url || null, level, id]
    )

    const { rows: politicianRows } = await db.query('SELECT name FROM politicians WHERE id = $1', [prev.politician_id])
    const leaderName = politicianRows[0]?.name || 'a leader'

    const changes: string[] = []
    if (prev.title !== title) changes.push(`controversy renamed to "${title}"`)
    if (prev.level !== level) {
      changes.push(`"${title}" level changed to ${level}`)
      if (level === 'confirmed') {
        await emitFeedEvent('controversy', prev.politician_id, leaderName, { title, level, controversy_id: id, upgraded: true })
      }
    }
    if (changes.length > 0) await notifyPoliticianUpdate(prev.politician_id, leaderName, changes)
    await recalculateScore(prev.politician_id)

    return rows[0]
  })

  server.delete('/:id', admin, async (request) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('DELETE FROM controversies WHERE id = $1 RETURNING politician_id', [id])
    if (rows[0]) await recalculateScore(rows[0].politician_id)
    return { success: true }
  })

  // Toggle upvote
  server.post('/:id/upvote', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user

    const { rows: existing } = await db.query(
      'SELECT 1 FROM controversy_upvotes WHERE controversy_id = $1 AND user_id = $2', [id, user.id]
    )
    let upvoted: boolean
    if (existing.length > 0) {
      await db.query('DELETE FROM controversy_upvotes WHERE controversy_id = $1 AND user_id = $2', [id, user.id])
      upvoted = false
    } else {
      const { rowCount } = await db.query(
        'INSERT INTO controversy_upvotes (controversy_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, user.id]
      )
      if (!rowCount) return reply.status(404).send({ error: 'Not found.' })
      upvoted = true
    }
    const { rows } = await db.query(
      `UPDATE controversies SET upvotes = (SELECT COUNT(*) FROM controversy_upvotes WHERE controversy_id = $1)::int
       WHERE id = $1 RETURNING upvotes`,
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found.' })
    return { upvoted, upvotes: rows[0].upvotes }
  })
}
