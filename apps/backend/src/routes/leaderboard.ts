import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

const LEADER_COLS = 'p.id, p.name, p.party, p.region, p.position, p.country, p.category, p.rating_avg, p.rating_count, p.photo_url'

export async function leaderboardRoutes(server: FastifyInstance) {
  const rated = (dir: 'ASC' | 'DESC') => async (request: any) => {
    const limit = Math.min(100, Number(request.query.limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS}
       FROM politicians p
       WHERE p.rating_avg IS NOT NULL AND p.wikidata_id IS NOT NULL
       ORDER BY p.rating_avg ${dir}, p.rating_count DESC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows
  }
  server.get('/lowest', rated('ASC'))
  server.get('/highest', rated('DESC'))
  server.get('/condemned', rated('ASC')) // legacy alias

  server.get('/watched', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS}, p.attention
       FROM politicians p
       WHERE p.attention > 0 AND p.wikidata_id IS NOT NULL
       ORDER BY p.attention DESC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows
  })

  server.get('/discussed', async (request) => {
    const limit = Math.min(100, Number((request.query as any).limit) || 25)
    const { rows } = await db.query(
      `SELECT ${LEADER_COLS},
              ((SELECT COUNT(*) FROM threads t WHERE t.politician_id = p.id AND t.status = 'active' AND t.created_at > NOW() - INTERVAL '7 days')
               + (SELECT COUNT(*) FROM thread_posts tp JOIN threads t ON t.id = tp.thread_id WHERE t.politician_id = p.id AND tp.created_at > NOW() - INTERVAL '7 days'))::int AS comments_week,
              (SELECT COUNT(*) FROM ratings r WHERE r.politician_id = p.id AND r.updated_at > NOW() - INTERVAL '7 days')::int AS verdicts_week
       FROM politicians p
       WHERE p.wikidata_id IS NOT NULL
       ORDER BY (
         (SELECT COUNT(*) FROM threads t WHERE t.politician_id = p.id AND t.status = 'active' AND t.created_at > NOW() - INTERVAL '7 days') +
         (SELECT COUNT(*) FROM thread_posts tp JOIN threads t ON t.id = tp.thread_id WHERE t.politician_id = p.id AND tp.created_at > NOW() - INTERVAL '7 days') +
         (SELECT COUNT(*) FROM ratings r WHERE r.politician_id = p.id AND r.updated_at > NOW() - INTERVAL '7 days')
       ) DESC, p.name ASC
       LIMIT $1`,
      [limit]
    )
    return rows
      .map(r => ({ ...r, activity: r.comments_week + r.verdicts_week }))
      .filter(r => r.activity > 0)
  })
}
