"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.votesRoutes = votesRoutes;
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
async function votesRoutes(server) {
    server.post('/', { onRequest: [auth_1.requireVerified] }, async (request, reply) => {
        const { politician_id, type } = request.body;
        const user = request.user;
        try {
            const { rows } = await client_1.db.query(`INSERT INTO votes (politician_id, user_id, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (politician_id, user_id)
         DO UPDATE SET type = $3
         RETURNING *`, [politician_id, user.id, type]);
            return rows[0];
        }
        catch (err) {
            throw err;
        }
    });
    server.get('/:politicianId', async (request) => {
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT 
        COUNT(*) FILTER (WHERE type = 'up') as upvotes,
        COUNT(*) FILTER (WHERE type = 'down') as downvotes
       FROM votes WHERE politician_id = $1`, [politicianId]);
        return rows[0];
    });
}
