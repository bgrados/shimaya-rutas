import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Usuario } from '../types'

export interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Usuario | null
  onlineUsers: string[]
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  onlineUsers: [],
  signIn: async () => {},
  signOut: async () => {},
  loading: true,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  const fetchProfile = async (email?: string | null, userId?: string | undefined) => {
    console.log('[Auth] fetchProfile called, email:', email, 'userId:', userId)
    
    if (!email && !userId) {
      setProfile(null)
      localStorage.removeItem('user_profile')
      setLoading(false)
      return
    }
    
    try {
      const emailLower = email?.toLowerCase().trim() || ''
      
      let profileFound: Usuario | null = null
      
      if (userId) {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id_usuario', userId)
          .maybeSingle()
        
        if (!error && data) profileFound = data
      }
      
      if (!profileFound && emailLower) {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', emailLower)
          .maybeSingle()
        
        if (!error && data) profileFound = data
      }
      
      if (profileFound) {
        const p: Usuario = {
          ...profileFound,
          rol: (profileFound.rol || '').trim().toLowerCase() as Usuario['rol'],
          email: (profileFound.email || '').trim().toLowerCase(),
        }
        console.log('[Auth] Profile loaded:', p.id_usuario, 'rol:', p.rol)
        setProfile(p)
        localStorage.setItem('user_profile', JSON.stringify(p))
      } else {
        console.warn('[Auth] No profile found')
        setProfile(null)
        localStorage.removeItem('user_profile')
      }
    } catch (e) {
      console.error('[Auth] Error fetching profile:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    
    const loadSession = async () => {
      try {
        console.log('[Auth] Loading initial session...')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        console.log('[Auth] Initial session:', session?.user?.email || 'none')
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.email, session.user.id)
        } else {
          setLoading(false)
        }
      } catch (e) {
        console.error('[Auth] Session error:', e)
        if (mounted) setLoading(false)
      }
    }
    
    loadSession()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('[Auth] Auth state change:', _event, !!newSession)
        if (!mounted) return
        
        setSession(newSession)
        setUser(newSession?.user ?? null)
        
        if (newSession?.user) {
          await fetchProfile(newSession.user.email, newSession.user.id)
        } else {
          setProfile(null)
          localStorage.removeItem('user_profile')
          setLoading(false)
        }
      }
    )
    
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('user_profile')
    const emailClean = email.toLowerCase().trim()
    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailClean, 
      password 
    })
    if (error) throw error
  }

  const signOut = async () => {
    localStorage.removeItem('user_profile')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, onlineUsers, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
