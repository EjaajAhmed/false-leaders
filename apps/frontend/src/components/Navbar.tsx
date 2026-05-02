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

  const resendVerification = () => {
    fetch(`${import.meta.env.VITE_API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(() => alert('Verification email sent! Check your inbox.'))
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
        {user?.email_verified && link('/bookmarks', 'Bookmarks')}
        {user?.is_admin && link('/admin', 'Admin')}
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