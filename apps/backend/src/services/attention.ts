import { db } from '../db/client'
import { fetchJson, sleep } from './jobs'
import { LICENSES, recordSource } from './provenance'

// Language editions considered, largest first. The English edition is always included when it exists.
const LANGS = ['en', 'es', 'de', 'fr', 'ru', 'zh', 'ja', 'pt', 'ar', 'hi', 'it', 'fa', 'tr', 'uk', 'pl', 'ko', 'id', 'vi', 'nl', 'he', 'sv', 'cs', 'hu', 'ro', 'el', 'th', 'bn', 'ms', 'sr', 'hr', 'da', 'fi', 'no', 'bg', 'sk', 'ka', 'hy', 'az', 'kk', 'uz', 'ur', 'am', 'sw', 'my', 'km', 'ne', 'si', 'ta', 'te', 'mr']
export const LANG_NAMES: Record<string, string> = { en: 'English', es: 'Spanish', de: 'German', fr: 'French', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', pt: 'Portuguese', ar: 'Arabic', hi: 'Hindi', it: 'Italian', fa: 'Persian', tr: 'Turkish', uk: 'Ukrainian', pl: 'Polish', ko: 'Korean', id: 'Indonesian', vi: 'Vietnamese', nl: 'Dutch', he: 'Hebrew', sv: 'Swedish', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', el: 'Greek', th: 'Thai', bn: 'Bengali', ms: 'Malay', sr: 'Serbian', hr: 'Croatian', da: 'Danish', fi: 'Finnish', no: 'Norwegian', bg: 'Bulgarian', sk: 'Slovak', ka: 'Georgian', hy: 'Armenian', az: 'Azerbaijani', kk: 'Kazakh', uz: 'Uzbek', ur: 'Urdu', am: 'Amharic', sw: 'Swahili', my: 'Burmese', km: 'Khmer', ne: 'Nepali', si: 'Sinhala', ta: 'Tamil', te: 'Telugu', mr: 'Marathi' }
// Main Wikipedia language of a country (ISO3), used to label the "home edition"
export const HOME_LANG: Record<string, string> = {
  USA: 'en', GBR: 'en', CAN: 'en', AUS: 'en', NZL: 'en', IRL: 'en', IND: 'hi', PAK: 'ur', BGD: 'bn', NGA: 'en', KEN: 'sw', ZAF: 'en', GHA: 'en',
  ESP: 'es', MEX: 'es', ARG: 'es', COL: 'es', CHL: 'es', PER: 'es', VEN: 'es', CUB: 'es', ECU: 'es', BOL: 'es', URY: 'es', PRY: 'es', GTM: 'es', HND: 'es', SLV: 'es', NIC: 'es', CRI: 'es', PAN: 'es', DOM: 'es',
  DEU: 'de', AUT: 'de', CHE: 'de', FRA: 'fr', BEL: 'nl', MCO: 'fr', SEN: 'fr', CIV: 'fr', MLI: 'fr', NER: 'fr', BFA: 'fr', TCD: 'fr', GAB: 'fr', COD: 'fr', COG: 'fr', CMR: 'fr', MDG: 'fr', TUN: 'ar', DZA: 'ar', MAR: 'ar',
  RUS: 'ru', BLR: 'ru', KAZ: 'kk', UZB: 'uz', KGZ: 'ru', TJK: 'ru', TKM: 'ru', UKR: 'uk', CHN: 'zh', TWN: 'zh', SGP: 'en', JPN: 'ja', KOR: 'ko', PRK: 'ko', PRT: 'pt', BRA: 'pt', AGO: 'pt', MOZ: 'pt',
  SAU: 'ar', EGY: 'ar', IRQ: 'ar', SYR: 'ar', JOR: 'ar', LBN: 'ar', ARE: 'ar', QAT: 'ar', KWT: 'ar', BHR: 'ar', OMN: 'ar', YEM: 'ar', LBY: 'ar', SDN: 'ar', PSE: 'ar', MRT: 'ar', IRN: 'fa', AFG: 'fa', TUR: 'tr', AZE: 'az', ARM: 'hy', GEO: 'ka',
  ITA: 'it', VAT: 'it', POL: 'pl', CZE: 'cs', SVK: 'sk', HUN: 'hu', ROU: 'ro', GRC: 'el', CYP: 'el', BGR: 'bg', SRB: 'sr', HRV: 'hr', BIH: 'sr', MNE: 'sr', SVN: 'sr', MKD: 'bg', ALB: 'el', XKX: 'sr', NLD: 'nl', SWE: 'sv', DNK: 'da', NOR: 'no', FIN: 'fi', ISL: 'da', EST: 'fi', LVA: 'ru', LTU: 'pl', MDA: 'ro', ISR: 'he',
  IDN: 'id', MYS: 'ms', VNM: 'vi', THA: 'th', KHM: 'km', MMR: 'my', LKA: 'si', NPL: 'ne', ETH: 'am', PHL: 'en',
}
const DAYS = 90
const UA = 'FalseLeaders/1.0 (https://falseleaders.com; noreply@falseleaders.com)'

const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

