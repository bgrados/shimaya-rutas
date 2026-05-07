import React from 'react';
import { ActiveTripHeader } from './ActiveTripHeader';
import { GpsMonitor } from './GpsMonitor';
import { TripStatusCard } from './TripStatusCard';
import { BitacoraList } from './BitacoraList';
import { LocalList } from './LocalList';
import { ModalEvidencia } from './ModalEvidencia';
import { ModalKilometraje } from './ModalKilometraje';
import { ModalNotas } from './ModalNotas';
import RegistrarCombustible from '../../combustible/Registrar';
import { ImageModal } from '../../../../components/ui/ImageModal';
import { useAuth } from '../../../../contexts/AuthContext';
import { X } from 'lucide-react';
import type { Ruta, ViajeBitacora } from '../../../../types';

interface ActiveTripViewProps {
  ruta: Ruta;
  bitacora: ViajeBitacora[];
  locales: any[];
  tramoEnProgreso: ViajeBitacora | null;
  nuevoDestino: string;
  proximoOrigen: string;
  actionLoading: boolean;
  gpsState: any; // From useGpsTracking
  modals: {
    showLocales: boolean;
    setShowLocales: (v: boolean) => void;
    showEvidencia: boolean;
    setShowEvidencia: (v: boolean) => void;
    showFirma: boolean;
    setShowFirma: (v: boolean) => void;
    showKm: boolean;
    setShowKm: (v: boolean) => void;
    showNotas: boolean;
    setShowNotas: (v: boolean) => void;
    showGastos: boolean;
    setShowGastos: (v: boolean) => void;
    showCombustible: boolean;
    setShowCombustible: (v: boolean) => void;
    imageModal: { isOpen: boolean; image: string; title: string; location: string };
    setImageModal: (v: any) => void;
  };
  handlers: {
    onBack: () => void;
    onRefresh: () => void;
    onMarkLlegada: () => void;
    onMarkSalida: () => void;
    onAddPhoto: (local: any) => void;
    onAddNote: (id: string, nombre: string, actual: string) => void;
    onSaveNote: (nota: string) => void;
    onSaveKm: (km: number) => void;
    onAddGasto: () => void;
    onAddCombustible: () => void;
    onUploadPhoto: (idLocal: string, photo: string, lat?: number, lng?: number) => Promise<void>;
    onSaveFirma: (firma: string, nombre: string, dni: string) => Promise<void>;
  };
  state: {
    localSeleccionado: any;
    setLocalSeleccionado: (v: any) => void;
    notaInfo: { id: string; nombre: string; actual: string };
    showModoManual: boolean;
    setShowModoManual: (v: boolean) => void;
  };
}

export function ActiveTripView({
  ruta,
  bitacora,
  locales,
  tramoEnProgreso,
  nuevoDestino,
  proximoOrigen,
  actionLoading,
  gpsState,
  modals,
  handlers,
  state
}: ActiveTripViewProps) {
  const { profile } = useAuth();
  
  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-32">
      <ActiveTripHeader
        ruta={ruta}
        onEditKm={() => modals.setShowKm(true)}
        onViewLocales={() => modals.setShowLocales(true)}
        onBack={handlers.onBack}
      />

      <GpsMonitor
        {...gpsState}
        onRegistrarManual={() => state.setShowModoManual(true)}
        setShowModoManual={state.setShowModoManual}
      />

      <TripStatusCard
        tramoEnProgreso={tramoEnProgreso}
        nuevoDestino={nuevoDestino}
        proximoOrigen={proximoOrigen}
        actionLoading={actionLoading}
        onRefresh={handlers.onRefresh}
        onMarkLlegada={handlers.onMarkLlegada}
        onMarkSalida={handlers.onMarkSalida}
        onAddPhoto={handlers.onAddPhoto}
        onAddNote={handlers.onAddNote}
        locales={locales}
        showModoManual={state.showModoManual}
        setShowModoManual={state.setShowModoManual}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] italic">Resumen de Ruta</h2>
          <span className="text-[10px] font-bold text-primary">{bitacora.length} Registros</span>
        </div>
        <BitacoraList
          bitacora={bitacora}
          onAddPhoto={handlers.onAddPhoto}
          onAddFirma={(id) => {
            const entry = bitacora.find(b => b.id_bitacora === id);
            state.setLocalSeleccionado(locales.find(l => (l.nombre || '').trim().toLowerCase() === (entry?.destino_nombre || '').trim().toLowerCase()));
            modals.setShowFirma(true);
          }}
          onViewPhotos={(photos) => {
            // photos is array of strings
            // but ImageModal needs gallery
            // We'll handle this in the parent for now or pass gallery logic
          }}
        />
      </div>

      {/* Modales */}
      <ModalEvidencia
        isOpen={modals.showEvidencia}
        onClose={() => modals.setShowEvidencia(false)}
        onUpload={async (photo, lat, lng) => {
          if (state.localSeleccionado) {
            await handlers.onUploadPhoto(state.localSeleccionado.id_local, photo, lat, lng);
          }
        }}
        localNombre={state.localSeleccionado?.nombre || ''}
      />

      <ModalFirma
        isOpen={modals.showFirma}
        onClose={() => modals.setShowFirma(false)}
        onSave={handlers.onSaveFirma}
        localNombre={state.localSeleccionado?.nombre || ''}
      />

      <ModalNotas
        isOpen={modals.showNotas}
        onClose={() => modals.setShowNotas(false)}
        onSave={handlers.onSaveNote}
        titulo={`Nota para ${state.notaInfo.nombre}`}
        valorActual={state.notaInfo.actual}
      />

      <ModalKilometraje
        isOpen={modals.showKm}
        onClose={() => modals.setShowKm(false)}
        onSave={handlers.onSaveKm}
        valorActual={ruta.km_inicio || 0}
      />

      <ModalGastos
        isOpen={modals.showGastos}
        onClose={() => modals.setShowGastos(false)}
        idRuta={ruta.id_ruta}
      />

      <ModalCombustible
        isOpen={modals.showCombustible}
        onClose={() => modals.setShowCombustible(false)}
        idRuta={ruta.id_ruta}
        placa={ruta.placa || ''}
      />

      {modals.showLocales && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-surface">
            <h2 className="text-lg font-black text-white italic uppercase tracking-tighter">Locales de la Ruta</h2>
            <button onClick={() => modals.setShowLocales(false)} className="p-2 text-text-muted hover:text-white">Cerrar</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <LocalList locales={locales} bitacora={bitacora} onAddPhoto={handlers.onAddPhoto} />
          </div>
        </div>
      )}

      <ImageModal
        isOpen={modals.imageModal.isOpen}
        onClose={() => modals.setImageModal({ ...modals.imageModal, isOpen: false })}
        image={modals.imageModal.image}
        title={modals.imageModal.title}
        location={modals.imageModal.location}
      />
    </div>
  );
}
