import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { updateTheme } from '../api/auth'
import { THEMES, applyTheme, useTheme } from '../lib/theme'
import type { ThemeKey } from '../lib/theme'

/**
 * Theme switcher. Applies immediately, persists to localStorage always and to the
 * member's profile when signed in. `compact` renders a quiet select for the sidebar.
 */
export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const theme = useTheme()
  const { user, loginUser, token } = useAuth()
  const save = useMutation({ mutationFn: updateTheme })

  const pick = (key: ThemeKey) => {
    applyTheme(key)
    if (user && token) {
      loginUser({ ...user, theme: key }, token)
      save.mutate(key)
    }
  }

  if (compact) {
    return (
      <label className="theme-compact">
        <span className="label">Theme</span>
        <select className="select select--quiet" value={theme} onChange={e => pick(e.target.value as ThemeKey)} aria-label="Theme">
          {THEMES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>
    )
  }

  return (
    <div className="theme-grid" role="radiogroup" aria-label="Theme">
      {THEMES.map(t => (
        <button key={t.key} type="button" role="radio" aria-checked={theme === t.key} className={`theme-option${theme === t.key ? ' is-active' : ''}`} onClick={() => pick(t.key)} data-theme-preview={t.key}>
          <span className="theme-option__swatch" aria-hidden="true"><i /><i /><i /></span>
          <span className="theme-option__name">{t.label}</span>
          <span className="theme-option__blurb">{t.blurb}</span>
        </button>
      ))}
    </div>
  )
}
