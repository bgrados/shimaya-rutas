import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase';
import type { Ruta, LocalRuta, ViajeBitacora, GuiaRemision } from '../../types';
import RegistrarCombustible from './combustible/Registrar';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModalEvidencia } from './viaje/components/ModalEvidencia';
import { TramoBitacora } from './viaje/components/TramoBitacora';
import { RutaSelector } from './viaje/components/RutaSelector';
import { BitacoraList } from './viaje/components/BitacoraList';
import { LocalList } from './viaje/components/LocalList';
import { formatPeru, nowPeru } from '../../lib/timezone';
import { RefreshCw, MapPinOff, Wifi, WifiOff, Coffee, Phone } from 'lucide-react';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Truck, 
  PlusCircle,
  ChevronDown,
  Flag,
  Play,
  Timer,
  Fuel,
  Edit2,
  X,
  Check,
  Camera,
  Image,
  ListTodo,
  Navigation,
  MessageCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search
} from 'lucide-react';

export default function DriverViaje() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [locales, setLocales] = useState<LocalRuta[]>([]);
  const [bitacora, setBitacora] = useState<ViajeBitacora[]>([]);
  
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Selection/Creation state
  const [rutasBase, setRutasBase] = useState<any[]>([]);
  const [loadingRutasBase, setLoadingRutasBase] = useState(true); // true inicialmente para evitar flash
  const [rutasBaseLoaded, setRutasBaseLoaded] = useState(false); // Flag para evitar recargas duplicadas
  const [loadedAtLeastOnce, setLoadedAtLeastOnce] = useState(false); // Track si ya intentamos cargar
  const [selectedRutaBase, setSelectedRutaBase] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState(profile?.placa_camion || '');
  const [createError, setCreateError] = useState('');
  const [kmInicio, setKmInicio] = useState('');
  const [kmFin, setKmFin] = useState('');
  const [fotoKmInicio, setFotoKmInicio] = useState<string | null>(null);
  const [fotoKmFin, setFotoKmFin] = useState<string | null>(null);
  const [showFinalKmModal, setShowFinalKmModal] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Si el perfil ya tiene placa, usarla por defecto y deshabilitar edición
  const tienePlacaAsignada = !!(profile?.placa_camion);

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 3) {
      val = val.substring(0, 3) + '-' + val.substring(3, 6);
    }
    setNuevaPlaca(val);
  };

  const [nuevoDestino, setNuevoDestino] = useState('');
  const [showCombustible, setShowCombustible] = useState(false);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  
  // Estado para GPS y modo manual
  const [gpsDisponible, setGpsDisponible] = useState<boolean | null>(null);
  const [gpsVerificando, setGpsVerificando] = useState(false);
  const [showModoManual, setShowModoManual] = useState(false);
  
  // Estado para capturar fotos de evidencia
  const [localParaFoto, setLocalParaFoto] = useState<LocalRuta | null>(null);

  const [editandoBitacora, setEditandoBitacora] = useState<string | null>(null);
  const [editHoraSalida, setEditHoraSalida] = useState('');
  const [editHoraLlegada, setEditHoraLlegada] = useState('');
  const [isEditingKmInicio, setIsEditingKmInicio] = useState(false);
  const [tempKmInicio, setTempKmInicio] = useState('');

  // Estado para volver a local anterior
  const [mostrarLocalesVisitados, setMostrarLocalesVisitados] = useState(false);
  const [showResumenRuta, setShowResumenRuta] = useState(false);
  const [esHistorial, setEsHistorial] = useState(false);

  // Estados para detección automática de llegada por GPS
  const [gpsPosicionActual, setGpsPosicionActual] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaAlPunto, setDistanciaAlPunto] = useState<number | null>(null);
  const [llegadaDetectada, setLlegadaDetectada] = useState(false);
  const [gpsDebugLogs, setGpsDebugLogs] = useState<string[]>([]);
  const watchIdRef = useRef<number | null>(null);
  
  // Verificar día de descanso al inicio
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaHoy = diasSemana[new Date().getDay()];
  const esDiaDescanso = profile?.dias_descanso?.includes(diaHoy);
  const [diaDescansoBloqueado, setDiaDescansoBloqueado] = useState(false);

  // Constantes de configuración GPS - Sistema robusto MEJORADO v2
  const RADIO_BASE = 150; // Radio base de detección (aumentado de 100)
  const RADIO_MIN = 100; // Radio mínimo (aumentado de 60)
  const RADIO_MAX = 200; // Radio máximo (aumentado de 150)
  const LECTURAS_PROMEDIAR = 5; // Cantidad de lecturas para promediar
  const LECTURAS_REQUERIDAS = 3; // Lecturas mínimas para el sistema avanzado
  const TIEMPO_LLEGADA = 12000; // Tiempo requerido dentro del radio (ms) - 12 segundos
  const TIEMPO_SALIDA = 6000; // Tiempo requerido fuera del radio (ms) - 6 segundos
  const COOLDOWN_REGISTRO = 18000; // 18 segundos entre registros
  const STABILIDAD_ACEPTABLE = 50; // metros de variación máxima para considerar estable
  const ALERTA_PRECISION = 100; // Umbral para mostrar alerta de señal baja
  const TIEMPO_BOTON_MANUAL = 25000; // Mostrar botón manual después de 25s
  const GPS_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 20000
  };

  // Estado para sistema avanzado de GPS v2
  const [LecturasGPS, setLecturasGPS] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number }[]>([]);
  const [tiempoEnRango, setTiempoEnRango] = useState<number>(0);
  const [ultimoRegistroTime, setUltimoRegistroTime] = useState<number>(0);
  const [estadoGPS, setEstadoGPS] = useState<'buscando' | 'detectado' | 'en_rango' | 'registrado'>('buscando');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [intentosLectura, setIntentosLectura] = useState(0);
  const timerPermanenciaRef = useRef<NodeJS.Timeout | null>(null);
  const lecturasTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Nuevos estados para GPS v2 con promediado
  const [lecturasBuffer, setLecturasBuffer] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number }[]>([]);
  const [posicionPromediada, setPosicionPromediada] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [estadoDetectar, setEstadoDetectar] = useState<'idle' | 'validando_llegada' | 'validando_salida'>('idle');
  const [mensajeGPS, setMensajeGPS] = useState<string>('');
  const [mostrarBotonManual, setMostrarBotonManual] = useState<boolean>(false);
  const [tiempoValidando, setTiempoValidando] = useState<number>(0);
  const [signalBaja, setSignalBaja] = useState<boolean>(false);
  const timerValidacionRef = useRef<NodeJS.Timeout | null>(null);
  const timerSignalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para calcular radio dinámico según precisión
  const getRadioDinamico = (accuracy: number): number => {
    if (accuracy < 30) return RADIO_MIN;
    if (accuracy < 80) return RADIO_BASE;
    return RADIO_MAX;
  };

  // Función para promediar lecturas GPS
  const promediarLecturas = (lecturas: { lat: number; lng: number; accuracy: number }[]): { lat: number; lng: number; accuracy: number } | null => {
    if (lecturas.length === 0) return null;
    
    // Filtrar lecturas inconsistentes (más de 50m de diferencia)
    const lats = lecturas.map(l => l.lat);
    const lngs = lecturas.map(l => l.lng);
    const latProm = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lngProm = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    
    // Verificar consistencia
    const consistente = lecturas.every(l => {
      const dist = calcularDistanciaHaversine(latProm, lngProm, l.lat, l.lng);
      return dist < 50;
    });
    
    if (!consistente) {
      agregarLogDebug('⚠️ Lecturas inconsistentes - reiniciando');
      return null;
    }
    
    const accuracyProm = lecturas.reduce((a, b) => a + b.accuracy, 0) / lecturas.length;
    return { lat: latProm, lng: lngProm, accuracy: accuracyProm };
  };

  // Función para iniciar GPS avançado com promedio de lecturas
  const obtenerGPSAvanzado = async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsError('GPS no soportado');
        resolve(null);
        return;
      }

      const lecturas: { lat: number; lng: number; accuracy: number; timestamp: number }[] = [];
      setIntentosLectura(0);
      agregarLogDebug(`📡 Iniciando ${LECTURAS_REQUERIDAS} lecturas GPS...`);

      const timeoutTotal = setTimeout(() => {
        const promedio = promediarLecturas(lecturas);
        if (promedio) {
          agregarLogDebug(`✅ GPS promediado: ${promedio.lat.toFixed(5)},${promedio.lng.toFixed(5)} (±${promedio.accuracy.toFixed(0)}m)`);
          resolve(promedio);
        } else {
          setGpsError('Sin lectura consistente');
          resolve(null);
        }
      }, 12000);

      const hacerLectura = (intento: number) => {
        if (intento >= LECTURAS_REQUERIDAS) {
          clearTimeout(timeoutTotal);
          const promedio = promediarLecturas(lecturas);
          if (promedio) {
            agregarLogDebug(`✅ GPS promediado: ${promedio.lat.toFixed(5)},${promedio.lng.toFixed(5)} (±${promedio.accuracy.toFixed(0)}m)`);
            resolve(promedio);
          } else {
            setGpsError('Sin lectura consistente');
            resolve(null);
          }
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            lecturas.push({ lat, lng, accuracy, timestamp: Date.now() });
            setIntentosLectura(intento + 1);
            agregarLogDebug(`📍 Lectura ${intento + 1}/${LECTURAS_REQUERIDAS}: ±${accuracy.toFixed(0)}m`);
            
            // Siguiente lectura después de 1 segundo
            setTimeout(() => hacerLectura(intento + 1), 1000);
          },
          (error) => {
            agregarLogDebug(`❌ Error lectura ${intento + 1}: ${error.message}`);
            setTimeout(() => hacerLectura(intento + 1), 500);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      };

      hacerLectura(0);
    });
  };

  // Función para verificar permisos de geolocalización
  const verificarPermisosGPS = async (): Promise<{ granted: boolean; state: string }> => {
    if (!navigator.geolocation || !navigator.permissions) {
      return { granted: true, state: 'prompt' };
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return { granted: result.state === 'granted', state: result.state };
    } catch {
      return { granted: true, state: 'prompt' };
    }
  };

  // Función para iniciar GPS avanzado (usar sistema promediado)
  const iniciarGPSConPermisos = async (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    const result = await obtenerGPSAvanzado();
    if (result) {
      setGpsPosicionActual({ lat: result.lat, lng: result.lng });
    }
    return result;
  };

  // Función para verificar cooldown de registro
  const puedeRegistrar = (): boolean => {
    const tiempoDesdeUltimo = Date.now() - ultimoRegistroTime;
    if (tiempoDesdeUltimo < COOLDOWN_REGISTRO) {
      const segundosRestantes = Math.ceil((COOLDOWN_REGISTRO - tiempoDesdeUltimo) / 1000);
      agregarLogDebug(`⏳ Cooldown activo: ${segundosRestantes}s`);
      return false;
    }
    return true;
  };

  // Función para calcular distancia Haversine entre dos puntos
  const calcularDistanciaHaversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en metros
  };

  // Función para agregar logs de debug
  const agregarLogDebug = (mensaje: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${mensaje}`;
    setGpsDebugLogs(prev => [...prev.slice(-9), log]); // Mantener últimos 10 logs
  };

  // Función para promediar lecturas GPS con filtro de consistencia
  const promediarLecturasConsistentes = (lecturas: { lat: number; lng: number; accuracy: number }[]): { lat: number; lng: number; accuracy: number } | null => {
    if (lecturas.length < LECTURAS_PROMEDIAR) return null;
    
    // Filtrar lecturas inconsistentes (más de 50m de diferencia entre lecturas)
    const lats = lecturas.map(l => l.lat);
    const lngs = lecturas.map(l => l.lng);
    const latProm = lats.reduce((a, b) => a + b, 0) / lats.length;
    const lngProm = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    
    // Verificar consistencia
    const consistente = lecturas.every(l => {
      const dist = calcularDistanciaHaversine(latProm, lngProm, l.lat, l.lng);
      return dist < STABILIDAD_ACEPTABLE;
    });
    
    if (!consistente) {
      agregarLogDebug('⚠️ Lecturas inconsistentes - ignorando');
      return null;
    }
    
    const accuracyProm = lecturas.reduce((a, b) => a + b.accuracy, 0) / lecturas.length;
    return { lat: latProm, lng: lngProm, accuracy: accuracyProm };
  };

  // Función para procesar lectura con buffer y promediado
  const procesarLecturaConPromedio = (lat: number, lng: number, accuracy: number): { lat: number; lng: number; accuracy: number } | null => {
    const timestamp = Date.now();
    
    // Agregar al buffer
    const nuevaLectura = { lat, lng, accuracy, timestamp };
    setLecturasBuffer(prev => {
      const nuevoBuffer = [...prev, nuevaLectura];
      // Mantener solo las últimas 5 lecturas
      if (nuevoBuffer.length > LECTURAS_PROMEDIAR) {
        return nuevoBuffer.slice(-LECTURAS_PROMEDIAR);
      }
      return nuevoBuffer;
    });
    
    // Verificar si tenemos suficientes lecturas
    if (lecturasBuffer.length >= LECTURAS_PROMEDIAR - 1) {
      // Usar lecturas actuales del buffer más la nueva
      const bufferActual = [...lecturasBuffer, nuevaLectura].slice(-LECTURAS_PROMEDIAR);
      const promedio = promediarLecturasConsistentes(bufferActual);
      
      if (promedio) {
        agregarLogDebug(`📊 Promedio GPS: ${promedio.lat.toFixed(5)}, ${promedio.lng.toFixed(5)} (±${promedio.accuracy.toFixed(0)}m) [${bufferActual.length}/${LECTURAS_PROMEDIAR}]`);
        setPosicionPromediada(promedio);
        return promedio;
      }
    }
    
    agregarLogDebug(`📡 Lectura ${lecturasBuffer.length + 1}/${LECTURAS_PROMEDIAR}: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy.toFixed(0)}m)`);
    return null;
  };

  // Función para iniciar temporizador de validación
  const iniciarTemporizadorValidacion = (tipo: 'llegada' | 'salida', onComplete: () => void) => {
    // Limpiar timer anterior
    if (timerValidacionRef.current) {
      clearInterval(timerValidacionRef.current);
    }
    
    const tiempoTotal = tipo === 'llegada' ? TIEMPO_LLEGADA : TIEMPO_SALIDA;
    setTiempoValidando(0);
    setEstadoDetectar(tipo === 'llegada' ? 'validando_llegada' : 'validando_salida');
    setMensajeGPS(tipo === 'llegada' ? 'Validando llegada...' : 'Validando salida...');
    setMostrarBotonManual(false);
    
    // Timer para mostrar botón manual después de 25s
    if (timerSignalRef.current) clearTimeout(timerSignalRef.current);
    timerSignalRef.current = setTimeout(() => {
      setMostrarBotonManual(true);
      setMensajeGPS('GPS inestable, puedes registrar manualmente');
    }, TIEMPO_BOTON_MANUAL);
    
    timerValidacionRef.current = setInterval(() => {
      setTiempoValidando(prev => {
        const nuevoTiempo = prev + 1000;
        
        if (nuevoTiempo >= tiempoTotal) {
          // Tiempo completado - ejecutar callback
          if (timerValidacionRef.current) {
            clearInterval(timerValidacionRef.current);
            timerValidacionRef.current = null;
          }
          setEstadoDetectar('idle');
          setMensajeGPS('');
          onComplete();
        }
        
        return nuevoTiempo;
      });
    }, 1000);
  };

  // Función para limpiar timers de validación
  const limpiarTemporizadoresValidacion = () => {
    if (timerValidacionRef.current) {
      clearInterval(timerValidacionRef.current);
      timerValidacionRef.current = null;
    }
    if (timerSignalRef.current) {
      clearTimeout(timerSignalRef.current);
      timerSignalRef.current = null;
    }
    setTiempoValidando(0);
    setEstadoDetectar('idle');
    setMensajeGPS('');
    setMostrarBotonManual(false);
  };

  // Iniciar watchPosition para detección continua de GPS
  const iniciarWatchPosition = async () => {
    if (!navigator.geolocation) {
      agregarLogDebug('❌ Geolocalización no disponible');
      setGpsDisponible(false);
      return;
    }

    // Verificar permisos primero
    const permisos = await verificarPermisosGPS();
    if (!permisos.granted) {
      agregarLogDebug('⚠️ Permisos denegados. Usa registro manual.');
      setGpsDisponible(false);
      return;
    }

    // Detener watch anterior si existe
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    agregarLogDebug('🚀 Iniciando watchPosition v2 con promediado...');
    setEstadoGPS('buscando');
    limpiarTemporizadoresValidacion();
    setLecturasBuffer([]);

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        setGpsPosicionActual({ lat, lng });
        
        // Detectar señal baja
        if (accuracy > ALERTA_PRECISION) {
          setSignalBaja(true);
          setMensajeGPS(`⚠️ Señal GPS baja (${accuracy.toFixed(0)}m), acércate más al punto`);
        } else {
          setSignalBaja(false);
          if (!mensajeGPS.includes('inestable')) {
            setMensajeGPS('');
          }
        }
        
        // Obtener local actual
        const bitacoraActual = bitacora.length > 0 ? bitacora[bitacora.length - 1] : null;
        const localPendiente = locales.find(l => !l.hora_llegada && l.latitud && l.longitud);
        const localActual = localPendiente || (bitacoraActual ? locales.find(l => l.id_local === bitacoraActual?.id_local) : null);
        
        if (!localActual?.latitud || !localActual?.longitud) {
          setDistanciaAlPunto(null);
          setEstadoGPS('buscando');
          limpiarTemporizadoresValidacion();
          agregarLogDebug(`❓ Sin local pendiente para detectar`);
          return;
        }
        
        const radioBase = getRadioDinamico(accuracy);
        
        // Ignorar lecturas con precisión muy mala (>150m)
        if (accuracy > 150) {
          agregarLogDebug(`⚠️ GPS muy impreciso: ${accuracy.toFixed(0)}m - ignorando`);
          setEstadoGPS('buscando');
          return;
        }

        // Procesar lectura con buffer y promediado
        const promedio = procesarLecturaConPromedio(lat, lng, accuracy);
        
        // Usar promedio si existe, si no usar lectura actual
        const latUsar = promedio?.lat || lat;
        const lngUsar = promedio?.lng || lng;
        const accuracyUsar = promedio?.accuracy || accuracy;
        
        // Calcular distancia
        const distancia = calcularDistanciaHaversine(latUsar, lngUsar, localActual.latitud, localActual.longitud);
        setDistanciaAlPunto(distancia);
        
        const dentroDelRadio = distancia <= radioBase;
        const necesitaLlegada = bitacoraActual && !bitacoraActual.hora_llegada;
        const necesitaSalida = bitacoraActual && bitacoraActual.hora_llegada && !bitacoraActual.hora_salida;
        
        // Logging
        if (promedio) {
          agregarLogDebug(`📊 Promediado: ${distancia.toFixed(0)}m (radio: ${radioBase}m) | L:${necesitaLlegada ? 'SI' : 'NO'} S:${necesitaSalida ? 'SI' : 'NO'}`);
        }
        
        // Verificar cooldown
        if (!puedeRegistrar()) {
          setEstadoGPS('buscando');
          agregarLogDebug(`⏳ Cooldown activo - esperando`);
          return;
        }
        
        setEstadoGPS(dentroDelRadio ? 'en_rango' : 'detectado');
        
        // LÓGICA DE DETECCIÓN DE LLEGADA
        if (dentroDelRadio && necesitaLlegada) {
          if (estadoDetectar !== 'validando_llegada') {
            agregarLogDebug(`✅ DENTRO DEL RADIO - iniciando validación de LLEGADA (${distancia.toFixed(0)}m)`);
            iniciarTemporizadorValidacion('llegada', () => {
              if (bitacoraActual && !bitacoraActual.hora_llegada) {
                agregarLogDebug(`⏱️ 12s completado - REGISTRANDO LLEGADA!`);
                setLlegadaDetectada(true);
                setUltimoRegistroTime(Date.now());
                handleRegistrarLlegada(bitacoraActual.id_bitacora);
                // NO detener watch - mantener activo para detectar salida
              }
            });
          }
        }
        
        // LÓGICA DE DETECCIÓN DE SALIDA
        else if (!dentroDelRadio && necesitaSalida) {
          if (estadoDetectar !== 'validando_salida') {
            agregarLogDebug(`⭕ FUERA DEL RADIO - iniciando validación de SALIDA (${distancia.toFixed(0)}m)`);
            iniciarTemporizadorValidacion('salida', () => {
              if (bitacoraActual && bitacoraActual.hora_llegada && !bitacoraActual.hora_salida) {
                agregarLogDebug(`⏱️ 6s fuera - REGISTRANDO SALIDA!`);
                setUltimoRegistroTime(Date.now());
                handleRegistrarSalidaAutomatica(bitacoraActual.id_bitacora);
              }
            });
          }
        }
        
        // RESETEAR VALIDACIÓN SI SE SALE DEL RANGO
        else if (!dentroDelRadio && estadoDetectar === 'validando_llegada') {
          agregarLogDebug(`⚠️ SALISTE DEL RADIO - reiniciando validación de llegada`);
          limpiarTemporizadoresValidacion();
        }
        else if (dentroDelRadio && estadoDetectar === 'validando_salida') {
          agregarLogDebug(`⚠️ REGRESASTE AL RADIO - reiniciando validación de salida`);
          limpiarTemporizadoresValidacion();
        }
        
        // Resetear si cambia el estado de validación
        else if (!necesitaLlegada && !necesitaSalida) {
          if (estadoDetectar !== 'idle') {
            limpiarTemporizadoresValidacion();
            setLecturasBuffer([]);
          }
        }
        
        // Mostrar estado actual
        if (estadoDetectar === 'validando_llegada') {
          const progreso = Math.min(100, Math.round((tiempoValidando / TIEMPO_LLEGADA) * 100));
          agregarLogDebug(`⏳ Validando LLEGADA: ${progreso}% (${Math.round(tiempoValidando/1000)}s/12s) - ${distancia.toFixed(0)}m`);
        } else if (estadoDetectar === 'validando_salida') {
          const progreso = Math.min(100, Math.round((tiempoValidando / TIEMPO_SALIDA) * 100));
          agregarLogDebug(`⏳ Validando SALIDA: ${progreso}% (${Math.round(tiempoValidando/1000)}s/6s) - ${distancia.toFixed(0)}m`);
        }
      },
      (error) => {
        let msg = 'Error GPS';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = '❌Permisos negados';
            setGpsDisponible(false);
            setGpsError('Permisos denegados');
            break;
          case error.POSITION_UNAVAILABLE:
            msg = '⚠️Sin señal GPS';
            setGpsError('Sin señal');
            break;
          case error.TIMEOUT:
            msg = '⏱️Timeout GPS';
            break;
        }
        agregarLogDebug(msg + ` (${error.message})`);
        setEstadoGPS('buscando');
      },
      options
    );
  };

  // Detener watchPosition y limpiar timers
  const detenerWatchPosition = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerPermanenciaRef.current) {
      clearInterval(timerPermanenciaRef.current);
      timerPermanenciaRef.current = null;
    }
    agregarLogDebug('🛑 GPS detenido');
  };

// useEffect para verificar día de descanso al montar
  useEffect(() => {
    if (esDiaDescanso) {
      setDiaDescansoBloqueado(true);
      showToast('Hoy es tu día de descanso. No puedes iniciar rutas.', 'warning');
    }
  }, []);

  // useEffect para verificar permisos GPS al montar
  useEffect(() => {
    async function verificarAlIniciar() {
      if (!navigator.geolocation) {
        agregarLogDebug('❌ GPS no soportado en este dispositivo');
        setGpsDisponible(false);
        return;
      }
      
      // Intentar obtener posición inicial
      const pos = await iniciarGPSConPermisos();
      if (pos) {
        agregarLogDebug('✅ GPS inicializado correctamente');
        setGpsDisponible(true);
      }
    }
    
    verificarAlIniciar();
  }, []);

  // useEffect para iniciar/detener watchPosition según el estado de la ruta
  useEffect(() => {
    // Solo iniciar watch si hay una ruta en progreso y locales pendientes
    if (ruta && ruta.estado === 'en_progreso' && !esHistorial && !llegadaDetectada && gpsDisponible) {
      iniciarWatchPosition();
    } else {
      detenerWatchPosition();
    }

    // Cleanup al desmontar
    return () => {
      detenerWatchPosition();
    };
  }, [ruta?.id_ruta, ruta?.estado, esHistorial, llegadaDetectada, gpsDisponible]);

  // Reiniciar detección cuando cambia la bitácora (nuevo tramo iniciado)
  useEffect(() => {
    if (bitacora.length > 0) {
      setLlegadaDetectada(false);
      agregarLogDebug('🔄 Nuevo tramo iniciado, reseteando detección de llegada');
    }
  }, [bitacora.length]);

  const loadViajeData = async (idRuta: string) => {
    const { data: localesData } = await supabase
      .from('locales_ruta')
      .select('*')
      .eq('id_ruta', idRuta)
      .order('orden', { ascending: true });
    if (localesData) setLocales(localesData as LocalRuta[]);

    const { data: bitacoraData } = await supabase
      .from('viajes_bitacora')
      .select('*')
      .eq('id_ruta', idRuta)
      .order('created_at', { ascending: true });
    setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
  };

  const iniciarNuevoViaje = () => {
    if (esHistorial) {
      navigate('/driver/viaje');
    } else {
      setRuta(null);
      setLocales([]);
      setBitacora([]);
      setEsHistorial(false);
      loadRutasBase();
    }
  };

  const handleEditarHora = (tramo: ViajeBitacora) => {
    setEditandoBitacora(tramo.id_bitacora);
    setEditHoraSalida(tramo.hora_salida ? formatoHoraInput(new Date(tramo.hora_salida)) : '');
    setEditHoraLlegada(tramo.hora_llegada ? formatoHoraInput(new Date(tramo.hora_llegada)) : '');
  };

  const formatoHoraInput = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const guardarEdicionHora = async (tramo: ViajeBitacora) => {
    if (!editHoraSalida) return;
    
    const [hS, mS] = editHoraSalida.split(':').map(Number);
    const fechaBase = new Date(tramo.hora_salida);
    const nuevaSalida = new Date(fechaBase);
    nuevaSalida.setHours(hS, mS, 0, 0);

    let nuevaLlegada: Date | null = null;
    if (editHoraLlegada && editHoraLlegada !== '') {
      const [hL, mL] = editHoraLlegada.split(':').map(Number);
      const fechaBaseL = new Date(tramo.hora_llegada || tramo.hora_salida);
      nuevaLlegada = new Date(fechaBaseL);
      nuevaLlegada.setHours(hL, mL, 0, 0);
    }

    if (nuevaLlegada && nuevaLlegada <= nuevaSalida) {
      showToast('error', 'La hora de llegada no puede ser anterior a la hora de salida');
      return;
    }

    // Validar que no sea antes que la llegada del tramo anterior
    const idxActual = bitacora.findIndex(b => b.id_bitacora === tramo.id_bitacora);
    if (idxActual > 0) {
      const tramoAnterior = bitacora[idxActual - 1];
      if (tramoAnterior.hora_llegada && nuevaSalida < new Date(tramoAnterior.hora_llegada)) {
        showToast('error', 'La hora de salida no puede ser anterior a la llegada del tramo anterior');
        return;
      }
    }

    const updates: Partial<ViajeBitacora> = { hora_salida: nuevaSalida.toISOString() };
    if (nuevaLlegada) {
      updates.hora_llegada = nuevaLlegada.toISOString();
    }

    await supabase.from('viajes_bitacora').update(updates).eq('id_bitacora', tramo.id_bitacora);
    
    // Ajustar horas de tramos siguientes si es necesario
    let bitacoraActualizada = bitacora.map(b => 
      b.id_bitacora === tramo.id_bitacora 
        ? { ...b, ...updates } 
        : b
    );

    // Si se editó la llegada, ajustar la salida del siguiente tramo
    if (nuevaLlegada && idxActual < bitacoraActualizada.length - 1) {
      const siguienteTramo = bitacoraActualizada[idxActual + 1];
      const horaSalidaSiguiente = new Date(siguienteTramo.hora_salida);
      if (nuevaLlegada > horaSalidaSiguiente) {
        // Ajustar salida del siguiente para que sea igual o después de la llegada
        const nuevaSalidaSiguiente = new Date(nuevaLlegada);
        await supabase.from('viajes_bitacora').update({ hora_salida: nuevaSalidaSiguiente.toISOString() }).eq('id_bitacora', siguienteTramo.id_bitacora);
        bitacoraActualizada = bitacoraActualizada.map(b => 
          b.id_bitacora === siguienteTramo.id_bitacora 
            ? { ...b, hora_salida: nuevaSalidaSiguiente.toISOString() } 
            : b
        );
      }
    }

    setBitacora(bitacoraActualizada);
    setEditandoBitacora(null);
  };

  const fetchLocalesWithGuias = async (rutaId: string) => {
    const { data: localesData, error: locError } = await supabase
      .from('locales_ruta')
      .select('*')
      .eq('id_ruta', rutaId)
      .order('orden', { ascending: true });
    
    if (locError) {
      console.error('Error loading locales_ruta:', locError);
      return [];
    }

    const localeIds = localesData?.map(l => l.id_local_ruta) || [];
    
    // Fetch attached guides
    const { data: guiasData } = await supabase
      .from('guias_remision')
      .select('*')
      .in('id_local_ruta', localeIds);

    return (localesData || []).map(l => ({
      ...l,
      guias: (guiasData || []).filter((g: any) => g.id_local_ruta === l.id_local_ruta)
    })) as LocalRuta[];
  };

  const loadCurrentRuta = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Verificar si hay un ID de ruta histórico en la URL
    const pathParts = window.location.pathname.split('/historial/');
    
    try {
      // Si hay ID en URL, cargar esa ruta específica
      if (pathParts.length > 1) {
        const rutaIdFromUrl = pathParts[1];
        const { data: rutaHistorica, error: rhError } = await supabase
          .from('rutas')
          .select('*')
          .eq('id_ruta', rutaIdFromUrl)
          .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
          .maybeSingle();
        
        if (rhError) console.error('Error loading ruta histórica:', rhError);
        
        if (rutaHistorica) {
          setRuta(rutaHistorica as Ruta);
          setEsHistorial(true);
          
          const localesData = await fetchLocalesWithGuias(rutaHistorica.id_ruta);
          setLocales(localesData);

          const { data: bitacoraData, error: bitError } = await supabase
            .from('viajes_bitacora')
            .select('*')
            .eq('id_ruta', rutaHistorica.id_ruta)
            .order('created_at', { ascending: true });
          
          if (bitError) console.error('Error loading bitacora:', bitError);
          setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
          
          await loadRutasBase();
          setLoading(false);
          return;
        }
      }

      // Primero buscar ruta activa (pendiente o en_progreso)
      const { data: rutaActiva, error: rError } = await supabase
        .from('rutas')
        .select('*')
        .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
        .in('estado', ['pendiente', 'en_progreso'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 
      
      // Si hay ruta activa, usarla
      if (rutaActiva) {
        setRuta(rutaActiva as Ruta);
        
        const localesData = await fetchLocalesWithGuias(rutaActiva.id_ruta);
        setLocales(localesData);

        const { data: bitacoraData, error: bitError } = await supabase
          .from('viajes_bitacora')
          .select('*')
          .eq('id_ruta', rutaActiva.id_ruta)
          .order('created_at', { ascending: true });
        
if (bitError) console.error('Error loading bitacora:', bitError);
        setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
        
        // Cargar rutas base SIEMPRE (para el selector) - aquí fuera del if para ejecutarse siempre
        await loadRutasBase();
      } else {
        // Si no hay ruta activa, buscar la ruta finalizada de HOY
        const today = new Date().toISOString().split('T')[0];
        const { data: rutaFinalizada, error: rfError } = await supabase
          .from('rutas')
          .select('*')
          .or(`id_chofer.eq.${profile.id_usuario},id_asistente.eq.${profile.id_usuario}`)
          .eq('estado', 'finalizada')
          .eq('fecha', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rfError) console.error('Error loading ruta finalizada:', rfError);
        
        if (rutaFinalizada) {
          // Mostrar la ruta finalizada para poder agregar fotos
          setRuta(rutaFinalizada as Ruta);
          
          const localesData = await fetchLocalesWithGuias(rutaFinalizada.id_ruta);
          setLocales(localesData);

          const { data: bitacoraData, error: bitError } = await supabase
            .from('viajes_bitacora')
            .select('*')
            .eq('id_ruta', rutaFinalizada.id_ruta)
            .order('created_at', { ascending: true });
          
          if (bitError) console.error('Error loading bitacora:', bitError);
          setBitacora(bitacoraData ? (bitacoraData as ViajeBitacora[]) : []);
        } else {
          setRuta(null);
          setLocales([]);
          setBitacora([]);
        }
        
        // Cargar rutas base SIEMPRE (para el selector)
        await loadRutasBase();
      }
    } catch (err: any) {
      console.error('Error cargando datos de viaje:', err);
      if (err.message?.includes('policy') || err.code === '42501') {
        setLoadError('Error de permisos (RLS). Contacta al administrador.');
      } else {
        setLoadError('No se pudo cargar la información. Reintenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRutasBase = async (force = false) => {
    // Evitar cargas duplicadas si ya se cargó (a menos que force=true)
    if (rutasBaseLoaded && !force && rutasBase.length > 0) {
      return;
    }
    setLoadingRutasBase(true);
    try {
      const { data: baseData, error: rbError } = await supabase
        .from('rutas_base')
        .select('*')
        .order('nombre');
        
        
      if (rbError) {
        console.error('Error loading rutas base:', rbError);
        setLoadingRutasBase(false);
        return;
      }

      if (baseData && baseData.length > 0) {
        const withCounts = await Promise.all(baseData.map(async (rb) => {
          try {
            const { count, error: cError } = await supabase
              .from('locales_base')
              .select('id_local_base', { count: 'exact', head: true })
              .eq('id_ruta_base', rb.id_ruta_base);
            
            if (cError) console.error(`Error counting locales for ${rb.nombre}:`, cError);
            return { ...rb, locales_count: count ?? 0 };
          } catch (e) {
            console.error(`Error counting locales for ${rb.nombre}:`, e);
            return { ...rb, locales_count: 0 };
          }
        }));
        
        setRutasBase(withCounts);
        setRutasBaseLoaded(true);
        setLoadedAtLeastOnce(true);
        setLoadingRutasBase(false);
      } else {
        setRutasBase([]);
        setRutasBaseLoaded(true);
        setLoadedAtLeastOnce(true);
        setLoadingRutasBase(false);
      }
    } catch (err) {
      console.error('Error loading rutas base:', err);
      setLoadingRutasBase(false);
    }
  };

  useEffect(() => {
    // Si no hay perfil, no cargamos nada
    if (!profile?.id_usuario) {
      setLoading(false);
      return;
    }

    loadCurrentRuta(); // Esto internamente llama loadRutasBase si necesita

    // Suscripción Realtime específica para ESTE chofer
    const channel = supabase
      .channel(`viaje_chofer_${profile.id_usuario}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rutas',
        filter: `id_chofer=eq.${profile.id_usuario}` 
      }, () => loadCurrentRuta())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes_bitacora' }, () => loadCurrentRuta())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locales_ruta' }, () => loadCurrentRuta())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guias_remision' }, () => loadCurrentRuta())
      .subscribe();

    window.addEventListener('online', loadCurrentRuta);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', loadCurrentRuta);
    };
  }, [profile?.id_usuario]);

  // Verificar disponibilidad de GPS
  const verificarGps = () => {
    if (!navigator.geolocation) {
      setGpsDisponible(false);
      return;
    }
    
    setGpsVerificando(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsDisponible(true);
        setGpsVerificando(false);
      },
      () => {
        setGpsDisponible(false);
        setGpsVerificando(false);
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  };

  // Efecto para verificar GPS al cargar
  useEffect(() => {
    if (ruta && ruta.estado !== 'finalizada') {
      verificarGps();
    }
  }, [ruta?.id_ruta, ruta?.estado]);

  const handleCreateViaje = async () => {
    if (esDiaDescanso) {
      showToast('Hoy es tu día de descanso. No puedes iniciar rutas.', 'error');
      return;
    }
    if (!selectedRutaBase || !profile) return;
    if (!nuevaPlaca.trim() && !tienePlacaAsignada) {
      setCreateError('Por favor ingresa la placa del vehículo.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    
    try {
      const baseRuta = rutasBase.find(r => r.id_ruta_base === selectedRutaBase);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data: baseLocales, error: lbError } = await supabase
        .from('locales_base')
        .select('*')
        .eq('id_ruta_base', selectedRutaBase)
        .order('orden', { ascending: true });

      if (lbError) {
        setCreateError(`Error al consultar locales base: ${lbError.message}`);
        return;
      }
      
      if (!baseLocales || baseLocales.length === 0) {
        setCreateError('Esta plantilla no tiene locales configurados. Pide al administrador que los agregue.');
        setIsCreating(false);
        return;
      }

      const template = rutasBase.find(r => r.id_ruta_base === selectedRutaBase);
      
      let publicUrlInicio = '';
      if (fotoKmInicio) {
        setSubiendoFoto(true);
        const blob = await (await fetch(fotoKmInicio)).blob();
        const fileName = `${profile?.id_usuario}_start_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('combustible_fotos')
          .upload(`kilometraje/${fileName}`, blob);
        
        if (!uploadError) {
          const { data } = supabase.storage.from('combustible_fotos').getPublicUrl(`kilometraje/${fileName}`);
          publicUrlInicio = data.publicUrl;
        }
      }

      const { data: newRuta, error: rError } = await supabase
        .from('rutas')
        .insert({
          id_chofer: profile?.id_usuario,
          id_ruta_base: selectedRutaBase,
          placa: nuevaPlaca,
          nombre: template?.nombre,
          fecha: format(nowPeru(), 'yyyy-MM-dd'),
          estado: 'pendiente',
          km_inicio: parseFloat(kmInicio) || 0,
          foto_km_inicio: publicUrlInicio
        })
        .select()
        .single();

      if (rError) throw rError;

      const localesRuta = baseLocales.map(bl => ({
        id_ruta: newRuta.id_ruta,
        id_local_base: bl.id_local_base,
        nombre: bl.nombre,
        direccion: bl.direccion ?? null,
        latitud: bl.latitud ?? null,
        longitud: bl.longitud ?? null,
        orden: bl.orden,
        estado_visita: 'pendiente'
      }));

      const { error: insertError } = await supabase.from('locales_ruta').insert(localesRuta);
      if (insertError) throw insertError;

      await loadCurrentRuta();
    } catch (e: any) {
      console.error('[Viaje] Error al crear viaje:', e);
      setCreateError('Error al crear el viaje: ' + (e.message || JSON.stringify(e)));
    } finally {
      setIsCreating(false);
    }
  };

  const localesRegistrados = bitacora.filter(b => b.hora_llegada).map(b => b.destino_nombre);
  const localesDisponibles = locales.filter(l => !localesRegistrados.includes(l.nombre || ''));
  const localesVisitados = locales.filter(l => 
    localesRegistrados.includes(l.nombre || '') && l.nombre !== 'Planta'
  );
  const tramoEnProgreso = bitacora.find(b => !b.hora_llegada);

  useEffect(() => {
    if (!tramoEnProgreso) {
      if (localesDisponibles.length > 0) {
        setNuevoDestino(localesDisponibles[0].nombre || '');
      } else if (locales.length > 0 && !localesRegistrados.includes('Planta') && bitacora.length > 0) {
        setNuevoDestino('Planta');
      } else {
        setNuevoDestino('');
      }
    }
  }, [bitacora, locales, localesDisponibles.length]);

  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingDestino, setIsEditingDestino] = useState(false);
  const [destinoEditado, setDestinoEditado] = useState('');
  const [isSavingDestino, setIsSavingDestino] = useState(false);
  
  // Guías Viewer State
  const [viewingGuias, setViewingGuias] = useState<GuiaRemision[] | null>(null);
  const [currentGuiaIndex, setCurrentGuiaIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [searchTermGuias, setSearchTermGuias] = useState('');

  const handleRegistrarSalida = async () => {
    if (esDiaDescanso) {
      showToast('Hoy es tu día de descanso.', 'error');
      return;
    }
    if (!ruta || !nuevoDestino || actionLoading) return;
    if (esHistorial) {
      alert('No puedes modificar un viaje histórico');
      return;
    }
    try {
      const origen = proximoOrigen;
      
      setActionLoading(true);
      let lat = null, lng = null;
      try {
        // Máximo 2 segundos al GPS para la salida, si no, avanzamos sin él
        const pos = await new Promise<any>((res) => {
          const timeout = setTimeout(() => res(null), 2000);
          navigator.geolocation.getCurrentPosition(
            (p) => { clearTimeout(timeout); res(p); },
            (e) => { clearTimeout(timeout); res(null); },
            { timeout: 2000, enableHighAccuracy: false }
          );
        });
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch (e) {
        console.warn('GPS Error:', e);
      }

      const { data, error } = await supabase
        .from('viajes_bitacora')
        .insert([{
          id_ruta: ruta.id_ruta,
          id_chofer: profile?.id_usuario,
          origen_nombre: origen,
          destino_nombre: nuevoDestino,
          hora_salida: nowPeru(),
          gps_salida_lat: lat,
          gps_salida_lng: lng
        }])
        .select()
        .single();

      if (!error && data) {
        setBitacora([...bitacora, data as ViajeBitacora]);
        if (origen !== 'Planta') {
          await supabase.from('locales_ruta').update({ hora_salida: data.hora_salida }).eq('id_ruta', ruta.id_ruta).eq('nombre', origen);
        }
        if (bitacora.length === 0) {
          await supabase.from('rutas').update({ estado: 'en_progreso', hora_salida_planta: data.hora_salida }).eq('id_ruta', ruta.id_ruta);
        }
      } else if (error) {
        console.error('[Viaje] Error registrar salida:', error);
        showToast('error', 'Error en salida: ' + error.message);
      }
    } catch (err: any) {
      console.error('[Viaje] Exception in handleRegistrarSalida:', err);
      showToast('error', 'Error inesperado: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegistrarLlegada = async (idBitacora: string, modoManual = false) => {
    if (esDiaDescanso) {
      showToast('Hoy es tu día de descanso.', 'error');
      return;
    }
    if (actionLoading) return; 
    if (esHistorial) {
      alert('No puedes modificar un viaje histórico');
      return;
    }
    
    setActionLoading(true);
    try {
      let lat = null, lng = null;
      let tipoRegistro = 'automatico';
      
      if (modoManual) {
        tipoRegistro = 'manual';
      } else {
        try {
          // SI ya tenemos una posición reciente y precisa del watchPosition, usarla
          if (gpsPosicionActual && !signalBaja) {
            lat = gpsPosicionActual.lat;
            lng = gpsPosicionActual.lng;
            tipoRegistro = 'automatico';
            agregarLogDebug(`✅ Usando GPS validado: ${lat.toFixed(5)},${lng.toFixed(5)}`);
          } else {
            // Si no, intentar obtener una nueva
            agregarLogDebug('📍 Intentando obtener GPS fresco para llegada...');
            const pos = await iniciarGPSConPermisos();
            
            if (pos) {
              lat = pos.lat;
              lng = pos.lng;
              tipoRegistro = 'automatico';
              agregarLogDebug(`✅ GPS Fresco: ${lat.toFixed(5)},${lng.toFixed(5)} (±${pos.accuracy.toFixed(0)}m)`);
            } else {
              tipoRegistro = 'manual';
              agregarLogDebug('⚠️ Sin GPS - modo manual');
            }
          }
        } catch (e) {
          console.warn('GPS Error:', e);
          tipoRegistro = 'manual';
          agregarLogDebug('❌ Error GPS');
        }
      }

      const now = nowPeru();
      
      // Construir update completo con logging
      const updateData: any = { 
        hora_llegada: now, 
        gps_llegada_lat: lat, 
        gps_llegada_lng: lng,
        tipo_registro: tipoRegistro
      };
      
      const { data, error } = await supabase
        .from('viajes_bitacora')
        .update(updateData)
        .eq('id_bitacora', idBitacora)
        .select()
        .single();

      console.log('Respuesta Supabase (Llegada):', data, error);

      if (!error && data) {
        setBitacora(bitacora.map(b => b.id_bitacora === idBitacora ? (data as ViajeBitacora) : b));
        
        // Solo marcar como visitado si NO era un detour
        const eraDetour = localesRegistrados.includes(data.destino_nombre || '');
        
        if (data.destino_nombre !== 'Planta' && !eraDetour) {
          await supabase.from('locales_ruta').update({ hora_llegada: now, estado_visita: 'visitado' }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.destino_nombre);
        }
        if (data.destino_nombre === 'Planta') {
           await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', ruta?.id_ruta);
           if (ruta) setRuta({ ...ruta, estado: 'finalizada' });
           setShowFinalKmModal(true);
        }
        
        // Actualizar cooldown
        setUltimoRegistroTime(Date.now());
        setEstadoGPS('registrado');
        
        agregarLogDebug(`✅ LLEGADA REGISTRADA (${tipoRegistro}): ${data.destino_nombre} | Dist: ${distanciaAlPunto?.toFixed(0) || 'N/A'}m`);
        showToast('success', tipoRegistro === 'automatico' ? '✓Llegada automática registrada' : '✓Llegada manual registrada');
        setShowModoManual(false);
      } else if (error) {
        console.error('[Viaje] Error registrar llegada:', error);
        agregarLogDebug(`❌ Error DB: ${error.message}`);
        showToast('error', 'Error en llegada: ' + error.message);
      }
    } catch (err: any) {
      console.error('[Viaje] Exception in handleRegistrarLlegada:', err);
      showToast('error', 'Error inesperado: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Función para registrar salida automáticamente
  const handleRegistrarSalidaAutomatica = async (idBitacora: string) => {
    if (esDiaDescanso) return;
    if (actionLoading) return;
    if (esHistorial) return;
    
    setActionLoading(true);
    let lat = null, lng = null;
    
    try {
      if (gpsPosicionActual && !signalBaja) {
        lat = gpsPosicionActual.lat;
        lng = gpsPosicionActual.lng;
        agregarLogDebug(`✅ Usando GPS validado para salida: ${lat.toFixed(5)},${lng.toFixed(5)}`);
      } else {
        agregarLogDebug('📍 Intentando obtener GPS fresco para salida...');
        const pos = await iniciarGPSConPermisos();
        if (pos) {
          lat = pos.lat;
          lng = pos.lng;
          agregarLogDebug(`✅ GPS Fresco salida: ${lat.toFixed(5)},${lng.toFixed(5)}`);
        }
      }
    } catch (e) {
      console.warn('GPS Error:', e);
    }
    
    const now = nowPeru();
    
    const { data, error } = await supabase
      .from('viajes_bitacora')
      .update({ hora_salida: now, gps_salida_lat: lat, gps_salida_lng: lng })
      .eq('id_bitacora', idBitacora)
      .select()
      .single();
    
    if (!error && data) {
      setBitacora(bitacora.map(b => b.id_bitacora === idBitacora ? (data as ViajeBitacora) : b));
      
      // Actualizar estado del local
      if (data.origen_nombre && data.origen_nombre !== 'Planta') {
        await supabase.from('locales_ruta').update({ hora_salida: now }).eq('id_ruta', ruta?.id_ruta).eq('nombre', data.origen_nombre);
      }
      
      setUltimoRegistroTime(Date.now());
      agregarLogDebug(`✅ SALIDA REGISTRADA automáticamente: ${data.destino_nombre}`);
      showToast('success', '✓Salida automática registrada');
      
      // Limpiar buffer y continuar
      setLecturasBuffer([]);
      setPosicionPromediada(null);
    } else if (error) {
      console.error('[Viaje] Error registrar salida:', error);
      agregarLogDebug(`❌ Error DB: ${error.message}`);
    }
    setActionLoading(false);
  };

  if (loading) return <div className="p-4 text-white text-center mt-10 italic animate-pulse">Cargando Sistema de Rutas...</div>;

  // Helper: verificar si la ruta es de hoy o es historial
  const esRutaDeHoy = (r: Ruta | null) => {
    if (!r) return false;
    if (esHistorial) return true; // Si es modo historial, siempre mostrar
    const today = new Date().toISOString().split('T')[0];
    return r.fecha === today;
  };

  // Si no hay ruta O si hay ruta finalizada que NO es de hoy → mostrar formulario crear
  // Si hay ruta activa O ruta finalizada de hoy O es historial → mostrar la ruta
  const mostrarRuta = ruta && (ruta.estado !== 'finalizada' || esRutaDeHoy(ruta));

  // NO mostrar formulario hasta que loading principal termine
  if (loading) return <div className="p-4 text-white text-center mt-10 italic animate-pulse">Cargando Sistema de Rutas...</div>;

  // Mientras cargan las plantillas, mostrar spinner (pero NO el formulario)
  if (!mostrarRuta && (loadingRutasBase || !rutasBaseLoaded)) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  // NEW: Si loadingRutasBase aún está trueno mostrar loading en lugar del formulario
  if (!mostrarRuta && loadingRutasBase) {
    return (
      <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
        <div className="text-center space-y-2 pt-8">
           <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
              <Truck size={40} />
           </div>
           <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
           <p className="text-text-muted text-sm animate-pulse">Cargando plantillas...</p>
        </div>
      </div>
    );
  }

  if (!mostrarRuta) {
    return (
      <RutaSelector 
        loadingRutasBase={loadingRutasBase}
        rutasBase={rutasBase}
        selectedRutaBase={selectedRutaBase}
        setSelectedRutaBase={setSelectedRutaBase}
        nuevaPlaca={nuevaPlaca}
        handlePlacaChange={handlePlacaChange}
        tienePlacaAsignada={tienePlacaAsignada}
        createError={createError}
        loadError={loadError}
        isCreating={isCreating}
        kmInicio={kmInicio}
        setKmInicio={setKmInicio}
        fotoKmInicio={fotoKmInicio}
        setFotoKmInicio={setFotoKmInicio}
        handleCrearRuta={handleCreateViaje}
      />
    );
  }

  let proximoOrigen = 'Planta';
  if (bitacora.length > 0) {
    proximoOrigen = bitacora[bitacora.length - 1].destino_nombre || 'Planta';
  }

  // Pantalla de bloqueo por día de descanso
  if (diaDescansoBloqueado) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto pb-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Coffee size={64} className="mx-auto text-yellow-400 mb-4" />
          <h1 className="text-2xl font-black text-yellow-400 mb-2">🛌 Día de Descanso</h1>
          <p className="text-text-muted mb-6">Hoy es tu día de descanso. No puedes iniciar rutas.</p>
          <a 
            href="https://wa.me/51948800569?text=Hola,%20tengo%20una%20consulta" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-lg"
          >
            <Phone size={20} />
            Contactar Administrador
          </a>
          <div className="mt-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/driver')}
              className="text-text-muted"
            >
              ← Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto pb-24">
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/driver')}
          className="w-fit text-text-muted hover:text-white -ml-2"
        >
          ← VOLVER AL TABLERO
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Mi Bitácora</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-text-muted text-sm italic font-medium">{ruta.nombre} • <span className="text-primary font-black uppercase">{ruta.placa || 'Sin Placa'}</span></p>
              {ruta.km_inicio ? (
                <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1">
                  KM: {ruta.km_inicio}
                  <button onClick={() => { setTempKmInicio(ruta.km_inicio?.toString() || ''); setIsEditingKmInicio(true); }} className="ml-1 text-primary hover:text-white">
                    <Edit2 size={10} />
                  </button>
                </span>
              ) : (
                <button 
                  onClick={() => { setTempKmInicio(''); setIsEditingKmInicio(true); }}
                  className="bg-orange-500/20 text-orange-400 text-[10px] font-black px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1 animate-pulse"
                >
                  <PlusCircle size={10} /> ASIGNAR KM INICIAL
                </button>
              )}
              {ruta.nombre_asistente && (
                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[10px] font-black border border-purple-500/30">
                  👤 ASISTENTE: {ruta.nombre_asistente}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate(`/driver/ruta/${ruta.id_ruta}`)}
              className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
            >
              <MapPin size={16} className="mr-1" />
              Ver Locales
            </Button>
            <div className="bg-surface-light px-3 py-1 rounded-full border border-white/5">
               <span className="text-[10px] font-black text-primary italic uppercase tracking-widest">En Curso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de GPS y Distancia - Sistema Avanzado v2 */}
      {ruta?.estado === 'en_progreso' && !esHistorial && (
        <Card className={`border ${signalBaja ? 'bg-red-500/20 border-red-500/50' : estadoGPS === 'en_rango' || estadoGPS === 'registrado' ? 'bg-green-500/20 border-green-500/50' : estadoGPS === 'buscando' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface-light/50 border-white/10'}`}>
          <CardContent className="p-4">
            {/* Alerta de señal baja */}
            {signalBaja && (
              <div className="mb-3 bg-red-500/20 border border-red-500/50 rounded-lg p-2 flex items-center gap-2">
                <span className="text-red-400">⚠️</span>
                <span className="text-red-300 text-xs font-bold">Señal GPS baja, acércate más al punto</span>
              </div>
            )}
            
            {/* Mensaje de validación */}
            {mensajeGPS && !signalBaja && (
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
                    {estadoGPS === 'en_rango' && (estadoDetectar === 'validando_llegada' ? `⏳ Validando LLEGADA (${Math.round(tiempoValidando/1000)}s/12s)` : estadoDetectar === 'validando_salida' ? `⏳ Validando SALIDA (${Math.round(tiempoValidando/1000)}s/6s)` : `✅ Dentro del radio`)}
                    {estadoGPS === 'registrado' && '✅ Registro completado'}
                  </p>
                  <p className={`text-sm font-black ${signalBaja ? 'text-red-400' : estadoGPS === 'en_rango' || estadoGPS === 'registrado' ? 'text-green-400' : 'text-white'}`}>
                    {distanciaAlPunto !== null 
                      ? `${distanciaAlPunto.toFixed(0)}m ${distanciaAlPunto <= RADIO_BASE ? 'dentro del radio' : 'fuera del radio'}`
                      : gpsError || 'Obteniendo ubicación...'}
                  </p>
                  {/* Barra de progreso cuando está validando */}
                  {(estadoDetectar === 'validando_llegada' || estadoDetectar === 'validando_salida') && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${estadoDetectar === 'validando_llegada' ? 'bg-green-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(100, Math.round((tiempoValidando / (estadoDetectar === 'validando_llegada' ? TIEMPO_LLEGADA : TIEMPO_SALIDA)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase">Cooldown</p>
                <p className="text-xs font-black text-primary">{Math.max(0, Math.ceil((COOLDOWN_REGISTRO - (Date.now() - ultimoRegistroTime))/1000))}s</p>
              </div>
            </div>
            
            {/* Botón manual si GPS inestable */}
            {mostrarBotonManual && (
              <div className="mt-3">
                <Button 
                  onClick={() => {
                    const bitacoraActual = bitacora.length > 0 ? bitacora[bitacora.length - 1] : null;
                    if (bitacoraActual && !bitacoraActual.hora_llegada) {
                      handleRegistrarLlegada(bitacoraActual.id_bitacora, true);
                    } else if (bitacoraActual && bitacoraActual.hora_llegada && !bitacoraActual.hora_salida) {
                      handleRegistrarSalidaAutomatica(bitacoraActual.id_bitacora);
                    }
                    limpiarTemporizadoresValidacion();
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2"
                >
                  📝 Registrar manualmente
                </Button>
              </div>
            )}
            
            {/* Estado del sistema */}
            <div className="mt-3 flex gap-2 text-[10px] flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                Radio: {RADIO_MIN}-{RADIO_MAX}m
              </span>
              <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                Buffer: {lecturasBuffer.length}/{LECTURAS_PROMEDIAR}
              </span>
              {posicionPromediada && (
                <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">
                  ✓ Promediado
                </span>
              )}
              {gpsError && (
                <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">
                  Error: {gpsError}
                </span>
              )}
            </div>
            
            {/* Logs de debug (desplegable) */}
            {gpsDebugLogs.length > 0 && (
              <details className="mt-3">
                <summary className="text-[10px] text-text-muted cursor-pointer hover:text-white">
                  Debug GPS ({gpsDebugLogs.length})
                </summary>
                <div className="mt-2 bg-black/30 rounded-lg p-2 text-[9px] font-mono text-text-muted max-h-32 overflow-y-auto">
                  {gpsDebugLogs.map((log, i) => (
                    <div key={i} className="py-0.5">{log}</div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card de Proceso Actual */}
      {tramoEnProgreso ? (
        <Card className="bg-surface border-primary/30 border-2 shadow-2xl overflow-hidden animate-in slide-in-from-top-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                  <Truck size={18} />
                </div>
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">En Camino</span>
              </div>
              <Button variant="ghost" size="sm" onClick={loadCurrentRuta} className="h-7 text-[10px] font-bold bg-white/5">
                <RefreshCw size={12} className="mr-1" /> ACTUALIZAR
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Desde</p>
                <p className="text-sm font-bold text-white uppercase italic">{tramoEnProgreso.origen_nombre}</p>
              </div>

              <div className="relative py-2 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-surface-light"></div>
                <div className="absolute left-[-4px] top-0 w-2.5 h-2.5 rounded-full bg-primary shadow-lg shadow-primary/50"></div>
              </div>

              {isEditingDestino ? (
                <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <Input 
                    placeholder="Corregir nombre del destino..." 
                    value={destinoEditado}
                    onChange={e => setDestinoEditado(e.target.value)}
                    className="bg-black/40 border-primary/30"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 font-bold text-xs" onClick={() => setIsEditingDestino(false)}>CANCELAR</Button>
                    <Button size="sm" className="flex-1 font-black text-xs" disabled={isSavingDestino} onClick={() => handleSaveDestino(tramoEnProgreso.id_bitacora)}>{isSavingDestino ? 'GUARDANDO...' : 'GUARDAR'}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Hacia (Destino)</p>
                    <h3 className="text-xl font-black text-white italic leading-tight uppercase">{tramoEnProgreso.destino_nombre}</h3>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    {(function() {
                      const normalizedDest = (tramoEnProgreso.destino_nombre || '').trim().toLowerCase();
                      const localActual = locales.find(l => (l.nombre || '').trim().toLowerCase() === normalizedDest);
                      
                      return (
                        <>
                          {localActual?.latitud && localActual?.longitud && (
                            <>
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=${localActual.latitud},${localActual.longitud}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 bg-blue-500/20 p-2.5 rounded-lg active:scale-90 transition-transform" title="Google Maps">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.375 8.5 15.5 8.5 15.5s8.5-9.125 8.5-15.5C20.5 3.81 16.69 0 12 0zm0 12c-1.93 0-3.5-1.57-3.5-3.5S10.07 5 12 5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
                                </svg>
                              </a>
                              <a href={`https://waze.com/ul?ll=${localActual.latitud},${localActual.longitud}&navigate=yes`} target="_blank" rel="noopener noreferrer" className="text-yellow-400 bg-yellow-500/20 p-2.5 rounded-lg active:scale-90 transition-transform" title="Waze">
                                <Navigation size={18} />
                              </a>
                            </>
                          )}
                          {localActual?.guias && localActual.guias.length > 0 && (
                            <button onClick={() => { setViewingGuias(localActual.guias || []); setCurrentGuiaIndex(0); }} className="text-white bg-primary p-2.5 rounded-lg shadow-lg shadow-primary/30 active:scale-90 transition-transform flex items-center gap-1.5 animate-bounce">
                              <FileText size={20} />
                              <span className="text-xs font-black">{localActual.guias.length}</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                    <button onClick={() => { setDestinoEditado(tramoEnProgreso.destino_nombre || ''); setIsEditingDestino(true); }} className="bg-surface-light text-text-muted p-2.5 rounded-lg active:scale-90 transition-transform">
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-text-muted font-bold">
                    <Clock size={14} className="text-primary" />
                    SALIDA: {formatPeru(tramoEnProgreso.hora_salida, 'HH:mm')}
                  </div>
                  <Button size="sm" variant="ghost" className="text-purple-400 font-bold text-[10px]" onClick={() => {
                    const normalizedDest = (tramoEnProgreso.destino_nombre || '').trim().toLowerCase();
                    const localActual = locales.find(l => (l.nombre || '').trim().toLowerCase() === normalizedDest);
                    if (localActual) setLocalParaFoto(localActual);
                  }}>📸 FOTO EVIDENCIA</Button>
                </div>

                {/* Indicador de GPS */}
                <div className="flex items-center justify-center gap-2">
                  {gpsVerificando ? (
                    <div className="flex items-center gap-1 text-yellow-400 text-[10px]">
                      <RefreshCw size={12} className="animate-spin" />
                      Verificando GPS...
                    </div>
                  ) : gpsDisponible === true ? (
                    <div className="flex items-center gap-1 text-green-400 text-[10px]">
                      <Wifi size={12} />
                      GPS activo
                    </div>
                  ) : gpsDisponible === false ? (
                    <div className="flex items-center gap-1 text-yellow-400 text-[10px]">
                      <WifiOff size={12} />
                      GPS no disponible
                    </div>
                  ) : null}
                </div>

                {/* Botón principal - Registro automático */}
                {!showModoManual ? (
                  <Button 
                    className="w-full h-16 text-lg font-black italic uppercase tracking-widest bg-green-600 hover:bg-green-500 shadow-xl shadow-green-900/40 rounded-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all"
                    onClick={() => handleRegistrarLlegada(tramoEnProgreso.id_bitacora, false)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'ESPERE...' : 'MARCAR LLEGADA →'}
                  </Button>
                ) : (
                  /* Modo manual - necesita confirmación */
                  <div className="space-y-2">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl text-center">
                      <p className="text-yellow-400 text-xs font-bold">¿Registrar manualmente?</p>
                      <p className="text-text-muted text-[10px] mt-1">Sin ubicación GPS</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="secondary"
                        className="bg-surface-light/50 text-text-muted"
                        onClick={() => setShowModoManual(false)}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                        onClick={() => handleRegistrarLlegada(tramoEnProgreso.id_bitacora, true)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? '...' : 'Sí, manual'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botón para activar modo manual */}
                {!showModoManual && (
                  <button 
                    onClick={() => setShowModoManual(true)}
                    className="w-full text-center text-[10px] text-text-muted hover:text-yellow-400 transition-colors py-1"
                  >
                    ¿No funciona GPS? <span className="underline">Registrar manualmente</span>
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : nuevoDestino ? (
        <Card className="bg-surface-light/5 border border-white/10 overflow-hidden shadow-2xl">
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Origen</p>
                  <p className="text-sm font-bold text-white uppercase italic">{proximoOrigen}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1 ml-1">Próximo Destino</p>
                  <div className="relative">
                    <select 
                      value={nuevoDestino}
                      onChange={(e) => setNuevoDestino(e.target.value)}
                      className="w-full bg-surface-light border border-primary/40 rounded-xl px-3 py-3 text-white font-black italic uppercase appearance-none focus:outline-none focus:ring-1 focus:ring-primary text-sm shadow-inner"
                    >
                      {localesDisponibles.map(l => ( <option key={l.id_local_ruta} value={l.nombre || ''}>{l.nombre}</option> ))}
                      {localesDisponibles.length === 0 && (locales.length > 0 && !localesRegistrados.includes('Planta') && bitacora.length > 0) && (
                        <option value="Planta">REGRESO A PLANTA</option>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                  </div>
                </div>
              </div>

              {localesVisitados.length > 0 && !mostrarLocalesVisitados && (
                <button onClick={() => setMostrarLocalesVisitados(true)} className="text-[10px] text-yellow-400 font-bold uppercase underline tracking-tighter w-full text-center py-1">
                  ¿Regresas a un cliente ya visitado?
                </button>
              )}

              {mostrarLocalesVisitados && (
                <div className="bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/20 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-yellow-500 uppercase">Clientes Visitados</span>
                    <button onClick={() => setMostrarLocalesVisitados(false)} className="text-[10px] uppercase font-bold text-white/50">Cerrar</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {localesVisitados.map(l => (
                      <button key={l.id_local_ruta} onClick={() => { setNuevoDestino(l.nombre || ''); setMostrarLocalesVisitados(false); }} className="text-left p-3 bg-black/30 rounded-lg border border-white/5 flex justify-between items-center hover:bg-yellow-500/10 transition-colors">
                        <span className="text-xs font-bold text-white uppercase">{l.nombre}</span>
                        <ChevronRight size={14} className="text-yellow-500" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                className="w-full h-16 text-xl font-black italic tracking-widest bg-primary hover:bg-primary-light shadow-xl shadow-primary/30 rounded-2xl border-b-4 border-primary-dark active:border-b-0 active:translate-y-1 transition-all"
                onClick={handleRegistrarSalida}
                disabled={actionLoading}
              >
                {actionLoading ? 'INICIANDO...' : 'INICIAR VIAJE →'}
              </Button>
              
              {!tramoEnProgreso && bitacora.length > 0 && bitacora[bitacora.length - 1].hora_llegada && ruta.estado !== 'finalizada' && (
                <Button variant="ghost" onClick={() => {
                  const ultimoTramo = bitacora[bitacora.length - 1];
                  const local = locales.find(l => (l.nombre || '').trim().toLowerCase() === (ultimoTramo.destino_nombre || '').trim().toLowerCase());
                  if (local) setLocalParaFoto(local);
                }} className="w-full text-purple-400 font-bold border border-purple-500/20 py-6">
                  📸 TOMAR FOTO - {bitacora[bitacora.length - 1].destino_nombre}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-white/10 bg-transparent py-12 text-center">
          <CardContent>
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4 opacity-50" />
            <p className="text-white text-lg font-black uppercase italic italic">¡Ruta Finalizada!</p>
            <p className="text-text-muted text-sm mt-1">Has regresado a planta con éxito.</p>
            <Button variant="ghost" onClick={() => navigate('/driver')} className="mt-6 text-primary font-black uppercase tracking-widest">SALIR AL TABLERO</Button>
          </CardContent>
        </Card>
      )}

      <LocalList 
        localesDisponibles={localesDisponibles}
        rutaEstado={ruta.estado}
        localesRegistrados={localesRegistrados}
        locales={locales}
        setViewingGuias={setViewingGuias}
        setCurrentGuiaIndex={setCurrentGuiaIndex}
      />

      <BitacoraList 
        bitacora={bitacora}
        locales={locales}
        editandoBitacora={editandoBitacora}
        editHoraSalida={editHoraSalida}
        editHoraLlegada={editHoraLlegada}
        handleEditarHora={handleEditarHora}
        guardarEdicionHora={guardarEdicionHora}
        setEditandoBitacora={setEditandoBitacora}
        setEditHoraSalida={setEditHoraSalida}
        setEditHoraLlegada={setEditHoraLlegada}
        setViewingGuias={setViewingGuias}
        setCurrentGuiaIndex={setCurrentGuiaIndex}
      />

      {/* Botón para registrar combustible DURANTE la ruta */}
      {(ruta.estado === 'en_progreso' || ruta.estado === 'en_curso') && (
        <button
          onClick={() => setShowCombustible(true)}
          className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-yellow-900/30"
        >
          <Fuel size={24} />
          Registrar Combustible / Gasto
        </button>
      )}

      {ruta.estado === 'finalizada' && (
        <>
          <div className="bg-green-500/10 border-2 border-green-500/50 p-8 rounded-3xl text-center animate-in zoom-in-95 duration-700 shadow-2xl shadow-green-500/10">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-black shadow-lg shadow-green-500/20">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">¡Viaje Cerrado!</h3>
              <div className="flex flex-col gap-1 my-3">
                <p className="text-green-500/80 text-sm font-bold">Bitácora completada y registrada en el sistema.</p>
                <div className="flex justify-center gap-3 mt-2">
                  <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg">
                    <p className="text-[10px] text-text-muted uppercase font-bold">Km Inicial</p>
                    <p className="text-white font-black italic">{ruta.km_inicio || 0}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg">
                    <p className="text-[10px] text-text-muted uppercase font-bold">Km Final</p>
                    <p className="text-white font-black italic">{ruta.km_fin || '?'}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={iniciarNuevoViaje}
                className="mt-4 bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm"
              >
                🚛 Iniciar Nuevo Viaje
              </button>
              
              <button
                onClick={async () => {
                  if (enviandoWhatsapp) return;
                  setEnviandoWhatsapp(true);
                  
                  try {
                    // Obtener locales visitados con fotos
                    const localesVisitados = locales.filter(l => l.hora_llegada);
                    
                    // Obtener gastos de combustible (separado de otros)
                    const { data: gastos } = await supabase
                      .from('gastos_combustible')
                      .select('monto, tipo_combustible')
                      .eq('id_ruta', ruta.id_ruta);
                    
                    const gastoCombustible = gastos?.filter(g => g.tipo_combustible !== 'otro').reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
                    const gastoOtros = gastos?.filter(g => g.tipo_combustible === 'otro').reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
                    
                    // Calcular duración total
                    let duracion = 'No registrado';
                    if (ruta.hora_salida_planta && ruta.hora_llegada_planta) {
                      const salida = new Date(ruta.hora_salida_planta);
                      const llegada = new Date(ruta.hora_llegada_planta);
                      const mins = Math.round((llegada.getTime() - salida.getTime()) / 60000);
                      duracion = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}min`;
                    }

                    // Formatear hora
                    const formatHora = (iso: string | null) => {
                      if (!iso) return '--:--';
                      const d = new Date(iso);
                      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                    };

                    // Construir mensaje con formato de tabla
                    const lineas: string[] = [];
                    
                    // ╔══════════════════════════════════════╗
                    lineas.push('╔══════════════════════════════════════╗');
                    lineas.push('║     RESUMEN DE RUTA - ' + (ruta.nombre || 'Viaje').padEnd(20) + '║');
                    lineas.push('╠══════════════════════════════════════╣');
                    lineas.push('║ 📅 ' + (ruta.fecha || 'Hoy').padEnd(15) + '  🚚 ' + (ruta.placa || 'N/A').padEnd(10) + '║');
                    lineas.push('║ ⏱️ Duración: ' + duracion.padEnd(18) + '║');
                    lineas.push('║ 📍 Locales: ' + String(localesVisitados.length).padEnd(3) + '  ⛽ GLP: S/ ' + gastoCombustible.toFixed(2).padStart(7) + '║');
                    lineas.push('╚══════════════════════════════════════╝');
                    lineas.push('');

                    // Salida de Planta
                    if (ruta.hora_salida_planta) {
                      const primerDestino = bitacora.length > 0 ? bitacora[0].destino_nombre : 'N/A';
                      lineas.push('🏭 SALIDA PLANTA: ' + formatHora(ruta.hora_salida_planta) + ' → ' + primerDestino);
                    }

                    // Lista de locales con formato de tabla
                    if (bitacora.length > 0) {
                      lineas.push('');
                      lineas.push('┌─────────────────────────────────────┐');
                      lineas.push('│         LOCALES VISITADOS          │');
                      lineas.push('├────┬────────────────────────────────┤');
                      lineas.push('│ #  │ Horario (Llegada - Salida)    │');
                      lineas.push('├────┼────────────────────────────────┤');
                      
                      bitacora.forEach((tramo, idx) => {
                        if (!tramo.hora_llegada) return;
                        const llegada = formatHora(tramo.hora_llegada);
                        const salida = tramo.hora_salida ? formatHora(tramo.hora_salida) : '--:--';
                        const nombreCorto = tramo.destino_nombre.length > 28 ? tramo.destino_nombre.substring(0, 25) + '...' : tramo.destino_nombre;
                        const num = String(idx + 1).padStart(2, ' ');
                        const horas = `${llegada} - ${salida}`.padEnd(14);
                        lineas.push(`│ ${num} │ ${nombreCorto.padEnd(32)}│`);
                        lineas.push(`│    │ ${horas.padEnd(32)}│`);
                        lineas.push(`│    │                                    │`);
                      });
                      
                      lineas.push('└─────────────────────────────────────┘');
                    }

                    // Llegada a Planta
                    if (ruta.hora_llegada_planta) {
                      lineas.push('');
                      lineas.push('🏭 LLEGADA PLANTA: ' + formatHora(ruta.hora_llegada_planta));
                    }

                    lineas.push('');
                    lineas.push('_Enviado desde Shimaya Rutas_');

                    const mensaje = encodeURIComponent(lineas.join('\n'));
                    // Número de admin desde variable de entorno o valor por defecto
                    const whatsappNumero = import.meta.env.VITE_WHATSAPP_ADMIN || '51948800569';
                    window.open(`https://wa.me/${whatsappNumero}?text=${mensaje}`, '_blank');
                    
                  } catch (err) {
                    console.error('[WhatsApp] Error:', err);
                    showToast('error', 'Error al generar resumen');
                  } finally {
                    setEnviandoWhatsapp(false);
                  }
                }}
                disabled={enviandoWhatsapp}
                className="mt-4 ml-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
              >
                {enviandoWhatsapp ? '⏳ Generando...' : '📤 Enviar Resumen'}
              </button>
          </div>
          
          {/* Botón para agregar fotos después del viaje */}
          <div className="mt-6 p-4 bg-surface-light/30 rounded-2xl border border-white/10">
            <p className="text-xs text-text-muted mb-3 uppercase font-bold">Agregar fotos de evidencia (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              {locales.filter(l => l.hora_llegada).map(local => (
                <button
                  key={local.id_local_ruta}
                  onClick={() => setLocalParaFoto(local)}
                  className="bg-surface p-3 rounded-xl border border-white/10 hover:border-primary/50 text-left transition-all"
                >
                  <p className="text-xs text-white truncate">{local.nombre}</p>
                  <p className="text-[10px] text-text-muted">{local.hora_llegada ? '✓ Visitado' : 'Sin registrar'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Botón para agregar gastos de combustible después del viaje */}
          <button
            onClick={() => setShowCombustible(true)}
            className="mt-4 w-full bg-green-600/20 text-green-400 border border-green-600/50 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Fuel size={18} />
            Agregar Comprobante de Combustible
          </button>
        </>
      )}

      {showCombustible && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <RegistrarCombustible 
              idRuta={ruta.id_ruta} 
              idChofer={profile?.id_usuario || ''}
              onClose={() => setShowCombustible(false)}
            />
          </div>
        </div>
      )}

      {isEditingKmInicio && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
          <Card className="max-w-xs w-full border-primary/30 bg-surface">
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-1">
                <Truck className="mx-auto text-primary" size={32} />
                <h3 className="text-lg font-black text-white italic uppercase">Kilometraje Inicial</h3>
                <p className="text-xs text-text-muted">Ingresa el odómetro al salir de planta.</p>
              </div>
              <Input 
                type="number"
                value={tempKmInicio}
                onChange={e => setTempKmInicio(e.target.value)}
                placeholder="0"
                className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg text-center"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 text-xs" onClick={() => setIsEditingKmInicio(false)}>Cancelar</Button>
                <Button className="flex-1 text-xs font-black" onClick={async () => {
                  try {
                    const km = parseFloat(tempKmInicio);
                    if (isNaN(km)) return;
                    const { error } = await supabase.from('rutas').update({ km_inicio: km }).eq('id_ruta', ruta?.id_ruta);
                    if (error) throw error;
                    setRuta(prev => prev ? { ...prev, km_inicio: km } : null);
                    setIsEditingKmInicio(false);
                    showToast('success', 'Kilometraje actualizado');
                  } catch (err: any) {
                    showToast('error', err.message);
                  }
                }}>Guardar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {localParaFoto && (
        <ModalEvidencia
          local={localParaFoto}
          onClose={() => setLocalParaFoto(null)}
          onSuccess={() => {
            if (ruta) loadViajeData(ruta.id_ruta);
          }}
        />
      )}

      {/* Modal Resumen de Ruta */}
      {showResumenRuta && ruta && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowResumenRuta(false)}>
          <div className="bg-surface rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-black text-white">📋 Resumen de Mi Ruta</h3>
              <button onClick={() => setShowResumenRuta(false)} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Info de la ruta */}
              <div className="bg-primary/10 rounded-xl p-3 space-y-1">
                <p className="text-white font-bold text-center">{ruta.nombre}</p>
                <p className="text-text-muted text-xs text-center">{ruta.fecha}</p>
              </div>

              {/* Salida de Planta */}
              {ruta.hora_salida_planta && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-xs font-black text-white">S</span>
                    </div>
                    <span className="font-bold text-blue-400">SALIDA DE PLANTA</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Hora: {formatPeru(ruta.hora_salida_planta, 'HH:mm')}
                    {bitacora.length > 0 && <span> • Hacia: {bitacora[0].destino_nombre}</span>}
                  </p>
                </div>
              )}

              {/* Locales */}
              <div className="space-y-2">
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Locales Visitados ({locales.filter(l => l.hora_llegada).length})</p>
                {locales.map((local, idx) => {
                  const tramo = bitacora.find(b => b.destino_nombre === local.nombre);
                  const yaVisitado = !!tramo?.hora_llegada;
                  
                  return yaVisitado ? (
                    <div key={local.id_local_ruta} className="bg-green-500/10 border border-green-500/30 p-3 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span className="font-bold text-green-400">{local.nombre}</span>
                      </div>
                      <div className="mt-2 text-xs text-text-muted pl-6 space-y-1">
                        <p>⏰ Llegada: {tramo.hora_llegada ? formatPeru(tramo.hora_llegada, 'HH:mm') : '--:--'}</p>
                        {tramo.hora_salida && <p>🚗 Salida: {formatPeru(tramo.hora_salida, 'HH:mm')}</p>}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>

              {/* Llegada a Planta */}
              {ruta.hora_llegada_planta && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                      <span className="text-xs font-black text-white">L</span>
                    </div>
                    <span className="font-bold text-orange-400">LLEGADA A PLANTA</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Hora: {formatPeru(ruta.hora_llegada_planta, 'HH:mm')}
                  </p>
                </div>
              )}

              {/* Totales */}
              <div className="bg-surface-light/30 rounded-xl p-3 space-y-2">
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider">Totales</p>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Duración total:</span>
                  <span className="text-white font-bold">
                    {ruta.hora_salida_planta && ruta.hora_llegada_planta ? (() => {
                      const mins = Math.round((new Date(ruta.hora_llegada_planta).getTime() - new Date(ruta.hora_salida_planta).getTime()) / 60000);
                      return mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}min`;
                    })() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Locales visitados:</span>
                  <span className="text-white font-bold">{locales.filter(l => l.hora_llegada).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guías Viewer Modal */}
      {viewingGuias && (
        <div className="fixed inset-0 z-[100] bg-black backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="absolute top-0 left-0 right-0 p-4 flex flex-col gap-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-[110]">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <div className="text-white font-black text-sm bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 uppercase italic tracking-tighter">
                  Archivo {currentGuiaIndex + 1} / {viewingGuias.length}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoomScale(prev => Math.min(prev + 0.5, 4))} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white border border-white/5 active:scale-90 transition-all"><ZoomIn size={18} /></button>
                  <button onClick={() => setZoomScale(prev => Math.max(prev - 0.5, 1))} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white border border-white/5 active:scale-90 transition-all"><ZoomOut size={18} /></button>
                  <button onClick={() => { setZoomScale(1); }} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white border border-white/5 active:scale-90 transition-all"><Maximize2 size={18} /></button>
                </div>
              </div>
              <button 
                className="text-white bg-red-500/20 hover:bg-red-500/40 p-3 rounded-full backdrop-blur-md border border-red-500/30 transition-all active:scale-95"
                onClick={() => {
                  setViewingGuias(null);
                  setZoomScale(1);
                  setSearchTermGuias('');
                }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="relative group mx-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-primary transition-colors" />
              <input 
                type="text"
                placeholder="Buscar productos (ej: Salmón, Arroz...)"
                value={searchTermGuias}
                onChange={(e) => setSearchTermGuias(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-white/30 backdrop-blur-md transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 w-full flex items-center justify-center p-2 pt-40 pb-28 relative overflow-hidden">
            <div className={`w-full h-full flex items-center justify-center transition-transform duration-300 ease-out cursor-move ${zoomScale > 1 ? 'overflow-auto scrollbar-hide' : ''}`}>
               {viewingGuias[currentGuiaIndex].comentario && (
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                    <span className="bg-primary/90 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-sm border border-white/20">
                      {viewingGuias[currentGuiaIndex].comentario}
                    </span>
                 </div>
               )}

              <img 
                src={viewingGuias[currentGuiaIndex].archivo_url} 
                alt="Documento de despacho" 
                style={{ 
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out'
                }}
                className="w-auto h-auto max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
            
            {viewingGuias.length > 1 && (
              <>
                <button 
                  onClick={() => {
                    setCurrentGuiaIndex(prev => prev > 0 ? prev - 1 : viewingGuias.length - 1);
                    setZoomScale(1);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 p-4 rounded-full text-white backdrop-blur-sm border border-white/10 transition-all active:scale-90 z-20"
                >
                  <ChevronLeft size={32} />
                </button>
                <button 
                  onClick={() => {
                    setCurrentGuiaIndex(prev => prev < viewingGuias.length - 1 ? prev + 1 : 0);
                    setZoomScale(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 p-4 rounded-full text-white backdrop-blur-sm border border-white/10 transition-all active:scale-90 z-20"
                >
                  <ChevronRight size={32} />
                </button>
              </>
            )}
          </div>
          
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-4 overflow-x-auto z-10 py-1 scrollbar-hide">
            {viewingGuias.map((g, i) => {
              const matched = searchTermGuias && g.comentario?.toLowerCase().includes(searchTermGuias.toLowerCase());
              if (searchTermGuias && !matched) return null;

              return (
                <button
                  key={g.id_guia}
                  onClick={() => {
                    setCurrentGuiaIndex(i);
                    setZoomScale(1);
                  }}
                  className={`relative w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden shadow-lg transition-all ${currentGuiaIndex === i ? 'ring-2 ring-primary scale-110 z-10 opacity-100' : 'opacity-40 hover:opacity-100 border border-white/20'} ${matched ? 'ring-2 ring-yellow-400 scale-105 opacity-100' : ''}`}
                >
                  <img src={g.archivo_url} className="w-full h-full object-cover" />
                  {matched && (
                    <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                       <Check size={20} className="text-yellow-400 drop-shadow-lg" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal para Kilometraje Final */}
      {showFinalKmModal && ruta && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-lg">
          <Card className="max-w-md w-full border-primary/20 bg-surface shadow-2xl">
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Flag size={32} />
                </div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Ruta Finalizada</h2>
                <p className="text-text-muted text-sm">Ingresa el kilometraje final del vehículo.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Km Inicial: {ruta.km_inicio || 0}</label>
                  <Input 
                    type="number"
                    placeholder="Kilometraje Final" 
                    className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg tracking-widest"
                    value={kmFin}
                    onChange={e => setKmFin(e.target.value)}
                  />
                </div>

                {/* Foto Opcional Kilometraje Final */}
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Foto del Odómetro (Opcional)</label>
                  {!fotoKmFin ? (
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.capture = 'environment';
                        input.onchange = (e: any) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (re) => setFotoKmFin(re.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                    >
                      <Camera size={24} />
                      <span className="text-xs font-bold uppercase">Tomar Foto</span>
                    </button>
                  ) : (
                    <div className="relative group">
                      <img src={fotoKmFin} className="w-full h-32 object-cover rounded-xl border-2 border-primary/50" />
                      <button 
                        onClick={() => setFotoKmFin(null)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full h-14 text-lg font-black italic bg-primary hover:bg-primary-hover shadow-xl"
                  disabled={!kmFin || parseFloat(kmFin) <= (ruta.km_inicio || 0) || subiendoFoto}
                  onClick={async () => {
                    try {
                      setSubiendoFoto(true);
                      let publicUrlFin = '';
                      
                      if (fotoKmFin) {
                        const blob = await (await fetch(fotoKmFin)).blob();
                        const fileName = `${profile?.id_usuario}_end_${Date.now()}.jpg`;
                        const { error: uploadError } = await supabase.storage
                          .from('combustible_fotos')
                          .upload(`kilometraje/${fileName}`, blob);
                        
                        if (!uploadError) {
                          const { data } = supabase.storage.from('combustible_fotos').getPublicUrl(`kilometraje/${fileName}`);
                          publicUrlFin = data.publicUrl;
                        }
                      }

                      const { error } = await supabase
                        .from('rutas')
                        .update({ 
                          km_fin: parseFloat(kmFin),
                          foto_km_fin: publicUrlFin
                        })
                        .eq('id_ruta', ruta.id_ruta);
                      
                      if (error) throw error;
                      setRuta({ ...ruta, km_fin: parseFloat(kmFin) });
                      setShowFinalKmModal(false);
                      showToast('success', 'Kilometraje final registrado correctamente');
                    } catch (err: any) {
                      showToast('error', 'Error al guardar kilometraje: ' + err.message);
                    } finally {
                      setSubiendoFoto(false);
                    }
                  }}
                >
                  {subiendoFoto ? 'PROCESANDO...' : 'FINALIZAR Y REGISTRAR'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
