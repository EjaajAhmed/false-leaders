import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { politiciansRoutes } from './routes/politicians'
import { commentsRoutes } from './routes/comments'
import { votesRoutes } from './routes/votes'
import { authRoutes } from './routes/auth'
import { homeRoutes } from './routes/home'
import { graftsRoutes } from './routes/grafts'
import { bookmarksRoutes } from './routes/bookmarks'
import { controversiesRoutes } from './routes/controversies'
import { notificationsRoutes } from './routes/notifications'
import { fundingRoutes } from './routes/funding'
import { influenceRoutes } from './routes/influence'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      'https://falseleaders.com',
      'https://www.falseleaders.com',
      'https://9ec69f1c.false-leaders.pages.dev',
      'https://false-leaders.pages.dev',
      'http://localhost:5173'
    ]
    if (!origin || allowed.includes(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
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

server.decorate('requireVerified', async function(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user.email_verified) {
      return reply.status(403).send({ error: 'Please verify your email to continue.' })
    }
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
server.register(fundingRoutes, { prefix: '/funding' })
server.register(influenceRoutes, { prefix: '/influence' })

server.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 8080, host: '0.0.0.0' })
    console.log(`Server running on port ${process.env.PORT || 8080}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()