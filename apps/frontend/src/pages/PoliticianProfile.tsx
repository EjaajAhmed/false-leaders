import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPolitician, getComments, postComment, deleteComment, vote, getVotes, getGrafts, addBookmark, removeBookmark, checkBookmark } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import TruthScore from '../components/TruthScore'
import ControversyList from '../components/ControversyList'
import FundingTab from '../components/FundingTab'
import InfluenceTab from '../components/InfluenceTab'

export default function PoliticianProfile() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [showGraftPicker, setShowGraftPicker] = useState(false)
  const graftPickerRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'controversies' | 'comments' | 'funding' | 'influence'>('controversies')

  const isVerified = !!user?.email_verified

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (graftPickerRef.current && !graftPickerRef.current.contains(e.target as Node)) {
        setShowGraftPicker(false)
      }
    }
    if (showGraftPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showGraftPicker])

  const { data: politician, isLoading } = useQuery({ queryKey: ['politician', id], queryFn: () => getPolitician(id!) })
  const { data: comments } = useQuery({ queryKey: ['comments', id], queryFn: () => getComments(id!), enabled: isVerified })
  const { data: votes } = useQuery({ queryKey: ['votes', id], queryFn: () => getVotes(id!) })
  const { data: bookmarkStatus, refetch: refetchBookmark } = useQuery({ queryKey: ['bookmark', id], queryFn: () => checkBookmark(id!), enabled: isVerified })
  const { data: grafts } = useQuery({ queryKey: ['grafts'], queryFn: getGrafts, enabled: isVerified })

  const commentMutation = useMutation({
    mutationFn: postComment,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', id] }); setComment('') }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', id] })
  })

  const voteMutation = useMutation({
    mutationFn: vote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['votes', id] })
  })

  const bookmarkMutation = useMutation({
    mutationFn: addBookmark,
    onSuccess: () => refetchBookmark()
  })

  const unbookmarkMutation = useMutation({
    mutationFn: removeBookmark,
    onSuccess: () => refetchBookmark()
  })

  const resendVerification = () => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(() => alert('Verification email sent!'))
  }

  if (isLoading) return <p style={{ padding: '2rem' }}>Loading...</p>
  if (!politician) return <p style={{ padding: '2rem' }}>Politician not found.</p>

  const savedBookmarks = bookmarkStatus?.bookmarks || []
  const isSaved = bookmarkStatus?.bookmarked

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>

      {/* Profile card */}
      <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', marginBottom: '2rem', position: 'relative' }}>

        {/* Bookmark button — verified only */}
        {isVerified && (
          <div ref={graftPickerRef} style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <button
              onClick={() => setShowGraftPicker(!showGraftPicker)}
              title={isSaved ? 'Saved' : 'Save'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1.3rem', lineHeight: 1, color: isSaved ? '#111' : '#ccc', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#111')}
              onMouseLeave={e => (e.currentTarget.style.color = isSaved ? '#111' : '#ccc')}
            >
              🔖
            </button>

            {showGraftPicker && (
              <div style={{ position: 'absolute', top: '2rem', right: 0, background: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '0.75rem', zIndex: 10, minWidth: '220px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>Save to graft</p>
                <button
                  onClick={() => bookmarkMutation.mutate({ politician_id: id! })}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', borderRadius: '4px' }}
                >
                  No graft (save only)
                </button>
                {grafts?.map((g: any) => {
                  const alreadySaved = savedBookmarks.some((b: any) => b.graft_id === g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => !alreadySaved && bookmarkMutation.mutate({ politician_id: id!, graft_id: g.id })}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.4rem 0.5rem', border: 'none', background: 'none', cursor: alreadySaved ? 'default' : 'pointer', fontSize: '0.85rem', borderRadius: '4px', color: alreadySaved ? '#aaa' : 'inherit' }}
                    >
                      {g.name}
                      {alreadySaved && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                    </button>
                  )
                })}
                {savedBookmarks.length > 0 && (
                  <>
                    <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid #eee' }} />
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', color: '#aaa' }}>Saved in:</p>
                    {savedBookmarks.map((b: any) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#555' }}>{b.graft_name || 'No graft'}</span>
                        <button onClick={() => unbookmarkMutation.mutate(b.id)} style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '0.75rem' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </>
                )}
                <hr style={{ margin: '0.5rem 0', border: 'none', borderTop: '1px solid #eee' }} />
                <a href="/bookmarks" style={{ fontSize: '0.8rem', color: '#888' }}>Manage grafts</a>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>{politician.name}</h1>
            <p style={{ margin: '0.25rem 0', color: '#888' }}>{politician.party} — {politician.region}</p>
            <p style={{ margin: '0.25rem 0', fontStyle: 'italic', color: '#555' }}>{politician.position}</p>
            {politician.country && (
              <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#aaa' }}>
                {politician.country}{politician.age ? ` · Age ${politician.age}` : ''}
              </p>
            )}
          </div>
          {politician.truth_score != null && (
            <div style={{ flexShrink: 0, marginRight: '2rem' }}>
              <TruthScore score={Number(politician.truth_score)} size="lg" />
            </div>
          )}
        </div>

        {/* Vote buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1.25rem 0 0' }}>
          <button
            onClick={() => voteMutation.mutate({ politician_id: id!, type: 'up' })}
            disabled={!isVerified}
            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: '1px solid #ccc', background: 'white', cursor: isVerified ? 'pointer' : 'not-allowed' }}
          >
            Up {votes?.upvotes || 0}
          </button>
          <button
            onClick={() => voteMutation.mutate({ politician_id: id!, type: 'down' })}
            disabled={!isVerified}
            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: '1px solid #ccc', background: 'white', cursor: isVerified ? 'pointer' : 'not-allowed' }}
          >
            Down {votes?.downvotes || 0}
          </button>
        </div>
        {!user && <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.5rem 0 0' }}>Login to vote or save</p>}
        {user && !isVerified && <p style={{ fontSize: '0.75rem', color: '#e74c3c', margin: '0.5rem 0 0' }}>Verify your email to vote and comment</p>}

        {politician.bio && <p style={{ marginTop: '1rem', lineHeight: '1.6' }}>{politician.bio}</p>}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #eee', marginBottom: '1.5rem' }}>
        {[
          { key: 'controversies', label: 'Controversies' },
          { key: 'funding', label: 'Funding' },
          { key: 'influence', label: 'Foreign Influence' },
          { key: 'comments', label: 'Comments' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.6rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #1a1a1a' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab.key ? 500 : 400,
              color: activeTab === tab.key ? '#1a1a1a' : '#888',
              marginBottom: '-1px',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'controversies' && <ControversyList politicianId={id!} />}
      {activeTab === 'funding' && <FundingTab politicianId={id!} />}
      {activeTab === 'influence' && <InfluenceTab politicianId={id!} />}

      {activeTab === 'comments' && (
        !user ? (
          <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '10px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.75rem', color: '#888' }}>Create an account to view and leave comments.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <a href="/login" style={{ padding: '0.5rem 1.25rem', border: '1px solid #ddd', borderRadius: '8px', textDecoration: 'none', color: '#111', fontSize: '0.9rem' }}>Login</a>
              <a href="/register" style={{ padding: '0.5rem 1.25rem', background: '#1a1a1a', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem' }}>Create account</a>
            </div>
          </div>
        ) : !isVerified ? (
          <div style={{ padding: '1.5rem', border: '1px solid #f0c070', borderRadius: '10px', textAlign: 'center', background: '#fffdf5' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 500, fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Verify your email to participate</p>
            <p style={{ margin: '0 0 1rem', color: '#888', fontSize: '0.9rem' }}>Check your inbox for a verification link.</p>
            <button
              onClick={resendVerification}
              style={{ padding: '0.5rem 1.25rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Resend verification email
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>
              Comments {comments?.length > 0 && `(${comments.length})`}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                style={{ flex: 1, padding: '0.65rem 1rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }}
                placeholder="Write a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) commentMutation.mutate({ politician_id: id!, body: comment.trim() }) }}
              />
              <button
                onClick={() => comment.trim() && commentMutation.mutate({ politician_id: id!, body: comment.trim() })}
                disabled={!comment.trim() || commentMutation.isPending}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#111', color: 'white', cursor: 'pointer' }}
              >
                {commentMutation.isPending ? 'Posting...' : 'Post'}
              </button>
            </div>
            {comments?.length === 0 && <p style={{ color: '#aaa' }}>No comments yet. Be the first.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {comments?.map((c: any) => (
                <div key={c.id} style={{ padding: '0.875rem 1rem', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>@{c.username}</p>
                    <p style={{ margin: '0.25rem 0 0', lineHeight: '1.5' }}>{c.body}</p>
                  </div>
                  {user?.id === c.user_id && (
                    <button onClick={() => deleteMutation.mutate(c.id)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}

    </div>
  )
}