import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Map, LogOut, Truck, WifiOff } from 'lucide-react';

export const DriverLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Verificar día de descanso
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaHoy = diasSemana[new Date().getDay()];
  const esDiaDescanso = profile?.dias_descanso?.includes(diaHoy);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


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

  const isAdminDual = user?.email?.toLowerCase()?.includes('manuelm');
  const rolesPermitidos = isAdminDual ? ['chofer', 'descansero', 'asistente', 'administrador'] : ['chofer', 'descansero', 'asistente'];
  const puedeAccederDriver = user && profile && rolesPermitidos.includes(profile.rol);
  
  if (!puedeAccederDriver) {
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
              <p className="text-sm text-text-muted capitalize">{profile.rol === 'descansero' ? 'Descansero' : profile.rol === 'administrador' ? 'Administrador' : 'Conductor'}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="flex items-center gap-1 text-yellow-500 text-xs bg-yellow-500/10 px-2 py-1 rounded-full">
                  <WifiOff size={14} /> Sin conexión
                </span>
              )}
              <button onClick={() => signOut()} className="p-2 text-text-muted hover:text-white rounded-full bg-surface-light">
                <LogOut size={20} />
              </button>
            </div>
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
            <Link 
              to={esDiaDescanso ? "#" : "/driver"} 
              className={`flex flex-col items-center p-2 ${esDiaDescanso ? 'opacity-50 pointer-events-none' : ''} ${location.pathname === '/driver' ? 'text-primary' : 'text-text-muted'}`}
              onClick={(e) => esDiaDescanso && e.preventDefault()}
            >
              <Map size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Hoy</span>
            </Link>
            <Link 
              to={esDiaDescanso ? "#" : "/driver/viaje"} 
              className={`flex flex-col items-center p-2 ${esDiaDescanso ? 'opacity-50 pointer-events-none' : ''} ${location.pathname === '/driver/viaje' ? 'text-primary' : 'text-text-muted'}`}
              onClick={(e) => esDiaDescanso && e.preventDefault()}
            >
              <Truck size={24} className="mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Viaje</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
};
