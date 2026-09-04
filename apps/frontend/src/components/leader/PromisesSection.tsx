import { useQuery } from '@tanstack/react-query'
import { getLeaderPromises } from '../../api/politicians'
import { Redacted, Skeleton } from '../Redaction'
import { formatDate } from '../../lib/format'

export function usePromises(leaderId: string) {
  return useQuery({ queryKey: ['promises', leaderId], queryFn: () => getLeaderPromises(leaderId), staleTime: 10 * 60 * 1000 })
}

const STATUS_BADGE: Record<string, string> = { kept: 'badge--clean', broken: 'badge--confirmed', pending: 'badge--outline', unclear: 'badge--unclear' }

export function promisesHeadline(d: any) {
  const ps: any[] = d?.promises || []
  const pub = ps.filter(p => p.review_status === 'published')
  if (!pub.length) return { headline: 'No promises tracked yet', summary: `Promises are extracted from documents an editor adds (manifestos, speeches, interviews) and published only after a person has checked the quote. ${d?.documents?.length ? `${d.documents.length} document${d.documents.length === 1 ? '' : 's'} on file, nothing published yet.` : 'No documents on file for this person.'}` }
  const n = (s: string) => pub.filter(p => p.status === s).length
  return {
    headline: `${pub.length} promise${pub.length === 1 ? '' : 's'} tracked · ${n('kept')} kept · ${n('broken')} broken · ${n('pending')} pending`,
    summary: `Each promise is a verbatim commitment from a dated source. "Kept" and "broken" verdicts carry an evidence link chosen by an editor; "pending" means no verdict has been reached. Broken promises with evidence lower the score.`,
  }
}

export function contradictionsHeadline(d: any) {
  const cs: any[] = (d?.contradictions || []).filter((c: any) => c.review_status === 'published')
  if (!cs.length) return { headline: 'No contradictions on record', summary: 'Contradictions are pairs of the person\'s own statements that take opposing positions on the same question, found across documents on file and confirmed by an editor. None has been published.' }
  return { headline: `${cs.length} contradiction${cs.length === 1 ? '' : 's'} on record`, summary: `Pairs of dated, sourced quotes from the same person that take opposing positions. Topics: ${[...new Set(cs.map(c => c.topic).filter(Boolean))].slice(0, 4).join(', ')}.` }
}

export function PromisesList({ leaderId, isAdmin }: { leaderId: string; isAdmin?: boolean }) {
  const { data, isLoading } = usePromises(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  const ps: any[] = (data?.promises || []).filter((p: any) => isAdmin || p.review_status === 'published')
  if (!ps.length) return <Redacted label="Nothing published" />
  return (
    <div className="stack">
      {ps.map(p => (
        <div key={p.id} className="post">
          <div className="post__head">
            <div className="post__who">
              <span className={`badge ${STATUS_BADGE[p.status] || 'badge--outline'}`}>{p.status}</span>
              {p.topic && <span className="mono tiny muted" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p.topic}</span>}
              {p.promised_on && <span className="post__time">{formatDate(p.promised_on)}</span>}
              {p.review_status !== 'published' && <span className="badge badge--outline">{p.review_status}</span>}
            </div>
            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny muted" style={{ borderBottom: '1px solid var(--border-strong)' }}>Source</a>
          </div>
          <p className="post__body" style={{ fontWeight: 500 }}>{p.text}</p>
          {p.quote && <p className="small muted" style={{ marginTop: '0.4rem', borderLeft: '2px solid var(--border-strong)', paddingLeft: '0.6rem' }}>"{p.quote}"</p>}
          {(p.status === 'kept' || p.status === 'broken') && p.evidence_url && (
            <p className="small" style={{ marginTop: '0.5rem' }}>
              <a href={p.evidence_url} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>Evidence for "{p.status}"</a>{p.evidence_note ? <span className="muted"> · {p.evidence_note}</span> : null}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

export function ContradictionsList({ leaderId, isAdmin }: { leaderId: string; isAdmin?: boolean }) {
  const { data, isLoading } = usePromises(leaderId)
  if (isLoading) return <Skeleton lines={4} />
  const cs: any[] = (data?.contradictions || []).filter((c: any) => isAdmin || c.review_status === 'published')
  if (!cs.length) return <Redacted label="Nothing published" />
  return (
    <div className="stack">
      {cs.map(c => (
        <div key={c.id} className="post">
          <div className="post__head">
            <div className="post__who">
              {c.topic && <span className="mono tiny muted" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>{c.topic}</span>}
              {c.review_status !== 'published' && <span className="badge badge--outline">{c.review_status}</span>}
            </div>
          </div>
          <div className="grid-2" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
            {[['a', c.quote_a, c.date_a, c.source_a], ['b', c.quote_b, c.date_b, c.source_b]].map(([k, q, d, s]) => (
              <div key={String(k)} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '0.7rem' }}>
                <p className="small">"{q}"</p>
                <p className="mono tiny muted" style={{ marginTop: '0.3rem', letterSpacing: '0.08em' }}>{d ? formatDate(String(d)) : 'undated'} · <a href={String(s)} target="_blank" rel="noopener noreferrer" style={{ borderBottom: '1px solid var(--border-strong)' }}>source</a></p>
              </div>
            ))}
          </div>
          {c.explanation && <p className="small muted" style={{ marginTop: '0.6rem' }}>{c.explanation}</p>}
        </div>
      ))}
    </div>
  )
}
