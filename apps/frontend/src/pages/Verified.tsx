import { Link } from 'react-router-dom'

export default function Verified() {
  return (
    <div style={{ maxWidth: '500px', margin: '6rem auto', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', marginBottom: '1rem' }}>
        Email Verified
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        Your account is now fully activated. You can comment, vote and save politicians.
      </p>
      <Link to="/" style={{ padding: '0.7rem 1.5rem', background: '#1a1a1a', color: 'white', borderRadius: '8px', textDecoration: 'none' }}>
        Go to FalseLeaders
      </Link>
    </div>
  )
}