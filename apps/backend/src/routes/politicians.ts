import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { authenticate, requireAdmin } from '../middleware/auth'
import { notifyPoliticianUpdate } from '../services/notify'
import { loadScoreConfig, recalculateScore } from '../services/score'
import { getVerdictAggregate } from '../services/verdicts'
import { enrichLeader, getHeadlines } from '../services/enrich'

export const CATEGORIES = ['world_leader', 'politician', 'business', 'media', 'judiciary', 'religious', 'international', 'military', 'other']

const VERDICT_JSON = `
  (SELECT json_build_object(
     'total', COUNT(*),
     'guilty', COUNT(*) FILTER (WHERE verdict = 'guilty'),
     'suspicious', COUNT(*) FILTER (WHERE verdict = 'suspicious'),
     'unclear', COUNT(*) FILTER (WHERE verdict = 'unclear'),
     'clean', COUNT(*) FILTER (WHERE verdict = 'clean')
   ) FROM verdicts v WHERE v.politician_id = p.id) AS verdict_counts`

const TOP_CONTROVERSY_JSON = `
  (SELECT json_build_object('id', c.id, 'title', c.title, 'level', c.level)
   FROM controversies c WHERE c.politician_id = p.id
   ORDER BY CASE c.level WHEN 'confirmed' THEN 0 WHEN 'likely' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END,
            c.upvotes DESC, c.created_at DESC
   LIMIT 1) AS top_controversy`

export const FIGURE_CATEGORIES = CATEGORIES.filter(c => c !== 'world_leader' && c !== 'politician')
export const MAIN_VIEW_FIGURES = 50

/** SQL fragment (no params) selecting the "main view": world leaders + top figures by prominence. */
export const MAIN_VIEW_SQL = `(
  p.category = 'world_leader' OR p.id IN (
    SELECT id FROM politicians
    WHERE category NOT IN ('world_leader', 'politician')
    ORDER BY prominence DESC, name ASC
    LIMIT ${MAIN_VIEW_FIGURES}
  )
)`

export function viewCondition(view: string | undefined): string | null {
  switch (view) {
    case 'main': return MAIN_VIEW_SQL
    case 'world_leader': return `p.category = 'world_leader'`
    case 'figures': return `p.category NOT IN ('world_leader', 'politician')`
    case 'politician': return `p.category = 'politician'`
    default: return null
  }
}

const CARD_COLUMNS = `
  p.id, p.name, p.party, p.region, p.position, p.country, p.category, p.prominence, p.age, p.bio, p.photo_url,
  p.attention, p.wiki_url, p.aliases, p.truth_score, p.latitude, p.longitude, p.created_at,
  (SELECT COUNT(*) FROM controversies c WHERE c.politician_id = p.id)::int AS controversy_count,
  (SELECT COUNT(*) FROM leaks l WHERE l.politician_id = p.id AND l.status IN ('visible', 'escalated'))::int AS leak_count,
  ${VERDICT_JSON},
  ${TOP_CONTROVERSY_JSON}`

function parseAliases(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(a => String(a).trim()).filter(Boolean)
  if (typeof input === 'string') return input.split(',').map(a => a.trim()).filter(Boolean)
  return []
}

