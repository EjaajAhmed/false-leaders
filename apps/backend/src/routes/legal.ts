import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin } from '../middleware/auth'
import { ABUSE_EMAIL, TAKEDOWN_RESPONSE_DAYS, TERMS_VERSION } from '../services/legal'
import { logModeration } from '../services/forum'
import { sendTakedownNotice } from '../services/email'

const recentByIp = new Map<string, number[]>()
const limited = (ip: string, max = 3, windowMs = 3600 * 1000) => {
  const now = Date.now()
  if (recentByIp.size > 5000) for (const [k, v] of recentByIp) if (!v.some(t => now - t < windowMs)) recentByIp.delete(k)
  const hits = (recentByIp.get(ip) || []).filter(t => now - t < windowMs)
  if (hits.length >= max) return true
  hits.push(now); recentByIp.set(ip, hits)
  return false
}

// Mounted under /legal
export async function legalRoutes(server: FastifyInstance) {
  server.get('/info', async () => ({ abuse_email: ABUSE_EMAIL, takedown_response_days: TAKEDOWN_RESPONSE_DAYS, terms_version: TERMS_VERSION }))

  /** Notice-and-takedown. Open to anyone; rate-limited per IP; logged; emailed to the abuse contact. */
  server.post('/takedown', async (request, reply) => {
    const b = request.body as any
    const name = String(b?.name || '').trim().slice(0, 200), email = String(b?.email || '').trim().toLowerCase().slice(0, 254), url = String(b?.url || '').trim().slice(0, 2000)
    const reason = String(b?.reason || '').trim().slice(0, 200), detail = String(b?.detail || '').trim().slice(0, 4000)
    if (!name || !email || !url || !reason) return reply.status(400).send({ error: 'Name, email, the address of the content and a reason are required.' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply.status(400).send({ error: 'That email address does not look valid.' })
    if (!/^https?:\/\//.test(url)) return reply.status(400).send({ error: 'The content address must be a full link starting with http.' })
    if (limited(request.ip)) return reply.status(429).send({ error: 'Too many requests from this connection. Email the abuse contact instead.' })
    const { rows } = await db.query(
      `INSERT INTO takedown_requests (name, email, url, reason, detail) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [name, email, url, reason, detail || null]
    )
    await logModeration('takedown_received', 'takedown', rows[0].id, null, reason, null, { url, email })
    sendTakedownNotice({ id: rows[0].id, name, email, url, reason, detail }).catch(() => undefined)
    return reply.status(201).send({ id: rows[0].id, received_at: rows[0].created_at, response_days: TAKEDOWN_RESPONSE_DAYS, abuse_email: ABUSE_EMAIL })
  })
}

// Mounted under /admin
export async function moderationAdminRoutes(server: FastifyInstance) {
  server.get('/reports', { onRequest: [requireAdmin] }, async (request) => {
    const status = (request.query as any).status || 'open'
    const { rows } = await db.query(
      `SELECT r.*, u.username AS reporter,
              CASE WHEN r.target_type = 'thread' THEN (SELECT title FROM threads WHERE id = r.target_id) ELSE (SELECT LEFT(body, 140) FROM thread_posts WHERE id = r.target_id) END AS target_text,
              CASE WHEN r.target_type = 'thread' THEN r.target_id ELSE (SELECT thread_id FROM thread_posts WHERE id = r.target_id) END AS thread_id,
              CASE WHEN r.target_type = 'thread' THEN (SELECT status FROM threads WHERE id = r.target_id) ELSE (SELECT status FROM thread_posts WHERE id = r.target_id) END AS target_status
       FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE ($1 = 'all' OR r.status = $1) ORDER BY r.created_at DESC LIMIT 200`, [status]
    )
    return rows
  })
  server.patch('/reports/:id', { onRequest: [requireAdmin] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { status, note } = request.body as any
    if (!['open', 'resolved', 'dismissed'].includes(status)) return reply.status(400).send({ error: 'Bad status.' })
    const { rows } = await db.query(
      `UPDATE reports SET status = $2, resolved_by = CASE WHEN $2 = 'open' THEN NULL ELSE $3::uuid END, resolved_at = CASE WHEN $2 = 'open' THEN NULL ELSE NOW() END WHERE id = $1 RETURNING *`,
      [id, status, user.id]
    )
    if (!rows.length) return reply.status(404).send({ error: 'No such report.' })
    await logModeration(`report_${status}`, 'report', id, user.id, note || null, null, { target_type: rows[0].target_type, target_id: rows[0].target_id })
    return rows[0]
  })

  server.get('/takedowns', { onRequest: [requireAdmin] }, async (request) => {
    const status = (request.query as any).status || 'all'
    const { rows } = await db.query(`SELECT * FROM takedown_requests WHERE ($1 = 'all' OR status = $1) ORDER BY created_at DESC LIMIT 200`, [status])
    return rows
  })
  server.patch('/takedowns/:id', { onRequest: [requireAdmin] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { status, notes } = request.body as any
    if (status && !['received', 'in_review', 'actioned', 'declined'].includes(status)) return reply.status(400).send({ error: 'Bad status.' })
    const { rows: before } = await db.query('SELECT status, notes FROM takedown_requests WHERE id = $1', [id])
    if (!before.length) return reply.status(404).send({ error: 'No such request.' })
    const { rows } = await db.query(`UPDATE takedown_requests SET status = COALESCE($2, status), notes = COALESCE($3, notes), updated_at = NOW() WHERE id = $1 RETURNING *`, [id, status || null, notes ?? null])
    await logModeration('takedown_updated', 'takedown', id, user.id, notes || null, before[0], { status: rows[0].status })
    return rows[0]
  })

  server.get('/moderation-log', { onRequest: [requireAdmin] }, async (request) => {
    const limit = Math.min(500, Number((request.query as any).limit) || 100)
    const { rows } = await db.query(
      `SELECT m.*, u.username AS actor FROM moderation_log m LEFT JOIN users u ON u.id = m.actor_id ORDER BY m.created_at DESC LIMIT $1`, [limit]
    )
    return rows
  })
}
