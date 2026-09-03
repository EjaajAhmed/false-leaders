import { db } from '../db/client'
import dns from 'dns'
// Some data hosts (GDELT) advertise IPv6 endpoints that time out; prefer IPv4 like curl does.
dns.setDefaultResultOrder('ipv4first')
import { sleep } from './jobs'
import { LICENSES, recordSource } from './provenance'
import { generateText } from './gemini'
import { Agent } from 'undici'

const agent = new Agent({ connect: { timeout: 30000 }, headersTimeout: 45000, bodyTimeout: 45000 })

const UA = 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)'
const API = 'https://api.gdeltproject.org/api/v2/doc/doc'
const NEG_TONE = -2 // GDELT tone below this counts as markedly negative

// GDELT's published limit is one request per five seconds per IP, but it penalises bursts with long
// 429 streaks. One global queue with an adaptive gap: double it on every throttle, relax it on success.
let chain: Promise<unknown> = Promise.resolve()
let last = 0
let gapMs = 12000
const MIN_GAP = 12000, MAX_GAP = 120000
/** Optional sink for per-request diagnostics (set by callers that want a trace). */
export let gdeltTrace: ((m: string) => void) | null = null
export function setGdeltTrace(fn: ((m: string) => void) | null) { gdeltTrace = fn }

export function gdeltFetch(params: Record<string, string>): Promise<any | null | undefined> {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params }).toString()}`
  const debug = process.env.GDELT_DEBUG === '1'
  const run = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      // The gap is measured from the END of the previous request: GDELT counts a slow query as in-flight time.
      const wait = last + gapMs - Date.now()
      if (wait > 0) await sleep(wait)
      const t0 = Date.now()
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(50000), dispatcher: agent } as any)
        const text = await res.text()
        last = Date.now()
        const line = `${res.status} ${params.mode} ${Math.round((Date.now() - t0) / 1000)}s gap=${gapMs / 1000}s ${JSON.stringify(text.slice(0, 60))}`
        if (debug) console.log(`[gdelt] ${line}`)
        gdeltTrace?.(line)
        if (res.ok && text.trim().startsWith('{')) { gapMs = Math.max(MIN_GAP, Math.round(gapMs * 0.8)); return JSON.parse(text) }
        if (res.status === 429 || /limit requests/i.test(text)) { gapMs = Math.min(MAX_GAP, gapMs * 2); continue }
        return null
      } catch (err: any) {
        last = Date.now()
        gapMs = Math.min(MAX_GAP, Math.round(gapMs * 1.5))
        const line = `error ${params.mode} ${Math.round((Date.now() - t0) / 1000)}s ${err?.cause?.code || err?.message || err}`
        if (debug) console.log(`[gdelt] ${line}`)
        gdeltTrace?.(line)
      }
    }
    return undefined // gave up: caller must not cache
  }
  const p = chain.then(run, run)
  chain = p.catch(() => undefined)
  return p
}

export const gdeltUrl = (params: Record<string, string>) => `${API}?${new URLSearchParams({ format: 'json', ...params }).toString()}`

/** GDELT's sourcecountry operator takes FIPS-style names without spaces. */
export function gdeltCountryName(country: string | null): string | null {
  if (!country) return null
  const map: Record<string, string> = {
    'united states': 'unitedstates', 'united kingdom': 'unitedkingdom', 'south korea': 'southkorea', 'north korea': 'northkorea',
    'czech republic': 'czechia', 'russia': 'russia', 'vatican city': 'vaticancity', 'ivory coast': 'ivorycoast', "côte d'ivoire": 'ivorycoast',
    'democratic republic of the congo': 'congodemocraticrepublic', 'republic of the congo': 'congorepublic', 'palestine': 'westbank',
    'taiwan': 'taiwan', 'united arab emirates': 'unitedarabemirates', 'são tomé and príncipe': 'saotomeandprincipe',
  }
  const k = country.toLowerCase().trim()
  return map[k] || k.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
}

function daily(series: any): { day: string; value: number }[] {
  const data = series?.timeline?.[0]?.data || []
  return data.map((d: any) => ({ day: `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`, value: Number(d.value) || 0 }))
}

interface Spike { day: string; articles: number; baseline: number; ratio: number }

/** A day is a spike when it is at least 3x the median of the previous 14 days and at least 25 articles. */
export function detectSpikes(points: { day: string; value: number }[]): Spike[] {
  const spikes: Spike[] = []
  for (let i = 14; i < points.length; i++) {
    const window = points.slice(i - 14, i).map(p => p.value).sort((a, b) => a - b)
    const median = window[Math.floor(window.length / 2)] || 0
    const baseline = Math.max(median, 5)
    const v = points[i].value
    if (v >= 25 && v >= 3 * baseline) spikes.push({ day: points[i].day, articles: v, baseline, ratio: Math.round((v / baseline) * 100) / 100 })
  }
  // Keep the strongest, avoiding adjacent days
  return spikes.sort((a, b) => b.ratio - a.ratio).filter((s, i, arr) => !arr.slice(0, i).some(o => Math.abs(new Date(o.day).getTime() - new Date(s.day).getTime()) <= 2 * 86400000)).slice(0, 4)
}

async function summariseSpike(name: string, day: string, headlines: { title: string; source: string }[]): Promise<string | null> {
  if (headlines.length === 0) return null
  const prompt = `You are writing a one-sentence, strictly neutral caption for a news-coverage spike on ${day} about ${name}.
