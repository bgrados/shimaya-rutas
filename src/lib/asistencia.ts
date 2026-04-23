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
  
  const primerDia = new Date(year, month - 1, 1);
  const ultimoDia = new Date(year, month, 0);
  const hoy = new Date();
  
  // ✅ USAR FECHA DE HOY como fin, NO el último día del mes
  const fechaFin = hoy;
  
  const inicioStr = toLocalDate(primerDia);
  const finStr = toLocalDate(fechaFin);
  
  // ✅ DEFINIR INICIO DESDE FECHA DE INGRESO Si está en el mes
  let inicioCalculado = inicioStr;
  if (chofer.fecha_ingreso) {
    const fechaIngreso = toLocalDate(chofer.fecha_ingreso);
    // Si дата de ingreso está dentro del mes, usarla
    if (fechaIngreso >= inicioStr && fechaIngreso <= finStr) {
      inicioCalculado = fechaIngreso;
    }
  }
  const finCalculado = finStr;
  
  const inicioDate = new Date(inicioCalculado);
  const finDate = new Date(finCalculado);
  
  // ✅ NORMALIZAR RUTAS
  const rutasFiltradas = rutasDelMes.filter(r => r.id_chofer === chofer.id_usuario && r.fecha);
  const rutasSet = new Set(rutasFiltradas.map(r => toLocalDate(r.fecha)));
  
  // ✅ NORMALIZAR ASISTENCIA
  const asistenciaMap = new Map<string, AsistenciaChofer>();
  asistenciaManual
    .filter(a => a.id_chofer === chofer.id_usuario)
    .forEach(a => asistenciaMap.set(toLocalDate(a.fecha), a));
  
  let trabajados = 0;
  let descansos = 0;
  let faltan = 0;
  
  // ✅ ITERAR DÍA POR DÍA correctamente
  const current = new Date(inicioDate);
  while (current <= finDate) {
    const fechaStr = toLocalDate(current);
    const dayOfWeek = current.getDay();
    
    // ✅ getDay(): 0=domingo, 1=lunes, 2=martes, etc.
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