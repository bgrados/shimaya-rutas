import React from 'react';
import { Truck, Clock, FileText } from 'lucide-react';
import { TramoBitacora } from './TramoBitacora';
import type { ViajeBitacora, LocalRuta, GuiaRemision } from '../../../../types';

interface BitacoraListProps {
  bitacora: ViajeBitacora[];
  locales: LocalRuta[];
  editandoBitacora: string | null;
  editHoraSalida: string;
  editHoraLlegada: string;
  handleEditarHora: (tramo: ViajeBitacora) => void;
  guardarEdicionHora: (tramo: ViajeBitacora) => void;
  setEditandoBitacora: (id: string | null) => void;
  setEditHoraSalida: (h: string) => void;
  setEditHoraLlegada: (h: string) => void;
  setViewingGuias: (guias: GuiaRemision[]) => void;
  setCurrentGuiaIndex: (idx: number) => void;
}

export function BitacoraList({
  bitacora,
  locales,
  editandoBitacora,
  editHoraSalida,
  editHoraLlegada,
  handleEditarHora,
  guardarEdicionHora,
  setEditandoBitacora,
  setEditHoraSalida,
  setEditHoraLlegada,
  setViewingGuias,
  setCurrentGuiaIndex
}: BitacoraListProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xs font-black text-text-muted uppercase tracking-[0.3em] pt-6 flex items-center gap-2 italic">
        <div className="w-4 h-[1px] bg-text-muted opacity-20" />
        Bitácora de Movimientos
        <div className="flex-1 h-[1px] bg-gradient-to-r from-text-muted to-transparent opacity-20" />
      </h3>

      <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primary/30 before:to-surface-light/10">
        {bitacora.length > 0 ? (
          bitacora.map((tramo, idx) => (
            <TramoBitacora
              key={tramo.id_bitacora}
              tramo={tramo}
              idx={idx}
              esUltimo={idx === bitacora.length - 1}
              editando={editandoBitacora === tramo.id_bitacora}
              editHoraSalida={editHoraSalida}
              editHoraLlegada={editHoraLlegada}
              onEdit={() => handleEditarHora(tramo)}
              onSave={() => guardarEdicionHora(tramo)}
              onCancel={() => setEditandoBitacora(null)}
              onSetHoraSalida={setEditHoraSalida}
              onSetHoraLlegada={setEditHoraLlegada}
              tramoAnterior={idx > 0 ? bitacora[idx - 1] : undefined}
              guias={locales.find(l => (l.nombre || '').trim().toLowerCase() === (tramo.destino_nombre || '').trim().toLowerCase())?.guias}
              onViewGuias={(docs) => {
                setViewingGuias(docs);
                setCurrentGuiaIndex(0);
              }}
            />
          ))
        ) : (
          <div className="text-center py-10 opacity-30 select-none bg-surface-light/10 rounded-2xl border border-dashed border-white/5">
            <Truck size={32} className="mx-auto mb-2" />
            <p className="text-sm italic font-bold">Inicia tu salida en Planta para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}
