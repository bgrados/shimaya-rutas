import { useState, useRef, useEffect, useCallback } from 'react';
import type { LocalRuta, ViajeBitacora } from '../../../../types';

interface GpsOptions {
  RADIO_BASE: number;
  RADIO_MIN: number;
  RADIO_MAX: number;
  TIEMPO_LLEGADA: number;
  TIEMPO_SALIDA: number;
  COOLDOWN_REGISTRO: number;
  LECTURAS_PROMEDIAR: number;
}

const DEFAULT_OPTIONS: GpsOptions = {
  RADIO_BASE: 150,
  RADIO_MIN: 100,
  RADIO_MAX: 200,
  TIEMPO_LLEGADA: 12000,
  TIEMPO_SALIDA: 6000,
  COOLDOWN_REGISTRO: 18000,
  LECTURAS_PROMEDIAR: 5
};

export function useGpsTracking(
  bitacora: ViajeBitacora[],
  locales: LocalRuta[],
  onRegistrarLlegada: (idBitacora: string) => Promise<void>,
  onRegistrarSalida: (idBitacora: string) => Promise<void>,
  onPreguntarDetour: (local: LocalRuta) => void
) {
  const [gpsPosicionActual, setGpsPosicionActual] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaAlPunto, setDistanciaAlPunto] = useState<number | null>(null);
  const [estadoGPS, setEstadoGPS] = useState<'buscando' | 'detectado' | 'en_rango' | 'registrado'>('buscando');
  const [mensajeGPS, setMensajeGPS] = useState('');
  const [estadoDetectar, setEstadoDetectar] = useState<'idle' | 'validando_llegada' | 'validando_salida' | 'preguntando_detour'>('idle');
  const [tiempoValidando, setTiempoValidando] = useState(0);
  const [signalBaja, setSignalBaja] = useState(false);
  const [gpsDebugLogs, setGpsDebugLogs] = useState<string[]>([]);
  
  const watchIdRef = useRef<number | null>(null);
  const timerValidacionRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoRegistroTimeRef = useRef<number>(0);
  const lecturasBufferRef = useRef<{ lat: number; lng: number; accuracy: number; timestamp: number }[]>([]);

  const agregarLogDebug = useCallback((mensaje: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${mensaje}`;
    setGpsDebugLogs(prev => [...prev.slice(-9), log]);
  }, []);

  const calcularDistanciaHaversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRadioDinamico = (accuracy: number) => {
    if (accuracy < 30) return DEFAULT_OPTIONS.RADIO_MIN;
    if (accuracy < 80) return DEFAULT_OPTIONS.RADIO_BASE;
    return DEFAULT_OPTIONS.RADIO_MAX;
  };

  const iniciarTemporizadorValidacion = useCallback((tipo: 'llegada' | 'salida', onComplete: () => void) => {
    if (timerValidacionRef.current) clearInterval(timerValidacionRef.current);
    
    const tiempoTotal = tipo === 'llegada' ? DEFAULT_OPTIONS.TIEMPO_LLEGADA : DEFAULT_OPTIONS.TIEMPO_SALIDA;
    setTiempoValidando(0);
    setEstadoDetectar(tipo === 'llegada' ? 'validando_llegada' : 'validando_salida');
    
    timerValidacionRef.current = setInterval(() => {
      setTiempoValidando(prev => {
        const nuevo = prev + 1000;
        if (nuevo >= tiempoTotal) {
          clearInterval(timerValidacionRef.current!);
          timerValidacionRef.current = null;
          setEstadoDetectar('idle');
          onComplete();
        }
        return nuevo;
      });
    }, 1000);
  }, []);

  const limpiarTemporizadores = useCallback(() => {
    if (timerValidacionRef.current) {
      clearInterval(timerValidacionRef.current);
      timerValidacionRef.current = null;
    }
    setTiempoValidando(0);
    setEstadoDetectar('idle');
  }, []);

  const detenerWatchPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    agregarLogDebug('🛑 GPS detenido');
  }, [agregarLogDebug]);

  const getAccuracyRating = (accuracy: number) => {
    if (accuracy < 15) return 'alta';
    if (accuracy < 40) return 'media';
    return 'baja';
  };

  const iniciarGPSConPermisos = async (): Promise<{ lat: number, lng: number, accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          resolve({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const iniciarWatchPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    detenerWatchPosition();
    
    agregarLogDebug('🛰️ Iniciando GPS...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        setGpsPosicionActual({ lat, lng });
        
        const rating = getAccuracyRating(accuracy);
        setSignalBaja(rating === 'baja');
        
        // ... Logic for detection (full version from original)
      },
      (error) => {
        agregarLogDebug(`❌ Error GPS: ${error.message}`);
        setEstadoGPS('buscando');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, [detenerWatchPosition, agregarLogDebug]);

  useEffect(() => {
    return () => detenerWatchPosition();
  }, [detenerWatchPosition]);

  return {
    gpsPosicionActual,
    distanciaAlPunto,
    estadoGPS,
    mensajeGPS,
    estadoDetectar,
    tiempoValidando,
    signalBaja,
    gpsDebugLogs,
    iniciarWatchPosition,
    detenerWatchPosition
  };
}
