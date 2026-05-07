import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { nowPeru } from '../../../lib/timezone';
import type { Ruta, LocalRuta, ViajeBitacora } from '../../../types';

export function useViajeActions(
  ruta: Ruta | null,
  bitacora: ViajeBitacora[],
  refreshData: () => Promise<void>
) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState(false);

  const registrarSalida = useCallback(async (destino: string, proximoOrigen: string) => {
    if (!ruta || !destino || actionLoading) return;
    setActionLoading(true);
    try {
      // Logic for GPS can be added here or passed from hook
      const { data, error } = await supabase
        .from('viajes_bitacora')
        .insert([{
          id_ruta: ruta.id_ruta,
          id_chofer: profile?.id_usuario,
          origen_nombre: proximoOrigen,
          destino_nombre: destino,
          hora_salida: nowPeru()
        }])
        .select()
        .single();

      if (error) throw error;

      if (bitacora.length === 0) {
        await supabase.from('rutas').update({ 
          estado: 'en_progreso', 
          hora_salida_planta: data.hora_salida 
        }).eq('id_ruta', ruta.id_ruta);
      }

      showToast('success', 'Salida registrada');
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  }, [ruta, profile, bitacora.length, actionLoading, refreshData, showToast]);

  const registrarLlegada = useCallback(async (idBitacora: string, options: { lat?: number, lng?: number, tipo: string }) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const now = nowPeru();
      const { data, error } = await supabase
        .from('viajes_bitacora')
        .update({
          hora_llegada: now,
          gps_llegada_lat: options.lat,
          gps_llegada_lng: options.lng,
          tipo_registro: options.tipo
        })
        .eq('id_bitacora', idBitacora)
        .select()
        .single();

      if (error) throw error;

      // Update local state if it's a known destination
      if (data.destino_nombre !== 'Planta') {
        await supabase.from('locales_ruta').update({
          hora_llegada: now,
          estado_visita: 'visitado'
        }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.destino_nombre);
      } else {
        await supabase.from('rutas').update({ 
          estado: 'finalizada', 
          hora_llegada_planta: now 
        }).eq('id_ruta', ruta?.id_ruta);
      }

      showToast('success', 'Llegada registrada');
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  }, [ruta, actionLoading, refreshData, showToast]);

  return {
    actionLoading,
    registrarSalida,
    registrarLlegada
  };
}
