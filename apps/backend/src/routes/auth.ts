import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import bcrypt from 'bcrypt'


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
        is_admin: rows[0].is_admin
      })
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

    const token = server.jwt.sign({
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
}