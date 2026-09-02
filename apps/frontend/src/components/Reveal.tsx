import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface Props { children: ReactNode; delay?: number; className?: string; style?: CSSProperties; as?: 'div' | 'section' }

/** Fades content in the first time it scrolls into view. */
export default function Reveal({ children, delay = 0, className = '', style, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const obs = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const Tag = as
  return (
    <Tag ref={ref as any} className={`reveal${visible ? ' is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </Tag>
  )
}
