import { useQuery } from '@tanstack/react-query'
import { useTitle } from '../lib/hooks'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { cssVar, useTheme } from '../lib/theme'
import Dropdown from '../components/Dropdown'
import L from 'leaflet'
import { useState } from 'react'
import { getMapLeaders, getPoliticiansMeta } from '../api/politicians'
import { VIEWS } from '../config'
import type { ViewKey } from '../config'
import RatingRing from '../components/RatingRing'
import { categoryLabel, leaderMeta } from '../lib/format'
import 'leaflet/dist/leaflet.css'


function markerColor(score: number | null) {
  if (score == null) return cssVar('--rating-0')
  if (score >= 75) return cssVar('--rating-4')
  if (score >= 50) return cssVar('--rating-3')
  if (score >= 25) return cssVar('--rating-2')
  return cssVar('--rating-1')
}

function createIcon(score: number | null) {
  const color = markerColor(score)
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:1px solid ${cssVar('--surface')};outline:1px solid ${color};transform:rotate(45deg)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

export default function MapPage() {
  useTitle('Map')
  const theme = useTheme()
  const [view, setView] = useState<ViewKey>('main')
  const [country, setCountry] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['politicians-map', view, country], queryFn: () => getMapLeaders({ view: country ? 'all' : view, country: country || undefined }), placeholderData: prev => prev })
  const { data: meta } = useQuery({ queryKey: ['politicians-meta'], queryFn: getPoliticiansMeta })
  const withCoords = data || []

  return (
    <div className="map-page">
      {isLoading && (
        <div className="loading map-loading" style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--overlay)', border: '1px solid var(--border-strong)', padding: '0.6rem 1rem' }}>
          <span className="spinner" /><span>Decrypting</span>
        </div>
      )}

      <div className="map-legend" style={{ left: '3.5rem', right: 'auto', top: '1rem', maxWidth: 'calc(100% - 16rem)', padding: '0.4rem 1rem 0.6rem' }}>
        <div className="viewbar" style={{ borderBottom: 0, paddingBottom: 0, marginBottom: 0, gap: '0.5rem 1.5rem' }}>
          <div className="viewbar__views" style={{ gap: '1.25rem' }}>
            {VIEWS.filter(v => v.key !== 'all').map(v => (
              <button key={v.key} className={`chip${!country && view === v.key ? ' is-active' : ''}`} onClick={() => { setView(v.key); setCountry('') }}>{v.label}</button>
            ))}
          </div>
          <div className="viewbar__narrow">
            <Dropdown placeholder="Country" searchable value={country} onChange={setCountry} options={[{ value: '', label: 'Every country' }, ...((meta?.countries || []) as string[]).map((c: string) => ({ value: c, label: c }))]} />
            <span className="mono tiny dim" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{withCoords.length} plotted</span>
          </div>
        </div>
      </div>

      <div className="map-legend map-legend--bottom" style={{ top: 'auto', bottom: '1.5rem' }}>
        <div className="eyebrow">Community rating</div>
        {[['Trusted · 75–100', 'var(--rating-4)'], ['Divided · 50–74', 'var(--rating-3)'], ['Distrusted · 25–49', 'var(--rating-2)'], ['Condemned · 0–24', 'var(--rating-1)'], ['Unrated', 'var(--rating-0)']].map(([label, color]) => (
          <div key={label} className="map-legend__item"><span className="map-legend__swatch" style={{ background: color }} />{label}</div>
        ))}
      </div>

      <MapContainer center={[25, 10]} zoom={2} minZoom={2} worldCopyJump style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ'
          key={theme}
          url={theme === 'samizdat' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}' : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'}
          maxZoom={16}
        />
        <TileLayer
          key={`labels-${theme}`}
          url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${theme === 'samizdat' ? 'World_Light_Gray_Reference' : 'World_Dark_Gray_Reference'}/MapServer/tile/{z}/{y}/{x}`}
          maxZoom={16}
        />
        {withCoords.map((p: any) => (
          <Marker key={`${p.id}-${theme}`} position={[Number(p.latitude), Number(p.longitude)]} icon={createIcon(p.rating_avg == null ? null : Number(p.rating_avg))}>
            <Popup minWidth={220} maxWidth={280}>
              <div className="row row--between" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
                {p.photo_url && <img className="photo photo--popup" src={p.photo_url} alt="" />}
                <div style={{ minWidth: 0 }}>
                  <p className="display" style={{ fontSize: '1rem', lineHeight: 1.2 }}>{p.name}</p>
                  <p className="mono tiny" style={{ color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.2rem' }}>{categoryLabel(p.category)}</p>
                  <p className="muted small" style={{ marginTop: '0.1rem' }}>{leaderMeta(p)}</p>
                </div>
                <RatingRing value={p.rating_avg == null ? null : Number(p.rating_avg)} size="sm" />
              </div>
              {p.bio && <p className="small" style={{ margin: '0.6rem 0', color: 'var(--muted)' }}>{p.bio.length > 110 ? p.bio.slice(0, 110) + '…' : p.bio}</p>}
              <Link to={`/leaders/${p.id}`} className="btn btn--sm" style={{ marginTop: '0.4rem' }}>Open file</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
