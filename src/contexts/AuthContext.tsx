import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Usuario | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  signIn: async () => {},
  signOut: async () => {},
  loading: true,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(() => {
    try {
      const cached = localStorage.getItem('user_profile')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  // Ref para evitar que getInitialSession pise un login que ya ocurrió
  const authEventFired = useRef(false)

  useEffect(() => {
    let mounted = true

    // Timeout de seguridad: si Supabase no responde en 6s, desbloquear la app
    const loadingTimeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 6000)

    // onAuthStateChange es la fuente de verdad principal
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return

        authEventFired.current = true
        clearTimeout(loadingTimeout)

        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          // Si ya hay un perfil en cache para este correo, usarlo mientras carga
          await fetchProfile(newSession.user.email)
        } else {
          localStorage.removeItem('user_profile')
          setProfile(null)
          setLoading(false)
        }
      }
    )

    async function getInitialSession() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (authEventFired.current || !mounted) return

        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession?.user) {
          await fetchProfile(initialSession.user.email)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('[Auth] Error getting initial session:', err)
        setLoading(false)
      }
    }

    getInitialSession()

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (email?: string | null) => {
    if (!email) {
      setProfile(null)
      localStorage.removeItem('user_profile')
      return
    }

    // Usar caché para respuesta inmediata mientras llega la DB
    try {
      const cached = localStorage.getItem('user_profile')
      if (cached) {
        const p = JSON.parse(cached)
        if (p.email?.toLowerCase() === email.toLowerCase()) {
          setProfile(p)
        }
      }
    } catch {}

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle()

    if (error) {
      console.error('[Auth] Profile fetch error:', error.message)
    }

    if (data) {
      const p: Usuario = {
        ...data,
        rol: (data.rol || '').trim().toLowerCase() as Usuario['rol'],
        email: (data.email || '').trim().toLowerCase(),
      }
      setProfile(p)
      localStorage.setItem('user_profile', JSON.stringify(p))
    } else if (!error) {
      console.warn(`[Auth] No profile found for email: ${email}`)
      setProfile(null)
      localStorage.removeItem('user_profile')
    }
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('user_profile')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    localStorage.removeItem('user_profile')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
