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

  if (!user || !profile || profile.rol !== 'administrador') {
    return <Navigate to="/login" replace />;
  }
  const navigation = [
    { name: 'Monitor Principal', href: '/admin', icon: LayoutDashboard },
    { name: 'Seguimiento (En Vivo)', href: '/admin/viajes', icon: Truck },
    { name: 'Vista Mapa de Red', href: '/admin/mapa', icon: Map },
    { name: 'Rutas Base (Plantillas)', href: '/admin/rutas-base', icon: Settings },
    { name: 'Locales Base', href: '/admin/locales', icon: MapPin },
    { name: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
    { name: 'Gastos Combustible', href: '/admin/combustible', icon: Fuel },
    { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-text flex">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 w-full bg-surface z-20 border-b border-surface-light p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Shimaya Rutas</h1>
        <button onClick={() => setIsSidebarOpen(true)} className="text-white">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar - Desktop & Mobile */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-surface border-r border-surface-light transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static`}>
        <div className="p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">SHIMAYA</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-text-muted hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center px-4 py-3 rounded-xl transition-colors ${
                  isActive ? 'bg-primary text-white font-medium' : 'text-text-muted hover:bg-surface-light hover:text-white'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-surface-light">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm">
              <p className="text-white font-medium truncate w-32">{profile.nombre}</p>
              <p className="text-text-muted capitalize">{profile.rol}</p>
            </div>
            <button onClick={() => signOut()} className="text-text-muted hover:text-primary transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:pt-0 pt-16">
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
