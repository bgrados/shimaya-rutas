import { AlertTriangle, Clock, MapPin, Fuel, CheckCircle2, Info, XCircle, Truck, RefreshCw } from 'lucide-react';

export interface Alerta {
  id: string;
  tipo: 'warning' | 'error' | 'success' | 'info';
  titulo: string;
  descripcion: string;
  severidad: 'alta' | 'media' | 'baja';
  origen: 'ruta' | 'tiempo' | 'gps' | 'gasto' | 'visita';
}

interface AlertaCardProps {
  alerta: Alerta;
}

export function AlertaCard({ alerta }: AlertaCardProps) {
  const iconos = {
    warning: AlertTriangle,
    error: XCircle,
    success: CheckCircle2,
    info: Info
  };
  
  const colores = {
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-400',
      text: 'text-yellow-300'
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
      text: 'text-red-300'
    },
    success: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: 'text-green-400',
      text: 'text-green-300'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
      text: 'text-blue-300'
    }
  };
  
  const Icono = iconos[alerta.tipo];
  const estilo = colores[alerta.tipo];
  
  return (
    <div className={`${estilo.bg} border ${estilo.border} rounded-xl p-4 flex items-start gap-3`}>
      <Icono size={20} className={`${estilo.icon} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${estilo.text}`}>{alerta.titulo}</p>
        <p className="text-text-muted text-xs mt-1">{alerta.descripcion}</p>
      </div>
    </div>
  );
}

interface ListaAlertasProps {
  alertas: Alerta[];
  titulo?: string;
  className?: string;
}

export function ListaAlertas({ alertas, titulo, className = '' }: ListaAlertasProps) {
  if (alertas.length === 0) return null;
  
  return (
    <div className={`space-y-2 ${className}`}>
      {titulo && (
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-yellow-400" />
          <h3 className="font-bold text-white text-sm">{titulo}</h3>
          <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {alertas.length}
          </span>
        </div>
      )}
      {alertas.map(alerta => (
        <AlertaCard key={alerta.id} alerta={alerta} />
      ))}
    </div>
  );
}

// Funciones de detección de inconsistencias
export function detectarInconsistenciasRuta(
  ruta: any,
  locales: any[],
  bitacora: any[],
  gastoCombustible: number,
  gastoPromedio: number,
  tiempoPromedio: number
): Alerta[] {
  const alertas: Alerta[] = [];
  const hoy = new Date().toISOString().split('T')[0];
  
  // 1. Ruta no finalizada (si ya es tarde)
  if (ruta.estado !== 'finalizada' && ruta.fecha === hoy) {
    const ahora = new Date();
    const horaCorte = 19; // 7 PM
    if (ahora.getHours() >= horaCorte) {
      alertas.push({
        id: `no-finalizada-${ruta.id_ruta}`,
        tipo: 'warning',
        titulo: 'Ruta no finalizada',
        descripcion: `Han pasado ${ahora.getHours() - horaCorte + 1} horas desde la hora de corte. Verificar estado.`,
        severidad: 'alta',
        origen: 'ruta'
      });
    }
  }
  
  // 2. Locales no visitados
  const localesPendientes = locales.filter(l => l.estado_visita !== 'visitado');
  if (localesPendientes.length > 0) {
    alertas.push({
      id: `pendientes-${ruta.id_ruta}`,
      tipo: localesPendientes.length > 3 ? 'error' : 'warning',
      titulo: `${localesPendientes.length} locales sin visitar`,
      descripcion: `Quedan ${localesPendientes.length} pendientes por visitar en la ruta de hoy.`,
      severidad: localesPendientes.length > 3 ? 'alta' : 'media',
      origen: 'visita'
    });
  }
  
  // 3. Visitas adicionales (si hay más visitas de las esperadas)
  const localesTotales = locales.length;
  const localesBase = ruta.locales_base_count || 0;
  if (localesTotales > localesBase && localesBase > 0) {
    const adicionales = localesTotales - localesBase;
    alertas.push({
      id: `adicionales-${ruta.id_ruta}`,
      tipo: 'info',
      titulo: 'Visitas adicionales detectadas',
      descripcion: `Se realizaron ${adicionales} visita(s) adicional(es) a lo esperado en la ruta.`,
      severidad: 'baja',
      origen: 'visita'
    });
  }
  
  // 4. Tiempo de ruta superior al promedio
  if (ruta.hora_salida_planta && bitacora.length > 0) {
    const ultimoTramo = bitacora[bitacora.length - 1];
    if (ultimoTramo.hora_llegada && ruta.estado === 'finalizada') {
      const salida = new Date(ruta.hora_salida_planta);
      const llegada = new Date(ultimoTramo.hora_llegada);
      const minutosTotales = (llegada.getTime() - salida.getTime()) / 60000;
      
      if (tiempoPromedio > 0 && minutosTotales > tiempoPromedio * 1.2) {
        const excedente = Math.round(minutosTotales - tiempoPromedio);
        alertas.push({
          id: `tiempo-${ruta.id_ruta}`,
          tipo: 'warning',
          titulo: 'Tiempo de ruta elevado',
          descripcion: `La ruta duró ${Math.round(minutosTotales / 60)}h ${minutosTotales % 60}m, ${excedente} min más del promedio.`,
          severidad: 'media',
          origen: 'tiempo'
        });
      }
    }
  }
  
  // 5. Falta de datos GPS
  const bitacoraSinGps = bitacora.filter(b => !b.gps_salida_lat && !b.gps_llegada_lat);
  if (bitacoraSinGps.length > 0 && bitacora.length > 0) {
    const porcentajeSinGps = (bitacoraSinGps.length / bitacora.length) * 100;
    if (porcentajeSinGps > 30) {
      alertas.push({
        id: `gps-${ruta.id_ruta}`,
        tipo: 'warning',
        titulo: 'Datos GPS incompletos',
        descripcion: `${bitacoraSinGps.length} de ${bitacora.length} tramos sin registro de ubicación.`,
        severidad: 'media',
        origen: 'gps'
      });
    }
  }
  
  // 6. Gastos anormales
  if (gastoPromedio > 0 && gastoCombustible > gastoPromedio * 1.5) {
    alertas.push({
      id: `gasto-${ruta.id_ruta}`,
      tipo: 'warning',
      titulo: 'Gasto de combustible elevado',
      descripcion: `S/ ${gastoCombustible.toFixed(2)} gastado, ${Math.round(((gastoCombustible - gastoPromedio) / gastoPromedio * 100))}% más del promedio.`,
      severidad: 'media',
      origen: 'gasto'
    });
  }
  
  return alertas;
}

