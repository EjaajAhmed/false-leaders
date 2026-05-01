import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getFunding, addFunding, deleteFunding } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const SOURCE_TYPES = ['Corporate', 'Individual', 'PAC', 'Personal', 'Government', 'Union', 'Other']
const COLORS = ['#8B1818', '#A01C1C', '#c9a84c', '#2d6a4f', '#1a1a1a', '#555', '#888']

export default function FundingTab({ politicianId }: { politicianId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ source_name: '', source_type: 'Corporate', amount: '' })

  const { data: funding } = useQuery({ queryKey: ['funding', politicianId], queryFn: () => getFunding(politicianId) })

  const addMutation = useMutation({
    mutationFn: addFunding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding', politicianId] })
      setForm({ source_name: '', source_type: 'Corporate', amount: '' })
      setShowForm(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFunding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funding', politicianId] })
  })

  const total = funding?.reduce((sum: number, f: any) => sum + Number(f.amount), 0) || 0

  const pieData = SOURCE_TYPES.map((type, i) => {
    const amount = funding?.filter((f: any) => f.source_type === type).reduce((sum: number, f: any) => sum + Number(f.amount), 0) || 0
    return { name: type, value: amount, color: COLORS[i] }
  }).filter(d => d.value > 0)

  const formatAmount = (n: number) => '$' + n.toLocaleString()

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {(user as any)?.is_admin && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.4rem 1rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showForm ? 'Cancel' : '+ Add funding source'}
          </button>

          {showForm && (
            <div style={{ marginTop: '0.75rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Source name</label>
                <input value={form.source_name} onChange={e => setForm({ ...form, source_name: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Type</label>
                <select value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', background: 'white' }}>
                  {SOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Amount ($)</label>
                <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
              </div>
              <button
                onClick={() => addMutation.mutate({ politician_id: politicianId, source_name: form.source_name, source_type: form.source_type, amount: Number(form.amount) })}
                disabled={!form.source_name || !form.amount}
                style={{ padding: '0.4rem 0.75rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {!funding?.length && <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No funding data recorded.</p>}

      {funding?.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ padding: '1.25rem', border: '1px solid #eee', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Funding breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val: any) => formatAmount(val)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <p style={{ textAlign: 'center', margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#888' }}>
              Total: <strong>{formatAmount(total)}</strong>
            </p>
          </div>

          <div style={{ padding: '1.25rem', border: '1px solid #eee', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>All sources</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {funding?.map((f: any) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '6px', background: '#fafafa' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{f.source_name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>{f.source_type}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 500, color: '#8B1818' }}>{formatAmount(Number(f.amount))}</span>
                    {(user as any)?.is_admin && (
                      <button onClick={() => deleteMutation.mutate(f.id)}
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}