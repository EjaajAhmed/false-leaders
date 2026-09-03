import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeaderSources } from '../api/politicians'
import { Skeleton } from './Redaction'
import { formatDate } from '../lib/format'

const ATTRIBUTIONS = [
  ['Wikidata', 'Structured data (offices, dates, party, country). CC0 1.0.'],
  ['Wikipedia', 'Summary text and portrait. Text is CC BY-SA 4.0; images carry their own licences on Wikimedia Commons.'],
  ['World Bank Open Data', 'Country indicators. CC BY 4.0.'],
  ['Wikimedia Pageviews', 'Attention metric (daily page views).'],
  ['GDELT', 'Headlines. GDELT Project terms of use.'],
]

function renderValue(field: string, v: any): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (field === 'positions') return `${v.count} offices on record`
    if (field === 'country') return `${v.name}${v.iso3 ? ` (${v.iso3})` : ''}`
    if (field === 'current_office') return `${v.office}${v.start ? ` since ${String(v.start).slice(0, 4)}` : ''}${v.end ? ` until ${String(v.end).slice(0, 4)}` : ''}`
    if (field === 'summary') return `${v.chars} characters of summary text`
    return JSON.stringify(v)
  }
  if (field === 'portrait') return 'Image file'
  if (field === 'attention') return `${Number(v).toLocaleString()} views in 30 days`
  if (field === 'net_worth') return `$${Number(v).toLocaleString()}`
  return String(v)
}

export default function SourcesDrawer({ leaderId, onClose }: { leaderId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['sources', leaderId], queryFn: () => getLeaderSources(leaderId) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Sources">
        <div className="drawer__head">
          <div>
            <div className="eyebrow">Provenance</div>
            <h2 style={{ fontSize: '1.4rem' }}>Sources</h2>
          </div>
          <button className="btn btn--sm" onClick={onClose}>Close</button>
        </div>
        <p className="small muted" style={{ marginBottom: '1rem' }}>Every value on this page, where it came from, and when it was fetched.</p>
        {isLoading && <Skeleton lines={4} />}
        {!isLoading && (!data || data.length === 0) && <p className="dim small">No sourced fields yet. The nightly ingest has not run for this record.</p>}
        {data?.map((row: any) => (
          <div key={row.field} className="source-row">
            <div style={{ minWidth: 0 }}>
              <div className="source-row__field">{row.field.replace(/_/g, ' ')}</div>
              <div className="source-row__value">{renderValue(row.field, row.value)}</div>
              <div className="source-row__meta">{row.source_name}{row.license ? ` · ${row.license}` : ''} · fetched {formatDate(row.fetched_at)}</div>
            </div>
            <a href={row.source_url} target="_blank" rel="noopener noreferrer">Open source</a>
          </div>
        ))}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Attribution</div>
          {ATTRIBUTIONS.map(([name, text]) => (
            <p key={name} className="small" style={{ color: 'var(--muted)', marginBottom: '0.4rem' }}><strong style={{ color: 'var(--text)' }}>{name}.</strong> {text}</p>
          ))}
          <p className="tiny dim" style={{ marginTop: '0.75rem' }}>Community verdicts, leaks and discussion are contributed by members of this site and are not independently verified.</p>
        </div>
      </aside>
    </>
  )
}
