import { Clock, CheckCircle2, Timer, Edit2, FileText, Wifi, WifiOff } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ViajeBitacora, GuiaRemision } from '../../../types';

const formatPeru = (dateStr: string | null | undefined, fmt: string): string => {
  if (!dateStr) return '-';
  try {
    const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
    return format(date, fmt, { locale: es });
  } catch { return dateStr; }
};

interface TramoBitacoraProps {
  tramo: ViajeBitacora;
  idx: number;
  esUltimo: boolean;
  editando: boolean;
  editHoraSalida: string;
  editHoraLlegada: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSetHoraSalida: (val: string) => void;
  onSetHoraLlegada: (val: string) => void;
  tramoAnterior?: ViajeBitacora;
  guias?: GuiaRemision[];
  onViewGuias?: (guias: GuiaRemision[]) => void;
}

export const TramoBitacora: React.FC<TramoBitacoraProps> = ({
  tramo,
  idx,
  esUltimo,
  editando,
  editHoraSalida,
  editHoraLlegada,
  onEdit,
  onSave,
  onCancel,
  onSetHoraSalida,
  onSetHoraLlegada,
  tramoAnterior,
  guias,
  onViewGuias
}) => {
  return (
    <div className="flex gap-6 relative group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 text-xs font-black shadow-lg transition-all ${tramo.hora_llegada ? 'bg-green-500 text-black border-2 border-white/10' : 'bg-primary text-white animate-pulse ring-4 ring-primary/20'}`}>
        {idx + 1}
      </div>
      <div className="flex-1 bg-surface-light/10 border border-white/5 p-4 rounded-xl backdrop-blur-sm transition-all hover:bg-surface-light/20 group-hover:border-primary/30">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-white italic tracking-tight uppercase">
              {tramo.origen_nombre} <span className="text-primary mx-1">→</span> {tramo.destino_nombre}
            </h4>
            <div className="flex items-center gap-3 text-[9px] text-text-muted font-bold uppercase tracking-widest flex-wrap">
              <span className="flex items-center gap-1"><Clock size={10}/> {formatPeru(tramo.hora_salida!, 'HH:mm')}</span>
              {tramo.hora_llegada && (
                <>
                  <span className="flex items-center gap-1 text-green-500 border-l border-white/10 pl-3">
                    <CheckCircle2 size={10}/> {formatPeru(tramo.hora_llegada, 'HH:mm')}
                  </span>
                  {/* Indicador de tipo de registro */}
                  <span className={`flex items-center gap-1 border-l border-white/10 pl-3 ${
                    (tramo as any).tipo_registro === 'manual' 
                      ? 'text-yellow-400' 
                      : 'text-green-400'
                  }`}>
                    {(tramo as any).tipo_registro === 'manual' ? (
                      <>
                        <WifiOff size={10}/>
                        Manual
                      </>
                    ) : (
                      <>
                        <Wifi size={10}/>
                        Auto
                      </>
                    )}
                  </span>
                </>
              )}
              {guias && guias.length > 0 && (
                <button 
                  onClick={() => onViewGuias?.(guias)}
                  className="flex items-center gap-1 text-primary border-l border-white/10 pl-3 hover:text-white transition-colors"
                >
                  <FileText size={10}/> GUÍAS ({guias.length})
                </button>
              )}
            </div>
          </div>
          {!tramo.hora_llegada && (
            <div className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border border-blue-500/20">
               EN CAMINO
            </div>
          )}
          {tramo.hora_llegada && (
            <div className={`text-[8px] font-bold px-2 py-0.5 rounded ${
              (tramo as any).tipo_registro === 'manual'
                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/20'
            }`}>
              {(tramo as any).tipo_registro === 'manual' ? '● Manual' : '● Auto'}
            </div>
          )}
          <button
            onClick={onEdit}
            className="text-[10px] text-text-muted hover:text-primary flex items-center gap-1 ml-2"
          >
            <Edit2 size={10} />
          </button>
        </div>
        
        {editando && (
          <div className="mt-3 p-3 bg-surface rounded-xl border border-primary/30 flex flex-wrap gap-3 items-center">
            <div className="flex flex-col">
              <label className="text-[8px] text-text-muted uppercase">Salida</label>
              <input
                type="time"
                value={editHoraSalida}
                onChange={e => onSetHoraSalida(e.target.value)}
                className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-white/10"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[8px] text-text-muted uppercase">Llegada</label>
              <input
                type="time"
                value={editHoraLlegada}
                onChange={e => onSetHoraLlegada(e.target.value)}
                className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-white/10"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={onSave}
                className="bg-green-500 text-white text-[10px] px-3 py-1 rounded font-bold"
              >
                Guardar
              </button>
              <button
                onClick={onCancel}
                className="bg-surface text-text-muted text-[10px] px-3 py-1 rounded"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
