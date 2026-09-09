import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getThreads } from '../../api/politicians'
import { useAuth } from '../../context/AuthContext'
import ThreadRow from '../forum/ThreadRow'
import ThreadComposer from '../forum/ThreadComposer'
import { Empty, Loading } from '../States'

/** Threads about this leader on the Leaks board. Leaks never touch the rating. */
export default function LeaksSection({ leaderId, leaderName }: { leaderId: string; leaderName: string }) {
  const { user } = useAuth()
  const [composing, setComposing] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['threads', 'leader', leaderId, 'leak'], queryFn: () => getThreads({ leader: leaderId, kind: 'leak', sort: 'active', limit: 20 }) })
  return (
    <div>
      <div className="notice" style={{ marginBottom: '1rem' }}>Unverified, anonymous by default, and never counted in the rating. Post responsibly.</div>
      <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
        <span className="eyebrow">{data?.total || 0} leak{(data?.total || 0) === 1 ? '' : 's'} about {leaderName}</span>
        {user ? <button className={`btn btn--sm${composing ? ' is-active' : ''}`} onClick={() => setComposing(!composing)}>{composing ? 'Close' : 'Post a leak'}</button> : <Link to="/login" className="mono tiny muted">Sign in to post</Link>}
      </div>
      {composing && <div style={{ marginBottom: '1rem' }}><ThreadComposer board="leaks" leader={{ id: leaderId, name: leaderName }} onDone={() => setComposing(false)} /></div>}
      {isLoading && <Loading />}
      {!isLoading && !data?.threads?.length && <Empty text="No leaks yet. That doesn't mean there's nothing to find." />}
      <div className="stack" style={{ gap: '0.5rem' }}>{data?.threads?.map((t: any) => <ThreadRow key={t.id} t={t} />)}</div>
    </div>
  )
}
