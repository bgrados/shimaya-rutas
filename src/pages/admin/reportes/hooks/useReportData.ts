import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { format } from 'date-fns';
import { getRange } from '../utils';
import type { Ruta, GastoCombustible, FotoVisita, LocalRuta, ViajeBitacora } from '../../../../types';

export type Period = 'diario' | 'semanal' | 'mensual';

export interface RutaConBitacora extends Ruta {
  bitacora?: ViajeBitacora[];
  durationMin?: number | null;
  localesRuta?: LocalRuta[];
  horaLlegadaReal?: string | null;
  distanciaGpsKm?: number | null;
}

export interface Usuario { id_usuario: string; nombre: string; }

export function useReportData(period: Period, selectedDate: string, filterChofer: string) {
  const [allRutas, setAllRutas] = useState<RutaConBitacora[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [rutasBase, setRutasBase] = useState<{ id_ruta_base: string; nombre: string; cantidad_peajes?: number; costo_peaje?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotosPorLocal, setFotosPorLocal] = useState<Record<string, FotoVisita[]>>({});
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [combustibleLoading, setCombustibleLoading] = useState(true);
  const [fotosCombustible, setFotosCombustible] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      const fromPeru = `${from}T00:00:00-05:00`;
      const toPeru = `${to}T23:59:59-05:00`;

      let query = supabase
        .from('rutas')
        .select(`
          *,
          viajes_bitacora(*),
          locales_ruta(*)
        `)
        .gte('fecha', fromPeru)
        .lte('fecha', toPeru)
        .order('fecha', { ascending: false });

      if (filterChofer) {
        query = query.eq('id_chofer', filterChofer);
      }

      const { data: rutasData, error: rutasError } = await query;
      if (rutasError) throw rutasError;

      const mappedRutas: RutaConBitacora[] = (rutasData || []).map(r => ({
        ...r,
        bitacora: r.viajes_bitacora,
        localesRuta: r.locales_ruta
      }));

      setAllRutas(mappedRutas);

      // Load evidence photos
      const localIds = mappedRutas.flatMap(r => r.localesRuta?.map(l => l.id_local_ruta) || []).filter(Boolean);
      if (localIds.length > 0) {
        const { data: fotosData } = await supabase
          .from('fotos_visita')
          .select('*')
          .in('id_local_ruta', localIds);

        const fotosMap: Record<string, FotoVisita[]> = {};
        fotosData?.forEach(f => {
          if (!fotosMap[f.id_local_ruta]) fotosMap[f.id_local_ruta] = [];
          fotosMap[f.id_local_ruta].push(f);
        });
        setFotosPorLocal(fotosMap);
      }
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedDate, filterChofer]);

  const loadCombustible = useCallback(async () => {
    setCombustibleLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      let query = supabase
        .from('gastos_combustible')
        .select(`
          *,
          usuarios!gastos_combustible_id_chofer_fkey(nombre)
        `)
        .gte('created_at', `${from}T00:00:00-05:00`)
        .lte('created_at', `${to}T23:59:59-05:00`)
        .order('created_at', { ascending: false });

      if (filterChofer) {
        query = query.eq('id_chofer', filterChofer);
      }

      const { data, error } = await query;
      if (error) throw error;
      setGastos(data || []);

      // Pre-load public URLs for fuel photos
      const fotosMap: Record<string, string> = {};
      data?.forEach(g => {
        if (g.foto_url) {
          const { data: publicData } = supabase.storage.from('combustible_fotos').getPublicUrl(g.foto_url);
          fotosMap[g.id_gasto] = publicData.publicUrl;
        }
      });
      setFotosCombustible(fotosMap);
    } catch (err) {
      console.error('Error loading fuel data:', err);
    } finally {
      setCombustibleLoading(false);
    }
  }, [period, selectedDate, filterChofer]);

  useEffect(() => {
    loadData();
    loadCombustible();
  }, [loadData, loadCombustible]);

  useEffect(() => {
    supabase.from('usuarios').select('id_usuario,nombre').eq('rol', 'chofer').then(r => { if (r.data) setChoferes(r.data); });
    supabase.from('rutas_base').select('id_ruta_base,nombre,cantidad_peajes,costo_peaje').then(r => { if (r.data) setRutasBase(r.data); });
  }, []);

  return {
    allRutas,
    choferes,
    rutasBase,
    loading,
    fotosPorLocal,
    gastos,
    combustibleLoading,
    fotosCombustible,
    refreshData: loadData,
    refreshCombustible: loadCombustible,
    setAllRutas,
    setGastos,
    setFotosPorLocal,
    setFotosCombustible
  };
}
