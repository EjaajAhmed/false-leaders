import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { createThread, getPoliticians } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import IdentityToggle from '../IdentityToggle'
import { useAuth } from '../../context/AuthContext'
import { usePostAsProle } from '../../lib/identity'
import { proleTag } from '../../lib/format'
import type { ThreadKind } from '../../types'
import { BOARD_LABEL, KIND_LABEL } from './ThreadRow'

interface Props {
  board?: string
  leader?: { id: string; name: string } | null
  /** Force a thread kind (leak, verdict). When omitted the member picks. */
  kind?: ThreadKind
  rating?: number | null
  onDone?: () => void
}

const KIND_HELP: Record<ThreadKind, string> = {
  discussion: 'Open discussion. Post as your Prole number or as yourself.',
  leak: 'Leaks are always anonymous, must name a leader, and never affect the score. Text only. No names of private individuals.',
  verdict: 'A written verdict on a leader, with your 0–100 rating attached. Ratings feed the score; the words do not.',
}

export default function ThreadComposer({ board = 'general', leader = null, kind, rating = null, onDone }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [knd, setKnd] = useState<ThreadKind>(kind || (board === 'leaks' ? 'leak' : 'discussion'))
  const [brd, setBrd] = useState(leader ? 'leaders' : board === 'leaks' ? 'general' : board)
  const [score, setScore] = useState<number>(rating ?? 50)
  const [leaderQuery, setLeaderQuery] = useState('')
  const [leaderPick, setLeaderPick] = useState<{ id: string; name: string } | null>(leader)
  const [anon, setAnon] = usePostAsProle()
  const [error, setError] = useState('')
  const verified = !!user?.email_verified
  const isLeak = knd === 'leak'
  const isVerdict = knd === 'verdict'
  const needsLeader = isLeak || isVerdict

  const { data: matches } = useQuery({ queryKey: ['leader-search', leaderQuery], queryFn: () => getPoliticians({ search: leaderQuery, limit: 6 }), enabled: leaderQuery.length >= 2 && !leaderPick })
  const create = useMutation({
    mutationFn: createThread,
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ['threads'] }); qc.invalidateQueries({ queryKey: ['boards'] }); onDone?.(); navigate(`/forum/${t.id}`) },
    onError: e => setError(errorMessage(e)),
  })

  if (!user) return <div className="notice notice--plain"><Link to="/login" style={{ borderBottom: '1px solid var(--border-strong)' }}>Sign in</Link> to start a thread. Threads are anonymous by default.</div>
  if (!verified) return <div className="notice">Verify your email to post.</div>

  const effectiveBoard = isLeak ? 'leaks' : leaderPick ? 'leaders' : brd
  const canPost = title.trim().length >= 4 && body.trim().length >= 2 && (!needsLeader || !!leaderPick) && !create.isPending

  return (
    <div className="card card--elevated stack">
      <div className="row row--between row--wrap">
        <span className="eyebrow">New {KIND_LABEL[knd].toLowerCase()}</span>
        {!kind && (
          <select className="select select--quiet" value={knd} onChange={e => setKnd(e.target.value as ThreadKind)} aria-label="Thread type">
            {(Object.keys(KIND_LABEL) as ThreadKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        )}
      </div>
      <p className="help">{KIND_HELP[knd]}</p>
      <input className="input" placeholder={isLeak ? 'Headline for the leak' : isVerdict ? 'Your verdict, in a line' : 'Title'} value={title} onChange={e => setTitle(e.target.value)} maxLength={160} />
      <textarea className="textarea" rows={5} placeholder={isLeak ? 'What do you know? Text only.' : 'Say it plainly. Link your sources.'} value={body} onChange={e => setBody(e.target.value)} maxLength={6000} />
      <div className="grid-2" style={{ gap: '0.5rem' }}>
        <div className="field">
          <label className="label">Board</label>
          <select className="select" value={effectiveBoard} onChange={e => setBrd(e.target.value)} disabled={isLeak || !!leaderPick}>
            {Object.entries(BOARD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">{needsLeader ? 'About which leader' : 'About a leader (optional)'}</label>
          {leaderPick ? (
            <div className="row row--between input" style={{ padding: '0.45rem 0.9rem' }}>
              <span className="small">{leaderPick.name}</span>
              {!leader && <button className="btn btn--ghost btn--sm" onClick={() => { setLeaderPick(null) }}>Clear</button>}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input className="input" placeholder="Search a name" value={leaderQuery} onChange={e => setLeaderQuery(e.target.value)} />
              {matches?.politicians?.length > 0 && leaderQuery.length >= 2 && (
                <div className="card card--elevated" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', padding: '0.25rem' }}>
                  {matches.politicians.map((p: any) => (
                    <button key={p.id} className="btn btn--ghost btn--sm btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => { setLeaderPick({ id: p.id, name: p.name }); setLeaderQuery('') }}>{p.name} <span className="dim">· {p.position}</span></button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isVerdict && (
        <div className="rate rate--inline">
          <span className="rate__value mono">{score}</span>
          <input className="range" type="range" min={0} max={100} step={1} value={score} onChange={e => setScore(Number(e.target.value))} aria-label="Rating attached to this verdict, 0 to 100" />
          <div className="rate__ends mono tiny dim"><span>0 · condemn</span><span>100 · trust</span></div>
        </div>
      )}
      {isLeak ? (
        <div className="identity-box">
          <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Posting as {proleTag(user.prole_number)}</span>
          <span className="help">Leaks are always anonymous. Your username is never attached, and there is no toggle.</span>
        </div>
      ) : <IdentityToggle anonymous={anon} onChange={setAnon} />}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn btn--gold" disabled={!canPost} onClick={() => create.mutate({ title: title.trim(), body: body.trim(), board: effectiveBoard, politician_id: leaderPick?.id, is_anonymous: isLeak ? true : anon, kind: knd, rating: isVerdict ? score : undefined })}>
          {create.isPending ? 'Posting' : isLeak ? 'Submit leak' : isVerdict ? 'Post verdict' : 'Post thread'}
        </button>
        {onDone && <button className="btn btn--ghost" onClick={onDone}>Cancel</button>}
      </div>
    </div>
  )
}
