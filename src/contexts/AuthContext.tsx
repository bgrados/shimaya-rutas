// ... (manten tus imports igual)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Usuario | null>(() => {
    const cached = localStorage.getItem('user_profile')
    return cached ? JSON.parse(cached) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Solo usamos onAuthStateChange, que maneja la sesión inicial automáticamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return
        
        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user) {
          await fetchProfile(newSession.user.email)
        } else {
          localStorage.removeItem('user_profile')
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (email?: string | null) => {
    if (!email) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('email', email.trim())
        .maybeSingle()

      if (error) throw error

      if (data) {
        // Normalizamos el rol a minúsculas y sin espacios
        const p: Usuario = {
          ...data,
          rol: (data.rol || '').trim().toLowerCase() as Usuario['rol'],
          email: (data.email || '').trim().toLowerCase(),
        }
        setProfile(p)
        localStorage.setItem('user_profile', JSON.stringify(p))
      } else {
        // SI NO HAY PERFIL: Limpiamos para evitar loop
        setProfile(null)
        localStorage.removeItem('user_profile')
      }
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  // ... (signIn y signOut se mantienen igual)

  return (
    <AuthContext.Provider value={{ session, user, profile, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
