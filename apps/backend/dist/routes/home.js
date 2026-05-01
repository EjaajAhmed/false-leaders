"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeRoutes = homeRoutes;
const client_1 = require("../db/client");
async function homeRoutes(server) {
    server.get('/leaderboard', async () => {
        const { rows } = await client_1.db.query(`
      SELECT 
        p.id,
        p.name,
        p.party,
        p.region,
        p.position,
        COUNT(*) FILTER (WHERE v.type = 'up') AS upvotes,
        COUNT(*) FILTER (WHERE v.type = 'down') AS downvotes,
        COUNT(*) FILTER (WHERE v.type = 'up') - COUNT(*) FILTER (WHERE v.type = 'down') AS score
      FROM politicians p
      LEFT JOIN votes v ON v.politician_id = p.id
      GROUP BY p.id
      ORDER BY score DESC
      LIMIT 10
    `);
        return rows;
    });
    server.get('/recent', async () => {
        const { rows } = await client_1.db.query(`
      SELECT 
        p.id,
        p.name,
        p.party,
        p.region,
        p.position,
        p.created_at,
        COUNT(c.id) AS comment_count
      FROM politicians p
      LEFT JOIN comments c ON c.politician_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `);
        return rows;
    });
}
