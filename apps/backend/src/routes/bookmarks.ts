import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

async function requireVerified(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user?.email_verified) {
      return reply.status(403).send({ error: 'Please verify your email to continue.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function bookmarksRoutes(server: FastifyInstance) {
  const auth = { onRequest: [(server as any).authenticate] }

  server.get('/', auth, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT b.id, b.created_at, b.graft_id,
              p.id AS politician_id, p.name, p.party, p.region, p.position,
              g.name AS graft_name
       FROM bookmarks b
       JOIN politicians p ON p.id = b.politician_id
       LEFT JOIN grafts g ON g.id = b.graft_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [user.id]
    )
    return rows
  })

  server.post('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { politician_id, graft_id } = request.body as any
    try {
      const { rows } = await db.query(
        `INSERT INTO bookmarks (user_id, politician_id, graft_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, politician_id, graft_id) DO NOTHING
         RETURNING *`,
        [user.id, politician_id, graft_id || null]
      )
      return reply.status(201).send(rows[0] || { already_saved: true })
    } catch (err) {
      throw err
    }
  })

  server.patch('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const { graft_id } = request.body as any
    const { rows } = await db.query(
      `UPDATE bookmarks SET graft_id = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [graft_id || null, id, user.id]
    )
    return rows[0]
  })

  server.delete('/', { onRequest: [requireVerified] }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await db.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [id, user.id])
    return { success: true }
  })

  server.get('/check/:politicianId', auth, async (request) => {
    const user = (request as any).user
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT b.*, g.name AS graft_name FROM bookmarks b
       LEFT JOIN grafts g ON g.id = b.graft_id
       WHERE b.user_id = $1 AND b.politician_id = $2`,
      [user.id, politicianId]
    )
    return { bookmarked: rows.length > 0, bookmarks: rows }
  })
}