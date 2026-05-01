"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const client_1 = require("../db/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
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
                is_admin: rows[0].is_admin
            });
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
}
