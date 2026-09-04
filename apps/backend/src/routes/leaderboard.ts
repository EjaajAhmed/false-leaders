import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { scoreDaysAgo } from '../services/score'

const LEADER_COLS = 'p.id, p.name, p.party, p.region, p.position, p.country, p.category, p.truth_score, p.photo_url'

export async function leaderboardRoutes(server: FastifyInstance) {
  server.get('/condemned', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS},
              (SELECT COUNT(*) FROM controversies c WHERE c.politician_id = p.id)::int AS controversy_count
       FROM politicians p
       WHERE p.truth_score IS NOT NULL
         AND p.truth_score < (SELECT COALESCE(MAX(value), 90) FROM truth_score_config WHERE key = 'base_score')
       ORDER BY p.truth_score ASC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows
  })

  server.get('/drop', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS}, p.score_history FROM politicians p WHERE p.score_history IS NOT NULL`
    )
    const scored = rows
      .map(r => {
        const now = Math.round(Number(r.truth_score))
        const then = scoreDaysAgo(r.score_history, 7)
        const delta = then == null ? 0 : now - then
        const { score_history, ...rest } = r
        return { ...rest, previous_score: then, delta }
      })
      .filter(r => r.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, limit)
    return scored
  })

  server.get('/discussed', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS},
              ((SELECT COUNT(*) FROM comments c WHERE c.politician_id = p.id AND c.created_at > NOW() - INTERVAL '7 days')
               + (SELECT COUNT(*) FROM threads t WHERE t.politician_id = p.id AND t.status = 'active' AND t.created_at > NOW() - INTERVAL '7 days')
               + (SELECT COUNT(*) FROM thread_posts tp JOIN threads t ON t.id = tp.thread_id WHERE t.politician_id = p.id AND tp.created_at > NOW() - INTERVAL '7 days'))::int AS comments_week,
              (SELECT COUNT(*) FROM verdicts v WHERE v.politician_id = p.id AND v.updated_at > NOW() - INTERVAL '7 days')::int AS verdicts_week
       FROM politicians p
       ORDER BY (
         (SELECT COUNT(*) FROM comments c WHERE c.politician_id = p.id AND c.created_at > NOW() - INTERVAL '7 days') +
         (SELECT COUNT(*) FROM threads t WHERE t.politician_id = p.id AND t.status = 'active' AND t.created_at > NOW() - INTERVAL '7 days') +
         (SELECT COUNT(*) FROM thread_posts tp JOIN threads t ON t.id = tp.thread_id WHERE t.politician_id = p.id AND tp.created_at > NOW() - INTERVAL '7 days') +
         (SELECT COUNT(*) FROM verdicts v WHERE v.politician_id = p.id AND v.updated_at > NOW() - INTERVAL '7 days')
       ) DESC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows
      .map(r => ({ ...r, activity: r.comments_week + r.verdicts_week }))
      .filter(r => r.activity > 0)
  })

  server.get('/watched', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS}, p.attention FROM politicians p WHERE p.attention > 0 ORDER BY p.attention DESC, p.name ASC LIMIT $1`,
      [limit]
    )
    return rows
  })

  server.get('/leaked', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS},
              (SELECT COUNT(*) FROM leaks l WHERE l.politician_id = p.id AND l.status <> 'removed')::int AS leak_count
       FROM politicians p
       ORDER BY leak_count DESC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows.filter(r => r.leak_count > 0)
  })
}
