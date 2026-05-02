import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/Logo.png'

export default function Navbar() {
  const { user } = useAuth()
  const location = useLocation()

  const link = (to: string, label: string) => {
    const active = location.pathname === to
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

  return (
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
      boxSizing: 'border-box'
    }}>
      <Link to="/" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <img src={logo} alt="False Leaders" style={{ width: '150px', height: 'auto' }} />
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
        {link('/', 'Home')}
        {link('/browse', 'Politicians')}
        {link('/map', 'Map')}
        {user && link('/bookmarks', 'Bookmarks')}
        {user?.is_admin && link('/admin', 'Admin')}
      </div>

      {user && !(user as any).email_verified && (
      <div style={{ margin: '0.5rem 0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '6px' }}>
        <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', color: '#c9a84c' }}>Email not verified</p>
        <button
        onClick={() => fetch('/auth/resend-verification', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })}
        style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '0.75rem', padding: 0, textDecoration: 'underline' }}
      >
        Resend verification email
      </button>
      </div>
      )}

      <div style={{ borderTop: '1px solid #333', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {user ? (
          <>
            <Link to="/profile" style={{
              display: 'block',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              color: '#c9a84c',
              border: '1px solid #c9a84c33',
              textAlign: 'center',
              letterSpacing: '0.04em'
            }}>
              @{user.username}
            </Link>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/login" style={{ display: 'block', padding: '0.5rem', textAlign: 'center', color: '#888', textDecoration: 'none', fontSize: '0.85rem' }}>
              Login
            </Link>
            <Link to="/register" style={{ display: 'block', padding: '0.5rem', textAlign: 'center', background: '#c9a84c', color: '#1a1a1a', textDecoration: 'none', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 500 }}>
              Register
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
