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

function toLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  
  // ✅ CREAR FECHAS COMO DATE OBJECTS SIN UTC
  const primerDia = new Date(year, month - 1, 1, 0, 0, 0);
  const ultimoDia = new Date(year, month, 0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  let inicioDate = new Date(primerDia);
  let finDate = new Date(hoy > ultimoDia ? ultimoDia : hoy);
  
  // ✅ AJUSTAR DESDE FECHA DE INGRESO
  if (chofer.fecha_ingreso) {
    const fechaIngreso = new Date(chofer.fecha_ingreso);
    if (fechaIngreso >= primerDia && fechaIngreso <= finDate) {
      inicioDate = new Date(fechaIngreso);
    }
  }
  
  const inicioCalculado = toLocalDateStr(inicioDate);
  const finCalculado = toLocalDateStr(finDate);
  
  const rutasFiltradas = rutasDelMes.filter(r => r.id_chofer === chofer.id_usuario && r.fecha);
  const rutasSet = new Set(rutasFiltradas.map(r => {
    const d = new Date(r.fecha);
    return toLocalDateStr(d);
  }));
  
  const asistenciaMap = new Map<string, AsistenciaChofer>();
  asistenciaManual
    .filter(a => a.id_chofer === chofer.id_usuario)
    .forEach(a => {
      const d = new Date(a.fecha);
      asistenciaMap.set(toLocalDateStr(d), a);
    });
  
  let trabajados = 0;
  let descansos = 0;
  let faltan = 0;
  
  // ✅ ITERAR CON DATE OBJECTS LOCALES
  const current = new Date(inicioDate);
  current.setHours(0, 0, 0, 0);
  
  while (current <= finDate) {
    const fechaStr = toLocalDateStr(current);
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