import { authenticate } from '../middleware/auth'
import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { notifyPoliticianUpdate } from '../services/notify'

export async function politiciansRoutes(server: FastifyInstance) {
  const auth = { onRequest: [authenticate] }

  server.get('/', async (request) => {
    const { search, country, party, min_age, max_age, min_truth, max_truth, page, limit } = request.query as any

    const pageNum = Number(page) || 1
    const limitNum = Number(limit) || 20
    const offset = (pageNum - 1) * limitNum

    let baseQuery = `FROM politicians WHERE 1=1`
    const params: any[] = []
    let i = 1

    if (search) {
      baseQuery += ` AND (name ILIKE $${i} OR party ILIKE $${i} OR region ILIKE $${i} OR position ILIKE $${i})`
      params.push(`%${search}%`)
      i++
    }
    if (country) {
      baseQuery += ` AND country ILIKE $${i}`
      params.push(`%${country}%`)
      i++
    }
    if (party) {
      baseQuery += ` AND party ILIKE $${i}`
      params.push(`%${party}%`)
      i++
    }
    if (min_age) {
      baseQuery += ` AND age >= $${i}`
      params.push(Number(min_age))
      i++
    }
    if (max_age) {
      baseQuery += ` AND age <= $${i}`
      params.push(Number(max_age))
      i++
    }
    if (min_truth) {
      baseQuery += ` AND truth_score >= $${i}`
      params.push(Number(min_truth))
      i++
    }
    if (max_truth) {
      baseQuery += ` AND truth_score <= $${i}`
      params.push(Number(max_truth))
      i++
    }

    const countResult = await db.query(`SELECT COUNT(*) ${baseQuery}`, params)
    const total = Number(countResult.rows[0].count)

    const dataParams = [...params, limitNum, offset]
    const { rows } = await db.query(
      `SELECT * ${baseQuery} ORDER BY name ASC LIMIT $${i} OFFSET $${i + 1}`,
      dataParams
    )

    return {
      politicians: rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: offset + rows.length < total
    }
  })

  server.get('/meta', async () => {
    const { rows: countries } = await db.query(`SELECT DISTINCT country FROM politicians WHERE country IS NOT NULL ORDER BY country`)
    const { rows: parties } = await db.query(`SELECT DISTINCT party FROM politicians WHERE party IS NOT NULL ORDER BY party`)
    return {
      countries: countries.map(r => r.country),
      parties: parties.map(r => r.party)
    }
  })

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('SELECT * FROM politicians WHERE id = $1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' })

    const politician = rows[0]

    // Get config
    const { rows: config } = await db.query('SELECT key, value FROM truth_score_config')
    const cfg: Record<string, number> = {}
    for (const c of config) cfg[c.key] = Number(c.value)

    // Get controversies
    const { rows: controversies } = await db.query(
      'SELECT level FROM controversies WHERE politician_id = $1',
      [id]
    )

    // Get funding
    const { rows: funding } = await db.query(
      'SELECT source_type, amount FROM funding_sources WHERE politician_id = $1',
      [id]
    )

    // Get foreign influence
    const { rows: influence } = await db.query(
      'SELECT influence_score FROM foreign_influence WHERE politician_id = $1',
      [id]
    )

    // Calculate score
    const baseScore = cfg.base_score ?? 90
    let score = baseScore

    // Deduct for controversies
    for (const c of controversies) {
      const weight = cfg[`weight_${c.level}`] ?? 0
      score -= weight
    }

    // Deduct for corporate funding
    if (funding.length > 0) {
      const totalFunding = funding.reduce((sum: number, f: any) => sum + Number(f.amount), 0)
      const corporate = funding
        .filter((f: any) => ['Corporate', 'PAC'].includes(f.source_type))
        .reduce((sum: number, f: any) => sum + Number(f.amount), 0)
      const corporatePct = totalFunding > 0 ? (corporate / totalFunding) * 100 : 0
      if (corporatePct > (cfg.funding_corporate_threshold ?? 60)) {
        score -= cfg.funding_corporate_penalty ?? 10
      }
    }

    // Deduct for foreign influence
    for (const inf of influence) {
      if (Number(inf.influence_score) > (cfg.funding_foreign_threshold ?? 60)) {
        score -= cfg.funding_foreign_penalty ?? 10
      }
    }

    score = Math.max(1, Math.min(100, Math.round(score)))

    // Update stored truth_score
    await db.query('UPDATE politicians SET truth_score = $1 WHERE id = $2', [score, id])

    return { ...politician, truth_score: score }
  })

  server.post('/', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { name, party, region, position, bio, country, age, latitude, longitude } = request.body as any
    const { rows } = await db.query(
      `INSERT INTO politicians (name, party, region, position, bio, country, age, truth_score, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name, party, region, position, bio || null,
        country || 'Canada',
        age ? Number(age) : null,
        90,
        latitude ? Number(latitude) : null,
        longitude ? Number(longitude) : null
      ]
    )
    return reply.status(201).send(rows[0])
  })

  server.put('/:id', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    const { name, party, region, position, bio, country, age, latitude, longitude, photo_url } = request.body as any

    const { rows: existing } = await db.query('SELECT * FROM politicians WHERE id = $1', [id])
    const prev = existing[0]

    const { rows } = await db.query(
      `UPDATE politicians SET
        name=$1, party=$2, region=$3, position=$4, bio=$5,
        country=$6, age=$7, latitude=$8, longitude=$9, photo_url=$10
       WHERE id=$11 RETURNING *`,
      [
        name, party, region, position, bio || null,
        country || 'Canada',
        age ? Number(age) : null,
        latitude ? Number(latitude) : null,
        longitude ? Number(longitude) : null,
        photo_url || null,
        id
      ]
    )

    const updated = rows[0]
    const changes: string[] = []

    if (prev.position !== updated.position) changes.push(`position updated to "${updated.position}"`)
    if (prev.party !== updated.party) changes.push(`party changed to ${updated.party}`)

    if (changes.length > 0) {
      await notifyPoliticianUpdate(id, updated.name, changes)
    }

    return updated
  })

  server.delete('/:id', auth, async (request, reply) => {
    const user = (request as any).user
    if (!user?.is_admin) return reply.status(403).send({ error: 'Forbidden' })

    const { id } = request.params as { id: string }
    await db.query('DELETE FROM politicians WHERE id = $1', [id])
    return { success: true }
  })
}