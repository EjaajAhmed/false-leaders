import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getBoards, getThreads } from '../api/politicians'
import ThreadRow, { BOARD_LABEL } from '../components/forum/ThreadRow'
import ThreadComposer from '../components/forum/ThreadComposer'
import { Empty, Loading } from '../components/States'

export default function Forum() {
  const [params, setParams] = useSearchParams()
  const board = params.get('board') || ''
  const sort = params.get('sort') || 'active'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [composing, setComposing] = useState(false)
  const boards = useQuery({ queryKey: ['boards'], queryFn: getBoards, staleTime: 60000 })
  const threads = useQuery({ queryKey: ['threads', board, sort, q, page], queryFn: () => getThreads({ board: board || undefined, sort, q: q || undefined, page, limit: 25 }), placeholderData: prev => prev, refetchInterval: 60000 })
  const set = (next: Record<string, string>) => { const o: Record<string, string> = {}; if (next.board ?? board) o.board = next.board ?? board; if ((next.sort ?? sort) !== 'active') o.sort = next.sort ?? sort; setParams(o, { replace: true }); setPage(1) }
  const current = boards.data?.find((b: any) => b.key === board)

  return (
    <div className="page page--narrow" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <p className="eyebrow">Forum · anonymous by default</p>
        <h1>{current ? current.label : 'All boards'}</h1>
        <p>{current ? current.blurb : 'Threads by members about the people in power. Post as your Prole number or as yourself. Nothing here is verified.'}</p>
      </div>

      <div className="viewbar">
        <div className="viewbar__views">
          <button className={`chip${!board ? ' is-active' : ''}`} onClick={() => set({ board: '' })}>All</button>
          {boards.data?.map((b: any) => (
            <button key={b.key} className={`chip${board === b.key ? ' is-active' : ''}`} onClick={() => set({ board: b.key })}>{b.label}{b.threads ? <span className="dim" style={{ marginLeft: '0.35rem' }}>{b.threads}</span> : null}</button>
          ))}
        </div>
        <div className="viewbar__narrow">
          <select className="select select--quiet" value={sort} onChange={e => set({ sort: e.target.value })} aria-label="Sort">
            <option value="active">Active</option><option value="new">New</option><option value="top">Top</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search threads" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
        <button className={`btn${composing ? ' is-active' : ' btn--gold'}`} onClick={() => setComposing(!composing)}>{composing ? 'Close' : 'New thread'}</button>
      </div>
      {composing && <div style={{ marginBottom: '1.25rem' }}><ThreadComposer board={board || 'general'} onDone={() => setComposing(false)} /></div>}

      {threads.isLoading && <Loading />}
      {!threads.isLoading && threads.data?.threads?.length === 0 && <Empty text="No threads here yet. Start one." />}
      <div className="stack" style={{ gap: '0.5rem', opacity: threads.isLoading ? 0.5 : 1 }}>
        {threads.data?.threads?.map((t: any) => <ThreadRow key={t.id} t={t} />)}
      </div>
      {threads.data && (threads.data.hasMore || page > 1) && (
        <div className="row" style={{ justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn--sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span className="mono tiny muted">Page {page}</span>
          <button className="btn btn--sm" disabled={!threads.data.hasMore} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
      <p className="section__caption" style={{ marginTop: '1.5rem' }}>Boards: {Object.values(BOARD_LABEL).join(' · ')}. Threads about a specific leader also appear on that leader's page. Moderators can lock or remove threads; removed posts stay in place as "[removed]".</p>
    </div>
  )
}
