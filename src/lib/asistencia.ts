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

// ✅ TEST OBLIGATORIO - Caso real 06/04 a 23/04 con martes = 2
function testMartes() {
  console.log('=== TEST: MARTES ENTRE 06/04 Y 23/04 ===');
  
  const inicio = new Date('2026-04-06T00:00:00');
  const fin = new Date('2026-04-23T00:00:00');
  
  let fecha = new Date(inicio);
  let martes = 0;
  let fechasMartes: string[] = [];
  
  while (fecha <= fin) {
    if (fecha.getDay() === 2) {
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, '0');
      const d = String(fecha.getDate()).padStart(2, '0');
      fechasMartes.push(`${y}-${m}-${d}`);
      martes++;
    }
    fecha.setDate(fecha.getDate() + 1);
  }
  
  console.log('FECHAS MARTES:', fechasMartes);
  console.log('TOTAL MARTES:', martes);
  console.log('========================================');
  
  if (martes !== 3) {
    console.error('ERROR: Debe ser 3!');
  }
}

// Ejecutar test al cargar
testMartes();

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
  
  // ✅ USAR FECHAS COMO STRINGS "YYYY-MM-DD"
  const primerDiaStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const diaActual = new Date();
  const anioActual = diaActual.getFullYear();
  const mesActual = diaActual.getMonth() + 1;
  const diaNum = diaActual.getDate();
  const finStr = `${anioActual}-${String(mesActual).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
  
  let inicioCalculado = primerDiaStr;
  
  // ✅ USAR fecha_ingreso COMO STRING
  if (chofer.fecha_ingreso) {
    const fic = String(chofer.fecha_ingreso).split('T')[0];
    if (fic >= primerDiaStr && fic <= finStr) {
      inicioCalculado = fic;
    }
  }
  
  const finCalculado = finStr;
  
  // ✅ NORMALIZAR RUTAS
  const rutasFiltradas = rutasDelMes.filter(r => r.id_chofer === chofer.id_usuario && r.fecha);
  const rutasSet = new Set<string>();
  rutasFiltradas.forEach(r => {
    if (r.fecha) {
      const f = String(r.fecha).split('T')[0];
      rutasSet.add(f);
    }
  });
  
  // ✅ NORMALIZAR ASISTENCIA
  const asistenciaMap = new Map<string, AsistenciaChofer>();
  asistenciaManual.forEach(a => {
    if (a.id_chofer === chofer.id_usuario && a.fecha) {
      const f = String(a.fecha).split('T')[0];
      asistenciaMap.set(f, a);
    }
  });
  
  let trabajados = 0;
  let descansos = 0;
  let faltan = 0;
  
  // ✅ ITERAR USANDO STRINGS - obtener días por mes
  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  const [anioInicio, mesInicio, diaInicio] = inicioCalculado.split('-').map(Number);
  const [anioFin, mesFin, diaFin] = finCalculado.split('-').map(Number);
  
  let anio = anioInicio;
  let mes = mesInicio;
  let dia = diaInicio;
  
  while (anio < anioFin || (anio === anioFin && mes < mesFin) || (anio === anioFin && mes === mesFin && dia <= diaFin)) {
    const fechaStr = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const fechaTmp = new Date(anio, mes - 1, dia);
    const dayOfWeek = fechaTmp.getDay();
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
    
    // Avanzar un día
    dia++;
    const maxDias = (mes === 2 && ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0)) ? 29 : diasPorMes[mes - 1];
    if (dia > maxDias) {
      dia = 1;
      mes++;
      if (mes > 12) {
        mes = 1;
        anio++;
      }
    }
  }
  
  const programados = trabajados + faltan;
  const porcentaje = programados > 0 ? Math.round((trabajados / programados) * 100) : 0;
  
  console.log('=== RESULTADO ASISTENCIA ===');
  console.log('inicio:', inicioCalculado, 'fin:', finCalculado);
  console.log(' trabajados:', trabajados, ' descansos:', descansos, ' faltan:', faltan);
  console.log('==============================');
  
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