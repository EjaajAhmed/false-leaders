import { useQuery } from '@tanstack/react-query'
import { getLeaderPositions } from '../../api/politicians'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function usePositions(leaderId: string) {
  return useQuery({ queryKey: ['positions', leaderId], queryFn: () => getLeaderPositions(leaderId), staleTime: 60 * 60 * 1000 })
}

const year = (d?: string | null) => (d ? String(d).slice(0, 4) : null)

export function careerHeadline(data: any, fallbackOffice?: string | null) {
  const positions: any[] = data?.positions || []
  if (!data?.wikidata_id) return { headline: fallbackOffice || 'No office on record', summary: 'No Wikidata record is linked to this person yet, so the office history cannot be verified.' }
  if (positions.length === 0) return { headline: fallbackOffice || 'No office on record', summary: 'Wikidata lists no positions held for this person.' }
  const current = data.current_office ? { label: data.current_office, start: data.term_start, end: data.term_end } : null
  const earliest = positions.map(p => year(p.start_date)).filter(Boolean).sort()[0]
  const headline = current
    ? `${current.label}${current.end ? ` · ${year(current.start) || '?'}–${year(current.end)}` : current.start ? ` · since ${year(current.start)}` : ''}`
    : positions[0].position_label
  const summary = `${positions.length} office${positions.length === 1 ? '' : 's'} on record at Wikidata${earliest ? `, the earliest from ${earliest}` : ''}.${current?.end ? ' The most recent office has ended.' : ''}`
  return { headline, summary }
}

export default function CareerLedger({ leaderId }: { leaderId: string }) {
  const { data, isLoading } = usePositions(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  const positions: any[] = data?.positions || []
  if (!data?.wikidata_id) return <Redacted label="No Wikidata record" />
  if (positions.length === 0) return <Redacted label="No positions on Wikidata" />

  return (
    <div>
      <ol className="ledger" aria-label="Offices held">
        {positions.map((p, i) => {
          const current = !p.end_date
          return (
            <li key={i} className={`ledger__item${current ? ' is-current' : ''}`}>
              <div className="ledger__dates">
                {p.start_date ? formatDate(p.start_date) : 'Date unknown'} — {p.end_date ? formatDate(p.end_date) : 'present'}
              </div>
              <div className="ledger__office">{p.position_label}</div>
              {(p.replaces_label || p.replaced_by_label) && (
                <div className="ledger__succession">
                  {p.replaces_label && <>Succeeded {p.replaces_label}. </>}
                  {p.replaced_by_label && <>Succeeded by {p.replaced_by_label}.</>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="section__caption">
        Offices as recorded on <a href={`https://www.wikidata.org/wiki/${data.wikidata_id}`} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>Wikidata {data.wikidata_id}</a> (CC0), last synced {data.wikidata_synced_at ? formatDate(data.wikidata_synced_at) : 'never'}. Dates reflect what contributors have entered and may lag real events.
      </p>
    </div>
  )
}
