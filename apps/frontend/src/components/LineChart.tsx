export interface ChartSeries {
  key: string
  label: string
  points: { x: number; y: number }[]
  highlight?: boolean
}

interface Props {
  series: ChartSeries[]
  baseline?: number
  marker?: { x: number; label: string }
  yFormat?: (v: number) => string
  xFormat?: (x: number) => string
  /** x positions to flag on the highlighted series (drawn as red squares) */
  marks?: number[]
  caption: string
  ariaLabel: string
}

import { useCallback, useEffect, useState } from 'react'

const TONES = ['rgba(240,227,190,0.95)', 'rgba(240,227,190,0.6)', 'rgba(240,227,190,0.38)', 'rgba(240,227,190,0.22)']

/** Monochrome line chart. Red is reserved for the highlighted series. Direct labels, no legend needed. */
export default function LineChart({ series, baseline, marker, yFormat = v => String(Math.round(v)), xFormat = x => String(x), marks = [], caption, ariaLabel }: Props) {
  // Narrow screens get a smaller drawing box so labels stay legible at 375px.
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [narrow, setNarrow] = useState(false)
  const ref = useCallback((node: HTMLElement | null) => setEl(node), [])
  useEffect(() => {
    if (!el) return
    const update = () => setNarrow(el.clientWidth < 520)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  const W = narrow ? 400 : 640, H = narrow ? 300 : 260
  const PAD = narrow ? { l: 38, r: 96, t: 16, b: 26 } : { l: 44, r: 128, t: 14, b: 28 }
  const FS = narrow ? 11 : 9
  const all = series.flatMap(s => s.points)
  if (all.length === 0) return null
  const xs = all.map(p => p.x), ys = all.map(p => p.y).concat(baseline != null ? [baseline] : [])
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  let yMin = Math.min(...ys), yMax = Math.max(...ys)
  if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1 }
  const padY = (yMax - yMin) * 0.12
  yMin -= padY; yMax += padY
  const sx = (x: number) => PAD.l + (xMax === xMin ? 0.5 : (x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r)
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const ticks = [yMin + padY, (yMin + yMax) / 2, yMax - padY]
  const years = Array.from(new Set(xs)).sort((a, b) => a - b)
  const step = years.length > 8 ? Math.ceil(years.length / (narrow ? 4 : 6)) : 1
  const xTicks = years.filter((_, i) => i % step === 0 || i === years.length - 1)
  let toneIdx = 0

  // Avoid overlapping end labels
  const ends = series.map(s => ({ s, last: s.points[s.points.length - 1] })).filter(e => e.last).sort((a, b) => sy(a.last.y) - sy(b.last.y))
  const labelY: number[] = []
  const gap = FS + 4
  for (const e of ends) { let y = sy(e.last.y); if (labelY.length && y - labelY[labelY.length - 1] < gap) y = labelY[labelY.length - 1] + gap; labelY.push(y) }

  return (
    <figure className="chart" style={{ margin: 0 }} ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="rgba(240,227,190,0.1)" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(t)} fontSize={FS} fill="#A89D83" textAnchor="end" dominantBaseline="middle" fontFamily="JetBrains Mono, monospace">{yFormat(t)}</text>
          </g>
        ))}
        {baseline != null && (
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(baseline)} y2={sy(baseline)} stroke="rgba(240,227,190,0.45)" strokeWidth="1" strokeDasharray="3 4" />
        )}
        {marker && marker.x >= xMin && marker.x <= xMax && (
          <g>
            <line x1={sx(marker.x)} x2={sx(marker.x)} y1={PAD.t} y2={H - PAD.b} stroke="#8E2020" strokeWidth="1" />
            <text x={sx(marker.x) + 4} y={PAD.t + 9} fontSize={FS - 0.5} fill="#8E2020" fontFamily="JetBrains Mono, monospace" letterSpacing="1">{marker.label.toUpperCase()}</text>
          </g>
        )}
        {xTicks.map(x => (
          <text key={x} x={sx(x)} y={H - 8} fontSize={FS} fill="#A89D83" textAnchor="middle" fontFamily="JetBrains Mono, monospace">{xFormat(x)}</text>
        ))}
        {series.map(s => {
          const color = s.highlight ? '#8E2020' : TONES[Math.min(toneIdx++, TONES.length - 1)]
          const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')
          return <path key={s.key} d={d} fill="none" stroke={color} strokeWidth={s.highlight ? 2.2 : 1.6} strokeLinejoin="round" />
        })}
        {marks.map(mx => {
          const hs = series.find(s => s.highlight) || series[0]
          const pt = hs?.points.find(p => p.x === mx)
          if (!pt) return null
          return <rect key={`m${mx}`} x={sx(pt.x) - 4} y={sy(pt.y) - 4} width={8} height={8} fill="#8E2020" />
        })}
        {ends.map((e, i) => (
          <text key={e.s.key} x={W - PAD.r + 8} y={labelY[i]} fontSize={FS} fill={e.s.highlight ? '#c8684e' : '#F0E3BE'} dominantBaseline="middle" fontFamily="JetBrains Mono, monospace">
            {e.s.label} {yFormat(e.last.y)}
          </text>
        ))}
      </svg>
      <figcaption className="section__caption">{caption}</figcaption>
    </figure>
  )
}
