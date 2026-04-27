import type { Usuario, Ruta } from '../types';
import { format } from 'date-fns';

export interface AsistenciaResult {
  porcentaje: number;
  trabajados: number;
  descansos: number;
  faltan: number;
  programados: number;
  diasMes: number;
  inicio: string;
  fin: string;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function calcularAsistencia(chofer: Usuario, rutas: Ruta[], fin?: string): AsistenciaResult {
  const ingreso = chofer?.fecha_ingreso;
  const diaDesc = chofer.dia_descanso ?? -1;
  
  let inicio = ingreso ? String(ingreso).split('T')[0] : null;
  if (!inicio) {
    const misRutas = (rutas || []).filter(r => r.id_chofer === chofer.id_usuario);
    if (misRutas.length > 0) {
      inicio = String(misRutas[0].fecha).split('T')[0];
    }
  }
  
  if (!inicio) return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio: '', fin: '' };
  
  const fechaFin = fin || new Date().toISOString().split('T')[0];
  const fIni = new Date(inicio + 'T00:00:00');
  const fFin = new Date(fechaFin + 'T00:00:00');
  
  if (fIni > fFin) return { porcentaje: 0, trabajados: 0, descansos: 0, faltan: 0, programados: 0, diasMes: 0, inicio, fin: inicio };
  
  // 1. Obtener días con ruta dentro del rango
  const diasConRuta = new Set<string>();
  (rutas || []).forEach(r => {
    if (r.id_chofer === chofer.id_usuario && r.fecha) {
      const f = String(r.fecha).split('T')[0];
      if (f >= inicio && f <= fechaFin) {
        diasConRuta.add(f);
      }
    }
  });
  
  // 2. Calcular días totales, descansos y laborables
  let totalDias = 0;
  let diasDescansoReal = 0;
  let diasLaborables = 0;
  
  const it = new Date(inicio + 'T00:00:00');
  while (it <= fFin) {
    const fStr = format(it, 'yyyy-MM-dd');
    const esDiaDescanso = diaDesc >= 0 && it.getDay() === diaDesc;
    const hayRuta = diasConRuta.has(fStr);
    
    totalDias++;
    
    if (esDiaDescanso) {
      // Si es día de descanso configurado
      if (hayRuta) {
        // Trabajó en su día de descanso - NO cuenta como descanso, cuenta como trabajado extra
      } else {
        // Descansó - cuenta como descanso real
        diasDescansoReal++;
      }
    } else {
      // No es día de descanso - es día laborable
      diasLaborables++;
    }
    
    it.setDate(it.getDate() + 1);
  }
  
const trabajados = diasConRuta.size;
  const descansos = diasDescansoReal;
  
  // Días programados = total días - días de descanso reales (sin ruta)
  // Si trabajó su descanso, ese día cuenta como trabajado
  const programados = totalDias - diasDescansoReal;
  const faltantes = Math.max(0, programados - trabajados);
  const pct = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  console.log(`[ASISTENCIA] ${chofer.nombre}: inicio=${inicio}, fin=${fechaFin}, diaDesc=${diaDesc}`);
  console.log(`     totalDias=${totalDias}, diasDescanso=${diasDescansoReal}, programados=${programados}, trabajados=${trabajados}, faltantes=${faltantes}`);
  console.log(`     FECHAS RUTAS: ${Array.from(diasConRuta).sort().join(', ')}`);
  
  return {
    porcentaje: pct,
    trabajados,
    descansos,
    faltan: faltantes,
    programados,
    diasMes: totalDias,
    inicio,
    fin: fechaFin
  };
}

export function calcularAsistenciaMensual(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin);
}

export const getDiaDescansoLabel = (dia: number | undefined): string => DIAS[dia ?? 0] || 'Domingo';