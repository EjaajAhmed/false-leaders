import { useEffect, useState } from 'react'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export default function TruthScore({ score, size = 'md' }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [displayScore, setDisplayScore] = useState(0)

  const dims = { sm: 48, md: 64, lg: 96 }
  const fontSizes = { sm: '0.75rem', md: '1rem', lg: '1.5rem' }
  const labelSizes = { sm: '0.45rem', md: '0.55rem', lg: '0.7rem' }
  const strokeWidths = { sm: 4, md: 5, lg: 7 }

  const dim = dims[size]
  const strokeWidth = strokeWidths[size]
  const radius = (dim - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const cx = dim / 2
  const cy = dim / 2

  const getColor = (s: number) => {
    if (s >= 75) return '#2e7d32'
    if (s >= 40) return '#c9a84c'
    return '#c0392b'
  }

  useEffect(() => {
    setAnimatedScore(0)
    setDisplayScore(0)
    const duration = 1200
    const steps = 60
    const stepTime = duration / steps
    const increment = score / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(score, Math.round(increment * step))
      setAnimatedScore(current)
      setDisplayScore(current)
      if (step >= steps) clearInterval(timer)
    }, stepTime)

    return () => clearInterval(timer)
  }, [score])

  const dashOffset = circumference - (animatedScore / 100) * circumference
  const color = getColor(score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
      <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="#e0dbd2"
          strokeWidth={strokeWidth}
        />
        {/* Animated score arc */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.016s linear, stroke 0.3s ease' }}
        />
        {/* Score text — counter-rotate so it reads correctly */}
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            transform: `rotate(90deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            fill: color,
            fontSize: fontSizes[size],
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}
        >
          {displayScore}
        </text>
      </svg>
      {size !== 'sm' && (
        <span style={{
          fontSize: labelSizes[size],
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: 'var(--font-body)'
        }}>
          TruthScore
        </span>
      )}
    </div>
  )
}