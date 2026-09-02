import type { ScorePoint } from '../types'
import { scoreColor } from '../lib/format'

interface Props { points: ScorePoint[]; height?: number }

export default function Sparkline({ points, height = 56 }: Props) {
  const width = 320
  const pad = 4
  if (!points || points.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center' }}>
        <span className="mono tiny dim" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>Insufficient history</span>
      </div>
    )
  }
  const values = points.map(p => p.s)
  const min = Math.min(...values, 100)
  const max = Math.max(...values, 0)
  const lo = Math.max(0, Math.floor(min - 5))
  const hi = Math.min(100, Math.ceil(max + 5))
  const span = Math.max(1, hi - lo)
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.s).toFixed(1)}`).join(' ')
  const area = `${d} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`
  const last = points[points.length - 1]
  const color = scoreColor(last.s)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={x(points.length - 1)} cy={y(last.s)} r={2.5} fill={color} />
    </svg>
  )
}
