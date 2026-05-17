import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import AuthSlideshow from '../components/AuthSlideshow'

const QUOTES = [
  { text: "No one is coming to save us.", author: "" }
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [mounted, setMounted] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login({ email, password })
      loginUser(data.user, data.token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const formPanel = (
    <div style={{
      width: '100%',
      maxWidth: '480px',
      background: '#0d0d0d',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '3rem',
      position: 'relative',
      boxSizing: 'border-box',
      minHeight: '100vh',
    }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
        <Link to="/" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'sans-serif', letterSpacing: '0.04em' }}>
          Continue as guest
        </Link>
      </div>

      {/* Back arrow on mobile */}
      <button
        onClick={() => navigate('/welcome')}
        className="mobile-back-btn"
        style={{
          position: 'absolute', top: '1.5rem', left: '1.5rem',
          background: 'none', border: 'none', color: '#555',
          cursor: 'pointer', fontSize: '1.2rem', padding: 0,
          display: 'none',
        }}
      >
        ←
      </button>

      <div style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.6s ease 0.2s'
      }}>
        <h1 style={{ color: '#f5f0e8', fontSize: '2rem', margin: '0 0 0.5rem', fontWeight: 400, letterSpacing: '-0.01em', fontFamily: 'Georgia, serif' }}>
          Welcome back
        </h1>
        <p style={{ color: '#555', fontSize: '0.9rem', margin: '0 0 2.5rem', fontFamily: 'sans-serif' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#c9a84c', textDecoration: 'none' }}>Sign up</Link>
        </p>

        {error && (
          <div style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#e74c3c', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '0.875rem 1rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f5f0e8', fontSize: '0.95rem', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#c9a84c'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#888', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '0.875rem 3rem 0.875rem 1rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#f5f0e8', fontSize: '0.95rem', fontFamily: 'sans-serif', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#c9a84c'}
                onBlur={e => e.target.style.borderColor = '#2a2a2a'}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.875rem', background: loading ? '#2a2a2a' : '#c9a84c', color: loading ? '#555' : '#111', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'sans-serif', letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel { display: none !important; }
          .auth-right-panel { min-height: 100dvh !important; width: 100% !important; max-width: 100% !important; }
          .mobile-back-btn { display: block !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
        {/* Left panel — desktop only */}
        <div className="auth-left-panel" style={{ flex: 1 }}>
          <AuthSlideshow style={{ height: '100vh', position: 'sticky', top: 0 }}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '3rem' }}>
              <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', background: '#c9a84c', transform: 'rotate(45deg)', flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-45deg)', fontSize: '1rem', color: '#111', fontWeight: 700 }}>F</div>
                </div>
                <span style={{ color: '#c9a84c', fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FalseLeaders</span>
              </Link>

              <div>
                <div style={{ width: '40px', height: '2px', background: '#c9a84c', marginBottom: '1.5rem' }} />
                {quote.author === '' ? (
                  <p style={{ fontSize: '4.2rem', color: '#f5f0e8', lineHeight: 1.3, margin: '0 0 1.5rem', fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900, maxWidth: '420px' }}>
                    {quote.text}
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: '1.6rem', color: '#f5f0e8', lineHeight: 1.5, margin: '0 0 1rem', fontFamily: 'Georgia, serif', fontStyle: 'italic', maxWidth: '420px' }}>
                      "{quote.text}"
                    </p>
                    <p style={{ color: '#c9a84c', fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>— {quote.author}</p>
                  </>
                )}
              </div>

              <p style={{ color: '#555', fontSize: '0.8rem', margin: 0 }}>Hold them accountable.</p>
            </div>
          </AuthSlideshow>
        </div>

        {/* Right panel */}
        <div className="auth-right-panel" style={{ width: '480px', minWidth: '480px' }}>
          {formPanel}
        </div>
      </div>
    </>
  )
}