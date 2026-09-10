import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPoliticians, listApprovalPolls, addApprovalPoll, deleteApprovalPoll, getProposalQueue, reviewProposal, getSpikeQueue, reviewSpike, addDocument, scanContradictions, getPromiseQueue, reviewPromise, getContradictionQueue, reviewContradiction } from '../api/politicians'
import client, { errorMessage } from '../api/client'
import { getReports, updateReport, getTakedowns, updateTakedown, getModerationLog } from '../api/legal'
import Dropdown from '../components/Dropdown'
import AIAnalyzer from '../components/AIAnalyzer'
import LevelBadge from '../components/LevelBadge'
import { Empty, Loading } from '../components/States'
import { CATEGORIES, LEVELS, timeAgo } from '../lib/format'
import type { Level } from '../types'
import { ARCHIVED } from '../config'

const emptyForm = {
  name: '', party: '', region: '', position: '', bio: '', country: '', category: 'politician',
  age: '', latitude: '', longitude: '', photo_url: '', aliases: '', prominence: '',
}

function ModerationDesk() {
  const qc = useQueryClient()
  const [reportStatus, setReportStatus] = useState('open')
  const reports = useQuery({ queryKey: ['reports', reportStatus], queryFn: () => getReports(reportStatus) })
  const takedowns = useQuery({ queryKey: ['takedowns'], queryFn: () => getTakedowns('all') })
  const log = useQuery({ queryKey: ['moderation-log'], queryFn: () => getModerationLog(100) })
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['reports'] }); qc.invalidateQueries({ queryKey: ['takedowns'] }); qc.invalidateQueries({ queryKey: ['moderation-log'] }); qc.invalidateQueries({ queryKey: ['threads'] }) }
  const report = useMutation({ mutationFn: updateReport, onSuccess: invalidate, onError: e => alert(errorMessage(e)) })
  const takedown = useMutation({ mutationFn: updateTakedown, onSuccess: invalidate, onError: e => alert(errorMessage(e)) })
  const removeTarget = useMutation({
    mutationFn: async (r: any) => r.target_type === 'thread' ? client.delete(`/forum/threads/${r.target_id}`, { data: { reason: `report ${r.id.slice(0, 8)}: ${r.reason}` } }) : client.delete(`/forum/posts/${r.target_id}`, { data: { reason: `report ${r.id.slice(0, 8)}: ${r.reason}` } }),
    onSuccess: invalidate, onError: e => alert(errorMessage(e)),
  })
  const TD_STATUS = [{ value: 'received', label: 'Received' }, { value: 'in_review', label: 'In review' }, { value: 'actioned', label: 'Actioned' }, { value: 'declined', label: 'Declined' }]
  return (
    <div className="card" id="moderation">
      <div className="section-title"><h2>Moderation</h2><span className="mono tiny dim">{reports.data?.length || 0} reports · {takedowns.data?.filter((t: any) => t.status === 'received').length || 0} new takedowns</span></div>
      <p className="help" style={{ marginBottom: '1rem' }}>Reports come from members; takedown requests from anyone. Every action here, and every lock, pin, move or removal anywhere, lands in the log below. Removal is a soft delete. The only hard delete is the documented script for legal removal, and it logs the full content first.</p>

      <div className="row row--between" style={{ marginBottom: '0.5rem' }}><h3 style={{ fontSize: '1.05rem' }}>Reports</h3><Dropdown placeholder="Status" value={reportStatus} onChange={setReportStatus} align="right" options={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'all', label: 'All' }]} /></div>
      {reports.isLoading && <Loading />}
      {!reports.isLoading && reports.data?.length === 0 && <Empty text="No reports." />}
      <div className="stack">
        {reports.data?.map((r: any) => (
          <div key={r.id} className="post">
            <div className="post__head">
              <div className="post__who"><span className="badge badge--outline">{r.target_type}</span><span className="badge badge--gold">{r.reason}</span><span className="post__time">{timeAgo(r.created_at)} · by @{r.reporter}{r.target_status === 'removed' ? ' · target removed' : ''}</span></div>
              <Link to={`/forum/${r.thread_id}`} className="mono tiny muted">Open →</Link>
            </div>
            <p className="post__body small">{r.target_text || '[content no longer available]'}</p>
            {r.detail && <p className="help" style={{ marginTop: '0.4rem' }}>Reporter: {r.detail}</p>}
            {r.status === 'open' && (
              <div className="post__foot">
                {r.target_status !== 'removed' && <button className="btn btn--sm btn--danger" onClick={() => { if (confirm('Hide this content and resolve the report?')) { removeTarget.mutate(r); report.mutate({ id: r.id, status: 'resolved', note: 'content removed' }) } }}>Remove content</button>}
                <button className="btn btn--sm" onClick={() => report.mutate({ id: r.id, status: 'resolved', note: 'resolved without removal' })}>Resolve</button>
                <button className="btn btn--ghost btn--sm" onClick={() => report.mutate({ id: r.id, status: 'dismissed' })}>Dismiss</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: '1.5rem' }}><h3 style={{ fontSize: '1.05rem' }}>Takedown requests</h3></div>
      {takedowns.isLoading && <Loading />}
      {!takedowns.isLoading && takedowns.data?.length === 0 && <Empty text="No takedown requests." />}
      <div className="stack">
        {takedowns.data?.map((t: any) => (
          <div key={t.id} className="post">
            <div className="post__head">
              <div className="post__who"><span className="mono tiny dim">{t.id.slice(0, 8)}</span><span className="badge badge--gold">{t.reason}</span><span className="post__time">{timeAgo(t.created_at)} · {t.name} · {t.email}</span></div>
              <Dropdown placeholder="Status" value={t.status} onChange={v => takedown.mutate({ id: t.id, status: v })} align="right" options={TD_STATUS} />
            </div>
            <p className="small"><a href={t.url} target="_blank" rel="noopener noreferrer" className="auth-link">{t.url}</a></p>
            {t.detail && <p className="post__body small" style={{ marginTop: '0.4rem' }}>{t.detail}</p>}
            <input className="input" style={{ marginTop: '0.5rem' }} placeholder="Internal note (saved on blur)" defaultValue={t.notes || ''} onBlur={e => { if (e.target.value !== (t.notes || '')) takedown.mutate({ id: t.id, notes: e.target.value }) }} />
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: '1.5rem' }}><h3 style={{ fontSize: '1.05rem' }}>Moderation log</h3><span className="mono tiny dim">last 100</span></div>
      {log.isLoading && <Loading />}
      <div className="stack" style={{ gap: '0.25rem', maxHeight: 420, overflowY: 'auto' }}>
        {log.data?.map((m: any) => (
          <div key={m.id} className="row row--between mono tiny" style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', gap: '0.75rem' }}>
            <span className="truncate"><span style={{ color: 'var(--text)' }}>{m.action}</span> · {m.target_type}{m.target_id ? ` ${String(m.target_id).slice(0, 8)}` : ''}{m.reason ? ` · ${m.reason}` : ''}</span>
            <span className="dim" style={{ flexShrink: 0 }}>{m.actor ? `@${m.actor}` : 'system'} · {timeAgo(m.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpikeQueue() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['spike-queue'], queryFn: () => getSpikeQueue('draft') })
  const [edits, setEdits] = useState<Record<string, string>>({})
  const mutate = useMutation({ mutationFn: reviewSpike, onSuccess: () => qc.invalidateQueries({ queryKey: ['spike-queue'] }), onError: e => alert(errorMessage(e)) })
  return (
    <div className="card" id="spikes">
      <div className="section-title"><h2>Coverage spike captions</h2><span className="mono tiny dim">{data?.length || 0} drafts</span></div>
      <p className="help" style={{ marginBottom: '1rem' }}>Drafted by the analyser from that day's headlines. Nothing publishes without a person approving it. Edit the text if it overstates anything.</p>
      {isLoading && <Loading />}
      {!isLoading && data?.length === 0 && <Empty text="No drafts waiting." />}
      <div className="stack">
        {data?.map((sp: any) => (
          <div key={sp.id} className="post">
            <div className="post__head">
              <div className="post__who">
                <Link to={`/leaders/${sp.leader_id}?tab=media`} className="post__name">{sp.leader_name}</Link>
                <span className="post__time">{sp.day} · {sp.articles} articles · {sp.ratio}×</span>
              </div>
              <a href={sp.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny muted">GDELT</a>
            </div>
            <textarea className="textarea" rows={2} style={{ marginTop: '0.6rem' }} value={edits[sp.id] ?? sp.summary ?? ''} onChange={e => setEdits({ ...edits, [sp.id]: e.target.value })} maxLength={300} />
            <div className="stack" style={{ gap: '0.25rem', marginTop: '0.5rem' }}>
              {(sp.headlines || []).slice(0, 4).map((h: any, i: number) => <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="tiny muted">{h.title} · {h.source}</a>)}
            </div>
            <div className="post__foot">
              <button className="btn btn--gold btn--sm" disabled={mutate.isPending} onClick={() => mutate.mutate({ id: sp.id, status: 'published', summary: edits[sp.id] ?? sp.summary })}>Publish</button>
              <button className="btn btn--ghost btn--sm btn--danger" disabled={mutate.isPending} onClick={() => mutate.mutate({ id: sp.id, status: 'dismissed' })}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApprovalDesk({ leaders }: { leaders: any[] }) {
  const qc = useQueryClient()
  const blank = { leader: '', politician_id: '', pollster: '', approve: '', disapprove: '', sample_size: '', fieldwork_end: '', source_url: '', note: '' }
  const [form, setForm] = useState(blank)
  const [msg, setMsg] = useState('')
  const polls = useQuery({ queryKey: ['approval-polls'], queryFn: listApprovalPolls })
  const add = useMutation({
    mutationFn: addApprovalPoll,
    onSuccess: (p) => { setMsg(`Saved: ${p.pollster}, ${p.approve}% approve.`); qc.invalidateQueries({ queryKey: ['approval-polls'] }); qc.invalidateQueries({ queryKey: ['approval', p.politician_id] }); setForm(f => ({ ...blank, leader: f.leader, politician_id: f.politician_id, pollster: f.pollster })) },
    onError: e => setMsg(errorMessage(e)),
  })
  const del = useMutation({ mutationFn: deleteApprovalPoll, onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-polls'] }) })
  const pick = (name: string) => { const l = leaders.find(x => x.name === name); setForm(f => ({ ...f, leader: name, politician_id: l?.id || '' })) }
  const ready = form.politician_id && form.pollster.trim() && form.approve !== '' && /^\d{4}-\d{2}-\d{2}$/.test(form.fieldwork_end) && /^https?:\/\//.test(form.source_url)
  return (
    <div className="card" id="approval">
      <div className="section-title"><h2>Approval polling</h2><span className="mono tiny dim">{polls.data?.length || 0} on file</span></div>
      <p className="help" style={{ marginBottom: '1rem' }}>External approval numbers, shown on the leader page as a separate labelled stat with this source. They never feed the community rating. Enter the poll as published; the latest fieldwork date is what displays.</p>
      <div className="grid-2" style={{ gap: '0.5rem' }}>
        <div className="field"><label className="label">Leader</label><input className="input" list="approval-leader-names" value={form.leader} onChange={e => pick(e.target.value)} placeholder="Start typing a name" /><datalist id="approval-leader-names">{leaders.slice(0, 2000).map(l => <option key={l.id} value={l.name} />)}</datalist></div>
        <div className="field"><label className="label">Pollster</label><input className="input" value={form.pollster} onChange={e => setForm({ ...form, pollster: e.target.value })} placeholder="Gallup, YouGov, Angus Reid…" /></div>
        <div className="field"><label className="label">Approve %</label><input className="input mono" type="number" min={0} max={100} step={0.1} value={form.approve} onChange={e => setForm({ ...form, approve: e.target.value })} /></div>
        <div className="field"><label className="label">Disapprove % (optional)</label><input className="input mono" type="number" min={0} max={100} step={0.1} value={form.disapprove} onChange={e => setForm({ ...form, disapprove: e.target.value })} /></div>
        <div className="field"><label className="label">Fieldwork end</label><input className="input mono" type="date" value={form.fieldwork_end} onChange={e => setForm({ ...form, fieldwork_end: e.target.value })} /></div>
        <div className="field"><label className="label">Sample size (optional)</label><input className="input mono" type="number" min={1} value={form.sample_size} onChange={e => setForm({ ...form, sample_size: e.target.value })} /></div>
      </div>
      <div className="field" style={{ marginTop: '0.5rem' }}><label className="label">Source URL</label><input className="input" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://…" /></div>
      <div className="field" style={{ marginTop: '0.5rem' }}><label className="label">Note (optional)</label><input className="input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={500} placeholder="Question wording, population, caveats" /></div>
      <div className="row row--wrap" style={{ marginTop: '0.9rem' }}>
        <button className="btn btn--gold" disabled={!ready || add.isPending} onClick={() => add.mutate({ politician_id: form.politician_id, pollster: form.pollster.trim(), approve: Number(form.approve), disapprove: form.disapprove === '' ? null : Number(form.disapprove), sample_size: form.sample_size === '' ? null : Number(form.sample_size), fieldwork_end: form.fieldwork_end, source_url: form.source_url.trim(), note: form.note.trim() || undefined })}>{add.isPending ? 'Saving' : 'Save poll'}</button>
        {msg && <span className="mono tiny" style={{ color: 'var(--gold)' }}>{msg}</span>}
      </div>
      {polls.data && polls.data.length > 0 && (
        <div className="stack" style={{ gap: '0.4rem', marginTop: '1.25rem', maxHeight: 360, overflowY: 'auto' }}>
          {polls.data.map((p: any) => (
            <div key={p.id} className="row row--between" style={{ padding: '0.5rem 0.7rem', border: '1px solid var(--border)', background: 'var(--surface)', gap: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <p className="small truncate" style={{ fontWeight: 500 }}><Link to={`/leaders/${p.politician_id}`}>{p.leader_name}</Link> <span className="mono">{Math.round(Number(p.approve))}%</span>{p.disapprove != null && <span className="mono dim"> / {Math.round(Number(p.disapprove))}%</span>}</p>
                <p className="tiny muted truncate">{p.pollster} · {p.fieldwork_end?.slice(0, 10)}{p.sample_size ? ` · n=${p.sample_size}` : ''} · <a href={p.source_url} target="_blank" rel="noopener noreferrer">source</a></p>
              </div>
              <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm('Remove this poll?')) del.mutate(p.id) }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PromiseDesk({ leaders }: { leaders: any[] }) {
  const qc = useQueryClient()
  const [doc, setDoc] = useState({ leader: '', politician_id: '', title: '', url: '', text: '', kind: 'speech', spoken_on: '' })
  const [msg, setMsg] = useState('')
  const [edits, setEdits] = useState<Record<string, any>>({})
  const promises = useQuery({ queryKey: ['promise-queue'], queryFn: () => getPromiseQueue('draft') })
  const contradictions = useQuery({ queryKey: ['contradiction-queue'], queryFn: () => getContradictionQueue('draft') })
  const add = useMutation({
    mutationFn: addDocument,
    onSuccess: (r) => { setMsg(`Document saved. ${r.promises} promise draft${r.promises === 1 ? '' : 's'}, ${r.claims} claims extracted.`); qc.invalidateQueries({ queryKey: ['promise-queue'] }); setDoc(d => ({ ...d, title: '', url: '', text: '' })) },
    onError: e => setMsg(errorMessage(e)),
  })
  const scan = useMutation({ mutationFn: scanContradictions, onSuccess: (r) => { setMsg(`Scan complete: ${r.found} contradiction draft${r.found === 1 ? '' : 's'} across ${r.documents} documents.`); qc.invalidateQueries({ queryKey: ['contradiction-queue'] }) }, onError: e => setMsg(errorMessage(e)) })
  const reviewP = useMutation({ mutationFn: reviewPromise, onSuccess: () => qc.invalidateQueries({ queryKey: ['promise-queue'] }), onError: e => alert(errorMessage(e)) })
  const reviewC = useMutation({ mutationFn: reviewContradiction, onSuccess: () => qc.invalidateQueries({ queryKey: ['contradiction-queue'] }), onError: e => alert(errorMessage(e)) })
  const pick = (name: string) => { const l = leaders.find(x => x.name === name); setDoc(d => ({ ...d, leader: name, politician_id: l?.id || '' })) }
  const ed = (id: string, key: string, fallback: any) => edits[id]?.[key] ?? fallback
  const setEd = (id: string, key: string, value: any) => setEdits(e => ({ ...e, [id]: { ...(e[id] || {}), [key]: value } }))

  return (
    <div className="card" id="promises">
      <div className="section-title"><h2>Promises and contradictions</h2><span className="mono tiny dim">{promises.data?.length || 0} promise drafts · {contradictions.data?.length || 0} contradiction drafts</span></div>
      <p className="help" style={{ marginBottom: '1rem' }}>Add a document in the person's own words (manifesto, speech, interview). The analyser drafts promises with verbatim quotes; you decide what publishes, and a kept or broken verdict needs an evidence link.</p>
      <div className="grid-2" style={{ gap: '0.75rem' }}>
        <div className="field"><label className="label">Leader</label><input className="input" list="leader-names" value={doc.leader} onChange={e => pick(e.target.value)} placeholder="Start typing a name" /><datalist id="leader-names">{leaders.slice(0, 2000).map(l => <option key={l.id} value={l.name} />)}</datalist></div>
        <div className="field"><label className="label">Kind</label><select className="select" value={doc.kind} onChange={e => setDoc({ ...doc, kind: e.target.value })}>{['manifesto', 'speech', 'interview', 'statement', 'article', 'other'].map(k => <option key={k} value={k}>{k}</option>)}</select></div>
        <div className="field"><label className="label">Title</label><input className="input" value={doc.title} onChange={e => setDoc({ ...doc, title: e.target.value })} /></div>
        <div className="field"><label className="label">Date spoken or published</label><input className="input" type="date" value={doc.spoken_on} onChange={e => setDoc({ ...doc, spoken_on: e.target.value })} /></div>
      </div>
      <div className="field" style={{ marginTop: '0.75rem' }}><label className="label">URL (fetched and stripped to text)</label><input className="input" value={doc.url} onChange={e => setDoc({ ...doc, url: e.target.value })} placeholder="https://" /></div>
      <div className="field" style={{ marginTop: '0.75rem' }}><label className="label">Or paste the text</label><textarea className="textarea" rows={4} value={doc.text} onChange={e => setDoc({ ...doc, text: e.target.value })} /></div>
      <div className="row row--wrap" style={{ marginTop: '0.75rem' }}>
        <button className="btn btn--gold" disabled={!doc.politician_id || (!doc.url && doc.text.length < 200) || add.isPending} onClick={() => add.mutate({ politician_id: doc.politician_id, title: doc.title, url: doc.url || undefined, text: doc.text || undefined, kind: doc.kind, spoken_on: doc.spoken_on || undefined })}>{add.isPending ? 'Extracting' : 'Add document and extract'}</button>
        <button className="btn" disabled={!doc.politician_id || scan.isPending} onClick={() => scan.mutate(doc.politician_id)}>{scan.isPending ? 'Scanning' : 'Scan this leader for contradictions'}</button>
        {msg && <span className="mono tiny" style={{ color: 'var(--text)' }}>{msg}</span>}
      </div>

      <div className="section-title" style={{ marginTop: '1.5rem' }}><h3 style={{ fontSize: '1.05rem' }}>Promise drafts</h3></div>
      {promises.isLoading && <Loading />}
      {!promises.isLoading && promises.data?.length === 0 && <Empty text="No promise drafts." />}
      <div className="stack">
        {promises.data?.map((p: any) => (
          <div key={p.id} className="post">
            <div className="post__head"><div className="post__who"><Link to={`/leaders/${p.politician_id}?tab=promises`} className="post__name">{p.leader_name}</Link><span className="post__time">{p.promised_on || 'undated'}{p.topic ? ` · ${p.topic}` : ''}</span></div><a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mono tiny muted">source</a></div>
            <input className="input" style={{ marginTop: '0.5rem' }} value={ed(p.id, 'text', p.text)} onChange={e => setEd(p.id, 'text', e.target.value)} />
            {p.quote && <p className="small muted" style={{ marginTop: '0.4rem', borderLeft: '2px solid var(--border-strong)', paddingLeft: '0.6rem' }}>"{p.quote}"</p>}
            <div className="grid-3" style={{ gap: '0.5rem', marginTop: '0.6rem' }}>
              <select className="select" value={ed(p.id, 'status', p.status)} onChange={e => setEd(p.id, 'status', e.target.value)}>{['pending', 'kept', 'broken', 'unclear'].map(s => <option key={s} value={s}>{s}</option>)}</select>
              <input className="input" placeholder="Evidence URL (needed for kept/broken)" value={ed(p.id, 'evidence_url', p.evidence_url || '')} onChange={e => setEd(p.id, 'evidence_url', e.target.value)} />
              <input className="input" placeholder="Evidence note" value={ed(p.id, 'evidence_note', p.evidence_note || '')} onChange={e => setEd(p.id, 'evidence_note', e.target.value)} />
            </div>
            <div className="post__foot">
              <button className="btn btn--gold btn--sm" disabled={reviewP.isPending} onClick={() => reviewP.mutate({ id: p.id, review_status: 'published', status: ed(p.id, 'status', p.status), text: ed(p.id, 'text', p.text), evidence_url: ed(p.id, 'evidence_url', p.evidence_url || ''), evidence_note: ed(p.id, 'evidence_note', p.evidence_note || '') })}>Publish</button>
              <button className="btn btn--ghost btn--sm btn--danger" disabled={reviewP.isPending} onClick={() => reviewP.mutate({ id: p.id, review_status: 'rejected' })}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: '1.5rem' }}><h3 style={{ fontSize: '1.05rem' }}>Contradiction drafts</h3></div>
      {contradictions.isLoading && <Loading />}
      {!contradictions.isLoading && contradictions.data?.length === 0 && <Empty text="No contradiction drafts." />}
      <div className="stack">
        {contradictions.data?.map((c: any) => (
          <div key={c.id} className="post">
            <div className="post__head"><div className="post__who"><Link to={`/leaders/${c.politician_id}?tab=contradictions`} className="post__name">{c.leader_name}</Link><span className="post__time">{c.topic || ''}</span></div></div>
            <div className="grid-2" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '0.6rem' }}><p className="small">"{c.quote_a}"</p><p className="mono tiny muted">{c.date_a || 'undated'} · <a href={c.source_a} target="_blank" rel="noopener noreferrer">source</a></p></div>
              <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '0.6rem' }}><p className="small">"{c.quote_b}"</p><p className="mono tiny muted">{c.date_b || 'undated'} · <a href={c.source_b} target="_blank" rel="noopener noreferrer">source</a></p></div>
            </div>
            <textarea className="textarea" rows={2} style={{ marginTop: '0.5rem' }} value={ed(c.id, 'explanation', c.explanation || '')} onChange={e => setEd(c.id, 'explanation', e.target.value)} />
            <div className="post__foot">
              <button className="btn btn--gold btn--sm" disabled={reviewC.isPending} onClick={() => reviewC.mutate({ id: c.id, review_status: 'published', explanation: ed(c.id, 'explanation', c.explanation || '') })}>Publish</button>
              <button className="btn btn--ghost btn--sm btn--danger" disabled={reviewC.isPending} onClick={() => reviewC.mutate({ id: c.id, review_status: 'rejected' })}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProposalQueue() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['proposal-queue'], queryFn: () => getProposalQueue('pending') })
  const [edits, setEdits] = useState<Record<string, { level: Level }>>({})
  const mutate = useMutation({
    mutationFn: reviewProposal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposal-queue'] }),
    onError: e => alert(errorMessage(e)),
  })

  return (
    <div className="card" id="proposals">
      <div className="section-title"><h2>Controversy proposals</h2><span className="mono tiny dim">{data?.length || 0} pending</span></div>
      {isLoading && <Loading />}
      {!isLoading && data?.length === 0 && <Empty text="No proposals pending." />}
      <div className="stack">
        {data?.map((p: any) => {
          const level = edits[p.id]?.level || p.level
          return (
            <div key={p.id} className="post">
              <div className="post__head">
                <div className="post__who">
                  <LevelBadge level={level} />
                  <span className="post__name">{p.title}</span>
                </div>
                <span className="post__time">@{p.username} · {timeAgo(p.created_at)}</span>
              </div>
              <p className="small muted" style={{ marginTop: '0.3rem' }}>
                <Link to={`/leaders/${p.politician_id}?tab=controversies`} style={{ color: 'var(--text)' }}>{p.leader_name}</Link>
                {p.source_url && <> · <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>source</a></>}
              </p>
              <p className="post__body">{p.description}</p>
              <div className="post__foot" style={{ flexWrap: 'wrap' }}>
                <select className="select" style={{ width: 'auto', padding: '0.35rem 2rem 0.35rem 0.6rem', fontSize: '0.75rem' }} value={level} onChange={e => setEdits({ ...edits, [p.id]: { level: e.target.value as Level } })}>
                  {LEVELS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <button className="btn btn--gold btn--sm" disabled={mutate.isPending} onClick={() => mutate.mutate({ id: p.id, action: 'approve', level })}>Approve</button>
                <button className="btn btn--ghost btn--sm btn--danger" disabled={mutate.isPending} onClick={() => mutate.mutate({ id: p.id, action: 'reject' })}>Reject</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  const { data } = useQuery({ queryKey: ['politicians-admin'], queryFn: () => getPoliticians({ limit: 1000, include_unlinked: '1' } as any), enabled: !!user?.is_admin })


  const invalidateLeaders = () => {
    qc.invalidateQueries({ queryKey: ['politicians-admin'] })
    qc.invalidateQueries({ queryKey: ['politicians'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const save = useMutation({
    mutationFn: async (formData: any) => editing
      ? (await client.put(`/politicians/${editing}`, formData)).data
      : (await client.post('/politicians', formData)).data,
    onSuccess: () => { invalidateLeaders(); setForm(emptyForm); setEditing(null); setSaveError('') },
    onError: (err) => setSaveError(errorMessage(err)),
  })
  const del = useMutation({ mutationFn: async (id: string) => client.delete(`/politicians/${id}`), onSuccess: invalidateLeaders })
  const broadcast = useMutation({
    mutationFn: async () => (await client.post('/notifications/broadcast', { subject: broadcastSubject, message: broadcastMessage })).data,
    onSuccess: () => { setBroadcastSubject(''); setBroadcastMessage('') },
  })

  if (!user) return null
  if (!user.is_admin) {
    return <div className="page page--narrow" style={{ paddingTop: '5rem' }}><p className="eyebrow">403</p><h1 style={{ fontSize: '2.2rem', marginTop: '0.5rem' }}>Access denied.</h1></div>
  }

  const all = data?.politicians || []
  const filtered = all.filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()))

  const edit = (p: any) => {
    setEditing(p.id)
    setForm({
      name: p.name || '', party: p.party || '', region: p.region || '', position: p.position || '',
      bio: p.bio || '', country: p.country || '', category: p.category || 'politician', age: p.age || '', latitude: p.latitude || '',
      longitude: p.longitude || '', photo_url: p.photo_url || '', aliases: (p.aliases || []).join(', '), prominence: p.prominence ?? '',
    })
    document.getElementById('leader-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const field = (key: keyof typeof emptyForm, label: string, type = 'text', placeholder = '') => (
    <div className="field">
      <label className="label">{label}</label>
      <input className="input" type={type} value={form[key]} placeholder={placeholder} onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Restricted</p>
        <h1>Admin</h1>
        <div className="chips" style={{ marginTop: '0.75rem' }}>
          {[['#moderation', 'Moderation'], ['#spikes', 'Spike captions'], ...(ARCHIVED.promises ? [] : [['#promises', 'Promises']]), ...(ARCHIVED.controversies ? [] : [['#proposals', 'Proposals']]), ['#approval', 'Approval polls'], ['#leader-form', 'Leaders'], ['#broadcast', 'Broadcast']].map(([href, label]) => (
            <a key={href} href={href} className="chip">{label}</a>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: '1.5rem' }}>
        <ModerationDesk />
        <SpikeQueue />
        {!ARCHIVED.promises && <PromiseDesk leaders={all} />}
        {!ARCHIVED.controversies && <ProposalQueue />}

        <ApprovalDesk leaders={all} />

        <div className="card" id="leader-form">
          <div className="section-title"><h2>{editing ? 'Edit leader' : 'Add leader'}</h2>{editing && <span className="mono tiny dim">{editing}</span>}</div>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            {field('name', 'Name')}
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {field('position', 'Position', 'text', 'Prime Minister, CEO, Cardinal, Judge')}
            {field('party', 'Party / organisation', 'text', 'Party, company, church, court')}
            {field('region', 'Region')}
            {field('country', 'Country')}
            {field('age', 'Age', 'number')}
            {field('prominence', 'Prominence (0–100)', 'number', 'Ranks figures for the main view')}
            {field('latitude', 'Latitude', 'number')}
            {field('longitude', 'Longitude', 'number')}
            {field('photo_url', 'Photo URL')}
            {field('aliases', 'Aliases', 'text', 'Comma separated')}
          </div>
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label className="label">Bio</label>
            <textarea className="textarea" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} />
          </div>
          <p className="help" style={{ marginTop: '0.6rem' }}>The community rating comes only from member votes and cannot be edited here.</p>
          {saveError && <div className="error" style={{ marginTop: '0.75rem' }}>{saveError}</div>}
          <div className="row" style={{ marginTop: '0.9rem' }}>
            <button className="btn btn--gold" onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending}>{save.isPending ? 'Saving' : editing ? 'Save changes' : 'Add leader'}</button>
            {editing && <button className="btn btn--ghost" onClick={() => { setEditing(null); setForm(emptyForm) }}>Cancel</button>}
          </div>
        </div>

        {editing && !ARCHIVED.controversies && <AIAnalyzer politicianId={editing} politicianName={form.name || 'this leader'} />}

        <div className="card" id="broadcast">
          <div className="section-title"><h2>Broadcast</h2></div>
          <div className="stack">
            <input className="input" placeholder="Subject" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} />
            <textarea className="textarea" placeholder="Message to all members" value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} rows={3} />
            <div className="row">
              <button className="btn" onClick={() => { if (confirm('Send to all members?')) broadcast.mutate() }} disabled={!broadcastSubject.trim() || !broadcastMessage.trim() || broadcast.isPending}>{broadcast.isPending ? 'Sending' : 'Send to all'}</button>
              {broadcast.isSuccess && <span className="mono tiny" style={{ color: 'var(--gold)' }}>Sent.</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <h2>All leaders <span className="mono tiny dim">{all.length}</span></h2>
            <input className="input" style={{ width: 220 }} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="stack" style={{ gap: '0.4rem', maxHeight: 520, overflowY: 'auto' }}>
            {filtered.map((p: any) => (
              <div key={p.id} className="row row--between" style={{ padding: '0.55rem 0.7rem', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ minWidth: 0 }}>
                  <p className="small truncate" style={{ fontWeight: 500 }}>{p.name} <span className="mono dim">{p.rating_avg == null ? `— (${p.rating_count ?? 0})` : `${p.rating_avg} (${p.rating_count})`}</span></p>
                  <p className="tiny muted truncate">{[p.position, p.party].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="row" style={{ gap: '0.3rem' }}>
                  <Link to={`/leaders/${p.id}`} className="btn btn--ghost btn--sm">View</Link>
                  <button className="btn btn--sm" onClick={() => edit(p)}>Edit</button>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm(`Delete ${p.name}? This removes every rating, thread and record on file.`)) del.mutate(p.id) }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
