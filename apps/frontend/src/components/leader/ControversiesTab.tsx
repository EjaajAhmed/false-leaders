import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getControversies, addControversy, updateControversy, deleteControversy, upvoteControversy, proposeControversy, getMyProposals } from '../../api/politicians'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { Level } from '../../types'
import LevelBadge from '../LevelBadge'
import Upvote from '../Upvote'
import { Empty, Loading } from '../States'
import { LEVELS, formatDate } from '../../lib/format'

const emptyForm = { title: '', description: '', source_url: '', level: 'speculative' as Level }
const TILTS = [-0.6, 0.4, -0.3, 0.7, -0.8, 0.2, 0.5, -0.4]

function ControversyForm({ form, setForm, onSubmit, onCancel, submitLabel, pending, error }: any) {
  return (
    <div className="card card--elevated stack" style={{ marginBottom: '1.25rem' }}>
      <div className="field">
        <label className="label">Title</label>
        <input className="input" value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} placeholder="Short. Specific." maxLength={200} />
      </div>
      <div className="field">
        <label className="label">Description</label>
        <textarea className="textarea" value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="What happened, who was involved, what is known." maxLength={4000} />
      </div>
      <div className="grid-2" style={{ gap: '0.75rem' }}>
        <div className="field">
          <label className="label">Level</label>
          <select className="select" value={form.level} onChange={(e: any) => setForm({ ...form, level: e.target.value })}>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Source URL</label>
          <input className="input" value={form.source_url} onChange={(e: any) => setForm({ ...form, source_url: e.target.value })} placeholder="https://" />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn btn--gold" onClick={onSubmit} disabled={!form.title.trim() || !form.description.trim() || pending}>{pending ? 'Sending' : submitLabel}</button>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function ControversiesTab({ leaderId }: { leaderId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = !!user?.is_admin
  const verified = !!user?.email_verified
  const [mode, setMode] = useState<'none' | 'admin' | 'propose'>('none')
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [proposed, setProposed] = useState(false)

  const { data: controversies, isLoading } = useQuery({ queryKey: ['controversies', leaderId], queryFn: () => getControversies(leaderId) })
  const { data: myProposals } = useQuery({ queryKey: ['my-proposals', leaderId], queryFn: () => getMyProposals(leaderId), enabled: verified })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['controversies', leaderId] })
    qc.invalidateQueries({ queryKey: ['politician', leaderId] })
  }
  const reset = () => { setMode('none'); setEditing(null); setForm(emptyForm); setError('') }

  const add = useMutation({ mutationFn: addControversy, onSuccess: () => { invalidate(); reset() }, onError: e => setError(errorMessage(e)) })
  const update = useMutation({ mutationFn: updateControversy, onSuccess: () => { invalidate(); reset() }, onError: e => setError(errorMessage(e)) })
  const remove = useMutation({ mutationFn: deleteControversy, onSuccess: invalidate })
  const upvote = useMutation({ mutationFn: upvoteControversy, onSuccess: () => qc.invalidateQueries({ queryKey: ['controversies', leaderId] }) })
  const propose = useMutation({
    mutationFn: proposeControversy,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-proposals', leaderId] }); reset(); setProposed(true) },
    onError: e => setError(errorMessage(e)),
  })

  const startEdit = (c: any) => {
    setEditing(c.id)
    setForm({ title: c.title, description: c.description, source_url: c.source_url || '', level: c.level })
    setMode('admin')
  }

  const pending = myProposals?.filter((p: any) => p.status === 'pending') || []

  return (
    <div>
      <div className="row row--between row--wrap" style={{ marginBottom: '1rem' }}>
        <div>
          <p className="eyebrow">Evidence board</p>
          <p className="small muted">{controversies?.length || 0} on file. Upvote what matters.</p>
        </div>
        <div className="row">
          {verified && mode !== 'propose' && <button className="btn" onClick={() => { setMode('propose'); setForm(emptyForm); setError('') }}>Propose controversy</button>}
          {isAdmin && mode !== 'admin' && <button className="btn btn--gold" onClick={() => { setMode('admin'); setEditing(null); setForm(emptyForm); setError('') }}>Add (admin)</button>}
        </div>
      </div>

      {mode === 'admin' && (
        <ControversyForm form={form} setForm={setForm} onCancel={reset} error={error}
          submitLabel={editing ? 'Save' : 'Add to file'}
          pending={add.isPending || update.isPending}
          onSubmit={() => editing ? update.mutate({ id: editing, ...form }) : add.mutate({ politician_id: leaderId, ...form })} />
      )}
      {mode === 'propose' && (
        <>
          <div className="notice notice--plain" style={{ marginBottom: '0.75rem' }}>Proposals are reviewed before they appear. Cite a source if you have one.</div>
          <ControversyForm form={form} setForm={setForm} onCancel={reset} error={error}
            submitLabel="Submit for review" pending={propose.isPending}
            onSubmit={() => propose.mutate({ politician_id: leaderId, ...form })} />
        </>
      )}
      {proposed && <div className="notice" style={{ marginBottom: '1rem' }}>Received. It will appear here if approved.</div>}
      {pending.length > 0 && (
        <div className="notice notice--plain" style={{ marginBottom: '1rem' }}>
          {pending.length} of your proposal{pending.length === 1 ? ' is' : 's are'} awaiting review.
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && controversies?.length === 0 && <Empty text="Nothing on file. That doesn't mean there's nothing to find." sub="Propose one if you know something" />}

      <div className="evidence-board">
        {controversies?.map((c: any, i: number) => (
          <article key={c.id} className={`evidence evidence--${c.level}`} style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}>
            <div className="row row--between">
              <span className="evidence__file">File {String(i + 1).padStart(3, '0')} · {formatDate(c.created_at)}</span>
              <LevelBadge level={c.level} />
            </div>
            <h3 className="evidence__title">{c.title}</h3>
            <p className="evidence__body">{c.description}</p>
            <div className="evidence__foot">
              <div className="row">
                <Upvote count={c.upvotes} active={c.user_upvoted} disabled={!verified} onClick={() => upvote.mutate(c.id)} />
                {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="evidence__source">Source</a>}
              </div>
              {isAdmin && (
                <div className="row" style={{ gap: '0.3rem' }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => startEdit(c)}>Edit</button>
                  <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm('Delete this controversy?')) remove.mutate(c.id) }}>Delete</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
