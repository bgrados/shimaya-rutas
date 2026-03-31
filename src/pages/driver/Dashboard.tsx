import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Ruta } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MapPin, Navigation, Map, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DriverDashboard() {
  const { profile } = useAuth();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRutas = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('rutas')
        .select('*')
        .eq('id_chofer', profile.id_usuario)
        .in('estado', ['pendiente', 'en_progreso'])
        .order('fecha', { ascending: false });
        
      if (error) throw error;
      setRutas(data as Ruta[]);
    } catch (e) {
      console.error('Error loading dashboard routes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRutas();

    // Suscripción Realtime para detectar cambios de estado desde Admin
    const channel = supabase
      .channel('driver_dashboard_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rutas',
        filter: `id_chofer=eq.${profile?.id_usuario}`
      }, () => loadRutas())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
          loadRutas(); // Reintentar carga al conectar o error
        }
      });

    // Escuchar cuando el teléfono vuelve a tener internet
    window.addEventListener('online', loadRutas);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', loadRutas);
    };
  }, [profile?.id_usuario]);

  const activeRoute = rutas[0];

  if (loading) return <div className="p-4 text-white text-center mt-10">Cargando tus rutas...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Tus Rutas de Hoy</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadRutas} 
          isLoading={loading}
          className="text-text-muted hover:text-white"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="space-y-4">
        <Card className="bg-primary border-none shadow-lg shadow-primary/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white uppercase italic">¡Ruta Lista!</h3>
                {activeRoute && (
                  <>
                    <p className="text-sm border-l-2 border-primary pl-3 italic">
                      Unidad: <span className="text-white font-bold not-italic">{activeRoute.placa || 'No asignada'}</span>
                    </p>
                    <p className="text-xs text-text-muted border-l-2 border-surface-light pl-3">
                      {activeRoute.observaciones || 'Sin observaciones adicionales'}
                    </p>
                  </>
                )}
                {!activeRoute && (
                  <p className="text-white/80 text-sm">Registra tus movimientos en la Bitácora</p>
                )}
              </div>
              <Link to="/driver/viaje">
                <Button className="bg-white text-primary hover:bg-white/90 font-black px-6">
                  IR A MI VIAJE
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {rutas.map(ruta => (
          <Card key={ruta.id_ruta}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-primary/20 text-primary p-3 rounded-xl">
                  <Map size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-white">{ruta.nombre}</h3>
                  <p className="text-text-muted text-sm capitalize">{ruta.estado.replace('_', ' ')}</p>
                </div>
              </div>
              <Link to={`/driver/ruta/${ruta.id_ruta}`}>
                <Button className="w-full flex justify-center items-center gap-2">
                  <Navigation size={18} /> {ruta.estado === 'pendiente' ? 'Iniciar Ruta' : 'Continuar Ruta'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {rutas.length === 0 && (
          <div className="bg-surface border border-surface-light rounded-2xl p-8 text-center">
            <div className="bg-surface-light w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
              <MapPin size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Todo listo</h3>
            <p className="text-text-muted">No tienes rutas pendientes o en progreso para el día de hoy.</p>
          </div>
        )}
      </div>
    </div>
  );
}
