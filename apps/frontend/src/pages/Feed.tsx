import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getFeed } from '../api/politicians'
import type { FeedEvent } from '../types'
import FeedList from '../components/FeedList'
import { Loading } from '../components/States'
import { ARCHIVED } from '../config'

type Filter = 'all' | 'score_change' | 'leak' | 'controversy' | 'verdict_shift'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'score_change', label: 'Scores' },
  { key: 'leak', label: 'Leaks' },
  { key: 'controversy', label: 'Controversies' },
  { key: 'verdict_shift', label: 'Verdicts' },
]

export default function Feed() {
  const [filter, setFilter] = useState<Filter>('all')
  const [older, setOlder] = useState<FeedEvent[]>([])
  const [olderHasMore, setOlderHasMore] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const type = filter === 'all' ? undefined : filter
  const latest = useQuery({
    queryKey: ['feed', 'page', filter],
    queryFn: () => getFeed({ type, limit: 40 }),
    refetchInterval: 30000,
  })

  useEffect(() => { setOlder([]); setOlderHasMore(true) }, [filter])

  const events: FeedEvent[] = [...(latest.data?.events || []), ...older]
  const hasMore = latest.data?.hasMore && olderHasMore

  const loadOlder = async () => {
    const last = events[events.length - 1]
    if (!last) return
    setLoadingOlder(true)
    try {
      const res = await getFeed({ type, before: last.created_at, limit: 40 })
      setOlder(prev => [...prev, ...res.events])
      setOlderHasMore(res.hasMore)
    } finally {
      setLoadingOlder(false)
    }
  }

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <p className="eyebrow">Live · refreshes every 30s</p>
        <h1>The Wall</h1>
        <p>{ARCHIVED.controversies ? 'Every score movement, leak and verdict shift across every leader on file.' : 'Every score movement, leak, controversy and verdict shift across every leader on file.'}</p>
      </div>

      <div className="chips" style={{ marginBottom: '1.25rem' }}>
        {FILTERS.filter(f => !(f.key === 'controversy' && ARCHIVED.controversies)).map(f => (
          <button key={f.key} className={`chip${filter === f.key ? ' is-active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {latest.isLoading ? <Loading /> : <FeedList events={events} />}

      {hasMore && events.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button className="btn" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? 'Decrypting' : 'Load older'}</button>
        </div>
      )}
    </div>
  )
}
