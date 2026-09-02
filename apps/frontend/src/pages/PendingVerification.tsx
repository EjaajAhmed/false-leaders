import { Link } from 'react-router-dom'

export default function PendingVerification({ email }: { email?: string }) {
  return (
    <div className="noise" style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div className="hero__rule" style={{ margin: '0 auto 1.5rem' }} />
        <p className="eyebrow eyebrow--gold">One more step</p>
        <h1 style={{ fontSize: '2.6rem', margin: '0.5rem 0 1rem' }}>Check your email.</h1>
        <p className="muted">A verification link was sent to</p>
        {email && <p className="mono" style={{ color: 'var(--gold)', margin: '0.5rem 0 1rem' }}>{email}</p>}
        <p className="help" style={{ marginBottom: '2rem' }}>It expires in 24 hours. Until then you can read, but not post.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn">Continue as guest</Link>
          <Link to="/login" className="btn btn--ghost">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
