import { useNavigate } from 'react-router-dom'
import AuthSlideshow from '../components/AuthSlideshow'

export default function MobileAuthLanding() {
  const navigate = useNavigate()

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '1rem',
    border: primary ? 'none' : '1px solid rgba(201,168,76,0.5)',
    borderRadius: '10px',
    fontSize: '1rem',
    fontFamily: 'sans-serif',
    fontWeight: primary ? 700 : 500,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    background: primary ? '#c9a84c' : 'rgba(255,255,255,0.07)',
    color: primary ? '#111' : '#f5f0e8',
    transition: 'all 0.2s',
    backdropFilter: 'blur(4px)',
  })

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <AuthSlideshow style={{ height: '100%' }}>
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '3rem 2rem 2.5rem',
          boxSizing: 'border-box',
        }}>

          {/* Top — Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', background: '#c9a84c', transform: 'rotate(45deg)', flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-45deg)', fontSize: '1.1rem', color: '#111', fontWeight: 700 }}>F</div>
            </div>
            <span style={{ color: '#c9a84c', fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>FalseLeaders</span>
          </div>

          {/* Middle — Quote */}
          <div>
            <div style={{ width: '40px', height: '2px', background: '#c9a84c', marginBottom: '1.5rem' }} />
            <p style={{
              fontSize: '3.5rem',
              color: '#f5f0e8',
              lineHeight: 1.15,
              margin: 0,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 900,
            }}>
              No one is coming to save us.
            </p>
            <p style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.85rem', margin: '1.25rem 0 0', fontFamily: 'sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Hold them accountable.
            </p>
          </div>

          {/* Bottom — Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button style={btnStyle(true)} onClick={() => navigate('/login')}>
              Sign in
            </button>
            <button style={btnStyle(false)} onClick={() => navigate('/register')}>
              Create account
            </button>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none', border: 'none', color: 'rgba(245,240,232,0.45)',
                fontSize: '0.85rem', fontFamily: 'sans-serif', cursor: 'pointer',
                padding: '0.5rem', marginTop: '0.25rem', letterSpacing: '0.04em'
              }}
            >
              Continue without an account →
            </button>
          </div>

        </div>
      </AuthSlideshow>
    </div>
  )
}