import readline from 'readline'
import { Readable } from 'stream'
import { Agent } from 'undici'
import { db } from '../db/client'
import { recordSource } from './provenance'
import { recalculateScore, loadScoreConfig } from './score'

const UA = 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)'
const agent = new Agent({ connect: { timeout: 30000 }, bodyTimeout: 0, headersTimeout: 60000 })
const DATASETS = {
  sanctions: 'https://data.opensanctions.org/datasets/latest/sanctions/entities.ftm.json',
  peps: 'https://data.opensanctions.org/datasets/latest/wd_peps/entities.ftm.json',
}
export const LICENSE = 'OpenSanctions, CC BY-NC 4.0 (source records carry their own terms)'
export const entityUrl = (id: string) => `https://www.opensanctions.org/entities/${encodeURIComponent(id)}/`

/**
 * Only listings from these authorities move the TruthScore. Several states sanction foreign officials as
 * retaliation (Russia, China, Belarus, Iran, Venezuela and others list Western politicians); those listings are
 * shown with their issuing authority but not scored. Dataset codes are OpenSanctions' own.
 */
export const SCORED_DATASET_PREFIXES = ['un_', 'eu_', 'us_', 'gb_', 'ca_', 'au_', 'ch_', 'jp_', 'nz_']
export const SCORED_AUTHORITY_LABEL = 'UN, EU, US, UK, Canada, Australia, Switzerland, Japan and New Zealand'
export const isScoredDataset = (datasets: string[]) => datasets.some(d => SCORED_DATASET_PREFIXES.some(p => d.startsWith(p)))

async function streamLines(url: string, onLine: (line: string) => void): Promise<number> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, dispatcher: agent } as any)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  const rl = readline.createInterface({ input: Readable.fromWeb(res.body as any), crlfDelay: Infinity })
  let n = 0
  for await (const line of rl) { if (line) { onLine(line); n++ } }
  return n
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const yearOf = (d?: string) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null)

interface Leader { id: string; name: string; aliases: string[]; year: number | null; country: string | null; qid: string | null }
interface Match { leader: Leader; entityId: string; tier: 'wikidata' | 'name+birth' | 'tokens+birth' | 'name+country'; topics: string[]; sourceUrls: string[]; datasets: string[] }

const RELATIONS: Record<string, [string, string]> = {
  Family: ['person', 'relative'], Associate: ['person', 'associate'], Ownership: ['owner', 'asset'],
  Directorship: ['director', 'organization'], Membership: ['member', 'organization'], Employment: ['employer', 'employee'],
  UnknownLink: ['subject', 'object'], Representation: ['agent', 'client'],
}

