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
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6
};

export function calcularAsistencia(chofer: Usuario, rutas: Ruta[], fin?: string): AsistenciaResult {
  const ingreso = chofer?.fecha_ingreso;
  
  // Soporte para múltiples días de descanso (array de strings) o uno solo (número)
  const diasDescansoStr = chofer.dias_descanso || [];
  const diaDescNum = chofer.dia_descanso ?? -1;
  
  const setDiasDescanso = new Set<number>();
  if (diaDescNum >= 0) setDiasDescanso.add(diaDescNum);
  diasDescansoStr.forEach(d => {
    const n = MAP_DIAS_ES[d.toLowerCase()];
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
  
  let totalDiasParaProgramados = 0;
  let trabajados = 0;
  let descansos = 0;

  const it = parseISO(inicio);
  while (it <= fFin) {
    const fStr = format(it, 'yyyy-MM-dd');
    const esDiaDescanso = setDiasDescanso.has(it.getDay());
    const hayRuta = diasConRuta.has(fStr);
    const esHoy = fStr === hoyPeru;

    if (esDiaDescanso) {
      if (hayRuta) {
        trabajados++; // Trabajó en su día de descanso
      } else {
        descansos++; // Descansó
      }
    } else {
      // Día laborable
      if (esHoy && !hayRuta) {
        // No hacer nada todavía (evitar falta falsa)
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
  const faltantes = programados - trabajados;
  const pct = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  return {
    porcentaje: Math.min(100, pct),
    trabajados,
    descansos,
    faltan: Math.max(0, faltantes),
    programados,
    diasMes: Math.floor((fFin.getTime() - fIni.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    inicio,
    fin: fechaFin
  };
}

export function calcularAsistenciaMensual(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin);
}

export const getDiaDescansoLabel = (chofer: any): string => {
  const dias = chofer?.dias_descanso || [];
  if (dias.length > 0) {
    return dias.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  }
  const diaNum = chofer?.dia_descanso;
  if (diaNum !== undefined && diaNum >= 0) return DIAS_LABELS[diaNum];
  return 'No asignado';
};