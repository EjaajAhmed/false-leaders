import { db } from '../../db/client'
import { recordSource } from '../provenance'
import { canadaVotes } from './canada'
import { ukVotes } from './uk'
import { usCourts, usMoney } from './us'
import type { CountryAdapter, LeaderRef, RecordKind } from './types'

export const ADAPTERS: CountryAdapter[] = [canadaVotes, ukVotes, usMoney, usCourts]
export const KINDS: RecordKind[] = ['votes', 'money', 'courts']

export function adaptersFor(country: string | null): CountryAdapter[] {
  return country ? ADAPTERS.filter(a => a.country === country) : []
}

export async function syncCountryRecords(politicianId: string): Promise<{ adapters: number; ok: number }> {
  const { rows } = await db.query('SELECT id, name, country_code, born::text, party, category FROM politicians WHERE id = $1', [politicianId])
  const leader: LeaderRef = rows[0]
  if (!leader) return { adapters: 0, ok: 0 }
  const adapters = adaptersFor(leader.country_code)
  let ok = 0
  for (const a of adapters) {
    try {
      const r = await a.fetch(leader)
      await db.query(
        `INSERT INTO country_records (politician_id, kind, adapter, external_id, summary, items, source_name, source_url, license, status, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (politician_id, kind) DO UPDATE SET adapter = EXCLUDED.adapter, external_id = EXCLUDED.external_id, summary = EXCLUDED.summary, items = EXCLUDED.items,
           source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url, license = EXCLUDED.license, status = EXCLUDED.status, fetched_at = NOW()`,
        [politicianId, a.kind, a.name, r.external_id || null, JSON.stringify(r.summary), JSON.stringify(r.items), r.source_name, r.source_url, r.license || null, r.status || 'ok']
      )
      if ((r.status || 'ok') === 'ok') {
        ok++
        await recordSource(politicianId, `records_${a.kind}`, r.summary, { name: r.source_name, url: r.source_url, license: r.license || null })
      }
    } catch (err: any) {
      await db.query(
        `INSERT INTO country_records (politician_id, kind, adapter, summary, items, source_name, source_url, status, fetched_at)
         VALUES ($1, $2, $3, $4, '[]', $5, $6, 'error', NOW())
         ON CONFLICT (politician_id, kind) DO UPDATE SET status = 'error', summary = EXCLUDED.summary, fetched_at = NOW()`,
        [politicianId, a.kind, a.name, JSON.stringify({ reason: err?.message || String(err) }), a.name, 'https://falseleaders.com/']
      )
    }
  }
  await db.query('UPDATE politicians SET records_synced_at = NOW() WHERE id = $1', [politicianId])
  return { adapters: adapters.length, ok }
}

export async function getCountryRecords(politicianId: string) {
  const [{ rows: p }, { rows }] = await Promise.all([
    db.query('SELECT country, country_code, records_synced_at FROM politicians WHERE id = $1', [politicianId]),
    db.query('SELECT kind, adapter, external_id, summary, items, source_name, source_url, license, status, fetched_at FROM country_records WHERE politician_id = $1', [politicianId]),
  ])
  if (!p[0]) return null
  const available = adaptersFor(p[0].country_code)
  const records: Record<string, any> = {}
  for (const r of rows) records[r.kind] = r
  const coverage = KINDS.map(kind => {
    const adapter = available.find(a => a.kind === kind)
    return { kind, adapter: adapter ? adapter.name : null, record: records[kind] || null }
  })
  return { country: p[0].country, country_code: p[0].country_code, synced_at: p[0].records_synced_at, has_adapters: available.length > 0, coverage, adapters_built: [...new Set(ADAPTERS.map(a => a.country))] }
}
