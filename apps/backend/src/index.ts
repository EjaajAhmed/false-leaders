import 'dotenv/config'
import dns from 'dns'
// Some data hosts (GDELT) advertise IPv6 endpoints that time out; prefer IPv4 like curl does.
dns.setDefaultResultOrder('ipv4first')
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { authenticate, requireVerified } from './middleware/auth'
import { SESSION_TTL } from './services/session'
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
import { analyzeRoutes } from './routes/analyze'
import { leaderVerdictRoutes, verdictsRoutes } from './routes/verdicts'
import { leaderLeakRoutes, leaksRoutes } from './routes/leaks'
import { leaderProposalRoutes, proposalsRoutes } from './routes/proposals'
import { feedRoutes } from './routes/feed'
import { leaderboardRoutes } from './routes/leaderboard'
import { adminRoutes, dossierRoutes } from './routes/dossier'
import { leaderPromiseRoutes, promiseAdminRoutes } from './routes/promises'
import { forumRoutes } from './routes/forum'
import { ratingRoutes } from './routes/ratings'
import { approvalRoutes, approvalAdminRoutes } from './routes/approval'
import { legalRoutes, moderationAdminRoutes } from './routes/legal'
import { startForumSchedules } from './services/forum'
import { NIGHTLY_ORDER } from './services/nightly'
import { startScheduler } from './services/jobs'

// Railway terminates TLS in front of the app; trustProxy makes request.ip the client, which the rate limits key on.
const server = Fastify({ logger: true, trustProxy: true })

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

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set; refusing to start with a guessable secret.')
server.register(jwt, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: SESSION_TTL },
})

// Off by default; routes opt in with config.rateLimit (auth endpoints). A generous global ceiling stops scraping loops.
server.register(rateLimit, {
  global: true, max: 600, timeWindow: '1 minute',
  errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, message: `Too many requests. Try again in ${ctx.after}.` }),
})

server.decorate('authenticate', authenticate)
server.decorate('requireVerified', requireVerified)

// Postgres errors caused by the request itself (a malformed id, a reference to something that does not exist,
// an out-of-range number) are the client's 4xx, not a 500.
const PG_CLIENT_ERRORS: Record<string, [number, string]> = {
  '22P02': [404, 'Not found.'], '23503': [404, 'Not found.'], '22003': [400, 'A number in the request is out of range.'],
  '2201W': [400, 'Invalid limit.'], '2201X': [400, 'Invalid offset.'], '22007': [400, 'Invalid date.'], '22008': [400, 'Invalid date.'],
}
server.setErrorHandler((error: any, _request, reply) => {
  const pg = PG_CLIENT_ERRORS[error.code]
  if (pg) return reply.status(pg[0]).send({ error: pg[1] })
  server.log.error(error)
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
  reply.status(status).send({ error: status === 500 ? 'Something broke.' : (error.message || 'Request failed.') })
})
server.setNotFoundHandler((_request, reply) => { reply.status(404).send({ error: 'Not found.' }) })

// Comments, verdicts, votes and leaks were replaced by the forum and the community rating. Their data stays readable
// where a page still needs it, but nothing can be written: those routes skip the terms gate, cooldowns and moderation log.
const RETIRED_WRITES = [/^\/comments(\/|$)/, /^\/verdicts(\/|$)/, /^\/votes(\/|$)/, /^\/leaks(\/|$)/, /^\/politicians\/[^/]+\/(leaks|verdicts)(\/|$)/]
server.addHook('onRequest', async (request, reply) => {
  if (request.method === 'GET' || request.method === 'OPTIONS' || request.method === 'HEAD') return
  if (RETIRED_WRITES.some(r => r.test(request.url.split('?')[0]))) return reply.status(410).send({ error: 'This feature has been retired. Use the forum.' })
})

server.register(authRoutes, { prefix: '/auth' })
server.register(politiciansRoutes, { prefix: '/politicians' })
server.register(analyzeRoutes, { prefix: '/politicians' })
server.register(leaderVerdictRoutes, { prefix: '/politicians' })
server.register(leaderLeakRoutes, { prefix: '/politicians' })
server.register(leaderProposalRoutes, { prefix: '/politicians' })
server.register(dossierRoutes, { prefix: '/politicians' })
server.register(adminRoutes, { prefix: '/admin' })
server.register(leaderPromiseRoutes, { prefix: '/politicians' })
server.register(promiseAdminRoutes, { prefix: '/admin' })
server.register(forumRoutes, { prefix: '/forum' })
server.register(ratingRoutes, { prefix: '/politicians' })
server.register(approvalRoutes, { prefix: '/politicians' })
server.register(approvalAdminRoutes, { prefix: '/admin' })
server.register(legalRoutes, { prefix: '/legal' })
server.register(moderationAdminRoutes, { prefix: '/admin' })
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

server.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 8080, host: '0.0.0.0' })
    console.log(`Server running on port ${process.env.PORT || 8080}`)
    startScheduler(NIGHTLY_ORDER)
    startForumSchedules()
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
