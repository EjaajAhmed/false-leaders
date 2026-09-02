import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPoliticians, getLeakQueue, setLeakStatus, getProposalQueue, reviewProposal } from '../api/politicians'
import client, { errorMessage } from '../api/client'
import AIAnalyzer from '../components/AIAnalyzer'
import LevelBadge from '../components/LevelBadge'
import { Empty, Loading } from '../components/States'
import { LEVELS, proleTag, timeAgo } from '../lib/format'
import type { Level } from '../types'

const emptyForm = {
  name: '', party: '', region: '', position: '', bio: '', country: 'Canada',
  age: '', latitude: '', longitude: '', photo_url: '', aliases: '',
}

function LeakQueue() {
  const qc = useQueryClient()
  const [escalating, setEscalating] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<Level>('speculative')
  const { data, isLoading } = useQuery({ queryKey: ['leak-queue'], queryFn: () => getLeakQueue() })
  const mutate = useMutation({
    mutationFn: setLeakStatus,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leak-queue'] }); setEscalating(null); setTitle('') },
    onError: e => alert(errorMessage(e)),
  })

  return (
    <div className="card" id="leaks">
      <div className="section-title"><h2>Leak queue</h2><span className="mono tiny dim">{data?.length || 0} awaiting</span></div>
      {isLoading && <Loading />}
      {!isLoading && data?.length === 0 && <Empty text="Queue is empty. The Proles are quiet." />}
      <div className="stack">
        {data?.map((l: any) => (
          <div key={l.id} className="post">
            <div className="post__head">
              <div className="post__who">
                <span className="post__prole">{proleTag(l.prole_number)}</span>
                <span className="mono tiny dim">(@{l.username})</span>
                <Link to={`/leaders/${l.politician_id}?tab=leaks`} className="post__name">{l.leader_name}</Link>
                <span className="post__time">{timeAgo(l.created_at)} · {l.upvotes} upvotes</span>
              </div>
              <div className="row" style={{ gap: '0.3rem' }}>
                <button className="btn btn--sm" onClick={() => { setEscalating(escalating === l.id ? null : l.id); setTitle(l.body.slice(0, 80)) }}>Escalate</button>
                <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm('Remove this leak?')) mutate.mutate({ id: l.id, status: 'removed' }) }}>Remove</button>
              </div>
            </div>
            <p className="post__body">{l.body}</p>
            {escalating === l.id && (
              <div className="stack" style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid var(--border-strong)', background: 'var(--bg)' }}>
                <div className="grid-2" style={{ gap: '0.5rem' }}>
                  <div className="field"><label className="label">Controversy title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></div>
                  <div className="field"><label className="label">Level</label>
                    <select className="select" value={level} onChange={e => setLevel(e.target.value as Level)}>{LEVELS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn--gold btn--sm" disabled={!title.trim() || mutate.isPending} onClick={() => mutate.mutate({ id: l.id, status: 'escalated', title, level })}>Escalate to controversy</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEscalating(null)}>Cancel</button>
                </div>
              </div>
            )}
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
  const [configValues, setConfigValues] = useState<Record<string, number>>({})
  const [saveError, setSaveError] = useState('')

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])

  const { data } = useQuery({ queryKey: ['politicians-admin'], queryFn: () => getPoliticians({ limit: 1000 }), enabled: !!user?.is_admin })
  const { data: configData } = useQuery({
    queryKey: ['truth-score-config'],
    queryFn: async () => (await client.get('/config/truth-score')).data,
    enabled: !!user?.is_admin,
  })

  useEffect(() => {
    if (configData) {
      const vals: Record<string, number> = {}
      for (const c of configData) vals[c.key] = Number(c.value)
      setConfigValues(vals)
    }
  }, [configData])

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
  const saveConfig = useMutation({
    mutationFn: async () => (await client.put('/config/truth-score', Object.entries(configValues).map(([key, value]) => ({ key, value: Number(value) })))).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truth-score-config'] }),
  })
  const recalc = useMutation({
    mutationFn: async () => (await client.post('/politicians/recalculate-all', {})).data,
    onSuccess: (d) => { invalidateLeaders(); alert(`Recalculated ${d.updated} leaders. ${d.changed} changed.`) },
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
      bio: p.bio || '', country: p.country || 'Canada', age: p.age || '', latitude: p.latitude || '',
      longitude: p.longitude || '', photo_url: p.photo_url || '', aliases: (p.aliases || []).join(', '),
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
          {[['#leaks', 'Leak queue'], ['#proposals', 'Proposals'], ['#weights', 'Weights'], ['#leader-form', 'Leaders'], ['#broadcast', 'Broadcast']].map(([href, label]) => (
            <a key={href} href={href} className="chip">{label}</a>
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: '1.5rem' }}>
        <LeakQueue />
        <ProposalQueue />

        <div className="card" id="weights">
          <div className="section-title"><h2>TruthScore weights</h2></div>
          <p className="help" style={{ marginBottom: '1rem' }}>Points deducted per controversy level and funding condition. Floor is 1.</p>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            {configData?.map((c: any) => (
              <div key={c.key} className="field">
                <label className="label">{c.label}</label>
                <input className="input mono" type="number" value={configValues[c.key] ?? c.value} onChange={e => setConfigValues(prev => ({ ...prev, [c.key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <div className="row row--wrap" style={{ marginTop: '1rem' }}>
            <button className="btn btn--gold" onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending}>{saveConfig.isPending ? 'Saving' : 'Save weights'}</button>
            <button className="btn" onClick={() => recalc.mutate()} disabled={recalc.isPending}>{recalc.isPending ? 'Recalculating' : 'Recalculate all scores'}</button>
            {saveConfig.isSuccess && <span className="mono tiny" style={{ color: 'var(--gold)' }}>Saved. Recalculate to apply.</span>}
          </div>
        </div>

        <div className="card" id="leader-form">
          <div className="section-title"><h2>{editing ? 'Edit leader' : 'Add leader'}</h2>{editing && <span className="mono tiny dim">{editing}</span>}</div>
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            {field('name', 'Name')}
            {field('position', 'Position', 'text', 'Prime Minister, CEO, Cardinal, Judge')}
            {field('party', 'Party / organisation')}
            {field('region', 'Region')}
            {field('country', 'Country')}
            {field('age', 'Age', 'number')}
            {field('latitude', 'Latitude', 'number')}
            {field('longitude', 'Longitude', 'number')}
            {field('photo_url', 'Photo URL')}
            {field('aliases', 'Aliases', 'text', 'Comma separated')}
          </div>
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label className="label">Bio</label>
            <textarea className="textarea" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} />
          </div>
          <p className="help" style={{ marginTop: '0.6rem' }}>TruthScore is derived from controversies, funding and foreign influence. It is not editable.</p>
          {saveError && <div className="error" style={{ marginTop: '0.75rem' }}>{saveError}</div>}
          <div className="row" style={{ marginTop: '0.9rem' }}>
            <button className="btn btn--gold" onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending}>{save.isPending ? 'Saving' : editing ? 'Save changes' : 'Add leader'}</button>
            {editing && <button className="btn btn--ghost" onClick={() => { setEditing(null); setForm(emptyForm) }}>Cancel</button>}
          </div>
        </div>

        {editing && <AIAnalyzer politicianId={editing} politicianName={form.name || 'this leader'} />}

        <div className="card" id="broadcast">
          <div className="section-title"><h2>Broadcast</h2></div>
          <div className="stack">
            <input className="input" placeholder="Subject" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} />
            <textarea className="textarea" placeholder="Dispatch to every Prole" value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} rows={3} />
            <div className="row">
              <button className="btn" onClick={() => { if (confirm('Send to every Prole?')) broadcast.mutate() }} disabled={!broadcastSubject.trim() || !broadcastMessage.trim() || broadcast.isPending}>{broadcast.isPending ? 'Sending' : 'Send to all'}</button>
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
              <div key={p.id} className="row row--between" style={{ padding: '0.55rem 0.7rem', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <div style={{ minWidth: 0 }}>
                  <p className="small truncate" style={{ fontWeight: 500 }}>{p.name} <span className="mono dim">{Math.round(Number(p.truth_score))}</span></p>
                  <p className="tiny muted truncate">{[p.position, p.party].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="row" style={{ gap: '0.3rem' }}>
                  <Link to={`/leaders/${p.id}`} className="btn btn--ghost btn--sm">View</Link>
                  <button className="btn btn--sm" onClick={() => edit(p)}>Edit</button>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm(`Delete ${p.name}? This removes every controversy, verdict and leak on file.`)) del.mutate(p.id) }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
