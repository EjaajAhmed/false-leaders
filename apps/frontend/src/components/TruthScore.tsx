interface TruthScoreProps {
    score: number
    size?: 'sm' | 'md' | 'lg'
  }
  
  export default function TruthScore({ score, size = 'md' }: TruthScoreProps) {
    const dimensions = { sm: 56, md: 80, lg: 110 }
    const strokeWidths = { sm: 4, md: 5, lg: 7 }
    const fontSizes = { sm: '0.75rem', md: '1rem', lg: '1.4rem' }
    const labelSizes = { sm: '0.5rem', md: '0.6rem', lg: '0.75rem' }
  
    const dim = dimensions[size]
    const stroke = strokeWidths[size]
    const radius = (dim - stroke * 2) / 2
    const circumference = 2 * Math.PI * radius
    const progress = Math.max(0, Math.min(100, score))
    const offset = circumference - (progress / 100) * circumference
  
    const color = score >= 75 ? '#1e7e34' : score >= 40 ? '#b8860b' : '#c0392b'
    const trackColor = score >= 75 ? '#e6f4ea' : score >= 40 ? '#fef9e7' : '#fce8e8'
    const label = score >= 75 ? 'Clean' : score >= 40 ? 'Suspect' : 'Corrupt'
  
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
        <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              transform: 'rotate(90deg)',
              transformOrigin: 'center',
              fontSize: fontSizes[size],
              fontWeight: 600,
              fill: color,
              fontFamily: 'inherit'
            }}
          >
            {score ?? '—'}
          </text>
        </svg>
        <span style={{ fontSize: labelSizes[size], color, fontWeight: 500, letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
    )
  }