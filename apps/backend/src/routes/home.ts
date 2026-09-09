import { FastifyInstance } from 'fastify'
import { db } from '../db/client'

export async function homeRoutes(server: FastifyInstance) {
  server.get('/stats', async () => {
    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM politicians)::int AS leaders,
        (SELECT COUNT(*) FROM controversies)::int AS controversies,
        (SELECT COUNT(*) FROM ratings)::int AS ratings,
        (SELECT COUNT(*) FROM threads WHERE status = 'active')::int AS threads,
        (SELECT COUNT(*) FROM threads WHERE kind = 'leak' AND status = 'active')::int AS leaks,
        (SELECT COUNT(*) FROM users)::int AS proles
    `)
    return rows[0]
  })

  // Leaders with the most activity in the last 7 days.
  server.get('/featured', async () => {
    const { rows } = await db.query(`
      SELECT p.id, p.name, p.party, p.region, p.position, p.country, p.category, p.prominence, p.rating_avg, p.rating_count, p.photo_url, p.attention,
        (SELECT COUNT(*) FROM controversies c WHERE c.politician_id = p.id)::int AS controversy_count,
        (SELECT COUNT(*) FROM threads t WHERE t.politician_id = p.id AND t.kind = 'leak' AND t.status = 'active')::int AS leak_count,
        (SELECT json_build_object('title', c.title, 'level', c.level)
         FROM controversies c WHERE c.politician_id = p.id
         ORDER BY CASE c.level WHEN 'confirmed' THEN 0 WHEN 'likely' THEN 1 WHEN 'maybe' THEN 2 ELSE 3 END, c.upvotes DESC, c.created_at DESC
         LIMIT 1) AS top_controversy,
        json_build_object('n', p.rating_count, 'average', p.rating_avg) AS rating,
        (SELECT COUNT(*) FROM feed_events f WHERE f.leader_id = p.id AND f.created_at > NOW() - INTERVAL '7 days')::int AS activity
      FROM politicians p
      ORDER BY activity DESC, p.attention DESC, p.prominence DESC
      LIMIT 8
    `)
    return rows
  })

  // Legacy endpoints kept for older clients
  server.get('/leaderboard', async () => {
    const { rows } = await db.query(`
      SELECT p.id, p.name, p.party, p.region, p.position, p.rating_avg, p.rating_count
      FROM politicians p WHERE p.rating_avg IS NOT NULL ORDER BY p.rating_avg ASC LIMIT 10
    `)
    return rows
  })

  server.get('/recent', async () => {
    const { rows } = await db.query(`
      SELECT p.id, p.name, p.party, p.region, p.position, p.created_at,
             (SELECT COUNT(*) FROM comments c WHERE c.politician_id = p.id)::int AS comment_count
      FROM politicians p ORDER BY p.created_at DESC LIMIT 5
    `)
    return rows
  })
}
