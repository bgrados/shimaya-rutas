import { parseISO } from 'date-fns';
import type { Usuario, AsistenciaChofer, Ruta } from '../types';

export interface AsistenciaMensualResult {
  porcentaje: number;
  trabajados: number;
  descansos: number;
  faltas: number;
  programados: number;
  diasMes: number;
  inicio: string;
  fin: string;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPrimerDiaMes(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function getUltimoDiaMes(year: number, month: number): Date {
  return new Date(year, month, 0);
}

function esDiaDescanso(date: Date, diaDescanso: number): boolean {
  return date.getDay() === diaDescanso;
}

function normalizarFecha(fecha: string | Date): string {
  if (!fecha) return '';
  if (typeof fecha === 'string') {
    return fecha.split('T')[0];
  }
  return toLocalDateString(fecha);
}

export function calcularAsistenciaMensual({
  chofer,
  year,
  month,
  rutasDelMes,
  asistenciaManual
}: {
  chofer: Usuario;
  year: number;
  month: number;
  rutasDelMes: Ruta[];
  asistenciaManual: AsistenciaChofer[];
}): AsistenciaMensualResult {
  const diaDescanso = chofer.dia_descanso ?? 0;
  const fechaIngreso = chofer.fecha_ingreso 
    ? normalizarFecha(chofer.fecha_ingreso) 
    : null;
  
  const primerDia = getPrimerDiaMes(year, month);
  const ultimoDia = getUltimoDiaMes(year, month);
  const hoy = new Date();
  const fechaFinReal = hoy > ultimoDia ? ultimoDia : hoy;
  
  const inicioStr = toLocalDateString(primerDia);
  const finStr = toLocalDateString(fechaFinReal);
  
  const inicioCalculado = fechaIngreso && fechaIngreso > inicioStr ? fechaIngreso : inicioStr;
  const finCalculado = finStr;
  
  const inicioDate = parseISO(inicioCalculado);
  const finDate = parseISO(finCalculado);
  
  const fechasRutas = new Set(
    rutasDelMes
      .filter(r => r.id_chofer === chofer.id_usuario && r.fecha)
      .map(r => normalizarFecha(r.fecha!))
  );
  
  const asistenciaMap = new Map<string, AsistenciaChofer>(
    asistenciaManual
      .filter(a => a.id_chofer === chofer.id_usuario)
      .map(a => [normalizarFecha(a.fecha), a])
  );
  
  let trabajados = 0;
  let descansos = 0;
  let faltas = 0;
  
  const current = new Date(inicioDate);
  while (current <= finDate) {
    const fechaActual = toLocalDateString(current);
    
    const registroManual = asistenciaMap.get(fechaActual);
    
    if (registroManual) {
      if (registroManual.estado === 'trabajo') {
        trabajados++;
      } else if (registroManual.estado === 'descanso') {
        descansos++;
      }
    } else {
      if (esDiaDescanso(current, diaDescanso)) {
        if (fechasRutas.has(fechaActual)) {
          trabajados++;
        } else {
          descansos++;
        }
      } else {
        if (fechasRutas.has(fechaActual)) {
          trabajados++;
        } else {
          faltas++;
        }
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  const programados = trabajados + faltas;
  const porcentaje = programados > 0 
    ? Math.round((trabajados / programados) * 100) 
    : 0;
  
  return {
    porcentaje,
    trabajados,
    descansos,
    faltas,
    programados,
    diasMes: programados + descansos,
    inicio: inicioCalculado,
    fin: finCalculado
  };
}

export function formatDiaDescanso(dia: number): string {
  return DIAS_SEMANA[dia] || 'domingo';
}