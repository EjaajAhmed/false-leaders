import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { getInfluence, addInfluence, deleteInfluence } from '../../api/politicians'
import { useAuth } from '../../context/AuthContext'
import { Empty, Loading } from '../States'
import 'leaflet/dist/leaflet.css'

const COUNTRY_COORDS: Record<string, [number, number]> = {
  'USA': [37.09, -95.71], 'Canada': [56.13, -106.35], 'UK': [55.37, -3.44],
  'China': [35.86, 104.19], 'Russia': [61.52, 105.31], 'France': [46.23, 2.21],
  'Germany': [51.16, 10.45], 'India': [20.59, 78.96], 'Japan': [36.20, 138.25],
  'Australia': [-25.27, 133.77], 'Brazil': [-14.23, -51.92], 'Saudi Arabia': [23.88, 45.08],
  'Israel': [31.04, 34.85], 'Iran': [32.42, 53.68], 'Ukraine': [48.37, 31.16],
  'Mexico': [23.63, -102.55], 'South Korea': [35.90, 127.76], 'Turkey': [38.96, 35.24],
  'Pakistan': [30.37, 69.34], 'Italy': [41.87, 12.56], 'Qatar': [25.35, 51.18], 'UAE': [23.42, 53.85],
}

function getColor(score: number) {
  if (score >= 70) return '#8b1a1a'
  if (score >= 50) return '#c9a84c'
  if (score >= 30) return '#7a4a1a'
  return '#555'
}
function getLabel(score: number) {
  if (score >= 70) return 'High'
  if (score >= 50) return 'Medium'
  if (score >= 30) return 'Low'
  return 'Minimal'
}

export default function InfluenceTab({ politicianId }: { politicianId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ country: '', influence_score: '50', notes: '' })

  const { data: influence, isLoading } = useQuery({ queryKey: ['influence', politicianId], queryFn: () => getInfluence(politicianId) })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['influence', politicianId] })
    qc.invalidateQueries({ queryKey: ['politician', politicianId] })
  }
  const add = useMutation({ mutationFn: addInfluence, onSuccess: () => { invalidate(); setForm({ country: '', influence_score: '50', notes: '' }); setShowForm(false) } })
  const remove = useMutation({ mutationFn: deleteInfluence, onSuccess: invalidate })

  const withCoords = influence?.filter((i: any) => COUNTRY_COORDS[i.country]) || []

  return (
    <div>
      {user?.is_admin && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn--sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add country'}</button>
          {showForm && (
            <div className="card card--elevated" style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="field"><label className="label">Country</label>
                <select className="select" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>
                  <option value="">Select</option>{Object.keys(COUNTRY_COORDS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label className="label">Score</label><input className="input" type="number" min="0" max="100" value={form.influence_score} onChange={e => setForm({ ...form, influence_score: e.target.value })} /></div>
              <div className="field"><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <button className="btn btn--gold" disabled={!form.country} onClick={() => add.mutate({ politician_id: politicianId, country: form.country, influence_score: Number(form.influence_score), notes: form.notes })}>Add</button>
            </div>
          )}
        </div>
      )}

      {isLoading && <Loading />}
      {!isLoading && !influence?.length && <Empty text="No foreign ties on record. Which is either reassuring, or a very good cover." />}

      {influence?.length > 0 && (
        <>
          <div className="verdict-legend" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            {[['High 70–100', '#8b1a1a'], ['Medium 50–69', '#c9a84c'], ['Low 30–49', '#7a4a1a'], ['Minimal 0–29', '#555']].map(([label, color]) => (
              <span key={label} className="verdict-legend__item"><span className="verdict-legend__swatch" style={{ background: color }} />{label}</span>
            ))}
          </div>

          <div style={{ height: 360, border: '1px solid var(--border-strong)', marginBottom: '1.25rem' }}>
            <MapContainer center={[25, 10]} zoom={2} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
              {withCoords.map((inf: any) => {
                const [lat, lng] = COUNTRY_COORDS[inf.country]
                const score = Number(inf.influence_score)
                return (
                  <CircleMarker key={inf.id} center={[lat, lng]} radius={Math.max(8, score / 4)} fillColor={getColor(score)} color="#0a0a0a" weight={1} fillOpacity={0.8}>
                    <Popup>
                      <p className="display" style={{ fontSize: '0.95rem' }}>{inf.country}</p>
                      <p className="mono small" style={{ color: getColor(score), marginTop: '0.2rem' }}>{score}/100 · {getLabel(score)}</p>
                      {inf.notes && <p className="small muted" style={{ marginTop: '0.4rem' }}>{inf.notes}</p>}
                      {user?.is_admin && <button className="btn btn--ghost btn--sm btn--danger" style={{ marginTop: '0.5rem' }} onClick={() => remove.mutate(inf.id)}>Remove</button>}
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </div>

          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {influence.map((inf: any) => {
              const s = Number(inf.influence_score)
              return (
                <div key={inf.id} className="card card--tight" style={{ borderLeft: `3px solid ${getColor(s)}` }}>
                  <div className="row row--between">
                    <span className="small" style={{ fontWeight: 500 }}>{inf.country}</span>
                    <span className="mono" style={{ color: getColor(s), fontWeight: 600 }}>{s}</span>
                  </div>
                  <p className="mono tiny dim" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.15rem' }}>{getLabel(s)}</p>
                  {inf.notes && <p className="tiny muted" style={{ marginTop: '0.3rem' }}>{inf.notes}</p>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
