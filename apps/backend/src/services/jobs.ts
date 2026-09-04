import { db } from '../db/client'

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Fetch JSON with a polite User-Agent, timeout and exponential backoff. */
export async function fetchJson(url: string, opts: { headers?: Record<string, string>; retries?: number; timeoutMs?: number } = {}): Promise<any | null> {
  const retries = opts.retries ?? 3
  let delay = 1500
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)', Accept: 'application/json', ...(opts.headers || {}) },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      if (attempt === retries) return null
      await sleep(delay)
      delay *= 2
    }
  }
  return null
}

type JobFn = (log: (msg: string) => void) => Promise<Record<string, unknown> | void>

const registry = new Map<string, JobFn>()
const running = new Set<string>()

export function registerJob(name: string, fn: JobFn) {
  registry.set(name, fn)
}

export function listJobs() {
  return [...registry.keys()]
}

/** Run a job once, recording start/finish/status in ingest_runs. A failure never throws to the caller. */
export async function runJob(name: string): Promise<{ ok: boolean; detail: Record<string, unknown> }> {
  const fn = registry.get(name)
  if (!fn) return { ok: false, detail: { error: 'unknown job' } }
  if (running.has(name)) return { ok: false, detail: { error: 'already running' } }
  // Another instance (e.g. during a deploy overlap) may already be running this job.
  const { rows: live } = await db.query(`SELECT 1 FROM ingest_runs WHERE job = $1 AND status = 'running' AND started_at > NOW() - INTERVAL '6 hours'`, [name])
  if (live.length) return { ok: false, detail: { error: 'running elsewhere' } }
  running.add(name)
  const { rows } = await db.query(`INSERT INTO ingest_runs (job) VALUES ($1) RETURNING id`, [name])
  const runId = rows[0].id
  const lines: string[] = []
  const log = (m: string) => { lines.push(`${new Date().toISOString().slice(11, 19)} ${m}`); console.log(`[job:${name}] ${m}`) }
  try {
    const result = (await fn(log)) || {}
    const detail = { ...result, log: lines.slice(-50) }
    await db.query(`UPDATE ingest_runs SET finished_at = NOW(), status = 'ok', detail = $2 WHERE id = $1`, [runId, JSON.stringify(detail)])
    return { ok: true, detail }
  } catch (err: any) {
    const detail = { error: err?.message || String(err), log: lines.slice(-50) }
    await db.query(`UPDATE ingest_runs SET finished_at = NOW(), status = 'failed', detail = $2 WHERE id = $1`, [runId, JSON.stringify(detail)])
    console.error(`[job:${name}] failed:`, err)
    return { ok: false, detail }
  } finally {
    running.delete(name)
  }
}

export async function lastRuns(limit = 20) {
  const { rows } = await db.query(`SELECT id, job, started_at, finished_at, status, detail FROM ingest_runs ORDER BY started_at DESC LIMIT $1`, [limit])
  return rows
}

/** Runs left in 'running' by a restart or redeploy can never finish; mark them so the log stays honest. */
export async function sweepStaleRuns() {
  try {
    await db.query(`UPDATE ingest_runs SET status = 'aborted', finished_at = NOW(), detail = detail || '{"error":"process restarted"}'::jsonb WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 minutes'`)
  } catch (err: any) {
    console.error('sweepStaleRuns:', err?.message)
  }
}

/** Nightly at 03:10 UTC: run every registered job in order. */
export function startScheduler(order: string[]) {
  sweepStaleRuns()
  if (process.env.DISABLE_SCHEDULER === '1') return
  const schedule = () => {
    const now = new Date()
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 10, 0))
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    const ms = next.getTime() - now.getTime()
    setTimeout(async () => {
      for (const name of order) await runJob(name)
      schedule()
    }, ms)
    console.log(`[scheduler] next nightly run in ${Math.round(ms / 60000)} min`)
  }
  schedule()
}
