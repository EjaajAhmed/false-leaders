import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin } from '../middleware/auth'
import { recordSource } from '../services/provenance'

const POLL_COLS = 'id, politician_id, pollster, approve::float AS approve, disapprove::float AS disapprove, sample_size, to_char(fieldwork_end, 'YYYY-MM-DD') AS fieldwork_end, source_url, note, created_at'

async function refreshApprovalSource(politicianId: string) {
  const { rows } = await db.query(`SELECT ${POLL_COLS} FROM approval_polls WHERE politician_id = $1 ORDER BY fieldwork_end DESC, created_at DESC LIMIT 1`, [politicianId])
  if (rows[0]) await recordSource(politicianId, 'approval', { approve: rows[0].approve, disapprove: rows[0].disapprove, fieldwork_end: rows[0].fieldwork_end }, { name: rows[0].pollster, url: rows[0].source_url })
  else await db.query(`DELETE FROM field_sources WHERE politician_id = $1 AND field = 'approval'`, [politicianId])
}

// Mounted under /politicians
export async function approvalRoutes(server: FastifyInstance) {
  /** Latest poll plus everything from the last twelve months, newest first. */
  server.get('/:id/approval', async (request) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query(
      `SELECT ${POLL_COLS} FROM approval_polls WHERE politician_id = $1 AND fieldwork_end > NOW() - INTERVAL '12 months' ORDER BY fieldwork_end DESC, created_at DESC`,
      [id]
    )
    const { rows: any } = await db.query(`SELECT ${POLL_COLS} FROM approval_polls WHERE politician_id = $1 ORDER BY fieldwork_end DESC, created_at DESC LIMIT 1`, [id])
    return { latest: rows[0] || any[0] || null, polls: rows }
  })
}

// Mounted under /admin
export async function approvalAdminRoutes(server: FastifyInstance) {
  server.post('/approval-polls', { onRequest: [requireAdmin] }, async (request, reply) => {
    const user = (request as any).user
    const b = request.body as any
    const approve = Number(b?.approve)
    const disapprove = b?.disapprove == null || b.disapprove === '' ? null : Number(b.disapprove)
    if (!b?.politician_id) return reply.status(400).send({ error: 'Leader required.' })
    if (!b?.pollster || !String(b.pollster).trim()) return reply.status(400).send({ error: 'Pollster required.' })
    if (!Number.isFinite(approve) || approve < 0 || approve > 100) return reply.status(400).send({ error: 'Approve must be 0–100.' })
    if (disapprove != null && (!Number.isFinite(disapprove) || disapprove < 0 || disapprove > 100)) return reply.status(400).send({ error: 'Disapprove must be 0–100.' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b?.fieldwork_end || ''))) return reply.status(400).send({ error: 'Fieldwork end date required (YYYY-MM-DD).' })
    let url: URL
    try { url = new URL(String(b?.source_url)); if (!/^https?:$/.test(url.protocol)) throw new Error() } catch { return reply.status(400).send({ error: 'A valid http(s) source URL is required.' }) }
    const { rows: leader } = await db.query('SELECT id FROM politicians WHERE id = $1', [b.politician_id])
    if (!leader.length) return reply.status(404).send({ error: 'No such leader.' })
    const { rows } = await db.query(
      `INSERT INTO approval_polls (politician_id, pollster, approve, disapprove, sample_size, fieldwork_end, source_url, note, added_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (politician_id, pollster, fieldwork_end) DO UPDATE SET approve = EXCLUDED.approve, disapprove = EXCLUDED.disapprove, sample_size = EXCLUDED.sample_size, source_url = EXCLUDED.source_url, note = EXCLUDED.note
       RETURNING ${POLL_COLS}`,
      [b.politician_id, String(b.pollster).trim(), approve, disapprove, b.sample_size ? Number(b.sample_size) : null, b.fieldwork_end, url.toString(), b.note ? String(b.note).slice(0, 500) : null, user.id]
    )
    await refreshApprovalSource(b.politician_id)
    return reply.status(201).send(rows[0])
  })

  server.get('/approval-polls', { onRequest: [requireAdmin] }, async (request) => {
    const limit = Math.min(200, Number((request.query as any).limit) || 50)
    const { rows } = await db.query(`SELECT a.${POLL_COLS.replace(/, /g, ', a.')}, p.name AS leader_name FROM approval_polls a JOIN politicians p ON p.id = a.politician_id ORDER BY a.created_at DESC LIMIT $1`, [limit])
    return rows
  })

  server.delete('/approval-polls/:id', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('DELETE FROM approval_polls WHERE id = $1 RETURNING politician_id', [id])
    if (!rows.length) return reply.status(404).send({ error: 'No such poll.' })
    await refreshApprovalSource(rows[0].politician_id)
    return { success: true }
  })
}
