import { db } from '../db/client'
import { fetchJson, sleep } from './jobs'
import { LICENSES, recordSource } from './provenance'

const SPARQL = 'https://query.wikidata.org/sparql'
const WD = (qid: string) => `https://www.wikidata.org/wiki/${qid}`

async function sparql(query: string): Promise<any[]> {
  const data = await fetchJson(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, { retries: 2, timeoutMs: 45000 })
  return data?.results?.bindings || []
}

const qidOf = (uri?: string) => (uri ? uri.replace(/^.*\/(Q\d+)$/, '$1') : null)
// Wikidata can return an unknown-value node instead of a date; only accept real ISO dates.
const dateOf = (v?: string) => (v && /^[+-]?\d{4}-\d{2}-\d{2}/.test(v) ? v.replace(/^\+/, '').slice(0, 10) : null)

// Head-of-government style offices outrank seats, memberships and party roles when picking the current office.
const OFFICE_RANK = [
  'president', 'prime minister', 'chancellor', 'king', 'queen', 'emir', 'sultan', 'supreme leader', 'general secretary',
  'taoiseach', 'premier', 'head of government', 'chief executive', 'secretary-general', 'secretary general', 'governor', 'chief justice',
  'justice', 'pope', 'patriarch', 'minister', 'secretary of state', 'secretary', 'mayor', 'leader of the opposition', 'leader',
  'chairman', 'chairperson', 'senator', 'member of parliament', 'member of the house', 'member of the national assembly',
  'member of the legislative', 'deputy', 'councillor',
]
// Procedural or honorary entries that should never be shown as someone's office.
const OFFICE_IGNORE = ['crown steward', 'privy council', 'honorary', 'freeman']
function officeRank(label: string): number {
  const l = label.toLowerCase()
  const i = OFFICE_RANK.findIndex(k => l.includes(k))
  return i === -1 ? OFFICE_RANK.length : i
}

async function resolveQid(p: { id: string; name: string; country: string | null; wiki_title: string | null; wikidata_id: string | null }): Promise<string | null> {
  if (p.wikidata_id) return p.wikidata_id
  if (p.wiki_title) {
    const s = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki_title.replace(/ /g, '_'))}`, { retries: 1 })
    if (s?.wikibase_item) return s.wikibase_item
  }
  // Last resort: Wikidata search, only accepting a human whose description looks like a public figure.
  const r = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(p.name)}&language=en&limit=5&format=json`, { retries: 1 })
  for (const hit of r?.search || []) {
    const d = String(hit.description || '').toLowerCase()
    if (/politic|president|minister|member of|senator|governor|mayor|judge|business|executive|journalist|monarch|king|queen/.test(d) &&
        (!p.country || d.includes(p.country.toLowerCase()) || !/canadian|american|british/.test(d))) {
      return hit.id
    }
  }
  return null
}

export interface WikidataSync { qid: string | null; positions: number; office?: string | null }

