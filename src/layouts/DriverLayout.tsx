import React from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, FileText, User as UserIcon, LogOut, Truck } from 'lucide-react';

export const DriverLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  console.log('[DriverLayout] Status:', { path: location.pathname, hasUser: !!user, hasProfile: !!profile, loading });

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-muted text-sm">Validando chofer...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile || profile.rol !== 'chofer') {
    console.warn('[DriverLayout] Redirecting to /login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isRutaActiva = location.pathname.includes('/driver/ruta/');

  return (
    <div className="min-h-screen bg-background text-text flex flex-col">
      {/* Driver Header */}
      {!isRutaActiva && (
        <header className="bg-surface border-b border-surface-light p-4 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white">Hola, {profile.nombre}</h1>
              <p className="text-sm text-text-muted">Conductor</p>
            </div>
            <button onClick={() => signOut()} className="p-2 text-text-muted hover:text-white rounded-full bg-surface-light">
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      {/* Main Driver Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Driver Bottom Navigation (Hidden on active route map/detail if desired, but good for main tabs) */}
      {!isRutaActiva && (
        <nav className="fixed bottom-0 w-full bg-surface border-t border-surface-light pb-safe">
          <div className="flex justify-around items-center p-3">
            <Link to="/driver" className={`flex flex-col items-center p-2 ${location.pathname === '/driver' ? 'text-primary' : 'text-text-muted'}`}>
              <Map size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Hoy</span>
            </Link>
            <Link to="/driver/viaje" className={`flex flex-col items-center p-2 ${location.pathname === '/driver/viaje' ? 'text-primary' : 'text-text-muted'}`}>
              <Truck size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Viaje</span>
            </Link>
            <Link to="/driver/historial" className={`flex flex-col items-center p-2 ${location.pathname === '/driver/historial' ? 'text-primary' : 'text-text-muted'}`}>
              <FileText size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Historial</span>
            </Link>
            <Link to="/driver/perfil" className={`flex flex-col items-center p-2 ${location.pathname === '/driver/perfil' ? 'text-primary' : 'text-text-muted'}`}>
              <UserIcon size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Perfil</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
};
