import React from 'react';
import { Activity } from 'lucide-react';
import { Tooltip } from '../../../../components/ui/Tooltip';

interface PerformancePulseProps {
  rendimiento: {
    promedioHistoricoMinutos: number;
    tiempoHoyMinutos: number;
    diferenciaPct: number | null;
    rutasConDatos: number;
    label: string;
  } | null;
}

export function PerformancePulse({ rendimiento }: PerformancePulseProps) {
  if (!rendimiento) return null;

  const formatMins = (mins: number) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const isGood = rendimiento.diferenciaPct !== null && rendimiento.diferenciaPct <= -5;
  const isBad = rendimiento.diferenciaPct !== null && rendimiento.diferenciaPct >= 10;
  const isNeutral = !isGood && !isBad;

  const colorClass = rendimiento.diferenciaPct === null 
    ? 'bg-surface border-surface-light' 
    : isGood 
      ? 'bg-green-500/10 border-green-500/40' 
      : isBad 
        ? 'bg-red-500/10 border-red-500/40' 
        : 'bg-yellow-500/10 border-yellow-500/40';

  const iconColorClass = rendimiento.diferenciaPct === null 
    ? 'text-text-muted' 
    : isGood 
      ? 'text-green-400' 
      : isBad 
        ? 'text-red-400' 
        : 'text-yellow-400';

  const iconBgClass = rendimiento.diferenciaPct === null 
    ? 'bg-surface-light' 
    : isGood 
      ? 'bg-green-500/20' 
      : isBad 
        ? 'bg-red-500/20' 
        : 'bg-yellow-500/20';

  return (
    <div className={`p-5 rounded-3xl border-2 flex items-center justify-between gap-4 transition-all hover:shadow-2xl hover:shadow-black/20 ${colorClass}`}>
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-2xl shadow-inner ${iconBgClass}`}>
          <Activity size={24} className={iconColorClass} />
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase font-black tracking-widest flex items-center gap-1.5 mb-1">
            Pulso del día — {rendimiento.label}
            <Tooltip content={`Compara el tiempo promedio de las rutas finalizadas hoy vs el promedio histórico de los últimos 30 días para este mismo día de la semana (${rendimiento.rutasConDatos} rutas de referencia).`} />
          </p>
          {rendimiento.tiempoHoyMinutos > 0 ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-black text-white italic">
                {formatMins(rendimiento.tiempoHoyMinutos)}
              </span>
              {rendimiento.promedioHistoricoMinutos > 0 && (
                <>
                  <span className="text-text-muted text-sm font-bold">vs promedio {formatMins(rendimiento.promedioHistoricoMinutos)}</span>
                  {rendimiento.diferenciaPct !== null && (
                    <span className={`text-xs font-black px-3 py-1 rounded-full italic ${
                      isGood ? 'text-green-400 bg-green-500/20' :
                      isBad ? 'text-red-400 bg-red-500/20' :
                      'text-yellow-400 bg-yellow-500/20'
                    }`}>
                      {rendimiento.diferenciaPct > 0 ? '+' : ''}{rendimiento.diferenciaPct}%
                    </span>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-white font-black italic">Sin rutas finalizadas aún hoy</p>
          )}
          <p className="text-text-muted text-[11px] font-bold mt-1.5 flex items-center gap-2">
            {rendimiento.diferenciaPct === null ? '📊 Sin datos históricos suficientes para comparar' :
              isGood ? '🚀 EFICIENCIA ALTA: Rutas más rápidas que el promedio' :
              isBad ? '🐢 RETRASO DETECTADO: Rutas más lentas que el promedio' :
              '↔️ ESTABLE: Rendimiento dentro del rango normal'}
          </p>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-center text-center min-w-[100px] bg-black/20 p-3 rounded-2xl border border-white/5">
        <span className="text-4xl drop-shadow-lg">
          {rendimiento.diferenciaPct === null ? '📊' :
            isGood ? '🚀' :
            isBad ? '🐢' : '✅'}
        </span>
        <span className="text-[10px] text-text-muted mt-2 font-black uppercase tracking-tighter">{rendimiento.rutasConDatos} REFS.</span>
      </div>
    </div>
  );
}
