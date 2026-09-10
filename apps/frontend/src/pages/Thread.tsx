import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getThread, createPost, upvoteThread, upvotePost, removePost, removeThread, moderateThread } from '../api/politicians'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { usePostAsProle } from '../lib/identity'
import IdentityToggle from '../components/IdentityToggle'
import Upvote from '../components/Upvote'
import { Loading } from '../components/States'
import { BOARD_LABEL } from '../components/forum/ThreadRow'
import { proleTag, timeAgo, formatDate } from '../lib/format'

/** Render >>N references as links to posts in the thread. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(>>\d+)/g)
  return <p className="post__body">{parts.map((p, i) => /^>>\d+$/.test(p) ? <a key={i} href={`#p${p.slice(2)}`} style={{ color: 'var(--text)', borderBottom: '1px solid var(--accent)' }}>{p}</a> : <span key={i}>{p}</span>)}</p>
}

export default function Thread() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [anon, setAnon] = usePostAsProle()
  const [error, setError] = useState('')
  const verified = !!user?.email_verified

  const { data, isLoading, isError } = useQuery({ queryKey: ['thread', id], queryFn: () => getThread(id!), refetchInterval: 45000 })
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['thread', id] }); qc.invalidateQueries({ queryKey: ['threads'] }) }
  const post = useMutation({ mutationFn: createPost, onSuccess: () => { invalidate(); setBody(''); setError('') }, onError: e => setError(errorMessage(e)) })
  const upT = useMutation({ mutationFn: upvoteThread, onSuccess: invalidate })
  const upP = useMutation({ mutationFn: upvotePost, onSuccess: invalidate })
  const delP = useMutation({ mutationFn: removePost, onSuccess: invalidate })
  const delT = useMutation({ mutationFn: removeThread, onSuccess: () => navigate('/forum') })
  const mod = useMutation({ mutationFn: moderateThread, onSuccess: invalidate })

  if (isLoading) return <div className="page"><Loading /></div>
  if (isError || !data) return <div className="page page--narrow" style={{ paddingTop: '5rem' }}><p className="eyebrow">404</p><h1 style={{ fontSize: '2.2rem', margin: '0.5rem 0 1rem' }}>No such thread.</h1><Link to="/forum" className="btn">Back to the forum</Link></div>
  const t = data.thread
  const who = (x: any) => x.username ? <span className="post__name">@{x.username}</span> : <span className="post__prole">{proleTag(x.prole_number)}</span>
  const quote = (seq: number) => { setBody(b => `${b}${b && !b.endsWith('\n') ? '\n' : ''}>>${seq} `); document.getElementById('reply-box')?.focus() }

  return (
    <div className="page page--narrow" style={{ maxWidth: 860 }}>
      <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
        <Link to="/forum">Forum</Link> · <Link to={`/forum?board=${t.board}`}>{BOARD_LABEL[t.board] || t.board}</Link>{t.leader_name && <> · <Link to={`/leaders/${t.politician_id}?tab=discussion`}>{t.leader_name}</Link></>}
      </p>
      <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', marginBottom: '1rem' }}>{t.title}</h1>

      <div className="post" id="p0" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="post__head">
          <div className="post__who">{who(t)}<span className="post__time" title={formatDate(t.created_at)}>OP · {timeAgo(t.created_at)}</span>{t.pinned && <span className="badge badge--gold">Pinned</span>}{t.locked && <span className="badge badge--outline">Locked</span>}</div>
          <div className="row" style={{ gap: '0.3rem' }}>
            {user?.is_admin && <>
              <button className="btn btn--ghost btn--sm" onClick={() => mod.mutate({ id: t.id, locked: !t.locked })}>{t.locked ? 'Unlock' : 'Lock'}</button>
              <button className="btn btn--ghost btn--sm" onClick={() => mod.mutate({ id: t.id, pinned: !t.pinned })}>{t.pinned ? 'Unpin' : 'Pin'}</button>
            </>}
            {(t.is_own && t.reply_count === 0) || user?.is_admin ? <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm('Remove this thread?')) delT.mutate(t.id) }}>Remove</button> : null}
          </div>
        </div>
        <Body text={t.body} />
        <div className="post__foot"><Upvote count={t.upvotes} active={t.user_upvoted} disabled={!verified || t.is_own} onClick={() => upT.mutate(t.id)} />{verified && !t.locked && <button className="btn btn--ghost btn--sm" onClick={() => quote(0)}>Reply</button>}</div>
      </div>

      <div className="stack" style={{ marginTop: '0.75rem' }}>
        {data.posts.map((p: any) => (
          <div key={p.id} className="post" id={`p${p.seq}`} style={{ opacity: p.status === 'removed' ? 0.5 : 1 }}>
            <div className="post__head">
              <div className="post__who"><span className="mono tiny dim">#{p.seq}</span>{p.status !== 'removed' && who(p)}<span className="post__time" title={formatDate(p.created_at)}>{timeAgo(p.created_at)}</span>{p.reply_to != null && <a href={`#p${p.reply_to}`} className="mono tiny muted">→ #{p.reply_to}</a>}</div>
              {(p.is_own || user?.is_admin) && p.status !== 'removed' && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => delP.mutate(p.id)}>Remove</button>}
            </div>
            <Body text={p.body} />
            {p.status !== 'removed' && <div className="post__foot"><Upvote count={p.upvotes} active={p.user_upvoted} disabled={!verified || p.is_own} onClick={() => upP.mutate(p.id)} />{verified && !t.locked && <button className="btn btn--ghost btn--sm" onClick={() => quote(p.seq)}>Reply</button>}</div>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {!user && <div className="notice notice--plain"><Link to="/login" style={{ borderBottom: '1px solid var(--border-strong)' }}>Sign in</Link> to reply.</div>}
        {user && !verified && <div className="notice">Verify your email to reply.</div>}
        {verified && t.locked && <div className="notice notice--plain">This thread is locked.</div>}
        {verified && !t.locked && (
          <div className="card card--elevated stack">
            <span className="eyebrow">Reply · use &gt;&gt;3 to reference post #3</span>
            <textarea id="reply-box" className="textarea" rows={4} value={body} onChange={e => setBody(e.target.value)} maxLength={6000} placeholder="Reply" />
            <IdentityToggle anonymous={anon} onChange={setAnon} />
            {error && <div className="error">{error}</div>}
            <div><button className="btn btn--gold" disabled={!body.trim() || post.isPending} onClick={() => { const m = body.match(/>>(\d+)/); post.mutate({ thread_id: t.id, body: body.trim(), is_anonymous: anon, reply_to: m ? Number(m[1]) : undefined }) }}>{post.isPending ? 'Posting' : 'Post reply'}</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
