import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import type { Ruta, LocalRuta, ViajeBitacora } from '../../types';
import RegistrarCombustible from './combustible/Registrar';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModalEvidencia } from './viaje/components/ModalEvidencia';
import { TramoBitacora } from './viaje/components/TramoBitacora';
import { formatPeru, nowPeru } from '../../lib/timezone';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Truck, 
  PlusCircle,
  ChevronDown,
  Flag,
  Play,
  Timer,
  Fuel,
  Edit2,
  X,
  Check,
  Camera,
  Image,
  ListTodo,
  Navigation,
  MessageCircle
} from 'lucide-react';

export default function DriverViaje() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [bitacora, setBitacora] = useState<ViajeBitacora[]>([]);
  
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Selection/Creation state
  const [rutasBase, setRutasBase] = useState<any[]>([]);
  const [loadingRutasBase, setLoadingRutasBase] = useState(true); // true inicialmente para evitar flash
  const [rutasBaseLoaded, setRutasBaseLoaded] = useState(false); // Flag para evitar recargas duplicadas
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false); // Track si ya intentamos cargar
  const [selectedRutaBase, setSelectedRutaBase] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState(profile?.placa_camion || '');
  const [createError, setCreateError] = useState('');

  // Si el perfil ya tiene placa, usarla por defecto y deshabilitar edición
  const tienePlacaAsignada = !!(profile?.placa_camion);

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 3) {
      val = val.substring(0, 3) + '-' + val.substring(3, 6);
    }
    setNuevaPlaca(val);
  };

  const [nuevoDestino, setNuevoDestino] = useState('');
  const [showCombustible, setShowCombustible] = useState(false);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  
  // Estado para capturar fotos de evidencia
  const [localParaFoto, setLocalParaFoto] = useState<LocalRuta | null>(null);

  // Estado para editar horas de bitácora
  const [editandoBitacora, setEditandoBitacora] = useState<string | null>(null);
  const [editHoraSalida, setEditHoraSalida] = useState('');
  const [editHoraLlegada, setEditHoraLlegada] = useState('');

  // Estado para volver a local anterior
  const [mostrarLocalesVisitados, setMostrarLocalesVisitados] = useState(false);
  const [showResumenRuta, setShowResumenRuta] = useState(false);
  const [esHistorial, setEsHistorial] = useState(false);

  const loadViajeData = async (idRuta: string) => {
    const { data: localesData } = await supabase
      .from('locales_ruta')
      .select('*')
      .eq('id_ruta', idRuta)
      .order('orden', { ascending: true });
    if (localesData) setLocales(localesData as LocalRuta[]);

    const { data: bitacoraData } = await supabase
      .from('viajes_bitacora')
      .select('*')
      .eq('id_ruta', idRuta)
      .order('created_at', { ascending: true });
    setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
  };

  const iniciarNuevoViaje = () => {
    if (esHistorial) {
      navigate('/driver/viaje');
    } else {
      setRuta(null);
      setLocales([]);
      setBitacora([]);
      setEsHistorial(false);
      loadRutasBase();
    }
  };

  const handleEditarHora = (tramo: ViajeBitacora) => {
    setEditandoBitacora(tramo.id_bitacora);
    setEditHoraSalida(tramo.hora_salida ? formatoHoraInput(new Date(tramo.hora_salida)) : '');
    setEditHoraLlegada(tramo.hora_llegada ? formatoHoraInput(new Date(tramo.hora_llegada)) : '');
  };

  const formatoHoraInput = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const guardarEdicionHora = async (tramo: ViajeBitacora) => {
    if (!editHoraSalida) return;
    
    const [hS, mS] = editHoraSalida.split(':').map(Number);
    const fechaBase = new Date(tramo.hora_salida);
    const nuevaSalida = new Date(fechaBase);
    nuevaSalida.setHours(hS, mS, 0, 0);

    let nuevaLlegada: Date | null = null;
    if (editHoraLlegada && editHoraLlegada !== '') {
      const [hL, mL] = editHoraLlegada.split(':').map(Number);
      const fechaBaseL = new Date(tramo.hora_llegada || tramo.hora_salida);
      nuevaLlegada = new Date(fechaBaseL);
      nuevaLlegada.setHours(hL, mL, 0, 0);
    }

    if (nuevaLlegada && nuevaLlegada <= nuevaSalida) {
      showToast('error', 'La hora de llegada no puede ser anterior a la hora de salida');
      return;
    }

    // Validar que no sea antes que la llegada del tramo anterior
    const idxActual = bitacora.findIndex(b => b.id_bitacora === tramo.id_bitacora);
    if (idxActual > 0) {
      const tramoAnterior = bitacora[idxActual - 1];
      if (tramoAnterior.hora_llegada && nuevaSalida < new Date(tramoAnterior.hora_llegada)) {
        showToast('error', 'La hora de salida no puede ser anterior a la llegada del tramo anterior');
        return;
      }
    }

    const updates: any = { hora_salida: nuevaSalida.toISOString() };
    if (nuevaLlegada) {
      updates.hora_llegada = nuevaLlegada.toISOString();
    }

    await supabase.from('viajes_bitacora').update(updates).eq('id_bitacora', tramo.id_bitacora);
    
    // Ajustar horas de tramos siguientes si es necesario
    let bitacoraActualizada = bitacora.map(b => 
      b.id_bitacora === tramo.id_bitacora 
        ? { ...b, ...updates } 
        : b
    );

    // Si se editó la llegada, ajustar la salida del siguiente tramo
    if (nuevaLlegada && idxActual < bitacoraActualizada.length - 1) {
      const siguienteTramo = bitacoraActualizada[idxActual + 1];
      const horaSalidaSiguiente = new Date(siguienteTramo.hora_salida);
      if (nuevaLlegada > horaSalidaSiguiente) {
        // Ajustar salida del siguiente para que sea igual o después de la llegada
        const nuevaSalidaSiguiente = new Date(nuevaLlegada);
        await supabase.from('viajes_bitacora').update({ hora_salida: nuevaSalidaSiguiente.toISOString() }).eq('id_bitacora', siguienteTramo.id_bitacora);
        bitacoraActualizada = bitacoraActualizada.map(b => 
          b.id_bitacora === siguienteTramo.id_bitacora 
            ? { ...b, hora_salida: nuevaSalidaSiguiente.toISOString() } 
            : b
        );
      }
    }

    setBitacora(bitacoraActualizada);
    setEditandoBitacora(null);
  };

  const loadCurrentRuta = async () => {
    console.log('[loadCurrentRuta] INICIO');
    if (!profile) {
      setLoading(false);
      console.log('[loadCurrentRuta] SIN PERFIL');
      return;
    }
    setLoading(true);

    // Verificar si hay un ID de ruta histórico en la URL
    const pathParts = window.location.pathname.split('/historial/');
    
    try {
      // Si hay ID en URL, cargar esa ruta específica
      if (pathParts.length > 1) {
        const rutaIdFromUrl = pathParts[1];
        console.log('[loadCurrentRuta] Cargando ruta histórica:', rutaIdFromUrl);
        const { data: rutaHistorica, error: rhError } = await supabase
          .from('rutas')
          .select('*')
          .eq('id_ruta', rutaIdFromUrl)
          .eq('id_chofer', profile.id_usuario)
          .maybeSingle();
        
        if (rhError) console.error('Error loading ruta histórica:', rhError);
        
        if (rutaHistorica) {
          setRuta(rutaHistorica as Ruta);
          setEsHistorial(true);
          
          const { data: localesData, error: locError } = await supabase
            .from('locales_ruta')
            .select('*')
            .eq('id_ruta', rutaHistorica.id_ruta)
            .order('orden', { ascending: true });
          
          if (locError) console.error('Error loading locales_ruta:', locError);
          if (localesData) setLocales(localesData as LocalRuta[]);

          const { data: bitacoraData, error: bitError } = await supabase
            .from('viajes_bitacora')
            .select('*')
            .eq('id_ruta', rutaHistorica.id_ruta)
            .order('created_at', { ascending: true });
          
          if (bitError) console.error('Error loading bitacora:', bitError);
          setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
          
          await loadRutasBase();
          setLoading(false);
          return;
        }
      }

      // Primero buscar ruta activa (pendiente o en_progreso)
      const { data: rutaActiva, error: rError } = await supabase
        .from('rutas')
        .select('*')
        .eq('id_chofer', profile.id_usuario)
        .in('estado', ['pendiente', 'en_progreso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 
      
      // Si hay ruta activa, usarla
      if (rutaActiva) {
        setRuta(rutaActiva as Ruta);
        
        const { data: localesData, error: locError } = await supabase
          .from('locales_ruta')
          .select('*')
          .eq('id_ruta', rutaActiva.id_ruta)
          .order('orden', { ascending: true });
        
        if (locError) console.error('Error loading locales_ruta:', locError);
        if (localesData) setLocales(localesData as LocalRuta[]);

        const { data: bitacoraData, error: bitError } = await supabase
          .from('viajes_bitacora')
          .select('*')
          .eq('id_ruta', rutaActiva.id_ruta)
          .order('created_at', { ascending: true });
        
if (bitError) console.error('Error loading bitacora:', bitError);
        setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
        
        // Cargar rutas base SIEMPRE (para el selector) - aquí fuera del if para ejecutarse siempre
        await loadRutasBase();
      } else {
        // Si no hay ruta activa, buscar la ruta finalizada de HOY
        const today = new Date().toISOString().split('T')[0];
        const { data: rutaFinalizada, error: rfError } = await supabase
          .from('rutas')
          .select('*')
          .eq('id_chofer', profile.id_usuario)
          .eq('estado', 'finalizada')
          .eq('fecha', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rfError) console.error('Error loading ruta finalizada:', rfError);
        
        if (rutaFinalizada) {
          // Mostrar la ruta finalizada para poder agregar fotos
          setRuta(rutaFinalizada as Ruta);
          
          const { data: localesData, error: locError } = await supabase
            .from('locales_ruta')
            .select('*')
            .eq('id_ruta', rutaFinalizada.id_ruta)
            .order('orden', { ascending: true });
          
          if (locError) console.error('Error loading locales_ruta:', locError);
          if (localesData) setLocales(localesData as LocalRuta[]);

          const { data: bitacoraData, error: bitError } = await supabase
            .from('viajes_bitacora')
            .select('*')
            .eq('id_ruta', rutaFinalizada.id_ruta)
            .order('created_at', { ascending: true });
          
          if (bitError) console.error('Error loading bitacora:', bitError);
          setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
        } else {
          setRuta(null);
          setLocales([]);
          setBitacora([]);
        }
        
        // Cargar rutas base SIEMPRE (para el selector)
        await loadRutasBase();
      }
    } catch (err: any) {
      console.error('Error cargando datos de viaje:', err);
      if (err.message?.includes('policy') || err.code === '42501') {
        setLoadError('Error de permisos (RLS). Contacta al administrador.');
      } else {
        setLoadError('No se pudo cargar la información. Reintenta.');
      }
    } finally {
      console.log('[loadCurrentRuta] FIN loading=false');
      setLoading(false);
    }
  };

  const loadRutasBase = async (force = false) => {
    console.log('[loadRutasBase] INICIO force:', force, 'loadingRutasBase:', loadingRutasBase, 'rutasBaseLoaded:', rutasBaseLoaded);
    // Evitar cargas duplicadas si ya se cargó (a menos que force=true)
    if (rutasBaseLoaded && !force && rutasBase.length > 0) {
      console.log('[loadRutasBase] SKIP (ya cargado)');
      return;
    }
    console.log('[loadRutasBase] EJECUTANDO, profile:', profile?.id_usuario);
    setLoadingRutasBase(true);
    console.log('[Viaje] loadRutasBase -> loadingRutasBase=true');
    try {
      const { data: baseData, error: rbError } = await supabase
        .from('rutas_base')
        .select('*')
        .order('nombre');
        
      console.log('[Viaje] rutas_base response:', baseData, rbError);
        
      if (rbError) {
        console.error('Error loading rutas base:', rbError);
        setLoadingRutasBase(false);
        return;
      }

      if (baseData && baseData.length > 0) {
        const withCounts = await Promise.all(baseData.map(async (rb) => {
          try {
            const { count, error: cError } = await supabase
              .from('locales_base')
              .select('id_local_base', { count: 'exact', head: true })
              .eq('id_ruta_base', rb.id_ruta_base);
            
            console.log(`[Viaje] count for ${rb.nombre}:`, count, cError);
            if (cError) console.error(`Error counting locales for ${rb.nombre}:`, cError);
            return { ...rb, locales_count: count ?? 0 };
          } catch (e) {
            console.error(`Error counting locales for ${rb.nombre}:`, e);
            return { ...rb, locales_count: 0 };
          }
        }));
        
        console.log('[Viaje] Final rutasBase:', withCounts);
        console.log('[loadRutasBase] ACABA DE CARGAR, count:', withCounts.length);
        setRutasBase(withCounts);
        setRutasBaseLoaded(true);
        setLoadedAtLeastOnce(true);
        console.log('[loadRutasBase] setRutasBase + flags DONE, total:', withCounts.length);
        setLoadingRutasBase(false);
      } else {
        console.log('[loadRutasBase] No hay plantillas');
        setRutasBase([]);
        setRutasBaseLoaded(true);
        setLoadedAtLeastOnce(true);
        setLoadingRutasBase(false);
      }
    } catch (err) {
      console.error('Error loading rutas base:', err);
      setLoadingRutasBase(false);
    }
  };

  useEffect(() => {
    // Si no hay perfil, no cargamos nada
    if (!profile?.id_usuario) {
      setLoading(false);
      return;
    }

    loadCurrentRuta(); // Esto internamente llama loadRutasBase si necesita

    // Suscripción Realtime específica para ESTE chofer
    const channel = supabase
      .channel(`viaje_chofer_${profile.id_usuario}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rutas',
        filter: `id_chofer=eq.${profile.id_usuario}` 
      }, () => loadCurrentRuta())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes_bitacora' }, () => loadCurrentRuta())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locales_ruta' }, () => loadCurrentRuta())
      .subscribe();

    window.addEventListener('online', loadCurrentRuta);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', loadCurrentRuta);
    };
  }, [profile?.id_usuario]);

  const handleCreateViaje = async () => {
    if (!selectedRutaBase || !profile) return;
    if (!nuevaPlaca.trim() && !tienePlacaAsignada) {
      setCreateError('Por favor ingresa la placa del vehículo.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    
    try {
      const baseRuta = rutasBase.find(r => r.id_ruta_base === selectedRutaBase);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data: baseLocales, error: lbError } = await supabase
        .from('locales_base')
        .select('*')
        .eq('id_ruta_base', selectedRutaBase)
        .order('orden', { ascending: true });

      if (lbError) {
        setCreateError(`Error al consultar locales base: ${lbError.message}`);
        return;
      }
      
      if (!baseLocales || baseLocales.length === 0) {
        setCreateError('Esta plantilla no tiene locales configurados. Pide al administrador que los agregue.');
        setIsCreating(false);
        return;
      }

      if (esHistorial) {
        setCreateError('No puedes crear un nuevo viaje desde el historial.');
        setIsCreating(false);
        return;
      }

      const { data: newRuta, error: rError } = await supabase.from('rutas').insert({
        nombre: baseRuta.nombre,
        id_ruta_base: selectedRutaBase,
        id_chofer: profile.id_usuario,
        placa: nuevaPlaca.trim().toUpperCase(),
        fecha: today,
        estado: 'pendiente'
      }).select().single();

      if (rError) throw rError;

      const localesRuta = baseLocales.map(bl => ({
        id_ruta: newRuta.id_ruta,
        id_local_base: bl.id_local_base,
        nombre: bl.nombre,
        direccion: bl.direccion ?? null,
        latitud: bl.latitud ?? null,
        longitud: bl.longitud ?? null,
        orden: bl.orden,
        estado_visita: 'pendiente'
      }));

      const { error: insertError } = await supabase.from('locales_ruta').insert(localesRuta);
      if (insertError) throw insertError;

      await loadCurrentRuta();
    } catch (e: any) {
      console.error('[Viaje] Error al crear viaje:', e);
      setCreateError('Error al crear el viaje: ' + (e.message || JSON.stringify(e)));
    } finally {
      setIsCreating(false);
    }
  };

  const localesRegistrados = bitacora.filter(b => b.hora_llegada).map(b => b.destino_nombre);
  const localesDisponibles = locales.filter(l => !localesRegistrados.includes(l.nombre || ''));
  const localesVisitados = locales.filter(l => 
    localesRegistrados.includes(l.nombre || '') && l.nombre !== 'Planta'
  );
  const tramoEnProgreso = bitacora.find(b => !b.hora_llegada);

  useEffect(() => {
    if (!tramoEnProgreso) {
      if (localesDisponibles.length > 0) {
        setNuevoDestino(localesDisponibles[0].nombre || '');
      } else if (locales.length > 0 && !localesRegistrados.includes('Planta') && bitacora.length > 0) {
        setNuevoDestino('Planta');
      } else {
        setNuevoDestino('');
      }
    }
  }, [bitacora, locales, localesDisponibles.length]);

  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingDestino, setIsEditingDestino] = useState(false);
  const [destinoEditado, setDestinoEditado] = useState('');
  const [isSavingDestino, setIsSavingDestino] = useState(false);

  const handleRegistrarSalida = async () => {
    if (!ruta || !nuevoDestino || actionLoading) return;
    if (esHistorial) {
      alert('No puedes modificar un viaje histórico');
      return;
    }
    const origen = proximoOrigen;
    
    setActionLoading(true);
    let lat = null, lng = null;
    try {
      // Máximo 2 segundos al GPS para la salida, si no, avanzamos sin él
      const pos = await new Promise<any>((res) => {
        const timeout = setTimeout(() => res(null), 2000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timeout); res(p); },
          (e) => { clearTimeout(timeout); res(null); },
          { timeout: 2000, enableHighAccuracy: false }
        );
      });
      if (pos) {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (e) {
      console.warn('GPS Error:', e);
    }

    const { data, error } = await supabase
      .from('viajes_bitacora')
      .insert([{
        id_ruta: ruta.id_ruta,
        id_chofer: profile?.id_usuario,
        origen_nombre: origen,
        destino_nombre: nuevoDestino,
        hora_salida: nowPeru(),
        gps_salida_lat: lat,
        gps_salida_lng: lng
      }])
      .select()
      .single();

    if (!error && data) {
      setBitacora([...bitacora, data as ViajeBitacora]);
      if (origen !== 'Planta') {
        await supabase.from('locales_ruta').update({ hora_salida: data.hora_salida }).eq('id_ruta', ruta.id_ruta).eq('nombre', origen);
      }
      if (bitacora.length === 0) {
        await supabase.from('rutas').update({ estado: 'en_progreso', hora_salida_planta: data.hora_salida }).eq('id_ruta', ruta.id_ruta);
      }
    } else if (error) {
      console.error('[Viaje] Error registrar salida:', error);
      showToast('error', 'Error en salida: ' + error.message);
    }
    setActionLoading(false);
  };

  const handleRegistrarLlegada = async (idBitacora: string) => {
    if (actionLoading) return; 
    if (esHistorial) {
      alert('No puedes modificar un viaje histórico');
      return;
    }
    
    setActionLoading(true);
    let lat = null, lng = null;
    try {
      // Máximo 2 segundos al GPS, si no responde, avanzamos sin él
      const pos = await new Promise<any>((res) => {
        const timeout = setTimeout(() => res(null), 2000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timeout); res(p); },
          (e) => { clearTimeout(timeout); res(null); },
          { timeout: 2000, enableHighAccuracy: false }
        );
      });
      if (pos) {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (e) {
      console.warn('GPS Error:', e);
    }

    const now = nowPeru();
    const { data, error } = await supabase
      .from('viajes_bitacora')
      .update({ hora_llegada: now, gps_llegada_lat: lat, gps_llegada_lng: lng })
      .eq('id_bitacora', idBitacora)
      .select()
      .single();

    if (!error && data) {
      setBitacora(bitacora.map(b => b.id_bitacora === idBitacora ? (data as ViajeBitacora) : b));
      
      // Solo marcar como visitado si NO era un detour (ya estaba registrado previamente)
      const eraDetour = localesRegistrados.includes(data.destino_nombre || '');
      
      if (data.destino_nombre !== 'Planta' && !eraDetour) {
        await supabase.from('locales_ruta').update({ hora_llegada: now, estado_visita: 'visitado' }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.destino_nombre);
      }
      if (data.destino_nombre === 'Planta') {
         await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', ruta?.id_ruta);
         if (ruta) setRuta({ ...ruta, estado: 'finalizada' });
      }
    } else if (error) {
      console.error('[Viaje] Error registrar llegada:', error);
      showToast('error', 'Error en llegada: ' + error.message);
    }
    setActionLoading(false);
  };

  if (loading) return <div className="p-4 text-white text-center mt-10 italic animate-pulse">Cargando Sistema de Rutas...</div>;

  // Helper: verificar si la ruta es de hoy o es historial
  const esRutaDeHoy = (r: Ruta | null) => {
    if (!r) return false;
    if (esHistorial) return true; // Si es modo historial, siempre mostrar
    const today = new Date().toISOString().split('T')[0];
    return r.fecha === today;
  };

  // Si no hay ruta O si hay ruta finalizada que NO es de hoy → mostrar formulario crear
  // Si hay ruta activa O ruta finalizada de hoy O es historial → mostrar la ruta
  const mostrarRuta = ruta && (ruta.estado !== 'finalizada' || esRutaDeHoy(ruta));

  // NO mostrar formulario hasta que loading principal termine
  if (loading) return <div className="p-4 text-white text-center mt-10 italic animate-pulse">Cargando Sistema de Rutas...</div>;

  // Mientras cargan las plantillas, mostrar spinner (pero NO el formulario)
  if (!mostrarRuta && (loadingRutasBase || !rutasBaseLoaded)) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  // NEW: Si loadingRutasBase aún está trueno mostrar loading en lugar del formulario
  if (!mostrarRuta && loadingRutasBase) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm animate-pulse">Cargando plantillas...</p>
        </div>
      </div>
    );
  }

  if (!mostrarRuta) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm">Selecciona una plantilla y placa para iniciar tu ruta del día.</p>
        </div>

        <Card className="border-primary/30 bg-surface shadow-2xl overflow-hidden relative">
           <div className="absolute top-0 right-0 p-4 opacity-5">
              <PlusCircle size={120} />
           </div>
           <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                  <div className="space-y-1">
<label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Plantilla de Ruta</label>
                      {loadingRutasBase ? (
                        <div className="bg-surface-light rounded-xl px-4 py-3 text-text-muted text-sm">
                          ⏳ Cargando plantillas...
                        </div>
                      ) : !rutasBase.length ? (
                        <div className="bg-surface-light rounded-xl px-4 py-3 text-text-muted text-sm">
                          Selecciona una plantilla...
                        </div>
                      ) : (
                      <div className="relative">
                       <select
                            className="w-full bg-surface-light border-2 border-primary/20 rounded-xl px-4 py-3 text-white font-bold italic appearance-none focus:border-primary transition-colors cursor-pointer"
                            value={selectedRutaBase}
                            onChange={e => setSelectedRutaBase(e.target.value)}
                          >
                            <option value="" disabled>Elige tu ruta...</option>
                            {rutasBase.map(r => (
                              <option key={r.id_ruta_base} value={r.id_ruta_base} className="bg-surface text-white">
                                {r.nombre} ({r.locales_count} paradas)
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                            <ChevronDown size={20} className="text-primary" />
                          </div>
                       </div>
                      )}
                 </div>

                  <div className="space-y-1">
                     <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">
                       {tienePlacaAsignada ? '🚛 Vehículo Asignado' : 'Placa del Vehículo'}
                     </label>
                     {tienePlacaAsignada ? (
                       <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl px-4 py-3 text-green-400 font-black italic uppercase text-lg tracking-widest text-center">
                         {nuevaPlaca}
                       </div>
                     ) : (
                       <Input 
                         placeholder="ABC-123" 
                         className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg tracking-widest"
                         value={nuevaPlaca}
                         onChange={handlePlacaChange}
                         maxLength={7}
                       />
                     )}
                  </div>

                 {createError && (
                   <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
                     ❌ {createError}
                   </div>
                 )}
                 {loadError && (
                   <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
                     ❌ {loadError}
                   </div>
                 )}
              </div>

              <Button 
                onClick={handleCreateViaje}
                disabled={isCreating || !selectedRutaBase || (!nuevaPlaca.trim() && !tienePlacaAsignada) || rutasBase.length === 0}
                className="w-full h-16 text-xl font-black italic bg-primary hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isCreating ? '⏳ CREANDO RUTA...' : '🚛 INICIAR MI RUTA'}
              </Button>
           </CardContent>
        </Card>
      </div>
    );
  }

  let proximoOrigen = 'Planta';
  if (bitacora.length > 0) {
    proximoOrigen = bitacora[bitacora.length - 1].destino_nombre || 'Planta';
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/driver')}
          className="w-fit text-text-muted hover:text-white -ml-2"
        >
          ← VOLVER AL TABLERO
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Mi Bitácora</h1>
            <p className="text-text-muted text-sm italic font-medium">{ruta.nombre} • <span className="text-primary font-black uppercase">{ruta.placa || 'Sin Placa'}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate(`/driver/ruta/${ruta.id_ruta}`)}
              className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
            >
              <MapPin size={16} className="mr-1" />
              Ver Locales
            </Button>
            <div className="bg-surface-light px-3 py-1 rounded-full border border-white/5">
               <span className="text-[10px] font-black text-primary italic uppercase tracking-widest">En Curso</span>
            </div>
          </div>
        </div>
      </div>

      {ruta.estado !== 'finalizada' && (
        <Button 
          className="w-full bg-green-600/20 text-green-400 hover:bg-green-600/30 border-green-600/50 py-3 font-bold"
          onClick={() => setShowCombustible(true)}
        >
          <Fuel size={18} className="mr-2" />
          Registrar Combustible
        </Button>
      )}

      {/* Botón para tomar fotos - solo cuando está EN EL LOCAL (después de llegar, antes de salir) */}
      {tramoEnProgreso && (
        <Button 
          className="w-full bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border-purple-600/50 py-4 font-bold"
          onClick={() => {
            const localActual = locales.find(l => l.nombre === tramoEnProgreso.destino_nombre);
            if (localActual) setLocalParaFoto(localActual);
          }}
          disabled={!locales.find(l => l.nombre === tramoEnProgreso.destino_nombre)}
        >
          <Camera size={20} className="mr-2" />
          📸 Tomar Evidencia - {tramoEnProgreso.destino_nombre}
        </Button>
      )}

      {/* Después de marcar llegada pero antes de salir - fotos del local donde está */}
      {!tramoEnProgreso && bitacora.length > 0 && bitacora[bitacora.length - 1].hora_llegada && ruta.estado !== 'finalizada' && (
        <Button 
          className="w-full bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border-purple-600/50 py-4 font-bold"
          onClick={() => {
            const ultimoTramo = bitacora[bitacora.length - 1];
            const localActual = locales.find(l => l.nombre === ultimoTramo.destino_nombre);
            if (localActual) setLocalParaFoto(localActual);
          }}
        >
          <Camera size={20} className="mr-2" />
          📸 Tomar Evidencia - {bitacora[bitacora.length - 1].destino_nombre}
        </Button>
      )}

      {/* Botón para agregar fotos a cualquier local visitado */}
      {ruta.estado !== 'finalizada' && locales.some(l => l.hora_llegada) && (
        <div className="mt-4 p-3 bg-surface-light/30 rounded-xl border border-white/5">
          <p className="text-[10px] text-text-muted mb-2 uppercase font-bold">Agregar foto a local anterior:</p>
          <select 
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            onChange={(e) => {
              const local = locales.find(l => l.id_local_ruta === e.target.value);
              if (local) setLocalParaFoto(local);
            }}
            value=""
          >
            <option value="">Seleccionar local...</option>
            {locales.filter(l => l.hora_llegada).map(local => (
              <option key={local.id_local_ruta} value={local.id_local_ruta}>
                {local.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {ruta.estado !== 'finalizada' && (
        <Card className="border-primary bg-primary/5 ring-1 ring-primary/20 overflow-hidden">
          <CardContent className="p-6">
             {tramoEnProgreso ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-500 animate-pulse border border-blue-500/30">
                     <Clock size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-0.5">En Camino A</p>
                    
                    {isEditingDestino ? (
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        <select 
                          value={destinoEditado}
                          onChange={(e) => setDestinoEditado(e.target.value)}
                          className="flex-1 bg-surface-light border border-blue-500/40 rounded-lg px-2 py-2 text-white font-black italic text-sm focus:outline-none focus:border-blue-500"
                        >
                          {localesDisponibles.map((l) => (
                            <option key={l.id_local_ruta} value={l.nombre || ''}>{l.nombre}</option>
                          ))}
                          {localesDisponibles.length === 0 && (
                            <option value="Planta">Planta</option>
                          )}
                          {!localesDisponibles.find(l => l.nombre === tramoEnProgreso.destino_nombre) && (
                             <option value={tramoEnProgreso.destino_nombre || ''}>{tramoEnProgreso.destino_nombre}</option>
                          )}
                        </select>
                        <Button 
                          size="sm" 
                          onClick={async () => {
                            if (!destinoEditado || isSavingDestino || destinoEditado === tramoEnProgreso.destino_nombre) {
                              setIsEditingDestino(false);
                              return;
                            }
                            setIsSavingDestino(true);
                            const { data, error } = await supabase
                              .from('viajes_bitacora')
                              .update({ destino_nombre: destinoEditado })
                              .eq('id_bitacora', tramoEnProgreso.id_bitacora)
                              .select().single();
                            if (!error && data) {
                              setBitacora(bitacora.map(b => b.id_bitacora === tramoEnProgreso.id_bitacora ? (data as ViajeBitacora) : b));
                              setIsEditingDestino(false);
                            } else {
                              showToast('error', 'Error al actualizar destino');
                            }
                            setIsSavingDestino(false);
                          }}
                          disabled={isSavingDestino}
                          className="bg-blue-600 hover:bg-blue-500 h-10 w-10 p-0 flex items-center justify-center rounded-lg min-w-[40px]"
                        >
                          <Check size={18} />
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => setIsEditingDestino(false)}
                          disabled={isSavingDestino}
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 h-10 w-10 p-0 flex items-center justify-center rounded-lg min-w-[40px]"
                        >
                          <X size={18} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <h3 className="text-xl font-black text-white italic leading-tight">{tramoEnProgreso.destino_nombre}</h3>
                        <div className="flex items-center gap-1">
                          {(function() {
                            const localActual = locales.find(l => l.nombre === tramoEnProgreso.destino_nombre);
                            if (localActual?.latitud && localActual?.longitud) {
                              const latDest = localActual.latitud;
                              const lonDest = localActual.longitud;
                              
                              // dir_action=navigate le dice a Google Maps que arranque a navegar desde la ubicación actual nativa del celular
                              const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${latDest},${lonDest}&travelmode=driving&dir_action=navigate`;
                              const wazeUrl = `https://waze.com/ul?ll=${latDest},${lonDest}&navigate=yes`;

                              return (
                                <>
                                  <a
                                    href={googleUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 bg-blue-500/20 hover:bg-blue-500/30 p-1.5 rounded-md transition-colors inline-block"
                                    title="Navegar con Google Maps"
                                  >
                                    <MapPin size={16} />
                                  </a>
                                  <a
                                    href={wazeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-yellow-400 hover:text-yellow-300 bg-yellow-500/20 hover:bg-yellow-500/30 p-1.5 rounded-md transition-colors inline-block"
                                    title="Navegar con Waze"
                                  >
                                    <Navigation size={16} />
                                  </a>
                                </>
                              );
                            }
                            return null;
                          })()}
                          
                          {(function() {
                            const localesConCoords = locales.filter(l => l.latitud && l.longitud);
                            if (localesConCoords.length > 1) {
                              const waypoints = localesConCoords.slice(1, -1).map(l => `${l.latitud},${l.longitud}`);
                              // Ruta global usando el primer local como origen 
                              const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${localesConCoords[0].latitud},${localesConCoords[0].longitud}&destination=${localesConCoords[localesConCoords.length - 1].latitud},${localesConCoords[localesConCoords.length - 1].longitud}${waypoints.length > 0 ? '&waypoints=' + waypoints.join('|') : ''}&travelmode=driving`;
                              
                              return (
                                <a 
                                  href={routeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-400 hover:text-green-300 bg-green-500/20 hover:bg-green-500/30 p-1.5 rounded-md transition-colors inline-block"
                                  title="Ver ruta completa de hoy"
                                >
                                  <Truck size={16} />
                                </a>
                              );
                            }
                            return null;
                          })()}
                          <button 
                            onClick={() => {
                              setDestinoEditado(tramoEnProgreso.destino_nombre || '');
                              setIsEditingDestino(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 bg-blue-500/20 hover:bg-blue-500/30 p-1.5 rounded-md transition-colors"
                            title="Corregir destino"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter mt-1">Salió de {tramoEnProgreso.origen_nombre} a las {formatPeru(tramoEnProgreso.hora_salida!, 'HH:mm')}</p>
                  </div>
                </div>
                 <Button 
                   onClick={() => handleRegistrarLlegada(tramoEnProgreso.id_bitacora)}
                   disabled={actionLoading}
                   className="w-full h-14 text-lg font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/30 border-b-4 border-blue-800 disabled:opacity-70"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                       <Clock className="animate-spin" size={20} /> REGISTRANDO...
                    </span>
                  ) : (
                    <>
                      <Flag size={20} className="mr-2" /> MARCAR LLEGADA
                    </>
                  )}
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

                {mostrarLocalesVisitados ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
                    <p className="text-yellow-400 text-xs font-bold uppercase">↩️ Selecciona a dónde vuelves:</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {localesVisitados.map((l, idx) => {
                        const tramo = bitacora.find(b => b.destino_nombre === l.nombre);
                        const tiempoHace = tramo?.hora_llegada 
                          ? Math.round((new Date().getTime() - new Date(tramo.hora_llegada).getTime()) / 60000)
                          : 0;
                        return (
                          <button
                            key={l.id_local_ruta}
                            onClick={() => {
                              setNuevoDestino(l.nombre || '');
                              setMostrarLocalesVisitados(false);
                            }}
                            className="w-full text-left p-2 bg-surface rounded-lg border border-yellow-500/20 hover:bg-yellow-500/20 flex justify-between items-center"
                          >
                            <span className="text-white text-sm font-bold">{l.nombre}</span>
                            <span className="text-yellow-400 text-xs">hace {tiempoHace} min</span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setMostrarLocalesVisitados(false)}
                      className="text-xs text-text-muted underline hover:text-white"
                    >
                      ← Volver al flujo normal
                    </button>
                  </div>
                ) : localesVisitados.length > 0 && (
                  <button 
                    onClick={() => setMostrarLocalesVisitados(true)}
                    className="text-xs text-yellow-400 underline hover:text-yellow-300 w-full text-left mt-2 flex items-center gap-1"
                  >
                    ↩️ ¿Necesitas volver a un local anterior?
                  </button>
                )}
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-dashed border-white/10">
                   <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      <span className="text-xs text-text-muted uppercase font-bold">Hora actual</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-white font-black text-lg italic">
                       {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                     </span>
                     <button 
                       onClick={() => setShowResumenRuta(true)}
                       className="bg-green-600/20 border border-green-500/30 p-2 rounded-lg hover:bg-green-600/30"
                     >
                       <ListTodo size={18} className="text-green-400" />
                     </button>
                   </div>
                </div>

                <Button 
                   onClick={handleRegistrarSalida}
                   disabled={actionLoading}
                   className="w-full h-14 text-lg font-black bg-primary hover:bg-primary-hover shadow-xl shadow-primary/30 border-b-4 border-primary-dark disabled:opacity-70"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                       <Clock className="animate-spin" size={20} /> REGISTRANDO...
                    </span>
                  ) : (
                    <>
                      <Play size={20} className="mr-2" /> REGISTRAR SALIDA
                    </>
                  )}
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
            <span>LOCALES VISITADOS</span>
            <span className="text-primary">{localesRegistrados.filter(l => l !== 'Planta').length} / {locales.filter(l => l.nombre !== 'Planta').length}</span>
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
            <TramoBitacora
              key={tramo.id_bitacora}
              tramo={tramo}
              idx={idx}
              esUltimo={idx === bitacora.length - 1}
              editando={editandoBitacora === tramo.id_bitacora}
              editHoraSalida={editHoraSalida}
              editHoraLlegada={editHoraLlegada}
              onEdit={() => handleEditarHora(tramo)}
              onSave={() => guardarEdicionHora(tramo)}
              onCancel={() => setEditandoBitacora(null)}
              onSetHoraSalida={setEditHoraSalida}
              onSetHoraLlegada={setEditHoraLlegada}
              tramoAnterior={idx > 0 ? bitacora[idx - 1] : undefined}
            />
          ))
        ) : (
          <div className="text-center py-10 opacity-30 select-none bg-surface-light/10 rounded-2xl border border-dashed border-white/5">
            <Truck size={32} className="mx-auto mb-2" />
            <p className="text-sm italic font-bold">Inicia tu salida en Planta para comenzar</p>
          </div>
        )}
      </div>

      {ruta.estado === 'finalizada' && (
        <>
          <div className="bg-green-500/10 border-2 border-green-500/50 p-8 rounded-3xl text-center animate-in zoom-in-95 duration-700 shadow-2xl shadow-green-500/10">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-lg shadow-green-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">¡Viaje Cerrado!</h3>
              <p className="text-green-500/80 text-sm font-bold">Bitácora completada y registrada en el sistema.</p>
              <button
                onClick={iniciarNuevoViaje}
                className="mt-4 bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm"
              >
                🚛 Iniciar Nuevo Viaje
              </button>
              
              <button
                onClick={async () => {
                  if (enviandoWhatsapp) return;
                  setEnviandoWhatsapp(true);
                  
                  try {
                    // Obtener locales visitados con fotos
                    const localesVisitados = locales.filter(l => l.hora_llegada);
                    
                    // Obtener gastos de combustible (separado de otros)
                    const { data: gastos } = await supabase
                      .from('gastos_combustible')
                      .select('monto, tipo_combustible')
                      .eq('id_ruta', ruta.id_ruta);
                    
                    const gastoCombustible = gastos?.filter(g => g.tipo_combustible !== 'otro').reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
                    const gastoOtros = gastos?.filter(g => g.tipo_combustible === 'otro').reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
                    
                    // Calcular duración total
                    let duracion = 'No registrado';
                    if (ruta.hora_salida_planta && ruta.hora_llegada_planta) {
                      const salida = new Date(ruta.hora_salida_planta);
                      const llegada = new Date(ruta.hora_llegada_planta);
                      const mins = Math.round((llegada.getTime() - salida.getTime()) / 60000);
                      duracion = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}min`;
                    }
                    
                    // Calcular tiempo entre locales (bitácora)
                    const tiempoEntreLocales = bitacora.map((tramo, idx) => {
                      if (!tramo.hora_salida || !tramo.hora_llegada) return null;
                      
                      // Tiempo de tránsito (origen -> destino)
                      const llegada = new Date(tramo.hora_llegada);
                      const salida = new Date(tramo.hora_salida);
                      const transito = Math.round((llegada.getTime() - salida.getTime()) / 60000);
                      
                      // Tiempo de permanencia (en el destino)
                      let permanencia = 0;
                      if (idx < bitacora.length - 1 && bitacora[idx + 1].hora_salida) {
                        const sigSalida = new Date(bitacora[idx + 1].hora_salida);
                        permanencia = Math.round((sigSalida.getTime() - llegada.getTime()) / 60000);
                      }
                      
                      return {
                        destino: tramo.destino_nombre,
                        transito: transito >= 60 ? `${Math.floor(transito/60)}h${transito%60}m` : `${transito}min`,
                        permanencia: permanencia > 0 ? (permanencia >= 60 ? `${Math.floor(permanencia/60)}h${permanencia%60}m` : `${permanencia}min`) : '-'
                      };
                    }).filter(Boolean);
                    
                    // Construir mensaje
                    const lineas = [
                      `🚛 *Resumen de Ruta - ${ruta.nombre}*`,
                      `━━━━━━━━━━━━━━━━━━━━`,
                      `📅 ${ruta.fecha || 'Hoy'}`,
                      `🚚 Unidad: ${ruta.placa || 'No asignada'}`,
                      `⏱️ Duración total: ${duracion}`,
                      `📍 Locales visitados: ${localesVisitados.length}`,
                      `⛽ GLP: S/ ${gastoCombustible.toFixed(2)} | 💵 Otros: S/ ${gastoOtros.toFixed(2)}`,
                      ``,
                      `⏱️ *Tiempos por Local:*`,
                      ...tiempoEntreLocales.map((t: any) => `• ${t.destino}: 🚗 ${t.transito} | ⏱️ ${t.permanencia}`),
                      ``,
                      `_Enviado desde Shimaya Rutas_`
                    ];
                    
                    const mensaje = encodeURIComponent(lineas.join('\n'));
                    // Número de admin desde variable de entorno o valor por defecto
                    const whatsappNumero = import.meta.env.VITE_WHATSAPP_ADMIN || '51948800569';
                    window.open(`https://wa.me/${whatsappNumero}?text=${mensaje}`, '_blank');
                    
                  } catch (err) {
                    console.error('[WhatsApp] Error:', err);
                    showToast('error', 'Error al generar resumen');
                  } finally {
                    setEnviandoWhatsapp(false);
                  }
                }}
                disabled={enviandoWhatsapp}
                className="mt-4 ml-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
              >
                {enviandoWhatsapp ? '⏳ Generando...' : '📤 Enviar Resumen'}
              </button>
          </div>
          
          {/* Botón para agregar fotos después del viaje */}
          <div className="mt-6 p-4 bg-surface-light/30 rounded-2xl border border-white/10">
            <p className="text-xs text-text-muted mb-3 uppercase font-bold">Agregar fotos de evidencia (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              {locales.filter(l => l.hora_llegada).map(local => (
                <button
                  key={local.id_local_ruta}
                  onClick={() => setLocalParaFoto(local)}
                  className="bg-surface p-3 rounded-xl border border-white/10 hover:border-primary/50 text-left transition-all"
                >
                  <p className="text-xs text-white truncate">{local.nombre}</p>
                  <p className="text-[10px] text-text-muted">{local.hora_llegada ? '✓ Visitado' : 'Sin registrar'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Botón para agregar gastos de combustible después del viaje */}
          <button
            onClick={() => setShowCombustible(true)}
            className="mt-4 w-full bg-green-600/20 text-green-400 border border-green-600/50 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Fuel size={18} />
            Agregar Comprobante de Combustible
          </button>
        </>
      )}

      {showCombustible && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <RegistrarCombustible 
              idRuta={ruta.id_ruta} 
              idChofer={profile?.id_usuario || ''}
              onClose={() => setShowCombustible(false)}
            />
          </div>
        </div>
      )}

      {localParaFoto && (
        <ModalEvidencia
          local={localParaFoto}
          onClose={() => setLocalParaFoto(null)}
          onSuccess={() => {
            if (ruta) loadViajeData(ruta.id_ruta);
          }}
        />
      )}

      {/* Modal Resumen de Ruta */}
      {showResumenRuta && ruta && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowResumenRuta(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">📋 Mi Ruta</h3>
              <button onClick={() => setShowResumenRuta(false)} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {locales.map((local, idx) => {
                const tramo = bitacora.find(b => b.destino_nombre === local.nombre);
                const estaEnCurso = !tramo?.hora_llegada && (tramo?.hora_salida || idx === 0);
                const yaVisitado = !!tramo?.hora_llegada;
                
                return (
                  <div key={local.id_local_ruta} className={`p-3 rounded-xl border ${
                    yaVisitado ? 'bg-green-500/10 border-green-500/30' :
                    estaEnCurso ? 'bg-primary/10 border-primary/30' :
                    'bg-white/5 border-white/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {yaVisitado ? <CheckCircle2 size={18} className="text-green-500" /> :
                       estaEnCurso ? <Clock size={18} className="text-primary" /> :
                       <div className="w-4 h-4 rounded-full border-2 border-white/20" />}
                      <span className={`font-bold ${yaVisitado ? 'text-green-400' : 'text-white'}`}>
                        {local.nombre}
                      </span>
                    </div>
                    {yaVisitado && (
                      <div className="mt-2 text-xs text-text-muted pl-6">
                        Llegada: {formatPeru(tramo.hora_llegada, 'HH:mm')}
                        {tramo.hora_salida && <span className="ml-2">• Salida: {formatPeru(tramo.hora_salida, 'HH:mm')}</span>}
                      </div>
                    )}
                    {estaEnCurso && !yaVisitado && (
                      <div className="mt-2 text-xs text-primary pl-6">En curso...</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}