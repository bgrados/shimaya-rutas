import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { useToast } from '../../../../components/ui/Toast';
import { format } from 'date-fns';
import { nowPeru } from '../../../../lib/timezone';
import type { Ruta, LocalRuta, ViajeBitacora } from '../../../../types';

export function useViajeData() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [bitacora, setBitacora] = useState<ViajeBitacora[]>([]);
  const [rutasBase, setRutasBase] = useState<any[]>([]);
  const [loadingRutasBase, setLoadingRutasBase] = useState(true);

  const loadCurrentRuta = useCallback(async () => {
    if (!profile?.id_usuario) return;
    setLoading(true);
    try {
      const { data: activeRuta } = await supabase
        .from('rutas')
        .select('*')
        .eq('id_chofer', profile.id_usuario)
        .in('estado', ['pendiente', 'en_progreso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeRuta) {
        setRuta(activeRuta);
        const [localesRes, bitacoraRes] = await Promise.all([
          supabase.from('locales_ruta').select('*').eq('id_ruta', activeRuta.id_ruta).order('orden', { ascending: true }),
          supabase.from('viajes_bitacora').select('*').eq('id_ruta', activeRuta.id_ruta).order('created_at', { ascending: true })
        ]);
        setLocales(localesRes.data || []);
        setBitacora(bitacoraRes.data || []);
      } else {
        setRuta(null);
        setLocales([]);
        setBitacora([]);
      }
    } catch (err) {
      console.error('Error cargando ruta:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id_usuario]);

  const loadRutasBase = useCallback(async () => {
    setLoadingRutasBase(true);
    try {
      const { data } = await supabase.from('rutas_base').select('*').eq('activo', true).order('nombre', { ascending: true });
      setRutasBase(data || []);
    } finally {
      setLoadingRutasBase(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentRuta();
    loadRutasBase();
  }, [loadCurrentRuta, loadRutasBase]);

  return {
    ruta,
    locales,
    bitacora,
    rutasBase,
    loading,
    loadingRutasBase,
    refreshData: loadCurrentRuta,
    setRuta,
    setLocales,
    setBitacora
  };
}
