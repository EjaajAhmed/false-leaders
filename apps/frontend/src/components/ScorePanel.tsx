import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getScoreEvents } from '../api/politicians'
import { Skeleton } from './Redaction'
import { formatDate } from '../lib/format'

const KIND_LABEL: Record<string, string> = { verdicts: 'Community verdicts', leaks: 'Upvoted leaks', sanctions: 'Sanctions listings (OpenSanctions)' }

export default function ScorePanel({ leaderId, score, onClose }: { leaderId: string; score: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['score-events', leaderId], queryFn: () => getScoreEvents(leaderId) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="How this score was produced">
        <div className="drawer__head">
          <div>
            <div className="eyebrow">TruthScore</div>
            <h2 style={{ fontSize: '1.4rem' }}>How {score} was produced</h2>
          </div>
          <button className="btn btn--sm" onClick={onClose}>Close</button>
        </div>
        <p className="small muted" style={{ marginBottom: '1rem' }}>
          Every leader starts at 90. Each entry below is a change that fired, how many points it moved the score, and the source it was computed from. Nothing can move the score without a source.
        </p>
        {isLoading && <Skeleton lines={3} />}
        {!isLoading && (!data || data.length === 0) && (
          <p className="small" style={{ color: 'var(--muted)' }}>No events on record. The score is the base of 90 and nothing has fired.</p>
        )}
        {data?.map((e: any) => {
          const pts = Number(e.points)
          return (
            <div key={e.id} className="source-row">
              <div style={{ minWidth: 0 }}>
                <div className="source-row__field">{formatDate(e.created_at)} · {KIND_LABEL[e.kind] || e.kind}</div>
                <div className="source-row__value">
                  <span className={pts < 0 ? 'delta-down' : 'delta-up'} style={{ fontWeight: 600 }}>{pts > 0 ? '+' : ''}{pts}</span>
                  {e.score_before != null && <span className="mono small muted" style={{ marginLeft: '0.6rem' }}>{e.score_before} → {e.score_after}</span>}
                </div>
                <div className="source-row__meta">
                  {e.kind === 'verdicts' && `${e.detail?.total ?? 0} verdicts · ${e.detail?.guilty ?? 0} guilty · ${e.detail?.suspicious ?? 0} suspicious`}
                  {e.kind === 'leaks' && `${e.detail?.counted_leaks ?? 0} leaks with ${e.detail?.upvote_threshold ?? 3}+ upvotes`}
                  {e.kind === 'sanctions' && `${e.detail?.authorities ?? 0} sanctioning authorit${(e.detail?.authorities ?? 0) === 1 ? 'y' : 'ies'}`}
                </div>
              </div>
              <a href={e.source_url} target="_blank" rel="noopener noreferrer">Source</a>
            </div>
          )
        })}
      </aside>
    </>
  )
}
