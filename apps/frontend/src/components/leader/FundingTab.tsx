import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { getFunding, addFunding, deleteFunding } from '../../api/politicians'
import { useAuth } from '../../context/AuthContext'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { Empty, Loading } from '../States'
import { formatMoney } from '../../lib/format'

const SOURCE_TYPES = ['Corporate', 'Individual', 'PAC', 'Personal', 'Government', 'Union', 'Other']
const COLORS = ['#8b1a1a', '#2d6a2d', '#7a4a1a', '#c9a84c', '#3a3a5a', '#5a5a1a', '#444']

function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  const ref = useCallback((node: T | null) => setEl(node), [])
  useEffect(() => {
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return { ref, width }
}

export default function FundingTab({ politicianId }: { politicianId: string }) {
  const { user } = useAuth()
  const { ref: chartRef, width: chartWidth } = useWidth<HTMLDivElement>()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ source_name: '', source_type: 'Corporate', amount: '' })

  const { data: funding, isLoading } = useQuery({ queryKey: ['funding', politicianId], queryFn: () => getFunding(politicianId) })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['funding', politicianId] })
    qc.invalidateQueries({ queryKey: ['politician', politicianId] })
  }
  const add = useMutation({ mutationFn: addFunding, onSuccess: () => { invalidate(); setForm({ source_name: '', source_type: 'Corporate', amount: '' }); setShowForm(false) } })
  const remove = useMutation({ mutationFn: deleteFunding, onSuccess: invalidate })

  const total = funding?.reduce((s: number, f: any) => s + Number(f.amount), 0) || 0
  const corporate = funding?.filter((f: any) => ['Corporate', 'PAC'].includes(f.source_type)).reduce((s: number, f: any) => s + Number(f.amount), 0) || 0
  const pieData = SOURCE_TYPES.map((type, i) => ({
    name: type,
    value: funding?.filter((f: any) => f.source_type === type).reduce((s: number, f: any) => s + Number(f.amount), 0) || 0,
    color: COLORS[i],
  })).filter(d => d.value > 0)

  return (
    <div>
      {user?.is_admin && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn--sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add funding source'}</button>
          {showForm && (
            <div className="card card--elevated" style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="field"><label className="label">Source</label><input className="input" value={form.source_name} onChange={e => setForm({ ...form, source_name: e.target.value })} /></div>
              <div className="field"><label className="label">Type</label>
                <select className="select" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}>{SOURCE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field"><label className="label">Amount</label><input className="input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
              <button className="btn btn--gold" disabled={!form.source_name || !form.amount} onClick={() => add.mutate({ politician_id: politicianId, source_name: form.source_name, source_type: form.source_type, amount: Number(form.amount) })}>Add</button>
            </div>
          )}
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && !funding?.length && <Empty text="No funding on record. Money always leaves a trail. Keep looking." />}

      {funding?.length > 0 && (
        <div className="grid-2">
          <div className="card">
            <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Breakdown</p>
            <div ref={chartRef}>
              {chartWidth > 0 && <PieChart width={chartWidth} height={240}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={1} dataKey="value" stroke="#0a0a0a" isAnimationActive={false}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val: any) => formatMoney(Number(val))} contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} itemStyle={{ color: '#e8e3d8' }} />
                <Legend />
              </PieChart>}
            </div>
            <div className="row row--between" style={{ marginTop: '0.5rem' }}>
              <span className="eyebrow">Total</span><span className="mono">{formatMoney(total)}</span>
            </div>
            <div className="row row--between" style={{ marginTop: '0.25rem' }}>
              <span className="eyebrow">Corporate + PAC</span><span className="mono" style={{ color: total && corporate / total > 0.6 ? '#d15c5c' : 'var(--text)' }}>{total ? Math.round((corporate / total) * 100) : 0}%</span>
            </div>
          </div>

          <div className="card">
            <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>Sources</p>
            <div className="stack" style={{ gap: '0.4rem' }}>
              {funding.map((f: any) => (
                <div key={f.id} className="row row--between" style={{ padding: '0.5rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="small truncate" style={{ fontWeight: 500 }}>{f.source_name}</p>
                    <p className="mono tiny dim" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.source_type}</p>
                  </div>
                  <div className="row">
                    <span className="mono small">{formatMoney(Number(f.amount))}</span>
                    {user?.is_admin && <button className="btn btn--ghost btn--sm btn--danger" onClick={() => remove.mutate(f.id)}>×</button>}
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
