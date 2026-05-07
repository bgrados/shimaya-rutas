import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import type { Ruta, Usuario, ViajeBitacora, LocalRuta } from '../../../types';

export type RutaConDetalle = Ruta & { chofer?: Usuario, bitacora?: ViajeBitacora[], locales?: LocalRuta[] };

export function useViajesData() {
  const [rutas, setRutas] = useState<RutaConDetalle[]>([]);
  const [allChoferes, setAllChoferes] = useState<Usuario[]>([]);
  const [allAsistentes, setAllAsistentes] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const getStartOfCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    return format(monday, 'yyyy-MM-dd');
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const mondayStr = getStartOfCurrentWeek();

    const { data: rutasData, error: rutasError } = await supabase
      .from('rutas')
      .select('*, chofer:usuarios!id_chofer (*)')
      .gte('fecha', mondayStr)
      .order('fecha', { ascending: false })
      .limit(100);

    if (!rutasError && rutasData) {
      const rutaIds = rutasData.map(r => r.id_ruta);
      
      const [bitacoraRes, localesRes] = await Promise.all([
        supabase.from('viajes_bitacora').select('*').in('id_ruta', rutaIds).order('created_at', { ascending: true }),
        supabase.from('locales_ruta').select('*').in('id_ruta', rutaIds).order('orden', { ascending: true })
      ]);

      const localesData = localesRes.data || [];
      const localeIds = localesData.map(l => l.id_local_ruta).filter(Boolean);

      const { data: guiasData } = await supabase.from('guias_remision').select('*').in('id_local_ruta', localeIds);

      const mapped = rutasData.map(r => {
        const routeLocales = localesData.filter(l => l.id_ruta === r.id_ruta).map(l => ({
          ...l,
          guias: (guiasData || []).filter(g => g.id_local_ruta === l.id_local_ruta)
        }));
        return {
          ...r,
          bitacora: bitacoraRes.data?.filter(b => b.id_ruta === r.id_ruta) || [],
          locales: routeLocales
        };
      });
      setRutas(mapped);
    }

    const { data: users } = await supabase.from('usuarios').select('*').eq('activo', true);
    if (users) {
      setAllChoferes(users.filter(u => u.rol === 'chofer' || u.rol === 'descansero'));
      setAllAsistentes(users.filter(u => u.rol === 'asistente' || u.rol === 'chofer'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('seguimiento_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rutas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes_bitacora' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locales_ruta' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guias_remision' }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  return { rutas, allChoferes, allAsistentes, loading, refreshData: loadData };
}
