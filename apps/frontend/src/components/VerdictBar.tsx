import type { VerdictCounts } from '../types'
import { VERDICTS } from '../lib/format'

interface Props {
  counts?: VerdictCounts | null
  size?: 'sm' | 'lg'
  legend?: boolean
}

export default function VerdictBar({ counts, size = 'sm', legend = false }: Props) {
  const total = Number(counts?.total || 0)
  const pct = (k: keyof VerdictCounts) => total > 0 ? (Number(counts?.[k] || 0) / total) * 100 : 0

  return (
    <div>
      <div className={`verdict-bar${size === 'lg' ? ' verdict-bar--lg' : ''}`} title={total ? `${total} verdicts` : 'No verdicts'}>
        {VERDICTS.map(v => (
          <span key={v.value} className={`verdict-bar__seg verdict-bar__seg--${v.value}`} style={{ width: `${pct(v.value)}%` }} />
        ))}
      </div>
      {legend && (
        <div className="verdict-legend">
          {VERDICTS.map(v => (
            <span key={v.value} className="verdict-legend__item">
              <span className="verdict-legend__swatch" style={{ background: v.color }} />
              {v.label} <span style={{ color: 'var(--text)' }}>{Math.round(pct(v.value))}%</span>
            </span>
          ))}
          <span className="verdict-legend__item" style={{ marginLeft: 'auto' }}>{total} verdict{total === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  )
}