Below are headlines from that day. State only what the coverage was about, in at most 30 words, without judgement, without adjectives of opinion, and without asserting anything the headlines do not say. If the headlines disagree or are unclear, say the coverage was mixed and name the two main topics.

Headlines:
${headlines.slice(0, 12).map(h => `- ${h.title} (${h.source})`).join('\n')}

Caption:`
  const text = await generateText(prompt, { maxTokens: 120, temperature: 0.1 })
  return text ? text.replace(/^caption:\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 300) : null
}

export interface MediaSync { articles_30d: number; spikes: number; sample: number }

export async function syncMedia(politicianId: string, opts: { deep?: boolean } = {}): Promise<MediaSync | null> {
  const { rows } = await db.query('SELECT id, name, country FROM politicians WHERE id = $1', [politicianId])
  const p = rows[0]
  if (!p) return null
  const q = `"${p.name}" sourcelang:english`
  const home = gdeltCountryName(p.country)

  const all = await gdeltFetch({ query: q, mode: 'timelinevolraw', timespan: '90d' })
  const neg = await gdeltFetch({ query: `${q} tone<${NEG_TONE}`, mode: 'timelinevolraw', timespan: '90d' })
  if (!all || !neg) return null
  const allPts = daily(all), negPts = daily(neg)
  const negBy = new Map(negPts.map(x => [x.day, x.value]))

  // Daily volume + negative count
  for (const pt of allPts) {
    await db.query(
      `INSERT INTO media_daily (politician_id, day, articles, negative, fetched_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (politician_id, day) DO UPDATE SET articles = EXCLUDED.articles, negative = EXCLUDED.negative, fetched_at = NOW()`,
      [politicianId, pt.day, pt.value, Math.min(pt.value, negBy.get(pt.day) || 0)]
    )
  }
  const last30 = allPts.slice(-30)
  const articles30 = last30.reduce((s, x) => s + x.value, 0)
  const negative30 = last30.reduce((s, x) => s + (negBy.get(x.day) || 0), 0)

  // Home vs abroad tone over 30 days (abroad = all − home). Two extra requests, so only for the most-watched leaders.
  let homeArticles: number | null = null, homeNegative: number | null = null
  if (home && opts.deep) {
    const h = await gdeltFetch({ query: `${q} sourcecountry:${home}`, mode: 'timelinevolraw', timespan: '30d' })
    const hn = await gdeltFetch({ query: `${q} sourcecountry:${home} tone<${NEG_TONE}`, mode: 'timelinevolraw', timespan: '30d' })
    if (h && hn) {
      homeArticles = daily(h).reduce((s, x) => s + x.value, 0)
      homeNegative = daily(hn).reduce((s, x) => s + x.value, 0)
    }
  }

  // Source-country sample: the 250 most recent articles
  const sample = await gdeltFetch({ query: q, mode: 'artlist', maxrecords: '250', sort: 'datedesc', timespan: '30d' })
  const counts = new Map<string, number>()
  const arts: any[] = sample?.articles || []
  for (const a of arts) { const c = a.sourcecountry || 'Unknown'; counts.set(c, (counts.get(c) || 0) + 1) }
  const sourceCountries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, n]) => ({ country, articles: n, share: Math.round((n / Math.max(1, arts.length)) * 1000) / 10 }))

  const sourceUrl = gdeltUrl({ query: q, mode: 'timelinevolraw', timespan: '90d' })
  await db.query(
    `INSERT INTO media_summary (politician_id, articles_30d, negative_30d, home_country, home_articles, home_negative, abroad_articles, abroad_negative, source_countries, sample_size, source_url, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (politician_id) DO UPDATE SET articles_30d = EXCLUDED.articles_30d, negative_30d = EXCLUDED.negative_30d, home_country = EXCLUDED.home_country,
       home_articles = EXCLUDED.home_articles, home_negative = EXCLUDED.home_negative, abroad_articles = EXCLUDED.abroad_articles, abroad_negative = EXCLUDED.abroad_negative,
       source_countries = EXCLUDED.source_countries, sample_size = EXCLUDED.sample_size, source_url = EXCLUDED.source_url, fetched_at = NOW()`,
    [politicianId, articles30, negative30, p.country, homeArticles, homeNegative,
     homeArticles == null ? null : Math.max(0, articles30 - homeArticles), homeNegative == null ? null : Math.max(0, negative30 - homeNegative),
     JSON.stringify(sourceCountries), arts.length, sourceUrl]
  )
  await recordSource(politicianId, 'media_coverage', { articles_30d: articles30, negative_30d: negative30 }, { name: 'GDELT 2.0 DOC API', url: sourceUrl, license: LICENSES.gdelt })

  // Spikes: only new days get an article list and a draft caption
  const spikes = detectSpikes(allPts)
  let newSpikes = 0
  for (const s of spikes) {
    if (newSpikes >= 2) break
    const { rows: existing } = await db.query('SELECT 1 FROM coverage_spikes WHERE politician_id = $1 AND day = $2', [politicianId, s.day])
    if (existing.length) continue
    const d = s.day.replace(/-/g, '')
    const list = await gdeltFetch({ query: q, mode: 'artlist', startdatetime: `${d}000000`, enddatetime: `${d}235959`, maxrecords: '12', sort: 'hybridrel' })
    const seen = new Set<string>()
    const headlines = ((list?.articles || []) as any[])
      .filter(a => a.title && a.url && !seen.has(a.domain) && seen.add(a.domain))
      .slice(0, 8)
      .map(a => ({ title: String(a.title).trim(), url: a.url, source: a.domain }))
    const summary = await summariseSpike(p.name, s.day, headlines)
    await db.query(
      `INSERT INTO coverage_spikes (politician_id, day, articles, baseline, ratio, headlines, summary, status, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) ON CONFLICT (politician_id, day) DO NOTHING`,
      [politicianId, s.day, s.articles, s.baseline, s.ratio, JSON.stringify(headlines), summary, gdeltUrl({ query: q, mode: 'artlist', startdatetime: `${d}000000`, enddatetime: `${d}235959` })]
    )
    newSpikes++
  }
  return { articles_30d: articles30, spikes: newSpikes, sample: arts.length }
}

export async function getMedia(politicianId: string, includeDrafts = false) {
  const [{ rows: daily }, { rows: summary }, { rows: spikes }] = await Promise.all([
    db.query('SELECT day::text, articles, negative FROM media_daily WHERE politician_id = $1 ORDER BY day', [politicianId]),
    db.query('SELECT * FROM media_summary WHERE politician_id = $1', [politicianId]),
    db.query(
      `SELECT id, day::text, articles, baseline, ratio, headlines, summary, status, source_url FROM coverage_spikes
       WHERE politician_id = $1 ${includeDrafts ? "AND status <> 'dismissed'" : "AND status = 'published'"} ORDER BY day DESC`,
      [politicianId]
    ),
  ])
  return { daily, summary: summary[0] || null, spikes }
}
