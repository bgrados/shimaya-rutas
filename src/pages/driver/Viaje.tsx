import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Ruta, LocalRuta, ViajeBitacora } from '../../types';
import RegistrarCombustible from './combustible/Registrar';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
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
  Image
} from 'lucide-react';

export default function DriverViaje() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [bitacora, setBitacora] = useState<ViajeBitacora[]>([]);
  
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Selection/Creation state
  const [rutasBase, setRutasBase] = useState<any[]>([]);
  const [selectedRutaBase, setSelectedRutaBase] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState('');
  const [createError, setCreateError] = useState('');

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 3) {
      val = val.substring(0, 3) + '-' + val.substring(3, 6);
    }
    setNuevaPlaca(val);
  };

  const [nuevoDestino, setNuevoDestino] = useState('');
  const [showCombustible, setShowCombustible] = useState(false);
  
  // Estado para capturar fotos de evidencia
  const [localParaFoto, setLocalParaFoto] = useState<LocalRuta | null>(null);
  const [fotosCapturadas, setFotosCapturadas] = useState<{preview: string; file: File}[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<{id_foto: string; foto_url: string}[]>([]);
  const [capturando, setCapturando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para editar horas de bitácora
  const [editandoBitacora, setEditandoBitacora] = useState<string | null>(null);
  const [editHoraSalida, setEditHoraSalida] = useState('');
  const [editHoraLlegada, setEditHoraLlegada] = useState('');

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

    // Validar que llegada no sea antes que salida
    if (nuevaLlegada && nuevaLlegada <= nuevaSalida) {
      alert('La hora de llegada no puede ser anterior a la hora de salida');
      return;
    }

    // Validar que no sea antes que la llegada del tramo anterior
    const idxActual = bitacora.findIndex(b => b.id_bitacora === tramo.id_bitacora);
    if (idxActual > 0) {
      const tramoAnterior = bitacora[idxActual - 1];
      if (tramoAnterior.hora_llegada && nuevaSalida < new Date(tramoAnterior.hora_llegada)) {
        alert('La hora de salida no puede ser anterior a la llegada del tramo anterior');
        return;
      }
    }

    const updates: any = { hora_salida: nuevaSalida.toISOString() };
    if (nuevaLlegada) {
      updates.hora_llegada = nuevaLlegada.toISOString();
    }

    await supabase.from('viajes_bitacora').update(updates).eq('id_bitacora', tramo.id_bitacora);
    
    setBitacora(bitacora.map(b => 
      b.id_bitacora === tramo.id_bitacora 
        ? { ...b, ...updates } 
        : b
    ));
    setEditandoBitacora(null);
  };

  const loadCurrentRuta = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rutaData, error: rError } = await supabase
        .from('rutas')
        .select('*')
        .eq('id_chofer', profile.id_usuario)
        .in('estado', ['pendiente', 'en_progreso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 
        
      if (rError) throw rError;

      if (rutaData) {
        setRuta(rutaData as Ruta);
        
        const { data: localesData, error: locError } = await supabase
          .from('locales_ruta')
          .select('*')
          .eq('id_ruta', rutaData.id_ruta)
          .order('orden', { ascending: true });
        
        if (locError) console.error('Error loading locales_ruta:', locError);
        if (localesData) setLocales(localesData as LocalRuta[]);

        const { data: bitacoraData, error: bitError } = await supabase
          .from('viajes_bitacora')
          .select('*')
          .eq('id_ruta', rutaData.id_ruta)
          .order('created_at', { ascending: true });
        
        if (bitError) console.error('Error loading bitacora:', bitError);
        setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
      } else {
        setRuta(null);
        const { data: baseData, error: rbError } = await supabase
          .from('rutas_base')
          .select('*')
          .eq('activo', true)
          .order('nombre');
          
        if (rbError) throw rbError;

        if (baseData) {
          const withCounts = await Promise.all(baseData.map(async (rb) => {
            try {
              const { count, error: cError } = await supabase
                .from('locales_base')
                .select('id_local_base', { count: 'exact', head: true })
                .eq('id_ruta_base', rb.id_ruta_base);
              
              if (cError) console.error(`Error counting locales for ${rb.nombre}:`, cError);
              return { ...rb, locales_count: count ?? 0 };
            } catch (e) {
              return { ...rb, locales_count: 0 };
            }
          }));
          
          const validas = withCounts.filter(r => r.locales_count > 0);
          setRutasBase(validas);
          if (validas.length > 0) setSelectedRutaBase(validas[0].id_ruta_base);
        }
      }
    } catch (err: any) {
      console.error('Error cargando datos de viaje:', err);
      if (err.message?.includes('policy') || err.code === '42501') {
        setLoadError('Error de permisos (RLS). Contacta al administrador.');
      } else {
        setLoadError('No se pudo cargar la información. Reintenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Si no hay perfil, no cargamos nada
    if (!profile?.id_usuario) {
      setLoading(false);
      return;
    }

    loadCurrentRuta();

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
    if (!nuevaPlaca.trim()) {
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
        hora_salida: new Date().toISOString(),
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
      alert('Error en salida: ' + error.message);
    }
    setActionLoading(false);
  };

  const handleRegistrarLlegada = async (idBitacora: string) => {
    if (actionLoading) return; 
    
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

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('viajes_bitacora')
      .update({ hora_llegada: now, gps_llegada_lat: lat, gps_llegada_lng: lng })
      .eq('id_bitacora', idBitacora)
      .select()
      .single();

    if (!error && data) {
      setBitacora(bitacora.map(b => b.id_bitacora === idBitacora ? (data as ViajeBitacora) : b));
      if (data.destino_nombre !== 'Planta') {
        await supabase.from('locales_ruta').update({ hora_llegada: now, estado_visita: 'visitado' }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.destino_nombre);
      }
      if (data.destino_nombre === 'Planta') {
         await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', ruta?.id_ruta);
         if (ruta) setRuta({ ...ruta, estado: 'finalizada' });
      }
    } else if (error) {
      console.error('[Viaje] Error registrar llegada:', error);
      alert('Error en llegada: ' + error.message);
    }
    setActionLoading(false);
  };

  // Funciones para captura de fotos de evidencia
  const TARGET_WIDTH = 1200;

  const compressToWebP = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = TARGET_WIDTH / img.width;
          canvas.width = TARGET_WIDTH;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo crear el contexto')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir'));
          }, 'image/webp', 0.8);
        };
        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleAgregarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[handleAgregarFoto] called, files:', e.target.files?.length);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log('[handleAgregarFoto] file:', file.name, file.size, file.type);
      const reader = new FileReader();
      reader.onload = (ev) => {
        console.log('[handleAgregarFoto] FileReader loaded, setting state');
        setFotosCapturadas(prev => [...prev, { preview: ev.target?.result as string, file }]);
      };
      reader.onerror = () => console.error('[handleAgregarFoto] FileReader error');
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEliminarFoto = (index: number) => {
    setFotosCapturadas(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubirFotosEvidencia = async () => {
    console.log('[handleSubirFotosEvidencia] INICIANDO, fotosCapturadas:', fotosCapturadas.length, 'localParaFoto:', localParaFoto?.id_local_ruta);
    if (!localParaFoto || fotosCapturadas.length === 0) {
      console.log('[handleSubirFotosEvidencia] early return - localParaFoto:', !!localParaFoto, 'fotosCapturadas:', fotosCapturadas.length);
      alert('No hay fotos para guardar');
      return;
    }
    setCapturando(true);
    
    // Timeout de seguridad - 30 segundos
    const timeoutId = setTimeout(() => {
      if (capturando) {
        console.log('[handleSubirFotosEvidencia] TIMEOUT - algo falló');
        setCapturando(false);
        alert('Tiempo de espera agotado. Verifica tu conexión e intenta de nuevo.');
      }
    }, 30000);
    
    try {
      // Obtener fotos existentes
      const { data: fotosExistentes, error: queryError } = await supabase
        .from('fotos_visita')
        .select('id_foto')
        .eq('id_local_ruta', localParaFoto.id_local_ruta);
      
      if (queryError) {
        console.error('[Fotos] Error consultando fotos existentes:', queryError);
        clearTimeout(timeoutId);
        setCapturando(false);
        alert('Error al consultar fotos: ' + queryError.message);
        return;
      }
      
      const ordenBase = (fotosExistentes?.length || 0) + 1;
      const urlsSubidas: string[] = [];
      
      for (let i = 0; i < fotosCapturadas.length; i++) {
        const { file } = fotosCapturadas[i];
        console.log('[Fotos] Procesando foto', i, 'size:', file.size, 'type:', file.type);
        
        // COMENTAR COMPRESIÓN TEMPORALMENTE - probar upload directo
        // const compressedBlob = await compressToWebP(file);
        // console.log('[Fotos] Foto comprimida, size:', compressedBlob.size);
        
        const fileName = `${localParaFoto.id_local_ruta}_${Date.now()}_${i}.${file.name.split('.').pop()}`;
        const filePath = `evidencia/${fileName}`;
        
        console.log('[Fotos] Subiendo a storage:', filePath, 'bucket: visitas_fotos');
        
        // Subir archivo directo (sin compresión)
        const { error: uploadError } = await supabase.storage
          .from('visitas_fotos')
          .upload(filePath, file, { contentType: file.type });
        
        if (uploadError) {
          console.error('[Fotos] Error upload:', uploadError);
          clearTimeout(timeoutId);
          setCapturando(false);
          alert('Error al subir: ' + uploadError.message);
          return;
        }
        
        console.log('[Fotos] Upload OK, getting URL');
        const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
        
        console.log('[Fotos] Insertando en DB');
        const { error: insertError } = await supabase.from('fotos_visita').insert({
          id_local_ruta: localParaFoto.id_local_ruta,
          foto_url: data.publicUrl,
          orden: ordenBase + i,
        });
        
        if (insertError) {
          console.error('[Fotos] Error insert:', insertError);
          clearTimeout(timeoutId);
          setCapturando(false);
          alert('Error al guardar: ' + insertError.message);
          return;
        }
        
        urlsSubidas.push(data.publicUrl);
        console.log('[Fotos] Foto', i, 'guardada OK');
      }
      
      console.log('[Fotos] Completado, guardadas:', urlsSubidas.length);
      clearTimeout(timeoutId);
      setCapturando(false);
      alert(`✅ ${urlsSubidas.length} fotos guardadas correctamente`);
      setLocalParaFoto(null);
      setFotosCapturadas([]);
      setFotosExistentes([]);
    } catch (err: any) {
      console.error('Error subiendo fotos:', err);
      clearTimeout(timeoutId);
      setCapturando(false);
      alert('Error al guardar fotos: ' + (err.message || 'Error desconocido'));
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
                    {rutasBase.length === 0 ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 text-sm font-bold">
                        ⚠️ No hay plantillas disponibles. Contacta al administrador para configurar rutas base.
                      </div>
                    ) : (
                      <div className="relative">
                         <select 
                           className="w-full bg-surface-light border-2 border-primary/20 rounded-xl px-4 py-3 text-white font-bold italic appearance-none focus:border-primary transition-colors"
                           value={selectedRutaBase}
                           onChange={e => setSelectedRutaBase(e.target.value)}
                         >
                           {rutasBase.map(r => (
                             <option key={r.id_ruta_base} value={r.id_ruta_base}>
                               {r.nombre} ({r.locales_count} paradas)
                             </option>
                           ))}
                         </select>
                         <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                      </div>
                    )}
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Placa del Vehículo</label>
                    <Input 
                      placeholder="ABC-123" 
                      className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg tracking-widest"
                      value={nuevaPlaca}
                      onChange={handlePlacaChange}
                      maxLength={7}
                    />
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
                disabled={isCreating || !nuevaPlaca.trim() || rutasBase.length === 0}
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
          onClick={async () => {
            const localActual = locales.find(l => l.nombre === tramoEnProgreso.destino_nombre);
            if (localActual) {
              setLocalParaFoto(localActual);
              setFotosCapturadas([]);
              const { data: fotos } = await supabase.from('fotos_visita').select('id_foto,foto_url').eq('id_local_ruta', localActual.id_local_ruta);
              setFotosExistentes(fotos || []);
            }
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
          onClick={async () => {
            const ultimoTramo = bitacora[bitacora.length - 1];
            const localActual = locales.find(l => l.nombre === ultimoTramo.destino_nombre);
            if (localActual) {
              setLocalParaFoto(localActual);
              setFotosCapturadas([]);
              const { data: fotos } = await supabase.from('fotos_visita').select('id_foto,foto_url').eq('id_local_ruta', localActual.id_local_ruta);
              setFotosExistentes(fotos || []);
            }
          }}
        >
          <Camera size={20} className="mr-2" />
          📸 Tomar Evidencia - {bitacora[bitacora.length - 1].destino_nombre}
        </Button>
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
                              alert('Error al actualizar: ' + error?.message);
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
                        <button 
                          onClick={() => {
                            setDestinoEditado(tramoEnProgreso.destino_nombre || '');
                            setIsEditingDestino(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 bg-blue-500/20 hover:bg-blue-500/30 p-1.5 rounded-md transition-colors ml-2"
                          title="Corregir destino"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    )}
                    
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter mt-1">Salió de {tramoEnProgreso.origen_nombre} a las {format(new Date(tramoEnProgreso.hora_salida!), 'HH:mm')}</p>
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
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-dashed border-white/10">
                   <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      <span className="text-xs text-text-muted uppercase font-bold">Tiempo Actual</span>
                   </div>
                   <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10"
                      onClick={() => navigate(`/driver/ruta/${ruta.id_ruta}`)}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <MapPin size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Ver Lista</span>
                      </div>
                    </Button>
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
                  <button
                    onClick={() => handleEditarHora(tramo)}
                    className="text-[10px] text-text-muted hover:text-primary flex items-center gap-1 ml-2"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>
                {editandoBitacora === tramo.id_bitacora && (
                  <div className="mt-3 p-3 bg-surface rounded-xl border border-primary/30 flex flex-wrap gap-3 items-center">
                    <div className="flex flex-col">
                      <label className="text-[8px] text-text-muted uppercase">Salida</label>
                      <input
                        type="time"
                        value={editHoraSalida}
                        onChange={e => setEditHoraSalida(e.target.value)}
                        className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-white/10"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[8px] text-text-muted uppercase">Llegada</label>
                      <input
                        type="time"
                        value={editHoraLlegada}
                        onChange={e => setEditHoraLlegada(e.target.value)}
                        className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-white/10"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => guardarEdicionHora(tramo)}
                        className="bg-green-500 text-white text-[10px] px-3 py-1 rounded font-bold"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoBitacora(null)}
                        className="bg-surface text-text-muted text-[10px] px-3 py-1 rounded"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
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

      {/* Modal para capturar fotos de evidencia */}
      {localParaFoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white">
                📸 Evidencia: {localParaFoto.nombre}
              </h3>
              <button onClick={() => { setLocalParaFoto(null); setFotosCapturadas([]); }} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-text-muted">Máximo 5 fotos • Compresión automática</p>
            
            {/* Fotos existentes */}
            {fotosExistentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-purple-400 font-bold">Fotos guardadas:</p>
                <div className="grid grid-cols-3 gap-2">
                  {fotosExistentes.map((foto) => (
                    <div key={foto.id_foto} className="relative aspect-square rounded-lg overflow-hidden border border-green-500/50 cursor-pointer" onClick={() => setFotoAmpliada(foto.foto_url)}>
                      <img src={foto.foto_url} alt="Evidencia" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={18} />
                Cámara
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex items-center justify-center gap-2"
                onClick={() => { 
                  const input = document.createElement('input'); 
                  input.type = 'file'; 
                  input.accept = 'image/*'; 
                  input.onchange = (e) => { 
                    const file = (e.target as HTMLInputElement).files?.[0]; 
                    if (file) {
                      console.log('[Fototeca] Archivo seleccionado:', file.name, file.size);
                      handleAgregarFoto({ target: { files: [file] } } as any); 
                    }
                  }; 
                  input.click(); 
                }}
              >
                <Image size={18} />
                Fototeca
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                className="flex-1"
                onClick={() => { setLocalParaFoto(null); setFotosCapturadas([]); }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleSubirFotosEvidencia}
                disabled={fotosCapturadas.length === 0 || capturando}
                isLoading={capturando}
              >
                ✓ Guardar {fotosCapturadas.length > 0 && `(${fotosCapturadas.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver foto ampliada */}
      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setFotoAmpliada(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}