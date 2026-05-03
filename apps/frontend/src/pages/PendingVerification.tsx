import { Link } from 'react-router-dom'

export default function PendingVerification({ email }: { email?: string }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <div style={{
        flex: 1, background: '#111',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '3rem',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(201,168,76,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
          <div style={{ width: '32px', height: '32px', background: '#c9a84c', transform: 'rotate(45deg)', flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-45deg)', fontSize: '1rem', color: '#111', fontWeight: 700 }}>F</div>
          </div>
          <span style={{ color: '#c9a84c', fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FalseLeaders</span>
        </Link>
        <div style={{ zIndex: 1 }}>
          <div style={{ width: '40px', height: '2px', background: '#c9a84c', marginBottom: '1.5rem' }} />
          <p style={{ fontSize: '2.2rem', color: '#f5f0e8', lineHeight: 1.3, margin: '0 0 1rem', fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 900 }}>
            No one is coming to save us.
          </p>
        </div>
        <p style={{ color: '#555', fontSize: '0.8rem', margin: 0, zIndex: 1 }}>Hold them accountable.</p>
      </div>

      <div style={{ width: '480px', minWidth: '480px', background: '#0d0d0d', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <Link to="/" style={{ color: '#555', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'sans-serif' }}>
            Continue as guest
          </Link>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📬</div>
          <h1 style={{ color: '#f5f0e8', fontSize: '1.8rem', margin: '0 0 1rem', fontWeight: 400 }}>
            Check your email
          </h1>
          <p style={{ color: '#888', marginBottom: '0.5rem', fontFamily: 'sans-serif', fontSize: '0.95rem' }}>
            We sent a verification link to
          </p>
          {email && (
            <p style={{ color: '#c9a84c', marginBottom: '1.5rem', fontFamily: 'sans-serif', fontSize: '0.95rem', fontWeight: 500 }}>
              {email}
            </p>
          )}
          <p style={{ color: '#555', marginBottom: '2rem', fontFamily: 'sans-serif', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Click the link in your email to verify your account and get started. The link expires in 24 hours.
          </p>

          <p style={{ color: '#444', fontSize: '0.8rem', fontFamily: 'sans-serif' }}>
            Didn't get it?{' '}
            <button
              onClick={() => {
                // resend logic here if needed
              }}
              style={{ background: 'none', border: 'none', color: '#c9a84c', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
            >
              Resend email
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}