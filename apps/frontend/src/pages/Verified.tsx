import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Verified() {
  const [searchParams] = useSearchParams()
  const { loginUser, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    const username = searchParams.get('username')
    if (searchParams.get('error')) { setError(true); return }
    if (token && username) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        loginUser({ id: payload.id, username: payload.username, email: '', prole_number: payload.prole_number, is_admin: payload.is_admin, email_verified: true }, token)
        refreshUser()
      } catch { setError(true); return }
      const t = setTimeout(() => navigate('/'), 1800)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div className="noise" style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div className="hero__rule" style={{ margin: '0 auto 1.5rem' }} />
        {error ? (
          <>
            <p className="eyebrow">Verification</p>
            <h1 style={{ fontSize: '2.6rem', margin: '0.5rem 0 1rem' }}>Link expired.</h1>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>This link is invalid or has lapsed. Sign in and request a new one.</p>
            <Link to="/login" className="btn btn--gold">Sign in</Link>
          </>
        ) : (
          <>
            <p className="eyebrow eyebrow--gold">Verification</p>
            <h1 style={{ fontSize: '2.6rem', margin: '0.5rem 0 1rem' }}>Cleared.</h1>
            <p className="muted">Your account is active. Taking you in.</p>
          </>
        )}
      </div>
    </div>
  )
}
