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
  const authEventFired = useRef(false)
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let mounted = true

    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Timeout alcanzado, forzando loading=false')
        setLoading(false)
      }
    }, 8000)

    // Canal de presencia para usuarios online
    const presenceChannel = supabase.channel('auth_presence')
    presenceChannelRef.current = presenceChannel
    
    // Suscribir al canal primero y esperar a que esté listo
    presenceChannel.subscribe((status) => {
      console.log('[Presence] Channel status:', status);
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return
        authEventFired.current = true
        clearTimeout(loadingTimeout)
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          await fetchProfile(newSession.user.email, newSession.user.id)
          // Track presence cuando se loguea - esperar un poco para que el canal esté listo
          setTimeout(async () => {
            console.log('[Presence] Tracking user:', newSession.user.id, newSession.user.email);
            await presenceChannel.track({
              user_id: newSession.user.id,
              email: newSession.user.email,
              online_at: new Date().toISOString()
            })
          }, 500)
        } else {
          localStorage.removeItem('user_profile')
          setProfile(null)
          setLoading(false)
          // Untrack cuando hace logout
          await presenceChannel.untrack()
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
          await fetchProfile(initialSession.user.email, initialSession.user.id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('[Auth] Error getting initial session:', err)
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe()
      }
    }
  }, [])

  const fetchProfile = async (email?: string | null, userId?: string) => {
    console.log('[Auth] fetchProfile llamado con email:', email, 'userId:', userId)
    
    if (!email && !userId) {
      setProfile(null)
      localStorage.removeItem('user_profile')
      setLoading(false)
      return
    }

    const emailLower = email?.toLowerCase().trim() || ''

    try {
      const cached = localStorage.getItem('user_profile')
      if (cached) {
        const p = JSON.parse(cached)
        if (p.email?.toLowerCase() === emailLower) {
          setProfile(p)
          setLoading(false)
          return
        }
      }
    } catch (e) {
      console.warn('[Auth] Cache parse error:', e)
    }

    let profileFound: Usuario | null = null

    if (userId) {
      console.log('[Auth] Buscando por id_usuario:', userId)
      const { data: dataById, error: errorById } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_usuario', userId)
        .maybeSingle()
      
      if (!errorById && dataById) {
        console.log('[Auth] Encontrado por id_usuario:', dataById.email)
        profileFound = dataById
      }
    }

    if (!profileFound && emailLower) {
      console.log('[Auth] Buscando por email:', emailLower)
      const { data: dataByEmail, error: errorByEmail } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle()
      
      if (!errorByEmail && dataByEmail) {
        console.log('[Auth] Encontrado por email:', dataByEmail.email)
        profileFound = dataByEmail
      }
    }

    if (profileFound) {
      const p: Usuario = {
        ...profileFound,
        rol: (profileFound.rol || '').trim().toLowerCase() as Usuario['rol'],
        email: (profileFound.email || '').trim().toLowerCase(),
      }
      setProfile(p)
      localStorage.setItem('user_profile', JSON.stringify(p))
      console.log('[Auth] Perfil cargado:', p.email, p.rol)
    } else {
      console.warn('[Auth] No se encontró perfil para:', emailLower, userId)
      setProfile(null)
      localStorage.removeItem('user_profile')
    }
    
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('user_profile')
    const emailClean = email.toLowerCase().trim()
    console.log('[Auth] Intentando signIn con:', emailClean)
    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailClean, 
      password 
    })
    if (error) {
      console.error('[Auth] Error signIn:', error)
      throw error
    }
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
