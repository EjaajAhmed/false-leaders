import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin } from '../middleware/auth'
import { getPositions, syncWikidata } from '../services/wikidata'
import { getWatch, syncCountry } from '../services/worldbank'
import { getGovernance } from '../services/governance'
import { getScoreEvents, getSources } from '../services/provenance'
import { lastRuns, listJobs, runJob } from '../services/jobs'

// Mounted under /politicians. Each section is its own endpoint so a failing source degrades one section only.
export async function dossierRoutes(server: FastifyInstance) {
  server.get('/:id/positions', async (request) => {
    const { id } = request.params as { id: string }
    const { rows } = await db.query('SELECT wikidata_id, wikidata_synced_at, current_office, term_start, term_end FROM politicians WHERE id = $1', [id])
    return { ...(rows[0] || {}), positions: await getPositions(id) }
  })

  server.get('/:id/watch', async (request) => {
    const { id } = request.params as { id: string }
    return getWatch(id)
  })

  server.get('/:id/governance', async (request) => {
    const { id } = request.params as { id: string }
    return getGovernance(id)
  })

  server.get('/:id/sources', async (request) => {
    const { id } = request.params as { id: string }
    return getSources(id)
  })

  server.get('/:id/score-events', async (request) => {
    const { id } = request.params as { id: string }
    return getScoreEvents(id)
  })

  server.post('/:id/sync', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const wd = await syncWikidata(id)
    if (!wd.qid) return reply.status(404).send({ error: 'No Wikidata record found.' })
    const { rows } = await db.query('SELECT country_code FROM politicians WHERE id = $1', [id])
    let wb = null
    if (rows[0]?.country_code) wb = await syncCountry(rows[0].country_code)
    return { wikidata: wd, worldbank: wb }
  })
}

// Mounted under /admin
export async function adminRoutes(server: FastifyInstance) {
  server.get('/jobs', { onRequest: [requireAdmin] }, async () => ({ jobs: listJobs(), runs: await lastRuns(20) }))
  server.post('/jobs/:name', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { name } = request.params as { name: string }
    // Fire and return; progress is visible in ingest_runs.
    runJob(name).catch(() => undefined)
    return reply.status(202).send({ started: name })
  })
}
