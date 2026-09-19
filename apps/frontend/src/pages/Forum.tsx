import { useEffect, useState } from 'react'
import { useTitle } from '../lib/hooks'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getBoards, getThreads } from '../api/politicians'
import ThreadRow, { BOARD_LABEL } from '../components/forum/ThreadRow'
import ThreadComposer from '../components/forum/ThreadComposer'
import { Empty, ErrorBox, Loading } from '../components/States'
import Dropdown from '../components/Dropdown'
import { Link } from 'react-router-dom'
import { Disclaimer } from '../components/Disclaimer'

export default function Forum() {
  const [params, setParams] = useSearchParams()
  const board = params.get('board') || ''
  const sort = params.get('sort') || 'hot'
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  // Query after the member pauses typing, not on every keystroke.
  useEffect(() => { const t = setTimeout(() => { if (search.trim() !== q) { setQ(search.trim()); if (page !== 1) set({}) } }, 300); return () => clearTimeout(t) }, [search]) // eslint-disable-line react-hooks/exhaustive-deps
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [composing, setComposing] = useState(false)
  const boards = useQuery({ queryKey: ['boards'], queryFn: getBoards, staleTime: 60000 })
  const threads = useQuery({ queryKey: ['threads', board, sort, q, page], queryFn: () => getThreads({ board: board || undefined, sort, q: q || undefined, page, limit: 25 }), placeholderData: prev => prev, refetchInterval: 60000 })
  // Board, sort and page live in the URL so Back from a thread returns to the same list.
  const set = (next: Record<string, string>) => { const o: Record<string, string> = {}; if (next.board ?? board) o.board = next.board ?? board; if ((next.sort ?? sort) !== 'hot') o.sort = next.sort ?? sort; if (next.page && next.page !== '1') o.page = next.page; setParams(o, { replace: true }) }
  const setPage = (n: number) => { set({ page: String(n) }); window.scrollTo({ top: 0 }) }
  const current = boards.data?.find((b: any) => b.key === board)
  useTitle(current ? `${current.label} · Forum` : 'Forum')

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
          <Dropdown placeholder="Sort" value={sort} onChange={v => set({ sort: v })} align="right" options={[{ value: 'hot', label: 'Hot' }, { value: 'new', label: 'New' }, { value: 'top', label: 'Top' }, { value: 'active', label: 'Recently active' }]} />
        </div>
      </div>

      <div className="row" style={{ gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search threads" aria-label="Search threads" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={`btn${composing ? ' is-active' : ' btn--gold'}`} onClick={() => setComposing(!composing)}>{composing ? 'Close' : 'New thread'}</button>
      </div>
      {composing && <div style={{ marginBottom: '1.25rem' }}><ThreadComposer board={board || 'general'} onDone={() => setComposing(false)} /></div>}

      {threads.isLoading && <Loading />}
      {threads.isError && !threads.data && <ErrorBox message="Could not load the forum." onRetry={() => threads.refetch()} />}
      {!threads.isLoading && threads.data?.threads?.length === 0 && <Empty text={q ? `No threads match "${q}".` : 'No threads here yet. Start one.'} />}
      <div className="stack" style={{ gap: '0.5rem', opacity: threads.isLoading ? 0.5 : 1 }}>
        {threads.data?.threads?.map((t: any) => <ThreadRow key={t.id} t={t} />)}
      </div>
      {threads.data && (threads.data.hasMore || page > 1) && (
        <div className="row" style={{ justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn--sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="mono tiny muted">Page {page} / {Math.max(1, Math.ceil(threads.data.total / 25))}</span>
          <button className="btn btn--sm" disabled={!threads.data.hasMore} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      <p className="section__caption" style={{ marginTop: '1.5rem' }}>Boards: {Object.values(BOARD_LABEL).join(' · ')}. Hot ranks by upvotes and replies, decaying from the last reply, so a thread comes back when news breaks. Nothing posted here changes a leader's rating. Moderators can lock or remove threads; removed posts stay in place as "[removed]".</p>
      <Disclaimer />
      <p className="legal-links"><Link to="/terms">Terms</Link><Link to="/acceptable-use">Acceptable use</Link><Link to="/takedown">Takedown</Link><Link to="/contact">Contact</Link></p>
    </div>
  )
}
