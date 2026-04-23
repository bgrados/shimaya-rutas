import { parseISO } from 'date-fns';
import type { Usuario, AsistenciaChofer, Ruta } from '../types';

export interface AsistenciaMensualResult {
  porcentaje: number;
  trabajados: number;
  descansos: number;
  faltan: number;
  programados: number;
  diasMes: number;
  inicio: string;
  fin: string;
}

function toLocalDate(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPrimerDiaMes(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function getUltimoDiaMes(year: number, month: number): Date {
  return new Date(year, month, 0);
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
  
  const primerDia = getPrimerDiaMes(year, month);
  const ultimoDia = getUltimoDiaMes(year, month);
  const hoy = new Date();
  const fechaFinReal = hoy > ultimoDia ? ultimoDia : hoy;
  
  const inicioStr = toLocalDate(primerDia);
  const finStr = toLocalDate(fechaFinReal);
  
  let inicioCalculado = inicioStr;
  if (chofer.fecha_ingreso) {
    const fechaIngreso = toLocalDate(chofer.fecha_ingreso);
    if (fechaIngreso && fechaIngreso > inicioStr) {
      inicioCalculado = fechaIngreso;
    }
  }
  const finCalculado = finStr;
  
  const inicioDate = parseISO(inicioCalculado);
  const finDate = parseISO(finCalculado);
  
  const rutasFiltradas = rutasDelMes.filter(r => r.id_chofer === chofer.id_usuario && r.fecha);
  const rutasSet = new Set(rutasFiltradas.map(r => toLocalDate(r.fecha)));
  
  const asistenciaMap = new Map<string, AsistenciaChofer>();
  asistenciaManual
    .filter(a => a.id_chofer === chofer.id_usuario)
    .forEach(a => asistenciaMap.set(toLocalDate(a.fecha), a));
  
  let trabajados = 0;
  let descansos = 0;
  let faltan = 0;
  
  const current = new Date(inicioDate);
  while (current <= finDate) {
    const fechaStr = toLocalDate(current);
    const dayOfWeek = current.getDay();
    const esDescanso = dayOfWeek === diaDescanso;
    const tieneRuta = rutasSet.has(fechaStr);
    const registro = asistenciaMap.get(fechaStr);
    
    if (registro) {
      if (registro.estado === 'trabajo') trabajados++;
      else if (registro.estado === 'descanso') descansos++;
    } else {
      if (esDescanso) {
        if (tieneRuta) trabajados++;
        else descansos++;
      } else {
        if (tieneRuta) trabajados++;
        else faltan++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  const programados = trabajados + faltan;
  const porcentaje = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  return {
    porcentaje,
    trabajados,
    descansos,
    faltan,
    programados,
    diasMes: programados + descansos,
    inicio: inicioCalculado,
    fin: finCalculado
  };
}