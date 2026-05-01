import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getControversies, addControversy, updateControversy, deleteControversy } from '../api/politicians'
import { useAuth } from '../context/AuthContext'

const LEVELS = [
  { value: 'confirmed', label: 'Confirmed', color: '#1e7e34', bg: '#e6f4ea', border: '#a8d5b5' },
  { value: 'likely', label: 'Likely', color: '#2d6a4f', bg: '#d8f3dc', border: '#b7e4c7' },
  { value: 'maybe', label: 'Maybe', color: '#b8860b', bg: '#fff9e6', border: '#ffe08a' },
  { value: 'speculative', label: 'Speculative', color: '#c0392b', bg: '#fce8e8', border: '#f5c0c0' },
]

function getLevelStyle(level: string) {
  return LEVELS.find(l => l.value === level) || LEVELS[2]
}

function LevelBadge({ level }: { level: string }) {
  const style = getLevelStyle(level)
  return (
    <span style={{
      padding: '0.2rem 0.65rem',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 500,
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
      whiteSpace: 'nowrap'
    }}>
      {style.label}
    </span>
  )
}

const emptyForm = { title: '', description: '', source_url: '', level: 'confirmed' }

export default function ControversyList({ politicianId }: { politicianId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: controversies } = useQuery({
    queryKey: ['controversies', politicianId],
    queryFn: () => getControversies(politicianId)
  })

  const addMutation = useMutation({
    mutationFn: addControversy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controversies', politicianId] })
      setForm(emptyForm)
      setShowForm(false)
    }
  })

  const updateMutation = useMutation({
    mutationFn: updateControversy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controversies', politicianId] })
      setEditing(null)
      setForm(emptyForm)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteControversy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['controversies', politicianId] })
  })

  const handleEdit = (c: any) => {
    setEditing(c.id)
    setForm({ title: c.title, description: c.description, source_url: c.source_url || '', level: c.level })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (editing) {
      updateMutation.mutate({ id: editing, ...form })
    } else {
      addMutation.mutate({ politician_id: politicianId, ...form })
    }
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
          Controversies {controversies?.length > 0 && `(${controversies.length})`}
        </h2>
        {(user as any)?.is_admin && (
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}
            style={{ padding: '0.35rem 0.9rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showForm && !editing ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showForm && (user as any)?.is_admin && (
        <div style={{ padding: '1.25rem', border: '1px solid #eee', borderRadius: '10px', marginBottom: '1.25rem', background: '#fafafa' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Title</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. SNC-Lavalin affair"
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Describe the controversy..."
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Level</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', background: 'white' }}
                >
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Source URL (optional)</label>
                <input
                  value={form.source_url}
                  onChange={e => setForm({ ...form, source_url: e.target.value })}
                  placeholder="https://..."
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim() || !form.description.trim()}
                style={{ padding: '0.5rem 1.25rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {editing ? 'Save changes' : 'Add controversy'}
              </button>
              {editing && (
                <button
                  onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(false) }}
                  style={{ padding: '0.5rem 1.25rem', border: '1px solid #ddd', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {controversies?.length === 0 && (
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No controversies recorded.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {controversies?.map((c: any) => {
          const style = getLevelStyle(c.level)
          return (
            <div key={c.id} style={{
              padding: '1rem 1.25rem',
              border: `1px solid ${style.border}`,
              borderLeft: `4px solid ${style.color}`,
              borderRadius: '8px',
              background: style.bg
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <LevelBadge level={c.level} />
                    <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem', color: '#111' }}>{c.title}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#444', lineHeight: '1.5' }}>{c.description}</p>
                  {c.source_url && (
                    <a href={c.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: style.color, marginTop: '0.4rem', display: 'inline-block' }}>
                      View source
                    </a>
                  )}
                </div>
                {(user as any)?.is_admin && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleEdit(c)}
                      style={{ padding: '0.25rem 0.6rem', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      style={{ padding: '0.25rem 0.6rem', border: '1px solid #fcc', background: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#c0392b' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}