import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLeaks, submitLeak, upvoteLeak, setLeakStatus } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import Upvote from '../Upvote'
import { Empty, Loading } from '../States'
import { proleTag, timeAgo } from '../../lib/format'

export default function LeaksTab({ leaderId, onGoTo }: { leaderId: string; onGoTo: (tab: any) => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verified = !!user?.email_verified
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const { data: leaks, isLoading } = useQuery({ queryKey: ['leaks', leaderId], queryFn: () => getLeaks(leaderId) })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leaks', leaderId] })
    qc.invalidateQueries({ queryKey: ['politician', leaderId] })
  }
  const submit = useMutation({
    mutationFn: submitLeak,
    onSuccess: () => { invalidate(); setBody(''); setError(''); setSent(true); setTimeout(() => setSent(false), 3000) },
    onError: e => setError(errorMessage(e)),
  })
  const upvote = useMutation({ mutationFn: upvoteLeak, onSuccess: () => qc.invalidateQueries({ queryKey: ['leaks', leaderId] }) })
  const moderate = useMutation({ mutationFn: setLeakStatus, onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['controversies', leaderId] }) } })

  return (
    <div>
      <div className="notice" style={{ marginBottom: '1.25rem' }}>Unverified. Post responsibly.</div>

      {!user && (
        <div className="notice notice--plain" style={{ marginBottom: '1.5rem' }}>
          <Link to="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to submit a leak. Leaks are always anonymous.
        </div>
      )}
      {user && !verified && <div className="notice notice--plain" style={{ marginBottom: '1.5rem' }}>Verify your email to submit a leak.</div>}

      {verified && (
        <div className="card card--elevated stack" style={{ marginBottom: '1.5rem' }}>
          <span className="eyebrow">Submit intelligence</span>
          <textarea className="textarea" placeholder="Text only. No names of private individuals. What do you know?" value={body} onChange={e => setBody(e.target.value)} maxLength={4000} rows={4} />
          <div className="identity-box">
            <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Posting as {proleTag(user?.prole_number)}</span>
            <span className="help">Leaks are always anonymous. Your username is never attached, and there is no toggle.</span>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button className="btn btn--gold" disabled={!body.trim() || submit.isPending} onClick={() => submit.mutate({ politician_id: leaderId, body: body.trim() })}>
              {submit.isPending ? 'Transmitting' : 'Submit leak'}
            </button>
            {sent && <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Received.</span>}
          </div>
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && leaks?.length === 0 && <Empty text="No leaks yet. That doesn't mean there's nothing to find." />}

      <div className="stack">
        {leaks?.map((l: any) => (
          <div key={l.id} className="post" style={l.status === 'escalated' ? { borderColor: 'rgba(139,26,26,0.6)' } : undefined}>
            <div className="post__head">
              <div className="post__who">
                <span className="post__prole">{proleTag(l.prole_number)}</span>
                <span className="post__time">{timeAgo(l.created_at)}</span>
                {l.status === 'escalated' && (
                  <button className="badge badge--confirmed" style={{ cursor: 'pointer' }} onClick={() => onGoTo('controversies')}>Escalated to controversy</button>
                )}
              </div>
              {user?.is_admin && l.status !== 'escalated' && (
                <div className="row" style={{ gap: '0.3rem' }}>
                  <button className="btn btn--sm" onClick={() => moderate.mutate({ id: l.id, status: 'escalated' })}>Escalate</button>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm('Remove this leak?')) moderate.mutate({ id: l.id, status: 'removed' }) }}>Remove</button>
                </div>
              )}
            </div>
            <p className="post__body">{l.body}</p>
            <div className="post__foot">
              <Upvote count={l.upvotes} active={l.user_upvoted} disabled={!verified || l.is_own} onClick={() => upvote.mutate(l.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
