import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { createThread, getPoliticians } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import IdentityToggle from '../IdentityToggle'
import { useAuth } from '../../context/AuthContext'
import { usePostAsProle } from '../../lib/identity'
import { BOARD_LABEL } from './ThreadRow'

interface Props { board?: string; leader?: { id: string; name: string } | null; onDone?: () => void }

export default function ThreadComposer({ board = 'general', leader = null, onDone }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [brd, setBrd] = useState(leader ? 'leaders' : board)
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderPick, setLeaderPick] = useState<{ id: string; name: string } | null>(leader)
  const [anon, setAnon] = usePostAsProle()
  const [error, setError] = useState('')
  const verified = !!user?.email_verified

  const { data: matches } = useQuery({ queryKey: ['leader-search', leaderQuery], queryFn: () => getPoliticians({ search: leaderQuery, limit: 6 }), enabled: leaderQuery.length >= 2 && !leaderPick })
  const create = useMutation({
    mutationFn: createThread,
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ['threads'] }); onDone?.(); navigate(`/forum/${t.id}`) },
    onError: e => setError(errorMessage(e)),
  })

  if (!user) return <div className="notice notice--plain"><Link to="/login" style={{ borderBottom: '1px solid var(--border-strong)' }}>Sign in</Link> to start a thread. Threads are anonymous by default.</div>
  if (!verified) return <div className="notice">Verify your email to post.</div>

  return (
    <div className="card card--elevated stack">
      <span className="eyebrow">New thread</span>
      <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} />
      <textarea className="textarea" rows={5} placeholder="Say it plainly. Link your sources." value={body} onChange={e => setBody(e.target.value)} maxLength={6000} />
      <div className="grid-2" style={{ gap: '0.5rem' }}>
        <div className="field">
          <label className="label">Board</label>
          <select className="select" value={brd} onChange={e => setBrd(e.target.value)} disabled={!!leaderPick}>
            {Object.entries(BOARD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">About a leader (optional)</label>
          {leaderPick ? (
            <div className="row row--between input" style={{ padding: '0.45rem 0.9rem' }}>
              <span className="small">{leaderPick.name}</span>
              {!leader && <button className="btn btn--ghost btn--sm" onClick={() => { setLeaderPick(null); setBrd(board) }}>Clear</button>}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Search a name" value={leaderQuery} onChange={e => setLeaderQuery(e.target.value)} />
              {matches?.politicians?.length > 0 && leaderQuery.length >= 2 && (
                <div className="card card--elevated" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', padding: '0.25rem' }}>
                  {matches.politicians.map((p: any) => (
                    <button key={p.id} className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => { setLeaderPick({ id: p.id, name: p.name }); setLeaderQuery(''); setBrd('leaders') }}>{p.name} <span className="dim">· {p.position}</span></button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <IdentityToggle anonymous={anon} onChange={setAnon} />
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn btn--gold" disabled={title.trim().length < 4 || body.trim().length < 2 || create.isPending} onClick={() => create.mutate({ title: title.trim(), body: body.trim(), board: brd, politician_id: leaderPick?.id, is_anonymous: anon })}>{create.isPending ? 'Posting' : 'Post thread'}</button>
        {onDone && <button className="btn btn--ghost" onClick={onDone}>Cancel</button>}
      </div>
    </div>
  )
}
