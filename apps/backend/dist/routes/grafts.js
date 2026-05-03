"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graftsRoutes = graftsRoutes;
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
async function graftsRoutes(server) {
    server.get('/', { onRequest: [auth_1.authenticate] }, async (request) => {
        const user = request.user;
        const { rows } = await client_1.db.query(`SELECT g.*, COUNT(b.id) AS bookmark_count
       FROM grafts g
       LEFT JOIN bookmarks b ON b.graft_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`, [user.id]);
        return rows;
    });
    server.post('/', { onRequest: [auth_1.requireVerified] }, async (request, reply) => {
        const user = request.user;
        const { name, description } = request.body;
        const { rows } = await client_1.db.query(`INSERT INTO grafts (user_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`, [user.id, name, description]);
        return reply.status(201).send(rows[0]);
    });
    server.delete('/:id', { onRequest: [auth_1.requireVerified] }, async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        await client_1.db.query('DELETE FROM grafts WHERE id = $1 AND user_id = $2', [id, user.id]);
        return { success: true };
    });
    server.get('/:id/politicians', { onRequest: [auth_1.authenticate] }, async (request) => {
        const user = request.user;
        const { id } = request.params;
        const { rows } = await client_1.db.query(`SELECT p.*, b.id AS bookmark_id, b.created_at AS bookmarked_at
       FROM bookmarks b
       JOIN politicians p ON p.id = b.politician_id
       WHERE b.graft_id = $1 AND b.user_id = $2
       ORDER BY b.created_at DESC`, [id, user.id]);
        return rows;
    });
}
