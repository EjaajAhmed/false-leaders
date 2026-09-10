import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'
import AuthShell, { PasswordField } from '../components/AuthShell'

export default function Register() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await register({ email, username, password })
      if (data.pending) navigate('/pending-verification', { state: { email } })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="New file" title="Register." lead={<>Already a member? <Link to="/login" className="auth-link">Sign in</Link>.</>}>
      <form onSubmit={handleSubmit} className="stack" style={{ gap: '1rem' }}>
        <div className="field">
          <label className="label" htmlFor="auth-email">Email</label>
          <input id="auth-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <span className="help">Used to verify the account. Never shown.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="auth-username">Username</label>
          <input id="auth-username" className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" placeholder="How others see you when you sign a post" />
        </div>
        <PasswordField value={password} onChange={setPassword} help="At least 8 characters." autoComplete="new-password" />
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn btn--gold btn--block" disabled={loading}>{loading ? 'Creating' : 'Create account'}</button>
        <p className="help">You will get a verification email. Until you confirm it you can read, but not rate or post.</p>
      </form>
    </AuthShell>
  )
}
