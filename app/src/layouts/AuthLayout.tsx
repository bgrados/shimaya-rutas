import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Truck } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-muted font-medium">Iniciando aplicación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="bg-black w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 border-black shadow-2xl mb-6 relative hover:scale-105 transition-transform duration-300">
            <Truck size={72} strokeWidth={1.5} className="text-white mb-2" />
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-normal mb-1" style={{ color: '#E50914', fontFamily: 'Impact, sans-serif', textTransform: 'uppercase' }}>
            SHIMAYA
          </h1>

          <div className="flex items-center gap-3 justify-center mb-1 w-full max-w-[200px]">
            <div className="h-[2px] bg-white flex-1"></div>
            <p className="text-white font-bold tracking-[0.2em] lowercase text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>rutas</p>
            <div className="h-[2px] bg-white flex-1"></div>
          </div>

          <p className="font-bold text-2xl tracking-[0.3em] mt-1" style={{ color: '#E50914' }}>
            ルート
          </p>
        </div>

        <div className="bg-surface/90 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-surface-light relative overflow-hidden">

          {user && !profile && !loading && (
             <div className="bg-primary/20 border border-primary text-white p-4 rounded-xl mb-6 text-sm flex flex-col items-center text-center gap-2">
                <strong className="text-lg">¡Atención!</strong>
                <span>Tu credencial es correcta, pero tu correo <b>({user.email})</b> no tiene un perfil asignado en la base de datos de gestión.</span>
                <span className="text-xs text-text-muted mt-2">Pide al administrador que te registre como <b>Usuario</b> con el rol apropiado.</span>

                <div className="flex flex-col gap-2 w-full mt-4">
                  <button
                    onClick={() => supabase.auth.getSession()}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold transition-all border border-white/20"
                  >
                    Reintentar Carga de Perfil
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('user_profile');
                      signOut();
                    }}
                    className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold transition-all"
                  >
                    Cerrar Sesión
                  </button>
                </div>
             </div>
          )}

          <Outlet />
        </div>
      </div>
    </div>
  );
};
