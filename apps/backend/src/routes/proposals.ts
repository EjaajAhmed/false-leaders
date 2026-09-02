import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin, requireVerified } from '../middleware/auth'
import { emitFeedEvent } from '../services/feed'
import { recalculateScore } from '../services/score'
import { notifyPoliticianUpdate } from '../services/notify'

const LEVELS = ['confirmed', 'likely', 'maybe', 'speculative']

// Mounted under /politicians
export async function leaderProposalRoutes(server: FastifyInstance) {
  server.post('/:id/controversy-proposals', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { title, description, level, source_url } = request.body as any

    const t = String(title || '').trim()
    const d = String(description || '').trim()
    if (!t || !d) return reply.status(400).send({ error: 'Title and description required.' })
    if (t.length > 200 || d.length > 4000) return reply.status(400).send({ error: 'Too long.' })
    if (!LEVELS.includes(level)) return reply.status(400).send({ error: 'Invalid level.' })

    const { rows: leader } = await db.query('SELECT id FROM politicians WHERE id = $1', [id])
    if (leader.length === 0) return reply.status(404).send({ error: 'No such leader.' })

    const { rows } = await db.query(
      `INSERT INTO controversy_proposals (politician_id, user_id, title, description, level, source_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, politician_id, title, description, level, source_url, status, created_at`,
      [id, user.id, t, d, level, source_url ? String(source_url).trim() : null]
    )
    return reply.status(201).send(rows[0])
  })

  server.get('/:id/controversy-proposals/mine', { onRequest: [requireVerified] }, async (request) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT id, title, level, status, created_at FROM controversy_proposals
       WHERE politician_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [id, user.id]
    )
    return rows
  })
}

// Mounted under /controversy-proposals
export async function proposalsRoutes(server: FastifyInstance) {
  server.get('/', { onRequest: [requireAdmin] }, async (request) => {
    const { status } = request.query as any
    const s = ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending'
    const { rows } = await db.query(
      `SELECT cp.*, u.username, u.prole_number, p.name AS leader_name
       FROM controversy_proposals cp
       JOIN users u ON u.id = cp.user_id
       JOIN politicians p ON p.id = cp.politician_id
       WHERE cp.status = $1
       ORDER BY cp.created_at ASC
       LIMIT 200`,
      [s]
    )
    return rows
  })

  server.patch('/:id', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const { action, title, description, level, source_url } = request.body as any
    if (!['approve', 'reject'].includes(action)) return reply.status(400).send({ error: 'Invalid action.' })

    const { rows: existing } = await db.query('SELECT * FROM controversy_proposals WHERE id = $1', [id])
    if (existing.length === 0) return reply.status(404).send({ error: 'Not found.' })
    const proposal = existing[0]
    if (proposal.status !== 'pending') return reply.status(400).send({ error: 'Already reviewed.' })

    if (action === 'reject') {
      await db.query(
        `UPDATE controversy_proposals SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
        [user.id, id]
      )
      return { success: true, status: 'rejected' }
    }

    const finalTitle = (title && String(title).trim()) || proposal.title
    const finalDesc = (description && String(description).trim()) || proposal.description
    const finalLevel = LEVELS.includes(level) ? level : proposal.level
    const finalSource = source_url !== undefined ? (source_url || null) : proposal.source_url

    const { rows: created } = await db.query(
      `INSERT INTO controversies (politician_id, title, description, level, source_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [proposal.politician_id, finalTitle, finalDesc, finalLevel, finalSource]
    )
    await db.query(
      `UPDATE controversy_proposals SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [user.id, id]
    )

    const { rows: leader } = await db.query('SELECT name FROM politicians WHERE id = $1', [proposal.politician_id])
    const leaderName = leader[0]?.name || 'a leader'
    await emitFeedEvent('controversy', proposal.politician_id, leaderName, {
      title: finalTitle, level: finalLevel, controversy_id: created[0].id, proposed: true,
    })
    await notifyPoliticianUpdate(proposal.politician_id, leaderName, [`new controversy added: "${finalTitle}"`])
    await recalculateScore(proposal.politician_id)

    return { success: true, status: 'approved', controversy: created[0] }
  })
}
