"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.influenceRoutes = influenceRoutes;
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
async function influenceRoutes(server) {
    const auth = { onRequest: [auth_1.authenticate] };
    server.get('/:politicianId', async (request) => {
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT * FROM foreign_influence WHERE politician_id = $1 ORDER BY influence_score DESC`, [politicianId]);
        return rows;
    });
    server.post('/', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { politician_id, country, country_code, influence_score, notes } = request.body;
        const { rows } = await client_1.db.query(`INSERT INTO foreign_influence (politician_id, country, country_code, influence_score, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (politician_id, country) DO UPDATE SET influence_score=$4, notes=$5
       RETURNING *`, [politician_id, country, country_code || null, Number(influence_score), notes || null]);
        return reply.status(201).send(rows[0]);
    });
    server.delete('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        await client_1.db.query('DELETE FROM foreign_influence WHERE id = $1', [id]);
        return { success: true };
    });
}
