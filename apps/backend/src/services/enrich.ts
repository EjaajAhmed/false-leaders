import { db } from '../db/client'
import { LICENSES, recordSource } from './provenance'

const UA = 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Words that should appear in a Wikipedia short description for a plausible match.
const ROLE_WORDS = [
  'politic', 'president', 'prime minister', 'minister', 'chancellor', 'king', 'queen', 'emir', 'sultan', 'monarch', 'prince',
  'businessman', 'businesswoman', 'business magnate', 'executive', 'entrepreneur', 'billionaire', 'founder', 'investor', 'chief executive', 'chairman', 'magnate', 'tycoon',
  'judge', 'justice', 'jurist', 'lawyer', 'pope', 'patriarch', 'ayatollah', 'lama', 'imam', 'cleric', 'bishop', 'religious leader',
  'podcaster', 'broadcaster', 'journalist', 'youtuber', 'commentator', 'talk show', 'media proprietor', 'media executive',
  'diplomat', 'general', 'field marshal', 'military officer', 'member of parliament', 'parliamentarian', 'premier', 'mayor', 'governor', 'secretary',
  'economist', 'activist', 'statesman', 'stateswoman', 'head of state', 'head of government', 'ruler', 'senator', 'legislator',
  'philanthropist', 'commissioner', 'councillor', 'administrator', 'central banker', 'secretary-general',
]

function plausible(description: string | undefined, country: string | null): boolean {
  const d = (description || '').toLowerCase()
  if (!d) return false
  if (country && d.includes(country.toLowerCase())) return true
  return ROLE_WORDS.some(w => d.includes(w))
}

interface WikiSummary {
  title: string
  description?: string
  extract?: string
  thumbnail?: { source: string }
  originalimage?: { source: string }
  wikibase_item?: string
  content_urls?: { desktop?: { page?: string } }
  type?: string
}

async function findSummary(name: string, country: string | null): Promise<WikiSummary | null> {
  const direct = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`)
  if (direct && direct.type !== 'disambiguation' && direct.extract && plausible(direct.description, country)) return direct

  // Fall back to search, then take the first plausible hit.
  const q = country ? `${name} ${country}` : name
  const search = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`)
  const hits: { title: string }[] = search?.query?.search || []
  for (const h of hits) {
    await sleep(120)
    const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(h.title.replace(/ /g, '_'))}`)
    if (s && s.type !== 'disambiguation' && s.extract && plausible(s.description, country)) {
      // Require both first and last name in the page title to avoid drifting to unrelated people.
      const parts = name.toLowerCase().split(' ').filter(Boolean)
      const title = s.title.toLowerCase()
      if (title.includes(parts[0]) && title.includes(parts[parts.length - 1])) return s
    }
  }
  return null
}

async function wikidata(qid: string): Promise<{ born: string | null; netWorth: number | null }> {
  const data = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
  const claims = data?.entities?.[qid]?.claims || {}
  let born: string | null = null
  const p569 = claims.P569?.[0]?.mainsnak?.datavalue?.value?.time
  if (typeof p569 === 'string') {
    const m = p569.match(/^[+-](\d{4})-(\d{2})-(\d{2})/)
    if (m && m[2] !== '00' && m[3] !== '00') born = `${m[1]}-${m[2]}-${m[3]}`
    else if (m) born = `${m[1]}-01-01`
  }
  let netWorth: number | null = null
  const p2218 = claims.P2218
  if (Array.isArray(p2218) && p2218.length) {
    // Take the most recent claim that is in US dollars (Q4917).
    const usd = p2218
      .map((c: any) => ({ amount: Number(c.mainsnak?.datavalue?.value?.amount), unit: String(c.mainsnak?.datavalue?.value?.unit || ''), time: c.qualifiers?.P585?.[0]?.datavalue?.value?.time || '' }))
      .filter((c: any) => c.unit.endsWith('/Q4917') && !isNaN(c.amount))
      .sort((a: any, b: any) => (a.time < b.time ? 1 : -1))
    if (usd[0]) netWorth = Math.round(usd[0].amount)
  }
  return { born, netWorth }
}

async function pageviews30d(title: string): Promise<number> {
  const end = new Date(Date.now() - 86400000)
  const start = new Date(end.getTime() - 29 * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const data = await getJson(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${fmt(start)}/${fmt(end)}`
  )
  const items: { views: number }[] = data?.items || []
  return items.reduce((s, i) => s + (i.views || 0), 0)
}

export interface EnrichResult { matched: boolean; title?: string; attention?: number }

