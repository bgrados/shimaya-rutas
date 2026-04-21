import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Truck, CheckCircle2, MoveRight, Shield } from 'lucide-react';

export default function Login() {
  const { signIn, profile, loading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user && profile && !loading && !showSuccess) {
      setShowSuccess(true);
    }
  }, [user, profile, loading, showSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    setShowSuccess(false);
    try {
      const cleanEmail = email.trim().replace('@shimaya.com', '');
      await signIn(`${cleanEmail}@shimaya.com`, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión. Verifica tus credenciales.');
      setIsLoggingIn(false);
    }
  };

  const goToAdmin = () => {
    window.location.href = '/admin';
  };

  const goToDriver = () => {
    window.location.href = '/driver';
  };

  if (showSuccess && user && profile && !loading) {
    return (
      <div className="w-full max-w-md bg-surface p-10 rounded-2xl shadow-2xl border border-primary/50 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="text-green-500" size={48} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase italic">¡Acceso Concedido!</h2>
        <p className="text-text-muted mb-4">Bienvenido, <span className="text-white font-bold">{profile.nombre}</span></p>
        
        {/* Selector de rol si tiene acceso a ambos */}
        {['administrador', 'supervisor'].includes(profile.rol) && (
          <div className="mb-6">
            <p className="text-xs text-text-muted uppercase font-bold mb-2">¿Cómo quieres entrar?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={goToAdmin}
                className="p-4 bg-primary/20 hover:bg-primary/30 border-2 border-primary/50 rounded-xl transition-all"
              >
                <Shield className="mx-auto mb-2 text-primary" size={24} />
                <span className="text-sm font-bold text-primary block">ADMINISTRADOR</span>
              </button>
              <button
                type="button"
                onClick={goToDriver}
                className="p-4 bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-500/50 rounded-xl transition-all"
              >
                <Truck className="mx-auto mb-2 text-blue-400" size={24} />
                <span className="text-sm font-bold text-blue-400 block">CONDUCTOR</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Solo un rol - ir directamente */}
        {profile.rol === 'chofer' || profile.rol === 'descansero' ? (
          <button
            type="button"
            onClick={goToDriver}
            className="w-full h-14 text-lg font-black bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30 rounded-lg"
          >
            IR A MIS RUTAS
          </button>
        ) : !['administrador', 'supervisor'].includes(profile.rol) && (
          <button
            type="button"
            onClick={profile.rol === 'administrador' || profile.rol === 'supervisor' ? goToAdmin : goToDriver}
            className="w-full h-14 text-lg font-black bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30 rounded-lg"
          >
            IR AL PANEL
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-2xl border border-surface-light relative">
      <div className="mb-8 text-center overflow-hidden">
        <style>{`
          @keyframes truckDrive {
            0% { transform: translateX(-100px); opacity: 0; }
            30% { transform: translateX(10px); opacity: 1; }
            45% { transform: translateX(-5px); }
            60% { transform: translateX(0); }
            100% { transform: translateX(0); opacity: 1; }
          }
          .animate-truck {
            animation: truckDrive 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
        `}</style>
        <div className="w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 relative animate-truck">
          <Truck className="text-primary" size={48} />
          <div className="absolute bottom-4 right-4 animate-bounce">
            <MoveRight size={12} className="text-primary/40" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-1">Shimaya Rutas v2</h2>
        <p className="text-text-muted text-xs uppercase tracking-widest font-bold opacity-60">Logística Avanzada</p>
        
        {/* RUC para facturación */}
        <div className="mt-4 inline-block bg-primary/10 border border-primary/30 rounded-lg px-4 py-2">
          <p className="text-[10px] text-primary/60 uppercase tracking-wider font-bold">RUC para facturas</p>
          <p className="text-white font-black text-lg tracking-wider">20600603460</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 text-sm p-3 rounded-xl animate-in fade-in duration-300">
            {error}
          </div>
        )}
        <div className="relative">
          <Input
            label="Usuario"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value.replace('@shimaya.com', ''))}
            required
            placeholder="usuario"
            className="bg-surface-light/50 border-white/5 focus:border-primary pr-[110px]"
          />
          <div className="absolute right-4 top-[32px] bottom-0 text-text-muted/60 pointer-events-none select-none font-medium flex items-center">
            @shimaya.com
          </div>
        </div>
        <div className="relative">
          <Input
            label="Contraseña"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="bg-surface-light/50 border-white/5 focus:border-primary pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[32px] p-2 text-text-muted hover:text-white transition-colors"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-lg font-bold shadow-xl shadow-primary/20 bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Verificando...' : 'Entrar al Panel'}
        </Button>
      </form>
    </div>
  );
}