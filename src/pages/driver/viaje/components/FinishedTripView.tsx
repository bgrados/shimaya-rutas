import React from 'react';
import { CheckCircle2, Fuel } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';

interface FinishedTripViewProps {
  ruta: any;
  onNewTrip: () => void;
  onSendSummary: () => void;
  onShowCombustible: () => void;
  enviandoWhatsapp: boolean;
}

export function FinishedTripView({ ruta, onNewTrip, onSendSummary, onShowCombustible, enviandoWhatsapp }: FinishedTripViewProps) {
  return (
    <div className="bg-green-500/10 border-2 border-green-500/50 p-8 rounded-3xl text-center animate-in zoom-in-95 duration-700 shadow-2xl shadow-green-500/10">
      <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-lg shadow-green-500/20"><CheckCircle2 size={36} /></div>
      <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">¡Viaje Cerrado!</h3>
      <div className="flex flex-col gap-1 my-3">
        <p className="text-green-500/80 text-sm font-bold">Bitácora completada y registrada en el sistema.</p>
        <div className="flex justify-center gap-3 mt-2">
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg"><p className="text-[10px] text-text-muted uppercase font-bold">Km Inicial</p><p className="text-white font-black italic">{ruta.km_inicio || 0}</p></div>
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg"><p className="text-[10px] text-text-muted uppercase font-bold">Km Final</p><p className="text-white font-black italic">{ruta.km_fin || '?'}</p></div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onNewTrip} className="mt-4 bg-primary text-white px-4 py-3 rounded-xl font-bold text-sm">🚛 Iniciar Nuevo Viaje</button>
        <button onClick={onSendSummary} disabled={enviandoWhatsapp} className="bg-green-600 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          {enviandoWhatsapp ? '⏳ Generando...' : '📤 Enviar Resumen WhatsApp'}
        </button>
        <button onClick={onShowCombustible} className="bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
          <Fuel size={18} /> Agregar Comprobante de Combustible
        </button>
      </div>
    </div>
  );
}
