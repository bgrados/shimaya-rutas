import React from 'react';
import { MapPin, CheckCircle2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';

interface GpsMonitorProps {
  estadoGPS: string;
  distanciaAlPunto: number | null;
  estadoDetectar: string;
  tiempoValidando: number;
  signalBaja: boolean;
  mensajeGPS: string;
  gpsDebugLogs: string[];
  RADIO_BASE: number;
  RADIO_MIN: number;
  RADIO_MAX: number;
  TIEMPO_LLEGADA: number;
  TIEMPO_SALIDA: number;
  COOLDOWN_REGISTRO: number;
  ultimoRegistroTime: number;
  lecturasBuffer: any[];
  LECTURAS_PROMEDIAR: number;
  posicionPromediada: any;
  gpsError: string | null;
  mostrarBotonManual: boolean;
  onRegistrarManual: () => void;
  onLimpiarTemporizadores: () => void;
  setShowModoManual: (show: boolean) => void;
}

export function GpsMonitor({
  estadoGPS,
  distanciaAlPunto,
  estadoDetectar,
  tiempoValidando,
  signalBaja,
  mensajeGPS,
  gpsDebugLogs,
  RADIO_BASE,
  RADIO_MIN,
  RADIO_MAX,
  TIEMPO_LLEGADA,
  TIEMPO_SALIDA,
  COOLDOWN_REGISTRO,
  ultimoRegistroTime,
  lecturasBuffer,
  LECTURAS_PROMEDIAR,
  posicionPromediada,
  gpsError,
  mostrarBotonManual,
  onRegistrarManual,
  onLimpiarTemporizadores,
  setShowModoManual
}: GpsMonitorProps) {
  return (
    <Card className={`border ${signalBaja ? 'bg-red-500/20 border-red-500/50' : estadoGPS === 'en_rango' || estadoGPS === 'registrado' ? 'bg-green-500/20 border-green-500/50' : estadoGPS === 'buscando' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-light/50 border-white/10'}`}>
      <CardContent className="p-4">
        {signalBaja && (
          <div className="mb-3 bg-red-500/20 border border-red-500/50 rounded-lg p-2 flex items-center gap-2">
            <span className="text-red-400">⚠️</span>
            <span className="text-red-300 text-xs font-bold">Señal GPS baja, acércate más al punto</span>
          </div>
        )}
        {mensajeGPS && !signalBaja && estadoDetectar !== 'preguntando_detour' && (
          <div className="mb-3 bg-blue-500/20 border border-blue-500/50 rounded-lg p-2 flex items-center gap-2">
            {estadoDetectar === 'validando_llegada' && <span className="text-blue-400">📍</span>}
            {estadoDetectar === 'validando_salida' && <span className="text-orange-400">🚗</span>}
            <span className="text-blue-300 text-xs font-bold">{mensajeGPS}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${estadoGPS === 'buscando' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' : signalBaja ? 'bg-red-500/20 text-red-400' : estadoGPS === 'detectado' ? 'bg-blue-500/20 text-blue-400' : estadoGPS === 'en_rango' ? 'bg-green-500/20 text-green-400' : estadoGPS === 'registrado' ? 'bg-green-600/40 text-green-300' : 'bg-gray-500/20 text-gray-400'}`}>
              {estadoGPS === 'buscando' ? <MapPin size={20} className="animate-bounce" /> : signalBaja ? <MapPin size={20} /> : estadoGPS === 'detectado' ? <MapPin size={20} /> : estadoGPS === 'en_rango' ? <CheckCircle2 size={20} /> : estadoGPS === 'registrado' ? <CheckCircle2 size={20} /> : <MapPin size={20} />}
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase font-bold tracking-wider">
                {estadoGPS === 'buscando' && '🔍 Buscando señal...'}
                {estadoGPS === 'detectado' && '📍 Ubicación detectada'}
                {estadoGPS === 'en_rango' && (estadoDetectar === 'validando_llegada' ? `⏳ Validando LLEGADA (${Math.round(tiempoValidando / 1000)}s/12s)` : estadoDetectar === 'validando_salida' ? `⏳ Validando SALIDA (${Math.round(tiempoValidando / 1000)}s/6s)` : `✅ Dentro del radio`)}
                {estadoGPS === 'registrado' && '✅ Registro completado'}
              </p>
              <p className={`text-sm font-black ${signalBaja ? 'text-red-400' : estadoGPS === 'en_rango' || estadoGPS === 'registrado' ? 'text-green-400' : 'text-white'}`}>
                {distanciaAlPunto !== null ? `${distanciaAlPunto.toFixed(0)}m ${distanciaAlPunto <= RADIO_BASE ? 'dentro' : 'fuera'}` : 'Obteniendo ubicación...'}
              </p>
              {(estadoDetectar === 'validando_llegada' || estadoDetectar === 'validando_salida') && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${estadoDetectar === 'validando_llegada' ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(100, Math.round((tiempoValidando / (estadoDetectar === 'validando_llegada' ? TIEMPO_LLEGADA : TIEMPO_SALIDA)) * 100))}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-muted uppercase">Cooldown</p>
            <p className="text-xs font-black text-primary">{Math.max(0, Math.ceil((COOLDOWN_REGISTRO - (Date.now() - ultimoRegistroTime)) / 1000))}s</p>
          </div>
        </div>
        {mostrarBotonManual && (
          <div className="mt-3">
            <Button onClick={() => { onRegistrarManual(); onLimpiarTemporizadores(); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2">📝 Registrar manualmente</Button>
          </div>
        )}
        <div className="mt-3 flex gap-2 text-[10px] flex-wrap">
          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Radio: {RADIO_MIN}-{RADIO_MAX}m</span>
          <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded">Buffer: {lecturasBuffer.length}/{LECTURAS_PROMEDIAR}</span>
          {gpsError && <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">Error: {gpsError}</span>}
        </div>
        {gpsDebugLogs.length > 0 && (
          <details className="mt-3">
            <summary className="text-[10px] text-text-muted cursor-pointer hover:text-white">🔧 Debug GPS ({gpsDebugLogs.length})</summary>
            <div className="mt-2 bg-black/30 rounded-lg p-2 text-[9px] font-mono text-text-muted max-h-32 overflow-y-auto">{gpsDebugLogs.map((log, i) => (<div key={i} className="py-0.5">{log}</div>))}</div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
