import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { optionalAuth, requireVerified } from '../middleware/auth'
import { recalculateScore } from '../services/score'

export async function ratingAggregate(politicianId: string) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n, ROUND(AVG(score))::int AS average,
            COUNT(*) FILTER (WHERE score < 25)::int AS b0, COUNT(*) FILTER (WHERE score >= 25 AND score < 50)::int AS b1,
            COUNT(*) FILTER (WHERE score >= 50 AND score < 75)::int AS b2, COUNT(*) FILTER (WHERE score >= 75)::int AS b3
     FROM ratings WHERE politician_id = $1`, [politicianId]
  )
  const r = rows[0]
  return { n: r.n, average: r.n ? r.average : null, bins: [r.b0, r.b1, r.b2, r.b3] }
}

// Mounted under /politicians
export async function ratingRoutes(server: FastifyInstance) {
  server.get('/:id/rating', { onRequest: [optionalAuth] }, async (request) => {
    const { id } = request.params as { id: string }
    const viewer = (request as any).user
    const agg = await ratingAggregate(id)
    let mine: number | null = null
    if (viewer) {
      const { rows } = await db.query('SELECT score FROM ratings WHERE politician_id = $1 AND user_id = $2', [id, viewer.id])
      mine = rows[0]?.score ?? null
    }
    const { rows: comp } = await db.query('SELECT score_components, truth_score FROM politicians WHERE id = $1', [id])
    return { ...agg, mine, components: comp[0]?.score_components || {}, truth_score: comp[0]?.truth_score == null ? null : Number(comp[0].truth_score) }
  })

  server.post('/:id/rating', { onRequest: [requireVerified] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const score = Number((request.body as any)?.score)
    if (!Number.isInteger(score) || score < 0 || score > 100) return reply.status(400).send({ error: 'Rating must be a whole number from 0 to 100.' })
    const { rows: leader } = await db.query('SELECT id FROM politicians WHERE id = $1', [id])
    if (!leader.length) return reply.status(404).send({ error: 'No such leader.' })
    await db.query(
      `INSERT INTO ratings (politician_id, user_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (politician_id, user_id) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()`,
      [id, user.id, score]
    )
    const result = await recalculateScore(id)
    return { mine: score, ...(await ratingAggregate(id)), truth_score: result?.score ?? null }
  })

  server.delete('/:id/rating', { onRequest: [requireVerified] }, async (request) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    await db.query('DELETE FROM ratings WHERE politician_id = $1 AND user_id = $2', [id, user.id])
    const result = await recalculateScore(id)
    return { mine: null, ...(await ratingAggregate(id)), truth_score: result?.score ?? null }
  })
}
