import React from 'react';
import { Truck, AlertCircle, ChevronDown, ChevronUp, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Tooltip } from '../../../../components/ui/Tooltip';
import { format } from 'date-fns';

interface RutaEnProgreso {
  id_ruta: string;
  nombre: string;
  chofer_id: string;
  chofer_nombre: string;
  placa: string;
  estado: string;
  hora_salida: string | null;
  visitas_totales: number;
  visitas_completadas: number;
}

interface ActiveRoutesProps {
  rutasPorChofer: Record<string, { nombre: string; placa: string; rutas: RutaEnProgreso[] }>;
  expandedChoferes: Set<string>;
  toggleExpand: (choferId: string) => void;
}

export function ActiveRoutes({ rutasPorChofer, expandedChoferes, toggleExpand }: ActiveRoutesProps) {
  const getProgreso = (completadas: number, total: number) =>
    total === 0 ? 0 : Math.round((completadas / total) * 100);

  return (
    <Card className="border-surface-light/50 bg-surface/30 backdrop-blur-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
            <Truck className="text-primary" size={20} />
            Seguimiento en Vivo
            <Tooltip content="Rutas actualmente en ejecución. Si un chofer tiene múltiples rutas, se muestran todas." />
          </h2>
          <Link to="/admin/rutas" className="text-primary text-xs font-black italic uppercase hover:underline bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
            Ver todas
          </Link>
        </div>

        {Object.keys(rutasPorChofer).length === 0 ? (
          <div className="text-center py-12 bg-background/50 rounded-3xl border border-dashed border-white/5">
            <AlertCircle className="mx-auto mb-3 opacity-30 text-text-muted" size={40} />
            <p className="text-text-muted italic font-bold">No hay rutas en progreso actualmente.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(rutasPorChofer).map(([choferId, { nombre, placa, rutas }]) => {
              const totalV = rutas.reduce((s, r) => s + r.visitas_totales, 0);
              const completadasV = rutas.reduce((s, r) => s + r.visitas_completadas, 0);
              const pctGeneral = getProgreso(completadasV, totalV);
              const isExpanded = expandedChoferes.has(choferId);
              const tieneMultiplesRutas = rutas.length > 1;

              return (
                <div key={choferId} className="bg-background/40 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all group">
                  <div
                    className={`p-4 cursor-pointer transition-colors ${tieneMultiplesRutas ? 'hover:bg-primary/5' : ''}`}
                    onClick={() => tieneMultiplesRutas && toggleExpand(choferId)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="p-2 bg-surface-light rounded-xl group-hover:bg-primary/10 transition-colors">
                            <Truck size={18} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-white font-black italic uppercase tracking-tight group-hover:text-primary transition-colors truncate">{nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black text-text-muted bg-surface-light px-2 py-0.5 rounded uppercase">{placa}</span>
                              {tieneMultiplesRutas && (
                                <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                  {rutas.length} RUTAS ACTIVAS
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end min-w-[120px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-white italic tracking-widest">{pctGeneral}%</span>
                          <span className="text-[10px] text-text-muted font-bold uppercase">({completadasV}/{totalV} Locales)</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-light rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] ${
                              pctGeneral === 100 ? 'bg-green-500' : 'bg-primary'
                            }`}
                            style={{ width: `${pctGeneral}%` }}
                          />
                        </div>
                      </div>

                      {tieneMultiplesRutas && (
                        <div className="text-text-muted group-hover:text-primary transition-colors">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && tieneMultiplesRutas && (
                    <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                      <div className="h-px bg-white/5 mb-3" />
                      {rutas.map(r => {
                        const pct = getProgreso(r.visitas_completadas, r.visitas_totales);
                        return (
                          <div key={r.id_ruta} className="flex flex-col gap-2 p-3 bg-black/20 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs font-bold text-white italic uppercase tracking-tighter flex items-center gap-2">
                                  {r.nombre}
                                  {pct === 100 && <CheckCircle2 size={12} className="text-green-400" />}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted font-bold">
                                  <span className="flex items-center gap-1"><Clock size={10} /> {r.hora_salida ? format(new Date(r.hora_salida), 'HH:mm') : '--:--'}</span>
                                  <span className="flex items-center gap-1"><MapPin size={10} /> {r.visitas_completadas}/{r.visitas_totales}</span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-black italic ${pct === 100 ? 'text-green-400' : 'text-primary'}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className="w-full h-1 bg-surface-light rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-1000 ${pct === 100 ? 'bg-green-500' : 'bg-primary/60'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
