import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getLeaderboard } from '../api/politicians'
import type { LeaderboardTab } from '../api/politicians'
import { Empty, Loading } from '../components/States'
import { scoreColor } from '../lib/format'

const TABS: { key: LeaderboardTab; label: string; blurb: string; empty: string }[] = [
  { key: 'condemned', label: 'Most Condemned', blurb: 'Lowest TruthScore on record.', empty: 'No one has been scored. Suspicious in itself.' },
  { key: 'drop', label: 'Biggest Drop', blurb: 'Largest TruthScore fall in the last 7 days.', empty: 'No scores have fallen this week. Give it time.' },
  { key: 'discussed', label: 'Most Discussed', blurb: 'Most comments and verdicts this week.', empty: 'Nobody is talking. Yet.' },
  { key: 'leaked', label: 'Most Leaked', blurb: 'Most leak submissions, all time.', empty: 'No leaks on file. That doesn\'t mean there\'s nothing to find.' },
]

export default function Leaderboard() {
  const [params, setParams] = useSearchParams()
  const current = (TABS.find(t => t.key === params.get('tab'))?.key || 'condemned') as LeaderboardTab
  const tab = TABS.find(t => t.key === current)!
  const { data, isLoading } = useQuery({ queryKey: ['leaderboard', current, 25], queryFn: () => getLeaderboard(current, 25) })

  const value = (p: any) => {
    switch (current) {
      case 'condemned': return <div className="lb-row__value" style={{ color: scoreColor(Number(p.truth_score)) }}>{Math.round(Number(p.truth_score))}</div>
      case 'drop': return <><div className="lb-row__value delta-down">{p.delta}</div><div className="lb-row__sub">{p.previous_score} → {Math.round(Number(p.truth_score))}</div></>
      case 'discussed': return <><div className="lb-row__value">{p.activity}</div><div className="lb-row__sub">{p.comments_week}c · {p.verdicts_week}v</div></>
      case 'leaked': return <><div className="lb-row__value">{p.leak_count}</div><div className="lb-row__sub">leaks</div></>
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
            <div style={{ minWidth: 0 }}>
              <div className="lb-row__name truncate">{p.name}</div>
              <div className="lb-row__meta truncate">{[p.position, p.party].filter(Boolean).join(' · ')}</div>
            </div>
            <div>{value(p)}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
