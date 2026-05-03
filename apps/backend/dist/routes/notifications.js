"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRoutes = notificationsRoutes;
const auth_1 = require("../middleware/auth");
const client_1 = require("../db/client");
const notify_1 = require("../services/notify");
async function notificationsRoutes(server) {
    const auth = { onRequest: [auth_1.authenticate] };
    server.get('/', auth, async (request) => {
        const user = request.user;
        const { rows } = await client_1.db.query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [user.id]);
        return rows;
    });
    server.get('/unread-count', auth, async (request) => {
        const user = request.user;
        const { rows } = await client_1.db.query(`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`, [user.id]);
        return { count: Number(rows[0].count) };
    });
    server.patch('/read-all', auth, async (request) => {
        const user = request.user;
        await client_1.db.query(`UPDATE notifications SET read = true WHERE user_id = $1`, [user.id]);
        return { success: true };
    });
    server.patch('/:id/read', auth, async (request) => {
        const user = request.user;
        const { id } = request.params;
        await client_1.db.query(`UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`, [id, user.id]);
        return { success: true };
    });
    server.delete('/clear', auth, async (request) => {
        const user = request.user;
        await client_1.db.query(`DELETE FROM notifications WHERE user_id = $1`, [user.id]);
        return { success: true };
    });
    server.post('/broadcast', auth, async (request, reply) => {
        const user = request.user;
        if (!user?.is_admin)
            return reply.status(403).send({ error: 'Forbidden' });
        const { subject, message } = request.body;
        await (0, notify_1.notifyAllUsers)('app_news', subject, message);
        return { success: true };
    });
}
