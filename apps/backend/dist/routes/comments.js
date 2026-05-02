"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentsRoutes = commentsRoutes;
const client_1 = require("../db/client");
async function commentsRoutes(server) {
    server.get('/:politicianId', async (request) => {
        const { politicianId } = request.params;
        const { rows } = await client_1.db.query(`SELECT c.*, u.username FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.politician_id = $1
       ORDER BY c.created_at DESC`, [politicianId]);
        return rows;
    });
    const verified = { onRequest: [server.requireVerified] };
    server.post('/', verified, async (request, reply) => {
        const { politician_id, body } = request.body;
        const user = request.user;
        const { rows } = await client_1.db.query(`INSERT INTO comments (politician_id, user_id, body)
       VALUES ($1, $2, $3) RETURNING *`, [politician_id, user.id, body]);
        const { rows: politicianRows } = await client_1.db.query(`SELECT name FROM politicians WHERE id = $1`, [politician_id]);
        const politicianName = politicianRows[0]?.name || 'a politician';
        const { rows: otherCommenters } = await client_1.db.query(`SELECT DISTINCT user_id FROM comments
       WHERE politician_id = $1 AND user_id != $2`, [politician_id, user.id]);
        for (const commenter of otherCommenters) {
            await client_1.db.query(`INSERT INTO notifications (user_id, type, message, link)
         VALUES ($1, 'comment_reply', $2, $3)`, [
                commenter.user_id,
                `@${user.username} also commented on ${politicianName}`,
                `/politicians/${politician_id}`
            ]);
        }
        return reply.status(201).send(rows[0]);
    });
    server.delete('/:id', { onRequest: [server.verified] }, async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        await client_1.db.query('DELETE FROM comments WHERE id = $1 AND user_id = $2', [id, user.id]);
        return { success: true };
    });
}
