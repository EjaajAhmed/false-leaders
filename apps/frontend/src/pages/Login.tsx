import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import AuthShell, { PasswordField } from '../components/AuthShell'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login({ email, password })
      loginUser(data.user, data.token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="Clearance" title="Sign in." lead={<>No account yet? <Link to="/register" className="auth-link">Register</Link>.</>}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: '1rem' }}>
        <div className="field">
          <label className="label" htmlFor="auth-email">Email</label>
          <input id="auth-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn--gold btn--block" disabled={loading}>{loading ? 'Signing in' : 'Sign in'}</button>
      </form>
    </AuthShell>
  )
}
