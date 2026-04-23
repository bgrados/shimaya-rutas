import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, Users, Settings, LogOut, Menu, X, LayoutDashboard, MapPin, BarChart3, Truck, Fuel } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();


  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-6 max-w-xs">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="space-y-2">
            <p className="text-white font-black uppercase italic tracking-tighter text-xl">Verificando acceso...</p>
            <p className="text-text-muted text-sm">Validando credenciales de administrador en la base de datos de Shimaya.</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-primary text-xs font-bold hover:underline mt-4 uppercase tracking-widest"
          >
            ¿Atascado? Cerrar Sesión e intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  // Permitir administrador y supervisor
  if (profile.rol !== 'administrador' && profile.rol !== 'supervisor') {
    return <Navigate to="/login" replace />;
  }
  const navigation = [
    { name: 'Monitor Principal', href: '/admin', icon: LayoutDashboard },
    { name: 'Seguimiento (En Vivo)', href: '/admin/viajes', icon: Truck },
    { name: 'Vista Mapa de Red', href: '/admin/mapa', icon: Map },
    { name: 'Rutas Base (Plantillas)', href: '/admin/rutas-base', icon: Settings },
    { name: 'Locales Base', href: '/admin/locales', icon: MapPin },
    { name: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
    { name: 'Análisis de Rutas', href: '/admin/analisis', icon: BarChart3 },
    { name: 'Combustible y Otros', href: '/admin/combustible', icon: Fuel },
    { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
  ];

  // Original working layout - sidebar as fixed, main with ml-64
  return (
    <div className="min-h-screen bg-background text-text flex">
      {/* Mobile header with menu and SALIR */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-surface z-50 border-b border-surface-light p-4 flex justify-between items-center">
        <button onClick={() => setIsSidebarOpen(true)} className="text-white">
          <Menu size={24} />
        </button>
        {/* Logo circular móvil */}
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
          <img 
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTcvbdl7qk6b_Rb5ihYLyfkqzryxsK9uiU5w&s" 
            alt="Shimaya" 
            className="w-7 h-auto object-contain" 
          />
        </div>
        <button onClick={() => signOut()} className="text-red-400 font-bold">
          SALIR
        </button>
      </div>

      {/* Sidebar - fixed on desktop, slides on mobile */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-surface border-r border-surface-light z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-4 flex flex-col items-center justify-center border-b border-surface-light py-3">
          {/* Logo circular con fondo blanco - más pequeño */}
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-md mb-2">
            <img 
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTcvbdl7qk6b_Rb5ihYLyfkqzryxsK9uiU5w&s" 
              alt="Shimaya" 
              className="w-11 h-auto object-contain" 
            />
          </div>
          {/* Texto en japonés */}
          <p className="text-white font-bold text-sm tracking-wider">島屋物流</p>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden absolute top-4 right-4 text-text-muted hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-2 px-3 space-y-1 overflow-y-auto pb-20">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  isActive ? 'bg-primary text-white font-medium' : 'text-text-muted hover:bg-surface-light hover:text-white'
                }`}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-surface-light bg-surface">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="text-sm">
              <p className="text-white font-medium truncate w-28">{profile.nombre}</p>
              <p className="text-text-muted capitalize text-xs">{profile.rol}</p>
            </div>
            <button onClick={() => signOut()} className="text-text-muted hover:text-primary transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main content - with left margin for sidebar - mas padding en mobile */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 pt-20 lg:pt-0">
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};