import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Ruta } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MapPin, Navigation, Map, RefreshCw, AlertCircle, History, Calendar, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface RutaHistorica {
  id_ruta: string;
  nombre: string;
  fecha: string;
  estado: string;
  placa: string | null;
  hora_salida_planta: string | null;
  hora_llegada_planta: string | null;
  locales_count?: number;
}

export default function DriverDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [rutasHistoricas, setRutasHistoricas] = useState<RutaHistorica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadRutas = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    
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
      setError('Error al cargar rutas. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const loadRutasHistoricas = async () => {
    if (!profile) return;
    setLoadingHistory(true);
    
    try {
      const { data, error } = await supabase
        .from('rutas')
        .select('id_ruta, nombre, fecha, estado, placa, hora_salida_planta, hora_llegada_planta')
        .eq('id_chofer', profile.id_usuario)
        .eq('estado', 'finalizada')
        .order('fecha', { ascending: false })
        .limit(30);
        
      if (error) throw error;
      setRutasHistoricas(data || []);
    } catch (e) {
      console.error('Error loading rutas históricas:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadRutas();
    loadRutasHistoricas();

    const channel = supabase
      .channel('driver_dashboard_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rutas',
        filter: `id_chofer=eq.${profile?.id_usuario}`
      }, () => {
        loadRutas();
        loadRutasHistoricas();
      })
      .subscribe();

    window.addEventListener('online', () => {
      loadRutas();
      loadRutasHistoricas();
    });

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', loadRutas);
    };
  }, [profile?.id_usuario]);

  const handleVerViajeHistorico = (ruta: RutaHistorica) => {
    navigate(`/driver/viaje/historial/${ruta.id_ruta}`);
  };

  const activeRoute = rutas[0];

  if (loading) return <div className="p-4 text-white text-center mt-10">Cargando tus rutas...</div>;

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadRutas} className="px-4 py-2">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Tus Rutas de Hoy</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            loadRutas();
            loadRutasHistoricas();
          }} 
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

        {/* Sección Viajes Anteriores */}
        <div className="mt-8">
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory && rutasHistoricas.length === 0) {
                loadRutasHistoricas();
              }
            }}
            className="w-full flex items-center justify-between p-4 bg-surface-light/30 rounded-xl border border-white/10 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <History size={20} className="text-primary" />
              <span className="text-white font-bold">Viajes Anteriores</span>
              <span className="text-text-muted text-sm">({rutasHistoricas.length})</span>
            </div>
            <ChevronDownIcon className={`text-text-muted transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {loadingHistory ? (
                <p className="text-text-muted text-center py-4">Cargando...</p>
              ) : rutasHistoricas.length === 0 ? (
                <p className="text-text-muted text-center py-4">No hay viajes anteriores</p>
              ) : (
                rutasHistoricas.map(ruta => (
                  <Card key={ruta.id_ruta} className="bg-surface-light/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-white font-bold text-sm">{ruta.nombre}</p>
                          <div className="flex items-center gap-2 text-text-muted text-xs mt-1">
                            <Calendar size={12} />
                            <span>{format(new Date(ruta.fecha), 'dd/MM/yyyy')}</span>
                            {ruta.hora_salida_planta && (
                              <>
                                <Clock size={12} />
                                <span>{ruta.hora_salida_planta?.substring(0, 5)} - {ruta.hora_llegada_planta?.substring(0, 5)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleVerViajeHistorico(ruta)}
                        >
                          Ver / Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}