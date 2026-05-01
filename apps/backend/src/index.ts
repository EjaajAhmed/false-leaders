import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'

import { politiciansRoutes } from './routes/politicians'
import { commentsRoutes } from './routes/comments'
import { votesRoutes } from './routes/votes'
import { authRoutes } from './routes/auth'
import { homeRoutes } from './routes/home'
import { graftsRoutes } from './routes/grafts'
import { bookmarksRoutes } from './routes/bookmarks'
import { controversiesRoutes } from './routes/controversies'
import { notificationsRoutes } from './routes/notifications'



dotenv.config()

const server = Fastify({ logger: true })

server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

server.addHook('onRequest', async (request, reply) => {
  if (request.method === 'OPTIONS') {
    reply.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173')
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    reply.header('Access-Control-Allow-Credentials', 'true')
    reply.status(204).send()
  }
})

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'changeme'
})

server.decorate('authenticate', async function(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

server.register(authRoutes, { prefix: '/auth' })
server.register(politiciansRoutes, { prefix: '/politicians' })
server.register(commentsRoutes, { prefix: '/comments' })
server.register(votesRoutes, { prefix: '/votes' })
server.register(homeRoutes, { prefix: '/home' })
server.register(graftsRoutes, { prefix: '/grafts' })
server.register(bookmarksRoutes, { prefix: '/bookmarks' })
server.register(controversiesRoutes, { prefix: '/controversies' })
server.register(notificationsRoutes, { prefix: '/notifications' })

server.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await server.listen({ 
      port: Number(process.env.PORT) || 8080, 
      host: '0.0.0.0' 
    })
    console.log('Server running on http://localhost:3000')
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()