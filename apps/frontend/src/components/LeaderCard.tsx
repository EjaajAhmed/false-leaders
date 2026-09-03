import { Link } from 'react-router-dom'
import type { Leader } from '../types'
import ScoreRing from './ScoreRing'
import VerdictBar from './VerdictBar'
import LevelBadge from './LevelBadge'
import { categoryLabel, compact, leaderMeta, verdictLabel } from '../lib/format'
import { ARCHIVED } from '../config'

function dominant(c?: Leader['verdict_counts'] | null) {
  if (!c || !Number(c.total)) return null
  const kinds = ['guilty', 'suspicious', 'unclear', 'clean'] as const
  return kinds.reduce((best, k) => (Number(c[k]) > Number(c[best]) ? k : best), kinds[0] as typeof kinds[number])
}

export default function LeaderCard({ leader }: { leader: Leader }) {
  const score = leader.truth_score == null ? null : Number(leader.truth_score)
  return (
    <Link to={`/leaders/${leader.id}`} className="leader-card">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        {leader.photo_url ? <img className="photo photo--card" src={leader.photo_url} alt="" loading="lazy" /> : <div className="photo photo--card" />}
        <ScoreRing value={score} size="sm" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row row--between" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
          <div className="leader-card__name truncate" style={{ minWidth: 0 }}>{leader.name}</div>
          {!ARCHIVED.controversies && leader.top_controversy && <LevelBadge level={leader.top_controversy.level} />}
          {ARCHIVED.controversies && dominant(leader.verdict_counts) && <span className={`badge badge--${dominant(leader.verdict_counts)}`}>{verdictLabel(dominant(leader.verdict_counts))}</span>}
        </div>
        <div className="leader-card__meta truncate"><span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.5rem' }}>{categoryLabel(leader.category)}</span>{leaderMeta(leader) || 'Unlisted position'}</div>
        <div style={{ marginTop: '0.65rem' }}>
          <VerdictBar counts={leader.verdict_counts} />
        </div>
        <div className="leader-card__foot">
          {ARCHIVED.controversies ? (
            <div className="leader-card__controversy truncate">
              {Number(leader.verdict_counts?.total) ? `${leader.verdict_counts?.total} verdict${Number(leader.verdict_counts?.total) === 1 ? '' : 's'}` : <span className="dim">No verdicts yet</span>}
            </div>
          ) : (
            <div className="leader-card__controversy truncate">
              {leader.top_controversy ? leader.top_controversy.title : <span className="dim">No controversies on file</span>}
            </div>
          )}
          <span className="mono tiny dim" style={{ flexShrink: 0 }} title="Wikipedia page views, last 30 days">{Number(leader.attention) > 0 ? `${compact(leader.attention)} watching` : ARCHIVED.controversies ? `${leader.leak_count ?? 0} leak${(leader.leak_count ?? 0) === 1 ? '' : 's'}` : `${leader.controversy_count ?? 0} on file`}</span>
        </div>
      </div>
    </Link>
  )
}
