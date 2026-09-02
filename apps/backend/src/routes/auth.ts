import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { authenticate } from '../middleware/auth'
import { sendWelcomeEmail } from '../services/email'

function publicUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    prole_number: row.prole_number,
    is_admin: !!row.is_admin,
    email_verified: !!row.email_verified,
  }
}

function signToken(server: any, row: any) {
  return server.jwt.sign({
    id: row.id,
    username: row.username,
    prole_number: row.prole_number,
    is_admin: !!row.is_admin,
    email_verified: !!row.email_verified,
  })
}

export async function authRoutes(server: FastifyInstance) {
  server.post('/register', async (request, reply) => {
    const { email, username, password } = request.body as any
    if (!email || !username || !password) return reply.status(400).send({ error: 'All fields required.' })
    if (String(password).length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters.' })
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(String(username))) {
      return reply.status(400).send({ error: 'Username: 3-24 characters, letters, numbers, _ . - only.' })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const verification_token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, username, password_hash, email_verified, verification_token, verification_token_expires)
         VALUES ($1, $2, $3, false, $4, $5) RETURNING id, email, username, prole_number`,
        [String(email).trim().toLowerCase(), username, password_hash, verification_token, expires]
      )
      await sendWelcomeEmail(rows[0].email, username, verification_token)
      return reply.status(201).send({ pending: true, email: rows[0].email, prole_number: rows[0].prole_number })
    } catch (err: any) {
      if (err.code === '23505') return reply.status(400).send({ error: 'Email or username already taken.' })
      throw err
    }
  })

  server.post('/login', async (request, reply) => {
    const { email, password } = request.body as any
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()])
    if (rows.length === 0) return reply.status(401).send({ error: 'Invalid credentials.' })

    const valid = await bcrypt.compare(String(password || ''), rows[0].password_hash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials.' })

    return { user: publicUser(rows[0]), token: signToken(server, rows[0]) }
  })

  server.get('/verify/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const { rows } = await db.query(
      `SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()`,
      [token]
    )
    if (rows.length === 0) return reply.redirect(`${process.env.FRONTEND_URL}/verified?error=invalid`)

    await db.query(
      `UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
      [rows[0].id]
    )
    const jwtToken = signToken(server, { ...rows[0], email_verified: true })
    return reply.redirect(`${process.env.FRONTEND_URL}/verified?token=${jwtToken}&username=${encodeURIComponent(rows[0].username)}`)
  })

  server.post('/resend-verification', { onRequest: [authenticate] }, async (request) => {
    const user = (request as any).user
    const verification_token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const { rows } = await db.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3 RETURNING email, username`,
      [verification_token, expires, user.id]
    )
    await sendWelcomeEmail(rows[0].email, rows[0].username, verification_token)
    return { success: true }
  })

  server.patch('/username', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const { username } = request.body as any
    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(String(username || ''))) {
      return reply.status(400).send({ error: 'Username: 3-24 characters, letters, numbers, _ . - only.' })
    }
    try {
      const { rows } = await db.query(
        `UPDATE users SET username = $1 WHERE id = $2 RETURNING *`,
        [username, user.id]
      )
      return { ...publicUser(rows[0]), token: signToken(server, rows[0]) }
    } catch (err: any) {
      if (err.code === '23505') return reply.status(400).send({ error: 'Username already taken.' })
      throw err
    }
  })

  server.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const { rows } = await db.query(
      `SELECT id, email, username, prole_number, is_admin, email_verified, created_at,
              email_notifications, notif_comment_replies, notif_politician_updates, notif_app_news
       FROM users WHERE id = $1`,
      [user.id]
    )
    if (rows.length === 0) return reply.status(401).send({ error: 'Access denied.' })
    const row = rows[0]
    // Re-issue a token so stale sessions pick up prole_number / verification / admin changes.
    return { ...row, is_admin: !!row.is_admin, email_verified: !!row.email_verified, token: signToken(server, row) }
  })

  // Own activity: verdicts, leaks (as Prole), bookmarks
  server.get('/me/activity', { onRequest: [authenticate] }, async (request) => {
    const user = (request as any).user
    const [{ rows: verdicts }, { rows: leaks }, { rows: bookmarks }, { rows: proposals }] = await Promise.all([
      db.query(
        `SELECT v.id, v.verdict, v.body, v.is_anonymous, v.upvotes, v.updated_at, p.id AS leader_id, p.name AS leader_name
         FROM verdicts v JOIN politicians p ON p.id = v.politician_id
         WHERE v.user_id = $1 ORDER BY v.updated_at DESC LIMIT 100`,
        [user.id]
      ),
      db.query(
        `SELECT l.id, l.body, l.upvotes, l.status, l.created_at, p.id AS leader_id, p.name AS leader_name
         FROM leaks l JOIN politicians p ON p.id = l.politician_id
         WHERE l.user_id = $1 ORDER BY l.created_at DESC LIMIT 100`,
        [user.id]
      ),
      db.query(
        `SELECT b.id, b.created_at, b.graft_id, g.name AS graft_name,
                p.id AS leader_id, p.name AS leader_name, p.position, p.truth_score
         FROM bookmarks b JOIN politicians p ON p.id = b.politician_id
         LEFT JOIN grafts g ON g.id = b.graft_id
         WHERE b.user_id = $1 ORDER BY b.created_at DESC LIMIT 200`,
        [user.id]
      ),
      db.query(
        `SELECT cp.id, cp.title, cp.level, cp.status, cp.created_at, p.id AS leader_id, p.name AS leader_name
         FROM controversy_proposals cp JOIN politicians p ON p.id = cp.politician_id
         WHERE cp.user_id = $1 ORDER BY cp.created_at DESC LIMIT 100`,
        [user.id]
      ),
    ])
    return { verdicts, leaks, bookmarks, proposals }
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
