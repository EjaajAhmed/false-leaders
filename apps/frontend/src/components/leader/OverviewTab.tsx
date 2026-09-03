import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LeaderDetail } from '../../types'
import ScoreRing from '../ScoreRing'
import Sparkline from '../Sparkline'
import VerdictBar from '../VerdictBar'
import IdentityToggle from '../IdentityToggle'
import { Empty, Loading } from '../States'
import { useAuth } from '../../context/AuthContext'
import { usePostAsProle } from '../../lib/identity'
import { getComments, postComment, deleteComment, getLeaderNews } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { compact, formatDate, proleTag, scoreLabel, timeAgo, verdictLabel } from '../../lib/format'
import { ARCHIVED } from '../../config'

function Discussion({ leaderId }: { leaderId: string }) {
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
    <section style={{ marginTop: '2.5rem' }}>
      <div className="section-title">
        <h2>Discussion</h2>
        <span className="mono tiny dim">{comments?.length || 0} entries</span>
      </div>

      {!user && (
        <div className="notice notice--plain" style={{ marginBottom: '1rem' }}>
          <Link to="/login" style={{ color: 'var(--gold)' }}>Sign in</Link> to join the discussion.
        </div>
      )}
      {user && !verified && <div className="notice" style={{ marginBottom: '1rem' }}>Verify your email to post.</div>}

      {verified && (
        <div className="stack" style={{ marginBottom: '1.25rem' }}>
          <textarea className="textarea" placeholder="Say what you know." value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={3} />
          <IdentityToggle anonymous={anon} onChange={setAnon} />
          {error && <div className="error">{error}</div>}
          <div>
            <button className="btn btn--gold" disabled={!body.trim() || post.isPending} onClick={() => post.mutate({ politician_id: leaderId, body: body.trim(), is_anonymous: anon })}>
              {post.isPending ? 'Posting' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && comments?.length === 0 && <Empty text="No discussion. Silence is also a statement." />}
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
    </section>
  )
}

function Headlines({ leaderId }: { leaderId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['news', leaderId], queryFn: () => getLeaderNews(leaderId), staleTime: 10 * 60 * 1000 })
  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: '0.25rem' }}>
        <span className="eyebrow">Latest headlines · 30 days</span>
        {data?.fetched_at && <span className="mono tiny dim">via GDELT</span>}
      </div>
      {isLoading && <Loading />}
      {!isLoading && !data?.items?.length && <p className="dim small" style={{ padding: '0.75rem 0' }}>Nothing indexed in the last 30 days.</p>}
      {data?.items?.map((h, i) => (
        <div key={i} className="headline">
          <div className="headline__meta">{h.date}<br />{h.source}</div>
          <a className="headline__title" href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a>
        </div>
      ))}
    </div>
  )
}

export default function OverviewTab({ leader, onGoTo }: { leader: LeaderDetail; onGoTo: (tab: any) => void }) {
  const score = Number(leader.truth_score)
  const verdict = leader.verdicts
  const history = leader.score_history || []
  const first = history[0]?.s
  const delta = first != null ? score - first : 0

  return (
    <div>
      <div className="overview-grid">
        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', gap: '1rem', padding: '1.75rem 1rem', flexWrap: 'wrap' }}>
            <ScoreRing value={score} size="lg" label="TruthScore" sublabel={scoreLabel(score)} />
            <ScoreRing value={verdict?.score} size="lg" label="Community verdict" sublabel={verdict?.total ? verdictLabel(verdict.dominant) : 'No verdicts'} />
          </div>

          <div className="card">
            <div className="row row--between" style={{ marginBottom: '0.75rem' }}>
              <span className="eyebrow">TruthScore · 30 days</span>
              {history.length > 1 && (
                <span className={`mono small ${delta < 0 ? 'delta-down' : delta > 0 ? 'delta-up' : 'dim'}`}>{delta > 0 ? '+' : ''}{delta}</span>
              )}
            </div>
            <Sparkline points={history} />
          </div>

          <div className="card">
            <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
              <span className="eyebrow">Community verdict</span>
              <button className="btn btn--ghost btn--sm" onClick={() => onGoTo('verdicts')}>Cast yours →</button>
            </div>
            <VerdictBar counts={verdict?.counts} size="lg" legend />
          </div>

          <Headlines leaderId={leader.id} />
        </div>

        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="grid-2" style={{ gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
            {([
              ['Watching · 30d', Number(leader.attention) > 0 ? compact(leader.attention) : '—', null],
              ['Controversies', leader.stats?.controversies, 'controversies'],
              ['Verdicts', leader.stats?.verdicts, 'verdicts'],
              ['Leaks', leader.stats?.leaks, 'leaks'],
              ['Discussion', leader.stats?.comments, null],
            ] as [string, number | string | undefined, string | null][]).filter(([, , target]) => !(target && (ARCHIVED as Record<string, boolean>)[target])).map(([label, v, target]) => (
              <button key={String(label)} className="stat" style={{ textAlign: 'left', cursor: target ? 'pointer' : 'default', border: '1px solid var(--border)' }} onClick={() => target && onGoTo(target)}>
                <div className="stat__value">{v ?? 0}</div>
                <div className="stat__label eyebrow">{label}</div>
              </button>
            ))}
          </div>

          <div className="card">
            <p className="eyebrow" style={{ marginBottom: '0.6rem' }}>Dossier</p>
            {leader.bio && <p style={{ lineHeight: 1.6, color: 'var(--text)', fontWeight: 500 }}>{leader.bio}</p>}
            {leader.summary ? (
              <p style={{ lineHeight: 1.65, color: '#b9b3a7', marginTop: leader.bio ? '0.75rem' : 0, fontSize: '0.9rem' }}>{leader.summary}</p>
            ) : !leader.bio ? (
              <p className="dim">No biography on file. Someone should fix that.</p>
            ) : null}
            {leader.wiki_url && (
              <p className="mono tiny dim" style={{ marginTop: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Source · <a href={leader.wiki_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border-strong)' }}>Wikipedia</a> · CC BY-SA
              </p>
            )}
            <dl style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', fontSize: '0.82rem' }}>
              {[
                ['Position', leader.position], ['Party', leader.party], ['Region', leader.region], ['Country', leader.country],
                ['Born', leader.born ? formatDate(leader.born) : null], ['Age', leader.age],
                ['Net worth', leader.net_worth ? `$${compact(leader.net_worth)}` : null],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={String(k)} style={{ display: 'contents' }}>
                  <dt className="eyebrow" style={{ paddingTop: '0.15rem' }}>{k}</dt>
                  <dd className="mono small">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <Discussion leaderId={leader.id} />
    </div>
  )
}
