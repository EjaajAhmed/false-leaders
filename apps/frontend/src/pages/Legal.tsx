import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getLegalInfo, submitTakedown } from '../api/legal'
import { errorMessage } from '../api/client'
import Dropdown from '../components/Dropdown'

/*
 * DRAFT PLACEHOLDER TEXT. These pages deliberately use plain, hedged language and
 * contain bracketed fill-ins. They must be replaced by reviewed text before they are
 * relied on. Nothing here cites a statute or asserts compliance with one.
 */

function DraftBanner() {
  return (
    <div className="draft-banner" role="note">
      <span className="eyebrow">Draft · not yet reviewed by counsel</span>
      <span className="small">This is placeholder wording so the page exists and can be linked to. It is not final and should not be read as a binding statement until it is replaced.</span>
    </div>
  )
}

function LegalNav() {
  const { pathname } = useLocation()
  const items = [['/terms', 'Terms of Service'], ['/acceptable-use', 'Acceptable Use'], ['/takedown', 'Takedown requests'], ['/contact', 'Contact']]
  return (
    <div className="tabs" style={{ marginBottom: '1.25rem' }}>
      {items.map(([to, label]) => <Link key={to} to={to} className={`tab${pathname === to ? ' is-active' : ''}`}>{label}</Link>)}
    </div>
  )
}

function useInfo() { return useQuery({ queryKey: ['legal-info'], queryFn: getLegalInfo, staleTime: 10 * 60 * 1000 }) }

