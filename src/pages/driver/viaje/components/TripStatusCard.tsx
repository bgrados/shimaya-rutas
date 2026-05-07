import React from 'react';
import { Truck, Clock, RefreshCw, FileText, Edit2 } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { formatPeru } from '../../../../lib/timezone';
import type { ViajeBitacora } from '../../../../types';

interface TripStatusCardProps {
  tramoEnProgreso: ViajeBitacora | null;
  nuevoDestino: string;
  proximoOrigen: string;
  actionLoading: boolean;
  onRefresh: () => void;
  onMarkLlegada: () => void;
  onMarkSalida: () => void;
  onAddPhoto: (local: any) => void;
  onAddNote: (id: string, nombre: string, actual: string) => void;
  locales: any[];
  showModoManual: boolean;
  setShowModoManual: (show: boolean) => void;
}

export function TripStatusCard({
  tramoEnProgreso,
  nuevoDestino,
  proximoOrigen,
  actionLoading,
  onRefresh,
  onMarkLlegada,
  onMarkSalida,
  onAddPhoto,
  onAddNote,
  locales,
  showModoManual,
  setShowModoManual
}: TripStatusCardProps) {
  if (tramoEnProgreso) {
    const normalizedDest = (tramoEnProgreso.destino_nombre || '').trim().toLowerCase();
    const localActual = locales.find(l => (l.nombre || '').trim().toLowerCase() === normalizedDest);

    return (
      <Card className="bg-surface border-primary/30 border-2 shadow-2xl overflow-hidden animate-in slide-in-from-top-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse"><Truck size={18} /></div>
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">En Camino</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 text-[10px] font-bold bg-white/5"><RefreshCw size={12} className="mr-1" /> ACTUALIZAR</Button>
          </div>
          <div className="space-y-4">
            <div><p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Desde</p><p className="text-sm font-bold text-white uppercase italic">{tramoEnProgreso.origen_nombre}</p></div>
            <div className="relative py-2 pl-4"><div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-surface-light"></div><div className="absolute left-[-4px] top-0 w-2.5 h-2.5 rounded-full bg-primary shadow-lg shadow-primary/50"></div></div>
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-4">
                <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Hacia (Destino)</p>
                <h3 className="text-xl font-black text-white italic leading-tight uppercase">{tramoEnProgreso.destino_nombre}</h3>
                {tramoEnProgreso.observacion && <p className="text-xs text-yellow-400 mt-1 italic">📝 {tramoEnProgreso.observacion}</p>}
              </div>
              <div className="flex items-center gap-2 pt-2">
                {localActual?.latitud && localActual?.longitud && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${localActual.latitud},${localActual.longitud}`} target="_blank" rel="noopener noreferrer" className="text-white bg-[#4285F4] p-2.5 rounded-lg active:scale-90 transition-transform hover:bg-[#3367D6]"><MapPin size={18} /></a>
                )}
                {localActual?.guias && localActual.guias.length > 0 && (
                  <button className="text-white bg-primary p-2.5 rounded-lg shadow-lg shadow-primary/30 active:scale-90 transition-transform flex items-center gap-1.5"><FileText size={18} /><span className="text-xs font-black">{localActual.guias.length}</span></button>
                )}
                <button onClick={() => onAddNote(tramoEnProgreso.id_bitacora, tramoEnProgreso.destino_nombre || '', tramoEnProgreso.observacion || '')} className="bg-surface-light text-text-muted p-2.5 rounded-lg active:scale-90 transition-transform hover:bg-primary/20 hover:text-primary group"><Edit2 size={18} /></button>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-text-muted font-bold"><Clock size={14} className="text-primary" /> SALIDA: {formatPeru(tramoEnProgreso.hora_salida, 'HH:mm')}</div>
                <Button size="sm" variant="ghost" className="text-purple-400 font-bold text-[10px]" onClick={() => localActual && onAddPhoto(localActual)}>📸 FOTO EVIDENCIA</Button>
              </div>
              {!showModoManual ? (
                <Button className="w-full h-16 text-lg font-black italic uppercase tracking-widest bg-green-600 hover:bg-green-500 shadow-xl shadow-green-900/40 rounded-2xl border-b-4 border-green-800" onClick={onMarkLlegada} disabled={actionLoading}>{actionLoading ? 'ESPERE...' : 'MARCAR LLEGADA →'}</Button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl text-center"><p className="text-yellow-400 text-xs font-bold">¿Registrar manualmente?</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => setShowModoManual(false)}>Cancelar</Button>
                    <Button className="bg-yellow-600" onClick={() => onMarkLlegada()} disabled={actionLoading}>Sí, manual</Button>
                  </div>
                </div>
              )}
              {!showModoManual && (<button onClick={() => setShowModoManual(true)} className="w-full text-center text-[10px] text-text-muted hover:text-yellow-400 underline py-1">¿No funciona GPS? Registrar manualmente</button>)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-light/5 border border-white/10 overflow-hidden shadow-2xl">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Origen</p><p className="text-sm font-bold text-white uppercase italic">{proximoOrigen}</p></div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Próximo Destino</p><p className="text-sm font-bold text-white uppercase italic">{nuevoDestino || 'Seleccione...'}</p></div>
          </div>
          <Button className="w-full h-16 text-xl font-black italic tracking-widest bg-primary hover:bg-primary-light shadow-xl shadow-primary/30 rounded-2xl border-b-4 border-primary-dark" onClick={onMarkSalida} disabled={actionLoading}>{actionLoading ? 'INICIANDO...' : 'INICIAR VIAJE →'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
