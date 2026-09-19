import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

const SITE = 'FalseLeaders'
/** Sets the tab title to "<title> · FalseLeaders" while the page is mounted. */
export function useTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE
    return () => { document.title = SITE }
  }, [title])
}

/** Where to send someone after signing in: the page they came from, never an auth page. */
export function loginLink(pathname: string, search = '') {
  const from = pathname + search
  return /^\/(login|register|welcome|verified|pending-verification)/.test(from) || from === '/' ? '/login' : `/login?next=${encodeURIComponent(from)}`
}
export function nextAfterLogin(search: string): string {
  const next = new URLSearchParams(search).get('next') || '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/** /login link that brings the member back to the current page. */
export function useLoginHref() { const { pathname, search } = useLocation(); return loginLink(pathname, search) }
