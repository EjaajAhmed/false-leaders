import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { updateTheme } from '../api/auth'
import { THEMES, applyTheme, useTheme } from '../lib/theme'
import type { ThemeKey } from '../lib/theme'
import Dropdown from './Dropdown'

const Swatch = ({ k }: { k: ThemeKey }) => <span className="theme-swatch" data-theme-preview={k}><i /><i /><i /></span>

/**
 * Theme switcher. Applies immediately, persists to localStorage always and to the
 * member's profile when signed in. `compact` renders the top-bar dropdown.
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
      <Dropdown
        className="theme-dd"
        placeholder="Theme"
        value={theme}
        align="right"
        icon={<><Swatch k={theme} /><span className="theme-dd__name">{THEMES.find(t => t.key === theme)?.label}</span></>}
        options={THEMES.map(t => ({ value: t.key, label: t.label, hint: t.blurb, swatch: <Swatch k={t.key} /> }))}
        onChange={v => pick(v as ThemeKey)}
      />
    )
  }

  return (
    <div className="theme-grid" role="radiogroup" aria-label="Theme">
      {THEMES.map(t => (
        <button key={t.key} type="button" role="radio" aria-checked={theme === t.key} className={`theme-option${theme === t.key ? ' is-active' : ''}`} onClick={() => pick(t.key)}>
          <Swatch k={t.key} />
          <span className="theme-option__name">{t.label}</span>
          <span className="theme-option__blurb">{t.blurb}</span>
        </button>
      ))}
    </div>
  )
}
