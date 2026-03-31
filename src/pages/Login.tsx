import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { Truck, CheckCircle2, MoveRight } from 'lucide-react';

export default function Login() {
  const { signIn, profile, loading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();

  // Redirigir si ya está logueado
  useEffect(() => {
    if (user && profile && !loading) {
      if (profile.rol === 'administrador') navigate('/admin');
      else if (profile.rol === 'chofer') navigate('/driver');
    }
  }, [user, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    
    try {
      await signIn(email.trim(), password);
      // El redirect ocurrirá vía el useEffect arriba una vez que AuthContext detecte el cambio y cargue el perfil
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      setIsLoggingIn(false);
    }
  };

  if (user && profile && !loading) {
    return (
      <div className="w-full max-w-md bg-surface p-10 rounded-2xl shadow-2xl border border-primary/50 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
           <CheckCircle2 className="text-green-500" size={48} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase italic">¡Acceso Concedido!</h2>
        <p className="text-text-muted mb-8">Bienvenido de nuevo, <span className="text-white font-bold">{profile.nombre}</span></p>
        
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-8">
           <p className="text-xs text-text-muted uppercase font-bold mb-1">Rol Detectado</p>
           <p className="text-primary font-bold text-lg capitalize">{profile.rol}</p>
        </div>

        <Button
          className="w-full h-14 text-lg font-black bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30"
          onClick={() => {
            if (profile.rol === 'administrador') navigate('/admin');
            else navigate('/driver');
          }}
        >
          IR AL PANEL DE CONTROL
        </Button>
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
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-1">Shimaya Rutas</h2>
        <p className="text-text-muted text-xs uppercase tracking-widest font-bold opacity-60">Logística Avanzada</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-danger/20 border border-danger text-danger text-sm p-3 rounded-xl">
            {error}
          </div>
        )}
        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="usuario@shimaya.com"
        />
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />
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
