import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getVerdicts, submitVerdict, upvoteVerdict, deleteVerdict } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { usePostAsProle } from '../../lib/identity'
import type { VerdictKind } from '../../types'
import VerdictBar from '../VerdictBar'
import IdentityToggle from '../IdentityToggle'
import Upvote from '../Upvote'
import { Empty, Loading } from '../States'
import { VERDICTS, proleTag, timeAgo, verdictLabel } from '../../lib/format'

export default function VerdictsTab({ leaderId }: { leaderId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const verified = !!user?.email_verified
  const [choice, setChoice] = useState<VerdictKind | null>(null)
  const [body, setBody] = useState('')
  const [anon, setAnon] = usePostAsProle()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['verdicts', leaderId], queryFn: () => getVerdicts(leaderId) })

  useEffect(() => {
    if (data?.mine) {
      setChoice(data.mine.verdict)
      setBody(data.mine.body || '')
    }
  }, [data?.mine?.id, data?.mine?.verdict])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['verdicts', leaderId] })
    qc.invalidateQueries({ queryKey: ['politician', leaderId] })
  }
  const submit = useMutation({
    mutationFn: submitVerdict,
    onSuccess: () => { invalidate(); setError(''); setDone(true); setTimeout(() => setDone(false), 2500) },
    onError: e => setError(errorMessage(e)),
  })
  const upvote = useMutation({ mutationFn: upvoteVerdict, onSuccess: () => qc.invalidateQueries({ queryKey: ['verdicts', leaderId] }) })
  const remove = useMutation({ mutationFn: deleteVerdict, onSuccess: () => { invalidate(); setChoice(null); setBody('') } })

  const aggregate = data?.aggregate
  const verdicts = data?.verdicts || []

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
          <span className="eyebrow">Aggregate verdict</span>
          {aggregate?.dominant && <span className={`badge badge--${aggregate.dominant}`}>{verdictLabel(aggregate.dominant)}</span>}
        </div>
        <VerdictBar counts={aggregate?.counts} size="lg" legend />
      </div>

      {!user && (
        <div className="notice notice--plain" style={{ marginBottom: '1.5rem' }}>
          <Link to="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to submit a verdict. One per account, per leader.
        </div>
      )}
      {user && !verified && <div className="notice" style={{ marginBottom: '1.5rem' }}>Verify your email to submit a verdict.</div>}

      {verified && (
        <div className="card card--elevated stack" style={{ marginBottom: '1.5rem' }}>
          <div className="row row--between">
            <span className="eyebrow">{data?.mine ? 'Your verdict · update it any time' : 'Your verdict'}</span>
            {data?.mine && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(data.mine.id)}>Withdraw</button>}
          </div>
          <div className="verdict-pick">
            {VERDICTS.map(v => (
              <button key={v.value} type="button" className={choice === v.value ? `is-on--${v.value}` : ''} onClick={() => setChoice(v.value)}>{v.label}</button>
            ))}
          </div>
          <textarea className="textarea" placeholder="Explain, briefly. Optional." value={body} onChange={e => setBody(e.target.value)} maxLength={1500} rows={3} />
          <IdentityToggle anonymous={anon} onChange={setAnon} />
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button className="btn btn--gold" disabled={!choice || submit.isPending} onClick={() => choice && submit.mutate({ politician_id: leaderId, verdict: choice, body: body.trim() || undefined, is_anonymous: anon })}>
              {submit.isPending ? 'Filing' : data?.mine ? 'Update verdict' : 'Submit verdict'}
            </button>
            {done && <span className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Filed.</span>}
          </div>
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && verdicts.length === 0 && <Empty text="No verdicts submitted. Nobody has judged them yet." />}

      <div className="stack">
        {verdicts.map((v: any) => (
          <div key={v.id} className="post">
            <div className="post__head">
              <div className="post__who">
                <span className={`badge badge--${v.verdict}`}>{verdictLabel(v.verdict)}</span>
                {v.username ? <span className="post__name">@{v.username}</span> : <span className="post__prole">{proleTag(v.prole_number)}</span>}
                <span className="post__time">{timeAgo(v.updated_at)}</span>
              </div>
              {(v.is_own || user?.is_admin) && !v.is_own && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(v.id)}>Remove</button>}
            </div>
            {v.body && <p className="post__body">{v.body}</p>}
            <div className="post__foot">
              <Upvote count={v.upvotes} active={v.user_upvoted} disabled={!verified || v.is_own} onClick={() => upvote.mutate(v.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
