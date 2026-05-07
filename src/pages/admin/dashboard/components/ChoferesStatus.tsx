import React from 'react';
import { Calendar, UserCheck, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Tooltip } from '../../../../components/ui/Tooltip';

interface EstadoChofer {
  id: string;
  nombre: string;
  descansoNormal: string;
  descansaHoy: boolean;
  motivo: string;
  enRuta: boolean;
}

interface ChoferesStatusProps {
  estadoChoferes: EstadoChofer[];
}

export function ChoferesStatus({ estadoChoferes }: ChoferesStatusProps) {
  return (
    <Card className="border-surface-light/50 bg-surface/30 backdrop-blur-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
            <Calendar className="text-primary" size={20} />
            Estado de Choferes Hoy
            <Tooltip content="Muestra qué choferes están trabajando, en descanso fijo o con excepción semanal." />
          </h2>
          <Link to="/admin/usuarios" className="text-primary text-xs font-black italic uppercase hover:underline bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
            Gestionar
          </Link>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {estadoChoferes.map(chofer => (
            <div key={chofer.id} className="flex items-center justify-between p-3.5 bg-background/50 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full border-2 border-background shadow-lg ${
                    chofer.enRuta ? 'bg-green-500 animate-pulse' :
                    chofer.descansaHoy ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <div className={`absolute inset-0 rounded-full blur-[4px] opacity-50 ${
                    chofer.enRuta ? 'bg-green-500' :
                    chofer.descansaHoy ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                </div>
                <div>
                  <span className="text-white font-black italic uppercase text-sm tracking-tight group-hover:text-primary transition-colors">{chofer.nombre}</span>
                  <p className="text-[10px] text-text-muted font-bold mt-0.5">
                    {chofer.descansaHoy ? chofer.motivo : `Descanso: ${chofer.descansoNormal}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {chofer.descansaHoy ? (
                  <span className="text-[10px] font-black uppercase italic bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20 flex items-center gap-1.5">
                    <UserX size={12} /> Descanso
                  </span>
                ) : chofer.enRuta ? (
                  <span className="text-[10px] font-black uppercase italic bg-green-500/10 text-green-400 px-3 py-1 rounded-full border border-green-500/20 flex items-center gap-1.5">
                    <UserCheck size={12} /> En ruta
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase italic bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 flex items-center gap-1.5">
                    <UserCheck size={12} /> Disponible
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap gap-5 text-[10px] font-black uppercase tracking-widest text-text-muted">
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> En ruta</span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span> Disponible</span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span> En descanso</span>
        </div>
      </CardContent>
    </Card>
  );
}
