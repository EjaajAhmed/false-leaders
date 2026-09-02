import { useState, useEffect } from 'react'
import type { DragEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getBookmarks, getGrafts, createGraft, deleteGraft, moveBookmark, removeBookmark } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import { Empty } from '../components/States'

export default function Bookmarks() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | 'all' | 'unsorted'>('all')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const { data: bookmarks } = useQuery({ queryKey: ['bookmarks'], queryFn: getBookmarks, enabled: !!user })
  const { data: grafts } = useQuery({ queryKey: ['grafts'], queryFn: getGrafts, enabled: !!user })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['grafts'] }); qc.invalidateQueries({ queryKey: ['bookmarks'] }) }
  const create = useMutation({ mutationFn: createGraft, onSuccess: () => { invalidate(); setNewName(''); setNewDesc(''); setShowNew(false) } })
  const del = useMutation({ mutationFn: deleteGraft, onSuccess: () => { invalidate(); setSelected('all') } })
  const move = useMutation({ mutationFn: moveBookmark, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: removeBookmark, onSuccess: invalidate })

  useEffect(() => { if (!user) navigate('/login') }, [user, navigate])
  if (!user) return null

  const onDragStart = (e: DragEvent, id: string) => { setDraggingId(id); e.dataTransfer.effectAllowed = 'move' }
  const onDragOver = (e: DragEvent, graftId: string | null) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(graftId ?? 'unsorted') }
  const onDrop = (e: DragEvent, graftId: string | null) => {
    e.preventDefault()
    if (draggingId) move.mutate({ id: draggingId, graft_id: graftId })
    setDraggingId(null); setDragOver(null)
  }

  const all = bookmarks || []
  const unsorted = all.filter((b: any) => !b.graft_id)
  const inGraft = (id: string) => all.filter((b: any) => b.graft_id === id)
  const shown = selected === 'all' ? all : selected === 'unsorted' ? unsorted : inGraft(selected)

  const dropStyle = (id: string | null) => ({ background: dragOver === (id ?? 'unsorted') ? 'var(--gold-soft)' : 'transparent', transition: 'background 0.15s' })
  const navBtn = (active: boolean) => `btn btn--ghost btn--sm btn--block${active ? ' is-active' : ''}`

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Your watch list</p>
        <h1>Bookmarks</h1>
        <p>Drag leaders into grafts to group them.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2rem' }} className="bookmarks-grid">
        <div>
          <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
            <span className="eyebrow">Grafts</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowNew(!showNew)}>{showNew ? 'Cancel' : 'New'}</button>
          </div>
          {showNew && (
            <div className="card card--tight stack" style={{ marginBottom: '0.75rem', gap: '0.5rem' }}>
              <input className="input" placeholder="Graft name" value={newName} onChange={e => setNewName(e.target.value)} />
              <input className="input" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <button className="btn btn--gold btn--sm" disabled={!newName.trim()} onClick={() => create.mutate({ name: newName, description: newDesc })}>Create</button>
            </div>
          )}
          <div className="stack" style={{ gap: '0.2rem' }}>
            <button className={navBtn(selected === 'all')} style={{ justifyContent: 'space-between' }} onClick={() => setSelected('all')}>All <span className="dim">{all.length}</span></button>
            <div style={dropStyle(null)} onDragOver={e => onDragOver(e, null)} onDrop={e => onDrop(e, null)} onDragLeave={() => setDragOver(null)}>
              <button className={navBtn(selected === 'unsorted')} style={{ justifyContent: 'space-between' }} onClick={() => setSelected('unsorted')}>Unsorted <span className="dim">{unsorted.length}</span></button>
            </div>
            {grafts?.map((g: any) => (
              <div key={g.id} style={dropStyle(g.id)} onDragOver={e => onDragOver(e, g.id)} onDrop={e => onDrop(e, g.id)} onDragLeave={() => setDragOver(null)} className="row" >
                <button className={navBtn(selected === g.id)} style={{ justifyContent: 'space-between', flex: 1 }} onClick={() => setSelected(g.id)}>
                  <span className="truncate">{g.name}</span><span className="dim">{inGraft(g.id).length}</span>
                </button>
                <button className="btn btn--ghost btn--sm btn--danger" onClick={() => { if (confirm(`Delete "${g.name}"?`)) del.mutate(g.id) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selected !== 'all' && selected !== 'unsorted' && grafts && (
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.3rem' }}>{grafts.find((g: any) => g.id === selected)?.name}</h2>
              <p className="muted small">{grafts.find((g: any) => g.id === selected)?.description}</p>
            </div>
          )}
          {shown.length === 0 && <Empty text={selected === 'unsorted' ? 'Nothing unsorted.' : 'Nothing saved here. Everyone is worth watching.'} />}
          <div className="stack" style={{ gap: '0.5rem' }}>
            {shown.map((b: any) => (
              <div key={b.id} draggable onDragStart={e => onDragStart(e, b.id)} onDragEnd={() => { setDraggingId(null); setDragOver(null) }}
                className="card card--tight row row--between" style={{ cursor: 'grab', opacity: draggingId === b.id ? 0.4 : 1 }}>
                <div className="row" style={{ minWidth: 0 }}>
                  <span className="dim mono" style={{ userSelect: 'none' }}>⋮⋮</span>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/leaders/${b.politician_id}`} className="truncate" style={{ display: 'block', fontWeight: 500 }}>{b.name}</Link>
                    <p className="muted tiny truncate">{[b.position, b.party].filter(Boolean).join(' · ')}{b.graft_name && <span className="dim"> · {b.graft_name}</span>}</p>
                  </div>
                </div>
                <button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(b.id)} title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 768px) { .bookmarks-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
