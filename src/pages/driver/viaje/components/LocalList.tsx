import React from 'react';
import { FileText } from 'lucide-react';
import type { LocalRuta, GuiaRemision } from '../../../../types';

interface LocalListProps {
  localesDisponibles: LocalRuta[];
  rutaEstado: string;
  localesRegistrados: string[];
  locales: LocalRuta[];
  setViewingGuias: (guias: GuiaRemision[]) => void;
  setCurrentGuiaIndex: (idx: number) => void;
}

export function LocalList({
  localesDisponibles,
  rutaEstado,
  localesRegistrados,
  locales,
  setViewingGuias,
  setCurrentGuiaIndex
}: LocalListProps) {
  if (locales.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* LISTA DE LOCALES PENDIENTES CON GUÍAS */}
      {localesDisponibles.length > 0 && rutaEstado !== 'finalizada' && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] italic px-1">Próximos Destinos Planificados</h4>
          <div className="grid grid-cols-1 gap-2">
            {localesDisponibles.map(local => (
              <div key={local.id_local_ruta} className="bg-surface/50 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-bold text-white uppercase">{local.nombre}</span>
                {local.guias && local.guias.length > 0 && (
                  <button 
                    onClick={() => { setViewingGuias(local.guias || []); setCurrentGuiaIndex(0); }} 
                    className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    <FileText size={14} />
                    <span className="text-[10px] font-black">{local.guias.length} GUÍAS</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BARRA DE PROGRESO */}
      <div className="bg-surface/50 p-4 rounded-2xl border border-white/5 space-y-3">
         <div className="flex justify-between text-[10px] uppercase font-black text-text-muted tracking-[0.2em]">
            <span>LOCALES VISITADOS</span>
            <span className="text-primary">{localesRegistrados.filter(l => l !== 'Planta').length} / {locales.filter(l => l.nombre !== 'Planta').length}</span>
         </div>
         <div className="h-3 bg-surface-light rounded-full overflow-hidden flex p-0.5 shadow-inner">
            {locales.map((l, i) => (
              <div 
                key={i} 
                className={`flex-1 mx-0.5 rounded-full transition-all duration-500 ${localesRegistrados.includes(l.nombre || '') ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-surface'}`}
              />
            ))}
         </div>
      </div>
    </div>
  );
}
