"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundingRoutes = fundingRoutes;
const client_1 = require("../db/client");
async function fundingRoutes(server) {
    const auth = { onRequest: [server.authenticate] };
    server.get('/:politicianId', async (request) => {
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT * FROM funding_sources WHERE politician_id = $1 ORDER BY amount DESC`, [politicianId]);
        return rows;
    });
    server.post('/', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { politician_id, source_name, source_type, amount } = request.body;
        const { rows } = await client_1.db.query(`INSERT INTO funding_sources (politician_id, source_name, source_type, amount)
       VALUES ($1, $2, $3, $4) RETURNING *`, [politician_id, source_name, source_type, Number(amount)]);
        return reply.status(201).send(rows[0]);
    });
    server.delete('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        await client_1.db.query('DELETE FROM funding_sources WHERE id = $1', [id]);
        return { success: true };
    });
}
