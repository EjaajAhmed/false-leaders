import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import IdentityToggle from '../IdentityToggle'
import { Empty, Loading } from '../States'
import { useAuth } from '../../context/AuthContext'
import { usePostAsProle } from '../../lib/identity'
import { getComments, postComment, deleteComment } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { proleTag, timeAgo } from '../../lib/format'

export default function Discussion({ leaderId }: { leaderId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [anon, setAnon] = usePostAsProle()
  const [error, setError] = useState('')
  const verified = !!user?.email_verified

  const { data: comments, isLoading } = useQuery({ queryKey: ['comments', leaderId], queryFn: () => getComments(leaderId) })
  const post = useMutation({
    mutationFn: postComment,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', leaderId] }); setBody(''); setError('') },
    onError: (e) => setError(errorMessage(e)),
  })
  const del = useMutation({ mutationFn: deleteComment, onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', leaderId] }) })

  return (
    <div>
      {!user && <div className="notice notice--plain" style={{ marginBottom: '1rem' }}><Link to="/login" style={{ borderBottom: '1px solid var(--border-strong)' }}>Sign in</Link> to join the discussion.</div>}
      {user && !verified && <div className="notice" style={{ marginBottom: '1rem' }}>Verify your email to post.</div>}
      {verified && (
        <div className="stack" style={{ marginBottom: '1.25rem' }}>
          <textarea className="textarea" placeholder="Say what you know." value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={3} />
          <IdentityToggle anonymous={anon} onChange={setAnon} />
          {error && <div className="error">{error}</div>}
          <div><button className="btn btn--gold" disabled={!body.trim() || post.isPending} onClick={() => post.mutate({ politician_id: leaderId, body: body.trim(), is_anonymous: anon })}>{post.isPending ? 'Posting' : 'Post'}</button></div>
        </div>
      )}
      {isLoading && <Loading />}
      {!isLoading && comments?.length === 0 && <Empty text="No discussion yet." />}
      <div className="stack">
        {comments?.map((c: any) => (
          <div key={c.id} className="post">
            <div className="post__head">
              <div className="post__who">
                {c.username ? <span className="post__name">@{c.username}</span> : <span className="post__prole">{proleTag(c.prole_number)}</span>}
                <span className="post__time">{timeAgo(c.created_at)}</span>
              </div>
              {(c.is_own || user?.is_admin) && <button className="btn btn--ghost btn--sm" onClick={() => del.mutate(c.id)}>Delete</button>}
            </div>
            <p className="post__body">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
