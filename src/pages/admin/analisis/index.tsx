import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { 
  BarChart3, TrendingUp, Clock, Target, Truck, 
  Calendar, Filter, ChevronDown, ChevronUp, Info,
  Users, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
  format, subDays, startOfWeek, endOfWeek, 
  differenceInMinutes, parseISO, isValid 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line,
  ComposedChart, Cell, ReferenceLine
} from 'recharts';

interface RutaData {
  id_ruta: string;
  nombre: string;
  fecha: string | null;
  hora_salida_planta: string | null;
  hora_llegada_planta: string | null;
  estado: string;
  id_chofer: string | null;
  chofer_nombre?: string;
  tiempo_real?: number;
  tiempo_estimado?: number;
  eficiencia?: number;
  visitas_realizadas: number;
  locales_unicos: number;
  visitas_extra: number;
}

interface ChoferStats {
  id: string;
  nombre: string;
  rutas: number;
  visitasRealizadas: number;
  visitasExtra: number;
  tiempoTotal: number;      // minutos
  eficienciaPromedio: number; // 0–100, basada en mejor tiempo histórico
  tieneEficiencia: boolean;   // false si no hay historial suficiente
}

interface DiaStats {
  dia: string;
  fecha: string;
  semanaActual: number;
  semanaAnterior: number;
  entregas: number;
  eficiencia: number;
}

interface Insight {
  tipo: ' positivo' | 'negativo' | 'info';
  titulo: string;
  descripcion: string;
}

const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#eab308', 
  danger: '#ef4444',
  surface: '#1e293b',
  surfaceLight: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
};

const EFICIENCIA_COLORS = {
  alta: '#22c55e',
  media: '#eab308',
  baja: '#ef4444',
};

function formatHora(hora: string | null): string {
  if (!hora) return '-';
  try {
    if (hora.includes('T')) {
      return hora.split('T')[1].substring(0, 5);
    }
    return hora.substring(0, 5);
  } catch {
    return '-';
  }
}

