import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireAdmin } from '../middleware/auth'
import { afterPromiseReview, extractFromDocument, fetchDocumentText, getContradictions, getPromises, scanContradictions } from '../services/promises'

// Mounted under /politicians
export async function leaderPromiseRoutes(server: FastifyInstance) {
  server.get('/:id/promises', { onRequest: [optionalAuth] }, async (request) => {
    const { id } = request.params as { id: string }
    const admin = !!(request as any).user?.is_admin
    const [promises, contradictions, { rows: docs }] = await Promise.all([
      getPromises(id, admin), getContradictions(id, admin),
      db.query('SELECT id, title, url, kind, spoken_on::text, created_at FROM documents WHERE politician_id = $1 ORDER BY spoken_on DESC NULLS LAST', [id]),
    ])
    return { promises, contradictions, documents: docs }
  })
}

// Mounted under /admin
export async function promiseAdminRoutes(server: FastifyInstance) {
  const admin = { onRequest: [requireAdmin] }

  server.post('/documents', admin, async (request, reply) => {
    const user = (request as any).user
    const { politician_id, title, url, text, kind, spoken_on } = request.body as any
    if (!politician_id) return reply.status(400).send({ error: 'Leader required.' })
    let body = String(text || '').trim()
    if (!body && url) {
      try { body = await fetchDocumentText(String(url)) } catch (err: any) { return reply.status(400).send({ error: err?.message || 'Could not fetch that URL.' }) }
    }
    if (body.length < 200) return reply.status(400).send({ error: 'Document text is too short (200 characters minimum).' })
    const { rows } = await db.query(
      `INSERT INTO documents (politician_id, title, url, kind, spoken_on, text, added_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [politician_id, String(title || url || 'Untitled').slice(0, 200), url || null, ['manifesto', 'speech', 'interview', 'article', 'statement', 'other'].includes(kind) ? kind : 'other', spoken_on || null, body, user.id]
    )
    const extracted = await extractFromDocument(rows[0].id)
    return { document_id: rows[0].id, ...extracted }
  })

  server.delete('/documents/:id', admin, async (request) => {
    const { id } = request.params as { id: string }
    await db.query('DELETE FROM documents WHERE id = $1', [id])
    return { success: true }
  })

  server.post('/politicians/:id/contradictions/scan', admin, async (request) => {
    const { id } = request.params as { id: string }
    return scanContradictions(id)
  })

  server.get('/promises', admin, async (request) => {
    const { status } = request.query as any
    const s = ['draft', 'published', 'rejected'].includes(status) ? status : 'draft'
    const { rows } = await db.query(
      `SELECT pr.*, pr.promised_on::text AS promised_on, p.name AS leader_name FROM promises pr JOIN politicians p ON p.id = pr.politician_id WHERE pr.review_status = $1 ORDER BY pr.created_at DESC LIMIT 200`, [s]
    )
    return rows
  })

  server.patch('/promises/:id', admin, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { review_status, status, text, evidence_url, evidence_note, topic } = request.body as any
    const { rows: existing } = await db.query('SELECT * FROM promises WHERE id = $1', [id])
    if (!existing.length) return reply.status(404).send({ error: 'Not found.' })
    const cur = existing[0]
    const next = {
      review_status: ['draft', 'published', 'rejected'].includes(review_status) ? review_status : cur.review_status,
      status: ['pending', 'kept', 'broken', 'unclear'].includes(status) ? status : cur.status,
      text: text ? String(text).slice(0, 500) : cur.text,
      evidence_url: evidence_url !== undefined ? (evidence_url || null) : cur.evidence_url,
      evidence_note: evidence_note !== undefined ? (evidence_note ? String(evidence_note).slice(0, 500) : null) : cur.evidence_note,
      topic: topic !== undefined ? (topic || null) : cur.topic,
    }
    if (next.review_status === 'published' && (next.status === 'kept' || next.status === 'broken') && !next.evidence_url) {
      return reply.status(400).send({ error: `A ${next.status} verdict needs an evidence URL before it can be published.` })
    }
    const { rows } = await db.query(
      `UPDATE promises SET review_status = $1, status = $2, text = $3, evidence_url = $4, evidence_note = $5, topic = $6, reviewed_at = NOW(), reviewed_by = $7 WHERE id = $8 RETURNING *`,
      [next.review_status, next.status, next.text, next.evidence_url, next.evidence_note, next.topic, user.id, id]
    )
    await afterPromiseReview(cur.politician_id)
    return rows[0]
  })

  server.get('/contradictions', admin, async (request) => {
    const { status } = request.query as any
    const s = ['draft', 'published', 'rejected'].includes(status) ? status : 'draft'
    const { rows } = await db.query(
      `SELECT c.*, c.date_a::text AS date_a, c.date_b::text AS date_b, p.name AS leader_name FROM contradictions c JOIN politicians p ON p.id = c.politician_id WHERE c.review_status = $1 ORDER BY c.created_at DESC LIMIT 200`, [s]
    )
    return rows
  })

  server.patch('/contradictions/:id', admin, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { review_status, explanation, topic } = request.body as any
    if (!['draft', 'published', 'rejected'].includes(review_status)) return reply.status(400).send({ error: 'Invalid status.' })
    const { rows } = await db.query(
      `UPDATE contradictions SET review_status = $1, explanation = COALESCE($2, explanation), topic = COALESCE($3, topic), reviewed_at = NOW(), reviewed_by = $4 WHERE id = $5 RETURNING *`,
      [review_status, explanation ? String(explanation).slice(0, 400) : null, topic ? String(topic).slice(0, 80) : null, user.id, id]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Not found.' })
    return rows[0]
  })
}
