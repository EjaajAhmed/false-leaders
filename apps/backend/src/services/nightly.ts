import { db } from '../db/client'
import { registerJob, sleep } from './jobs'
import { syncWikidata } from './wikidata'
import { syncCountry } from './worldbank'
import { enrichLeader } from './enrich'

// Wikidata: refresh identity and office history for anyone not synced in 7 days.
registerJob('wikidata', async (log) => {
  const { rows } = await db.query(
    `SELECT id, name FROM politicians WHERE wikidata_synced_at IS NULL OR wikidata_synced_at < NOW() - INTERVAL '7 days'
     ORDER BY prominence DESC, name ASC`
  )
  let matched = 0, missed = 0
  for (const [i, r] of rows.entries()) {
    try {
      const res = await syncWikidata(r.id)
      if (res.qid) matched++; else missed++
    } catch (err: any) {
      missed++; log(`${r.name}: ${err?.message || err}`)
    }
    if ((i + 1) % 25 === 0) log(`${i + 1}/${rows.length} matched ${matched} missed ${missed}`)
    await sleep(900)
  }
  return { total: rows.length, matched, missed }
})

// World Bank: refresh every country on file not fetched in 30 days.
registerJob('worldbank', async (log) => {
  const { rows } = await db.query(
    `SELECT DISTINCT p.country_code FROM politicians p
     WHERE p.country_code IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM country_indicators c WHERE c.country_code = p.country_code AND c.fetched_at > NOW() - INTERVAL '30 days'
     ) ORDER BY 1`
  )
  let total = 0
  let failed = 0
  for (const r of rows) {
    let res: { rows: number } | null = null
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try { res = await syncCountry(r.country_code) } catch (err: any) { log(`${r.country_code}: ${err?.message || err} (attempt ${attempt + 1})`); await sleep(2000 * (attempt + 1)) }
    }
    if (res) { total += res.rows; log(`${r.country_code}: ${res.rows} rows`) } else failed++
  }
  return { countries: rows.length, rows: total, failed }
})

// Wikipedia: attention (page views) and summaries, monthly-ish.
registerJob('wikipedia', async (log) => {
  const { rows } = await db.query(
    `SELECT id FROM politicians WHERE enriched_at IS NULL OR enriched_at < NOW() - INTERVAL '14 days' ORDER BY prominence DESC`
  )
  let matched = 0
  for (const [i, r] of rows.entries()) {
    const res = await enrichLeader(r.id)
    if (res.matched) matched++
    if ((i + 1) % 50 === 0) log(`${i + 1}/${rows.length}`)
    await sleep(150)
  }
  return { total: rows.length, matched }
})

export const NIGHTLY_ORDER = ['wikidata', 'worldbank', 'wikipedia']