export async function politiciansRoutes(server: FastifyInstance) {
  const admin = { onRequest: [requireAdmin] }

  server.get('/', async (request) => {
    const { search, country, party, position, category, view, min_age, max_age, min_truth, max_truth, page, limit, sort } = request.query as any

    const pageNum = Math.max(1, Number(page) || 1)
    const limitNum = Math.min(1000, Math.max(1, Number(limit) || 20))
    const offset = (pageNum - 1) * limitNum

    let where = `FROM politicians p WHERE 1=1`
    const params: any[] = []
    let i = 1

    if (search) {
      where += ` AND (p.name ILIKE $${i} OR p.party ILIKE $${i} OR p.region ILIKE $${i} OR p.position ILIKE $${i} OR array_to_string(p.aliases, ' ') ILIKE $${i})`
      params.push(`%${search}%`)
      i++
    }
    if (country) { where += ` AND p.country ILIKE $${i}`; params.push(`%${country}%`); i++ }
    if (party) { where += ` AND p.party ILIKE $${i}`; params.push(`%${party}%`); i++ }
    if (position) { where += ` AND p.position ILIKE $${i}`; params.push(`%${position}%`); i++ }
    if (category && CATEGORIES.includes(category)) { where += ` AND p.category = $${i}`; params.push(category); i++ }
    const viewSql = viewCondition(view)
    if (viewSql) where += ` AND ${viewSql}`
    if (min_age) { where += ` AND p.age >= $${i}`; params.push(Number(min_age)); i++ }
    if (max_age) { where += ` AND p.age <= $${i}`; params.push(Number(max_age)); i++ }
    if (min_truth) { where += ` AND p.truth_score >= $${i}`; params.push(Number(min_truth)); i++ }
    if (max_truth) { where += ` AND p.truth_score <= $${i}`; params.push(Number(max_truth)); i++ }

    const orderBy = {
      name: 'p.name ASC',
      score_asc: 'p.truth_score ASC NULLS LAST, p.name ASC',
      score_desc: 'p.truth_score DESC NULLS LAST, p.name ASC',
      newest: 'p.created_at DESC',
      prominence: 'p.prominence DESC, p.truth_score ASC NULLS LAST, p.name ASC',
    }[String(sort) as 'name'] || 'p.name ASC'

    const countResult = await db.query(`SELECT COUNT(*) ${where}`, params)
    const total = Number(countResult.rows[0].count)

    const { rows } = await db.query(
      `SELECT ${CARD_COLUMNS} ${where} ORDER BY ${orderBy} LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limitNum, offset]
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
    const [{ rows: countries }, { rows: parties }, { rows: positions }, { rows: categories }] = await Promise.all([
      db.query(`SELECT DISTINCT country FROM politicians WHERE country IS NOT NULL AND country <> '' ORDER BY country`),
      db.query(`SELECT DISTINCT party FROM politicians WHERE party IS NOT NULL AND party <> '' ORDER BY party`),
      db.query(`SELECT DISTINCT position FROM politicians WHERE position IS NOT NULL AND position <> '' ORDER BY position`),
      db.query(`SELECT category, COUNT(*)::int AS count FROM politicians GROUP BY category`),
    ])
    return {
      countries: countries.map(r => r.country),
      parties: parties.map(r => r.party),
      positions: positions.map(r => r.position),
      categories: CATEGORIES.map(c => ({ key: c, count: categories.find(r => r.category === c)?.count || 0 })),
    }
  })

  // Lightweight rows for the map. view: main | world_leader | figures | politician | all
  server.get('/map', async (request) => {
    const { view, country } = request.query as any
    const params: any[] = []
    let where = 'WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL'
    const viewSql = viewCondition(view || 'main')
    if (viewSql) where += ` AND ${viewSql}`
    if (country) { params.push(`%${country}%`); where += ` AND p.country ILIKE $${params.length}` }
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.position, p.party, p.country, p.category, p.prominence, p.truth_score, p.latitude, p.longitude,
              p.photo_url, p.attention, LEFT(p.bio, 140) AS bio,
              ${VERDICT_JSON}
       FROM politicians p ${where}
       ORDER BY p.prominence DESC, p.name ASC
       LIMIT 2000`,
      params
    )
    return rows
  })

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('SELECT * FROM politicians WHERE id = $1', [id])
    if (rows.length === 0) return reply.status(404).send({ error: 'No such leader.' })

    const result = await recalculateScore(id)
    const score = result?.score ?? Math.round(Number(rows[0].truth_score ?? 90))

    const [{ rows: fresh }, verdicts, { rows: counts }] = await Promise.all([
      db.query('SELECT score_history FROM politicians WHERE id = $1', [id]),
      getVerdictAggregate(id),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM controversies WHERE politician_id = $1)::int AS controversies,
           (SELECT COUNT(*) FROM verdicts WHERE politician_id = $1)::int AS verdicts,
           (SELECT COUNT(*) FROM leaks WHERE politician_id = $1 AND status IN ('visible', 'escalated'))::int AS leaks,
           (SELECT COUNT(*) FROM comments WHERE politician_id = $1)::int AS comments`,
        [id]
      ),
    ])

    const history: { d: string; s: number }[] = Array.isArray(fresh[0]?.score_history) ? fresh[0].score_history : []
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    return {
      ...rows[0],
      truth_score: score,
      score_history: history.filter(p => p.d >= cutoff),
      verdicts,
      stats: counts[0],
    }
  })

  // Recent headlines (GDELT), cached server-side
  server.get('/:id/news', async (request) => {
    const { id } = request.params as { id: string }
    return getHeadlines(id)
  })

  // Re-run Wikipedia/Wikidata enrichment for one leader
  server.post('/:id/enrich', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const result = await enrichLeader(id, { force: true })
    if (!result.matched) return reply.status(404).send({ error: 'No Wikipedia match found.' })
    return result
  })

  server.post('/', admin, async (request, reply) => {
    const { name, party, region, position, bio, country, category, prominence, age, latitude, longitude, photo_url, aliases } = request.body as any
    if (!name || !String(name).trim()) return reply.status(400).send({ error: 'Name required.' })

    const { rows } = await db.query(
      `INSERT INTO politicians (name, party, region, position, bio, country, category, prominence, age, latitude, longitude, photo_url, aliases, truth_score, score_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 90, '[]') RETURNING *`,
      [
        String(name).trim(), party || null, region || null, position || null, bio || null,
        country || null,
        CATEGORIES.includes(category) ? category : 'politician',
        prominence != null && prominence !== '' ? Number(prominence) : (category === 'world_leader' ? 50 : 0),
        age ? Number(age) : null,
        latitude ? Number(latitude) : null,
        longitude ? Number(longitude) : null,
        photo_url || null,
        parseAliases(aliases),
      ]
    )
    await recalculateScore(rows[0].id)
    enrichLeader(rows[0].id).catch(() => undefined)
    return reply.status(201).send(rows[0])
  })

  server.post('/recalculate-all', admin, async () => {
    const cfg = await loadScoreConfig()
    const { rows: all } = await db.query('SELECT id FROM politicians')
    let updated = 0
    let changed = 0
    for (const p of all) {
      const r = await recalculateScore(p.id, cfg)
      if (r) { updated++; if (r.changed) changed++ }
    }
    return { success: true, updated, changed }
  })

  server.put('/:id', admin, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name, party, region, position, bio, country, category, prominence, age, latitude, longitude, photo_url, aliases } = request.body as any

    const { rows: existing } = await db.query('SELECT * FROM politicians WHERE id = $1', [id])
    if (existing.length === 0) return reply.status(404).send({ error: 'No such leader.' })
    const prev = existing[0]

    const { rows } = await db.query(
      `UPDATE politicians SET
        name=$1, party=$2, region=$3, position=$4, bio=$5,
        country=$6, category=$7, age=$8, latitude=$9, longitude=$10, photo_url=$11, aliases=$12, prominence=$14
       WHERE id=$13 RETURNING *`,
      [
        name, party || null, region || null, position || null, bio || null,
        country || null,
        CATEGORIES.includes(category) ? category : prev.category,
        age ? Number(age) : null,
        latitude ? Number(latitude) : null,
        longitude ? Number(longitude) : null,
        photo_url || null,
        aliases === undefined ? prev.aliases : parseAliases(aliases),
        id,
        prominence != null && prominence !== '' ? Number(prominence) : prev.prominence,
      ]
    )

    const updated = rows[0]
    const changes: string[] = []
    if (prev.position !== updated.position) changes.push(`position updated to "${updated.position}"`)
    if (prev.party !== updated.party) changes.push(`party changed to ${updated.party}`)
    if (changes.length > 0) await notifyPoliticianUpdate(id, updated.name, changes)

    return updated
  })

  server.delete('/:id', admin, async (request) => {
    const { id } = request.params as { id: string }
    await db.query('DELETE FROM politicians WHERE id = $1', [id])
    return { success: true }
  })

  // Kept for backwards compatibility with older clients.
  server.get('/:id/score', { onRequest: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string }
    const r = await recalculateScore(id)
    return { truth_score: r?.score ?? null }
  })
}
