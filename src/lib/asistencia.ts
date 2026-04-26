import type { Usuario, Ruta } from '../types';

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
}: {
  chofer: Usuario;
  year?: number;
  month?: number;
  rutasDelMes: Ruta[];
}): AsistenciaMensualResult {
  const fechaIngreso = chofer?.fecha_ingreso;
  if (!fechaIngreso) {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  }

  const inicioStr = String(fechaIngreso).split('T')[0].split(' ')[0];
  if (!inicioStr || inicioStr === '') {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  }

  const now = new Date();
  const hoyStr = now.toISOString().split('T')[0];
  
  const inicio = new Date(inicioStr + 'T00:00:00');
  const fin = new Date(hoyStr + 'T00:00:00');

  if (inicio > fin) {
    return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: inicioStr, fin: inicioStr };
  }

  const diasConRutas = new Set<string>();
  (rutasDelMes || []).forEach(r => {
    const rutaFecha = String(r.fecha).split('T')[0].split(' ')[0];
    const match = r.id_chofer === chofer.id_usuario && r.fecha;
    console.log(`[DEBUG ASISTENCIA] Chofer: ${chofer.nombre}, ruta.id_chofer: ${r.id_chofer}, chofer.id_usuario: ${chofer.id_usuario}, match: ${match}, fecha: ${rutaFecha}`);
    if (match) {
      diasConRutas.add(rutaFecha);
    }
  });

  let totalDias = 0;
  let diasDescanso = 0;
  const diaDescanso = chofer.dia_descanso ?? 0;

  const iter = new Date(inicioStr + 'T00:00:00');
  while (iter <= fin) {
    totalDias++;
    if (iter.getDay() === diaDescanso) {
      diasDescanso++;
    }
    iter.setDate(iter.getDate() + 1);
  }

  const trabajados = diasConRutas.size;
  const programados = totalDias - diasDescanso;
  const descansos = diasDescanso;
  const faltan = programados - trabajados;
  const porcentaje = programados > 0 ? Math.min(100, Math.round((trabajados / programados) * 100)) : 0;

  return {
    porcentaje,
    trabajados,
    descansos,
    faltan: Math.max(0, faltan),
    programados,
    diasMes: totalDias,
    inicio: inicioStr,
    fin: hoyStr
  };
}