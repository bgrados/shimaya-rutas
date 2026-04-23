import { parseISO, differenceInDays, addDays } from 'date-fns';
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

function debugRuta(ruta: any): void {
  const original = ruta.fecha;
  const normalizada = normalizarFecha(original);
  console.log(`[DEBUG RUTA] Original: ${original} -> Normalizada: ${normalizada}, Chofer: ${ruta.id_chofer}`);
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
  console.log('=== DEBUG ASISTENCIA ===');
  console.log('Chofer:', chofer.nombre, chofer.id_usuario);
  console.log('fecha_ingreso:', chofer.fecha_ingreso);
  console.log('dia_descanso:', chofer.dia_descanso, '(', DIAS_SEMANA[chofer.dia_descanso || 0], ')');
  console.log('year:', year, 'month:', month);
  
  const diaDescanso = chofer.dia_descanso ?? 0;
  console.log('dia_descanso efectivo:', diaDescanso);
  
  const fechaIngreso = chofer.fecha_ingreso 
    ? normalizarFecha(chofer.fecha_ingreso) 
    : null;
  console.log('fecha_ingreso normalizada:', fechaIngreso);
  
  const primerDia = getPrimerDiaMes(year, month);
  const ultimoDia = getUltimoDiaMes(year, month);
  const hoy = new Date();
  const fechaFinReal = hoy > ultimoDia ? ultimoDia : hoy;
  
  const inicioStr = toLocalDateString(primerDia);
  const finStr = toLocalDateString(fechaFinReal);
  
  console.log('Periodo:', inicioStr, 'a', finStr);
  
  const inicioCalculado = fechaIngreso && fechaIngreso > inicioStr ? fechaIngreso : inicioStr;
  const finCalculado = finStr;
  
  console.log('Inicio calculado (considerando ingreso):', inicioCalculado);
  console.log('Fin calculado:', finCalculado);
  
  const inicioDate = parseISO(inicioCalculado);
  const finDate = parseISO(finCalculado);
  
  // Debug: mostrar todas las rutas del mes
  console.log('--- RUTAS DEL MES ---');
  console.log('Total rutas:', rutasDelMes.length);
  
  const rutasDelChofer = rutasDelMes.filter(r => r.id_chofer === chofer.id_usuario);
  console.log('Rutas del chofer:', rutasDelChofer.length);
  
  // Mostrar algunas rutas
  rutasDelChofer.slice(0, 5).forEach(r => {
    debugRuta(r);
  });
  
  // Crear set de fechas de rutas
  const fechasRutas = new Set<string>();
  rutasDelMes
    .filter(r => r.id_chofer === chofer.id_usuario && r.fecha)
    .forEach(r => {
      const fechaNorm = normalizarFecha(r.fecha!);
      fechasRutas.add(fechaNorm);
    });
  
  console.log('Fechas de rutas únicas:', Array.from(fechasRutas).sort());
  
  const asistenciaMap = new Map<string, AsistenciaChofer>(
    asistenciaManual
      .filter(a => a.id_chofer === chofer.id_usuario)
      .map(a => [normalizarFecha(a.fecha), a])
  );
  
  console.log('Asistencia manual:', asistenciaManual.length);
  console.log('Asistencia manual del chofer:', asistenciaMap.size);
  
  let trabajados = 0;
  let descansos = 0;
  let faltas = 0;
  
  console.log('--- ITERANDO DÍAS ---');
  const current = new Date(inicioDate);
  let diaCount = 0;
  while (current <= finDate) {
    const fechaActual = toLocalDateString(current);
    const esDescanso = esDiaDescanso(current, diaDescanso);
    const tieneRuta = fechasRutas.has(fechaActual);
    const tieneRegistro = !!asistenciaMap.get(fechaActual);
    
    // Log cada día (solo primero y si cambió estado)
    if (diaCount < 5 || tieneRuta) {
      console.log(`Día ${fechaActual} (${DIAS_SEMANA[current.getDay()]}):`, {
        esDescanso,
        tieneRuta,
        tieneRegistro,
        estadoAsistencia: asistenciaMap.get(fechaActual)?.estado
      });
    }
    
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
    diaCount++;
  }
  
  console.log('--- RESULTADO ---');
  console.log('trabajados:', trabajados);
  console.log('descansos:', descansos);
  console.log('faltas:', faltas);
  console.log('=================');
  
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