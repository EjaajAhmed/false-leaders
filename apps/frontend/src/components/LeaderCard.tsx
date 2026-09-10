import { Link } from 'react-router-dom'
import type { Leader } from '../types'
import RatingRing from './RatingRing'
import LevelBadge from './LevelBadge'
import { categoryLabel, compact, leaderMeta } from '../lib/format'
import { ARCHIVED } from '../config'

export default function LeaderCard({ leader }: { leader: Leader }) {
  const n = Number(leader.rating?.n ?? leader.rating_count ?? 0)
  const avg = leader.rating?.average ?? leader.rating_avg ?? null
  return (
    <Link to={`/leaders/${leader.id}`} className="leader-card">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        {leader.photo_url ? <img className="photo photo--card" src={leader.photo_url} alt="" loading="lazy" /> : <div className="photo photo--card" />}
        <RatingRing value={avg} size="sm" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row row--between" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
          <div className="leader-card__name truncate" style={{ minWidth: 0 }}>{leader.name}</div>
          {!ARCHIVED.controversies && leader.top_controversy && <LevelBadge level={leader.top_controversy.level} />}
        </div>
        <div className="leader-card__meta truncate"><span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '0.5rem' }}>{categoryLabel(leader.category)}</span>{leaderMeta(leader) || 'Unlisted position'}</div>
        <div className="leader-card__foot">
          <div className="leader-card__controversy truncate">
            {avg != null ? <><span className="mono" style={{ color: 'var(--text)' }}>{avg}</span> · {n} rating{n === 1 ? '' : 's'}</> : <span className="dim">{n ? `Unrated · ${n} rating${n === 1 ? '' : 's'} so far` : 'Unrated · be the first'}</span>}
          </div>
          <span className="mono tiny dim" style={{ flexShrink: 0 }} title="Wikipedia page views, last 30 days">{Number(leader.attention) > 0 ? `${compact(leader.attention)} watching` : 'no view data'}</span>
        </div>
      </div>
    </Link>
  )
}
