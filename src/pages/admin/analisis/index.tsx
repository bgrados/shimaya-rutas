import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { calcularAsistenciaMensual } from '../../../lib/asistencia';
import { 
  BarChart3, TrendingUp, Clock, Target, Truck, 
  Calendar, Filter, ChevronDown, ChevronUp, Info,
  Users, RefreshCw, AlertCircle, Plus, Trash2, MapPin
} from 'lucide-react';
import { 
  format, subDays, startOfWeek, endOfWeek, 
  differenceInMinutes, parseISO, isValid, parse 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatFriendlyDate } from '../../../lib/timezone';
import type { AsistenciaChofer, TipoAsistencia } from '../../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line,
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
  km_inicio?: number;
  km_fin?: number;
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
  diasTrabajados: number;
  diasEsperados: number;
  diasDescanso: string[];
  asistenciaStats: {
    trabajo: number;
    descanso: number;
    falta: number;
    permiso: number;
  };
  kmTotal: number;
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
    // Si son solo horas (formato HH:mm sin fecha completa), extraer solo la parte de tiempo
    const soloHora = (h: string) => {
      if (h.includes('T') && h.length <= 16) {
        // Es ISO pero sin segundos: "2024-04-24T03:30"
        const parts = h.split('T');
        const timePart = parts[1]?.substring(0, 5) || h;
        const [ho, mi] = timePart.split(':').map(Number);
        return { hora: ho || 0, min: mi || 0 };
      } else if (h.includes('T')) {
        // Es ISO completo
        const d = new Date(h);
        return { hora: d.getHours(), min: d.getMinutes() };
      } else if (h.includes(':')) {
        // Es solo hora "03:30"
        const [ho, mi] = h.split(':').map(Number);
        return { hora: ho || 0, min: mi || 0 };
      }
      return { hora: 0, min: 0 };
    };
    
    const inicio = soloHora(horaInicio);
    const fin = soloHora(horaFin);
    
    const minsInicio = inicio.hora * 60 + inicio.min;
    const minsFin = fin.hora * 60 + fin.min;
    
    let diff = minsFin - minsInicio;
    if (diff < 0) diff += 24 * 60; // Si cruzó medianoche
    
    return diff > 0 && diff < 24 * 60 ? diff : 0;
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
  const [fechaInicio, setFechaInicio] = useState<string>(() => format(subDays(new Date(), 20), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [choferFilter, setChoferFilter] = useState<string>('todos');
  const [choferes, setChoferes] = useState<{id_usuario: string; nombre: string; dias_descanso: string[]; fecha_ingreso: string | null}[]>([]);
  const [asistencia, setAsistencia] = useState<AsistenciaChofer[]>([]);
  const [showAsistenciaModal, setShowAsistenciaModal] = useState(false);
  const [nuevaAsistencia, setNuevaAsistencia] = useState<Partial<AsistenciaChofer>>({
    estado: 'falta',
    fecha: format(new Date(), 'yyyy-MM-dd')
  });
  const [insights, setInsights] = useState<Insight[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Label dinámico para comparación acumulada de la semana
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dow = new Date().getDay();
  const diasTranscurridos = dow === 0 ? 7 : dow;
  const diaFin = diasSemana[diasTranscurridos];
  const diaInicio = diasSemana[1];
  const comparacionDiaLabel = diasTranscurridos === 1 
    ? `1 día (${diaFin})` 
    : `Acumulado ${diaInicio}–${diaFin}`;

  // ── Semana auto: lunes–domingo de la semana actual y la anterior ──
  const semanaActualInicio = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaActualFin   = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaAnteriorInicio = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const semanaAnteriorFin   = format(endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const semanaStats = useMemo(() => {
    const filtrarChofer = (r: RutaData) => choferFilter === 'todos' || r.id_chofer === choferFilter;
    const today = new Date();

    // ¿Qué día de la semana es hoy? (1=Lun...7=Dom)
    // getDay() returns 0=Sun, so we map to 1=Mon...7=Sun
    const dowToday = today.getDay() === 0 ? 7 : today.getDay();
    // Días transcurridos en esta semana incluyendo hoy (1 = solo lunes, 2 = lun+mar, ...)
    const diasTranscurridos = dowToday;
    console.log('[SEMANA-STATS] dowToday:', dowToday, 'diasTranscurridos:', diasTranscurridos, 'choferFilter:', choferFilter);

    // Semana actual: desde el lunes de esta semana hasta HOY
    const semActIni = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const semActFin = format(today, 'yyyy-MM-dd');

    // Semana anterior: MISMOS días equivalentes (lunes pasado + diasTranscurridos - 1)
    const lunesPasado = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
    const semAntIni = format(lunesPasado, 'yyyy-MM-dd');
    const semAntFin = format(subDays(lunesPasado, -diasTranscurridos + 1), 'yyyy-MM-dd'); // lunes + (dias-1)

    console.log('[SEMANA-STATS] Fechas: actual', semActIni, 'a', semActFin, 'anterior', semAntIni, 'a', semAntFin);
    const actual   = rutas.filter(r => filtrarChofer(r) && r.fecha >= semActIni && r.fecha <= semActFin);
    console.log('[SEMANA-STATS] Rutas actual:', actual.length, 'fechas:', actual.map(r => r.fecha));
    const anterior = rutas.filter(r => filtrarChofer(r) && r.fecha >= semAntIni && r.fecha <= semAntFin);
    console.log('[SEMANA-STATS] Rutas anterior:', anterior.length, 'fechas:', anterior.map(r => r.fecha));

    const horasActual   = actual.reduce((s, r) => s + (r.tiempo_real || 0), 0) / 60;
    const horasAnterior = anterior.reduce((s, r) => s + (r.tiempo_real || 0), 0) / 60;

    // Validación de comparación
    const sinDatosActual   = actual.length === 0;
    const sinDatosAnterior = anterior.length === 0;
    const comparacionParcial = sinDatosActual || sinDatosAnterior;
    const pct = (!comparacionParcial && horasAnterior > 0)
      ? ((horasActual - horasAnterior) / horasAnterior) * 100
      : null;

    const visitasActual   = actual.reduce((s, r) => s + (r.visitas_realizadas || 0), 0);
    const visitasAnterior = anterior.reduce((s, r) => s + (r.visitas_realizadas || 0), 0);

    return {
      horasActual, horasAnterior, pct,
      visitasActual, visitasAnterior,
      rutasActual: actual.length, rutasAnterior: anterior.length,
      diasTranscurridos,
      comparacionParcial,
      sinDatosActual,
      sinDatosAnterior,
      // Labels for transparency
      labelActual: `${semActIni} – ${semActFin}`,
      labelAnterior: `${semAntIni} – ${semAntFin}`,
      // Día equivalente para UI
    };
  }, [rutas, choferFilter]);

  const rendimientoChoferes = useMemo((): ChoferStats[] => {
    const choferMap = new Map<string, {
      id: string; nombre: string;
      rutas: number; visitasRealizadas: number; visitasExtra: number;
      tiempoTotal: number; eficienciaSuma: number; rutasConEff: number;
      fechasTrabajadas: Set<string>;
      diasDescanso: string[];
      fechaIngreso: string | null;
      kmTotal: number;
    }>();

    // Inicializar mapa con todos los choferes para incluirlos aunque no tengan rutas
    choferes.forEach(c => {
      choferMap.set(c.id_usuario, {
        id: c.id_usuario,
        nombre: c.nombre,
        rutas: 0, visitasRealizadas: 0, visitasExtra: 0,
        tiempoTotal: 0, eficienciaSuma: 0, rutasConEff: 0,
        fechasTrabajadas: new Set<string>(),
        diasDescanso: c.dias_descanso || [],
        fechaIngreso: c.fecha_ingreso || null,
        kmTotal: 0,
      });
    });
    
    rutas.forEach(ruta => {
      if (!ruta.id_chofer) return;
      const existing = choferMap.get(ruta.id_chofer);
      if (!existing) return;

      existing.rutas++;
      existing.visitasRealizadas += ruta.visitas_realizadas || 0;
      existing.visitasExtra     += ruta.visitas_extra || 0;
      existing.tiempoTotal      += ruta.tiempo_real || 0;
      if (ruta.fecha) existing.fechasTrabajadas.add(ruta.fecha);
      
      if (ruta.km_inicio && ruta.km_fin && ruta.km_fin > ruta.km_inicio) {
        existing.kmTotal += (ruta.km_fin - ruta.km_inicio);
      }
      
      if ((ruta.eficiencia || 0) > 0) {
        existing.eficienciaSuma += ruta.eficiencia!;
        existing.rutasConEff++;
      }
    });

    const calcAsistencia = (inicio: string, fin: string, choferId: string, descansos: string[], fechasTrabajadas: Set<string>) => {
      if (!inicio || !fin) return { trabajo: 0, descanso: 0, falta: 0, permiso: 0, esperados: 0, trabajados: fechasTrabajadas.size };
      
      const start = parseISO(inicio);
      const end = parseISO(fin);
      
      const stats = { trabajo: 0, descanso: 0, falta: 0, permiso: 0, esperados: 0 };
      
      const diasSemanaMap: Record<string, number> = {
        'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6,
        'miércoles': 3, 'sábado': 6
      };
      const restIndices = descansos.map(d => diasSemanaMap[d.toLowerCase()]).filter(v => v !== undefined);
      
      const curr = new Date(start);
      while (curr <= end) {
        const dateStr = format(curr, 'yyyy-MM-dd');
        const diaSemana = curr.getDay();
        const esDiaDescanso = restIndices.includes(diaSemana);
        
        // 1. Check for manual record
        const manualRecord = asistencia.find(a => a.id_chofer === choferId && a.fecha === dateStr);
        
        if (manualRecord && manualRecord.estado && (manualRecord.estado === 'trabajo' || manualRecord.estado === 'descanso' || manualRecord.estado === 'falta' || manualRecord.estado === 'permiso')) {
          stats[manualRecord.estado]++;
          if (manualRecord.estado !== 'descanso' && manualRecord.estado !== 'permiso') {
            stats.esperados++;
          }
        } else {
          // 2. No manual record, apply automatic logic
          if (esDiaDescanso) {
            // Check if they worked on their rest day
            if (fechasTrabajadas.has(dateStr)) {
              stats.trabajo++;
              stats.esperados++; // Se convierte en día programado porque trabajó
            } else {
              stats.descanso++;
            }
          } else {
            // Regular working day
            stats.esperados++;
            if (fechasTrabajadas.has(dateStr)) {
              stats.trabajo++;
            } else {
              stats.falta++;
            }
          }
        }
        
        curr.setDate(curr.getDate() + 1);
      }
      
      // Nota: La función calcAsistencia local fue reemplazada por calcularAsistenciaMensual
      // para unificar la lógica de asistencia en todos los módulos.
      // Se mantiene aquí solo para compatibilidad con el cálculo de asistencia manual (opcional).
      
      return { ...stats, trabajados: stats.trabajo };
    };

    return Array.from(choferMap.values())
      .map(c => {
        // Mapear nombre de día o número a número
        const diasMap: Record<string, number> = { 
          'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3, 
          'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6,
          '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
        };
        const primerDia = c.diasDescanso?.[0]?.toLowerCase() || '';
        const diaDescansoNum = primerDia ? diasMap[primerDia] : undefined;
        
        console.log(`[ANALISIS] ${c.nombre}: diasDescanso=${JSON.stringify(c.diasDescanso)}, primerDia="${primerDia}", diaDescansoNum=${diaDescansoNum}, fechaIngreso=${c.fechaIngreso}, fechaFin=${fechaFin}`);
        
        const fechaInicioChofer = c.fechaIngreso || fechaInicio;
        
        const choferObj = {
          id_usuario: c.id,
          nombre: c.nombre,
          fecha_ingreso: fechaInicioChofer,
          dia_descanso: diaDescansoNum
        };
        
        const asist = calcularAsistenciaMensual({
          chofer: choferObj as any,
          rutasDelMes: rutas,
          fechaFin: fechaFin
        });
        
        return {
          id: c.id,
          nombre: c.nombre,
          rutas: c.rutas,
          visitasRealizadas: c.visitasRealizadas,
          visitasExtra: c.visitasExtra,
          tiempoTotal: c.tiempoTotal,
          eficienciaPromedio: c.rutasConEff > 0 ? c.eficienciaSuma / c.rutasConEff : 0,
          tieneEficiencia: c.rutasConEff > 0,
          diasTrabajados: asist.trabajados,
          diasEsperados: asist.programados,
          diasDescanso: c.diasDescanso,
          asistenciaStats: {
            trabajo: asist.trabajados,
            descanso: asist.descansos,
            falta: asist.faltan,
            permiso: 0
          },
          kmTotal: c.kmTotal
        };
      })
      .sort((a, b) => {
        if (a.tieneEficiencia && b.tieneEficiencia) return b.eficienciaPromedio - a.eficienciaPromedio;
        if (a.tieneEficiencia) return -1;
        if (b.tieneEficiencia) return 1;
        return b.visitasRealizadas - a.visitasRealizadas;
      });
  }, [rutas, choferes, fechaInicio, fechaFin]);

  const stats = useMemo(() => {
    const filtered = rutas.filter(r => {
      if (r.estado !== 'finalizada') return false;
      if (choferFilter !== 'todos' && r.id_chofer !== choferFilter) return false;
      return true;
    });
    
    // Count unique dates with finalized routes
    const fechasUnicas = new Set(filtered.map(r => r.fecha).filter(Boolean));
    const diasTrabajados = fechasUnicas.size;
    const totalRutas = diasTrabajados;

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

    const totalKm = filtered.reduce((sum, r) => {
      if (r.km_inicio != null && r.km_fin != null && r.km_fin >= r.km_inicio) {
        return sum + (r.km_fin - r.km_inicio);
      }
      return sum;
    }, 0);

    return {
      totalReal,
      totalUnicos,
      totalExtra,
      tiempoPromedio,
      eficienciaGlobal,
      rutasCompletadas: filtered.length,
      totalRutas: diasTrabajados,
      totalHoras: filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60,
      totalKm
    };
  }, [rutas, choferFilter]);

const comparacionDiaEquivalente = useMemo(() => {
    const hoyStr = fechaFin;
    const end = parseISO(fechaFin);
    const hace7DiasStr = format(subDays(end, 7), 'yyyy-MM-dd');
    
    const filtrarRutas = (arr: RutaData[]) => choferFilter === 'todos' ? arr : arr.filter(r => r.id_chofer === choferFilter);
    
    const rutasHoy = filtrarRutas(rutas.filter(r => r.fecha === hoyStr));
    const rutasPasado = filtrarRutas(rutas.filter(r => r.fecha === hace7DiasStr));
    
    const calcularKm = (arr: RutaData[]) => arr.reduce((sum, r) => {
      if (r.km_inicio != null && r.km_fin != null && r.km_fin >= r.km_inicio) {
        return sum + (r.km_fin - r.km_inicio);
      }
      return sum;
    }, 0);
    
    const kmHoy = calcularKm(rutasHoy);
    const kmPasado = calcularKm(rutasPasado);
    
    const tiempoHoy = rutasHoy.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
    const tiempoPasado = rutasPasado.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
    
    const paradasHoy = rutasHoy.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    const paradasPasado = rutasPasado.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    
    return {
      hoyStr,
      hace7DiasStr,
      diaNombre: diasSemana[end.getDay()],
      hoy: { km: kmHoy, tiempo: tiempoHoy, paradas: paradasHoy },
      pasado: { km: kmPasado, tiempo: tiempoPasado, paradas: paradasPasado },
      hayDatosPasados: rutasPasado.length > 0,
      diff: {
        km: kmPasado > 0 ? ((kmHoy - kmPasado) / kmPasado) * 100 : 0,
        tiempo: tiempoPasado > 0 ? ((tiempoHoy - tiempoPasado) / tiempoPasado) * 100 : 0,
        paradas: kmPasado > 0 ? ((paradasHoy - paradasPasado) / kmPasado) * 100 : 0
      }
    };
  }, [rutas, fechaFin, choferFilter]);

  const comparacionSemanal = useMemo((): DiaStats[] => {
    const filtrarChofer = (r: RutaData) => choferFilter === 'todos' || r.id_chofer === choferFilter;
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result: DiaStats[] = [];
    
    const end = parseISO(fechaFin);
    
    for (let i = 6; i >= 0; i--) {
      const fechaActual = subDays(end, i);
      const fechaAnterior = subDays(fechaActual, 7);
      
      const rutasActual = rutas.filter(r => filtrarChofer(r) && r.fecha === format(fechaActual, 'yyyy-MM-dd'));
      const rutasAnterior = rutas.filter(r => filtrarChofer(r) && r.fecha === format(fechaAnterior, 'yyyy-MM-dd'));
      
      const tiempoActual = rutasActual.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const tiempoAnterior = rutasAnterior.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const entregas = rutasActual.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
      
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
  }, [rutas, fechaFin, choferFilter]);

  const eficienciaDiaria = useMemo(() => {
    const filtrarChofer = (r: RutaData) => choferFilter === 'todos' || r.id_chofer === choferFilter;
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
      const rutasDia = rutas.filter(r => filtrarChofer(r) && r.fecha === fechaStr);
      
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
  }, [rutas, mejorTiempoPorDia, choferFilter]);

  useEffect(() => {
    generateInsights();
  }, [semanaStats, stats, comparacionSemanal, rendimientoChoferes, comparacionDiaEquivalente]);

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
    const { data } = await supabase.from('usuarios')
      .select('id_usuario, nombre, dias_descanso, fecha_ingreso')
      .eq('rol', 'chofer')
      .eq('activo', true);
    if (data) setChoferes(data as any);
  };

  const handleDeleteAsistencia = async (id: string) => {
    if (!confirm('¿Eliminar este registro de asistencia?')) return;
    const { error } = await supabase.from('asistencia_chofer').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else loadData();
  };

  const handleSaveAsistencia = async () => {
    if (!nuevaAsistencia.id_chofer || !nuevaAsistencia.fecha) {
      return alert('Chofer y fecha son obligatorios');
    }

    const { error } = await supabase.from('asistencia_chofer').upsert({
      id_chofer: nuevaAsistencia.id_chofer,
      fecha: nuevaAsistencia.fecha,
      estado: nuevaAsistencia.estado,
      observaciones: nuevaAsistencia.observaciones
    }, { onConflict: 'id_chofer,fecha' });

    if (error) {
      alert('Error: ' + error.message);
    } else {
      setShowAsistenciaModal(false);
      setNuevaAsistencia({ estado: 'falta', fecha: format(new Date(), 'yyyy-MM-dd') });
      loadData();
    }
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

      // 2. Fetch rutas in the selected range (desde inicio del mes para asistencia)
      const inicioMes = format(new Date(), 'yyyy-MM-01');
      const { data: rutasData, error: rutasError } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', inicioMes)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });

      if (rutasError) throw rutasError;

      // 2. Fetch manual asistencia records
      const { data: fData } = await supabase
        .from('asistencia_chofer')
        .select('*, usuarios(nombre)')
        .gte('fecha', inicioMes)
        .lte('fecha', fechaFin);
      
      if (fData) {
        setAsistencia(fData.map((f: any) => ({
          ...f,
          usuario_nombre: f.usuarios?.nombre
        })));
      }

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
            visitas_extra: totalVisitas - uniqueLocales,
            km_inicio: r.km_inicio,
            km_fin: r.km_fin
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
                <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
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
          semanaStats.pct < 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-1">
                Comparación día equivalente ({comparacionDiaLabel})
                <Tooltip content="Suma de horas trabajadas en los días seleccionados. Se compara con los mismos días de la semana anterior para medir si trabajaste más rápido o más lento." />
              </p>
              {semanaStats.comparacionParcial && (semanaStats.horasActual > 0 || semanaStats.horasAnterior > 0) && (
                <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold">
                  Comparación parcial por falta de datos
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl font-black text-white">{semanaStats.horasActual.toFixed(1)}h</span>
              {!semanaStats.comparacionParcial && semanaStats.horasAnterior > 0 ? (
                <>
                  <span className="text-text-muted text-lg">vs</span>
                  <span className="text-xl font-bold text-text-muted">{semanaStats.horasAnterior.toFixed(1)}h</span>
                  <span className={`text-base font-black px-2 py-0.5 rounded-lg ${
                    semanaStats.pct! < 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {semanaStats.pct! > 0 ? '+' : ''}{semanaStats.pct!.toFixed(0)}%
                  </span>
                </>
              ) : semanaStats.comparacionParcial && semanaStats.horasAnterior > 0 ? (
                <>
                  <span className="text-text-muted text-lg">vs</span>
                  <span className="text-xl font-bold text-text-muted">{semanaStats.horasAnterior.toFixed(1)}h</span>
                  <span className="text-[11px] text-yellow-400 font-bold">⚠ Días no equivalentes</span>
                </>
              ) : !semanaStats.sinDatosActual && semanaStats.sinDatosAnterior ? (
                <span className="text-text-muted text-sm">Sin datos semana anterior</span>
              ) : semanaStats.sinDatosActual && semanaStats.sinDatosAnterior ? (
                <span className="text-text-muted text-sm">Sin datos esta semana</span>
              ) : null}
            </div>
            <p className="text-text-muted text-[10px] mt-2 font-mono">
              Esta semana: {semanaStats.labelActual} ({semanaStats.rutasActual} ruta{semanaStats.rutasActual !== 1 ? 's' : ''})
              &nbsp;·&nbsp;
              Sem. anterior (equiv.): {semanaStats.labelAnterior} ({semanaStats.rutasAnterior} ruta{semanaStats.rutasAnterior !== 1 ? 's' : ''})
            </p>
            {semanaStats.horasActual > 0 && semanaStats.horasAnterior > 0 && (
              (() => {
                const minActual = Math.round(semanaStats.horasActual * 60);
                const minAnterior = Math.round(semanaStats.horasAnterior * 60);
                const diff = minActual - minAnterior;
                const diffAbs = Math.abs(diff);
                const diaEq = semanaStats.diaEquivalente || diaFin;
                const diffText = diffAbs < 1 
                  ? `Sin diferencia vs ${diaEq}`
                  : diff > 0 
                    ? `+${diffAbs} min vs ${diaEq}`
                    : `-${diffAbs} min vs ${diaEq}`;
                const esPositivo = diff > 0;
                const esNegativo = diff < 0;
                return (
                  <p className={`text-[11px] mt-1 font-medium ${
                    esPositivo ? 'text-red-400' : esNegativo ? 'text-green-400' : 'text-text-muted'
                  }`}>
                    {esPositivo ? 'Mayor tiempo que el ' + diaEq : esNegativo ? 'Menor tiempo que el ' + diaEq : diffText}
                  </p>
                );
              })()
            )}
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
          <p className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-1">
            Visitas esta semana
            <Tooltip content="Cantidad de paradas realizadas en los días seleccionados. Incluye visitas repetidas al mismo local." />
          </p>
          <p className="text-3xl font-black text-white">{semanaStats.visitasActual}</p>
          {semanaStats.visitasAnterior > 0 && (
            <p className="text-text-muted text-xs">Semana anterior: {semanaStats.visitasAnterior} visitas</p>
          )}
        </div>
      </div>


      {/* Comparación Día Equivalente */}
      {comparacionDiaEquivalente.hayDatosPasados && (
        <Card className="bg-surface border border-surface-light overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="text-primary" size={18} />
              Comparación Día Equivalente: {comparacionDiaEquivalente.diaNombre}
              <Tooltip content={`Comparando los datos de ${comparacionDiaEquivalente.hoyStr} vs el mismo día de la semana pasada (${comparacionDiaEquivalente.hace7DiasStr}).`} />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KM */}
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-[10px] uppercase font-bold mb-1">Kilómetros Recorridos</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{comparacionDiaEquivalente.hoy.km.toFixed(1)} km</span>
                  <span className={`text-xs font-bold ${comparacionDiaEquivalente.diff.km < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {comparacionDiaEquivalente.diff.km > 0 ? '↑' : '↓'} {Math.abs(comparacionDiaEquivalente.diff.km).toFixed(1)}%
                  </span>
                </div>
                <p className="text-text-muted text-[10px] mt-1">
                  vs {comparacionDiaEquivalente.pasado.km.toFixed(1)} km (sem. pasada)
                </p>
              </div>

              {/* Tiempo */}
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-[10px] uppercase font-bold mb-1">Tiempo de Ruta</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{comparacionDiaEquivalente.hoy.tiempo.toFixed(1)}h</span>
                  <span className={`text-xs font-bold ${comparacionDiaEquivalente.diff.tiempo < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {comparacionDiaEquivalente.diff.tiempo > 0 ? '↑' : '↓'} {Math.abs(comparacionDiaEquivalente.diff.tiempo).toFixed(1)}%
                  </span>
                </div>
                <p className="text-text-muted text-[10px] mt-1">
                  vs {comparacionDiaEquivalente.pasado.tiempo.toFixed(1)}h (sem. pasada)
                </p>
              </div>

              {/* Paradas */}
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-[10px] uppercase font-bold mb-1">Visitas / Paradas</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">{comparacionDiaEquivalente.hoy.paradas}</span>
                  <span className={`text-xs font-bold ${comparacionDiaEquivalente.diff.paradas > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {comparacionDiaEquivalente.diff.paradas > 0 ? '↑' : '↓'} {Math.abs(comparacionDiaEquivalente.diff.paradas).toFixed(1)}%
                  </span>
                </div>
                <p className="text-text-muted text-[10px] mt-1">
                  vs {comparacionDiaEquivalente.pasado.paradas} paradas (sem. pasada)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards del Período Seleccionado */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 px-1">
          Totales del Período Seleccionado
          <span className="text-[10px] font-normal text-text-muted bg-surface border border-surface-light px-2 py-0.5 rounded-full">
            Según filtros de fecha
          </span>
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

          <Card className="bg-surface border border-surface-light overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <BarChart3 className="text-indigo-400" size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                    Total Horas
                    <Tooltip content="Total acumulado de horas trabajadas desde el inicio del registro. No es una comparación, solo un resumen general." />
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-black text-white">{stats.totalHoras.toFixed(1)}h</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border border-surface-light overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MapPin className="text-blue-400" size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                    Kilometraje Total
                    <Tooltip content="Suma de kilómetros recorridos en todas las rutas del periodo seleccionado." />
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-black text-white">{stats.totalKm.toFixed(0)} km</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Target className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                  Visitas Realizadas
                  <Tooltip content="Total de paradas realizadas en todo el periodo. Incluye todas las visitas, incluso si se repite el mismo local." />
                </p>
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
                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                  Locales Únicos
                  <Tooltip content="Cantidad de clientes diferentes visitados, sin contar repeticiones en un mismo día o ruta." />
                </p>
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
                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                  Visitas Extra
                  <Tooltip content="Número de paradas adicionales generadas por regresos o incidencias en ruta." />
                </p>
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
                <p className="text-[10px] text-text-muted uppercase font-bold flex items-center gap-1">
                  Rutas
                  <Tooltip content="Cantidad de rutas completadas correctamente sobre el total registrado. Garantiza que los datos sean completos y confiables." />
                </p>
                <p className="text-xl font-black text-white">
                {stats.rutasCompletadas}/{stats.totalRutas} 
                ({stats.totalRutas > 0 ? Math.round(stats.rutasCompletadas / stats.totalRutas * 100) : 0}%)
              </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Clock size={20} />
              Tiempo de Ruta: Esta Semana vs Anterior
              <Tooltip content="Comparación del tiempo total de ruta por día entre esta semana y la anterior, usando los mismos días para un análisis justo." />
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
              <Tooltip content="Mide qué tan cerca estuvo cada día de tu mejor tiempo registrado. Un porcentaje alto indica mejor rendimiento." />
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
                <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-green-500"></span> 
                    ≥85% Eficiente
                    <Tooltip content="Excelente rendimiento. El chofer completó sus rutas en tiempo récord." />
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-yellow-500"></span> 
                    70-85% Aceptable
                    <Tooltip content="Rendimiento normal, dentro de los parámetros esperados." />
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500"></span> 
                    &lt;70% Ineficiente
                    <Tooltip content="Rendimiento bajo. Las rutas tomaron más tiempo de lo esperado." />
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-slate-500"></span> 
                    Sin historial
                    <Tooltip content="No hay datos suficientes para calcular la eficiencia de este día." />
                  </span>
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
            <Tooltip content="Evaluación del desempeño del chofer basada en eficiencia, tiempo de ruta y número de visitas realizadas." />
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
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Eficiencia
                        <Tooltip content="Mide qué tan cerca estuvo cada día de tu mejor tiempo registrado. Un porcentaje alto indica mejor rendimiento." />
                      </span>
                    </th>
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Visitas
                        <Tooltip content="Total de paradas realizadas en todo el periodo. Incluye todas las visitas, incluso si se repite el mismo local." />
                      </span>
                    </th>
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Visitas Extra
                        <Tooltip content="Número de paradas adicionales generadas por regresos o incidencias en ruta." />
                      </span>
                    </th>
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Kilometraje
                        <Tooltip content="Total de kilómetros recorridos calculados por la diferencia entre odómetro inicial y final de cada ruta." />
                      </span>
                    </th>
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Asistencia
                        <Tooltip content="Días con rutas registradas / Total días laborables (sin contar días de descanso) desde tu fecha de ingreso." />
                      </span>
                    </th>
                    <th className="text-center py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-center">
                        Rutas
                        <Tooltip content="Cantidad de rutas completadas correctamente sobre el total registrado. Garantiza que los datos sean completos y confiables." />
                      </span>
                    </th>
                    <th className="text-right py-2 px-3">
                      <span className="inline-flex items-center gap-1 justify-end">
                        T. Promedio
                        <Tooltip content="Total acumulado de horas trabajadas desde el inicio del registro. No es una comparación, solo un resumen general." />
                      </span>
                    </th>
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
                          <span className="text-white text-xs font-bold">{c.kmTotal.toFixed(1)} km</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-bold ${c.asistenciaStats?.falta > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                              {c.diasTrabajados}/{c.diasEsperados}
                            </span>
                            <span className="text-[10px] text-text-muted capitalize">
                              {c.diasDescanso.length > 0 ? c.diasDescanso.map(d => ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][parseInt(d)] || d).join(', ') : 'Sin descanso'}
                            </span>
                          </div>
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
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500"></span> ≥85% Eficiente
              <Tooltip content="Excelente rendimiento. El chofer completó sus rutas en tiempo récord." />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500"></span> 70–85% Aceptable
              <Tooltip content="Rendimiento normal, dentro de los parámetros esperados." />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> &lt;70% Ineficiente
              <Tooltip content="Rendimiento bajo. Las rutas tomaron más tiempo de lo esperado." />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-500"></span> N/D = Sin historial
              <Tooltip content="No hay suficientes datos históricos para calcular la eficiencia." />
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <RefreshCw size={10} className="text-red-400" /> Visitas Extra = regresos
              <Tooltip content="Número de paradas adicionales generadas por regresos o incidencias en ruta." />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Gestión de Asistencia Manual */}
      <Card className="bg-surface border border-surface-light mt-8">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="text-orange-400" size={20} />
                Gestión de Asistencia Manual
                <Tooltip content="Registro manual de inasistencias, permisos médicos o días trabajados extra. Estas prevalecen sobre el cálculo automático." />
              </h2>
            </div>
            <Button onClick={() => {
              setNuevaAsistencia({ estado: 'falta', fecha: format(new Date(), 'yyyy-MM-dd') });
              setShowAsistenciaModal(true);
            }} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-lg flex items-center shadow-orange-500/20 text-xs">
              <Plus size={14} className="mr-1" /> Registrar Asistencia Manual
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-light">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-light/50 text-text-muted text-[10px] uppercase font-bold tracking-wider">
                  <th className="p-3">Chofer</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Observaciones</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {asistencia.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted">
                      No hay registros manuales en este periodo.
                    </td>
                  </tr>
                ) : (
                  asistencia.map((f: any) => (
                    <tr key={f.id} className="hover:bg-surface-light/10 transition-colors">
                      <td className="p-3 border-t border-surface-light">
                        <span className="font-bold text-white">{f.usuario_nombre || 'Desconocido'}</span>
                      </td>
                      <td className="p-3 border-t border-surface-light text-text-muted">
                        {formatFriendlyDate(f.fecha)}
                      </td>
                      <td className="p-3 border-t border-surface-light">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          f.estado === 'falta' ? 'bg-red-500/20 text-red-400' :
                          f.estado === 'trabajo' ? 'bg-green-500/20 text-green-400' :
                          f.estado === 'descanso' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {f.estado || 'falta'}
                        </span>
                      </td>
                      <td className="p-3 border-t border-surface-light text-text-muted text-xs truncate max-w-xs">
                        {f.observaciones || '-'}
                      </td>
                      <td className="p-3 border-t border-surface-light text-right">
                        <button onClick={() => handleDeleteAsistencia(f.id)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Registrar Asistencia Manual */}
      {showAsistenciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-surface-light rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-light flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">
                Registrar Asistencia Manual
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Chofer</label>
                <select 
                  className="w-full bg-surface-light/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                  value={nuevaAsistencia.id_chofer || ''}
                  onChange={e => setNuevaAsistencia({...nuevaAsistencia, id_chofer: e.target.value})}
                >
                  <option value="">Seleccione chofer...</option>
                  {choferes.map(c => (
                    <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Fecha</label>
                  <input 
                    type="date"
                    className="w-full bg-surface-light/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    value={nuevaAsistencia.fecha}
                    onChange={e => setNuevaAsistencia({...nuevaAsistencia, fecha: e.target.value})}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Estado</label>
                  <select 
                    className="w-full bg-surface-light/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                    value={nuevaAsistencia.estado}
                    onChange={e => setNuevaAsistencia({...nuevaAsistencia, estado: e.target.value as any})}
                  >
                    <option value="falta">Falta</option>
                    <option value="permiso">Permiso</option>
                    <option value="trabajo">Trabajo Extra</option>
                    <option value="descanso">Descanso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Observaciones</label>
                <textarea 
                  className="w-full bg-surface-light/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
                  placeholder="Ej. Descanso médico certificado, cambió de turno, etc."
                  value={nuevaAsistencia.observaciones || ''}
                  onChange={e => setNuevaAsistencia({...nuevaAsistencia, observaciones: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1 py-3" onClick={() => setShowAsistenciaModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 py-3" onClick={handleSaveAsistencia}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-text-muted">Loading analytics...</div>
        </div>
      )}
    </div>
  );
}