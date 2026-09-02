import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireVerified } from '../middleware/auth'
import { VERDICT_KINDS, getVerdictAggregate } from '../services/verdicts'
import { emitFeedEvent } from '../services/feed'

const MAX_BODY = 1500

const LIST_SQL = (withViewer: boolean) => `
  SELECT v.id, v.politician_id, v.verdict, v.body, v.is_anonymous, v.upvotes, v.created_at, v.updated_at,
         CASE WHEN v.is_anonymous THEN NULL ELSE u.username END AS username,
         CASE WHEN v.is_anonymous THEN u.prole_number ELSE NULL END AS prole_number,
         ${withViewer ? '(v.user_id = $2)' : 'false'} AS is_own,
         ${withViewer ? 'EXISTS (SELECT 1 FROM verdict_upvotes vu WHERE vu.verdict_id = v.id AND vu.user_id = $2)' : 'false'} AS user_upvoted
  FROM verdicts v
  JOIN users u ON u.id = v.user_id
  WHERE v.politician_id = $1
  ORDER BY v.upvotes DESC, v.updated_at DESC`

// Mounted under /politicians
export async function leaderVerdictRoutes(server: FastifyInstance) {
  server.get('/:id/verdicts', { onRequest: [optionalAuth] }, async (request) => {
    const { id } = request.params as { id: string }
    const viewer = (request as any).user
    const [{ rows }, aggregate] = await Promise.all([
      db.query(LIST_SQL(!!viewer), viewer ? [id, viewer.id] : [id]),
      getVerdictAggregate(id),
    ])
    let mine = null
    if (viewer) {
      const { rows: own } = await db.query(
        'SELECT id, verdict, body, is_anonymous FROM verdicts WHERE politician_id = $1 AND user_id = $2', [id, viewer.id]
      )
      mine = own[0] || null
    }
    return { verdicts: rows, aggregate, mine }
  })

  server.post('/:id/verdicts', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { verdict, body, is_anonymous } = request.body as any

    if (!VERDICT_KINDS.includes(verdict)) return reply.status(400).send({ error: 'Invalid verdict.' })
    const text = body ? String(body).trim() : null
    if (text && text.length > MAX_BODY) return reply.status(400).send({ error: `Too long. ${MAX_BODY} characters max.` })

    const { rows: leader } = await db.query('SELECT name FROM politicians WHERE id = $1', [id])
    if (leader.length === 0) return reply.status(404).send({ error: 'No such leader.' })

    const before = await getVerdictAggregate(id)

    const { rows } = await db.query(
      `INSERT INTO verdicts (politician_id, user_id, verdict, body, is_anonymous)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (politician_id, user_id)
       DO UPDATE SET verdict = EXCLUDED.verdict, body = EXCLUDED.body,
                     is_anonymous = EXCLUDED.is_anonymous, updated_at = NOW()
       RETURNING id, verdict, body, is_anonymous, upvotes, created_at, updated_at`,
      [id, user.id, verdict, text || null, !!is_anonymous]
    )

    const after = await getVerdictAggregate(id)
    if (after.dominant && after.dominant !== before.dominant && after.total >= 3) {
      await emitFeedEvent('verdict_shift', id, leader[0].name, { from: before.dominant, to: after.dominant, total: after.total })
    }

    return reply.status(201).send({ ...rows[0], aggregate: after })
  })
}

// Mounted under /verdicts
export async function verdictsRoutes(server: FastifyInstance) {
  server.post('/:id/upvote', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user

    const { rows: existing } = await db.query(
      'SELECT 1 FROM verdict_upvotes WHERE verdict_id = $1 AND user_id = $2', [id, user.id]
    )
    let upvoted: boolean
    if (existing.length > 0) {
      await db.query('DELETE FROM verdict_upvotes WHERE verdict_id = $1 AND user_id = $2', [id, user.id])
      upvoted = false
    } else {
      const { rowCount } = await db.query(
        'INSERT INTO verdict_upvotes (verdict_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, user.id]
      )
      if (!rowCount) return reply.status(404).send({ error: 'Not found.' })
      upvoted = true
    }
    const { rows } = await db.query(
      `UPDATE verdicts SET upvotes = (SELECT COUNT(*) FROM verdict_upvotes WHERE verdict_id = $1)::int WHERE id = $1 RETURNING upvotes`,
      [id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found.' })
    return { upvoted, upvotes: rows[0].upvotes }
  })

  server.delete('/:id', { onRequest: [requireVerified] }, async (request) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    if (user.is_admin) {
      await db.query('DELETE FROM verdicts WHERE id = $1', [id])
    } else {
      await db.query('DELETE FROM verdicts WHERE id = $1 AND user_id = $2', [id, user.id])
    }
    return { success: true }
  })
}
