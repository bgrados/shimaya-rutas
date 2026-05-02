import type { Usuario, Ruta } from '../types';
import { format, parseISO } from 'date-fns';
import { nowPeru, formatOnlyDatePeru } from './timezone';

export interface AsistenciaResult {
  porcentaje: number;
  trabajados: number;
  descansos: number;
  faltan: number;
  programados: number;
  diasMes: number;
  inicio: string;
  fin: string;
}

const DIAS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MAP_DIAS_ES: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6,
  'dom': 0, 'lun': 1, 'mar': 2, 'mie': 3, 'jue': 4, 'vie': 5, 'sab': 6,
  'miércoles': 3, 'sábado': 6
};

function normalizeDay(d: string): string {
  return d.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace('é', 'e') // just in case
    .replace('á', 'a');
}

export function calcularAsistencia(chofer: Usuario, rutas: Ruta[], fin?: string, asistenciaManual: any[] = []): AsistenciaResult {
  const ingreso = chofer?.fecha_ingreso;
  
  const diasDescansoStr = chofer.dias_descanso || [];
  const diaDescNumRaw = chofer.dia_descanso;
  const diaDescNum = typeof diaDescNumRaw === 'string' ? parseInt(diaDescNumRaw) : (typeof diaDescNumRaw === 'number' ? diaDescNumRaw : -1);
  
  const setDiasDescanso = new Set<number>();
  if (diaDescNum >= 0) setDiasDescanso.add(diaDescNum);
  diasDescansoStr.forEach(d => {
    const n = MAP_DIAS_ES[normalizeDay(d)];
    if (n !== undefined) setDiasDescanso.add(n);
  });

  let inicio = ingreso ? String(ingreso).split('T')[0] : null;
  if (!inicio) {
    const misRutas = (rutas || []).filter(r => r.id_chofer === chofer.id_usuario);
    if (misRutas.length > 0) {
      inicio = String(misRutas[0].fecha).split('T')[0];
    }
  }
  
  if (!inicio) return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  
  const hoyPeru = formatOnlyDatePeru();
  const fechaFin = fin || hoyPeru;
  const fIni = parseISO(inicio);
  const fFin = parseISO(fechaFin);
  
  if (fIni > fFin) return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio, fin: inicio };
  
  const diasConRuta = new Set<string>();
  (rutas || []).forEach(r => {
    if (r.id_chofer === chofer.id_usuario && r.fecha) {
      const f = String(r.fecha).split('T')[0];
      if (f >= inicio && f <= fechaFin) {
        diasConRuta.add(f);
      }
    }
  });

  const mapManual = new Map<string, string>();
  (asistenciaManual || []).forEach(a => {
    if (a.id_chofer === chofer.id_usuario && a.fecha) {
      mapManual.set(String(a.fecha).split('T')[0], a.estado);
    }
  });
  
  let totalDiasParaProgramados = 0;
  let trabajados = 0;
  let descansos = 0;

  const it = new Date(fIni);
  while (it <= fFin) {
    const fStr = format(it, 'yyyy-MM-dd');
    const esDiaDescanso = setDiasDescanso.has(it.getDay());
    const hayRuta = diasConRuta.has(fStr);
    const estadoManual = mapManual.get(fStr);
    const esHoy = fStr === hoyPeru;

    // Prioridad: Manual > Ruta > Dia Descanso
    if (estadoManual) {
      if (estadoManual === 'asistencia' || estadoManual === 'presente' || estadoManual === 'trabajo') {
        trabajados++;
        if (!esDiaDescanso) totalDiasParaProgramados++;
      } else if (estadoManual === 'descanso') {
        descansos++;
      } else if (estadoManual === 'falta') {
        if (!esDiaDescanso) totalDiasParaProgramados++;
      } else if (estadoManual === 'permiso') {
        // Los permisos no cuentan como falta ni como trabajado habitualmente
      }
    } else if (esDiaDescanso) {
      if (hayRuta) {
        trabajados++;
        // Si trabaja en descanso, sumamos el día trabajado pero no el programado? 
        // Para que el % suba.
      } else {
        descansos++;
      }
    } else {
      // Día laborable sin registro manual
      if (esHoy && !hayRuta) {
        // No hacer nada (evitar falta falsa)
      } else {
        totalDiasParaProgramados++;
        if (hayRuta) {
          trabajados++;
        }
      }
    }
    
    it.setDate(it.getDate() + 1);
  }
  
  const programados = totalDiasParaProgramados; 
  const faltantes = Math.max(0, programados - trabajados);
  const pct = programados > 0 ? Math.round((trabajados / programados) * 100) : (trabajados > 0 ? 100 : 0);
  
  return {
    porcentaje: Math.min(100, pct),
    trabajados,
    descansos,
    faltan: faltantes,
    programados,
    diasMes: Math.floor((fFin.getTime() - fIni.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    inicio,
    fin: fechaFin
  };
}

export function calcularAsistenciaMensual(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin, params.asistenciaManual);
}

export const getDiaDescansoLabel = (chofer: any): string => {
  const dias = chofer?.dias_descanso || [];
  if (Array.isArray(dias) && dias.length > 0) {
    return dias.map((d: string) => {
      if (!d) return '';
      return d.charAt(0).toUpperCase() + d.slice(1);
    }).filter(Boolean).join(', ');
  }
  const diaNumRaw = chofer?.dia_descanso;
  const diaNum = typeof diaNumRaw === 'string' ? parseInt(diaNumRaw) : (typeof diaNumRaw === 'number' ? diaNumRaw : -1);
  if (diaNum >= 0 && diaNum < DIAS_LABELS.length) return DIAS_LABELS[diaNum];
  return 'No asignado';
};