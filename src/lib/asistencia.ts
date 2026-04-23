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

// Función segura para crear fecha
function safeNewDate(fecha: string | Date): Date {
  const f = String(fecha).split('T')[0];
  return new Date(f + 'T00:00:00');
}

// Función para convertir fecha a string YYYY-MM-DD
function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  // Inicializar variables
  let trabajados = 0;
  let descansos = 0;
  let faltan = 0;
  
  // Definir rango de fechas
  const fechaInicio = chofer && chofer.fecha_ingreso 
    ? safeNewDate(chofer.fecha_ingreso) 
    : new Date(year, month - 1, 1);
  const fechaFin = new Date();
  
  // Asegurar que fechaFin no sea mayor que hoy
  const hoy = new Date();
  if (fechaFin > hoy) {
    fechaFin.setTime(hoy.getTime());
  }
  
  const diaDescanso = chofer?.dia_descanso ?? 0;
  
  // Crear Set de rutas
  const rutasSet = new Set<string>();
  rutasDelMes.forEach(r => {
    if (r.id_chofer === chofer.id_usuario && r.fecha) {
      rutasSet.add(toYYYYMMDD(safeNewDate(r.fecha)));
    }
  });
  
  // Crear Map de asistencia manual
  const asistenciaMap = new Map<string, any>();
  asistenciaManual.forEach(a => {
    if (a.id_chofer === chofer.id_usuario && a.fecha) {
      asistenciaMap.set(toYYYYMMDD(safeNewDate(a.fecha)), a);
    }
  });
  
  // Iterar día por día
  const current = new Date(fechaInicio);
  while (current <= fechaFin) {
    const fechaStr = toYYYYMMDD(current);
    const diaSemana = current.getDay();
    const esDescanso = diaSemana === diaDescanso;
    const tieneRuta = rutasSet.has(fechaStr);
    const registro = asistenciaMap.get(fechaStr);
    
    if (registro) {
      if (registro.estado === 'trabajo') {
        trabajados++;
      } else if (registro.estado === 'descanso') {
        descansos++;
      } else if (registro.estado === 'falta') {
        faltan++;
      }
    } else {
      if (esDescanso) {
        if (tieneRuta) {
          trabajados++; // Trabajó en día de descanso
        } else {
          descansos++; // Día de descanso normal
        }
      } else {
        if (tieneRuta) {
          trabajados++;
        } else {
          faltan++;
        }
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  const programados = trabajados + faltan;
  const porcentaje = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  const inicioStr = toYYYYMMDD(fechaInicio);
  const finStr = toYYYYMMDD(fechaFin);
  
  console.log('=== ASISTENCIA ===');
  console.log('Chofer:', chofer?.nombre);
  console.log('Rango:', inicioStr, 'a', finStr);
  console.log('Dia descanso:', diaDescanso);
  console.log('Trabajados:', trabajados);
  console.log('Descansos:', descansos);
  console.log('Faltas:', faltan);
  console.log('Programados:', programados);
  console.log('Asistencia:', porcentaje + '%');
  console.log('===================');
  
  return {
    porcentaje,
    trabajados,
    descansos,
    faltan,
    programados,
    diasMes: programados + descansos,
    inicio: inicioStr,
    fin: finStr
  };
}