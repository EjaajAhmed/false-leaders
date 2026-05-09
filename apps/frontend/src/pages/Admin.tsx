import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPoliticians } from '../api/politicians'
import client from '../api/client'

const emptyForm = {
  name: '', party: '', region: '', position: '', bio: '',
  country: 'Canada', age: '', latitude: '', longitude: ''
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [configValues, setConfigValues] = useState<Record<string, number>>({})

  const { data } = useQuery({
    queryKey: ['politicians-admin'],
    queryFn: () => getPoliticians({ limit: 1000 }),
    enabled: !!user
  })

  const { data: configData } = useQuery({
    queryKey: ['truth-score-config'],
    queryFn: async () => {
      const res = await client.get('/config/truth-score')
      return res.data
    },
    enabled: !!user
  })

  useEffect(() => {
    if (configData) {
      const vals: Record<string, number> = {}
      for (const c of configData) vals[c.key] = c.value
      setConfigValues(vals)
    }
  }, [configData])

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (editing) {
        const res = await client.put(`/politicians/${editing}`, formData)
        return res.data
      } else {
        const res = await client.post('/politicians', formData)
        return res.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicians-admin'] })
      queryClient.invalidateQueries({ queryKey: ['politicians'] })
      setForm(emptyForm)
      setEditing(null)
    },
    onError: (err: any) => {
      console.error('Save failed:', err.response?.data || err.message)
      alert('Save failed: ' + (err.response?.data?.error || err.message))
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/politicians/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['politicians-admin'] })
      queryClient.invalidateQueries({ queryKey: ['politicians'] })
    }
  })

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await client.post('/notifications/broadcast', { subject: broadcastSubject, message: broadcastMessage })
      return res.data
    },
    onSuccess: () => { setBroadcastSubject(''); setBroadcastMessage('') }
  })

  const configMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(configValues).map(([key, value]) => ({ key, value: Number(value) }))
      const res = await client.put('/config/truth-score', updates)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['truth-score-config'] })
  })

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await client.post('/politicians/recalculate-all', {})
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['politicians-admin'] })
      queryClient.invalidateQueries({ queryKey: ['politicians'] })
      alert(`Recalculated scores for ${data.updated} politicians.`)
    }
  })

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  if (!user) return null

  const allPoliticians = data?.politicians || []
  const filtered = allPoliticians.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (p: any) => {
    setEditing(p.id)
    setForm({
      name: p.name || '', party: p.party || '', region: p.region || '',
      position: p.position || '', bio: p.bio || '', country: p.country || 'Canada',
      age: p.age || '', latitude: p.latitude || '', longitude: p.longitude || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const field = (key: string, label: string, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ fontSize: '0.8rem', color: '#888' }}>{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
      />
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ margin: '0 0 0.25rem' }}>Admin panel</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Add and manage politicians.</p>

      {/* Broadcast */}
      <div style={{ padding: '1.5rem', border: '1px solid #f0c070', borderRadius: '12px', marginBottom: '2rem', background: '#fffdf5' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Broadcast app news</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            placeholder="Subject line"
            value={broadcastSubject}
            onChange={e => setBroadcastSubject(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
          />
          <textarea
            placeholder="Message to all users..."
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
            rows={3}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', resize: 'vertical' }}
          />
          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={!broadcastSubject.trim() || !broadcastMessage.trim() || broadcastMutation.isPending}
            style={{ padding: '0.6rem 1.5rem', background: '#b8860b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', alignSelf: 'flex-start' }}
          >
            {broadcastMutation.isPending ? 'Sending...' : 'Send to all users'}
          </button>
          {broadcastMutation.isSuccess && <p style={{ color: '#1e7e34', fontSize: '0.85rem', margin: 0 }}>Sent!</p>}
        </div>
      </div>

      {/* TruthScore weights */}
      <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>TruthScore weights</h2>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Points deducted per controversy level or funding condition. Score starts at base score.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {configData?.map((c: any) => (
            <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#888' }}>{c.label}</label>
              <input
                type="number"
                value={configValues[c.key] ?? c.value}
                onChange={e => setConfigValues(prev => ({ ...prev, [c.key]: Number(e.target.value) }))}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => configMutation.mutate()}
            disabled={configMutation.isPending}
            style={{ padding: '0.6rem 1.5rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {configMutation.isPending ? 'Saving...' : 'Save weights'}
          </button>
          <button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            style={{ padding: '0.6rem 1.5rem', background: '#555', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {recalculateMutation.isPending ? 'Recalculating...' : 'Recalculate all scores'}
          </button>
          {configMutation.isSuccess && <p style={{ color: '#1e7e34', fontSize: '0.85rem', margin: 0 }}>Saved — click recalculate to apply to all.</p>}
        </div>
      </div>

      {/* Add/Edit form */}
      <div style={{ padding: '1.5rem', border: '1px solid #eee', borderRadius: '12px', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1rem' }}>
          {editing ? 'Edit politician' : 'Add politician'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {field('name', 'Name')}
          {field('party', 'Party')}
          {field('region', 'Region / Province')}
          {field('position', 'Position / Title')}
          {field('country', 'Country')}
          {field('age', 'Age', 'number')}
          {field('latitude', 'Latitude', 'number')}
          {field('longitude', 'Longitude', 'number')}
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '0.3rem' }}>Bio</label>
          <textarea
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            rows={3}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#aaa' }}>
          TruthScore is calculated automatically from controversies, funding and foreign influence.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.name.trim() || saveMutation.isPending}
            style={{ padding: '0.6rem 1.5rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {saveMutation.isPending ? 'Saving...' : editing ? 'Save changes' : 'Add politician'}
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(null); setForm(emptyForm) }}
              style={{ padding: '0.6rem 1.5rem', border: '1px solid #ddd', background: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Politicians list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>All politicians ({allPoliticians.length})</h2>
          <input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid #eee', borderRadius: '8px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>{p.name}</p>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#888' }}>{p.party} — {p.position}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleEdit(p)}
                  style={{ padding: '0.3rem 0.75rem', border: '1px solid #ddd', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteMutation.mutate(p.id) }}
                  style={{ padding: '0.3rem 0.75rem', border: '1px solid #fcc', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#c0392b' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}