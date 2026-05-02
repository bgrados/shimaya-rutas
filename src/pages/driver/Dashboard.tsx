import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Ruta } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MapPin, Navigation, Map, RefreshCw, AlertCircle, History, Calendar, Clock, Fuel, Car, Wallet, Receipt, Phone, Coffee } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatFriendlyDate, nowPeru } from '../../lib/timezone';
import { ImageModal } from '../../components/ui/ImageModal';

interface RutaHistorica {
  id_ruta: string;
  nombre: string;
  fecha: string;
  estado: string;
  placa: string | null;
  hora_salida_planta: string | null;
  hora_llegada_planta: string | null;
  locales_count?: number;
  km_inicio: number | null;
  km_fin: number | null;
}

interface GastoDelDia {
  monto: number;
  tipo_combustible: string;
  foto_url: string | null;
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
  const [gastosCombustible, setGastosCombustible] = useState<GastoDelDia | null>(null);
  const [gastosOtros, setGastosOtros] = useState<GastoDelDia | null>(null);
  const [gastosPeaje, setGastosPeaje] = useState<GastoDelDia | null>(null);
  const [activePhoto, setActivePhoto] = useState<{ images: { url: string; title: string }[]; index: number } | null>(null);

  // Verificar día de descanso
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const nowObj = new Date(nowPeru());
  const diaHoy = diasSemana[nowObj.getDay()];
  const esDiaDescanso = profile?.dias_descanso?.includes(diaHoy);

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
        .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
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
    
    // El usuario solicita ver desde el lunea 06 de Abril en adelante
    const minDate = '2026-04-06';
    
    const { data, error } = await supabase
      .from('rutas')
      .select('id_ruta, nombre, fecha, km_inicio, km_fin')
      .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
      .eq('estado', 'finalizada')
      .gte('fecha', minDate)
      .order('fecha', { ascending: false });
       
    setRutasHistoricas(data || []);
    setLoadingHistory(false);
  };

