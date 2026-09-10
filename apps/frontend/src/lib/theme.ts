import { useSyncExternalStore } from 'react'

export type ThemeKey = '1984' | 'samizdat' | 'echelon' | 'blackout'
export const THEMES: { key: ThemeKey; label: string; blurb: string; meta: string }[] = [
  { key: '1984', label: '1984 Classic', blurb: 'Oxblood and warm off-white.', meta: '#14120F' },
  { key: 'samizdat', label: 'Samizdat Light', blurb: 'Paper, ink and stamp red.', meta: '#F2EDE0' },
  { key: 'echelon', label: 'Echelon', blurb: 'Phosphor terminal. Mono type throughout.', meta: '#05090A' },
  { key: 'blackout', label: "Blackout '77", blurb: 'Maximum contrast. One signal colour.', meta: '#000000' },
]
export const DEFAULT_THEME: ThemeKey = '1984'
const STORAGE_KEY = 'fl_theme'
const listeners = new Set<() => void>()

export const isTheme = (v: unknown): v is ThemeKey => THEMES.some(t => t.key === v)

/** The theme currently on <html>; index.html sets it before first paint from localStorage. */
export function readTheme(): ThemeKey {
  const attr = document.documentElement.getAttribute('data-theme')
  if (isTheme(attr)) return attr
  try { const stored = localStorage.getItem(STORAGE_KEY); if (isTheme(stored)) return stored } catch { /* private mode */ }
  return DEFAULT_THEME
}

export function applyTheme(theme: ThemeKey) {
  if (!isTheme(theme)) theme = DEFAULT_THEME
  const root = document.documentElement
  if (theme === DEFAULT_THEME) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find(t => t.key === theme)!.meta)
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  listeners.forEach(fn => fn())
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

/** Current theme, re-rendering subscribers when it changes. */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME)
}

/** Resolved value of a CSS custom property, for canvases and Leaflet markers that cannot use var(). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
