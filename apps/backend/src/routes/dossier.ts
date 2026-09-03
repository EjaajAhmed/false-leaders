import { FastifyInstance } from 'fastify'
import { db } from '../db/client'
import { requireAdmin } from '../middleware/auth'
import { getPositions, syncWikidata } from '../services/wikidata'
import { getWatch, syncCountry } from '../services/worldbank'
import { getGovernance } from '../services/governance'
import { getMedia, syncMedia } from '../services/gdelt'
import { optionalAuth } from '../middleware/auth'
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

  server.get('/:id/media', { onRequest: [optionalAuth] }, async (request) => {
    const { id } = request.params as { id: string }
    return getMedia(id, !!(request as any).user?.is_admin)
  })

  server.post('/:id/media/sync', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const r = await syncMedia(id, { deep: true })
    if (!r) return reply.status(502).send({ error: 'GDELT unavailable.' })
    return r
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
  // Diagnostic: one raw GDELT request from this server, bypassing the queue, so throttling can be seen from production.
  server.get('/gdelt-probe', { onRequest: [requireAdmin] }, async (request) => {
    const { mode = 'timelinevolraw', timespan = '30d', query = '"Keir Starmer" sourcelang:english' } = request.query as any
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ format: 'json', query, mode, timespan }).toString()}`
    const t0 = Date.now()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)' }, signal: AbortSignal.timeout(60000) })
      const text = await res.text()
      return { status: res.status, ms: Date.now() - t0, head: text.slice(0, 200), url }
    } catch (err: any) {
      return { error: err?.message, cause: err?.cause?.code || err?.cause?.message, ms: Date.now() - t0, url }
    }
  })

  server.get('/spikes', { onRequest: [requireAdmin] }, async (request) => {
    const { status } = request.query as any
    const s = ['draft', 'published', 'dismissed'].includes(status) ? status : 'draft'
    const { rows } = await db.query(
      `SELECT c.id, c.day::text, c.articles, c.baseline, c.ratio, c.headlines, c.summary, c.status, c.source_url, c.created_at, p.id AS leader_id, p.name AS leader_name
       FROM coverage_spikes c JOIN politicians p ON p.id = c.politician_id WHERE c.status = $1 ORDER BY c.created_at DESC LIMIT 200`,
      [s]
    )
    return rows
  })
  server.patch('/spikes/:id', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status, summary } = request.body as any
    if (!['draft', 'published', 'dismissed'].includes(status)) return reply.status(400).send({ error: 'Invalid status.' })
    const { rows } = await db.query(
      `UPDATE coverage_spikes SET status = $1, summary = COALESCE($2, summary), reviewed_at = NOW() WHERE id = $3 RETURNING id, status, summary`,
      [status, summary ? String(summary).trim().slice(0, 300) : null, id]
    )
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found.' })
    return rows[0]
  })

  server.get('/jobs', { onRequest: [requireAdmin] }, async () => ({ jobs: listJobs(), runs: await lastRuns(20) }))
  server.post('/jobs/:name', { onRequest: [requireAdmin] }, async (request, reply) => {
    const { name } = request.params as { name: string }
    // Fire and return; progress is visible in ingest_runs.
    runJob(name).catch(() => undefined)
    return reply.status(202).send({ started: name })
  })
}
