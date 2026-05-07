import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViajeData } from './useViajeData';
import { useViajeActions } from './useViajeActions';
import { useGpsTracking } from './useGpsTracking';
import { useAuth } from '../../../../contexts/AuthContext';
import { useToast } from '../../../../components/ui/Toast';
import { supabase } from '../../../../lib/supabase';
import { nowPeru } from '../../../../lib/timezone';
import { useOcrModule } from './useOcrModule';

export function useViajeIntegration() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  
  // 1. Data Layer
  const { 
    ruta, locales, bitacora, rutasBase, loading, loadingRutasBase, 
    refreshData, setRuta, setBitacora, setLocales 
  } = useViajeData();

  // 2. Actions Layer
  const { actionLoading, registrarSalida, registrarLlegada } = useViajeActions(ruta, bitacora, refreshData);

  // 3. UI States (Modals, etc.)
  const [showLocales, setShowLocales] = useState(false);
  const [showEvidencia, setShowEvidencia] = useState(false);
  const [showFirma, setShowFirma] = useState(false);
  const [showKm, setShowKm] = useState(false);
  const [showNotas, setShowNotas] = useState(false);
  const [showGastos, setShowGastos] = useState(false);
  const [showCombustible, setShowCombustible] = useState(false);
  const [imageModal, setImageModal] = useState({ isOpen: false, image: '', title: '', location: '' });
  
  const [localSeleccionado, setLocalSeleccionado] = useState<any>(null);
  const [notaInfo, setNotaInfo] = useState({ id: '', nombre: '', actual: '' });
  const [showModoManual, setShowModoManual] = useState(false);
  
  // Ruta Selector States
  const [selectedRutaBase, setSelectedRutaBase] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState('');
  const [kmInicio, setKmInicio] = useState('');
  const [fotoKmInicio, setFotoKmInicio] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const { procesarKilometraje, procesandoOCR } = useOcrModule();

  // 4. Computed States
  const tramoEnProgreso = useMemo(() => 
    bitacora.find(b => !b.hora_llegada), 
    [bitacora]
  );

  const proximoDestino = useMemo(() => {
    if (tramoEnProgreso) return tramoEnProgreso.destino_nombre || '';
    const localesPendientes = locales.filter(l => l.estado_visita === 'pendiente');
    if (localesPendientes.length > 0) return localesPendientes[0].nombre;
    return 'Planta';
  }, [tramoEnProgreso, locales]);

  const proximoOrigen = useMemo(() => {
    if (bitacora.length === 0) return 'Planta';
    const ultimoRegistro = bitacora[bitacora.length - 1];
    return ultimoRegistro.destino_nombre || 'Planta';
  }, [bitacora]);

  // 5. GPS Tracking Integration
  const currentTargetLocal = useMemo(() => {
    if (!tramoEnProgreso) return null;
    return locales.find(l => (l.nombre || '').trim().toLowerCase() === (tramoEnProgreso.destino_nombre || '').trim().toLowerCase()) || null;
  }, [tramoEnProgreso, locales]);

  const gpsState = useGpsTracking(currentTargetLocal, !!tramoEnProgreso);

  // Auto-arrival detection
  useEffect(() => {
    if (gpsState.estadoDetectar === 'llegada_confirmada' && tramoEnProgreso && !actionLoading) {
      registrarLlegada(tramoEnProgreso.id_bitacora, { 
        lat: gpsState.posicionPromediada?.lat, 
        lng: gpsState.posicionPromediada?.lng, 
        tipo: 'auto' 
      });
      gpsState.onLimpiarTemporizadores();
    }
  }, [gpsState.estadoDetectar, tramoEnProgreso, actionLoading, registrarLlegada, gpsState.onLimpiarTemporizadores, gpsState.posicionPromediada]);

  // 6. Handlers
  const handleMarkSalida = useCallback(() => {
    registrarSalida(proximoDestino, proximoOrigen);
  }, [registrarSalida, proximoDestino, proximoOrigen]);

  const handleMarkLlegada = useCallback((manual = false) => {
    if (!tramoEnProgreso) return;
    registrarLlegada(tramoEnProgreso.id_bitacora, {
      lat: gpsState.posicionPromediada?.lat,
      lng: gpsState.posicionPromediada?.lng,
      tipo: manual || showModoManual ? 'manual' : 'auto'
    });
    setShowModoManual(false);
  }, [tramoEnProgreso, registrarLlegada, gpsState.posicionPromediada, showModoManual]);

  const handleAddPhoto = useCallback((local: any) => {
    setLocalSeleccionado(local);
    setShowEvidencia(true);
  }, []);

  const handleAddNote = useCallback((id: string, nombre: string, actual: string) => {
    setNotaInfo({ id, nombre, actual });
    setShowNotas(true);
  }, []);

  const handleSaveNote = useCallback(async (nota: string) => {
    if (!notaInfo.id) return;
    try {
      await supabase.from('viajes_bitacora').update({ observacion: nota }).eq('id_bitacora', notaInfo.id);
      showToast('success', 'Nota guardada');
      setShowNotas(false);
      refreshData();
    } catch (err) {
      showToast('error', 'Error al guardar nota');
    }
  }, [notaInfo.id, refreshData, showToast]);

  const handleSaveKm = useCallback(async (km: number) => {
    if (!ruta) return;
    try {
      const updateData = ruta.estado === 'pendiente' || !ruta.km_inicio ? { km_inicio: km } : { km_fin: km };
      await supabase.from('rutas').update(updateData).eq('id_ruta', ruta.id_ruta);
      showToast('success', 'Kilometraje actualizado');
      setShowKm(false);
      refreshData();
    } catch (err) {
      showToast('error', 'Error al guardar kilometraje');
    }
  }, [ruta, refreshData, showToast]);

  const handleCrearRuta = useCallback(async () => {
    if (!selectedRutaBase || !profile?.id_usuario) return;
    setIsCreating(true);
    setCreateError('');
    try {
      const { data: rb } = await supabase.from('rutas_base').select('*').eq('id_ruta_base', selectedRutaBase).single();
      const { data: lr } = await supabase.from('locales_ruta_base').select('*').eq('id_ruta_base', selectedRutaBase).order('orden', { ascending: true });
      
      const { data: newRuta, error: rError } = await supabase.from('rutas').insert([{
        nombre: rb.nombre,
        id_chofer: profile.id_usuario,
        placa: nuevaPlaca || profile.placa || '',
        km_inicio: parseInt(kmInicio) || 0,
        estado: 'pendiente'
      }]).select().single();

      if (rError) throw rError;

      if (lr && lr.length > 0) {
        const localesToInsert = lr.map(l => ({
          id_ruta: newRuta.id_ruta,
          nombre: l.nombre,
          direccion: l.direccion,
          latitud: l.latitud,
          longitud: l.longitud,
          orden: l.orden,
          estado_visita: 'pendiente'
        }));
        await supabase.from('locales_ruta').insert(localesToInsert);
      }

      showToast('success', 'Ruta iniciada correctamente');
      refreshData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  }, [selectedRutaBase, profile, nuevaPlaca, kmInicio, refreshData, showToast]);

  return {
    // Data
    loading,
    ruta,
    locales,
    bitacora,
    rutasBase,
    loadingRutasBase,
    tramoEnProgreso,
    proximoDestino,
    proximoOrigen,
    actionLoading,
    
    // GPS
    gpsState,
    
    // UI States
    modals: {
      showLocales, setShowLocales,
      showEvidencia, setShowEvidencia,
      showFirma, setShowFirma,
      showKm, setShowKm,
      showNotas, setShowNotas,
      showGastos, setShowGastos,
      showCombustible, setShowCombustible,
      imageModal, setImageModal
    },
    state: {
      localSeleccionado, setLocalSeleccionado,
      notaInfo,
      showModoManual, setShowModoManual,
      selectedRutaBase, setSelectedRutaBase,
      nuevaPlaca, setNuevaPlaca,
      kmInicio, setKmInicio,
      fotoKmInicio, setFotoKmInicio,
      isCreating,
      createError,
      procesandoOCR
    },
    
    // Handlers
    handlers: {
      onBack: () => navigate('/driver'),
      onRefresh: refreshData,
      onMarkSalida: handleMarkSalida,
      onMarkLlegada: handleMarkLlegada,
      onAddPhoto: handleAddPhoto,
      onAddNote: handleAddNote,
      onSaveNote: handleSaveNote,
      onSaveKm: handleSaveKm,
      onCrearRuta: handleCrearRuta,
      onUploadPhoto: async (idLocal: string, photo: string, lat?: number, lng?: number) => {
        // Upload logic
        const { error } = await supabase.from('evidencias_visita').insert([{
          id_ruta: ruta?.id_ruta,
          id_local: idLocal,
          foto_url: photo,
          latitud: lat,
          longitud: lng,
          fecha_registro: nowPeru()
        }]);
        if (error) throw error;
        showToast('success', 'Foto subida correctamente');
        setShowEvidencia(false);
      },
      onSaveFirma: async (firma: string, nombre: string, dni: string) => {
        if (!localSeleccionado) return;
        const { error } = await supabase.from('locales_ruta').update({
          firma_cliente: firma,
          nombre_receptor: nombre,
          dni_receptor: dni
        }).eq('id_ruta', ruta?.id_ruta).eq('id_local', localSeleccionado.id_local);
        if (error) throw error;
        showToast('success', 'Firma guardada');
        setShowFirma(false);
      }
    }
  };
}
