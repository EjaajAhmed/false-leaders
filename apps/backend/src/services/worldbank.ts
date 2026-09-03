import { db } from '../db/client'
import { fetchJson, sleep } from './jobs'
import { LICENSES } from './provenance'

export const WB_INDICATORS: Record<string, { label: string; unit: string; kind: 'level' | 'rate' }> = {
  'NY.GDP.PCAP.KD': { label: 'GDP per capita', unit: 'constant 2015 US$', kind: 'level' },
  'FP.CPI.TOTL.ZG': { label: 'Inflation', unit: '% per year', kind: 'rate' },
  'SL.UEM.TOTL.ZS': { label: 'Unemployment', unit: '% of labour force', kind: 'rate' },
  'SP.DYN.LE00.IN': { label: 'Life expectancy', unit: 'years', kind: 'level' },
}

// Wikidata ISO3 codes that differ from World Bank codes
const WB_CODE: Record<string, string> = { XKX: 'XKX', ROU: 'ROU', TLS: 'TLS', COD: 'COD', PSE: 'PSE' }

function apiUrl(code: string, indicator: string) {
  return `https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&per_page=80&date=1990:2030`
}

export async function syncCountry(iso3: string): Promise<{ rows: number }> {
  const code = WB_CODE[iso3] || iso3
  let count = 0
  for (const indicator of Object.keys(WB_INDICATORS)) {
    const data = await fetchJson(apiUrl(code, indicator), { retries: 2 })
    const rows: any[] = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : []
    for (const r of rows) {
      if (r.value == null) continue
      await db.query(
        `INSERT INTO country_indicators (country_code, indicator, year, value, source_name, source_url, license, fetched_at)
         VALUES ($1, $2, $3, $4, 'World Bank', $5, $6, NOW())
         ON CONFLICT (country_code, indicator, year) DO UPDATE SET value = EXCLUDED.value, fetched_at = NOW()`,
        [iso3, indicator, Number(r.date), Number(r.value), apiUrl(code, indicator), LICENSES.worldbank]
      )
      count++
    }
    await sleep(250)
  }
  return { rows: count }
}

export interface WatchSeries {
  indicator: string
  label: string
  unit: string
  kind: 'level' | 'rate'
  base_year: number | null
  base_value: number | null
  latest_year: number | null
  latest_value: number | null
  points: { year: number; value: number; indexed: number | null }[]
  source_url: string
  fetched_at: string
}

export async function getWatch(politicianId: string) {
  const { rows } = await db.query('SELECT country, country_code, term_start, term_end, current_office FROM politicians WHERE id = $1', [politicianId])
  const p = rows[0]
  if (!p) return null
  if (!p.country_code) return { country: p.country, country_code: null, term_start: p.term_start, series: [], reason: 'No ISO country code on record.' }

  const termYear = p.term_start ? new Date(p.term_start).getUTCFullYear() : null
  const { rows: data } = await db.query(
    `SELECT indicator, year, value, source_url, fetched_at FROM country_indicators
     WHERE country_code = $1 ORDER BY indicator, year`,
    [p.country_code]
  )
  if (data.length === 0) return { country: p.country, country_code: p.country_code, term_start: p.term_start, series: [], reason: 'The World Bank publishes no data for this country.' }

  const series: WatchSeries[] = []
  for (const [indicator, meta] of Object.entries(WB_INDICATORS)) {
    const pts = data.filter(d => d.indicator === indicator).map(d => ({ year: Number(d.year), value: Number(d.value) }))
    if (pts.length === 0) continue
    const fromYear = termYear ? termYear - 3 : Math.max(...pts.map(x => x.year)) - 10
    const window = pts.filter(x => x.year >= fromYear)
    // Base = term start year, or the nearest earlier year with data.
    let base = termYear ? [...pts].reverse().find(x => x.year <= termYear) || null : null
    if (!base && !termYear) base = window[0] || null
    const src = data.find(d => d.indicator === indicator)
    series.push({
      indicator, label: meta.label, unit: meta.unit, kind: meta.kind,
      base_year: base?.year ?? null, base_value: base?.value ?? null,
      latest_year: pts[pts.length - 1].year, latest_value: pts[pts.length - 1].value,
      points: window.map(x => ({ ...x, indexed: base && base.value ? (x.value / base.value) * 100 : null })),
      source_url: src.source_url, fetched_at: src.fetched_at,
    })
  }
  return { country: p.country, country_code: p.country_code, term_start: p.term_start, term_end: p.term_end, current_office: p.current_office, base_year: termYear, series }
}
