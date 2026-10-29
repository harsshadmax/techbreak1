import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setSessionExpiredHandler, tokens } from './api'
import { deviceTimezone } from './logic'
import type { User } from './types'

interface AuthState {
  user: User | null
  /** True until the stored session has been checked. */
  loading: boolean
  /** [identifier] is an email address or a username. */
  login: (identifier: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string, username?: string) => Promise<void>
  /** Signs in (or creates the account) from a Google ID token. */
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
  /** Re-fetch the user after anything that changes balance, streak or avatar. */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

/** Streaks and daily goals roll over at local midnight, so keep the server's zone in step with the device. */
async function syncTimezone(user: User): Promise<User> {
  const zone = deviceTimezone()
  if (!zone || zone === user.timezone) return user
  try {
    return (await api.patch<{ user: User }>('/me', { timezone: zone })).user
  } catch {
    return user
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null))
    let live = true
    ;(async () => {
      if (tokens.access) {
        try {
          const me = (await api.get<{ user: User }>('/me')).user
          if (live) setUser(await syncTimezone(me))
        } catch {
          if (live) setUser(null)
        }
      }
      if (live) setLoading(false)
    })()
    return () => {
      live = false
      setSessionExpiredHandler(null)
    }
  }, [])

  const authenticate = useCallback(async (path: string, body: unknown) => {
    const res = await api.post<AuthResponse>(path, body)
    tokens.save(res.accessToken, res.refreshToken)
    setUser(await syncTimezone(res.user))
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: (identifier, password) => authenticate('/auth/login', { identifier, password }),
      register: (email, password, displayName, username) => {
        const timezone = deviceTimezone()
        return authenticate('/auth/register', {
          email,
          password,
          displayName,
          ...(username ? { username } : {}),
          ...(timezone ? { timezone } : {}),
        })
      },
      loginWithGoogle: (idToken) => {
        const timezone = deviceTimezone()
        return authenticate('/auth/google', { idToken, ...(timezone ? { timezone } : {}) })
      },
      logout: async () => {
        const refreshToken = tokens.refresh
        if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => undefined)
        tokens.clear()
        setUser(null)
      },
      setUser,
      refreshUser: async () => setUser((await api.get<{ user: User }>('/me')).user),
    }),
    [user, loading, authenticate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
