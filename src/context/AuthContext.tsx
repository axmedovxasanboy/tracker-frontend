import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api/auth'
import { tokenStore } from '../api/tokens'
import { setAuthLostCallback } from '../api/client'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  needsSignup: boolean
  username: string | null
  login: (username: string, password: string) => Promise<void>
  signup: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [needsSignup, setNeedsSignup] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  const refreshStatus = useCallback(() => {
    authApi.status().then((r) => setNeedsSignup(r.data.needsSignup)).catch(() => {})
  }, [])

  // When a token refresh fails mid-session, the axios interceptor calls this.
  useEffect(() => {
    setAuthLostCallback(() => {
      setUsername(null)
      setStatus('unauthenticated')
      refreshStatus()
    })
  }, [refreshStatus])

  // On load: validate an existing token via /me (the interceptor silently refreshes a stale
  // access token). Otherwise resolve needsSignup BEFORE leaving 'loading' — so the first
  // render of the auth screens redirects to signup vs login correctly (no flash of /login
  // that then sticks because the catch-all no longer matches).
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      if (tokenStore.getAccess()) {
        try {
          const r = await authApi.me()
          if (!cancelled) { setUsername(r.data.username); setStatus('authenticated') }
          return
        } catch {
          tokenStore.clear()
        }
      }
      try {
        const s = await authApi.status()
        if (!cancelled) setNeedsSignup(s.data.needsSignup)
      } catch {
        // status unreachable → default to login
      }
      if (!cancelled) setStatus('unauthenticated')
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const res = await authApi.login(u, p)
    tokenStore.set(res.data.accessToken, res.data.refreshToken)
    setUsername(u)
    setStatus('authenticated')
  }, [])

  const signup = useCallback(async (u: string, p: string) => {
    const res = await authApi.signup(u, p)
    tokenStore.set(res.data.accessToken, res.data.refreshToken)
    setUsername(u)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUsername(null)
    setStatus('unauthenticated')
    refreshStatus()
  }, [refreshStatus])

  return (
    <AuthContext.Provider value={{ status, needsSignup, username, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
