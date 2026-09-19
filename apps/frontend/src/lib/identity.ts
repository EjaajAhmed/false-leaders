import { useCallback, useEffect, useState } from 'react'

const KEY = 'fl_post_as'

/** Anonymous unless the member has explicitly chosen to post as @username: the site promises "anonymous by default". */
function read(): boolean {
  try { return localStorage.getItem(KEY) !== 'user' } catch { return true }
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
