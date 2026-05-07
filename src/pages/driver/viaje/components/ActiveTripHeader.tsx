import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, PlusCircle, Edit2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import type { Ruta } from '../../../../types';

interface ActiveTripHeaderProps {
  ruta: Ruta;
  onEditKm: () => void;
  onViewLocales: () => void;
  onBack: () => void;
}

export function ActiveTripHeader({ ruta, onEditKm, onViewLocales, onBack }: ActiveTripHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-fit text-text-muted hover:text-white -ml-2"
      >
        ← VOLVER AL TABLERO
      </Button>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Mi Bitácora</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-text-muted text-sm italic font-medium">{ruta.nombre} • <span className="text-primary font-black uppercase">{ruta.placa || 'Sin Placa'}</span></p>
            {ruta.estado === 'pendiente' && (
              <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-black px-2 py-0.5 rounded border border-yellow-500/30 animate-pulse">
                ⏳ PENDIENTE - Inicia el viaje
              </span>
            )}
            {ruta.km_inicio ? (
              <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                KM: {ruta.km_inicio}
                <button onClick={onEditKm} className="ml-1 text-primary hover:text-white">
                  <Edit2 size={10} />
                </button>
              </span>
            ) : (
              <button
                onClick={onEditKm}
                className="bg-orange-500/20 text-orange-400 text-[10px] font-black px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 animate-pulse"
              >
                <PlusCircle size={10} /> ASIGNAR KM INICIAL
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onViewLocales}
            className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
          >
            <MapPin size={16} className="mr-1" />
            Ver Locales
          </Button>
          <div className={`px-3 py-1 rounded-full border ${ruta.estado === 'pendiente' ? 'bg-yellow-500/20 border-yellow-500/50' : 'bg-surface-light border-white/5'}`}>
            <span className={`text-[10px] font-black italic uppercase tracking-widest ${ruta.estado === 'pendiente' ? 'text-yellow-400' : 'text-primary'}`}>
              {ruta.estado === 'pendiente' ? 'PENDIENTE' : ruta.estado === 'en_progreso' ? 'EN CURSO' : 'FINALIZADA'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
