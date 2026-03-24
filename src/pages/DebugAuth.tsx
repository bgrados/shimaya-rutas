import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';

export default function DebugAuth() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="min-h-screen bg-black p-8 text-green-500 font-mono">
      <h1 className="text-2xl font-bold mb-6 border-b border-green-900 pb-2">DEBUG AUTH STATE</h1>
      
      <div className="space-y-4">
        <div>
          <p className="text-white font-bold">1. Loading State:</p>
          <pre className="bg-zinc-900 p-2 rounded">{loading ? '⌛ LOADING...' : '✅ LOADED'}</pre>
        </div>

        <div>
          <p className="text-white font-bold">2. Supabase User (Auth):</p>
          <pre className="bg-zinc-900 p-2 rounded">
            {user ? JSON.stringify({ email: user.email, id: user.id }, null, 2) : '❌ NO USER'}
          </pre>
        </div>

        <div>
          <p className="text-white font-bold">3. Database Profile (usuarios):</p>
          <pre className="bg-zinc-900 p-2 rounded">
            {profile ? JSON.stringify(profile, null, 2) : '❌ NO PROFILE'}
          </pre>
        </div>

        <div className="pt-6 space-y-2">
          <p className="text-white font-bold">Acciones:</p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} variant="secondary">Refrescar Página</Button>
            <Button onClick={() => {
               supabase.auth.signOut().then(() => window.location.href = '/login');
            }} variant="danger">Cerrar Sesión Forzado</Button>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-zinc-900 rounded border border-green-900 text-sm">
           <p className="mb-2">💡 Si ves un **USER** pero **NO PROFILE**, significa que tu email en Supabase Auth no coincide exactamente con el de la tabla `usuarios` o hay un error de RLS.</p>
           <p>💡 Si ves **LOADING** infinito, hay un problema con la inicialización de Supabase.</p>
        </div>
      </div>
    </div>
  );
}
