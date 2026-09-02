import { Link } from 'react-router-dom'
import type { Leader } from '../types'
import ScoreRing from './ScoreRing'
import VerdictBar from './VerdictBar'
import LevelBadge from './LevelBadge'
import { leaderMeta } from '../lib/format'

export default function LeaderCard({ leader }: { leader: Leader }) {
  const score = leader.truth_score == null ? null : Number(leader.truth_score)
  return (
    <Link to={`/leaders/${leader.id}`} className="leader-card">
      <ScoreRing value={score} size="sm" />
      <div style={{ minWidth: 0 }}>
        <div className="row row--between" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
          <div className="leader-card__name truncate" style={{ minWidth: 0 }}>{leader.name}</div>
          {leader.top_controversy && <LevelBadge level={leader.top_controversy.level} />}
        </div>
        <div className="leader-card__meta truncate">{leaderMeta(leader) || 'Unlisted position'}{leader.country && leader.country !== 'Canada' ? ` · ${leader.country}` : ''}</div>
        <div style={{ marginTop: '0.65rem' }}>
          <VerdictBar counts={leader.verdict_counts} />
        </div>
        <div className="leader-card__foot">
          <div className="leader-card__controversy truncate">
            {leader.top_controversy ? leader.top_controversy.title : <span className="dim">No controversies on file</span>}
          </div>
          <span className="mono tiny dim" style={{ flexShrink: 0 }}>{leader.controversy_count ?? 0} on file</span>
        </div>
      </div>
    </Link>
  )
}