export async function syncWikidata(politicianId: string): Promise<WikidataSync> {
  const { rows } = await db.query('SELECT id, name, country, wiki_title, wikidata_id, party, photo_url, born FROM politicians WHERE id = $1', [politicianId])
  if (rows.length === 0) return { qid: null, positions: 0 }
  const p = rows[0]
  const qid = await resolveQid(p)
  if (!qid) {
    await db.query('UPDATE politicians SET wikidata_synced_at = NOW() WHERE id = $1', [politicianId])
    return { qid: null, positions: 0 }
  }

  const positions = await sparql(`
    SELECT ?pos ?posLabel ?start ?end ?replaces ?replacesLabel ?replacedBy ?replacedByLabel ?iso3 WHERE {
      wd:${qid} p:P39 ?st . ?st ps:P39 ?pos .
      OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
      OPTIONAL { ?st pq:P1365 ?replaces } OPTIONAL { ?st pq:P1366 ?replacedBy }
      OPTIONAL { ?pos wdt:P1001 ?j . ?j wdt:P298 ?iso3 }
      OPTIONAL { ?pos wdt:P17 ?c . ?c wdt:P298 ?iso3 }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    } ORDER BY DESC(?start)`)
  await sleep(600)
  const basics = await sparql(`
    SELECT ?party ?partyLabel ?country ?countryLabel ?iso3 ?dob ?image WHERE {
      OPTIONAL { wd:${qid} p:P102 ?ps . ?ps ps:P102 ?party . FILTER NOT EXISTS { ?ps pq:P582 ?pe } }
      OPTIONAL { wd:${qid} wdt:P27 ?country . OPTIONAL { ?country wdt:P298 ?iso3 } }
      OPTIONAL { wd:${qid} wdt:P569 ?dob }
      OPTIONAL { wd:${qid} wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }`)
  const b = basics[0] || {}
  // Citizenship: prefer the one matching the country on file (people hold several).
  const norm = (s: string) => s.toLowerCase().replace(/^the /, '').replace(' of america', '').replace('people\'s republic of ', '').trim()
  const citizenships = basics.filter(x => x.countryLabel?.value).map(x => ({ label: x.countryLabel.value as string, iso3: (x.iso3?.value as string) || null }))
  const matchingCitizenship = p.country ? citizenships.find(c => norm(c.label) === norm(p.country) || norm(c.label).includes(norm(p.country)) || norm(p.country).includes(norm(c.label))) : null
  const source = { name: 'Wikidata', url: WD(qid), license: LICENSES.wikidata }

  // Office history: replace wholesale so removals on Wikidata propagate.
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM positions WHERE politician_id = $1', [politicianId])
    const seen = new Set<string>()
    for (const r of positions) {
      const posQid = qidOf(r.pos?.value)
      const label = r.posLabel?.value || posQid || 'Unknown office'
      const start = dateOf(r.start?.value)
      const key = `${posQid}|${start}`
      if (seen.has(key)) continue
      seen.add(key)
      await client.query(
        `INSERT INTO positions (politician_id, position_qid, position_label, start_date, end_date, replaces_qid, replaces_label, replaced_by_qid, replaced_by_label, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [politicianId, posQid, label, start, dateOf(r.end?.value), qidOf(r.replaces?.value), r.replacesLabel?.value || null, qidOf(r.replacedBy?.value), r.replacedByLabel?.value || null, WD(qid)]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Current office: open-ended positions first, ranked by office type, then most recent start.
  const held = positions
    .map(r => ({ label: r.posLabel?.value || '', start: dateOf(r.start?.value), end: dateOf(r.end?.value), iso3: (r.iso3?.value as string) || null }))
    .filter(h => !OFFICE_IGNORE.some(k => h.label.toLowerCase().includes(k)))
  const open = held.filter(h => !h.end)
  const pick = (open.length ? open : held).sort((a, b) => officeRank(a.label) - officeRank(b.label) || (b.start || '').localeCompare(a.start || ''))[0]

  // Country code: the current office's jurisdiction, else the matching citizenship, else the first citizenship.
  const iso3 = pick?.iso3 || matchingCitizenship?.iso3 || citizenships[0]?.iso3 || null
  const countryLabel = matchingCitizenship?.label || citizenships[0]?.label || null
  const dob = dateOf(b.dob?.value)
  const partyLabel = b.partyLabel?.value && !/^Q\d+$/.test(b.partyLabel.value) ? b.partyLabel.value : null
  const image = b.image?.value ? `${b.image.value.replace(/^http:/, 'https:')}?width=480` : null

  await db.query(
    `UPDATE politicians SET
       wikidata_id = $1,
       born = COALESCE($2, born),
       age = CASE WHEN $2::date IS NOT NULL THEN EXTRACT(YEAR FROM age($2::date))::int ELSE age END,
       party = COALESCE(party, $3),
       country_code = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE country_code END,
       current_office = $5,
       term_start = $6,
       term_end = $7,
       photo_url = COALESCE(photo_url, $8),
       wikidata_synced_at = NOW()
     WHERE id = $9`,
    [qid, dob, partyLabel, iso3, pick?.label || null, pick?.start || null, pick?.end || null, image, politicianId]
  )

  await recordSource(politicianId, 'positions', { count: positions.length }, source)
  if (dob) await recordSource(politicianId, 'born', dob, source)
  if (partyLabel) await recordSource(politicianId, 'party', partyLabel, source)
  if (countryLabel) await recordSource(politicianId, 'country', { name: countryLabel, iso3 }, source)
  if (pick) await recordSource(politicianId, 'current_office', { office: pick.label, start: pick.start, end: pick.end }, source)
  if (image && !p.photo_url) await recordSource(politicianId, 'portrait', image, { name: 'Wikimedia Commons', url: b.image.value, license: 'See file page' })

  return { qid, positions: positions.length, office: pick?.label || null }
}

export async function getPositions(politicianId: string) {
  const { rows } = await db.query(
    `SELECT position_label, start_date, end_date, replaces_label, replaced_by_label, position_qid, source_url, fetched_at
     FROM positions WHERE politician_id = $1
     ORDER BY end_date IS NULL DESC, start_date DESC NULLS LAST`,
    [politicianId]
  )
  return rows
}
