"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.controversiesRoutes = controversiesRoutes;
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const notify_1 = require("../services/notify");
async function controversiesRoutes(server) {
    const auth = { onRequest: [auth_1.authenticate] };
    server.get('/:politicianId', async (request) => {
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT * FROM controversies WHERE politician_id = $1 ORDER BY created_at DESC`, [politicianId]);
        return rows;
    });
    server.post('/', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { politician_id, title, description, source_url, level } = request.body;
        const { rows } = await client_1.db.query(`INSERT INTO controversies (politician_id, title, description, source_url, level)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [politician_id, title, description, source_url || null, level]);
        const { rows: politicianRows } = await client_1.db.query('SELECT name FROM politicians WHERE id = $1', [politician_id]);
        const politicianName = politicianRows[0]?.name || 'a politician';
        await (0, notify_1.notifyPoliticianUpdate)(politician_id, politicianName, [`new controversy added: "${title}"`]);
        return reply.status(201).send(rows[0]);
    });
    server.put('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        const { title, description, source_url, level } = request.body;
        const { rows: existing } = await client_1.db.query('SELECT * FROM controversies WHERE id = $1', [id]);
        const prev = existing[0];
        const { rows } = await client_1.db.query(`UPDATE controversies SET title=$1, description=$2, source_url=$3, level=$4
       WHERE id=$5 RETURNING *`, [title, description, source_url || null, level, id]);
        const { rows: politicianRows } = await client_1.db.query('SELECT name FROM politicians WHERE id = $1', [prev.politician_id]);
        const politicianName = politicianRows[0]?.name || 'a politician';
        const changes = [];
        if (prev.title !== title)
            changes.push(`controversy renamed to "${title}"`);
        if (prev.level !== level)
            changes.push(`"${title}" level changed to ${level}`);
        if (changes.length > 0) {
            await (0, notify_1.notifyPoliticianUpdate)(prev.politician_id, politicianName, changes);
        }
        return rows[0];
    });
    server.delete('/:id', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { id } = request.params;
        await client_1.db.query('DELETE FROM controversies WHERE id = $1', [id]);
        return { success: true };
    });
}
