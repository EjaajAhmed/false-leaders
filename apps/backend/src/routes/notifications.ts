import { authenticate, requireAdmin } from '../middleware/auth'
import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { notifyAllUsers } from '../services/notify'

export async function notificationsRoutes(server: FastifyInstance) {
  const auth = { onRequest: [authenticate] }

  server.get('/', auth, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id]
    )
    return rows
  })

  server.get('/unread-count', auth, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`,
      [user.id]
    )
    return { count: Number(rows[0].count) }
  })

  server.patch('/read-all', auth, async (request) => {
    const user = (request as any).user
    await db.query(
      `UPDATE notifications SET read = true WHERE user_id = $1`,
      [user.id]
    )
    return { success: true }
  })

  server.patch('/:id/read', auth, async (request) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    await db.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    return { success: true }
  })

  server.delete('/clear', auth, async (request) => {
    const user = (request as any).user
    await db.query(`DELETE FROM notifications WHERE user_id = $1`, [user.id])
    return { success: true }
  })

  server.post('/broadcast', { onRequest: [requireAdmin] }, async (request) => {    const { subject, message } = request.body as any
    await notifyAllUsers('app_news', subject, message)
    return { success: true }
  })
}