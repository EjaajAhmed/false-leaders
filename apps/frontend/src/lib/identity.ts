import { useCallback, useEffect, useState } from 'react'

const KEY = 'fl_post_as'

function read(): boolean {
  try { return localStorage.getItem(KEY) === 'prole' } catch { return false }
}

/** Persisted preference: post anonymously (as Prole) or as @username. */
export function usePostAsProle(): [boolean, (v: boolean) => void] {
  const [anon, setAnon] = useState<boolean>(read)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setAnon(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const set = useCallback((v: boolean) => {
    setAnon(v)
    try { localStorage.setItem(KEY, v ? 'prole' : 'user') } catch { /* private mode */ }
  }, [])

  return [anon, set]
}
