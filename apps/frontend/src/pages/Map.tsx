import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { getPoliticians } from '../api/politicians'
import TruthScore from '../components/TruthScore'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function getMarkerColor(score: number) {
  if (score >= 75) return '#1e7e34'
  if (score >= 40) return '#b8860b'
  return '#c0392b'
}

function createColoredIcon(score: number) {
  const color = getMarkerColor(score)
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        background: ${color};
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36]
  })
}

export default function MapPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['politicians-map'],
    queryFn: () => getPoliticians({ limit: 1000 })
  })
  const withCoords = data?.politicians?.filter((p: any) => p.latitude && p.longitude) || []

  return (
    <div style={{ height: 'calc(100vh - 65px)', width: '100%', position: 'relative' }}>
      {isLoading && (
        <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          Loading politicians...
        </div>
      )}

      <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000, background: 'white', padding: '0.75rem 1rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '0.85rem' }}>
        <p style={{ margin: '0 0 0.4rem', fontWeight: 500 }}>TruthScore</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#1e7e34' }}/>
            <span style={{ color: '#555' }}>Clean (75–100)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#b8860b' }}/>
            <span style={{ color: '#555' }}>Suspect (40–74)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#c0392b' }}/>
            <span style={{ color: '#555' }}>Corrupt (0–39)</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={[56.1304, -106.3468]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {withCoords.map((p: any) => (
          <Marker
            key={p.id}
            position={[Number(p.latitude), Number(p.longitude)]}
            icon={createColoredIcon(Number(p.truth_score ?? 50))}
          >
            <Popup minWidth={220} maxWidth={280}>
              <div style={{ padding: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>{p.name}</p>
                    <p style={{ margin: '0.2rem 0 0', color: '#888', fontSize: '0.8rem' }}>{p.party} — {p.region}</p>
                    <p style={{ margin: '0.1rem 0 0', color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>{p.position}</p>
                  </div>
                  {p.truth_score != null && <TruthScore score={Number(p.truth_score)} size="sm" />}
                </div>

                {p.bio && (
                  <p style={{ margin: '0.6rem 0', fontSize: '0.8rem', color: '#555', lineHeight: '1.4' }}>
                    {p.bio.length > 100 ? p.bio.slice(0, 100) + '...' : p.bio}
                  </p>
                )}

                <Link
                  to={`/politicians/${p.id}`}
                  style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.35rem 0.9rem', background: '#1a1a1a', color: 'white', borderRadius: '20px', textDecoration: 'none', fontSize: '0.8rem' }}
                >
                  View profile
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}