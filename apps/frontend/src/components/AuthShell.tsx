import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthSlideshow from './AuthSlideshow'
import Logo from './Logo'
import Stamp from './Stamp'

/** Two-panel frame shared by Sign in and Register: brand panel on the left, form on the right. */
export default function AuthShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="auth-page">
      <aside className="auth-left">
        <AuthSlideshow style={{ height: '100vh', position: 'sticky', top: 0 }}>
          <div className="auth-brand">
            <Link to="/" className="auth-brand__mark">
              <Logo size={40} />
              <span className="auth-brand__name">FalseLeaders</span>
            </Link>
            <div>
              <div className="hero__rule" />
              <p className="auth-brand__stamp"><Stamp /></p>
            </div>
            <p className="eyebrow">Rate, investigate and judge the people in power.</p>
          </div>
        </AuthSlideshow>
      </aside>

      <main className="auth-right">
        <div className="auth-form">
          <div className="auth-form__top">
            <button type="button" className="auth-back btn btn--ghost btn--sm" onClick={() => navigate('/welcome')} aria-label="Back">← Back</button>
            <Link to="/" className="eyebrow">Continue as guest →</Link>
          </div>
          <div className="auth-form__body">
            <p className="eyebrow eyebrow--gold">{eyebrow}</p>
            <h1 className="auth-title">{title}</h1>
            <p className="muted small auth-lead">{lead}</p>
            {children}
          </div>
          <p className="help auth-form__foot">Two identities, one account: your username for what you sign, a permanent Prole number for what you post anonymously.</p>
        </div>
      </main>
    </div>
  )
}

export function PasswordField({ value, onChange, label = 'Password', help, autoComplete }: { value: string; onChange: (v: string) => void; label?: string; help?: string; autoComplete?: string }) {
  return (
    <div className="field">
      <div className="row row--between"><label className="label" htmlFor="auth-password">{label}</label><PasswordToggle /></div>
      <input id="auth-password" className="input" type="password" value={value} onChange={e => onChange(e.target.value)} required autoComplete={autoComplete} />
      {help && <span className="help">{help}</span>}
    </div>
  )
}

function PasswordToggle() {
  return (
    <button type="button" className="mono tiny muted" style={{ background: 'none', border: 0, cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}
      onClick={e => { const el = document.getElementById('auth-password') as HTMLInputElement | null; if (!el) return; const show = el.type === 'password'; el.type = show ? 'text' : 'password'; (e.currentTarget as HTMLButtonElement).textContent = show ? 'Hide' : 'Show' }}>
      Show
    </button>
  )
}
