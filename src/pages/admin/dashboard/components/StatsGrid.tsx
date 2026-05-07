import React from 'react';
import { Truck, CheckCircle, MapPin, Users, Fuel, Car, Route, DollarSign } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Tooltip } from '../../../../components/ui/Tooltip';

interface Stats {
  rutasActivas: number;
  rutasPendientes: number;
  rutasFinalizadas: number;
  visitasCompletadas: number;
  visitasPendientes: number;
  localesVisitados: number;
  choferesEnRuta: number;
  choferesDisponibles: number;
  choferesDescanso: number;
  choferesSinRuta: number;
  totalChoferes: number;
  gastoCombustibleDia: number;
  gastoCombustibleSemana: number;
  gastoOtrosDia: number;
  gastoOtrosSemana: number;
  gastosHoy: number;
  peajeDia: number;
  peajeSemana: number;
  totalGastosOperativosHoy: number;
}

interface StatsGridProps {
  stats: Stats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="space-y-4">
      {/* Principales KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Rutas Activas" 
          value={stats.rutasActivas} 
          subtitle={stats.rutasPendientes > 0 ? `${stats.rutasPendientes} pendientes` : undefined}
          icon={<Truck size={20} />}
          color="blue"
          tooltip="Rutas en ejecución ahora mismo."
        />
        <StatCard 
          title="Finalizadas" 
          value={stats.rutasFinalizadas} 
          icon={<CheckCircle size={20} />}
          color="green"
          tooltip="Rutas completadas correctamente hoy."
        />
        <StatCard 
          title="Visitas Hoy" 
          value={stats.visitasCompletadas} 
          subtitle={stats.localesVisitados > 0 ? `${stats.localesVisitados} programadas` : undefined}
          icon={<MapPin size={20} />}
          color="purple"
          tooltip="Visitas completadas sobre el total programado hoy."
        />
        <StatCard 
          title="Choferes" 
          value={`${stats.choferesEnRuta}/${stats.totalChoferes}`} 
          subtitle={`${stats.choferesDisponibles} disp · ${stats.choferesDescanso} desc`}
          icon={<Users size={20} />}
          color="orange"
          tooltip="En ruta / total. Muestra disponibles y en descanso."
          isHighlight={stats.choferesEnRuta > 0}
        />
      </div>

      {/* Gastos y Operación */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Combustible Hoy" 
          value={`S/ ${stats.gastoCombustibleDia.toFixed(2)}`} 
          subtitle={`Sem: S/ ${stats.gastoCombustibleSemana.toFixed(2)}`}
          icon={<Fuel size={20} />}
          color="yellow"
          tooltip="Total gastado en combustible hoy."
        />
        <StatCard 
          title="Otros Hoy" 
          value={`S/ ${stats.gastoOtrosDia.toFixed(2)}`} 
          subtitle={`Sem: S/ ${stats.gastoOtrosSemana.toFixed(2)}`}
          icon={<Car size={20} />}
          color="cyan"
          tooltip="Gastos adicionales como estacionamiento u otros."
        />
        <StatCard 
          title="Peajes Hoy" 
          value={`S/ ${stats.peajeDia.toFixed(2)}`} 
          subtitle={`Sem: S/ ${stats.peajeSemana.toFixed(2)}`}
          icon={<Route size={20} />}
          color="pink"
          tooltip="Peajes calculados automáticamente según rutas finalizadas."
        />
        <StatCard 
          title="Total Operativo" 
          value={`S/ ${stats.totalGastosOperativosHoy.toFixed(2)}`} 
          icon={<DollarSign size={20} />}
          color="emerald"
          tooltip="Suma de combustible + otros gastos + peajes del día."
          isPremium
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow' | 'cyan' | 'pink' | 'emerald';
  tooltip: string;
  isHighlight?: boolean;
  isPremium?: boolean;
}

function StatCard({ title, value, subtitle, icon, color, tooltip, isHighlight = true, isPremium = false }: StatCardProps) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400 bg-blue-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400 bg-green-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400 bg-purple-500/20',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400 bg-orange-500/20',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400 bg-yellow-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400 bg-cyan-500/20',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400 bg-pink-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400 bg-emerald-500/20'
  };

  const currentStyle = colors[color];

  return (
    <Card className={`bg-gradient-to-br ${isHighlight ? currentStyle : 'from-surface-light/20 to-surface-light/10 border-surface-light/30'} ${isPremium ? 'ring-2 ring-primary/20 shadow-lg shadow-primary/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isHighlight ? (currentStyle.split(' ').pop()) : 'bg-surface-light/30'}`}>
            <span className={isHighlight ? (currentStyle.split(' ').find(s => s.startsWith('text-'))) : 'text-text-muted'}>
              {icon}
            </span>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-black tracking-widest flex items-center gap-1 ${isHighlight ? (currentStyle.split(' ').find(s => s.startsWith('text-'))) : 'text-text-muted'}`}>
              {title} <Tooltip content={tooltip} />
            </p>
            <p className="text-2xl font-black text-white italic tracking-tighter leading-none mt-1">{value}</p>
            {subtitle && (
              <p className="text-[10px] text-white/50 font-bold mt-1 uppercase tracking-tight">{subtitle}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