export async function enrichLeader(id: string, opts: { force?: boolean } = {}): Promise<EnrichResult> {
  const { rows } = await db.query('SELECT id, name, country, wiki_title, bio, summary, photo_url, enriched_at FROM politicians WHERE id = $1', [id])
  if (rows.length === 0) return { matched: false }
  const p = rows[0]

  let title: string | null = p.wiki_title
  let summary: WikiSummary | null = null

  if (!title || opts.force) {
    summary = await findSummary(p.name, p.country)
    title = summary?.title || null
    if (!title) {
      await db.query('UPDATE politicians SET enriched_at = NOW() WHERE id = $1', [id])
      return { matched: false }
    }
  } else {
    summary = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  }

  const attention = await pageviews30d(title)
  let born: string | null = null
  let netWorth: number | null = null
  if (summary?.wikibase_item) {
    await sleep(100)
    const wd = await wikidata(summary.wikibase_item)
    born = wd.born
    netWorth = wd.netWorth
  }

  // Use the REST API's thumbnail URL verbatim: Wikimedia only serves pre-rendered widths.
  const photo: string | null = summary?.thumbnail?.source || null

  await db.query(
    `UPDATE politicians SET
       wiki_title = $1,
       wiki_url = COALESCE($2, wiki_url),
       summary = COALESCE($3, summary),
       photo_url = COALESCE($4, photo_url),
       born = COALESCE($5, born),
       age = CASE WHEN $5::date IS NOT NULL THEN EXTRACT(YEAR FROM age($5::date))::int ELSE age END,
       net_worth = COALESCE($6, net_worth),
       attention = $7,
       enriched_at = NOW()
     WHERE id = $8`,
    [title, summary?.content_urls?.desktop?.page || null, summary?.extract || null, photo, born, netWorth, attention, id]
  )

  const pageUrl = summary?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  const wp = { name: 'Wikipedia', url: pageUrl, license: LICENSES.wikipedia }
  if (summary?.extract) await recordSource(id, 'summary', { chars: summary.extract.length }, wp)
  if (photo) await recordSource(id, 'portrait', photo, { name: 'Wikipedia / Wikimedia Commons', url: pageUrl, license: 'See file page on Commons' })
  await recordSource(id, 'attention', attention, {
    name: 'Wikimedia Pageviews API', license: LICENSES.wikidata,
    url: `https://pageviews.wmcloud.org/?project=en.wikipedia.org&pages=${encodeURIComponent(title.replace(/ /g, '_'))}`,
  })
  if (netWorth != null && summary?.wikibase_item) await recordSource(id, 'net_worth', netWorth, { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${summary.wikibase_item}`, license: LICENSES.wikidata })

  return { matched: true, title, attention }
}

// ── Headlines (GDELT, no key; hard limit of one request per 5 seconds) ──
let gdeltChain: Promise<unknown> = Promise.resolve()
let gdeltLast = 0
const GDELT_GAP_MS = 5200

function gdeltFetch(url: string): Promise<any | null> {
  const run = async () => {
    const wait = gdeltLast + GDELT_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    gdeltLast = Date.now()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
      const text = await res.text()
      if (!res.ok || !text.trim().startsWith('{')) return undefined // rate-limited or error: do not cache
      return JSON.parse(text)
    } catch {
      return undefined
    }
  }
  const p = gdeltChain.then(run, run)
  gdeltChain = p.catch(() => undefined)
  return p
}

export interface Headline { title: string; url: string; source: string; date: string; image?: string | null }

const NEWS_TTL_MS = 6 * 60 * 60 * 1000
const NEWS_FAIL_TTL_MS = 60 * 60 * 1000

export async function getHeadlines(id: string): Promise<{ items: Headline[]; fetched_at: string }> {
  const { rows: cached } = await db.query('SELECT items, fetched_at FROM leader_news WHERE politician_id = $1', [id])
  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].fetched_at).getTime()
    const ttl = cached[0].items.length ? NEWS_TTL_MS : NEWS_FAIL_TTL_MS
    if (age < ttl) return { items: cached[0].items, fetched_at: cached[0].fetched_at }
  }

  const { rows } = await db.query('SELECT name FROM politicians WHERE id = $1', [id])
  if (rows.length === 0) return { items: [], fetched_at: new Date().toISOString() }

  const query = `"${rows[0].name}" sourcelang:english`
  const data = await gdeltFetch(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=12&format=json&sort=datedesc&timespan=30d`
  )
  if (data === undefined) {
    // Throttled or unreachable: serve whatever is cached, otherwise nothing, without poisoning the cache.
    return { items: cached[0]?.items || [], fetched_at: cached[0]?.fetched_at || new Date().toISOString(), stale: true } as any
  }
  const seen = new Set<string>()
  const items: Headline[] = (data?.articles || [])
    .filter((a: any) => a.title && a.url && !seen.has(a.domain) && seen.add(a.domain))
    .slice(0, 8)
    .map((a: any) => ({
      title: String(a.title).trim(),
      url: a.url,
      source: a.domain,
      date: a.seendate ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}` : '',
      image: a.socialimage || null,
    }))

  await db.query(
    `INSERT INTO leader_news (politician_id, items, fetched_at) VALUES ($1, $2, NOW())
     ON CONFLICT (politician_id) DO UPDATE SET items = EXCLUDED.items, fetched_at = NOW()`,
    [id, JSON.stringify(items)]
  )
  return { items, fetched_at: new Date().toISOString() }
}