async function loadSitelinks(qid: string): Promise<Record<string, string>> {
  const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: { 'User-Agent': UA }, retries: 2 })
  const links = data?.entities?.[qid]?.sitelinks || {}
  const out: Record<string, string> = {}
  for (const [site, v] of Object.entries<any>(links)) {
    const m = site.match(/^([a-z]{2,3})wiki$/)
    if (m && v?.title) out[m[1]] = v.title
  }
  return out
}

export async function syncAttention(politicianId: string): Promise<{ langs: number; total_30d: number } | null> {
  const { rows } = await db.query('SELECT id, name, wikidata_id, wiki_title, country_code, wiki_sitelinks, wiki_sitelinks_at FROM politicians WHERE id = $1', [politicianId])
  const p = rows[0]
  if (!p?.wikidata_id) return null

  let sitelinks: Record<string, string> = p.wiki_sitelinks || {}
  if (!p.wiki_sitelinks_at || Date.now() - new Date(p.wiki_sitelinks_at).getTime() > 7 * 86400000) {
    sitelinks = await loadSitelinks(p.wikidata_id)
    if (p.wiki_title && !sitelinks.en) sitelinks.en = p.wiki_title
    await db.query('UPDATE politicians SET wiki_sitelinks = $1, wiki_sitelinks_at = NOW() WHERE id = $2', [JSON.stringify(sitelinks), politicianId])
    await sleep(100)
  }
  const home = HOME_LANG[p.country_code] || null
  const langs = LANGS.filter(l => sitelinks[l]).slice(0, 6)
  if (home && sitelinks[home] && !langs.includes(home)) langs.push(home)
  if (langs.length === 0) return { langs: 0, total_30d: 0 }

  const end = new Date(Date.now() - 86400000)
  const start = new Date(end.getTime() - (DAYS - 1) * 86400000)
  let total30 = 0
  const cutoff30 = new Date(end.getTime() - 29 * 86400000).toISOString().slice(0, 10)
  for (const lang of langs) {
    const title = sitelinks[lang].replace(/ /g, '_')
    const data = await fetchJson(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${fmt(start)}/${fmt(end)}`,
      { headers: { 'User-Agent': UA }, retries: 2 }
    )
    const items: { timestamp: string; views: number }[] = data?.items || []
    for (const it of items) {
      const day = `${it.timestamp.slice(0, 4)}-${it.timestamp.slice(4, 6)}-${it.timestamp.slice(6, 8)}`
      await db.query(
        `INSERT INTO attention_daily (politician_id, lang, day, views) VALUES ($1, $2, $3, $4)
         ON CONFLICT (politician_id, lang, day) DO UPDATE SET views = EXCLUDED.views`,
        [politicianId, lang, day, it.views]
      )
      if (day >= cutoff30) total30 += it.views
    }
    await sleep(120)
  }
  await db.query('DELETE FROM attention_daily WHERE politician_id = $1 AND day < $2', [politicianId, start.toISOString().slice(0, 10)])
  await db.query('UPDATE politicians SET attention_synced_at = NOW() WHERE id = $1', [politicianId])
  await recordSource(politicianId, 'attention_languages', { languages: langs, total_30d: total30 }, {
    name: 'Wikimedia Pageviews API', license: LICENSES.wikidata,
    url: `https://pageviews.wmcloud.org/?project=en.wikipedia.org&pages=${encodeURIComponent((sitelinks.en || p.wiki_title || p.name).replace(/ /g, '_'))}`,
  })
  return { langs: langs.length, total_30d: total30 }
}

export async function getAttention(politicianId: string) {
  const [{ rows: p }, { rows }] = await Promise.all([
    db.query('SELECT country_code, wiki_sitelinks, attention_synced_at, wiki_title FROM politicians WHERE id = $1', [politicianId]),
    db.query('SELECT lang, day::text, views FROM attention_daily WHERE politician_id = $1 ORDER BY lang, day', [politicianId]),
  ])
  if (!p[0]) return null
  const home = HOME_LANG[p[0].country_code] || null
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const byLang = new Map<string, { day: string; views: number }[]>()
  for (const r of rows) byLang.set(r.lang, [...(byLang.get(r.lang) || []), { day: r.day, views: Number(r.views) }])
  const languages = [...byLang.entries()].map(([lang, points]) => ({
    lang, name: LANG_NAMES[lang] || lang, home: lang === home,
    title: p[0].wiki_sitelinks?.[lang] || null,
    url: p[0].wiki_sitelinks?.[lang] ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p[0].wiki_sitelinks[lang]).replace(/ /g, '_'))}` : null,
    views_30d: points.filter(x => x.day >= cutoff30).reduce((s, x) => s + x.views, 0),
    views_90d: points.reduce((s, x) => s + x.views, 0),
    points,
  })).sort((a, b) => b.views_30d - a.views_30d)
  const total30 = languages.reduce((s, l) => s + l.views_30d, 0)
  return { languages, total_30d: total30, home_lang: home, synced_at: p[0].attention_synced_at, editions_on_wikidata: Object.keys(p[0].wiki_sitelinks || {}).length }
}