function formatDurationHuman(mins: number): string {
  if (!mins || mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function calcularTiempoMinutos(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 0;
  try {
    const s = new Date(horaInicio);
    const e = new Date(horaFin);
    const diff = e.getTime() - s.getTime();
    return diff > 0 ? Math.floor(diff / (1000 * 60)) : 0;
  } catch {
    return 0;
  }
}

function getDiaSemana(fecha: string): string {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return dias[new Date(fecha).getDay()];
}

// Datos reales desde Supabase

export default function AnalisisRutas() {
  const [loading, setLoading] = useState(true);
  const [rutas, setRutas] = useState<RutaData[]>([]);
  // mejorTiempoPorDia: key = día ISO (0=Dom,1=Lun...), value = mejor tiempo en minutos
  const [mejorTiempoPorDia, setMejorTiempoPorDia] = useState<Record<number, number>>({});
  // Por defecto cargamos 14 días para tener semana actual + anterior
  const [fechaInicio, setFechaInicio] = useState<string>(() => format(subDays(new Date(), 13), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [choferFilter, setChoferFilter] = useState<string>('todos');
  const [choferes, setChoferes] = useState<{id: string; nombre: string}[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // ── Semana auto: lunes–domingo de la semana actual y la anterior ──
  const semanaActualInicio = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaActualFin   = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaAnteriorInicio = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaAnteriorFin   = format(endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const semanaStats = useMemo(() => {
    const filtrarChofer = (r: RutaData) => choferFilter === 'todos' || r.id_chofer === choferFilter;

    const actual   = rutas.filter(r => filtrarChofer(r) && r.fecha >= semanaActualInicio && r.fecha <= semanaActualFin);
    const anterior = rutas.filter(r => filtrarChofer(r) && r.fecha >= semanaAnteriorInicio && r.fecha <= semanaAnteriorFin);

    const horasActual   = actual.reduce((s, r) => s + (r.tiempo_real || 0), 0) / 60;
    const horasAnterior = anterior.reduce((s, r) => s + (r.tiempo_real || 0), 0) / 60;
    const pct = horasAnterior > 0 ? ((horasActual - horasAnterior) / horasAnterior) * 100 : null;

    const visitasActual   = actual.reduce((s, r) => s + (r.visitas_realizadas || 0), 0);
    const visitasAnterior = anterior.reduce((s, r) => s + (r.visitas_realizadas || 0), 0);

    return { horasActual, horasAnterior, pct, visitasActual, visitasAnterior,
             rutasActual: actual.length, rutasAnterior: anterior.length };
  }, [rutas, choferFilter, semanaActualInicio, semanaActualFin, semanaAnteriorInicio, semanaAnteriorFin]);

  const stats = useMemo(() => {
    const filtered = rutas.filter(r => {
      if (choferFilter !== 'todos' && r.id_chofer !== choferFilter) return false;
      return true;
    });

    const totalReal = filtered.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    const totalUnicos = filtered.reduce((sum, r) => sum + (r.locales_unicos || 0), 0);
    const totalExtra = filtered.reduce((sum, r) => sum + (r.visitas_extra || 0), 0);
    
    const tiempoPromedio = filtered.length > 0 
      ? filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / filtered.length 
      : 0;
    
    const conEficiencia = filtered.filter(r => (r.tiempo_estimado || 0) > 0);
    const eficienciaGlobal = conEficiencia.length > 0
      ? conEficiencia.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / conEficiencia.length
      : null;

    const rutasCompletadas = filtered.filter(r => r.estado === 'finalizada').length;

    return {
      totalReal,
      totalUnicos,
      totalExtra,
      tiempoPromedio,
      eficienciaGlobal,
      rutasCompletadas,
      totalRutas: filtered.length,
      totalHoras: filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60
    };
  }, [rutas, choferFilter]);

  const comparacionSemanal = useMemo((): DiaStats[] => {
    // 0: Domingo, 1: Lunes, ...
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result: DiaStats[] = [];
    
    // Mostramos los últimos 7 días terminando en 'hoy' (fechaFin)
    const end = parseISO(fechaFin);
    
    for (let i = 6; i >= 0; i--) {
      const fechaActual = subDays(end, i);
      const fechaAnterior = subDays(fechaActual, 7);
      
      const rutasActual = rutas.filter(r => r.fecha === format(fechaActual, 'yyyy-MM-dd'));
      const rutasAnterior = rutas.filter(r => r.fecha === format(fechaAnterior, 'yyyy-MM-dd'));
      
      const tiempoActual = rutasActual.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const tiempoAnterior = rutasAnterior.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const entregas = rutasActual.reduce((sum, r) => sum + (r.entregas || 0), 0);
      
      const conEff = rutasActual.filter(r => (r.tiempo_estimado || 0) > 0);
      const eficiencia = conEff.length > 0
        ? conEff.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / conEff.length
        : 0;

      // Variación diaria
      const variacion = tiempoAnterior > 0 ? ((tiempoActual - tiempoAnterior) / tiempoAnterior) * 100 : 0;

      result.push({
        dia: dias[fechaActual.getDay()],
        fecha: format(fechaActual, 'yyyy-MM-dd'),
        semanaActual: Number(tiempoActual.toFixed(1)),
        semanaAnterior: Number(tiempoAnterior.toFixed(1)),
        entregas,
        eficiencia: Number(eficiencia.toFixed(0)),
        variacion: Number(variacion.toFixed(1))
      } as any);
    }
    return result;
  }, [rutas, fechaFin]);

  const eficienciaDiaria = useMemo(() => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result: {
      dia: string; fecha: string;
      eficiencia: number | null;
      tiempoReal: number;
      mejorTiempo: number;
      tieneHistorial: boolean;
    }[] = [];
    
    for (let i = 13; i >= 0; i--) {
      const fecha = subDays(new Date(), i);
      const fechaStr = format(fecha, 'yyyy-MM-dd');
      const rutasDia = rutas.filter(r => r.fecha === fechaStr);
      
      if (rutasDia.length > 0) {
        const diaSemana = fecha.getDay();
        const mejorTiempo = mejorTiempoPorDia[diaSemana] || 0;
        const tRealTotal = rutasDia.reduce((s, r) => s + (r.tiempo_real || 0), 0) / rutasDia.length;
        const tieneHistorial = mejorTiempo > 0;
        const eficiencia = tieneHistorial && tRealTotal > 0
          ? Math.min(Math.round((mejorTiempo / tRealTotal) * 100), 100)
          : null;

        result.push({
          dia: dias[diaSemana],
          fecha: fechaStr,
          eficiencia,
          tiempoReal: Math.round(tRealTotal),
          mejorTiempo,
          tieneHistorial,
        });
      }
    }
    return result;
  }, [rutas, mejorTiempoPorDia]);

  const rendimientoChoferes = useMemo((): ChoferStats[] => {
    const choferMap = new Map<string, {
      id: string; nombre: string;
      rutas: number; visitasRealizadas: number; visitasExtra: number;
      tiempoTotal: number; eficienciaSuma: number; rutasConEff: number;
    }>();
    
    rutas.forEach(ruta => {
      if (!ruta.id_chofer) return;
      const existing = choferMap.get(ruta.id_chofer) || {
        id: ruta.id_chofer,
        nombre: ruta.chofer_nombre || 'Sin nombre',
        rutas: 0, visitasRealizadas: 0, visitasExtra: 0,
        tiempoTotal: 0, eficienciaSuma: 0, rutasConEff: 0,
      };
      existing.rutas++;
      existing.visitasRealizadas += ruta.visitas_realizadas || 0;
      existing.visitasExtra     += ruta.visitas_extra || 0;
      existing.tiempoTotal      += ruta.tiempo_real || 0;
      if ((ruta.eficiencia || 0) > 0) {
        existing.eficienciaSuma += ruta.eficiencia!;
        existing.rutasConEff++;
      }
      choferMap.set(ruta.id_chofer, existing);
    });

    return Array.from(choferMap.values())
      .map(c => ({
        id: c.id,
        nombre: c.nombre,
        rutas: c.rutas,
        visitasRealizadas: c.visitasRealizadas,
        visitasExtra: c.visitasExtra,
        tiempoTotal: c.tiempoTotal,
        eficienciaPromedio: c.rutasConEff > 0 ? c.eficienciaSuma / c.rutasConEff : 0,
        tieneEficiencia: c.rutasConEff > 0,
      }))
      .sort((a, b) => {
        // Sort by efficiency if available, otherwise by visits
        if (a.tieneEficiencia && b.tieneEficiencia) return b.eficienciaPromedio - a.eficienciaPromedio;
        if (a.tieneEficiencia) return -1;
        if (b.tieneEficiencia) return 1;
        return b.visitasRealizadas - a.visitasRealizadas;
      });
  }, [rutas]);

  useEffect(() => {
    generateInsights();
  }, [semanaStats, stats, comparacionSemanal, rendimientoChoferes]);

  const generateInsights = () => {
    const newInsights: Insight[] = [];
    
    if (rutas.length === 0) return;

    // 1. Variación semanal AUTOMÁTICA (basada en semanas reales lun-dom)
    if (semanaStats.horasAnterior > 0) {
      const diff = semanaStats.pct!;
      newInsights.push({
        tipo: diff < 0 ? ' positivo' : 'negativo',
        titulo: `${diff < 0 ? 'Se redujo' : 'Se incrementó'} el tiempo en ${Math.abs(diff).toFixed(0)}% vs la semana anterior`,
        descripcion: `Semana anterior: ${semanaStats.horasAnterior.toFixed(1)}h → Semana actual: ${semanaStats.horasActual.toFixed(1)}h.`,
      });
    } else if (semanaStats.horasActual > 0) {
      newInsights.push({
        tipo: 'info',
        titulo: `Semana actual: ${semanaStats.horasActual.toFixed(1)}h en ${semanaStats.rutasActual} ruta(s)`,
        descripcion: 'No hay datos de la semana anterior para comparar.',
      });
    }

    // 2. Día más lento
    const diaLento = [...comparacionSemanal].sort((a, b) => b.semanaActual - a.semanaActual)[0];
    if (diaLento && diaLento.semanaActual > 0) {
      newInsights.push({
        tipo: 'negativo',
        titulo: `Día más lento: ${diaLento.dia}`,
        descripcion: `Registró el mayor tiempo de ruta en el periodo (${diaLento.semanaActual}h).`,
      });
    }
    
    // 3. Visitas extra (Ineficiencias)
    const extraVisits = stats.totalExtra;
    if (extraVisits > 0) {
      newInsights.push({
        tipo: 'negativo',
        titulo: `Se detectaron ${extraVisits} visitas adicionales`,
        descripcion: `Posibles regresos a locales o redundancias en las rutas del periodo.`,
      });
    }

    // 4. Chofer destacado
    if (rendimientoChoferes.length > 0) {
      const mejorChofer = rendimientoChoferes[0];
      newInsights.push({
        tipo: ' positivo',
        titulo: `Chofer más eficiente: ${mejorChofer.nombre}`,
        descripcion: `Logró el mejor balance entre paradas totales y tiempo de ruta.`,
      });
    }
    
    setInsights(newInsights);
  };

  useEffect(() => {
    loadData();
    loadChoferes();
  }, [fechaInicio, fechaFin]);

  const loadChoferes = async () => {
    const { data } = await supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'chofer').eq('activo', true);
    if (data) setChoferes(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch ALL historical rutas (no date limit) to compute best times per weekday
      const { data: allRutas } = await supabase
        .from('rutas')
        .select('fecha, hora_salida_planta, hora_llegada_planta, estado')
        .eq('estado', 'finalizada');

      // Compute best time (minimum) per weekday from ALL history
      const mejores: Record<number, number> = {}; // key: 0=Dom..6=Sáb
      const conteo:  Record<number, number> = {}; // how many data points per weekday
      (allRutas || []).forEach(r => {
        const t = calcularTiempoMinutos(r.hora_salida_planta, r.hora_llegada_planta);
        if (t <= 0) return;
        const dia = new Date(r.fecha + 'T12:00:00').getDay(); // local day
        conteo[dia] = (conteo[dia] || 0) + 1;
        // Only store best if we have at least 1 data point; we validate later with conteo
        if (!mejores[dia] || t < mejores[dia]) mejores[dia] = t;
      });
      // Only keep days with at least 2 historical data points
      const mejoresValidados: Record<number, number> = {};
      Object.keys(mejores).forEach(d => {
        if ((conteo[Number(d)] || 0) >= 2) mejoresValidados[Number(d)] = mejores[Number(d)];
      });
      setMejorTiempoPorDia(mejoresValidados);

      // 2. Fetch rutas in the selected range
      const { data: rutasData, error: rutasError } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });

      if (rutasError) throw rutasError;

      // 3. Fetch viajes_bitacora to count REAL visits (excluding Planta)
      const { data: bitacoraData, error: bitacoraError } = await supabase
        .from('viajes_bitacora')
        .select('id_ruta, destino_nombre, hora_llegada')
        .in('id_ruta', rutasData?.map(r => r.id_ruta) || []);

      if (bitacoraError) throw bitacoraError;

      if (rutasData && rutasData.length > 0) {
        const processed = rutasData.map(r => {
          const tReal = calcularTiempoMinutos(r.hora_salida_planta, r.hora_llegada_planta);
          const diaSemana = new Date(r.fecha + 'T12:00:00').getDay();
          const tEstimado = mejoresValidados[diaSemana] || 0;
          
          // Filtro de paradas reales (idéntico a Viajes.tsx)
          const segments = bitacoraData?.filter(b => 
            b.id_ruta === r.id_ruta && 
            b.hora_llegada && 
            b.destino_nombre !== 'Planta'
          ) || [];

          const totalVisitas = segments.length;
          const uniqueLocales = new Set(segments.map(s => s.destino_nombre?.toLowerCase().trim())).size;
          
          // Eficiencia basada en mejor tiempo histórico si existe
          const eficiencia = (tEstimado > 0 && tReal > 0)
            ? Math.min((tEstimado / tReal) * 100, 100)  // cap at 100%
            : 0;
          
          return {
            ...r,
            chofer_nombre: r.usuarios?.nombre,
            tiempo_real: tReal,
            tiempo_estimado: tEstimado,
            eficiencia,
            mejor_tiempo_dia: tEstimado,
            visitas_realizadas: totalVisitas,
            locales_unicos: uniqueLocales,
            visitas_extra: totalVisitas - uniqueLocales
          };
        });
        setRutas(processed);
      } else {
        setRutas([]);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEficienciaColor = (eficiencia: number) => {
    if (eficiencia >= 85) return EFICIENCIA_COLORS.alta;
    if (eficiencia >= 70) return EFICIENCIA_COLORS.media;
    return EFICIENCIA_COLORS.baja;
  };

  return (
    <div className="space-y-6">
      {/* Header + Auto Weekly Comparison Hero */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-primary" />
              Análisis de Rutas
            </h1>
            <p className="text-text-muted text-sm mt-1">
              Comparación automática · Semana {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM', { locale: es })} – {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'd MMM', { locale: es })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Chofer filter */}
            <select
              value={choferFilter}
              onChange={(e) => setChoferFilter(e.target.value)}
              className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="todos">Todos los choferes</option>
              {choferes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            {/* Toggle filtros avanzados */}
            <button
              onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-light text-text-muted hover:text-white text-sm transition-colors"
            >
              <Filter size={14} />
              {showFilters ? 'Ocultar filtros' : 'Filtros avanzados'}
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Filtros avanzados (colapsable) */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-surface-light rounded-xl animate-in slide-in-from-top-2">
            <Calendar size={16} className="text-text-muted" />
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-background border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
            />
            <span className="text-text-muted">–</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-background border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
            />
            <span className="text-text-muted text-xs italic">Período personalizado para los gráficos de abajo</span>
          </div>
        )}
      </div>

      {/* ── HERO: Comparación Semanal Automática ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total horas semana */}
        <div className={`lg:col-span-2 p-5 rounded-2xl border-2 flex items-center justify-between gap-6 ${
          semanaStats.pct === null ? 'bg-surface border-surface-light' :
          semanaStats.pct! < 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
        }`}>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-1">Total horas semana</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-white">{semanaStats.horasActual.toFixed(1)}h</span>
              {semanaStats.horasAnterior > 0 && (
                <>
                  <span className="text-text-muted text-lg">vs</span>
                  <span className="text-xl font-bold text-text-muted">{semanaStats.horasAnterior.toFixed(1)}h</span>
                  <span className={`text-base font-black px-2 py-0.5 rounded-lg ${
                    semanaStats.pct! < 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {semanaStats.pct! > 0 ? '+' : ''}{semanaStats.pct!.toFixed(0)}%
                  </span>
                </>
              )}
              {semanaStats.horasAnterior === 0 && semanaStats.horasActual === 0 && (
                <span className="text-text-muted text-sm">Sin datos esta semana</span>
              )}
            </div>
            <p className="text-text-muted text-xs mt-2">
              Semana actual ({semanaStats.rutasActual} ruta{semanaStats.rutasActual !== 1 ? 's' : ''}) &nbsp;·&nbsp;
              Semana anterior ({semanaStats.rutasAnterior} ruta{semanaStats.rutasAnterior !== 1 ? 's' : ''})
            </p>
          </div>
          <div className="hidden lg:flex flex-col items-center">
            {semanaStats.pct !== null && (
              <span className={`text-5xl ${semanaStats.pct < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {semanaStats.pct < 0 ? '↓' : '↑'}
              </span>
            )}
          </div>
        </div>

        {/* Visitas semana actual */}
        <div className="p-5 rounded-2xl border border-surface-light bg-surface flex flex-col justify-center gap-1">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">Visitas esta semana</p>
          <p className="text-3xl font-black text-white">{semanaStats.visitasActual}</p>
          {semanaStats.visitasAnterior > 0 && (
            <p className="text-text-muted text-xs">Semana anterior: {semanaStats.visitasAnterior} visitas</p>
          )}
        </div>
      </div>


      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-surface border border-surface-light overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <BarChart3 className="text-indigo-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Total Horas</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-black text-white">{stats.totalHoras.toFixed(1)}h</p>
                  {(() => {
                    const hActual = comparacionSemanal.reduce((s, d) => s + d.semanaActual, 0);
                    const hAnterior = comparacionSemanal.reduce((s, d) => s + d.semanaAnterior, 0);
                    if (hAnterior > 0) {
                      const diff = ((hActual - hAnterior) / hAnterior) * 100;
                      return (
                        <span className={`text-[10px] font-bold ${diff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff < 0 ? '↓' : '↑'} {Math.abs(diff).toFixed(0)}%
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Vs la semana anterior</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Target className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Visitas Realizadas</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-white">{stats.totalReal}</p>
                  <span className="text-[10px] text-text-muted">Total paradas</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">* Coincide con Seguimiento en Vivo</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Locales Únicos</p>
                <p className="text-xl font-black text-white">{stats.totalUnicos}</p>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Clientes distintos visitados</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <RefreshCw className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Visitas Extra</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-white">{stats.totalExtra}</p>
                  {stats.totalExtra > 0 && <span className="text-[10px] text-red-400 font-bold animate-pulse">Regresos</span>}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Ineficiencias detectadas</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Truck className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Rutas</p>
                <p className="text-xl font-black text-white">{stats.rutasCompletadas}/{stats.totalRutas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Alerts */}
      {stats.totalRutas > 0 && stats.rutasCompletadas < stats.totalRutas && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-yellow-500" size={20} />
          <div>
            <p className="text-yellow-500 text-sm font-bold">Hay rutas incompletas</p>
            <p className="text-yellow-500/70 text-xs">Existen {stats.totalRutas - stats.rutasCompletadas} rutas que aún no han sido finalizadas en este periodo.</p>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {insights.slice(0, 3).map((insight, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-xl border ${
                insight.tipo.includes('positivo') ? 'bg-green-500/10 border-green-500/30' :
                insight.tipo.includes('negativo') ? 'bg-red-500/10 border-red-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <p className={`font-bold text-sm ${
                insight.tipo.includes('positivo') ? 'text-green-400' :
                insight.tipo.includes('negativo') ? 'text-red-400' :
                'text-blue-400'
              }`}>
                {insight.titulo}
              </p>
              <p className="text-text-muted text-xs mt-1">{insight.descripcion}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Comparison */}
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={20} />
              Tiempo de Ruta: Esta Semana vs Anterior
            </h3>
            <p className="text-text-muted text-xs mb-4">
              Comparando tiempo total de ruta entre semana actual y semana anterior
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparacionSemanal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="h" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Legend />
                <Bar dataKey="semanaActual" name="Esta semana" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="semanaAnterior" name="Semana anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Efficiency Chart */}
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <TrendingUp size={20} />
              Eficiencia Diaria vs Mejor Tiempo Histórico
            </h3>
            <p className="text-text-muted text-xs mb-4">
              Qué tan cerca estuvo cada día de su mejor tiempo registrado
            </p>
            {eficienciaDiaria.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-text-muted text-sm">Sin datos en el periodo</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={eficienciaDiaria} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} unit="%" domain={[0, 105]} tickFormatter={v => v > 100 ? '' : `${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#f8fafc', fontWeight: 'bold', marginBottom: 4 }}
                      formatter={(value: any, _name: string, props: any) => {
                        const d = props.payload;
                        if (!d.tieneHistorial) return ['N/D', 'Eficiencia'];
                        return [
                          [
                            `Eficiencia: ${d.eficiencia}%`,
                            `Tiempo real: ${formatDurationHuman(d.tiempoReal)}`,
                            `Mejor histórico: ${formatDurationHuman(d.mejorTiempo)}`,
                          ].join('\n'),
                          ''
                        ];
                      }}
                    />
                    <Bar dataKey="eficiencia" name="Eficiencia" radius={[6, 6, 0, 0]}>
                      {eficienciaDiaria.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            !entry.tieneHistorial ? '#475569' :
                            entry.eficiencia! >= 85 ? '#22c55e' :
                            entry.eficiencia! >= 70 ? '#eab308' :
                            '#ef4444'
                          }
                        />
                      ))}
                    </Bar>
                    {/* Reference line at 85% */}
                    <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '85%', fill: '#22c55e', fontSize: 10, position: 'insideTopRight' }} />
                    <ReferenceLine y={70} stroke="#eab308" strokeDasharray="4 2" label={{ value: '70%', fill: '#eab308', fontSize: 10, position: 'insideTopRight' }} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-5 mt-2 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500"></span> ≥85% Eficiente</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500"></span> 70-85% Aceptable</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500"></span> &lt;70% Ineficiente</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-500"></span> Sin historial</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance */}
      <Card className="bg-surface border border-surface-light">
        <CardContent className="p-4">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Truck size={20} />
            Rendimiento por Chofer
          </h3>
          <p className="text-text-muted text-xs mb-5">
            Eficiencia real basada en el mejor tiempo histórico por día de semana
          </p>

          {rendimientoChoferes.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">Sin datos en el periodo seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-light text-[10px] uppercase tracking-widest text-text-muted">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Chofer</th>
                    <th className="text-center py-2 px-3">Eficiencia</th>
                    <th className="text-center py-2 px-3">Visitas</th>
                    <th className="text-center py-2 px-3">Visitas Extra</th>
                    <th className="text-center py-2 px-3">Rutas</th>
                    <th className="text-right py-2 px-3">T. Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-light/30">
                  {rendimientoChoferes.map((c, idx) => {
                    const eff = c.eficienciaPromedio;
                    const effBg = !c.tieneEficiencia ? 'bg-slate-500/10 text-slate-400'
                      : eff >= 85 ? 'bg-green-500/10 text-green-400'
                      : eff >= 70 ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-red-500/10 text-red-400';
                    const promedioMins = c.rutas > 0 ? c.tiempoTotal / c.rutas : 0;

                    return (
                      <tr key={c.id} className="hover:bg-surface-light/10 transition-colors">
                        <td className="py-3 px-3">
                          <span className="text-text-muted font-black text-xs">{idx + 1}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white">{c.nombre}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${effBg}`}>
                            {c.tieneEficiencia ? `${eff.toFixed(0)}%` : 'N/D'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-white">{c.visitasRealizadas}</span>
                          <span className="text-text-muted text-[10px] ml-1">paradas</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {c.visitasExtra > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-400 font-bold text-xs">
                              <RefreshCw size={11} /> {c.visitasExtra}
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs font-bold">✓ Ninguna</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-text-muted text-xs">{c.rutas}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-white text-xs font-bold">{formatDurationHuman(Math.round(promedioMins))}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-surface-light/50 text-xs text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500"></span> ≥85% Eficiente</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500"></span> 70–85% Aceptable</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> &lt;70% Ineficiente</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500"></span> N/D = Sin historial</span>
            <span className="ml-auto flex items-center gap-1.5"><RefreshCw size={10} className="text-red-400" /> Visitas Extra = regresos</span>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-text-muted">Loading analytics...</div>
        </div>
      )}
    </div>
  );
}