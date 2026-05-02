"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const client_1 = require("../db/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const email_1 = require("../services/email");
async function authRoutes(server) {
    server.post('/register', async (request, reply) => {
        const { email, username, password } = request.body;
        const password_hash = await bcrypt_1.default.hash(password, 10);
        try {
            const { rows } = await client_1.db.query(`INSERT INTO users (email, username, password_hash)
         VALUES ($1, $2, $3) RETURNING id, email, username, is_admin`, [email, username, password_hash]);
            const token = server.jwt.sign({
                id: rows[0].id,
                username: rows[0].username,
                is_admin: false
            });
            await (0, email_1.sendWelcomeEmail)(email, username);
            return reply.status(201).send({ user: rows[0], token });
        }
        catch (err) {
            if (err.code === '23505') {
                return reply.status(400).send({ error: 'Email or username already taken' });
            }
            throw err;
        }
    });
    server.post('/login', async (request, reply) => {
        const { email, password } = request.body;
        const { rows } = await client_1.db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0)
            return reply.status(401).send({ error: 'Invalid credentials' });
        const valid = await bcrypt_1.default.compare(password, rows[0].password_hash);
        if (!valid)
            return reply.status(401).send({ error: 'Invalid credentials' });
        const token = server.jwt.sign({
            id: rows[0].id,
            username: rows[0].username,
            is_admin: rows[0].is_admin
        });
        return {
            user: {
                id: rows[0].id,
                email: rows[0].email,
                username: rows[0].username,
                is_admin: rows[0].is_admin
            },
            token
        };
    });
    server.patch('/username', { onRequest: [server.authenticate] }, async (request, reply) => {
        const user = request.user;
        const { username } = request.body;
        try {
            const { rows } = await client_1.db.query(`UPDATE users SET username = $1 WHERE id = $2 RETURNING id, email, username`, [username, user.id]);
            return rows[0];
        }
        catch (err) {
            if (err.code === '23505') {
                return reply.status(400).send({ error: 'Username already taken' });
            }
            throw err;
        }
    });
    server.get('/me', { onRequest: [server.authenticate] }, async (request) => {
        const user = request.user;
        const { rows } = await client_1.db.query(`SELECT id, email, username, is_admin, email_notifications,
       notif_comment_replies, notif_politician_updates, notif_app_news
       FROM users WHERE id = $1`, [user.id]);
        return rows[0];
    });
    server.patch('/notif-prefs', { onRequest: [server.authenticate] }, async (request) => {
        const user = request.user;
        const { email_notifications, notif_comment_replies, notif_politician_updates, notif_app_news } = request.body;
        const { rows } = await client_1.db.query(`UPDATE users SET
        email_notifications = COALESCE($1, email_notifications),
        notif_comment_replies = COALESCE($2, notif_comment_replies),
        notif_politician_updates = COALESCE($3, notif_politician_updates),
        notif_app_news = COALESCE($4, notif_app_news)
       WHERE id = $5 RETURNING email_notifications, notif_comment_replies, notif_politician_updates, notif_app_news`, [email_notifications ?? null, notif_comment_replies ?? null, notif_politician_updates ?? null, notif_app_news ?? null, user.id]);
        return rows[0];
    });
}