export async function syncOpenSanctions(log: (m: string) => void = () => undefined) {
  const { rows } = await db.query(
    `SELECT id, name, aliases, EXTRACT(YEAR FROM born)::int AS year, country_code, wikidata_id FROM politicians WHERE wikidata_id IS NOT NULL`
  )
  const leaders: Leader[] = rows.map(r => ({ id: r.id, name: r.name, aliases: r.aliases || [], year: r.year, country: r.country_code ? r.country_code.toLowerCase() : null, qid: r.wikidata_id }))
  const byQid = new Map(leaders.map(l => [l.qid!, l]))
  const byYear = new Map<number, Leader[]>()
  for (const l of leaders) if (l.year) byYear.set(l.year, [...(byYear.get(l.year) || []), l])
  const byName = new Map<string, Leader[]>()
  for (const l of leaders) for (const n of [l.name, ...l.aliases]) { const k = norm(n); if (k.length > 5) byName.set(k, [...(byName.get(k) || []), l]) }
  // ISO3 -> ISO2 is needed to compare with OpenSanctions country codes; derive from the sanctions file's own nationality data is impossible, so use a small table.
  const iso2 = await isoMap()

  const captions = new Map<string, { name: string; schema: string; topics: string[] }>()
  const relations: { schema: string; a: string; b: string; role: string | null; sourceUrl: string | null; id: string }[] = []
  const sanctions: any[] = []
  const matches = new Map<string, Match>() // entityId -> match

  const consider = (e: any) => {
    const p = e.properties || {}
    const qids: string[] = p.wikidataId || []
    const names: string[] = [...(p.name || []), ...(p.alias || [])]
    const years = (p.birthDate || []).map(yearOf).filter((y: any) => y)
    const countries: string[] = [...(p.nationality || []), ...(p.country || []), ...(p.citizenship || [])].map((c: string) => c.toLowerCase())
    let found: Leader | null = null, tier: Match['tier'] | null = null
    for (const q of qids) { const l = byQid.get(q); if (l) { found = l; tier = 'wikidata'; break } }
    if (!found) {
      for (const n of names) {
        const cands = byName.get(norm(n)) || []
        for (const l of cands) {
          if (l.year && years.length) { if (years.includes(l.year)) { found = l; tier = 'name+birth'; break } }
          else if (!years.length && l.country && countries.includes(iso2[l.country] || '')) { found = l; tier = 'name+country'; break }
        }
        if (found) break
      }
    }
    // Token tier: every token of the leader's name appears in one of the entity's names, and the birth year matches.
    if (!found) {
      const nameTokens = names.map(n => new Set(norm(n).split(' ')))
      for (const y of years) {
        for (const l of byYear.get(y) || []) {
          const toks = norm(l.name).split(' ').filter(t => t.length > 1)
          if (toks.length >= 2 && nameTokens.some(set => toks.every(t => set.has(t)))) { found = l; tier = 'tokens+birth'; break }
        }
        if (found) break
      }
    }
    if (found && tier) {
      const existing = matches.get(e.id)
      if (!existing) matches.set(e.id, { leader: found, entityId: e.id, tier, topics: p.topics || [], sourceUrls: p.sourceUrl || [], datasets: e.datasets || [] })
    }
  }

  log('streaming sanctions dataset')
  const nS = await streamLines(DATASETS.sanctions, line => {
    if (line.includes('"schema":"Address"')) return
    let e: any
    try { e = JSON.parse(line) } catch { return }
    captions.set(e.id, { name: e.caption, schema: e.schema, topics: e.properties?.topics || [] })
    if (e.schema === 'Person') consider(e)
    else if (e.schema === 'Sanction') sanctions.push(e)
    else if (RELATIONS[e.schema]) {
      const [ka, kb] = RELATIONS[e.schema]
      const a = e.properties?.[ka]?.[0], b = e.properties?.[kb]?.[0]
      if (a && b) relations.push({ schema: e.schema, a, b, role: e.properties?.relationship?.[0] || e.properties?.role?.[0] || null, sourceUrl: e.properties?.sourceUrl?.[0] || null, id: e.id })
    }
  })
  log(`sanctions: ${nS} lines, ${matches.size} matched persons, ${sanctions.length} sanction records, ${relations.length} relations`)

  // PEP status from the Wikidata-derived PEP dataset (ids are QIDs)
  const peps = new Map<string, { position: string[]; topics: string[] }>()
  log('streaming wd_peps dataset')
  const nP = await streamLines(DATASETS.peps, line => {
    if (!line.startsWith('{"id":"Q') || !line.includes('"schema":"Person"')) return
    const idEnd = line.indexOf('"', 8)
    const qid = line.slice(7, idEnd)
    if (!byQid.has(qid)) return
    try { const e = JSON.parse(line); peps.set(qid, { position: e.properties?.position || [], topics: e.properties?.topics || [] }) } catch { /* skip */ }
  })
  log(`wd_peps: ${nP} lines, ${peps.size} of our leaders listed as PEPs`)

  // Write results
  const now = new Date()
  const byLeader = new Map<string, Match[]>()
  for (const m of matches.values()) byLeader.set(m.leader.id, [...(byLeader.get(m.leader.id) || []), m])
  let flagged = 0, edges = 0

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM flags')
    await client.query('DELETE FROM network_edges')
    for (const l of leaders) {
      const ms = byLeader.get(l.id) || []
      let osId: string | null = null
      for (const m of ms) {
        osId = osId || m.entityId
        const src = m.sourceUrls[0] || entityUrl(m.entityId)
        const recs = sanctions.filter(s => (s.properties?.entity || []).includes(m.entityId))
        if (recs.length) {
          for (const s of recs) {
            const p = s.properties || {}
            await client.query(
              `INSERT INTO flags (politician_id, kind, entity_id, authority, program, reason, start_date, listing_date, dataset, match_tier, source_url, scored)
               VALUES ($1, 'sanction', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [l.id, m.entityId, p.authority?.[0] || null, p.program?.[0] || p.programId?.[0] || null, p.reason?.[0] || p.summary?.[0] || null,
               p.startDate?.[0]?.slice(0, 10) || null, p.listingDate?.[0]?.slice(0, 10) || null, (s.datasets || [])[0] || null, m.tier, p.sourceUrl?.[0] || src, isScoredDataset(s.datasets || [])]
            )
          }
        } else if (m.topics.includes('sanction')) {
          await client.query(
            `INSERT INTO flags (politician_id, kind, entity_id, authority, program, dataset, match_tier, source_url, scored) VALUES ($1, 'sanction', $2, $3, NULL, $4, $5, $6, $7)`,
            [l.id, m.entityId, m.datasets.join(', ') || null, m.datasets[0] || null, m.tier, src, isScoredDataset(m.datasets)]
          )
        }
        for (const t of m.topics.filter(t => t.startsWith('crime'))) {
          await client.query(`INSERT INTO flags (politician_id, kind, entity_id, program, dataset, match_tier, source_url) VALUES ($1, 'crime', $2, $3, $4, $5, $6)`,
            [l.id, m.entityId, t, m.datasets[0] || null, m.tier, src])
        }
        // Connected entities
        for (const r of relations) {
          const other = r.a === m.entityId ? r.b : r.b === m.entityId ? r.a : null
          if (!other) continue
          const cap = captions.get(other)
          if (!cap) continue
          await client.query(
            `INSERT INTO network_edges (politician_id, relation, role, other_id, other_name, other_schema, other_topics, source_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (politician_id, other_id, relation) DO NOTHING`,
            [l.id, r.schema.toLowerCase(), r.role, other, cap.name, cap.schema, cap.topics, r.sourceUrl || entityUrl(r.id)]
          )
          edges++
        }
      }
      const pep = peps.get(l.qid!)
      if (pep) {
        await client.query(`INSERT INTO flags (politician_id, kind, entity_id, program, dataset, match_tier, source_url) VALUES ($1, 'pep', $2, $3, 'wd_peps', 'wikidata', $4)`,
          [l.id, l.qid, pep.position.slice(0, 3).join('; ') || null, entityUrl(l.qid!)])
      }
      if (ms.length || pep) flagged++
      await client.query(`UPDATE politicians SET opensanctions_id = $1, opensanctions_checked_at = $2 WHERE id = $3`, [osId || (pep ? l.qid : null), now, l.id])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Provenance + score for sanctioned leaders
  const cfg = await loadScoreConfig()
  for (const l of leaders) {
    const ms = byLeader.get(l.id) || []
    const pep = peps.get(l.qid!)
    if (ms.length || pep) {
      await recordSource(l.id, 'flags', { sanctions_entities: ms.map(m => m.entityId), pep: !!pep }, { name: 'OpenSanctions', url: entityUrl(ms[0]?.entityId || l.qid!), license: LICENSE })
    }
    await recalculateScore(l.id, cfg)
  }
  return { leaders: leaders.length, matched: matches.size, flagged, peps: peps.size, edges }
}

async function isoMap(): Promise<Record<string, string>> {
  // ISO3 -> ISO2 for the countries on file; a compact static table covers the common ones.
  const table: Record<string, string> = {
    AFG: 'af', ALB: 'al', DZA: 'dz', AND: 'ad', AGO: 'ao', ATG: 'ag', ARG: 'ar', ARM: 'am', AUS: 'au', AUT: 'at', AZE: 'az', BHS: 'bs', BHR: 'bh', BGD: 'bd', BRB: 'bb', BLR: 'by', BEL: 'be', BLZ: 'bz', BEN: 'bj', BTN: 'bt', BOL: 'bo', BIH: 'ba', BWA: 'bw', BRA: 'br', BRN: 'bn', BGR: 'bg', BFA: 'bf', BDI: 'bi', CPV: 'cv', KHM: 'kh', CMR: 'cm', CAN: 'ca', CAF: 'cf', TCD: 'td', CHL: 'cl', CHN: 'cn', COL: 'co', COM: 'km', COD: 'cd', COG: 'cg', CRI: 'cr', CIV: 'ci', HRV: 'hr', CUB: 'cu', CYP: 'cy', CZE: 'cz', DNK: 'dk', DJI: 'dj', DMA: 'dm', DOM: 'do', ECU: 'ec', EGY: 'eg', SLV: 'sv', GNQ: 'gq', ERI: 'er', EST: 'ee', SWZ: 'sz', ETH: 'et', FJI: 'fj', FIN: 'fi', FRA: 'fr', GAB: 'ga', GMB: 'gm', GEO: 'ge', DEU: 'de', GHA: 'gh', GRC: 'gr', GRD: 'gd', GTM: 'gt', GIN: 'gn', GNB: 'gw', GUY: 'gy', HTI: 'ht', HND: 'hn', HUN: 'hu', ISL: 'is', IND: 'in', IDN: 'id', IRN: 'ir', IRQ: 'iq', IRL: 'ie', ISR: 'il', ITA: 'it', JAM: 'jm', JPN: 'jp', JOR: 'jo', KAZ: 'kz', KEN: 'ke', KIR: 'ki', KWT: 'kw', KGZ: 'kg', LAO: 'la', LVA: 'lv', LBN: 'lb', LSO: 'ls', LBR: 'lr', LBY: 'ly', LIE: 'li', LTU: 'lt', LUX: 'lu', MDG: 'mg', MWI: 'mw', MYS: 'my', MDV: 'mv', MLI: 'ml', MLT: 'mt', MHL: 'mh', MRT: 'mr', MUS: 'mu', MEX: 'mx', FSM: 'fm', MDA: 'md', MCO: 'mc', MNG: 'mn', MNE: 'me', MAR: 'ma', MOZ: 'mz', MMR: 'mm', NAM: 'na', NRU: 'nr', NPL: 'np', NLD: 'nl', NZL: 'nz', NIC: 'ni', NER: 'ne', NGA: 'ng', PRK: 'kp', MKD: 'mk', NOR: 'no', OMN: 'om', PAK: 'pk', PLW: 'pw', PSE: 'ps', PAN: 'pa', PNG: 'pg', PRY: 'py', PER: 'pe', PHL: 'ph', POL: 'pl', PRT: 'pt', QAT: 'qa', ROU: 'ro', RUS: 'ru', RWA: 'rw', KNA: 'kn', LCA: 'lc', VCT: 'vc', WSM: 'ws', SMR: 'sm', STP: 'st', SAU: 'sa', SEN: 'sn', SRB: 'rs', SYC: 'sc', SLE: 'sl', SGP: 'sg', SVK: 'sk', SVN: 'si', SLB: 'sb', SOM: 'so', ZAF: 'za', KOR: 'kr', SSD: 'ss', ESP: 'es', LKA: 'lk', SDN: 'sd', SUR: 'sr', SWE: 'se', CHE: 'ch', SYR: 'sy', TWN: 'tw', TJK: 'tj', TZA: 'tz', THA: 'th', TLS: 'tl', TGO: 'tg', TON: 'to', TTO: 'tt', TUN: 'tn', TUR: 'tr', TKM: 'tm', TUV: 'tv', UGA: 'ug', UKR: 'ua', ARE: 'ae', GBR: 'gb', USA: 'us', URY: 'uy', UZB: 'uz', VUT: 'vu', VAT: 'va', VEN: 've', VNM: 'vn', YEM: 'ye', ZMB: 'zm', ZWE: 'zw', XKS: 'xk', XKX: 'xk',
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(table)) out[k.toLowerCase()] = v
  return out
}

export async function getFlags(politicianId: string) {
  const [{ rows: p }, { rows: flags }, { rows: edges }] = await Promise.all([
    db.query('SELECT opensanctions_id, opensanctions_checked_at FROM politicians WHERE id = $1', [politicianId]),
    db.query(`SELECT kind, entity_id, authority, program, reason, start_date::text, listing_date::text, dataset, match_tier, source_url, scored, fetched_at FROM flags WHERE politician_id = $1 ORDER BY kind, scored DESC, listing_date DESC NULLS LAST`, [politicianId]),
    db.query(`SELECT relation, role, other_id, other_name, other_schema, other_topics, source_url FROM network_edges WHERE politician_id = $1 ORDER BY relation, other_name LIMIT 60`, [politicianId]),
  ])
  return { opensanctions_id: p[0]?.opensanctions_id || null, checked_at: p[0]?.opensanctions_checked_at || null, flags, edges, scored_authorities: SCORED_AUTHORITY_LABEL }
}
