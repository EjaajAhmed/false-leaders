import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/Logo.png'

const TABS = [
  { to: '/', label: 'Home', icon: '𓉱' },
  { to: '/browse', label: 'Browse', icon: 'ᯤ' },
  { to: '/map', label: 'Map', icon: '🌐' },
  { to: '/bookmarks', label: 'Saved', icon: '𖤘' },
  { to: '/profile', label: 'Profile', icon: '𖠋' },
]

export default function Navbar() {
  const { user } = useAuth()
  const location = useLocation()

  const isActive = (to: string) => location.pathname === to

  const desktopLink = (to: string, label: string) => {
    const active = isActive(to)
    return (
      <Link to={to} style={{
        display: 'block',
        padding: '0.6rem 1.25rem',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '0.9rem',
        letterSpacing: '0.04em',
        background: active ? 'rgba(201,168,76,0.15)' : 'none',
        color: active ? '#c9a84c' : '#888',
        transition: 'all 0.15s'
      }}>
        {label}
      </Link>
    )
  }

  const resendVerification = () => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(() => alert('Verification email sent! Check your inbox.'))
  }

  // Tabs to show on mobile — filter based on auth state
  const mobileTabs = TABS.filter(tab => {
    if (tab.to === '/bookmarks') return !!user?.email_verified
    if (tab.to === '/profile') return true
    return true
  })

  return (
    <>
      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <div style={{
        width: '180px',
        minWidth: '180px',
        height: '100vh',
        background: '#1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0.75rem',
        position: 'sticky',
        top: 0,
        boxSizing: 'border-box',
      }} className="desktop-nav">
        <Link to="/" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <img src={logo} alt="False Leaders" style={{ width: '150px', height: 'auto' }} />
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          {desktopLink('/', 'Home')}
          {desktopLink('/browse', 'Politicians')}
          {desktopLink('/map', 'Map')}
          {user?.email_verified && desktopLink('/bookmarks', 'Bookmarks')}
          {user?.is_admin && desktopLink('/admin', 'Admin')}
        </div>

        {user && !user.email_verified && (
          <div style={{ margin: '0.5rem 0.75rem', padding: '0.75rem', background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '6px' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#e74c3c', fontWeight: 500 }}>Account not verified</p>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', color: '#aaa', lineHeight: 1.4 }}>Check your email to activate your account.</p>
            <button
              onClick={resendVerification}
              style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.7rem', padding: 0, textDecoration: 'underline' }}
            >
              Resend email
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid #333', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {user ? (
            <Link to="/profile" style={{
              display: 'block',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              color: user.email_verified ? '#c9a84c' : '#666',
              border: `1px solid ${user.email_verified ? '#c9a84c33' : '#333'}`,
              textAlign: 'center',
              letterSpacing: '0.04em'
            }}>
              @{user.username}
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link to="/login" style={{ display: 'block', padding: '0.5rem', textAlign: 'center', color: '#888', textDecoration: 'none', fontSize: '0.85rem' }}>Login</Link>
              <Link to="/register" style={{ display: 'block', padding: '0.5rem', textAlign: 'center', background: '#c9a84c', color: '#1a1a1a', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 500 }}>Register</Link>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR (hidden on desktop) ── */}
      <nav className="mobile-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {mobileTabs.map(tab => {
          const active = isActive(tab.to)
          // Show login link in Profile slot if not logged in
          const href = tab.to === '/profile' && !user ? '/login' : tab.to
          return (
            <Link
              key={tab.to}
              to={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                textDecoration: 'none',
                color: active ? '#c9a84c' : '#666',
                fontSize: '0.6rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '20%',
                  right: '20%',
                  height: '2px',
                  background: '#c9a84c',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{tab.icon}</span>
              <span>{tab.to === '/profile' && user ? `@${user.username.slice(0, 8)}` : tab.label}</span>
            </Link>
          )
        })}

        {/* Admin tab if applicable */}
        {user?.is_admin && (
          <Link
            to="/admin"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              color: isActive('/admin') ? '#c9a84c' : '#666',
              fontSize: '0.6rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              position: 'relative',
            }}
          >
            {isActive('/admin') && (
              <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px', background: '#c9a84c', borderRadius: '0 0 2px 2px' }} />
            )}
            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>⚙️</span>
            <span>Admin</span>
          </Link>
        )}
      </nav>

      {/* Spacer so content doesn't hide behind mobile tab bar */}
      <div className="mobile-nav-spacer" style={{ height: '64px' }} />

      <style>{`
        .desktop-nav { display: flex !important; }
        .mobile-nav { display: none !important; }
        .mobile-nav-spacer { display: none !important; }

        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
          .mobile-nav-spacer { display: block !important; }
        }
      `}</style>
    </>
  )
}