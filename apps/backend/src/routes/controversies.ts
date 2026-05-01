import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { notifyPoliticianUpdate } from '../services/notify'

export async function controversiesRoutes(server: FastifyInstance) {
  const auth = { onRequest: [(server as any).authenticate] }

  server.get('/:politicianId', async (request) => {
    const { politicianId } = request.params as { politicianId: string }
    const { rows } = await db.query(
      `SELECT * FROM controversies WHERE politician_id = $1 ORDER BY created_at DESC`,
      [politicianId]
    )
    return rows
  })

  server.post('/', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { politician_id, title, description, source_url, level } = request.body as any
    const { rows } = await db.query(
      `INSERT INTO controversies (politician_id, title, description, source_url, level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [politician_id, title, description, source_url || null, level]
    )

    const { rows: politicianRows } = await db.query(
      'SELECT name FROM politicians WHERE id = $1',
      [politician_id]
    )
    const politicianName = politicianRows[0]?.name || 'a politician'

    await notifyPoliticianUpdate(politician_id, politicianName, [`new controversy added: "${title}"`])

    return reply.status(201).send(rows[0])
  })

  server.put('/:id', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const { title, description, source_url, level } = request.body as any

    const { rows: existing } = await db.query(
      'SELECT * FROM controversies WHERE id = $1',
      [id]
    )
    const prev = existing[0]

    const { rows } = await db.query(
      `UPDATE controversies SET title=$1, description=$2, source_url=$3, level=$4
       WHERE id=$5 RETURNING *`,
      [title, description, source_url || null, level, id]
    )

    const { rows: politicianRows } = await db.query(
      'SELECT name FROM politicians WHERE id = $1',
      [prev.politician_id]
    )
    const politicianName = politicianRows[0]?.name || 'a politician'

    const changes: string[] = []
    if (prev.title !== title) changes.push(`controversy renamed to "${title}"`)
    if (prev.level !== level) changes.push(`"${title}" level changed to ${level}`)

    if (changes.length > 0) {
      await notifyPoliticianUpdate(prev.politician_id, politicianName, changes)
    }

    return rows[0]
  })

  server.delete('/:id', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    await db.query('DELETE FROM controversies WHERE id = $1', [id])
    return { success: true }
  })
}