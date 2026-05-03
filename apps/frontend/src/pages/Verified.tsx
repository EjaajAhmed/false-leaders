import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Verified() {
  const [searchParams] = useSearchParams()
  const { loginUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    const username = searchParams.get('username')
    const err = searchParams.get('error')

    if (err) {
      setError(true)
      return
    }

    if (token && username) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      loginUser({
        id: payload.id,
        username: payload.username,
        email: '',
        is_admin: payload.is_admin,
        email_verified: true
      }, token)
      setTimeout(() => navigate('/'), 2000)
    }
  }, [])

  if (error) return (
    <div style={{ maxWidth: '500px', margin: '6rem auto', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', marginBottom: '1rem' }}>Link Expired</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>This verification link has expired or is invalid.</p>
      <Link to="/login" style={{ padding: '0.7rem 1.5rem', background: '#1a1a1a', color: 'white', borderRadius: '8px', textDecoration: 'none' }}>
        Back to login
      </Link>
    </div>
  )

  return (
    <div style={{ maxWidth: '500px', margin: '6rem auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', marginBottom: '1rem' }}>Verified!</h1>
      <p style={{ color: '#888' }}>Your account is active. Taking you home...</p>
    </div>
  )
}