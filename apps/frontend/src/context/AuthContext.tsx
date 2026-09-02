import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getMe } from '../api/auth'

export interface User {
  id: string
  email: string
  username: string
  prole_number?: number | null
  is_admin?: boolean
  email_verified?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  loginUser: (user: User, token: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  const loginUser = useCallback((u: User, t: string) => {
    setUser(u)
    setToken(t)
    localStorage.setItem('user', JSON.stringify(u))
    localStorage.setItem('token', t)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }, [])

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) return
    try {
      const me = await getMe()
      const next: User = {
        id: me.id, email: me.email, username: me.username,
        prole_number: me.prole_number, is_admin: !!me.is_admin, email_verified: !!me.email_verified,
      }
      loginUser(next, me.token || localStorage.getItem('token')!)
    } catch (err: any) {
      if (err?.response?.status === 401) logout()
    }
  }, [loginUser, logout])

  // Sync session with the server on load (picks up prole number, verification, admin flag).
  useEffect(() => { refreshUser() }, [refreshUser])

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
