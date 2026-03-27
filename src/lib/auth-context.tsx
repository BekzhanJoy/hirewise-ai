'use client'

import { apiSend } from './local-api'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface LocalUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export interface LocalSession {
  user: LocalUser
}

interface AuthContextType {
  user: LocalUser | null
  session: LocalSession | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateSessionUser: (nextUser: LocalUser) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const STORAGE_KEY = 'hirewise-local-session'

function readStoredSession(): LocalSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalSession
  } catch {
    return null
  }
}

function storeSession(session: LocalSession | null) {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [session, setSession] = useState<LocalSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const existing = readStoredSession()
    setSession(existing)
    setUser(existing?.user ?? null)
    setLoading(false)

    const onStorage = () => {
      const next = readStoredSession()
      setSession(next)
      setUser(next?.user ?? null)
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      await apiSend('/api/auth/register', 'POST', { email, password, fullName })
      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to create account') }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiSend<{ user: LocalUser }>('/api/auth/login', 'POST', { email, password })
      const nextSession: LocalSession = { user: data.user }
      storeSession(nextSession)
      setSession(nextSession)
      setUser(nextSession.user)
      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Failed to sign in') }
    }
  }

  const signOut = async () => {
    storeSession(null)
    setSession(null)
    setUser(null)
    try {
      await apiSend('/api/auth/logout', 'POST')
    } catch {
      // ignore
    }
  }

  const updateSessionUser = (nextUser: LocalUser) => {
    const nextSession: LocalSession = { user: nextUser }
    storeSession(nextSession)
    setSession(nextSession)
    setUser(nextUser)
  }

  const value = useMemo(() => ({ user, session, loading, signUp, signIn, signOut, updateSessionUser }), [user, session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
