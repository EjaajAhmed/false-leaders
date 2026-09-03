import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  id: string
  label: string
  headline: ReactNode
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  /** When this changes to true the section opens and scrolls into view. */
  open?: boolean
}

/**
 * Progressive disclosure. The collapsed state (label, headline, one sentence)
 * must be enough to understand the section on its own.
 */
export default function Section({ id, label, headline, summary, children, defaultOpen = false, open }: Props) {
  const [isOpen, setOpen] = useState(defaultOpen)
  const ref = useRef<HTMLElement>(null)
  const bodyId = useId()

  useEffect(() => {
    if (open) {
      setOpen(true)
      const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  return (
    <section className="section" id={id} ref={ref}>
      <button type="button" className="section__head" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{label}</div>
          <div className="section__headline">{headline}</div>
          <div className="section__summary">{summary}</div>
        </div>
        <span className="section__toggle" aria-hidden="true">{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>
      {isOpen && <div className="section__body" id={bodyId}>{children}</div>}
    </section>
  )
}
