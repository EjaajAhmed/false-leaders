import { Link } from 'react-router-dom'
import AuthSlideshow from '../components/AuthSlideshow'
import Logo from '../components/Logo'
import Stamp from '../components/Stamp'

/** Phone-sized welcome screen: brand, stamp, two doors in. */
export default function MobileAuthLanding() {
  return (
    <div className="auth-welcome">
      <AuthSlideshow style={{ height: '100%' }}>
        <div className="auth-brand">
          <Link to="/" className="auth-brand__mark">
            <Logo size={40} />
            <span className="auth-brand__name">FalseLeaders</span>
          </Link>
          <div>
            <div className="hero__rule" />
            <p className="auth-brand__stamp"><Stamp /></p>
            <p className="eyebrow" style={{ marginTop: '1.25rem' }}>Rate, investigate and judge the people in power.</p>
          </div>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <Link to="/login" className="btn btn--gold btn--block">Sign in</Link>
            <Link to="/register" className="btn btn--block">Create account</Link>
            <Link to="/" className="eyebrow" style={{ textAlign: 'center', paddingTop: '0.5rem' }}>Continue as guest →</Link>
          </div>
        </div>
      </AuthSlideshow>
    </div>
  )
}
