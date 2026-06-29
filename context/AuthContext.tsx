'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  username: string
  email: string
  role: string
  orgs: string[]
  github_connected?: boolean
}

interface AuthContextValue {
  user: AuthUser | null | undefined  // undefined = loading, null = not logged in
  setUser: (user: AuthUser | null) => void
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  /** Returns true if the user's role is in the provided list */
  hasRole: (roles: string[]) => boolean
  /** Returns true if the user belongs to the given org */
  hasOrg: (org: string) => boolean
  isLoading: boolean // 👈 1. ADDED TO INTERFACE TO RESOLVE TYPE ERROR
  /** Set when redirected back from an SSO provider with ?error=..., e.g. "domain_not_allowed" */
  ssoError: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

const getRestEndpoint = async (): Promise<string> => {
  try {
    const res = await fetch('/config')
    const config = await res.json()
    return config.restEndpoint || 'http://localhost:3000/api/v1'
  } catch {
    return 'http://localhost:3000/api/v1'
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // undefined = still checking session, null = confirmed not logged in
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [ssoError, setSsoError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser({
          username: data.username,
          email: data.email,
          role: data.role,
          orgs: data.orgs ?? [],
          github_connected: data.github_connected,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh()

    // After an OIDC/OAuth2 redirect (Google, GitHub, ...), the backend
    // appends ?login=success (cookie already set - just need to pick up the
    // session) or ?error=<reason> (e.g. domain_not_allowed, invalid_oauth_state)
    // to the return_to URL. Strip these so a refresh doesn't replay them.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const error = params.get('error')
      if (error) {
        setSsoError(error)
      }
      if (params.has('login') || params.has('error')) {
        params.delete('login')
        params.delete('error')
        const cleanQuery = params.toString()
        const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '')
        window.history.replaceState({}, '', cleanUrl)
      }
    }
  }, [refresh])

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const endpoint = await getRestEndpoint()
      const res = await fetch(`${endpoint}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) return false
      const data = await res.json()
      setUser({
        username: data.username,
        email: data.email,
        role: data.role,
        orgs: data.orgs ?? [],
        github_connected: data.github_connected,
      })
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const endpoint = await getRestEndpoint()
      await fetch(`${endpoint}/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      setUser(null)
    }
  }, [])

  const hasRole = useCallback(
    (roles: string[]) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user]
  )

  const hasOrg = useCallback(
    (org: string) => {
      if (!user) return false
      return user.orgs.includes(org.toLowerCase())
    },
    [user]
  )

  // 2. COMPUTE THE LOADING FLAG DYNAMICALLY
  const isLoading = user === undefined

  // 3. EXPOSE ISLOADING THROUGH THE VALUE MAP
  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, refresh, hasRole, hasOrg, isLoading, ssoError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default AuthContext