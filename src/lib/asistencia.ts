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

  const now = new Date();
  const finStr = fechaFin || now.toISOString().split('T')[0];
  
  const inicio = new Date(inicioStr + 'T00:00:00');
  const fin = new Date(finStr + 'T00:00:00');

  if (inicio > fin) {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: inicioStr, fin: inicioStr };
  }

  console.log(`>>>> ASISTENCIA START: ${chofer.nombre}, fechaIngreso=${fechaIngreso}, inicio=${inicioStr}, fin=${finStr}, dia_descanso=${chofer.dia_descanso}`);
  
  const diasConRutas = new Set<string>();
  (rutasDelMes || []).forEach(r => {
    const rutaFecha = String(r.fecha).split('T')[0].split(' ')[0];
    const match = r.id_chofer === chofer.id_usuario && r.fecha;
    if (match) {
      diasConRutas.add(rutaFecha);
    }
  });
  
  console.log(`     RUTAS: ${Array.from(diasConRutas).join(', ')}`);
  
  let totalDias = 0;
  let diasDescanso = 0;
  let trabajadosEnDescanso = 0;
  let descansosReales = 0;
  
  //dia_descanso: -1 = sin descanso, 0=domingo, 1=lunes, 2=martes, etc.
  const diaDescanso = chofer.dia_descanso != null ? chofer.dia_descanso : -1;
  
  console.log(`     diaDescanso (calculado): ${diaDescanso}`);
  
  const iter = new Date(inicioStr + 'T00:00:00');
  while (iter <= fin) {
    totalDias++;
    const fechaStr = format(iter, 'yyyy-MM-dd');
    const esDiaDescanso = diaDescanso >= 0 && iter.getDay() === diaDescanso;
    const hayRuta = diasConRutas.has(fechaStr);
    
    if (esDiaDescanso) {
      if (hayRuta) {
        trabajadosEnDescanso++;
        console.log(`     ${fechaStr} [${DIAS_SEMANA[iter.getDay()]}] = TRABAJÓ (descanso)`);
      } else {
        descansosReales++;
        diasDescanso++;
        console.log(`     ${fechaStr} [${DIAS_SEMANA[iter.getDay()]}] = DESCANSO REAL`);
      }
    }
    
    iter.setDate(iter.getDate() + 1);
  }
  
  console.log(`[RESULTADO] ${chofer.nombre}: trabajados=${diasConRutas.size}, diasDescanso=${diasDescanso}, trabajadosEnDescanso=${trabajadosEnDescanso}, descansosReales=${descansosReales}`);

  const trabajados = diasConRutas.size;
  const programados = totalDias - diasDescanso;
  const descansos = diasDescanso;
  const faltan = Math.max(0, programados - trabajados);
  const porcentaje = programados > 0 ? Math.min(100, Math.round((trabajados / programados) * 100)) : 0;

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