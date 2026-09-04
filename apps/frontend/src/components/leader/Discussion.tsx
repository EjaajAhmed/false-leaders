import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getThreads } from '../../api/politicians'
import ThreadRow from '../forum/ThreadRow'
import ThreadComposer from '../forum/ThreadComposer'
import { Empty, Loading } from '../States'

/** Forum threads tagged to this leader. */
export default function Discussion({ leaderId, leaderName }: { leaderId: string; leaderName: string }) {
  const [composing, setComposing] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['threads', 'leader', leaderId], queryFn: () => getThreads({ leader: leaderId, sort: 'active', limit: 20 }) })
  return (
    <div>
      <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
        <span className="eyebrow">{data?.total || 0} thread{(data?.total || 0) === 1 ? '' : 's'} about {leaderName}</span>
        <button className={`btn btn--sm${composing ? ' is-active' : ''}`} onClick={() => setComposing(!composing)}>{composing ? 'Close' : 'New thread'}</button>
      </div>
      {composing && <div style={{ marginBottom: '1rem' }}><ThreadComposer leader={{ id: leaderId, name: leaderName }} onDone={() => setComposing(false)} /></div>}
      {isLoading && <Loading />}
      {!isLoading && !data?.threads?.length && <Empty text={`No threads about ${leaderName} yet.`} sub="Start one" />}
      <div className="stack" style={{ gap: '0.5rem' }}>{data?.threads?.map((t: any) => <ThreadRow key={t.id} t={t} />)}</div>
    </div>
  )
}
