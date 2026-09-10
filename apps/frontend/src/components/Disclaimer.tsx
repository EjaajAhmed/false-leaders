import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Short statement that forum posts are member opinion, not statements of fact by the site. */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`disclaimer${compact ? ' disclaimer--compact' : ''}`}>
      Posts on this forum are the opinions of the members who wrote them. They are not statements of fact by FalseLeaders, and they are not verified. Something wrong or unlawful? <Link to="/takedown">Report it</Link> or use the report button on any thread or reply.
    </p>
  )
}

/** Shown above the composer until the member has posted once (remembered per account in this browser). */
export function FirstPostNotice() {
  const { user } = useAuth()
  const key = user ? `fl_first_post_ack:${user.id}` : ''
  const [seen, setSeen] = useState(true)
  useEffect(() => { if (!key) return; try { setSeen(localStorage.getItem(key) === '1') } catch { setSeen(true) } }, [key])
  if (!user || seen) return null
  const ack = () => { try { localStorage.setItem(key, '1') } catch { /* ignore */ } setSeen(true) }
  return (
    <div className="notice notice--plain stack" style={{ gap: '0.5rem' }}>
      <span className="eyebrow">Before your first post</span>
      <span className="small">What you post here is your own opinion and stays attributed to you (by username or Prole number). FalseLeaders does not verify it and does not adopt it as fact. Don't post private information about private individuals, and read the <Link to="/acceptable-use" className="auth-link">Acceptable Use Policy</Link> once.</span>
      <div><button className="btn btn--sm" onClick={ack}>Understood</button></div>
    </div>
  )
}
