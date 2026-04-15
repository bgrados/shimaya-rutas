import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Ruta, LocalRuta } from '../../../types';
import RegistrarCombustible from '../combustible/Registrar';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Navigation, Play, Flag, Fuel } from 'lucide-react';
import { nowPeru } from '../../../lib/timezone';

export default function EjecucionRuta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCombustible, setShowCombustible] = useState(false);

  useEffect(() => {
    async function fetchRutaDetalle() {
      if (!id) return;
      const [rutaRes, localesRes] = await Promise.all([
        supabase.from('rutas').select('*').eq('id_ruta', id).single(),
        supabase.from('locales_ruta').select('*').eq('id_ruta', id).order('orden', { ascending: true })
      ]);

      if (rutaRes.data) {
        setRuta(rutaRes.data as Ruta);
        if (rutaRes.data.estado === 'pendiente') {
          const { data: existingRoute } = await supabase.from('rutas').select('estado').eq('id_ruta', id).single();
          if (existingRoute?.estado === 'pendiente') {
            await supabase.from('rutas').update({ estado: 'en_progreso' }).eq('id_ruta', id);
            setRuta({...rutaRes.data as Ruta, estado: 'en_progreso'});
          } else {
            setRuta({...rutaRes.data as Ruta, estado: existingRoute?.estado || rutaRes.data.estado});
          }
        }
      }
      if (localesRes.data) setLocales(localesRes.data as LocalRuta[]);
      setLoading(false);
    }
    fetchRutaDetalle();
  }, [id]);

  const getStatusIcon = (estado: string | null) => {
    switch (estado) {
      case 'visitado': return <CheckCircle2 className="text-green-500" size={24} />;
      case 'cerrado':
      case 'no_encontrado': return <XCircle className="text-red-500" size={24} />;
      default: return <Clock className="text-yellow-500" size={24} />;
    }
  };

  const getStatusBg = (estado: string | null) => {
    switch (estado) {
      case 'visitado': return 'bg-green-500/10 border-green-500/30';
      case 'cerrado':
      case 'no_encontrado': return 'bg-red-500/10 border-red-500/30';
      default: return 'bg-surface-light border-surface-light';
    }
  };

  if (loading) return <div className="text-white p-4 text-center mt-10">Cargando ruta...</div>;
  if (!ruta) return <div className="text-white p-4 text-center mt-10">Ruta no encontrada</div>;

  const total = locales.length;
  const completados = locales.filter(l => l.estado_visita && l.estado_visita !== 'pendiente').length;
  const progreso = total === 0 ? 0 : Math.round((completados / total) * 100);

  const handleSalidaPlanta = async () => {
    const now = nowPeru();
    const { error } = await supabase
      .from('rutas')
      .update({ 
        hora_salida_planta: now,
        estado: 'en_progreso'
      })
      .eq('id_ruta', id);

    // Si tiene locales asignados, inicializamos el primer tramo de la bitácora
    if (locales.length > 0) {
      await supabase.from('viajes_bitacora').insert([{
        id_ruta: id,
        id_chofer: ruta?.id_chofer,
        origen_nombre: 'Planta',
        destino_nombre: locales[0].nombre,
        hora_salida: now
      }]);
    }
    
    if (!error) {
      setRuta(prev => prev ? { ...prev, hora_salida_planta: now, estado: 'en_progreso' } : null);
      navigate('/driver/viaje'); // Redirigimos al chofer a su bitácora ya iniciada
    }
  };

  const handleLlegadaPlanta = async () => {
    const now = nowPeru();
    const { error } = await supabase
      .from('rutas')
      .update({ 
        hora_llegada_planta: now,
        estado: 'finalizada'
      })
      .eq('id_ruta', id);
    
    if (!error) {
      navigate('/driver');
    }
  };

  const openGoogleMapsRoute = () => {
    // Tomamos todos los locales pendientes o no finalizados, o simplemente todos para trazar la ruta
    const validLocales = locales.filter(l => l.latitud && l.longitud);
    if (validLocales.length === 0) {
      return;
    }
    
    // El destino final es el último local de la lista
    const lastLocal = validLocales[validLocales.length - 1];
    
    let url = `https://www.google.com/maps/dir/?api=1&destination=${lastLocal.latitud},${lastLocal.longitud}`;
    
    // Los locales anteriores son "waypoints" (paradas intermedias)
    if (validLocales.length > 1) {
      const waypoints = validLocales.slice(0, -1).map(l => `${l.latitud},${l.longitud}`).join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="p-2 -ml-2 h-auto" onClick={() => navigate('/driver')}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">{ruta.nombre}</h1>
          <p className="text-sm text-text-muted">{progreso}% Completado ({completados}/{total})</p>
        </div>
      </div>

      <div className="w-full bg-surface-light h-2 rounded-full mb-6 overflow-hidden">
        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progreso}%` }}></div>
      </div>

      {!ruta.hora_salida_planta && (
        <Button 
          className="w-full mb-6 py-6 text-lg bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
          onClick={handleSalidaPlanta}
        >
          <Play size={24} className="mr-2" />
          Registrar Salida de Planta
        </Button>
      )}

      {/* Botones de acción durante la ruta */}
      <div className="space-y-3 mb-6">
        <Button 
          variant="secondary"
          className="w-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-blue-600/50" 
          onClick={openGoogleMapsRoute}
        >
          <Navigation size={18} className="mr-2" />
          Abrir Ruta en Google Maps
        </Button>
        
        <Button 
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold shadow-lg" 
          onClick={() => setShowCombustible(true)}
        >
          <Fuel size={20} className="mr-2" />
          Registrar Combustible / Gasto
        </Button>
      </div>

      <div className="space-y-4">
        {locales.map((local: LocalRuta) => (
          <Link to={`/driver/ruta/${id}/visita/${local.id_local_ruta}`} key={local.id_local_ruta} className="block">
            <Card className={`border ${getStatusBg(local.estado_visita)} transition-colors hover:brightness-110`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex flex-col items-center justify-center font-bold text-primary w-8">
                  <span className="text-xs text-text-muted">#{local.orden}</span>
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-white group-hover:text-primary transition-colors">{local.nombre}</h3>
                  <p className="text-xs text-text-muted line-clamp-1">{local.direccion}</p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(local.estado_visita)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {locales.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            Esta ruta no tiene locales asignados.
          </div>
        )}
      </div>
      
      {progreso === 100 && ruta.estado !== 'finalizada' && (
        <div className="mt-8 pt-4 border-t border-surface-light">
          <Button 
            className="w-full py-6 text-lg bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
            onClick={handleLlegadaPlanta}
          >
            <Flag size={24} className="mr-2" />
            Registrar Llegada a Planta (Finalizar)
          </Button>
        </div>
      )}

      {showCombustible && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <RegistrarCombustible 
              idRuta={id!} 
              idChofer={ruta?.id_chofer || ''}
              onClose={() => setShowCombustible(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
