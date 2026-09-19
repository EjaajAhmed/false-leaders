import { useEffect, useState } from 'react'
import { useTitle } from '../lib/hooks'
import { useLoginHref } from '../lib/hooks'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { changeUsername, getMe, getMyActivity, updateNotifPrefs, resendVerification } from '../api/auth'
import { errorMessage } from '../api/client'
import { Empty, Loading } from '../components/States'
import { BOARD_LABEL } from '../components/forum/ThreadRow'
import { proleTag, ratingColor, timeAgo } from '../lib/format'
import { ARCHIVED } from '../config'
import ThemePicker from '../components/ThemePicker'

type ActivityTab = 'ratings' | 'threads' | 'proposals' | 'bookmarks'

export default function Profile() {
  useTitle('Profile')
  const { user, loginUser, logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<ActivityTab>('ratings')
  const [newUsername, setNewUsername] = useState('')
  const [usernameMsg, setUsernameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showUsername, setShowUsername] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const loginHref = useLoginHref()
  useEffect(() => { if (!user) navigate(loginHref, { replace: true }) }, [user, navigate, loginHref])

  const me = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !!user })
  const activity = useQuery({ queryKey: ['me-activity'], queryFn: getMyActivity, enabled: !!user })

  const usernameMutation = useMutation({
    mutationFn: changeUsername,
    onSuccess: (data) => {
      loginUser({ ...user!, username: data.username }, data.token || localStorage.getItem('token')!)
      setUsernameMsg({ ok: true, text: 'Updated.' })
      setNewUsername(''); setShowUsername(false)
      qc.invalidateQueries({ queryKey: ['me'] })
      setTimeout(() => setUsernameMsg(null), 3000)
    },
    onError: (err) => setUsernameMsg({ ok: false, text: errorMessage(err) }),
  })

  const prefsMutation = useMutation({
    mutationFn: updateNotifPrefs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  if (!user) return null

  const prefs = me.data
  const pref = (key: string, label: string, help: string) => (
    <button type="button" className={`switch${prefs?.[key] ? ' is-on' : ''}`} style={{ justifyContent: 'space-between', width: '100%', padding: '0.7rem 0', borderBottom: '1px solid var(--border)' }} onClick={() => prefsMutation.mutate({ [key]: !prefs?.[key] })} disabled={!prefs}>
      <span style={{ textAlign: 'left' }}>
        <span className="switch__label is-current" style={{ display: 'block' }}>{label}</span>
        <span className="help" style={{ textTransform: 'none', letterSpacing: 0 }}>{help}</span>
      </span>
      <span className="switch__track"><span className="switch__knob" /></span>
    </button>
  )

  const lists = activity.data
  const activityBody = () => {
    if (activity.isLoading) return <Loading />
    if (!lists) return null
    if (tab === 'ratings') {
      if (!lists.ratings.length) return <Empty text="You haven't rated anyone. Yet." />
      return lists.ratings.map((r: any) => (
        <Link key={r.leader_id} to={`/leaders/${r.leader_id}?tab=rating`} className="lb-row card--link" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="mono" style={{ color: ratingColor(Number(r.score)), fontWeight: 600 }}>{r.score}</span>
          <div style={{ minWidth: 0 }}>
            <div className="lb-row__name truncate">{r.leader_name}</div>
            <div className="lb-row__meta truncate">Your rating · community {r.rating_avg == null ? `unrated (${r.rating_count ?? 0} so far)` : `${r.rating_avg} from ${r.rating_count}`}</div>
          </div>
          <span className="mono tiny dim">{timeAgo(r.updated_at)}</span>
        </Link>
      ))
    }
    if (tab === 'threads') {
      if (!lists.threads.length) return <Empty text="No threads yet. Start one on the forum." />
      return lists.threads.map((t: any) => (
        <Link key={t.id} to={`/forum/${t.id}`} className="post card--link" style={{ display: 'block' }}>
          <div className="post__head">
            <div className="post__who">
              <span className="badge badge--outline">{BOARD_LABEL[t.board] || t.board}</span>
              {t.leader_name && <span className="post__name">{t.leader_name}</span>}
              <span className="post__time">{timeAgo(t.last_activity)}</span>
            </div>
            <span className="mono tiny dim">{t.is_anonymous ? proleTag(user.prole_number) : `@${user.username}`} · {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'} · {t.upvotes} up</span>
          </div>
          <p className="post__body small">{t.title}</p>
        </Link>
      ))
    }
    if (tab === 'proposals') {
      if (!lists.proposals.length) return <Empty text="No proposals. Controversies don't file themselves." />
      return lists.proposals.map((p: any) => (
        <Link key={p.id} to={`/leaders/${p.leader_id}?tab=controversies`} className="post card--link" style={{ display: 'block' }}>
          <div className="post__head">
            <div className="post__who">
              <span className={`badge badge--${p.level}`}>{p.level}</span>
              <span className="post__name">{p.title}</span>
            </div>
            <span className={`badge ${p.status === 'approved' ? 'badge--gold' : 'badge--outline'}`}>{p.status}</span>
          </div>
          <p className="small muted" style={{ marginTop: '0.3rem' }}>{p.leader_name} · {timeAgo(p.created_at)}</p>
        </Link>
      ))
    }
    if (!lists.bookmarks.length) return <Empty text="Nothing saved. Everyone is worth watching." />
    return lists.bookmarks.map((b: any) => (
      <Link key={b.id} to={`/leaders/${b.leader_id}`} className="lb-row" style={{ borderTop: '1px solid var(--border)' }}>
        <span className="mono" style={{ color: ratingColor(b.rating_avg == null ? null : Number(b.rating_avg)), fontWeight: 600 }}>{b.rating_avg == null ? '—' : b.rating_avg}</span>
        <div style={{ minWidth: 0 }}>
          <div className="lb-row__name truncate">{b.leader_name}</div>
          <div className="lb-row__meta truncate">{b.position}{b.graft_name ? ` · ${b.graft_name}` : ''}</div>
        </div>
        <span className="mono tiny dim">{timeAgo(b.created_at)}</span>
      </Link>
    ))
  }

  return (
    <div className="page page--narrow">
      <div className="page-head">
        <p className="eyebrow">Two identities. One account.</p>
        <h1>Profile</h1>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <p className="eyebrow">Public identity</p>
          <h2 style={{ fontSize: '1.6rem', margin: '0.5rem 0 0.25rem' }}>@{user.username}</h2>
          <p className="muted small">{user.email}</p>
          <p className="help" style={{ marginTop: '0.75rem' }}>Shown on posts you choose to sign. Used for your bookmarks and grafts.</p>
        </div>
        <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--text) 35%, transparent)' }}>
          <p className="eyebrow eyebrow--gold">Anonymous identity</p>
          <h2 className="mono" style={{ fontSize: '1.6rem', margin: '0.5rem 0 0.25rem', color: 'var(--gold)', fontWeight: 600 }}>{proleTag(user.prole_number)}</h2>
          <p className="muted small">Assigned on registration. Permanent.</p>
          <p className="help" style={{ marginTop: '0.75rem' }}>Never linked to your username in public. Anything you choose to post anonymously carries this number. Ratings are never shown with either.</p>
        </div>
      </div>

      {!user.email_verified && (
        <div className="notice" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <span>Unverified. Ratings and the forum are locked.</span>
          <button className="btn btn--sm" onClick={() => resendVerification().then(() => alert('Sent.'))}>Resend email</button>
        </div>
      )}

      <div className="section-title"><h2>Activity</h2></div>
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {([['ratings', 'Ratings'], ['threads', 'Threads'], ...(ARCHIVED.controversies ? [] : [['proposals', 'Proposals']]), ['bookmarks', 'Bookmarks']] as [ActivityTab, string][]).map(([k, l]) => (
          <button key={k} className={`tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
            {l}{lists?.[k]?.length ? <span className="tab__count">{lists[k].length}</span> : null}
          </button>
        ))}
      </div>
      <div className="stack" style={{ marginBottom: '2.5rem' }}>{activityBody()}</div>

      <div className="section-title"><h2>Settings</h2></div>
      <div className="stack">
        <div className="card">
          <div className="row row--between" style={{ cursor: 'pointer' }} onClick={() => setShowUsername(!showUsername)}>
            <div>
              <p style={{ fontWeight: 500 }}>Change username</p>
              <p className="help">Currently @{user.username}</p>
            </div>
            <span className="dim mono">{showUsername ? '−' : '+'}</span>
          </div>
          {showUsername && (
            <div className="row" style={{ marginTop: '0.9rem' }}>
              <input className="input" placeholder="New username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              <button className="btn btn--gold" disabled={!newUsername.trim() || usernameMutation.isPending} onClick={() => usernameMutation.mutate(newUsername.trim())}>Save</button>
            </div>
          )}
          {usernameMsg && <p className={usernameMsg.ok ? 'notice' : 'error'} style={{ marginTop: '0.75rem' }}>{usernameMsg.text}</p>}
        </div>

        <div className="card">
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>Appearance</p>
          <ThemePicker />
          <p className="help" style={{ marginTop: '0.75rem' }}>Saved to your account and applied wherever you sign in.</p>
        </div>

        <div className="card">
          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Signals</p>
          {pref('email_notifications', 'Email', 'Send signals to your inbox as well as here.')}
          {pref('notif_comment_replies', 'Discussion', 'When someone joins a discussion you are in.')}
          {pref('notif_politician_updates', 'Bookmarked leaders', 'When a bookmarked leader changes.')}
          {pref('notif_app_news', 'Bulletins', 'Occasional dispatches from FalseLeaders.')}
        </div>

        {user.is_admin && (
          <Link to="/admin" className="card card--link row row--between">
            <span style={{ fontWeight: 500 }}>Admin</span><span className="eyebrow">Open →</span>
          </Link>
        )}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Legal</p>
          <p className="legal-links"><Link to="/terms">Terms of Service</Link><Link to="/acceptable-use">Acceptable use</Link><Link to="/takedown">Takedown requests</Link><Link to="/contact">Contact</Link></p>
        </div>
        <Link to="/bookmarks" className="card card--link row row--between">
          <span style={{ fontWeight: 500 }}>Manage grafts</span><span className="eyebrow">Open →</span>
        </Link>

        <div style={{ paddingTop: '0.5rem' }}>
          {!confirmLogout ? (
            <button className="btn btn--danger" onClick={() => setConfirmLogout(true)}>Sign out</button>
          ) : (
            <div className="row">
              <span className="small muted">Sure?</span>
              <button className="btn btn--danger" onClick={() => { logout(); navigate('/') }}>Yes, sign out</button>
              <button className="btn btn--ghost" onClick={() => setConfirmLogout(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
