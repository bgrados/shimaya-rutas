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
  
  const diasConRuta = new Set<string>();
  (rutas || []).forEach(r => {
    if (r.id_chofer === chofer.id_usuario && r.fecha) {
      diasConRuta.add(String(r.fecha).split('T')[0]);
    }
  });
  
  let total = 0, descan = 0, trabajEnDes = 0, realDes = 0;
  
  const it = new Date(inicio + 'T00:00:00');
  while (it <= fFin) {
    total++;
    const fStr = format(it, 'yyyy-MM-dd');
    const esDes = diaDesc >= 0 && it.getDay() === diaDesc;
    const hayRuta = diasConRuta.has(fStr);
    
    if (esDes) {
      if (hayRuta) {
        trabajEnDes++;
      } else {
        realDes++;
        descan++;
      }
    }
    it.setDate(it.getDate() + 1);
  }
  
  const trabajados = diasConRuta.size;
  const programados = total - descan;
  const pct = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  console.log(`[ASISTENCIA] ${chofer.nombre}: tra=${trabajados}, des=${descan}, trabajoEnDes=${trabajEnDes}, realDes=${realDes}, diaDesc=${diaDesc}`);
  
  return {
    porcentaje: pct,
    trabajados,
    descansos: descan,
    faltan: Math.max(0, programados - trabajados),
    programados,
    diasMes: total,
    inicio,
    fin: fechaFin
  };
}

export const getDiaDescansoLabel = (dia: number | undefined): string => DIAS[dia ?? 0] || 'Domingo';

export function calcularAsistenciaMensualV3(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin);
}

export function calcularAsistenciaMensual(params: any): AsistenciaResult {
  return calcularAsistencia(params.chofer, params.rutasDelMes, params.fechaFin);
}