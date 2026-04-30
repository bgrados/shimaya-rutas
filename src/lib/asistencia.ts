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

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function calcularAsistencia(chofer: Usuario, rutas: Ruta[], fin?: string): AsistenciaResult {
  const ingreso = chofer?.fecha_ingreso;
  const diaDesc = chofer.dia_descanso ?? -1;
  
  console.log(`[ASISTENCIA DEBUG] chofer=${chofer?.nombre}, ingreso=${ingreso}, diaDesc=${diaDesc}`);
  
  let inicio = ingreso ? String(ingreso).split('T')[0] : null;
  if (!inicio) {
    const misRutas = (rutas || []).filter(r => r.id_chofer === chofer.id_usuario);
    if (misRutas.length > 0) {
      inicio = String(misRutas[0].fecha).split('T')[0];
    }
  }
  
  if (!inicio) return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  
  const fechaFin = fin || formatOnlyDatePeru();
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
  
let totalDias = 0;
let descansos = 0;
let trabajados = 0;
let totalRestDays = 0;
  const it = parseISO(inicio);
  
  while (it <= fFin) {
    const fStr = format(it, 'yyyy-MM-dd');
    const esDiaDescanso = diaDesc >= 0 && it.getDay() === diaDesc;
    const hayRuta = diasConRuta.has(fStr);
    
    totalDias++;
    
    if (esDiaDescanso) {
      totalRestDays++;
      if (hayRuta) {
        trabajados++; // Trabajó en su día de descanso
      } else {
        descansos++; // Descansó
      }
    } else {
      if (hayRuta) {
        trabajados++; // Trabajó en día laborable
      } else {
        // Falta - no cuenta aquí, se calcula después
      }
    }
    
    it.setDate(it.getDate() + 1);
  }
  
  const programados = totalDias - totalRestDays; /* Días esperados (laborables, excluye todos los días de descanso) */
  const faltantes = programados - trabajados;
  const pct = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  console.log(`[ASISTENCIA] ${chofer.nombre}: inicio=${inicio}, fin=${fechaFin}, diaDesc=${diaDesc}`);
  console.log(`     totalDias=${totalDias}, descansos=${descansos}, programados=${programados}, trabajados=${trabajados}, faltantes=${faltantes}`);
  console.log(`     FECHAS RUTAS: ${Array.from(diasConRuta).sort().join(', ')}`);
  
  return {
    porcentaje: pct,
    trabajados,
    descansos,
    faltan: Math.max(0, faltantes),
    programados,
    diasMes: totalDias,
    inicio,
    fin: fechaFin
  };
}

export function calcularAsistenciaMensual(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin);
}

export const getDiaDescansoLabel = (dia: number | undefined): string => DIAS[dia ?? 0] || 'Domingo';