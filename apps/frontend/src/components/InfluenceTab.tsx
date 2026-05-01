import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { getInfluence, addInfluence, deleteInfluence } from '../api/politicians'
import { useAuth } from '../context/AuthContext'
import 'leaflet/dist/leaflet.css'

const COUNTRY_COORDS: Record<string, [number, number]> = {
  'USA': [37.09, -95.71], 'Canada': [56.13, -106.35], 'UK': [55.37, -3.44],
  'China': [35.86, 104.19], 'Russia': [61.52, 105.31], 'France': [46.23, 2.21],
  'Germany': [51.16, 10.45], 'India': [20.59, 78.96], 'Japan': [36.20, 138.25],
  'Australia': [-25.27, 133.77], 'Brazil': [-14.23, -51.92], 'Saudi Arabia': [23.88, 45.08],
  'Israel': [31.04, 34.85], 'Iran': [32.42, 53.68], 'Ukraine': [48.37, 31.16],
  'Mexico': [23.63, -102.55], 'South Korea': [35.90, 127.76], 'Turkey': [38.96, 35.24],
  'Pakistan': [30.37, 69.34], 'Italy': [41.87, 12.56],
}

function getColor(score: number) {
  if (score >= 70) return '#8B1818'
  if (score >= 50) return '#c9a84c'
  if (score >= 30) return '#2d6a4f'
  return '#888'
}

function getLabel(score: number) {
  if (score >= 70) return 'High'
  if (score >= 50) return 'Medium'
  if (score >= 30) return 'Low'
  return 'Minimal'
}

export default function InfluenceTab({ politicianId }: { politicianId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ country: '', influence_score: '50', notes: '' })

  const { data: influence } = useQuery({ queryKey: ['influence', politicianId], queryFn: () => getInfluence(politicianId) })

  const addMutation = useMutation({
    mutationFn: addInfluence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influence', politicianId] })
      setForm({ country: '', influence_score: '50', notes: '' })
      setShowForm(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInfluence,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['influence', politicianId] })
  })

  const withCoords = influence?.filter((i: any) => COUNTRY_COORDS[i.country]) || []

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {(user as any)?.is_admin && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.4rem 1rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showForm ? 'Cancel' : '+ Add country'}
          </button>

          {showForm && (
            <div style={{ marginTop: '0.75rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Country</label>
                <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', background: 'white' }}>
                  <option value="">Select...</option>
                  {Object.keys(COUNTRY_COORDS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Score (0-100)</label>
                <input type="number" min="0" max="100" value={form.influence_score} onChange={e => setForm({ ...form, influence_score: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
              </div>
              <button
                onClick={() => addMutation.mutate({ politician_id: politicianId, country: form.country, influence_score: Number(form.influence_score), notes: form.notes })}
                disabled={!form.country}
                style={{ padding: '0.4rem 0.75rem', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {!influence?.length && <p style={{ color: '#aaa', fontSize: '0.9rem' }}>No foreign influence data recorded.</p>}

      {influence?.length > 0 && (
        <>
          <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
            {[['High (70-100)', '#8B1818'], ['Medium (50-69)', '#c9a84c'], ['Low (30-49)', '#2d6a4f'], ['Minimal (0-29)', '#888']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                <span style={{ color: '#555' }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ height: '380px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #eee', marginBottom: '1.25rem' }}>
            <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {withCoords.map((inf: any) => {
                const [lat, lng] = COUNTRY_COORDS[inf.country]
                const score = Number(inf.influence_score)
                return (
                  <CircleMarker
                    key={inf.id}
                    center={[lat, lng]}
                    radius={Math.max(10, score / 4)}
                    fillColor={getColor(score)}
                    color="white"
                    weight={1.5}
                    fillOpacity={0.75}
                  >
                    <Popup>
                      <div style={{ minWidth: '140px' }}>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>{inf.country}</p>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>
                          Score: <strong style={{ color: getColor(score) }}>{score}/100</strong>
                        </p>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#888' }}>{getLabel(score)} influence</p>
                        {inf.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#555' }}>{inf.notes}</p>}
                        {(user as any)?.is_admin && (
                          <button onClick={() => deleteMutation.mutate(inf.id)}
                            style={{ marginTop: '0.5rem', padding: '0.2rem 0.5rem', background: 'none', border: '1px solid #fcc', borderRadius: '4px', color: '#c0392b', cursor: 'pointer', fontSize: '0.75rem' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
            {influence?.map((inf: any) => (
              <div key={inf.id} style={{ padding: '0.75rem', border: `1px solid ${getColor(Number(inf.influence_score))}33`, borderRadius: '8px', borderLeft: `3px solid ${getColor(Number(inf.influence_score))}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{inf.country}</p>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: getColor(Number(inf.influence_score)) }}>{inf.influence_score}</span>
                </div>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#888' }}>{getLabel(Number(inf.influence_score))}</p>
                {inf.notes && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#555' }}>{inf.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}