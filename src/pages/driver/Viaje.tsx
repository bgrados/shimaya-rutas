import React, { useState } from 'react';
import { useViajeIntegration } from './hooks/useViajeIntegration';
import { ActiveTripView } from './components/ActiveTripView';
import { RutaSelector } from './components/RutaSelector';
import { FinishedTripView } from './components/FinishedTripView';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { generarResumenWhatsApp } from './utils/whatsappUtils';

export default function Viaje() {
  const { profile } = useAuth();
  const {
    loading, ruta, locales, bitacora, rutasBase, loadingRutasBase,
    tramoEnProgreso, proximoDestino, proximoOrigen, actionLoading,
    gpsState, modals, state, handlers
  } = useViajeIntegration();

  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);

  const handleSendSummary = () => {
    if (!ruta) return;
    setEnviandoWhatsapp(true);
    const mensaje = generarResumenWhatsApp(ruta, bitacora);
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    setEnviandoWhatsapp(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={40} className="text-primary animate-spin" />
        <p className="text-text-muted font-bold animate-pulse">Sincronizando bitácora...</p>
      </div>
    );
  }

  // CASO 1: No hay ruta activa
  if (!ruta) {
    return (
      <RutaSelector
        loadingRutasBase={loadingRutasBase}
        rutasBase={rutasBase}
        selectedRutaBase={state.selectedRutaBase}
        setSelectedRutaBase={state.setSelectedRutaBase}
        nuevaPlaca={state.nuevaPlaca}
        handlePlacaChange={(e) => state.setNuevaPlaca(e.target.value)}
        tienePlacaAsignada={!!profile?.placa}
        createError={state.createError}
        loadError=""
        isCreating={state.isCreating}
        kmInicio={state.kmInicio}
        setKmInicio={state.setKmInicio}
        fotoKmInicio={state.fotoKmInicio}
        setFotoKmInicio={state.setFotoKmInicio}
        handleCrearRuta={handlers.onCrearRuta}
      />
    );
  }

  // CASO 2: Ruta finalizada
  if (ruta.estado === 'finalizada') {
    return (
      <div className="p-4 max-w-lg mx-auto pt-12">
        <FinishedTripView
          ruta={ruta}
          onNewTrip={() => window.location.reload()}
          onSendSummary={handleSendSummary}
          onShowCombustible={() => modals.setShowCombustible(true)}
          enviandoWhatsapp={enviandoWhatsapp}
        />
      </div>
    );
  }

  // CASO 3: Ruta activa (pendiente o en progreso)
  return (
    <ActiveTripView
      ruta={ruta}
      bitacora={bitacora}
      locales={locales}
      tramoEnProgreso={tramoEnProgreso}
      nuevoDestino={proximoDestino}
      proximoOrigen={proximoOrigen}
      actionLoading={actionLoading}
      gpsState={gpsState}
      modals={modals}
      handlers={handlers}
      state={state}
    />
  );
}