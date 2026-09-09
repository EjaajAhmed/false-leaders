import { Link } from 'react-router-dom'
import type { Leader } from '../types'
import ScoreRing from './ScoreRing'
import LevelBadge from './LevelBadge'
import { categoryLabel, compact, leaderMeta } from '../lib/format'
import { ARCHIVED } from '../config'

export default function LeaderCard({ leader }: { leader: Leader }) {
  const score = leader.truth_score == null ? null : Number(leader.truth_score)
  const n = Number(leader.rating?.n || 0)
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
        </div>
        <div className="leader-card__meta truncate"><span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.5rem' }}>{categoryLabel(leader.category)}</span>{leaderMeta(leader) || 'Unlisted position'}</div>
        <div className="leader-card__foot">
          <div className="leader-card__controversy truncate">
            {n ? <>Members <span className="mono" style={{ color: 'var(--text)' }}>{leader.rating?.average}</span> · {n} rating{n === 1 ? '' : 's'}</> : <span className="dim">{score == null ? 'Unrated · be the first' : 'No member ratings yet'}</span>}
          </div>
          <span className="mono tiny dim" style={{ flexShrink: 0 }} title="Wikipedia page views, last 30 days">{Number(leader.attention) > 0 ? `${compact(leader.attention)} watching` : `${leader.leak_count ?? 0} leak${(leader.leak_count ?? 0) === 1 ? '' : 's'}`}</span>
        </div>
      </div>
    </Link>
  )
}