const loadGastosDelDia = async () => {
    if (!profile) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    
    console.log('[Gastos] Today:', today);
    
    try {
      const { data: rutasDelDia, error: errorRutas } = await supabase
        .from('rutas')
        .select('id_ruta')
        .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
        .eq('fecha', today);
      
      console.log('[Gastos] Rutas del dia:', rutasDelDia?.length, errorRutas);
      
      const rutaIds = rutasDelDia?.map(r => r.id_ruta) || [];
      
      const { data: gastosComb, error: errorComb } = await supabase
        .from('gastos_combustible')
        .select('monto, tipo_combustible, foto_url')
        .eq('id_chofer', profile.id_usuario)
        .neq('tipo_combustible', 'otro')
        .in('id_ruta', rutaIds.length > 0 ? rutaIds : ['']);
      
      console.log('[Gastos] Comb results:', gastosComb?.length, errorComb);
         
      const { data: gastosOt, error: errorOt } = await supabase
        .from('gastos_combustible')
        .select('monto, tipo_combustible, foto_url')
        .eq('id_chofer', profile.id_usuario)
        .eq('tipo_combustible', 'otro')
        .in('id_ruta', rutaIds.length > 0 ? rutaIds : ['']);
      
      console.log('[Gastos] Otros results:', gastosOt?.length, errorOt);
        
      if (gastosOt && gastosOt.length > 0) {
        const totalOt = gastosOt.reduce((sum, g) => sum + (g.monto || 0), 0);
        setGastosOtros({
          monto: totalOt,
          tipo_combustible: 'otro',
          foto_url: gastosOt.find(g => g.foto_url)?.foto_url || null
        });
      } else {
        setGastosOtros(null);
      }
        
      if (gastosComb && gastosComb.length > 0) {
        const totalComb = gastosComb.reduce((sum, g) => sum + (g.monto || 0), 0);
        setGastosCombustible({
          monto: totalComb,
          tipo_combustible: 'mixto',
          foto_url: gastosComb.find(g => g.foto_url)?.foto_url || null
        });
      } else {
        setGastosCombustible(null);
      }
      
      const { data: rutasDia } = await supabase
        .from('rutas')
        .select('id_ruta, id_ruta_base')
        .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
        .eq('fecha', today)
        .eq('estado', 'finalizada');
      
      let totalPeajes = 0;
      if (rutasDia && rutasDia.length > 0) {
        const rutasBaseIds = rutasDia.map(r => r.id_ruta_base).filter(Boolean);
        if (rutasBaseIds.length > 0) {
          const { data: rutasBaseData } = await supabase
            .from('rutas_base')
            .select('cantidad_peajes, costo_peaje')
            .in('id_ruta_base', rutasBaseIds);
          
          if (rutasBaseData) {
            for (const rb of rutasBaseData) {
              totalPeajes += (rb.cantidad_peajes || 0) * (rb.costo_peaje || 0);
            }
          }
        }
      }
      
      if (totalPeajes > 0) {
        setGastosPeaje({ monto: totalPeajes, tipo_combustible: 'peaje', foto_url: null });
      }
    } catch (e) {
      console.error('Error loading gastos:', e);
    }
  };

  useEffect(() => {
    loadRutas();
    loadRutasHistoricas();
    loadGastosDelDia();

    const channel = supabase
      .channel('driver_dashboard_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rutas'
        // Eliminamos filtro complejo para asegurar que asistentes también reciban cambios
      }, () => {
        loadRutas();
        loadRutasHistoricas();
        loadGastosDelDia();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gastos_combustible',
        filter: `id_chofer=eq.${profile?.id_usuario}`
      }, () => {
        loadGastosDelDia();
      })
      .subscribe();

    window.addEventListener('online', () => {
      loadRutas();
      loadRutasHistoricas();
      loadGastosDelDia();
    });

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', loadRutas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id_usuario]);

  useEffect(() => {
    if (profile?.id_usuario) {
      loadGastosDelDia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {/* Cards de Gastos del Día */}
        {(gastosCombustible?.monto || gastosOtros?.monto || gastosPeaje?.monto) && (
          <div className="grid grid-cols-3 gap-3">
            {/* Combustible */}
            {gastosCombustible?.monto ? (
              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                      <Fuel className="text-yellow-400" size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-yellow-300 uppercase font-bold">Combustible</p>
                      <p className="text-lg font-black text-white">S/ {gastosCombustible.monto.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-yellow-500/10 border-yellow-500/30 opacity-50">
                <CardContent className="p-3 text-center">
                  <Fuel className="text-yellow-400 mx-auto mb-1" size={16} />
                  <p className="text-[10px] text-yellow-300">S/ 0.00</p>
                </CardContent>
              </Card>
            )}
            
            {/* Peajes */}
            {gastosPeaje?.monto ? (
              <Card className="bg-purple-500/10 border-purple-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                      <Receipt className="text-purple-400" size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-purple-300 uppercase font-bold">Peajes</p>
                      <p className="text-lg font-black text-white">S/ {gastosPeaje.monto.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-purple-500/10 border-purple-500/30 opacity-50">
                <CardContent className="p-3 text-center">
                  <Receipt className="text-purple-400 mx-auto mb-1" size={16} />
                  <p className="text-[10px] text-purple-300">S/ 0.00</p>
                </CardContent>
              </Card>
            )}
            
            {/* Otros */}
            {gastosOtros?.monto ? (
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                      <Car className="text-blue-400" size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-300 uppercase font-bold">Otros</p>
                      <p className="text-lg font-black text-white">S/ {gastosOtros.monto.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-blue-500/10 border-blue-500/30 opacity-50">
                <CardContent className="p-3 text-center">
                  <Car className="text-blue-400 mx-auto mb-1" size={16} />
                  <p className="text-[10px] text-blue-300">S/ 0.00</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* Card Total Gastos */}
        {(gastosCombustible?.monto || gastosOtros?.monto || gastosPeaje?.monto) && (
          <Card className="bg-green-500/20 border-green-500/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/30 rounded-lg">
                    <Wallet className="text-green-400" size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-green-300 uppercase font-bold">Total Gastos del Día</p>
                    <p className="text-2xl font-black text-white">
                      S/ {(
                        (gastosCombustible?.monto || 0) + 
                        (gastosPeaje?.monto || 0) + 
                        (gastosOtros?.monto || 0)
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] text-green-400/70">
                  Comb: S/ {(gastosCombustible?.monto || 0).toFixed(2)}<br/>
                  Peajes: S/ {(gastosPeaje?.monto || 0).toFixed(2)}<br/>
                  Otros: S/ {(gastosOtros?.monto || 0).toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              
              {/* DÍA DE DESCANSO - Mostrar cuando sea día de descanso */}
              {esDiaDescanso && (
                <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-xl p-6 text-center">
                  <Coffee size={48} className="mx-auto text-yellow-400 mb-3" />
                  <h3 className="text-xl font-black text-yellow-400 mb-2">🛌 Hoy es tu día de descanso</h3>
                  <p className="text-text-muted text-sm mb-4">Disfruta tu día libre. No tienes rutas asignadas para hoy.</p>
                  <a 
                    href="https://wa.me/51948800569?text=Hola,%20tengo%20una%20consulta" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    <Phone size={18} />
                    Contactar Administrador
                  </a>
                </div>
              )}
              
              <Link to={esDiaDescanso ? "#" : "/driver/viaje"}>
                <Button 
                  className={`font-black px-6 ${esDiaDescanso ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-white text-primary hover:bg-white/90'}`}
                  disabled={esDiaDescanso}
                  onClick={(e) => {
                    if (esDiaDescanso) {
                      e.preventDefault();
                      return;
                    }
                  }}
                >
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
              loadRutasHistoricas();
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
                          <div className="flex items-center gap-3 text-text-muted text-xs mt-1">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              <span>{formatFriendlyDate(ruta.fecha)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Navigation size={12} />
                              <span>{ruta.km_inicio || 0} → {ruta.km_fin || '?'} KM</span>
                            </div>
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
      <ImageModal 
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        images={activePhoto?.images || []}
        initialIndex={activePhoto?.index}
      />

      {/* RUC para facturación */}
      <div className="mt-8 p-4 bg-primary/10 border border-primary/30 rounded-xl text-center">
        <p className="text-[10px] text-primary/60 uppercase tracking-wider font-bold mb-1">RUC para solicitar facturas</p>
        <p className="text-white font-black text-2xl tracking-widest">20600603460</p>
        <p className="text-text-muted text-[10px] mt-1">Shimaya Rutas S.A.C.</p>
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