export function detectarInconsistenciasGlobales(
  rutas: any[],
  choferesActivos: number,
  choferesTotal: number,
  gastosSemana: { fecha: string; monto: number }[],
  diasLaborables: number
): Alerta[] {
  const alertas: Alerta[] = [];
  
  // 1. Rutas no finalizadas
  const rutasPendientes = rutas.filter(r => r.estado !== 'finalizada');
  const hoy = new Date().toISOString().split('T')[0];
  const rutasDeHoy = rutas.filter(r => r.fecha === hoy);
  
  if (rutasDeHoy.length > 0) {
    const sinFinalizar = rutasDeHoy.filter(r => r.estado !== 'finalizada');
    if (sinFinalizar.length > 0) {
      alertas.push({
        id: 'rutas-sin-finalizar',
        tipo: 'warning',
        titulo: `${sinFinalizar.length} ruta(s) sin finalizar`,
        descripcion: `De ${rutasDeHoy.length} rutas de hoy, ${sinFinalizar.length} aún no han sido finalizadas.`,
        severidad: sinFinalizar.length > 2 ? 'alta' : 'media',
        origen: 'ruta'
      });
    }
  }
  
  // 2. Choferes sin ruta asignada
  const rutasActivasIds = new Set(rutas.filter(r => r.estado === 'en_progreso').map(r => r.id_chofer));
  const choferesSinRuta = choferesTotal - rutasActivasIds.size;
  if (choferesSinRuta > 0 && choferesTotal > 0) {
    alertas.push({
      id: 'choferes-sin-ruta',
      tipo: 'info',
      titulo: `${choferesSinRuta} chofer(es) sin ruta activa`,
      descripcion: `${choferesActivos} de ${choferesTotal} choferes tienen rutas en curso.`,
      severidad: 'baja',
      origen: 'ruta'
    });
  }
  
  // 3. Gastos por día laborable
  if (diasLaborables > 0) {
    const gastoTotalSemana = gastosSemana.reduce((sum, g) => sum + g.monto, 0);
    const gastoPromedioDiario = gastoTotalSemana / diasLaborables;
    
    if (gastoPromedioDiario > 500) {
      alertas.push({
        id: 'gastos-elevados',
        tipo: 'warning',
        titulo: 'Gastos semanales elevados',
        descripcion: `Promedio de S/ ${gastoPromedioDiario.toFixed(2)} por día laborable esta semana.`,
        severidad: 'media',
        origen: 'gasto'
      });
    }
  }
  
  return alertas;
}