export function Terms() {
  const info = useInfo()
  return (
    <div className="page page--narrow legal">
      <div className="page-head"><p className="eyebrow">Legal · version {info.data?.terms_version || '…'}</p><h1>Terms of Service</h1><p>What you agree to when you register and use FalseLeaders.</p></div>
      <LegalNav /><DraftBanner />
      <h2>1. Who runs this site</h2>
      <p>FalseLeaders is operated by [operator name and legal form], based in [jurisdiction]. Questions about these terms go to [contact address].</p>
      <h2>2. What the site is</h2>
      <p>FalseLeaders publishes information about public figures drawn from named public sources, and hosts a forum where members post their own opinions. The community rating is an average of member votes. None of it is a finding of fact about anyone.</p>
      <h2>3. Your account</h2>
      <p>You need to be at least [minimum age] to register. You are responsible for what is posted from your account. Your Prole number is a permanent pseudonym for anonymous posts; we hold the link between it and your account and will disclose it only where [placeholder: describe the conditions, such as a lawful request].</p>
      <h2>4. Your content</h2>
      <p>You keep ownership of what you post. By posting, you allow us to display, store and moderate it as part of running the site. You are responsible for making sure you have the right to post it and that it follows the <Link to="/acceptable-use">Acceptable Use Policy</Link>.</p>
      <h2>5. Opinions, not facts</h2>
      <p>Forum posts, ratings and anything else contributed by members are the views of those members. FalseLeaders does not endorse them, does not verify them and does not present them as statements of fact. Sourced data on leader pages is attributed to its source and may contain errors from that source.</p>
      <h2>6. Moderation and removal</h2>
      <p>We may hide, lock, move or remove content, and suspend accounts, when we believe the Acceptable Use Policy or these terms have been broken, or when we receive a valid notice. Removed content is hidden rather than erased unless a legal removal requires otherwise. Moderation actions are logged. To ask for content to be removed, use the <Link to="/takedown">takedown page</Link>.</p>
      <h2>7. No warranty and limits on liability</h2>
      <p>[Placeholder: plain statement that the service is provided as-is, and the limits on liability that apply in the operator's jurisdiction. To be drafted by counsel.]</p>
      <h2>8. Changes</h2>
      <p>When these terms change in a way that matters, members will be asked to accept the new version before posting again. The version in force is shown at the top of this page.</p>
      <h2>9. Governing law</h2>
      <p>[Placeholder: governing law and venue, to be set by counsel.]</p>
    </div>
  )
}

export function AcceptableUse() {
  return (
    <div className="page page--narrow legal">
      <div className="page-head"><p className="eyebrow">Legal</p><h1>Acceptable Use Policy</h1><p>What you can and cannot post on the forum.</p></div>
      <LegalNav /><DraftBanner />
      <h2>Do</h2>
      <ul>
        <li>Post your own opinion about people who hold or seek public power, and say why.</li>
        <li>Link to sources when you make a claim about what someone did or said.</li>
        <li>Report posts that break this policy instead of replying to them.</li>
      </ul>
      <h2>Do not</h2>
      <ul>
        <li>Post private information about private individuals: home addresses, phone numbers, family members, financial details, or anything that identifies someone who is not a public figure.</li>
        <li>Threaten, harass or incite violence against anyone, public figure or not.</li>
        <li>Present invented claims as fact. Say what you think; do not fabricate what happened.</li>
        <li>Post content you do not have the right to share, including copied articles or leaked personal data.</li>
        <li>Spam, advertise, or use multiple accounts to vote or bump threads.</li>
        <li>Impersonate FalseLeaders, its staff, or any real person.</li>
      </ul>
      <h2>What happens if you do</h2>
      <p>Content may be hidden, threads locked or moved, and accounts suspended. Serious or repeated cases may be [placeholder: describe escalation, such as permanent suspension or referral]. Every moderation action is recorded with who took it and when.</p>
      <h2>Reporting</h2>
      <p>Every thread and reply has a report button for members. Anyone, member or not, can file a <Link to="/takedown">takedown request</Link>.</p>
    </div>
  )
}

const TAKEDOWN_REASONS = [
  { value: 'defamation', label: 'It makes a false statement about me or my client' },
  { value: 'private_info', label: 'It exposes private information' },
  { value: 'copyright', label: 'It copies my work without permission' },
  { value: 'harassment', label: 'It threatens or harasses' },
  { value: 'illegal', label: 'It is illegal in my jurisdiction' },
  { value: 'other', label: 'Something else' },
]

export function Takedown() {
  const info = useInfo()
  const [form, setForm] = useState({ name: '', email: '', url: '', reason: '', detail: '' })
  const [error, setError] = useState('')
  const send = useMutation({ mutationFn: submitTakedown, onError: e => setError(errorMessage(e)) })
  const ready = form.name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email) && /^https?:\/\//.test(form.url) && form.reason
  return (
    <div className="page page--narrow legal">
      <div className="page-head"><p className="eyebrow">Legal · notice and takedown</p><h1>Ask for content to be removed</h1><p>For anyone, member or not. Tell us what the content is, where it is, and why it should come down.</p></div>
      <LegalNav /><DraftBanner />
      <p>We aim to acknowledge every request within <strong>{info.data?.takedown_response_days ?? '[N]'} days</strong> and to tell you what we decided. [Placeholder: this window is provisional until counsel confirms it.] You can also email <a href={`mailto:${info.data?.abuse_email || ''}`} className="auth-link">{info.data?.abuse_email || '…'}</a> directly; requests filed here are logged and sent to the same address.</p>
      {send.data ? (
        <div className="card card--elevated stack" style={{ marginTop: '1.25rem' }}>
          <span className="eyebrow eyebrow--gold">Received</span>
          <p>Your request is logged as <span className="mono">{send.data.id.slice(0, 8)}</span>. We will reply to {form.email} within {send.data.response_days} days.</p>
        </div>
      ) : (
        <div className="card card--elevated stack" style={{ marginTop: '1.25rem' }}>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            <div className="field"><label className="label" htmlFor="td-name">Your name</label><input id="td-name" className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="td-email">Your email</label><input id="td-email" className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="field"><label className="label" htmlFor="td-url">Address of the content</label><input id="td-url" className="input" placeholder="https://falseleaders.com/forum/…" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /><span className="help">Paste the link to the thread, reply or page. One request per item.</span></div>
          <div className="field"><label className="label">Why it should be removed</label><Dropdown className="dd--block" placeholder="Reason" value={form.reason} onChange={v => setForm({ ...form, reason: v })} options={TAKEDOWN_REASONS} /></div>
          <div className="field"><label className="label" htmlFor="td-detail">Details</label><textarea id="td-detail" className="textarea" rows={5} value={form.detail} onChange={e => setForm({ ...form, detail: e.target.value })} maxLength={4000} placeholder="What exactly is wrong, and who you are in relation to it. If you are acting for someone else, say so." /></div>
          {error && <div className="error">{error}</div>}
          <div><button className="btn btn--gold" disabled={!ready || send.isPending} onClick={() => { setError(''); send.mutate({ ...form, detail: form.detail.trim() || undefined }) }}>{send.isPending ? 'Sending' : 'Send request'}</button></div>
          <p className="help">By sending this you confirm the information is accurate to the best of your knowledge. [Placeholder: any declaration counsel wants here.]</p>
        </div>
      )}
    </div>
  )
}

export function Contact() {
  const info = useInfo()
  return (
    <div className="page page--narrow legal">
      <div className="page-head"><p className="eyebrow">Legal</p><h1>Contact</h1><p>Who to write to, and for what.</p></div>
      <LegalNav /><DraftBanner />
      <h2>Abuse, safety and removal</h2>
      <p><a href={`mailto:${info.data?.abuse_email || ''}`} className="auth-link">{info.data?.abuse_email || '…'}</a>. Read by a person. Use the <Link to="/takedown">takedown form</Link> if you want the request logged with a reference.</p>
      <h2>Corrections to leader data</h2>
      <p>Every figure on a leader page has a source shown in its Sources drawer. If the source is wrong, tell the source; if we misread it, email the address above with the page link and what should change.</p>
      <h2>Press and everything else</h2>
      <p>[Placeholder: general contact address and postal address if required in the operator's jurisdiction.]</p>
    </div>
  )
}
