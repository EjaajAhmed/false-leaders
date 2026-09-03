import fs from 'fs'
import { db } from '../db/client'
import { sleep } from './jobs'

export interface GovDataset {
  code: string
  label: string
  short: string
  scale: string
  min: number
  max: number
  decimals: number
  source_name: string
  original: string
  page_url: string
  csv_url: string
  license: string
  value_col: string
}

// Yearly bulk datasets. Our World in Data republishes each under CC BY with the original citation.
export const GOV_DATASETS: GovDataset[] = [
  {
    code: 'VDEM_LIBDEM', label: 'Liberal democracy index', short: 'Democracy', scale: '0–1', min: 0, max: 1, decimals: 2,
    source_name: 'V-Dem (via Our World in Data)', original: 'Varieties of Democracy (V-Dem) Institute',
    page_url: 'https://ourworldindata.org/grapher/liberal-democracy-index',
    csv_url: 'https://ourworldindata.org/grapher/liberal-democracy-index.csv?v=1&csvType=full&useColumnShortNames=true',
    license: 'CC BY 4.0', value_col: 'libdem_vdem__estimate_best',
  },
  {
    code: 'FH_POLRIGHTS', label: 'Political rights score', short: 'Political rights', scale: '0–40', min: 0, max: 40, decimals: 0,
    source_name: 'Freedom House (via Our World in Data)', original: 'Freedom House, Freedom in the World',
    page_url: 'https://ourworldindata.org/grapher/political-rights-score-fh',
    csv_url: 'https://ourworldindata.org/grapher/political-rights-score-fh.csv?v=1&csvType=full&useColumnShortNames=true',
    license: 'CC BY 4.0', value_col: 'polrights_score',
  },
  {
    code: 'FH_CIVLIBS', label: 'Civil liberties score', short: 'Civil liberties', scale: '0–60', min: 0, max: 60, decimals: 0,
    source_name: 'Freedom House (via Our World in Data)', original: 'Freedom House, Freedom in the World',
    page_url: 'https://ourworldindata.org/grapher/civil-liberties-score-fh',
    csv_url: 'https://ourworldindata.org/grapher/civil-liberties-score-fh.csv?v=1&csvType=full&useColumnShortNames=true',
    license: 'CC BY 4.0', value_col: 'civlibs_score',
  },
  {
    // RSF changed methodology in 2022 (higher is now better). Only 2022+ is imported, straight from RSF's yearly files.
    code: 'RSF_PRESS', label: 'Press freedom score', short: 'Press freedom', scale: '0–100 (2022 methodology)', min: 0, max: 100, decimals: 1,
    source_name: 'Reporters Without Borders', original: 'Reporters Without Borders, World Press Freedom Index',
    page_url: 'https://rsf.org/en/index',
    csv_url: 'https://rsf.org/sites/default/files/import_classement/{year}.csv',
    license: 'RSF, cited with attribution', value_col: 'Score',
  },
  {
    code: 'TI_CPI', label: 'Corruption Perceptions Index', short: 'Corruption perception', scale: '0–100', min: 0, max: 100, decimals: 0,
    source_name: 'Transparency International (via Our World in Data)', original: 'Transparency International, Corruption Perceptions Index',
    page_url: 'https://ourworldindata.org/grapher/ti-corruption-perception-index',
    csv_url: 'https://ourworldindata.org/grapher/ti-corruption-perception-index.csv?v=1&csvType=full&useColumnShortNames=true',
    license: 'CC BY 4.0', value_col: 'cpi_score',
  },
]

/** Minimal CSV parser (RFC 4180 quoting). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some(f => f !== '')) rows.push(row)
  return rows
}

async function loadText(source: string): Promise<string> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: { 'User-Agent': 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)' }, signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source}`)
    return await res.text()
  }
  return fs.readFileSync(source, 'utf8')
}

/**
 * Import one dataset from its URL (default) or a local CSV path. Rerunnable: rows are upserted by (country, indicator, year).
 * Expects Our World in Data's layout: entity, code, year, <value>. Rows without a 3-letter ISO code (regions) are skipped.
 */
