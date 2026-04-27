import type { Usuario, Ruta } from '../types';
import { format } from 'date-fns';

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

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const getDiaDescansoLabel = (dia: number | undefined): string => {
  return DIAS_SEMANA[dia ?? 0] || 'Domingo';
};

export function calcularAsistenciaMensual({
  chofer,
  rutasDelMes,
  fechaInicio,
  fechaFin,
}: {
  chofer: Usuario;
  year?: number;
  month?: number;
  rutasDelMes: Ruta[];
  fechaInicio?: string;
  fechaFin?: string;
}): AsistenciaMensualResult {
  const fechaIngreso = chofer?.fecha_ingreso;
  
  // Si no tiene fecha_ingreso, usar la fecha más antigua de sus rutas
  let fechaInicioCalculada: string | null = null;
  
  if (!fechaIngreso) {
    const rutasDelChofer = (rutasDelMes || []).filter(r => r.id_chofer === chofer.id_usuario);
    if (rutasDelChofer.length > 0) {
      rutasDelChofer.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      fechaInicioCalculada = String(rutasDelChofer[0].fecha).split('T')[0];
    }
  }
  
  const inicioStr = fechaInicio 
    || fechaInicioCalculada 
    || (fechaIngreso ? String(fechaIngreso).split('T')[0].split(' ')[0] : null);
  
  if (!inicioStr) {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  }

  // Usar fechaFin proporcionada o por defecto "hoy"
  const now = new Date();
  const finStr = fechaFin || now.toISOString().split('T')[0];
  
  const inicio = new Date(inicioStr + 'T00:00:00');
  const fin = new Date(finStr + 'T00:00:00');

  if (inicio > fin) {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: inicioStr, fin: inicioStr };
  }

  const diasConRutas = new Set<string>();
  (rutasDelMes || []).forEach(r => {
    const rutaFecha = String(r.fecha).split('T')[0].split(' ')[0];
    const match = r.id_chofer === chofer.id_usuario && r.fecha;
    if (match) {
      diasConRutas.add(rutaFecha);
    }
  });

  let totalDias = 0;
  let diasDescanso = 0;
  let diasTrabajadosEnDescanso = 0;
  // Si dia_descanso es undefined o null, no hay día de descanso configurado
  const diaDescanso = chofer.dia_descanso ?? -1; // -1 indica "sin descanso"

  const iter = new Date(inicioStr + 'T00:00:00');
  while (iter <= fin) {
    totalDias++;
    const fechaStr = format(iter, 'yyyy-MM-dd');
    // Solo es día de descanso si está configurado (diaDescanso >= 0)
    const esDiaDescanso = diaDescanso >= 0 && iter.getDay() === diaDescanso;
    const hayRuta = diasConRutas.has(fechaStr);
    
    // Debug: console.log(`fecha: ${fechaStr}, esDiaDescanso: ${esDiaDescanso}, hayRuta: ${hayRuta}, diaSemana: ${iter.getDay()}`);
    
    // Si hay rutas registradas ese día, contar como trabajado
    // (prioriza actividad real sobre día de descanso)
    if (hayRuta) {
      if (esDiaDescanso) {
        diasTrabajadosEnDescanso++; // Trabajó en su día de descanso
      }
      // Ya contabilizado en trabajados (diasConRutas.size)
    } else if (esDiaDescanso) {
      // No trabajó y es día de descanso - CONTAR COMO DESCANSO
      diasDescanso++;
    }
    
    iter.setDate(iter.getDate() + 1);
  }

  const trabajados = diasConRutas.size;
  // Días programados = total días - días de descanso (donde no trabajó)
  const programados = totalDias - diasDescanso;
  // Descansos reales = días de descanso donde no trabajó
  const descansos = diasDescanso;
  const faltan = Math.max(0, programados - trabajados);
  const porcentaje = programados > 0 ? Math.min(100, Math.round((trabajados / programados) * 100)) : 0;
  
  // Debug
  console.log(`[ASISTENCIA] chofer: ${chofer.nombre}, dia_descanso: ${diaDescanso}, inicio: ${inicioStr}, fin: ${finStr}, totalDias: ${totalDias}, diasDescanso: ${diasDescanso}, trabajados: ${trabajados}, programados: ${programados}, faltan: ${faltan}`);

  return {
    porcentaje,
    trabajados,
    descansos,
    faltan: Math.max(0, faltan),
    programados,
    diasMes: totalDias,
    inicio: inicioStr,
    fin: finStr
  };
}