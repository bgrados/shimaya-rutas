import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Ruta, LocalRuta, ViajeBitacora } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Play, Flag, Truck, Clock, CheckCircle2, MapPin, ChevronDown, Timer, PlusCircle } from 'lucide-react';

export default function DriverViaje() {
  const { profile } = useAuth();
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [bitacora, setBitacora] = useState<ViajeBitacora[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection/Creation state
  const [rutasBase, setRutasBase] = useState<any[]>([]);
  const [selectedRutaBase, setSelectedRutaBase] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [nuevoDestino, setNuevoDestino] = useState('');
  const [nuevoOrigen, setNuevoOrigen] = useState('');

  const loadCurrentRuta = async () => {
    if (!profile) return;
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: rutaData } = await supabase
      .from('rutas')
      .select('*')
      .eq('id_chofer', profile.id_usuario)
      .eq('fecha', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (rutaData) {
      setRuta(rutaData as Ruta);
      
      const { data: localesData } = await supabase
        .from('locales_ruta')
        .select('*')
        .eq('id_ruta', rutaData.id_ruta)
        .order('orden', { ascending: true });
      
      if (localesData) setLocales(localesData as LocalRuta[]);

      const { data: bitacoraData } = await supabase
        .from('viajes_bitacora')
        .select('*')
        .eq('id_ruta', rutaData.id_ruta)
        .order('created_at', { ascending: true });
      
      if (bitacoraData) {
        setBitacora(bitacoraData as ViajeBitacora[]);
        const lastTramo = bitacoraData[bitacoraData.length - 1];
        if (lastTramo && lastTramo.hora_llegada) {
          setNuevoOrigen(lastTramo.destino_nombre || '');
        } else if (lastTramo && !lastTramo.hora_llegada) {
          setNuevoOrigen(lastTramo.origen_nombre || '');
        } else {
          setNuevoOrigen('Planta');
        }
      } else {
        setNuevoOrigen('Planta');
      }
    } else {
      setRuta(null);
      // Load templates for creation
      const { data: baseData } = await supabase.from('rutas_base').select('*').eq('activo', true);
      if (baseData) {
        setRutasBase(baseData);
        if (baseData.length > 0) setSelectedRutaBase(baseData[0].id_ruta_base);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCurrentRuta();
  }, [profile]);

  const handleCreateViaje = async () => {
    if (!selectedRutaBase || !nuevaPlaca || !profile) return;
    setIsCreating(true);
    
    try {
      const baseRuta = rutasBase.find(r => r.id_ruta_base === selectedRutaBase);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Create Route
      const { data: newRuta, error: rError } = await supabase.from('rutas').insert({
        nombre: baseRuta.nombre,
        id_ruta_base: selectedRutaBase,
        id_chofer: profile.id_usuario,
        placa: nuevaPlaca.toUpperCase(),
        fecha: today,
        estado: 'pendiente'
      }).select().single();

      if (rError) throw rError;

      // 2. Clone Locales
      const { data: baseLocales } = await supabase.from('locales_base').select('*').eq('id_ruta_base', selectedRutaBase);
      if (baseLocales && baseLocales.length > 0) {
        const trLocales = baseLocales.map(bl => ({
          id_ruta: newRuta.id_ruta,
          id_local_base: bl.id_local_base,
          nombre: bl.nombre,
          orden: bl.orden,
          estado_visita: 'pendiente'
        }));
        await supabase.from('locales_ruta').insert(trLocales);
      }

      await loadCurrentRuta();
    } catch (e) {
      console.error(e);
      alert('Error al crear el viaje');
    } finally {
      setIsCreating(false);
    }
  };

  // LÓGICA SECUENCIAL Y DISPONIBILIDAD
  const localesRegistrados = bitacora.filter(b => b.hora_llegada).map(b => b.destino_nombre);
  const localesDisponibles = locales.filter(l => !localesRegistrados.includes(l.nombre || ''));
  const tramoEnProgreso = bitacora.find(b => !b.hora_llegada);

  useEffect(() => {
    if (!tramoEnProgreso) {
      if (localesDisponibles.length > 0) {
        setNuevoDestino(localesDisponibles[0].nombre || '');
      } else if (locales.length > 0 && !localesRegistrados.includes('Planta') && bitacora.length > 0) {
        setNuevoDestino('Planta');
      }
    }
  }, [bitacora, locales, localesDisponibles.length]);

  const handleRegistrarSalida = async () => {
    if (!ruta || !nuevoDestino || !nuevoOrigen) return;
    
    let lat = null, lng = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {}

    const { data, error } = await supabase
      .from('viajes_bitacora')
      .insert([{
        id_ruta: ruta.id_ruta,
        id_chofer: profile?.id_usuario,
        origen_nombre: nuevoOrigen,
        destino_nombre: nuevoDestino,
        hora_salida: new Date().toISOString(),
        gps_salida_lat: lat,
        gps_salida_lng: lng
      }])
      .select()
      .single();

    if (!error && data) {
      setBitacora([...bitacora, data as ViajeBitacora]);
      if (nuevoOrigen !== 'Planta') {
        await supabase.from('locales_ruta').update({ hora_salida: data.hora_salida }).eq('id_ruta', ruta.id_ruta).eq('nombre', nuevoOrigen);
      }
      if (bitacora.length === 0) {
        await supabase.from('rutas').update({ estado: 'en_progreso', hora_salida_planta: data.hora_salida }).eq('id_ruta', ruta.id_ruta);
      }
    }
  };

  const handleRegistrarLlegada = async (idBitacora: string) => {
    let lat = null, lng = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {}

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('viajes_bitacora')
      .update({ hora_llegada: now, gps_llegada_lat: lat, gps_llegada_lng: lng })
      .eq('id_bitacora', idBitacora)
      .select()
      .single();

    if (!error && data) {
      setBitacora(bitacora.map(b => b.id_bitacora === idBitacora ? (data as ViajeBitacora) : b));
      setNuevoOrigen(data.destino_nombre || '');
      if (data.destino_nombre !== 'Planta') {
        await supabase.from('locales_ruta').update({ hora_llegada: now, estado_visita: 'visitado' }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.destino_nombre);
      }
      if (data.destino_nombre === 'Planta') {
         await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', ruta?.id_ruta);
      }
    }
  };

  if (loading) return <div className="p-4 text-white text-center mt-10 italic animate-pulse">Cargando Sistema de Rutas...</div>;

  if (!ruta) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm">Selecciona tu ruta y vehículo para comenzar</p>
        </div>

        <Card className="border-primary/30 bg-surface shadow-2xl overflow-hidden relative">
           <div className="absolute top-0 right-0 p-4 opacity-5">
              <PlusCircle size={120} />
           </div>
           <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Plantilla de Ruta</label>
                    <div className="relative">
                       <select 
                         className="w-full bg-surface-light border-2 border-primary/20 rounded-xl px-4 py-3 text-white font-bold italic appearance-none focus:border-primary transition-colors"
                         value={selectedRutaBase}
                         onChange={e => setSelectedRutaBase(e.target.value)}
                       >
                         {rutasBase.map(r => (
                           <option key={r.id_ruta_base} value={r.id_ruta_base}>{r.nombre}</option>
                         ))}
                       </select>
                       <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Placa del Vehículo</label>
                    <Input 
                      placeholder="ABC-123" 
                      className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg"
                      value={nuevaPlaca}
                      onChange={e => setNuevaPlaca(e.target.value)}
                    />
                 </div>
              </div>

              <Button 
                onClick={handleCreateViaje}
                disabled={isCreating || !nuevaPlaca}
                className="w-full h-16 text-xl font-black italic bg-primary hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all active:scale-95"
              >
                {isCreating ? 'CREANDO...' : 'INICIAR MI RUTA'}
              </Button>
           </CardContent>
        </Card>

        <div className="text-center opacity-30 text-[10px] uppercase font-bold tracking-[0.2em] text-white">
           Gestión de Rutas Shimaya v5.2
        </div>
      </div>
    );
  }

  let proximoOrigen = 'Planta';
  if (bitacora.length > 0) {
    proximoOrigen = bitacora[bitacora.length - 1].destino_nombre || 'Planta';
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Mi Bitácora</h1>
          <p className="text-text-muted text-sm italic font-medium">{ruta.nombre} • <span className="text-primary font-black uppercase">{ruta.placa || 'Sin Placa'}</span></p>
        </div>
        <div className="bg-surface-light px-3 py-1 rounded-full border border-white/5">
           <span className="text-[10px] font-black text-primary italic uppercase tracking-widest">En Curso</span>
        </div>
      </div>

      {ruta.estado !== 'finalizada' && (
        <Card className="border-primary bg-primary/5 ring-1 ring-primary/20 overflow-hidden">
          <CardContent className="p-6">
             {tramoEnProgreso ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500 animate-pulse border border-blue-500/30">
                     <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-0.5">En Camino A</p>
                    <h3 className="text-xl font-black text-white italic leading-tight">{tramoEnProgreso.destino_nombre}</h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">Salió de {tramoEnProgreso.origen_nombre} a las {format(new Date(tramoEnProgreso.hora_salida!), 'HH:mm')}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => handleRegistrarLlegada(tramoEnProgreso.id_bitacora)}
                  className="w-full h-14 text-lg font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/30 border-b-4 border-blue-800"
                >
                  <Flag size={20} className="mr-2" /> MARCAR LLEGADA
                </Button>
              </div>
            ) : nuevoDestino ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest ml-1">Desde</p>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-sm italic">
                      {proximoOrigen}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest ml-1">Hacia</p>
                    <div className="relative">
                      <select 
                        value={nuevoDestino}
                        onChange={(e) => setNuevoDestino(e.target.value)}
                        className="w-full bg-surface-light border border-primary/40 rounded-xl px-3 py-3 text-white font-black italic appearance-none focus:outline-none focus:ring-1 focus:ring-primary text-sm shadow-inner"
                      >
                        {localesDisponibles.map(l => (
                          <option key={l.id_local_ruta} value={l.nombre || ''}>{l.nombre}</option>
                        ))}
                        {localesDisponibles.length === 0 && (locales.length > 0 && !localesRegistrados.includes('Planta') && bitacora.length > 0) && (
                          <option value="Planta">Regreso a Planta</option>
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-dashed border-white/10">
                   <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      <span className="text-xs text-text-muted uppercase font-bold">Tiempo Actual</span>
                   </div>
                   <span className="text-white font-black italic">{format(new Date(), 'HH:mm')}</span>
                </div>

                <Button 
                   onClick={() => {
                     setNuevoOrigen(proximoOrigen);
                     handleRegistrarSalida();
                   }}
                   className="w-full h-14 text-lg font-black bg-primary hover:bg-primary-hover shadow-xl shadow-primary/30 border-b-4 border-primary-dark"
                >
                  <Play size={20} className="mr-2" /> REGISTRAR SALIDA
                </Button>
              </div>
            ) : locales.length > 0 ? (
              <div className="text-center py-6 bg-green-500/5 rounded-2xl border border-green-500/20">
                 <CheckCircle2 size={48} className="text-green-500 mx-auto mb-2" />
                 <p className="text-white text-lg font-black italic uppercase">¡Ruta completada!</p>
                 <p className="text-text-muted text-sm">Ya has regresado a planta.</p>
              </div>
            ) : (
              <div className="text-center py-10 opacity-50 italic font-black text-white animate-pulse">
                CARGANDO PUNTOS DE ENTREGA...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BARRA DE PROGRESO */}
      <div className="bg-surface/50 p-4 rounded-2xl border border-white/5 space-y-3">
         <div className="flex justify-between text-[10px] uppercase font-black text-text-muted tracking-[0.2em]">
            <span>LOCALE VISITADOS</span>
            <span className="text-primary">{localesRegistrados.filter(l => l !== 'Planta').length} / {locales.length}</span>
         </div>
         <div className="h-3 bg-surface-light rounded-full overflow-hidden flex p-0.5 shadow-inner">
            {locales.map((l, i) => (
              <div 
                key={i} 
                className={`flex-1 mx-0.5 rounded-full transition-all duration-500 ${localesRegistrados.includes(l.nombre || '') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-surface'}`}
              />
            ))}
         </div>
      </div>

      <h3 className="text-xs font-black text-text-muted uppercase tracking-[0.3em] pt-6 flex items-center gap-2 italic">
         <div className="w-4 h-[1px] bg-text-muted opacity-20" />
         Bitácora de Movimientos
         <div className="flex-1 h-[1px] bg-gradient-to-r from-text-muted to-transparent opacity-20" />
      </h3>

      <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primary/30 before:to-surface-light/10">
        {bitacora.length > 0 ? (
          bitacora.map((tramo, idx) => (
            <div key={tramo.id_bitacora} className="flex gap-6 relative group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 text-xs font-black shadow-lg transition-all ${tramo.hora_llegada ? 'bg-green-500 text-black border-2 border-white/10' : 'bg-primary text-white animate-pulse ring-4 ring-primary/20'}`}>
                {idx + 1}
              </div>
              <div className="flex-1 bg-surface-light/10 border border-white/5 p-4 rounded-xl backdrop-blur-sm transition-all hover:bg-surface-light/20 group-hover:border-primary/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white italic tracking-tight uppercase">
                      {tramo.origen_nombre} <span className="text-primary mx-1">→</span> {tramo.destino_nombre}
                    </h4>
                    <div className="flex items-center gap-3 text-[9px] text-text-muted font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Clock size={10}/> {format(new Date(tramo.hora_salida!), 'HH:mm', { locale: es })}</span>
                      {tramo.hora_llegada && (
                        <span className="flex items-center gap-1 text-green-500 border-l border-white/10 pl-3">
                          <CheckCircle2 size={10}/> {format(new Date(tramo.hora_llegada), 'HH:mm', { locale: es })} ({Math.round(differenceInMinutes(new Date(tramo.hora_llegada), new Date(tramo.hora_salida!)))}m)
                        </span>
                      )}
                      {idx > 0 && bitacora[idx-1].hora_llegada && (
                         <span className="flex items-center gap-1 text-yellow-500 border-l border-white/10 pl-3">
                           <Timer size={10}/> {Math.round(differenceInMinutes(new Date(tramo.hora_salida!), new Date(bitacora[idx-1].hora_llegada!)))}m
                         </span>
                      )}
                    </div>
                  </div>
                  {!tramo.hora_llegada && (
                    <div className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border border-blue-500/20">
                       EN CAMINO
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 opacity-30 select-none bg-surface-light/10 rounded-2xl border border-dashed border-white/5">
            <Truck size={32} className="mx-auto mb-2" />
            <p className="text-sm italic font-bold">Inicia tu salida en Planta para comenzar</p>
          </div>
        )}
      </div>

      {ruta.estado === 'finalizada' && (
        <div className="bg-green-500/10 border-2 border-green-500/50 p-8 rounded-3xl text-center animate-in zoom-in-95 duration-700 shadow-2xl shadow-green-500/10">
            <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-lg shadow-green-500/20">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">¡Viaje Cerrado!</h3>
            <p className="text-green-500/80 text-sm font-bold">Bitácora completada y registrada en el sistema.</p>
        </div>
      )}
    </div>
  );
}