async function upsertRows(ds: GovDataset, entries: { iso: string; year: number; value: number }[]) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const e of entries) {
      await client.query(
        `INSERT INTO country_indicators (country_code, indicator, year, value, source_name, source_url, license, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (country_code, indicator, year) DO UPDATE SET value = EXCLUDED.value, source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url, license = EXCLUDED.license, fetched_at = NOW()`,
        [e.iso, ds.code, e.year, e.value, ds.source_name, ds.page_url, ds.license]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** RSF's own yearly file: semicolon-separated, columns ISO and "Score <year>" (or "Score"). */
async function importRsf(ds: GovDataset, source?: string): Promise<{ code: string; rows: number; countries: number; years: string }> {
  const thisYear = new Date().getUTCFullYear()
  const years = source ? [Number((source.match(/(20\d\d)/) || [])[1]) || thisYear] : Array.from({ length: thisYear - 2021 }, (_, i) => 2022 + i)
  const entries: { iso: string; year: number; value: number }[] = []
  for (const year of years) {
    let text: string
    try { text = await loadText(source || ds.csv_url.replace('{year}', String(year))) } catch { continue }
    const rows = parseCsv(text, ';')
    const header = rows[0].map(h => h.trim())
    const iIso = header.findIndex(h => h.toUpperCase() === 'ISO')
    const iVal = header.findIndex(h => /^score/i.test(h))
    if (iIso < 0 || iVal < 0) continue
    for (const r of rows.slice(1)) {
      const iso = (r[iIso] || '').trim().toUpperCase()
      const value = Number(String(r[iVal] || '').replace(',', '.'))
      if (/^[A-Z]{3}$/.test(iso) && Number.isFinite(value)) entries.push({ iso, year, value })
    }
  }
  // Old-methodology rows (pre-2022, lower was better) must not be mixed in.
  await db.query(`DELETE FROM country_indicators WHERE indicator = $1 AND year < 2022`, [ds.code])
  await upsertRows(ds, entries)
  const ys = entries.map(e => e.year)
  return { code: ds.code, rows: entries.length, countries: new Set(entries.map(e => e.iso)).size, years: ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '' }
}

export async function importGovernance(code: string, source?: string): Promise<{ code: string; rows: number; countries: number; years: string }> {
  const ds = GOV_DATASETS.find(d => d.code === code)
  if (!ds) throw new Error(`Unknown dataset ${code}`)
  if (ds.code === 'RSF_PRESS') return importRsf(ds, source)
  const text = await loadText(source || ds.csv_url)
  const rows = parseCsv(text)
  const header = rows[0].map(h => h.trim().toLowerCase())
  const iCode = header.indexOf('code'), iYear = header.indexOf('year'), iVal = header.indexOf(ds.value_col.toLowerCase())
  if (iCode < 0 || iYear < 0 || iVal < 0) throw new Error(`${code}: expected columns code, year, ${ds.value_col}; got ${header.join(',')}`)

  const entries: { iso: string; year: number; value: number }[] = []
  for (const r of rows.slice(1)) {
    const iso = (r[iCode] || '').trim()
    const year = Number(r[iYear]), value = Number(r[iVal])
    if (!/^[A-Z]{3}$/.test(iso) || !Number.isFinite(year) || !Number.isFinite(value) || r[iVal] === '') continue
    if (year < 1990) continue
    entries.push({ iso, year, value })
  }
  await upsertRows(ds, entries)
  const ys = entries.map(e => e.year)
  return { code, rows: entries.length, countries: new Set(entries.map(e => e.iso)).size, years: ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '' }
}

export async function importAllGovernance(log: (m: string) => void = () => undefined) {
  const results = []
  for (const ds of GOV_DATASETS) {
    try {
      const r = await importGovernance(ds.code)
      log(`${ds.code}: ${r.rows} rows, ${r.countries} countries, ${r.years}`)
      results.push(r)
    } catch (err: any) {
      log(`${ds.code}: ${err?.message || err}`)
      results.push({ code: ds.code, error: err?.message || String(err) })
    }
    await sleep(500)
  }
  return results
}

export interface GovSeries {
  code: string
  label: string
  short: string
  scale: string
  min: number
  max: number
  decimals: number
  source_name: string
  original: string
  source_url: string
  license: string
  fetched_at: string
  base_year: number | null
  base_value: number | null
  latest_year: number | null
  latest_value: number | null
  delta: number | null
  points: { year: number; value: number }[]
}

// Wikidata ISO3 codes that differ from the ones used in the datasets
const ALT: Record<string, string> = { XKS: 'XKX' }

export async function getGovernance(politicianId: string) {
  const { rows } = await db.query('SELECT country, country_code, term_start, term_end FROM politicians WHERE id = $1', [politicianId])
  const p = rows[0]
  if (!p) return null
  if (!p.country_code) return { country: p.country, series: [], reason: 'No ISO country code on record.' }
  const code = ALT[p.country_code] || p.country_code
  const termYear = p.term_start ? new Date(p.term_start).getUTCFullYear() : null

  const { rows: data } = await db.query(
    `SELECT indicator, year, value, source_url, source_name, license, fetched_at FROM country_indicators
     WHERE country_code = $1 AND indicator = ANY($2) ORDER BY indicator, year`,
    [code, GOV_DATASETS.map(d => d.code)]
  )
  if (data.length === 0) return { country: p.country, series: [], base_year: termYear, reason: 'None of the four indices covers this country.' }

  const series: GovSeries[] = []
  for (const ds of GOV_DATASETS) {
    const pts = data.filter(d => d.indicator === ds.code).map(d => ({ year: Number(d.year), value: Number(d.value) }))
    if (pts.length === 0) continue
    const fromYear = termYear ? termYear - 3 : pts[pts.length - 1].year - 10
    const base = termYear ? [...pts].reverse().find(x => x.year <= termYear) || null : null
    const latest = pts[pts.length - 1]
    const src = data.find(d => d.indicator === ds.code)!
    series.push({
      code: ds.code, label: ds.label, short: ds.short, scale: ds.scale, min: ds.min, max: ds.max, decimals: ds.decimals,
      source_name: ds.source_name, original: ds.original, source_url: src.source_url, license: src.license, fetched_at: src.fetched_at,
      base_year: base?.year ?? null, base_value: base?.value ?? null,
      latest_year: latest.year, latest_value: latest.value,
      delta: base && latest.year > base.year ? Math.round((latest.value - base.value) * 1000) / 1000 : null,
      points: pts.filter(x => x.year >= fromYear),
    })
  }
  return { country: p.country, country_code: code, term_start: p.term_start, term_end: p.term_end, base_year: termYear, series }
}
