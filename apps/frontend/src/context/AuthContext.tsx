import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface User {
  id: string
  email: string
  username: string
  is_admin?: boolean
  email_verified?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  loginUser: (user: User, token: string) => void
  logout: () => void
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
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token')
  })

  const loginUser = (user: User, token: string) => {
    setUser(user)
    setToken(token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}