import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { format } from 'date-fns';

export function useDriverDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rutaActiva, setRutaActiva] = useState<any>(null);
  const [ultimasRutas, setUltimasRutas] = useState<any[]>([]);
  const [rutasPendientes, setRutasPendientes] = useState<any[]>([]);
  const [proximoDescanso, setProximoDescanso] = useState<string | null>(null);
  const [excepcionProxima, setExcepcionProxima] = useState<any>(null);
  const [stats, setStats] = useState({
    km_hoy: 0,
    visitas_hoy: 0,
    tiempo_hoy_min: 0,
    rutas_completadas_semana: 0,
    horas_semana_actual: 0,
    horas_semana_anterior: 0,
    porcentaje_cambio: null as number | null
  });

  const cargarRutasPendientes = async (userId: string) => {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const hace7DiasStr = format(hace7Dias, 'yyyy-MM-dd');

    const { data: rutas } = await supabase
      .from('rutas')
      .select('*')
      .eq('id_chofer', userId)
      .eq('estado', 'finalizada')
      .gte('fecha', hace7DiasStr)
      .order('fecha', { ascending: false });

    if (!rutas) return [];

    const pendientes: any[] = [];
    for (const ruta of rutas) {
      const faltantes: string[] = [];
      if (!ruta.km_fin || ruta.km_fin === 0) faltantes.push('km_fin');

      const { data: gastos } = await supabase.from('gastos_combustible').select('id_gasto, foto_url, tipo_combustible').eq('id_ruta', ruta.id_ruta);
      const gastosSinFoto = gastos?.filter(g => !g.foto_url) || [];
      if (gastosSinFoto.length > 0) {
        if (gastosSinFoto.some(g => !['peaje', 'peaje_compromiso'].includes(g.tipo_combustible))) faltantes.push('fotos_combustible');
        if (gastosSinFoto.some(g => ['peaje', 'peaje_compromiso'].includes(g.tipo_combustible))) faltantes.push('fotos_peaje');
      }

      const { data: bitacora } = await supabase.from('viajes_bitacora').select('id_bitacora, hora_llegada').eq('id_ruta', ruta.id_ruta);
      const tramosSinLlegada = bitacora?.filter(b => !b.hora_llegada) || [];
      if (tramosSinLlegada.length > 0) faltantes.push(`llegadas (${tramosSinLlegada.length})`);

      if (faltantes.length > 0) {
        pendientes.push({
          id_ruta: ruta.id_ruta,
          nombre: ruta.nombre || 'Sin nombre',
          fecha: ruta.fecha,
          faltantesTexto: faltantes.join(', ')
        });
      }
    }
    return pendientes;
  };

  const cargarDatos = useCallback(async () => {
    if (!profile?.id_usuario) return;
    setLoading(true);
    try {
      const hoyStr = format(new Date(), 'yyyy-MM-dd');
      const inicioSemana = new Date();
      const dia = inicioSemana.getDay();
      const diffLunes = dia === 0 ? -6 : 1 - dia;
      inicioSemana.setDate(inicioSemana.getDate() + diffLunes);
      const inicioSemanaStr = format(inicioSemana, 'yyyy-MM-dd');
      const finSemanaStr = format(new Date(), 'yyyy-MM-dd');

      // 1. Ruta activa
      const { data: rutaActivaData } = await supabase.from('rutas').select('*').eq('id_chofer', profile.id_usuario).in('estado', ['pendiente', 'en_progreso']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (rutaActivaData) {
        const { count } = await supabase.from('viajes_bitacora').select('*', { count: 'exact', head: true }).eq('id_ruta', rutaActivaData.id_ruta).not('hora_llegada', 'is', null);
        setRutaActiva({ ...rutaActivaData, visitas_realizadas: count || 0 });
      } else {
        setRutaActiva(null);
      }

      // 2. Últimas 5 rutas finalizadas
      const { data: rutasData } = await supabase.from('rutas').select('*').eq('id_chofer', profile.id_usuario).eq('estado', 'finalizada').order('fecha', { ascending: false }).limit(5);
      if (rutasData) {
        const rutasConVisitas = await Promise.all(rutasData.map(async (r) => {
            const { count: visitas } = await supabase.from('viajes_bitacora').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta).not('hora_llegada', 'is', null);
            let duracion = 0;
            if (r.hora_salida_planta && r.hora_llegada_planta) duracion = Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 60000);
            let km = 0;
            if (r.km_inicio && r.km_fin && r.km_fin > r.km_inicio) km = r.km_fin - r.km_inicio;
            return { ...r, duracion_min: duracion, km_recorridos: km, visitas_realizadas: visitas || 0 };
        }));
        setUltimasRutas(rutasConVisitas);
      } else {
        setUltimasRutas([]);
      }

      // 4. Estadísticas de hoy
      const { data: rutasHoy } = await supabase.from('rutas').select('*').eq('id_chofer', profile.id_usuario).eq('fecha', hoyStr).eq('estado', 'finalizada');
      let kmHoy = 0, tiempoHoy = 0, visitasHoy = 0;
      if (rutasHoy) {
          for (const r of rutasHoy) {
              if (r.km_inicio && r.km_fin && r.km_fin > r.km_inicio) kmHoy += (r.km_fin - r.km_inicio);
              if (r.hora_salida_planta && r.hora_llegada_planta) tiempoHoy += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 60000);
              const { count: vis } = await supabase.from('viajes_bitacora').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta).not('hora_llegada', 'is', null);
              visitasHoy += vis || 0;
          }
      }

      // 5. Estadísticas de la semana
      const { data: rutasSemanaActual } = await supabase.from('rutas').select('*').eq('id_chofer', profile.id_usuario).eq('estado', 'finalizada').gte('fecha', inicioSemanaStr).lte('fecha', finSemanaStr);
      const semanaAnteriorInicio = new Date(inicioSemana);
      semanaAnteriorInicio.setDate(semanaAnteriorInicio.getDate() - 7);
      const semanaAnteriorFin = new Date(finSemanaStr);
      semanaAnteriorFin.setDate(semanaAnteriorFin.getDate() - 7);
      
      const { data: rutasSemanaAnterior } = await supabase.from('rutas').select('*').eq('id_chofer', profile.id_usuario).eq('estado', 'finalizada').gte('fecha', format(semanaAnteriorInicio, 'yyyy-MM-dd')).lte('fecha', format(semanaAnteriorFin, 'yyyy-MM-dd'));

      let horasActual = 0, rutasCompletadas = 0;
      (rutasSemanaActual || []).forEach(r => {
          if (r.hora_salida_planta && r.hora_llegada_planta) {
              horasActual += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 3600000);
              rutasCompletadas++;
          }
      });

      let horasAnterior = 0;
      (rutasSemanaAnterior || []).forEach(r => {
          if (r.hora_salida_planta && r.hora_llegada_planta) {
              horasAnterior += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 3600000);
          }
      });

      const porcentajeCambio = horasAnterior > 0 ? Math.round(((horasActual - horasAnterior) / horasAnterior) * 100) : null;

      setStats({
          km_hoy: kmHoy,
          visitas_hoy: visitasHoy,
          tiempo_hoy_min: tiempoHoy,
          rutas_completadas_semana: rutasCompletadas,
          horas_semana_actual: horasActual,
          horas_semana_anterior: horasAnterior,
          porcentaje_cambio: porcentajeCambio
      });

      // 3. Pendientes
      const pendientes = await cargarRutasPendientes(profile.id_usuario);
      setRutasPendientes(pendientes);

      // 4. Descanso
      const diasDescanso = profile.dias_descanso || [];
      const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const hoyIndice = new Date().getDay();
      let proximoDia: string | null = null;
      let diasHasta = 7;

      for (let i = 1; i <= 7; i++) {
        const diaNombre = diasSemana[(hoyIndice + i) % 7];
        if (diasDescanso.includes(diaNombre)) {
          proximoDia = diaNombre;
          diasHasta = i;
          break;
        }
      }

      if (proximoDia) {
          setProximoDescanso(`${proximoDia} (en ${diasHasta} día${diasHasta !== 1 ? 's' : ''})`);
      } else {
          setProximoDescanso('Sin descanso programado');
      }

      // 5. Excepciones
      const { data: exc } = await supabase.from('excepciones_descanso').select('*').eq('id_chofer', profile.id_usuario).gte('fecha', hoyStr).order('fecha').limit(1);
      setExcepcionProxima(exc?.[0] || null);

    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  return { profile, loading, rutaActiva, ultimasRutas, rutasPendientes, proximoDescanso, excepcionProxima, stats, refreshData: cargarDatos };
}
