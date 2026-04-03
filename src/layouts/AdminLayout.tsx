// ... (manten tus imports igual)

export const AdminLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // 1. Si está cargando y no hay nada en caché, mostrar spinner
  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-center">
         {/* ... Tu código del spinner ... */}
      </div>
    );
  }

  // 2. PROTECCIÓN DE RUTA: Solo si ya terminó de cargar
  if (!loading) {
    const userRol = profile?.rol?.toLowerCase().trim();
    
    if (!user || !profile || userRol !== 'administrador') {
      console.warn("Acceso denegado: Redirigiendo al login...");
      return <Navigate to="/login" replace />;
    }
  }

  // 3. Si no hay perfil en absoluto tras cargar, no renderizar nada
  if (!profile) return null;

  // ... (El resto del renderizado de tu Sidebar y navegación se mantiene igual)
};
