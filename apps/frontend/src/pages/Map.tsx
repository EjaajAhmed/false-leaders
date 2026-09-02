import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useState } from 'react'
import { getMapLeaders, getPoliticiansMeta } from '../api/politicians'
import { VIEWS } from '../config'
import type { ViewKey } from '../config'
import ScoreRing from '../components/ScoreRing'
import { categoryLabel, leaderMeta } from '../lib/format'
import 'leaflet/dist/leaflet.css'

const COLORS = {
  clean: '#2d6a2d', watch: '#c9a84c', warn: '#8b4513', condemned: '#8b1a1a',
}
function markerColor(score: number) {
  if (score >= 75) return COLORS.clean
  if (score >= 50) return COLORS.watch
  if (score >= 25) return COLORS.warn
  return COLORS.condemned
}

function createIcon(score: number) {
  const color = markerColor(score)
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:1px solid #0a0a0a;outline:1px solid ${color};transform:rotate(45deg)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

export default function MapPage() {
  const [view, setView] = useState<ViewKey>('main')
  const [country, setCountry] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['politicians-map', view, country], queryFn: () => getMapLeaders({ view, country: country || undefined }), placeholderData: prev => prev })
  const { data: meta } = useQuery({ queryKey: ['politicians-meta'], queryFn: getPoliticiansMeta })
  const withCoords = data || []

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {isLoading && (
        <div className="loading" style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(10,10,10,0.9)', border: '1px solid var(--border-strong)', padding: '0.6rem 1rem' }}>
          <span className="spinner" /><span>Decrypting</span>
        </div>
      )}

      <div className="map-legend" style={{ left: '3.5rem', right: 'auto', top: '1rem', maxWidth: 'calc(100% - 5rem)' }}>
        <div className="chips">
          {VIEWS.map(v => (
            <button key={v.key} className={`chip${view === v.key ? ' is-active' : ''}`} onClick={() => setView(v.key)}>{v.label}</button>
          ))}
          <select className="select" style={{ width: 'auto', padding: '0.3rem 1.8rem 0.3rem 0.6rem', fontSize: '0.7rem' }} value={country} onChange={e => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {meta?.countries?.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="mono tiny dim" style={{ marginTop: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{withCoords.length} plotted</div>
      </div>

      <div className="map-legend" style={{ top: 'auto', bottom: '1.5rem' }}>
        <div className="eyebrow">TruthScore</div>
        {[['Clean · 75–90', COLORS.clean], ['Watch list · 50–74', COLORS.watch], ['Warning · 25–49', COLORS.warn], ['Condemned · 1–24', COLORS.condemned]].map(([label, color]) => (
          <div key={label} className="map-legend__item"><span className="map-legend__swatch" style={{ background: color }} />{label}</div>
        ))}
      </div>

      <MapContainer center={[25, 10]} zoom={2} minZoom={2} worldCopyJump style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((p: any) => (
          <Marker key={p.id} position={[Number(p.latitude), Number(p.longitude)]} icon={createIcon(Number(p.truth_score ?? 90))}>
            <Popup minWidth={220} maxWidth={280}>
              <div className="row row--between" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ minWidth: 0 }}>
                  <p className="display" style={{ fontSize: '1rem', lineHeight: 1.2 }}>{p.name}</p>
                  <p className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.2rem' }}>{categoryLabel(p.category)}</p>
                  <p className="muted small" style={{ marginTop: '0.1rem' }}>{leaderMeta(p)}</p>
                </div>
                {p.truth_score != null && <ScoreRing value={Number(p.truth_score)} size="sm" />}
              </div>
              {p.bio && <p className="small" style={{ margin: '0.6rem 0', color: '#b9b3a7' }}>{p.bio.length > 110 ? p.bio.slice(0, 110) + '…' : p.bio}</p>}
              <Link to={`/leaders/${p.id}`} className="btn btn--sm" style={{ marginTop: '0.4rem' }}>Open file</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
