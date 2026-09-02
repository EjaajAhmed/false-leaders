import { useEffect, useRef, useState } from 'react'
import { scoreColor } from '../lib/format'

interface Props {
  value: number | null | undefined
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  sublabel?: string
}

const DIMS = { sm: 44, md: 72, lg: 128, xl: 160 }
const STROKE = { sm: 3, md: 5, lg: 8, xl: 9 }
const FONT = { sm: '0.78rem', md: '1.2rem', lg: '2.2rem', xl: '2.8rem' }

export default function ScoreRing({ value, size = 'md', label, sublabel }: Props) {
  const target = value == null || isNaN(Number(value)) ? null : Math.max(0, Math.min(100, Math.round(Number(value))))
  const [mounted, setMounted] = useState(false)
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)

  const dim = DIMS[size]
  const stroke = STROKE[size]
  const r = (dim - stroke) / 2
  const c = 2 * Math.PI * r
  const color = scoreColor(target)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    if (target == null) { setDisplay(0); return }
    const start = performance.now()
    const from = 0
    const duration = 1300
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])

  const offset = mounted && target != null ? c - (target / 100) * c : c

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size === 'sm' ? 0 : '0.5rem' }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ display: 'block' }} aria-label={label ? `${label} ${target ?? 'unrated'}` : undefined}>
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="#1f1f1f" strokeWidth={stroke} />
        <circle
          cx={dim / 2} cy={dim / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={c} strokeDashoffset={offset}
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2, 0.7, 0.2, 1), stroke 0.4s ease' }}
        />
        <text
          x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: FONT[size], fill: target == null ? 'var(--dim)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}
        >
          {target == null ? '—' : display}
        </text>
      </svg>
      {label && size !== 'sm' && (
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow">{label}</div>
          {sublabel && <div className="mono tiny" style={{ color, marginTop: '0.2rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sublabel}</div>}
        </div>
      )}
    </div>
  )
}
