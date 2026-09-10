import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resendVerification } from '../api/auth'
import { proleTag } from '../lib/format'
import Stamp from './Stamp'
import Logo from './Logo'

const DESKTOP = [
  { to: '/', label: 'Home' },
  { to: '/browse', label: 'Browse' },
  { to: '/forum', label: 'Forum' },
  { to: '/feed', label: 'The Wall' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/map', label: 'Map' },
]

const Icon = {
  home: <svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" /></svg>,
  browse: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>,
  feed: <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10" /></svg>,
  board: <svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>,
  map: <svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
}

const MOBILE = [
  { to: '/', label: 'Home', icon: Icon.home },
  { to: '/browse', label: 'Browse', icon: Icon.browse },
  { to: '/forum', label: 'Forum', icon: Icon.feed },
  { to: '/leaderboard', label: 'Ranks', icon: Icon.board },
  { to: '/map', label: 'Map', icon: Icon.map },
]

export default function Navbar() {
  const { user } = useAuth()
  const location = useLocation()
  const isActive = (to: string) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const resend = () => {
    resendVerification().then(() => alert('Verification email sent.')).catch(() => alert('Could not send. Try again later.'))
  }

  return (
    <>
      <aside className="sidebar">
        <Link to="/" className="sidebar__brand">
          <Logo />
          <div className="sidebar__brand-name" style={{ marginTop: '0.6rem' }}>FalseLeaders</div>
          <div className="sidebar__brand-tag"><Stamp className="stamp--small" /></div>
        </Link>

        <nav className="sidebar__links">
          {DESKTOP.map(l => (
            <Link key={l.to} to={l.to} className={`sidebar__link${isActive(l.to) ? ' is-active' : ''}`}>{l.label}</Link>
          ))}
          {user?.email_verified && (
            <Link to="/bookmarks" className={`sidebar__link${isActive('/bookmarks') ? ' is-active' : ''}`}>Bookmarks</Link>
          )}
          {user?.is_admin && (
            <Link to="/admin" className={`sidebar__link${isActive('/admin') ? ' is-active' : ''}`}>Admin</Link>
          )}
        </nav>

        {user && !user.email_verified && (
          <div className="sidebar__warn" style={{ marginBottom: '0.75rem' }}>
            <p>Unverified. Check your email to activate.</p>
            <button onClick={resend}>Resend</button>
          </div>
        )}

        <div className="sidebar__foot">
          {user ? (
            <Link to="/profile" className="sidebar__identity">
              <div className="name truncate">@{user.username}</div>
              <div className="prole">{proleTag(user.prole_number)}</div>
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--sm">Sign in</Link>
              <Link to="/register" className="btn btn--gold btn--sm">Register</Link>
            </>
          )}
        </div>
      </aside>

      <nav className="mobile-nav">
        {MOBILE.map(tab => {
          return (
            <Link key={tab.to} to={tab.to} className={`mobile-nav__tab${isActive(tab.to) ? ' is-active' : ''}`}>
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
