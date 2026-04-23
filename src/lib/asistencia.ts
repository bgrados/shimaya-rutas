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

// 1. FUNCIÓN DE NORMALIZACIÓN (FECHA LOCAL) - NO usa toISOString()
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

function esDiaDescanso(date: Date, diaDescanso: number): boolean {
  return date.getDay() === diaDescanso;
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
  
  const diaDescanso = chofer.dia_descanso ?? 0;
  const fechaIngreso = chofer.fecha_ingreso ? toLocalDate(chofer.fecha_ingreso) : null;
  
  const primerDia = getPrimerDiaMes(year, month);
  const ultimoDia = getUltimoDiaMes(year, month);
  const hoy = new Date();
  const fechaFinReal = hoy > ultimoDia ? ultimoDia : hoy;
  
  const inicioStr = toLocalDate(primerDia);
  const finStr = toLocalDate(fechaFinReal);
  
  const inicioCalculado = fechaIngreso && fechaIngreso > inicioStr ? fechaIngreso : inicioStr;
  const finCalculado = finStr;
  
  console.log('Periodo:', inicioCalculado, 'a', finCalculado);
  
  const inicioDate = parseISO(inicioCalculado);
  const finDate = parseISO(finCalculado);
  
  // 2. NORMALIZAR TODAS LAS RUTAS
  const rutasSet = new Set(
    rutasDelMes
      .filter(r => r.id_chofer === chofer.id_usuario && r.fecha)
      .map(r => toLocalDate(r.fecha))
  );
  
  console.log('>>> RUTAS NORMALIZADAS:', Array.from(rutasSet).sort());
  console.log('>>> Total rutas encontradas:', rutasSet.size);
  
  // Normalizar asistencia manual
  const asistenciaMap = new Map<string, AsistenciaChofer>(
    asistenciaManual
      .filter(a => a.id_chofer === chofer.id_usuario)
      .map(a => [toLocalDate(a.fecha), a])
  );
  
  let trabajados = 0;
  let descansos = 0;
  let faltas = 0;
  
  console.log('--- ITERANDO DÍAS ---');
  
  const current = new Date(inicioDate);
  while (current <= finDate) {
    const fechaObj = new Date(current);
    const fechaStr = toLocalDate(fechaObj);
    const esDescanso = esDiaDescanso(fechaObj, diaDescanso);
    const tieneRuta = rutasSet.has(fechaStr);
    
    // Debug: mostrar cada día
    console.log({
      fecha: fechaStr,
      esDescanso,
      tieneRuta
    });
    
    const registroManual = asistenciaMap.get(fechaStr);
    
    // 4. PRIORIDAD DE LÓGICA
    if (registroManual) {
      if (registroManual.estado === 'trabajo') {
        trabajados++;
      } else if (registroManual.estado === 'descanso') {
        descansos++;
      }
    } else {
      if (esDescanso) {
        if (tieneRuta) {
          trabajados++; // Trabajó en su día de descanso
        } else {
          descansos++;
        }
      } else {
        if (tieneRuta) {
          trabajados++;
        } else {
          faltas++;
        }
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log('--- RESULTADO ---');
  console.log('trabajados:', trabajados);
  console.log('descansos:', descansos);
  console.log('faltas:', faltan);
  console.log('=================');
  
  const programados = trabajados + faltas;
  const porcentaje = programados > 0 
    ? Math.round((trabajados / programados) * 100) 
    : 0;
  
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

export function formatDiaDescanso(dia: number): string {
  return DIAS_SEMANA[dia] || 'domingo';
}