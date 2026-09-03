import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

interface Props {
  words?: string[]
  interval?: number
  className?: string
  style?: CSSProperties
}

export const STAMP_WORDS = ['POWER', 'WRATH', 'GREED']

/**
 * ! WORD !  — the marks never move: every word is laid out in the same slot
 * (hidden), so the slot is as wide as the widest word and the current word is centred in it.
 */
export default function Stamp({ words = STAMP_WORDS, interval = 2600, className = '', style }: Props) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (words.length < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setInterval(() => {
      if (reduce) { setIndex(i => (i + 1) % words.length); return }
      setVisible(false)
      setTimeout(() => { setIndex(i => (i + 1) % words.length); setVisible(true) }, 260)
    }, interval)
    return () => clearInterval(t)
  }, [words, interval])

  return (
    <span className={`stamp${visible ? '' : ' stamp--out'} ${className}`} style={style} aria-live="polite">
      <span className="stamp__bang" aria-hidden="true">!</span>
      <span className="stamp__slot">
        {words.map((w, i) => (
          <span key={w} className="stamp__word" style={{ visibility: i === index ? 'visible' : 'hidden' }} aria-hidden={i !== index}>{w}</span>
        ))}
      </span>
      <span className="stamp__bang" aria-hidden="true">!</span>
    </span>
  )
}
