import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface DropdownOption { value: string; label: string; hint?: string; swatch?: ReactNode }

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** Text on the trigger when nothing is chosen, and the accessible name. */
  placeholder: string
  /** Shows a filter box; use for long lists such as countries. */
  searchable?: boolean
  align?: 'left' | 'right'
  /** Icon-only trigger (label still read by screen readers). */
  icon?: ReactNode
  className?: string
}

/**
 * Themed replacement for <select>. The native popup cannot be styled, so this
 * renders its own list in the site's panel colours and type.
 */
export default function Dropdown({ value, options, onChange, placeholder, searchable = false, align = 'left', icon, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  useEffect(() => { if (!open) setQ('') }, [open])

  const shown = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options

  return (
    <div ref={ref} className={`dd${open ? ' is-open' : ''}${current && current.value ? ' has-value' : ''} ${className}`}>
      <button type="button" className={`dd__btn${icon ? ' dd__btn--icon' : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={icon ? `${placeholder}: ${current?.label ?? 'none'}` : undefined} onClick={() => setOpen(o => !o)}>
        {icon ? icon : <><span className="dd__value">{current && current.value ? current.label : placeholder}</span><span className="dd__caret" aria-hidden="true" /></>}
      </button>
      {open && (
        <div className={`dd__menu dd__menu--${align}`} role="listbox" id={listId} aria-label={placeholder}>
          {icon && <div className="dd__head eyebrow">{placeholder}</div>}
          {searchable && <input className="dd__search" autoFocus placeholder={`Filter ${placeholder.toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} aria-label={`Filter ${placeholder}`} />}
          <div className="dd__list">
            {shown.length === 0 && <div className="dd__empty">Nothing matches.</div>}
            {shown.map(o => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value} className={`dd__item${o.value === value ? ' is-active' : ''}`} onClick={() => { onChange(o.value); setOpen(false) }}>
                {o.swatch && <span className="dd__swatch" aria-hidden="true">{o.swatch}</span>}
                <span className="dd__label">{o.label}{o.hint && <span className="dd__hint">{o.hint}</span>}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
