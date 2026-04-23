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

export function calcularAsistenciaMensual({
  chofer,
  year,
  month,
  rutasDelMes,
  asistenciaManual = []
}: {
  chofer: Usuario;
  year: number;
  month: number;
  rutasDelMes: Ruta[];
  asistenciaManual?: AsistenciaChofer[];
}): AsistenciaMensualResult {
  // VALIDACIÓN
  if (!chofer?.fecha_ingreso) {
    return {
      porcentaje: 0,
      trabajados: 0,
      descansos: 0,
      faltan: 0,
      programados: 0,
      diasMes: 0,
      inicio: '',
      fin: ''
    };
  }

  // FECHAS SEGURAS (SIN TIMEZONE) - usar formato YYYY-MM-DD
  const inicioStr = String(chofer.fecha_ingreso).split('T')[0];
  const inicio = new Date(inicioStr + 'T00:00:00');

  const hoy = new Date();
  const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth() + 1;
  
  let fin: Date;
  if (esMesActual) {
    fin = new Date(hoy.toISOString().slice(0, 10) + 'T00:00:00');
  } else {
    fin = new Date(year, month - 1, 0);
    fin = new Date(fin.toISOString().slice(0, 10) + 'T00:00:00');
  }

  let trabajados = 0;
  let descansos = 0;
  let totalDias = 0;

  // FILTRAR RUTAS SOLO DE ESTE CHOFER
  const rutasChofer = (rutasDelMes || []).filter(
    r => r.id_chofer === chofer.id_usuario && r.fecha
  );

  // SET DE DIAS TRABAJADOS - extraer solo la fecha YYYY-MM-DD
  const diasTrabajadosSet = new Set<string>();
  rutasChofer.forEach(r => {
    if (r.fecha) {
      const f = String(r.fecha).split('T')[0];
      diasTrabajadosSet.add(f);
    }
  });

  let fecha = new Date(inicio);
  while (fecha <= fin) {
    totalDias++;

    const fechaStr = fecha.toISOString().slice(0, 10);
    const dia = fecha.getDay();
    const diaDescanso = chofer.dia_descanso ?? 0;

    // DESCANSO - día de la semana coincides con dia_descanso
    if (dia === diaDescanso) {
      descansos++;
    } else {
      // TRABAJO o FALTA
      if (diasTrabajadosSet.has(fechaStr)) {
        trabajados++;
      }
    }

    fecha.setDate(fecha.getDate() + 1);
  }

  const programados = totalDias - descansos;

  let faltan = programados - trabajados;
  
  // EVITAR NaN y valores negativos
  if (isNaN(faltas)) faltan = 0;
  if (faltas < 0) faltan = 0;

  const porcentaje = programados > 0
    ? Math.round((trabajados / programados) * 100)
    : 0;

  return {
    porcentaje,
    trabajados,
    descansos,
    faltan,
    programados,
    diasMes: totalDias,
    inicio: inicioStr,
    fin: fin.toISOString().slice(0, 10)
  };
}