import 'dotenv/config'
import dns from 'dns'
// Some data hosts (GDELT) advertise IPv6 endpoints that time out; prefer IPv4 like curl does.
dns.setDefaultResultOrder('ipv4first')
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
import { configRoutes } from './routes/config'
import { analyzeRoutes } from './routes/analyze'
import { leaderVerdictRoutes, verdictsRoutes } from './routes/verdicts'
import { leaderLeakRoutes, leaksRoutes } from './routes/leaks'
import { leaderProposalRoutes, proposalsRoutes } from './routes/proposals'
import { feedRoutes } from './routes/feed'
import { leaderboardRoutes } from './routes/leaderboard'
import { adminRoutes, dossierRoutes } from './routes/dossier'
import { NIGHTLY_ORDER } from './services/nightly'
import { startScheduler } from './services/jobs'

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
    if (!origin || allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.false-leaders\.pages\.dev$/.test(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})

// Tolerate empty JSON bodies (e.g. bare POST /x/upvote)
server.removeContentTypeParser('application/json')
server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  const text = typeof body === 'string' ? body.trim() : ''
  if (!text) return done(null, {})
  try {
    done(null, JSON.parse(text))
  } catch (err: any) {
    err.statusCode = 400
    done(err, undefined)
  }
})

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'changeme'
})

server.decorate('authenticate', async function(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Access denied.' })
  }
})

server.decorate('requireVerified', async function(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if (!request.user.email_verified) {
      return reply.status(403).send({ error: 'Verify your email first.' })
    }
  } catch (err) {
    reply.status(401).send({ error: 'Access denied.' })
  }
})

server.setErrorHandler((error: any, _request, reply) => {
  server.log.error(error)
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
  reply.status(status).send({ error: status === 500 ? 'Something broke.' : (error.message || 'Request failed.') })
})

server.register(authRoutes, { prefix: '/auth' })
server.register(politiciansRoutes, { prefix: '/politicians' })
server.register(analyzeRoutes, { prefix: '/politicians' })
server.register(leaderVerdictRoutes, { prefix: '/politicians' })
server.register(leaderLeakRoutes, { prefix: '/politicians' })
server.register(leaderProposalRoutes, { prefix: '/politicians' })
server.register(dossierRoutes, { prefix: '/politicians' })
server.register(adminRoutes, { prefix: '/admin' })
server.register(verdictsRoutes, { prefix: '/verdicts' })
server.register(leaksRoutes, { prefix: '/leaks' })
server.register(proposalsRoutes, { prefix: '/controversy-proposals' })
server.register(feedRoutes, { prefix: '/feed' })
server.register(leaderboardRoutes, { prefix: '/leaderboard' })
server.register(commentsRoutes, { prefix: '/comments' })
server.register(votesRoutes, { prefix: '/votes' })
server.register(homeRoutes, { prefix: '/home' })
server.register(graftsRoutes, { prefix: '/grafts' })
server.register(bookmarksRoutes, { prefix: '/bookmarks' })
server.register(controversiesRoutes, { prefix: '/controversies' })
server.register(notificationsRoutes, { prefix: '/notifications' })
server.register(fundingRoutes, { prefix: '/funding' })
server.register(influenceRoutes, { prefix: '/influence' })
server.register(configRoutes, { prefix: '/config' })

server.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 8080, host: '0.0.0.0' })
    console.log(`Server running on port ${process.env.PORT || 8080}`)
    startScheduler(NIGHTLY_ORDER)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
