import { createContext, useContext, useState, useCallback } from 'react'
import axios from 'axios'

/**
 * AuthContext — stores user info and tokens in localStorage.
 * Provides: user, login, logout, isAuthenticated, isAdmin.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    // Backend returns user info as flat fields alongside the tokens
    const userInfo = { id: data.userId, name: data.name, email: data.email, role: data.role }
    localStorage.setItem('user', JSON.stringify(userInfo))
    setUser(userInfo)
    return userInfo
  }, [])

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      if (token) {
        await axios.post('/api/auth/logout', { refreshToken }, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      // Ignore errors — clear local state regardless
    } finally {
      localStorage.clear()
      setUser(null)
    }
  }, [])

  const isAuthenticated = Boolean(user)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
