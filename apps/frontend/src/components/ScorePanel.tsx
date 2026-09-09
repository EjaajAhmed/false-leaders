import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getScoreEvents } from '../api/politicians'
import { Skeleton } from './Redaction'
import { formatDate } from '../lib/format'

const KIND_LABEL: Record<string, string> = { community: "Members' ratings", external: 'Outside signal', verdicts: 'Community verdicts (retired)', leaks: 'Upvoted leaks (retired)', sanctions: 'Sanctions listings (retired)', promises: 'Broken promises (retired)' }
const pct = (w: unknown) => (w == null ? '' : ` · ${Math.round(Number(w) * 100)}%`)

export default function ScorePanel({ leaderId, score, onClose }: { leaderId: string; score: number | null; onClose: () => void }) {
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
            <h2 style={{ fontSize: '1.4rem' }}>{score == null ? 'Why there is no score yet' : `How ${score} was produced`}</h2>
          </div>
          <button className="btn btn--sm" onClick={onClose}>Close</button>
        </div>
        <p className="small muted" style={{ marginBottom: '1rem' }}>
          Two parts. Members' ratings, 0 to 100, are 60% of the score (shrunk toward 50 while ratings are few). An outside signal is the other 40%: the share of world press coverage that is not negative in tone, less a deduction for listings by scoring sanctions authorities. A part that does not exist yet is left out rather than invented. Each entry below is a change that fired and the source it was computed from.
        </p>
        {isLoading && <Skeleton lines={3} />}
        {!isLoading && (!data || data.length === 0) && (
          <p className="small" style={{ color: 'var(--muted)' }}>No events on record. No member has rated this person and no outside signal has been ingested, so there is no score.</p>
        )}
        {data?.map((e: any) => {
          const pts = Number(e.points)
          return (
            <div key={e.id} className="source-row">
              <div style={{ minWidth: 0 }}>
                <div className="source-row__field">{formatDate(e.created_at)} · {KIND_LABEL[e.kind] || e.kind}{pct(e.detail?.weight)}</div>
                <div className="source-row__value">
                  <span className={pts < 0 ? 'delta-down' : 'delta-up'} style={{ fontWeight: 600 }}>{pts > 0 ? '+' : ''}{pts}</span>
                  {e.score_before != null && <span className="mono small muted" style={{ marginLeft: '0.6rem' }}>{e.score_before} → {e.score_after}</span>}
                </div>
                <div className="source-row__meta">
                  {e.kind === 'community' && `${e.detail?.ratings ?? 0} rating${(e.detail?.ratings ?? 0) === 1 ? '' : 's'} · members' part ${e.detail?.after ?? '—'}`}
                  {e.kind === 'external' && [e.detail?.articles_30d != null ? `${e.detail.articles_30d} articles, ${e.detail.negative_share ?? 0}% negative` : null, e.detail?.sanction_authorities ? `${e.detail.sanction_authorities} sanctioning authorit${e.detail.sanction_authorities === 1 ? 'y' : 'ies'}` : null, `outside part ${e.detail?.after ?? '—'}`].filter(Boolean).join(' · ')}
                  {e.kind === 'verdicts' && `${e.detail?.total ?? 0} verdicts · ${e.detail?.guilty ?? 0} guilty · ${e.detail?.suspicious ?? 0} suspicious`}
                  {e.kind === 'leaks' && `${e.detail?.counted_leaks ?? 0} leaks with ${e.detail?.upvote_threshold ?? 3}+ upvotes`}
                  {e.kind === 'sanctions' && `${e.detail?.authorities ?? 0} sanctioning authorit${(e.detail?.authorities ?? 0) === 1 ? 'y' : 'ies'}`}
                  {e.kind === 'promises' && `${e.detail?.broken_published ?? 0} broken promise${(e.detail?.broken_published ?? 0) === 1 ? '' : 's'} published with evidence`}
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
