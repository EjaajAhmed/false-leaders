"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const dotenv_1 = __importDefault(require("dotenv"));
const politicians_1 = require("./routes/politicians");
const comments_1 = require("./routes/comments");
const votes_1 = require("./routes/votes");
const auth_1 = require("./routes/auth");
const home_1 = require("./routes/home");
const grafts_1 = require("./routes/grafts");
const bookmarks_1 = require("./routes/bookmarks");
const controversies_1 = require("./routes/controversies");
const notifications_1 = require("./routes/notifications");
dotenv_1.default.config();
const server = (0, fastify_1.default)({ logger: true });
server.register(cors_1.default, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});
server.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
        reply.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.status(204).send();
    }
});
server.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'changeme'
});
server.decorate('authenticate', async function (request, reply) {
    try {
        await request.jwtVerify();
    }
    catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
    }
});
server.register(auth_1.authRoutes, { prefix: '/auth' });
server.register(politicians_1.politiciansRoutes, { prefix: '/politicians' });
server.register(comments_1.commentsRoutes, { prefix: '/comments' });
server.register(votes_1.votesRoutes, { prefix: '/votes' });
server.register(home_1.homeRoutes, { prefix: '/home' });
server.register(grafts_1.graftsRoutes, { prefix: '/grafts' });
server.register(bookmarks_1.bookmarksRoutes, { prefix: '/bookmarks' });
server.register(controversies_1.controversiesRoutes, { prefix: '/controversies' });
server.register(notifications_1.notificationsRoutes, { prefix: '/notifications' });
server.get('/health', async () => ({ status: 'ok' }));
const start = async () => {
    try {
        await server.listen({
            port: Number(process.env.PORT) || 8080,
            host: '0.0.0.0'
        });
        console.log('Server running on http://localhost:3000');
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();
