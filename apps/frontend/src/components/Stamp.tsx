import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

interface Props {
  word?: string
  cycle?: string[]
  interval?: number
  className?: string
  style?: CSSProperties
}

/** Single-word stamp: ! WORD ! */
export default function Stamp({ word, cycle, interval = 2600, className = '', style }: Props) {
  const words = cycle && cycle.length ? cycle : [word || '']
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (words.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setInterval(() => setIndex(i => (i + 1) % words.length), interval)
      return () => clearInterval(t)
    }
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex(i => (i + 1) % words.length); setVisible(true) }, 260)
    }, interval)
    return () => clearInterval(t)
  }, [words.length, interval])

  return (
    <span className={`stamp${visible ? '' : ' stamp--out'} ${className}`} style={style} aria-live="polite">
      <span className="stamp__bang">!</span>
      <span className="stamp__word">{words[index]}</span>
      <span className="stamp__bang">!</span>
    </span>
  )
}
