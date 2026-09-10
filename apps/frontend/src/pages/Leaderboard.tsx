import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getLeaderboard } from '../api/politicians'
import type { LeaderboardTab } from '../api/politicians'
import { Empty, Loading } from '../components/States'
import { compact, ratingColor } from '../lib/format'

const TABS: { key: LeaderboardTab; label: string; blurb: string; empty: string }[] = [
  { key: 'watched', label: 'Most Watched', blurb: 'Most Wikipedia page views in the last 30 days.', empty: 'No attention data yet.' },
  { key: 'lowest', label: 'Lowest Rated', blurb: 'Lowest community rating among leaders with enough votes to publish one.', empty: 'Nobody has enough ratings to rank yet. Rate someone.' },
  { key: 'highest', label: 'Highest Rated', blurb: 'Highest community rating among leaders with enough votes to publish one.', empty: 'Nobody has enough ratings to rank yet. Rate someone.' },
  { key: 'discussed', label: 'Most Discussed', blurb: 'Most threads, replies and ratings this week.', empty: 'Nobody is talking. Yet.' },
]

export default function Leaderboard() {
  const [params, setParams] = useSearchParams()
  const current = (TABS.find(t => t.key === params.get('tab'))?.key || 'watched') as LeaderboardTab
  const tab = TABS.find(t => t.key === current)!
  const { data, isLoading } = useQuery({ queryKey: ['leaderboard', current, 25], queryFn: () => getLeaderboard(current, 25) })

  const value = (p: any) => {
    switch (current) {
      case 'lowest':
      case 'highest': return <><div className="lb-row__value" style={{ color: ratingColor(Number(p.rating_avg)) }}>{p.rating_avg}</div><div className="lb-row__sub">{p.rating_count} ratings</div></>
      case 'discussed': return <><div className="lb-row__value">{p.activity}</div><div className="lb-row__sub">{p.comments_week} posts · {p.verdicts_week} ratings</div></>
      case 'watched': return <><div className="lb-row__value">{compact(p.attention)}</div><div className="lb-row__sub">views · 30d</div></>
    }
  }

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <p className="eyebrow">Rankings</p>
        <h1>Leaderboard</h1>
        <p>{tab.blurb}</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {TABS.map(t => (
          <button key={t.key} className={`tab${current === t.key ? ' is-active' : ''}`} onClick={() => setParams({ tab: t.key })}>{t.label}</button>
        ))}
      </div>

      {isLoading && <Loading />}
      {!isLoading && (!data || data.length === 0) && <Empty text={tab.empty} />}
      <div>
        {data?.map((p: any, i: number) => (
          <Link key={p.id} to={`/leaders/${p.id}`} className="lb-row">
            <span className="lb-row__rank">{String(i + 1).padStart(2, '0')}</span>
            <div style={{ minWidth: 0, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {p.photo_url ? <img className="photo photo--row" src={p.photo_url} alt="" loading="lazy" /> : <div className="photo photo--row" />}
              <div style={{ minWidth: 0 }}>
              <div className="lb-row__name truncate">{p.name}</div>
              <div className="lb-row__meta truncate">{[p.position, p.party].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div>{value(p)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
