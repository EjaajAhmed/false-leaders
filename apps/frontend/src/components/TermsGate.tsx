import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { acceptTerms } from '../api/auth'
import { errorMessage } from '../api/client'

/**
 * Members who registered before the current terms version must accept it before posting.
 * Renders nothing when the member is already on the current version.
 */
export default function TermsGate() {
  const { user, token, loginUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!user || user.terms_accepted) return null
  const accept = async () => {
    setBusy(true); setError('')
    try { await acceptTerms(); loginUser({ ...user, terms_accepted: true }, token!) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <div className="notice stack" style={{ gap: '0.6rem' }}>
      <span>Before you post, please read and accept the <Link to="/terms" className="auth-link">Terms of Service</Link> and <Link to="/acceptable-use" className="auth-link">Acceptable Use Policy</Link>. Both are marked as drafts while they are under review.</span>
      {error && <div className="error">{error}</div>}
      <div><button className="btn btn--gold btn--sm" onClick={accept} disabled={busy}>{busy ? 'Saving' : 'I accept'}</button></div>
    </div>
  )
}
