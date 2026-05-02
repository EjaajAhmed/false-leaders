"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookmarksRoutes = bookmarksRoutes;
const client_1 = require("../db/client");
async function bookmarksRoutes(server) {
    const auth = { onRequest: [server.authenticate] };
    server.get('/', auth, async (request) => {
        const user = request.user;
        const { rows } = await client_1.db.query(`SELECT b.id, b.created_at, b.graft_id,
              p.id AS politician_id, p.name, p.party, p.region, p.position,
              g.name AS graft_name
       FROM bookmarks b
       JOIN politicians p ON p.id = b.politician_id
       LEFT JOIN grafts g ON g.id = b.graft_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`, [user.id]);
        return rows;
    });
    const verified = { onRequest: [server.requireVerified] };
    server.post('/', verified, async (request, reply) => {
        const user = request.user;
        const { politician_id, graft_id } = request.body;
        try {
            const { rows } = await client_1.db.query(`INSERT INTO bookmarks (user_id, politician_id, graft_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, politician_id, graft_id) DO NOTHING
         RETURNING *`, [user.id, politician_id, graft_id || null]);
            return reply.status(201).send(rows[0] || { already_saved: true });
        }
        catch (err) {
            throw err;
        }
    });
    server.patch('/:id/move', verified, async (request) => {
        const user = request.user;
        const { id } = request.params;
        const { graft_id } = request.body;
        const { rows } = await client_1.db.query(`UPDATE bookmarks SET graft_id = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [graft_id || null, id, user.id]);
        return rows[0];
    });
    server.delete('/:id', verified, async (request) => {
        const user = request.user;
        const { id } = request.params;
        await client_1.db.query('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [id, user.id]);
        return { success: true };
    });
    server.get('/check/:politicianId', auth, async (request) => {
        const user = request.user;
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT b.*, g.name AS graft_name FROM bookmarks b
       LEFT JOIN grafts g ON g.id = b.graft_id
       WHERE b.user_id = $1 AND b.politician_id = $2`, [user.id, politicianId]);
        return { bookmarked: rows.length > 0, bookmarks: rows };
    });
}
