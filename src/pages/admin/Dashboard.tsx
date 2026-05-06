import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { ListaAlertas, detectarInconsistenciasGlobales, Alerta } from '../../components/ui/Alertas';
import { Truck, MapPin, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Car, Route, DollarSign, Activity, ChevronDown, ChevronUp, Calendar, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { formatHoraPeru } from '../../lib/timezone';
import { toDate } from 'date-fns-tz';
import { Link } from 'react-router-dom';

interface Stats {
  rutasActivas: number;
  rutasPendientes: number;
  rutasFinalizadas: number;
  visitasCompletadas: number;
  visitasPendientes: number;
  localesVisitados: number;
  choferesEnRuta: number;
  choferesDisponibles: number;
  choferesDescanso: number;
  choferesSinRuta: number;
  totalChoferes: number;
  gastoCombustibleDia: number;
  gastoCombustibleSemana: number;
  gastoOtrosDia: number;
  gastoOtrosSemana: number;
  gastosHoy: number;
  peajeDia: number;
  peajeSemana: number;
  totalGastosOperativosHoy: number;
}

interface RutaEnProgreso {
  id_ruta: string;
  nombre: string;
  chofer_id: string;
  chofer_nombre: string;
  placa: string;
  estado: string;
  hora_salida: string;
  visitas_totales: number;
  visitas_completadas: number;
}

interface TopChofer {
  chofer_nombre: string;
  total_gasto: number;
  cargas: number;
  tipo?: 'combustible' | 'otros';
}

interface RendimientoDia {
  promedioHistoricoMinutos: number;
  tiempoHoyMinutos: number;
  diferenciaPct: number | null;
  rutasConDatos: number;
  label: string;
}

interface EstadoChofer {
  id: string;
  nombre: string;
  descansoNormal: string;
  tieneExcepcionHoy: boolean;
  descansaHoy: boolean;
  motivo: string;
  enRuta: boolean;
}

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    rutasActivas: 0, rutasPendientes: 0, rutasFinalizadas: 0,
    visitasCompletadas: 0, visitasPendientes: 0, localesVisitados: 0,
    choferesEnRuta: 0, choferesDisponibles: 0, choferesDescanso: 0,
    choferesSinRuta: 0, totalChoferes: 0,
    gastoCombustibleDia: 0, gastoCombustibleSemana: 0,
    gastoOtrosDia: 0, gastoOtrosSemana: 0, gastosHoy: 0,
    peajeDia: 0, peajeSemana: 0,
    totalGastosOperativosHoy: 0
  });
  const [rutasEnProgreso, setRutasEnProgreso] = useState<RutaEnProgreso[]>([]);
  const [topChoferes, setTopChoferes] = useState<TopChofer[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [rendimiento, setRendimiento] = useState<RendimientoDia | null>(null);
  const [estadoChoferes, setEstadoChoferes] = useState<EstadoChofer[]>([]);
  const [loading, setLoading] = useState(true);
  const [choferFilter, setChoferFilter] = useState<string>('todos');
  const [choferes, setChoferes] = useState<{ id_usuario: string; nombre: string }[]>([]);
  const [expandedChoferes, setExpandedChoferes] = useState<Set<string>>(new Set());

  const toggleExpand = (choferId: string) => {
    setExpandedChoferes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(choferId)) {
        newSet.delete(choferId);
      } else {
        newSet.add(choferId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [choferFilter]);

  const calcularMinutos = (inicio: string | null, fin: string | null): number => {
    if (!inicio || !fin) return 0;
    try {
      const toMins = (h: string) => {
        if (h.includes('T')) {
          const d = toDate(h, { timeZone: 'America/Lima' });
          return d.getHours() * 60 + d.getMinutes();
        }
        const [hh, mm] = h.split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0);
      };
      const diff = toMins(fin) - toMins(inicio);
      return diff > 0 && diff < 1440 ? diff : 0;
    } catch { return 0; }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('La consulta está tardando demasiado. Verifica tu conexión.');
    }, 15000);

    try {
      const nowPeru = toDate(new Date().toISOString(), { timeZone: 'America/Lima' });
      const hoyStr = format(nowPeru, 'yyyy-MM-dd');
      const inicioSemana = new Date(nowPeru);
      const day = nowPeru.getDay();
      inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
      const semanaStr = format(inicioSemana, 'yyyy-MM-dd');
      const hace30 = new Date(nowPeru);
      hace30.setDate(hace30.getDate() - 30);
      const hace30Str = format(hace30, 'yyyy-MM-dd');

      const rutasHoyQuery = supabase.from('rutas').select('*').eq('fecha', hoyStr);
      const rutasSemanaQuery = supabase.from('rutas').select('id_ruta, id_ruta_base').gte('fecha', semanaStr).lte('fecha', hoyStr);
      const rutasHistQuery = supabase.from('rutas').select('hora_salida_planta, hora_llegada_planta, fecha, id_chofer').eq('estado', 'finalizada').gte('fecha', hace30Str);

      if (choferFilter !== 'todos') {
        rutasHoyQuery.eq('id_chofer', choferFilter);
        rutasSemanaQuery.eq('id_chofer', choferFilter);
        rutasHistQuery.eq('id_chofer', choferFilter);
      }

      const [rutasHoyRes, rutasSemanaRes, rutasHistRes, choferesRes, todosChoferesRes] = await Promise.all([
        rutasHoyQuery,
        rutasSemanaQuery,
        rutasHistQuery,
        supabase.from('usuarios').select('id_usuario', { count: 'exact', head: true }).eq('rol', 'chofer').eq('activo', true),
        supabase.from('usuarios').select('id_usuario, nombre, dias_descanso').eq('rol', 'chofer').eq('activo', true)
      ]);

      if (todosChoferesRes?.data) setChoferes(todosChoferesRes.data);

      clearTimeout(timeoutId);

      if (rutasHoyRes.error) {
        setError('Error al cargar rutas. Verifica tu conexión.');
        setLoading(false);
        return;
      }

      const rutasHoy = rutasHoyRes.data || [];
      const rutaIdsDelDia = rutasHoy.map(r => r.id_ruta);
      const rutaIdsSemana = rutasSemanaRes.data?.map(r => r.id_ruta) || [];

      const tieneRutasDia = rutaIdsDelDia.length > 0;
      const tieneRutasSemana = rutaIdsSemana.length > 0;

      let combustibleDiaRes = { data: [] as any[] };
      let combustibleSemanaRes = { data: [] as any[] };
      let otrosDiaRes = { data: [] as any[] };
      let otrosSemanaRes = { data: [] as any[] };

      if (tieneRutasDia) {
        const results = await Promise.all([
          supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', rutaIdsDelDia),
          supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', rutaIdsDelDia),
        ]);
        combustibleDiaRes = results[0];
        otrosDiaRes = results[1];
      }

      if (tieneRutasSemana) {
        const results = await Promise.all([
          supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', rutaIdsSemana),
          supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', rutaIdsSemana),
        ]);
        combustibleSemanaRes = results[0];
        otrosSemanaRes = results[1];
      }

      const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const diaHoy = diasSemana[nowPeru.getDay()];
      const todosChoferes = todosChoferesRes.data || [];

      // Estado de choferes con días de descanso (normales y excepciones - preparado para futuro)
      const choferesConEstado: EstadoChofer[] = todosChoferes.map((c: any) => {
        const descansoNormal = (c.dias_descanso || [])[0] || 'ninguno';
        // TODO: Consultar excepciones cuando se implemente la tabla
        const tieneExcepcionHoy = false; // Placeholder para futura implementación
        const descansaExcepcion = false;
        const descansaHoy = descansaExcepcion || (c.dias_descanso || []).includes(diaHoy);

        return {
          id: c.id_usuario,
          nombre: c.nombre,
          descansoNormal,
          tieneExcepcionHoy,
          descansaHoy,
          motivo: descansaHoy ? (tieneExcepcionHoy ? 'Excepción semanal' : 'Descanso fijo') : 'Laborando',
          enRuta: false // Se actualizará después
        };
      });

      const rutasEnCurso = rutasHoy.filter(r => r.estado === 'en_progreso');
      const rutasPendientes = rutasHoy.filter(r => r.estado === 'pendiente');
      const rutasFinalizadas = rutasHoy.filter(r => r.estado === 'finalizada');

      const choferesActivosEnCurso = new Set(rutasEnCurso.map(r => r.id_chofer).filter(Boolean));

      // Actualizar estado enRuta
      choferesConEstado.forEach(c => {
        c.enRuta = choferesActivosEnCurso.has(c.id);
      });

      setEstadoChoferes(choferesConEstado);

      const numDescanso = choferesConEstado.filter(c => c.descansaHoy).length;
      const totalChoferesRegistrados = choferesRes.count || 0;
      const numDisponibles = Math.max(0, totalChoferesRegistrados - numDescanso - choferesActivosEnCurso.size);

      const rutasActivasIds = [...rutasEnCurso, ...rutasFinalizadas].map(r => r.id_ruta);
      let visitasCompletadas = 0, visitasPendientes = 0, localesVisitados = 0;

      if (rutasActivasIds.length > 0) {
        const { data: visData } = await supabase
          .from('locales_ruta').select('estado_visita').in('id_ruta', rutasActivasIds);
        if (visData) {
          visitasCompletadas = visData.filter(v => v.estado_visita === 'visitado').length;
          visitasPendientes = visData.filter(v => v.estado_visita === 'pendiente').length;
          localesVisitados = visData.length;
        }
      }

      const gastoDia = combustibleDiaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
      const gastoSemana = combustibleSemanaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
      const gastoOtrosDia = otrosDiaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
      const gastoOtrosSemana = otrosSemanaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;

      // Cálculo de peajes
      const rutasBaseIds = [...new Set(rutasHoy.map(r => r.id_ruta_base).filter(Boolean))];
      const rutasBaseIdsSemana = [...new Set(rutasSemanaRes.data?.map((_: any) => _.id_ruta_base).filter(Boolean) || [])];
      const rutasBaseMap: Record<string, { cantidad_peajes: number; costo_peaje: number }> = {};

      const allRutasBaseIds = [...new Set([...rutasBaseIds, ...rutasBaseIdsSemana])];
      if (allRutasBaseIds.length > 0) {
        const { data: rbData } = await supabase.from('rutas_base')
          .select('id_ruta_base, cantidad_peajes, costo_peaje').in('id_ruta_base', allRutasBaseIds);
        rbData?.forEach((rb: any) => {
          rutasBaseMap[rb.id_ruta_base] = { cantidad_peajes: rb.cantidad_peajes || 0, costo_peaje: rb.costo_peaje || 0 };
        });
      }

      const calcPeaje = (ruta: any) => {
        const cfg = rutasBaseMap[ruta.id_ruta_base];
        return cfg ? cfg.cantidad_peajes * cfg.costo_peaje : 0;
      };

      const peajeDia = rutasFinalizadas.reduce((s, r) => s + calcPeaje(r), 0);
      const rutasSemanaCompletas = rutasSemanaRes.data || [];
      const peajeSemana = rutasSemanaCompletas.reduce((s: number, r: any) => s + calcPeaje(r), 0);
      const totalGastosOperativosHoy = gastoDia + gastoOtrosDia + peajeDia;

      setStats({
        rutasActivas: rutasEnCurso.length,
        rutasPendientes: rutasPendientes.length,
        rutasFinalizadas: rutasFinalizadas.length,
        visitasCompletadas, visitasPendientes, localesVisitados,
        choferesEnRuta: choferesActivosEnCurso.size,
        choferesDisponibles: numDisponibles,
        choferesDescanso: numDescanso,
        choferesSinRuta: totalChoferesRegistrados - choferesActivosEnCurso.size,
        totalChoferes: totalChoferesRegistrados,
        gastoCombustibleDia: gastoDia, gastoCombustibleSemana: gastoSemana,
        gastoOtrosDia, gastoOtrosSemana,
        gastosHoy: gastoDia + gastoOtrosDia,
        peajeDia, peajeSemana,
        totalGastosOperativosHoy
      });

      // Rutas en progreso
      if (rutasEnCurso.length > 0) {
        const rutasProgresoQuery = supabase
          .from('rutas').select('*, usuarios!rutas_id_chofer_fkey(nombre)')
          .eq('fecha', hoyStr).eq('estado', 'en_progreso');

        if (choferFilter !== 'todos') rutasProgresoQuery.eq('id_chofer', choferFilter);

        const { data: rutasProgreso } = await rutasProgresoQuery;

        if (rutasProgreso) {
          const conVisitas = await Promise.all(rutasProgreso.map(async (r: any) => {
            const [{ count: total }, { count: completadas }] = await Promise.all([
              supabase.from('locales_ruta').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta),
              supabase.from('locales_ruta').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta).eq('estado_visita', 'visitado')
            ]);
            return {
              id_ruta: r.id_ruta,
              nombre: r.nombre || 'Ruta sin nombre',
              chofer_id: r.id_chofer,
              chofer_nombre: r.usuarios?.nombre || 'Sin chofer',
              placa: r.placa || '-',
              estado: r.estado,
              hora_salida: r.hora_salida_planta,
              visitas_totales: total || 0,
              visitas_completadas: completadas || 0,
            };
          }));
          setRutasEnProgreso(conVisitas);
        }
      } else {
        setRutasEnProgreso([]);
      }

      // Alertas
      if (tieneRutasSemana) {
        const gastosQuery = supabase
          .from('gastos_combustible')
          .select('monto, created_at')
          .in('id_ruta', rutaIdsSemana);

        if (choferFilter !== 'todos') gastosQuery.eq('id_chofer', choferFilter);

        const { data: gastosSemana } = await gastosQuery;

        const inconsistencias = detectarInconsistenciasGlobales(
          rutasHoy, choferesActivosEnCurso.size, totalChoferesRegistrados,
          (gastosSemana || []).map((g: any) => ({ fecha: g.created_at, monto: g.monto })), 5
        );
        setAlertas(inconsistencias);
      }

      // Top gastos semana
      if (tieneRutasSemana) {
        const gastosTopQuery = supabase
          .from('gastos_combustible')
          .select('*, usuarios!gastos_combustible_id_chofer_fkey(nombre)')
          .in('id_ruta', rutaIdsSemana);

        if (choferFilter !== 'todos') gastosTopQuery.eq('id_chofer', choferFilter);

        const { data: gastosChofer } = await gastosTopQuery;

        if (gastosChofer) {
          const grpComb: Record<string, { nombre: string; total: number; cargas: number }> = {};
          const grpOtros: Record<string, { nombre: string; total: number; cargas: number }> = {};
          gastosChofer.forEach((g: any) => {
            const id = g.id_chofer;
            const grp = g.tipo_combustible === 'otro' ? grpOtros : grpComb;
            if (!grp[id]) grp[id] = { nombre: g.usuarios?.nombre || 'Sin nombre', total: 0, cargas: 0 };
            grp[id].total += g.monto || 0;
            grp[id].cargas++;
          });
          const topComb = Object.values(grpComb).map(d => ({ chofer_nombre: d.nombre, total_gasto: d.total, cargas: d.cargas, tipo: 'combustible' as const })).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 5);
          const topOtros = Object.values(grpOtros).map(d => ({ chofer_nombre: d.nombre, total_gasto: d.total, cargas: d.cargas, tipo: 'otros' as const })).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 3);
          setTopChoferes([...topComb, ...topOtros]);
        }
      }

      // Rendimiento del día
      const histData = rutasHistRes.data || [];
      const diaSemanaHoy = nowPeru.getDay();
      const rutasMismoDia = histData.filter(r => {
        if (!r.fecha) return false;
        return toDate(r.fecha + 'T00:00:00', { timeZone: 'America/Lima' }).getDay() === diaSemanaHoy;
      });

      const tiemposHistoricos = rutasMismoDia
        .map(r => calcularMinutos(r.hora_salida_planta, r.hora_llegada_planta))
        .filter(t => t > 30 && t < 600);

      const promedioHist = tiemposHistoricos.length > 0
        ? tiemposHistoricos.reduce((a, b) => a + b, 0) / tiemposHistoricos.length
        : 0;

      const tiemposHoy = rutasFinalizadas
        .map((r: any) => calcularMinutos(r.hora_salida_planta, r.hora_llegada_planta))
        .filter((t: number) => t > 0);

      const tiempoPromedioHoy = tiemposHoy.length > 0
        ? tiemposHoy.reduce((a: number, b: number) => a + b, 0) / tiemposHoy.length
        : 0;

      const diferenciaPct = promedioHist > 0 && tiempoPromedioHoy > 0
        ? ((tiempoPromedioHoy - promedioHist) / promedioHist) * 100
        : null;

      const diasNombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      setRendimiento({
        promedioHistoricoMinutos: Math.round(promedioHist),
        tiempoHoyMinutos: Math.round(tiempoPromedioHoy),
        diferenciaPct: diferenciaPct !== null ? Math.round(diferenciaPct) : null,
        rutasConDatos: tiemposHistoricos.length,
        label: diasNombres[diaSemanaHoy]
      });

    } catch (err) {
      setError('Error al cargar los datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const formatMins = (mins: number) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getProgreso = (completadas: number, total: number) =>
    total === 0 ? 0 : Math.round((completadas / total) * 100);

  const rutasPorChofer = rutasEnProgreso.reduce((acc, ruta) => {
    if (!acc[ruta.chofer_id]) {
      acc[ruta.chofer_id] = {
        nombre: ruta.chofer_nombre,
        placa: ruta.placa,
        rutas: []
      };
    }
    acc[ruta.chofer_id].rutas.push(ruta);
    return acc;
  }, {} as Record<string, { nombre: string; placa: string; rutas: RutaEnProgreso[] }>);

  if (error) return (
    <div className="p-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => { setError(null); loadDashboardData(); }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
          Reintentar
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-text-muted">Cargando dashboard...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Panel General</h1>
          {choferFilter !== 'todos' && (
            <div className="bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-xl">
              <p className="text-primary text-sm font-bold">
                {choferes.find(c => c.id_usuario === choferFilter)?.nombre || 'Chofer'}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={choferFilter}
            onChange={e => setChoferFilter(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="todos">Todos los choferes</option>
            {choferes.map(c => (
              <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
            ))}
          </select>
          <button onClick={loadDashboardData}
            className="text-text-muted hover:text-white text-sm flex items-center gap-1">
            <Clock size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-surface-light/20 border border-surface-light rounded-xl p-4">
          <ListaAlertas alertas={alertas} titulo="Alertas detectadas" />
        </div>
      )}

      {/* Pulso del día */}
      {rendimiento && (
        <div className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-4 ${rendimiento.diferenciaPct === null ? 'bg-surface border-surface-light' :
            rendimiento.diferenciaPct <= -5 ? 'bg-green-500/10 border-green-500/40' :
              rendimiento.diferenciaPct >= 10 ? 'bg-red-500/10 border-red-500/40' :
                'bg-yellow-500/10 border-yellow-500/40'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${rendimiento.diferenciaPct === null ? 'bg-surface-light' :
                rendimiento.diferenciaPct <= -5 ? 'bg-green-500/20' :
                  rendimiento.diferenciaPct >= 10 ? 'bg-red-500/20' : 'bg-yellow-500/20'
              }`}>
              <Activity size={22} className={
                rendimiento.diferenciaPct === null ? 'text-text-muted' :
                  rendimiento.diferenciaPct <= -5 ? 'text-green-400' :
                    rendimiento.diferenciaPct >= 10 ? 'text-red-400' : 'text-yellow-400'
              } />
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-bold flex items-center gap-1">
                Pulso del día — {rendimiento.label}
                <Tooltip content={`Compara el tiempo promedio de las rutas finalizadas hoy vs el promedio histórico de los últimos 30 días para este mismo día de la semana (${rendimiento.rutasConDatos} rutas de referencia).`} />
              </p>
              {rendimiento.tiempoHoyMinutos > 0 ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-black text-white">{formatMins(rendimiento.tiempoHoyMinutos)}</span>
                  {rendimiento.promedioHistoricoMinutos > 0 && (
                    <>
                      <span className="text-text-muted text-sm">vs promedio {formatMins(rendimiento.promedioHistoricoMinutos)}</span>
                      {rendimiento.diferenciaPct !== null && (
                        <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${rendimiento.diferenciaPct <= -5 ? 'text-green-400 bg-green-500/10' :
                            rendimiento.diferenciaPct >= 10 ? 'text-red-400 bg-red-500/10' :
                              'text-yellow-400 bg-yellow-500/10'
                          }`}>
                          {rendimiento.diferenciaPct > 0 ? '+' : ''}{rendimiento.diferenciaPct}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-white font-bold">Sin rutas finalizadas aún hoy</p>
              )}
              <p className="text-text-muted text-xs mt-0.5">
                {rendimiento.diferenciaPct === null ? 'Sin datos históricos suficientes para comparar' :
                  rendimiento.diferenciaPct <= -5 ? '✅ Rutas más rápidas que el promedio' :
                    rendimiento.diferenciaPct >= 10 ? '⚠️ Rutas más lentas que el promedio' :
                      '↔️ Rendimiento dentro del rango normal'}
              </p>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center text-center min-w-[80px]">
            <span className="text-3xl">
              {rendimiento.diferenciaPct === null ? '📊' :
                rendimiento.diferenciaPct <= -5 ? '🚀' :
                  rendimiento.diferenciaPct >= 10 ? '🐢' : '✅'}
            </span>
            <span className="text-xs text-text-muted mt-1">{rendimiento.rutasConDatos} refs.</span>
          </div>
        </div>
      )}

      {/* Stats Cards principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Truck className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase font-bold flex items-center gap-1">
                  Rutas Activas <Tooltip content="Rutas en ejecución ahora mismo." />
                </p>
                <p className="text-2xl font-black text-white">{stats.rutasActivas}</p>
                {stats.rutasPendientes > 0 && (
                  <p className="text-xs text-yellow-400">{stats.rutasPendientes} pendientes</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold flex items-center gap-1">
                  Finalizadas <Tooltip content="Rutas completadas correctamente hoy." />
                </p>
                <p className="text-2xl font-black text-white">{stats.rutasFinalizadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <MapPin className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-purple-300 uppercase font-bold flex items-center gap-1">
                  Visitas Hoy <Tooltip content="Visitas completadas sobre el total programado hoy." />
                </p>
                <p className="text-2xl font-black text-white">{stats.visitasCompletadas}</p>
                {stats.localesVisitados > 0 && (
                  <p className="text-xs text-purple-400/70">{stats.localesVisitados} programadas</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.choferesEnRuta > 0 ? 'from-primary/20 to-primary/10 border-primary/30' : 'from-surface-light/20 to-surface-light/10 border-surface-light/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.choferesEnRuta > 0 ? 'bg-primary/20' : 'bg-surface-light/30'}`}>
                <Users className={stats.choferesEnRuta > 0 ? 'text-primary' : 'text-text-muted'} size={20} />
              </div>
              <div>
                <p className={`text-xs uppercase font-bold flex items-center gap-1 ${stats.choferesEnRuta > 0 ? 'text-primary' : 'text-text-muted'}`}>
                  Choferes <Tooltip content="En ruta / total. Muestra disponibles y en descanso." />
                </p>
                <p className={`text-2xl font-black ${stats.choferesEnRuta > 0 ? 'text-white' : 'text-text-muted'}`}>
                  {stats.choferesEnRuta}/{stats.totalChoferes}
                </p>
                <p className="text-[10px] text-text-muted">
                  {stats.choferesDisponibles} disp · {stats.choferesDescanso} desc
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gastos del día */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Fuel className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-yellow-300 uppercase font-bold flex items-center gap-1">
                  Combustible Hoy <Tooltip content="Total gastado en combustible hoy." />
                </p>
                <p className="text-2xl font-black text-white">S/ {stats.gastoCombustibleDia.toFixed(2)}</p>
                <p className="text-xs text-yellow-400/60">Sem: S/ {stats.gastoCombustibleSemana.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Car className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-blue-300 uppercase font-bold flex items-center gap-1">
                Otros Hoy <Tooltip content="Gastos adicionales como estacionamiento u otros." />
              </p>
              <p className="text-2xl font-black text-white">S/ {stats.gastoOtrosDia.toFixed(2)}</p>
              <p className="text-xs text-blue-400/60">Sem: S/ {stats.gastoOtrosSemana.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/10 border border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Route className="text-orange-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-orange-300 uppercase font-bold flex items-center gap-1">
                Peajes Hoy <Tooltip content="Peajes calculados automáticamente según configuración de rutas finalizadas hoy." />
              </p>
              <p className="text-2xl font-black text-white">S/ {stats.peajeDia.toFixed(2)}</p>
              <p className="text-xs text-orange-400/60">Sem: S/ {stats.peajeSemana.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/20 to-teal-600/10 border-teal-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <DollarSign className="text-teal-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-teal-300 uppercase font-bold flex items-center gap-1">
                Total Gastos Operativos <Tooltip content="Suma de combustible + otros gastos + peajes del día." />
              </p>
              <p className="text-2xl font-black text-white">S/ {stats.totalGastosOperativosHoy.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NUEVA SECCIÓN: Estado de choferes hoy */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="text-primary" size={20} />
              Estado de Choferes Hoy
              <Tooltip content="Muestra qué choferes están trabajando, en descanso fijo o con excepción semanal." />
            </h2>
            <Link to="/admin/usuarios" className="text-primary text-sm hover:underline">Gestionar</Link>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {estadoChoferes.map(chofer => (
              <div key={chofer.id} className="flex items-center justify-between p-3 bg-surface-light/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${chofer.enRuta ? 'bg-green-500 animate-pulse' :
                      chofer.descansaHoy ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                  <span className="text-white font-medium">{chofer.nombre}</span>
                  {chofer.descansaHoy ? (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <UserX size={12} /> Descanso
                    </span>
                  ) : chofer.enRuta ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <UserCheck size={12} /> En ruta
                    </span>
                  ) : (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <UserCheck size={12} /> Disponible
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-text-muted text-xs">
                    {chofer.descansaHoy ? (
                      <span className="flex items-center gap-1">
                        {chofer.motivo}
                        {chofer.tieneExcepcionHoy && (
                          <Tooltip content="Excepción aplicada esta semana" />
                        )}
                      </span>
                    ) : (
                      `Descanso normal: ${chofer.descansoNormal}`
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> En ruta</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Disponible</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> En descanso</span>
          </div>
        </CardContent>
      </Card>

      {/* Rutas en Progreso */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="text-primary" size={20} />
              Rutas en Progreso
              <Tooltip content="Rutas actualmente en ejecución. Si un chofer tiene múltiples rutas, se muestran todas." />
            </h2>
            <Link to="/admin/rutas" className="text-primary text-sm hover:underline">Ver todas</Link>
          </div>

          {Object.keys(rutasPorChofer).length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
              <p>No hay rutas en progreso</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(rutasPorChofer).map(([choferId, { nombre, placa, rutas }]) => {
                const totalV = rutas.reduce((s, r) => s + r.visitas_totales, 0);
                const completadasV = rutas.reduce((s, r) => s + r.visitas_completadas, 0);
                const pctGeneral = getProgreso(completadasV, totalV);
                const isExpanded = expandedChoferes.has(choferId);
                const tieneMultiplesRutas = rutas.length > 1;

                return (
                  <div key={choferId} className="bg-surface-light/30 rounded-lg overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-surface-light/50 transition-colors"
                      onClick={() => tieneMultiplesRutas && toggleExpand(choferId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-bold">{nombre}</p>
                            {tieneMultiplesRutas && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                {rutas.length} rutas
                              </span>
                            )}
                          </div>
                          <p className="text-text-muted text-sm">{placa}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-black text-xl">{pctGeneral}%</p>
                          <p className="text-text-muted text-xs">{completadasV}/{totalV} visitas</p>
                        </div>
                        {tieneMultiplesRutas && (
                          <div className="ml-3">
                            {isExpanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
                          </div>
                        )}
                      </div>
                      <div className="w-full bg-surface rounded-full h-2 mt-2">
                        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pctGeneral}%` }} />
                      </div>
                    </div>

                    {tieneMultiplesRutas && isExpanded && (
                      <div className="border-t border-white/10 bg-black/20 p-3 space-y-3">
                        <p className="text-xs text-text-muted px-2 uppercase font-bold">Detalle por ruta:</p>
                        {rutas.map((ruta, idx) => {
                          const pctRuta = getProgreso(ruta.visitas_completadas, ruta.visitas_totales);
                          return (
                            <div key={ruta.id_ruta} className="bg-surface/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-white text-sm font-bold flex items-center gap-2">
                                    {ruta.nombre}
                                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                      Ruta {idx + 1}
                                    </span>
                                  </p>
                                  {ruta.hora_salida && (
                                    <p className="text-text-muted text-xs">Salida: {formatHoraPeru(ruta.hora_salida)}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-primary font-bold">{pctRuta}%</p>
                                  <p className="text-text-muted text-[10px]">{ruta.visitas_completadas}/{ruta.visitas_totales}</p>
                                </div>
                              </div>
                              <div className="w-full bg-surface rounded-full h-1.5">
                                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pctRuta}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!tieneMultiplesRutas && rutas[0] && (
                      <div className="px-4 pb-4 pt-0">
                        <p className="text-text-muted text-xs flex items-center gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
                          Ruta: {rutas[0].nombre}
                          {rutas[0].hora_salida && ` · Salida: ${formatHoraPeru(rutas[0].hora_salida)}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Gastos Semana */}
      {topChoferes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <TrendingUp className="text-yellow-400" size={20} />
              Top Gastos de Semana
              <Tooltip content="Distribución de gastos de la semana por categoría." />
            </h2>
            <div className="space-y-2">
              {topChoferes.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-surface-light/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-text-muted'}`}>
                      #{i + 1}
                    </span>
                    <span className="text-white">{c.chofer_nombre}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${c.tipo === 'otros' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                      {c.tipo === 'otros' ? 'Otros' : 'Combustible'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">S/ {c.total_gasto.toFixed(2)}</p>
                    <p className="text-text-muted text-xs">{c.cargas} {c.tipo === 'otros' ? 'pagos' : 'cargas'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accesos Rápidos */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-bold text-white mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/admin/rutas/nueva" className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center hover:bg-blue-500/20 transition-colors">
              <p className="text-blue-400 font-medium text-sm">Nueva Ruta</p>
            </Link>
            <Link to="/admin/combustible" className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center hover:bg-yellow-500/20 transition-colors">
              <p className="text-yellow-400 font-medium text-sm">Revisar Combustible</p>
            </Link>
            <Link to="/admin/usuarios" className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center hover:bg-green-500/20 transition-colors">
              <p className="text-green-400 font-medium text-sm">Choferes</p>
            </Link>
            <Link to="/admin/reportes" className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-center hover:bg-purple-500/20 transition-colors">
              <p className="text-purple-400 font-medium text-sm">Reportes</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
