import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import bcrypt from 'bcrypt'
import { sendWelcomeEmail } from '../services/email'

export async function authRoutes(server: FastifyInstance) {

  server.post('/register', async (request, reply) => {
    const { email, username, password } = request.body as any
    const password_hash = await bcrypt.hash(password, 10)

    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, username, password_hash)
         VALUES ($1, $2, $3) RETURNING id, email, username, is_admin`,
        [email, username, password_hash]
      )

      const token = (server as any).jwt.sign({
        id: rows[0].id,
        username: rows[0].username,
        is_admin: false
      })

      await sendWelcomeEmail(email, username)

      return reply.status(201).send({ user: rows[0], token })
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(400).send({ error: 'Email or username already taken' })
      }
      throw err
    }
  })

  server.post('/login', async (request, reply) => {
    const { email, password } = request.body as any
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (rows.length === 0) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, rows[0].password_hash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const token = (server as any).jwt.sign({
      id: rows[0].id,
      username: rows[0].username,
      is_admin: rows[0].is_admin
    })

    return {
      user: {
        id: rows[0].id,
        email: rows[0].email,
        username: rows[0].username,
        is_admin: rows[0].is_admin
      },
      token
    }
  })

  server.patch('/username', { onRequest: [(server as any).authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const { username } = request.body as any
    try {
      const { rows } = await db.query(
        `UPDATE users SET username = $1 WHERE id = $2 RETURNING id, email, username`,
        [username, user.id]
      )
      return rows[0]
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(400).send({ error: 'Username already taken' })
      }
      throw err
    }
  })

  server.get('/me', { onRequest: [(server as any).authenticate] }, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT id, email, username, is_admin, email_notifications,
       notif_comment_replies, notif_politician_updates, notif_app_news
       FROM users WHERE id = $1`,
      [user.id]
    )
    return rows[0]
  })

  server.patch('/notif-prefs', { onRequest: [(server as any).authenticate] }, async (request) => {
    const user = (request as any).user
    const { email_notifications, notif_comment_replies, notif_politician_updates, notif_app_news } = request.body as any
    const { rows } = await db.query(
      `UPDATE users SET
        email_notifications = COALESCE($1, email_notifications),
        notif_comment_replies = COALESCE($2, notif_comment_replies),
        notif_politician_updates = COALESCE($3, notif_politician_updates),
        notif_app_news = COALESCE($4, notif_app_news)
       WHERE id = $5 RETURNING email_notifications, notif_comment_replies, notif_politician_updates, notif_app_news`,
      [email_notifications ?? null, notif_comment_replies ?? null, notif_politician_updates ?? null, notif_app_news ?? null, user.id]
    )
    return rows[0]
  })
}