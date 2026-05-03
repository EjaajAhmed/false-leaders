import { authenticate, requireVerified } from '../middleware/auth'
import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import bcrypt from 'bcrypt'
import { sendWelcomeEmail } from '../services/email'
import crypto from 'crypto'

export async function authRoutes(server: FastifyInstance) {



  server.post('/register', async (request, reply) => {
    const { email, username, password } = request.body as any
    const password_hash = await bcrypt.hash(password, 10)
    const verification_token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  
    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, username, password_hash, email_verified, verification_token, verification_token_expires)
         VALUES ($1, $2, $3, false, $4, $5) RETURNING id, email, username`,
        [email, username, password_hash, verification_token, expires]
      )
  
      await sendWelcomeEmail(email, username, verification_token)
  
      return reply.status(201).send({ pending: true, email })
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
      is_admin: rows[0].is_admin,
      email_verified: rows[0].email_verified
    })
  
    return {
      user: {
        id: rows[0].id,
        email: rows[0].email,
        username: rows[0].username,
        is_admin: rows[0].is_admin,
        email_verified: rows[0].email_verified
      },
      token
    }
  })

  server.get('/verify/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
  
    const { rows } = await db.query(
      `SELECT * FROM users WHERE verification_token = $1 
       AND verification_token_expires > NOW()`,
      [token]
    )
  
    if (rows.length === 0) {
      return reply.redirect(`${process.env.FRONTEND_URL}/verified?error=invalid`)
    }
  
    await db.query(
      `UPDATE users SET email_verified = true, verification_token = NULL, 
       verification_token_expires = NULL WHERE id = $1`,
      [rows[0].id]
    )
  
    const jwtToken = (server as any).jwt.sign({
      id: rows[0].id,
      username: rows[0].username,
      is_admin: rows[0].is_admin,
      email_verified: true
    })
  
    // Redirect with token in query param
    return reply.redirect(`${process.env.FRONTEND_URL}/verified?token=${jwtToken}&username=${rows[0].username}`)
  })
  
  server.post('/resend-verification', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const verification_token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  
    const { rows } = await db.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 
       WHERE id = $3 RETURNING email, username`,
      [verification_token, expires, user.id]
    )
  
    await sendWelcomeEmail(rows[0].email, rows[0].username, verification_token)
    return { success: true }
  })

  server.patch('/username', { onRequest: [authenticate] }, async (request, reply) => {
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

  server.get('/me', { onRequest: [authenticate] }, async (request) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT id, email, username, is_admin, email_notifications,
       notif_comment_replies, notif_politician_updates, notif_app_news
       FROM users WHERE id = $1`,
      [user.id]
    )
    return rows[0]
  })

  server.patch('/notif-prefs', { onRequest: [authenticate] }, async (request) => {
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