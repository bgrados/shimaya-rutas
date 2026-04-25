import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Ruta, GastoCombustible, FotoVisita, LocalRuta, ViajeBitacora } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FileDown, Download, Truck, Clock, MapPin, CheckCircle2, Calendar, Filter, X, Share2, Fuel, Download as DownloadIcon, Trash2, Edit2, Check } from 'lucide-react';
import { format, differenceInMinutes, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatPeru, formatGroupDate, formatGroupDatePdf, getStartOfCurrentWeek, getEndOfCurrentWeek, formatFriendlyDate, nowPeru, calcularDuracionMinutos, formatTimeOnly, formatHoraLocal } from '../../../lib/timezone';
import JSZip from 'jszip';
import { ImageModal } from '../../../components/ui/ImageModal';

const urlToBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

function localToday(): string { return format(new Date(), 'yyyy-MM-dd'); }

function formatMins(mins: number | null) {
  if (mins === null || mins === undefined || isNaN(mins as number)) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Period = 'diario' | 'semanal' | 'mensual';
type ReportType = 'rutas' | 'combustible' | 'otros';

interface RutaConBitacora extends Ruta { 
  bitacora?: ViajeBitacora[]; 
  duracionMins?: number | null; 
  localesRuta?: LocalRuta[]; 
  horaLlegadaReal?: string | null; 
  distanciaGpsKm?: number | null;
}
interface Usuario { id_usuario: string; nombre: string; }
interface GrupoFecha { fecha: string; gastos: GastoCombustible[]; total: number; }
interface GrupoChofer { choferId: string; choferNombre: string; gastos: GastoCombustible[]; total: number; }

const reprocessAllPhotos = async () => {
  alert('Las fotos nuevas ya se guardan con marca de agua automáticamente. Las fotos antiguas no serán reprocesadas.');
};

const applyWatermarkToUrl = async (imageUrl: string): Promise<string | null> => {
  try {
    const img = new Image();
    const timeoutPromise = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));
    const loadPromise = new Promise<void>((resolve, reject) => {
      img.onerror = () => reject(new Error('Error cargando imagen'));
      img.crossOrigin = 'anonymous'; img.src = imageUrl;
    });
    await Promise.race([loadPromise, timeoutPromise]);
    const canvas = document.createElement('canvas'); const ratio = 1200 / img.width;
    canvas.width = 1200; canvas.height = img.height * ratio;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const LOGO_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTcvbdl7qk6b_Rb5ihYLyfkqzryxsK9uiU5w&s';
    const logo = new Image(); logo.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => { logo.src = LOGO_URL; logo.onload = () => resolve(); logo.onerror = () => resolve(); });
    if (logo.complete && logo.naturalWidth > 0) {
      const logoSize = canvas.width * 0.08; const padding = canvas.width * 0.012;
      const x = canvas.width - logoSize - padding; const y = canvas.height - logoSize - padding;
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x - 2, y - 2, logoSize + 4, logoSize + 4, 6); ctx.fill();
      ctx.globalAlpha = 0.6; ctx.drawImage(logo, x, y, logoSize, logoSize); ctx.restore();
    }
    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.onerror = () => resolve(null); reader.readAsDataURL(blob); }
        else resolve(null);
      }, 'image/jpeg', 0.9);
    });
  } catch { return null; }
};

const calcularDistanciaHaversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function Reportes() {
  const [reportType, setReportType] = useState<ReportType>('rutas');
  
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [allRutas, setAllRutas] = useState<RutaConBitacora[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [rutasBase, setRutasBase] = useState<{ id_ruta_base: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reprocessingPhotos, setReprocessingPhotos] = useState(false);

  // Estado para fotos de evidencia
  const [fotosPorLocal, setFotosPorLocal] = useState<Record<string, FotoVisita[]>>({});

  // Combustible state
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [combustibleLoading, setCombustibleLoading] = useState(true);
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [filtroFecha, setFiltroFecha] = useState<'dia' | 'semana' | 'mes' | 'todo'>('dia');
  const [activePhoto, setActivePhoto] = useState<{ images: { url: string; title: string }[]; index: number } | null>(null);
  
  // Estado para editar hora de llegada
  const [editandoLlegada, setEditandoLlegada] = useState<string | null>(null);
  const [horaLlegadaEdit, setHoraLlegadaEdit] = useState('');
  const [editandoSalida, setEditandoSalida] = useState<string | null>(null);
  const [horaSalidaEdit, setHoraSalidaEdit] = useState('');
  const [activeTab, setActiveTab] = useState<'ventas' | 'gastos' | 'peajes'>('ventas');
  const [fotosCombustible, setFotosCombustible] = useState<Record<string, string>>({});
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [incluirFotosEnPDF, setIncluirFotosEnPDF] = useState(true);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [descargandoZipEvidencia, setDescargandoZipEvidencia] = useState(false);

  const handleDeleteEvidenciaFoto = async (fotoId: string, localId: string) => {
    if (!confirm('¿Eliminar esta foto de evidencia?')) return;
    
    try {
      const { error } = await supabase
        .from('fotos_visita')
        .delete()
        .eq('id_foto', fotoId);
      
      if (error) throw error;
      
      // Actualizar el estado local
      setFotosPorLocal(prev => {
        const newState = { ...prev };
        if (newState[localId]) {
          newState[localId] = newState[localId].filter(f => f.id_foto !== fotoId);
        }
        return newState;
      });
      
      alert('Foto eliminada correctamente');
    } catch (err: any) {
      console.error('Error eliminando foto:', err);
      alert('Error al eliminar: ' + (err.message || 'Verifica los permisos'));
    }
  };

  const handleDeleteGasto = async (id_gasto: string) => {
    try {
      // Primero buscar el gasto para obtener la foto_url
      const gasto = gastos.find(g => g.id_gasto === id_gasto);
      
      // Eliminar la foto del storage si existe
      if (gasto?.foto_url) {
        try {
          const urlParts = gasto.foto_url.split('/');
          const fileName = urlParts.slice(-2).join('/'); // Obtener "carpeta/archivo"
          await supabase.storage.from('combustible_fotos').remove([fileName]);
        } catch (err) {
          console.warn('No se pudo eliminar la foto del storage:', err);
        }
      }

      const { error } = await supabase
        .from('gastos_combustible')
        .delete()
        .eq('id_gasto', id_gasto);

      if (error) throw error;
      
      // Update local state
      setGastos(prev => prev.filter(g => g.id_gasto !== id_gasto));
      // Also remove from fotosCombustible state
      setFotosCombustible(prev => {
        const newState = { ...prev };
        delete newState[id_gasto];
        return newState;
      });
    } catch (err: any) {
      console.error('Error eliminando gasto:', err);
      alert('Error al eliminar: ' + (err.message || 'Verifica los permisos en Supabase'));
    }
  };

  // Funciones para editar hora de salida manualmente
  const iniciarEdicionSalida = (ruta: RutaConBitacora) => {
    if (ruta.hora_salida_planta) {
      const fecha = new Date(ruta.hora_salida_planta);
      setHoraSalidaEdit(`${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`);
    } else {
      setHoraSalidaEdit('');
    }
    setEditandoSalida(ruta.id_ruta);
  };

  const guardarEdicionSalida = async (ruta: RutaConBitacora) => {
    if (!horaSalidaEdit) return;
    
    const [h, m] = horaSalidaEdit.split(':').map(Number);
    // Crear timestamp en formato ISO con la fecha de la ruta y hora Perú
    const fechaStr = ruta.fecha || format(new Date(), 'yyyy-MM-dd');
    const nuevaHora = `${fechaStr}T${horaSalidaEdit}:00`;
    
    try {
      const { error } = await supabase
        .from('rutas')
        .update({ hora_salida_planta: nuevaHora })
        .eq('id_ruta', ruta.id_ruta);
      
      if (error) throw error;
      loadRutas();
      setEditandoSalida(null);
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'));
    }
  };

  // Funciones para editar hora de llegada manualmente
  const iniciarEdicionLlegada = (ruta: RutaConBitacora) => {
    // Si ya tiene horaLlegadaReal, usarla; si no, usar hora_llegada_planta
    const horaActual = ruta.horaLlegadaReal || ruta.hora_llegada_planta;
    if (horaActual) {
      const fecha = new Date(horaActual);
      setHoraLlegadaEdit(`${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`);
    } else {
      setHoraLlegadaEdit('');
    }
    setEditandoLlegada(ruta.id_ruta);
  };

  const guardarEdicionLlegada = async (ruta: RutaConBitacora) => {
    if (!horaLlegadaEdit) return;
    
    const fechaStr = ruta.fecha || format(new Date(), 'yyyy-MM-dd');
    const nuevaHora = `${fechaStr}T${horaLlegadaEdit}:00`;
    
    try {
      // Actualizar hora_llegada_planta en la ruta
      const { error } = await supabase
        .from('rutas')
        .update({ hora_llegada_planta: nuevaHora })
        .eq('id_ruta', ruta.id_ruta);
      
      if (error) throw error;
      
      // Actualizar la tabla bitácora - buscar el último tramo hacia planta y actualizar su hora_llegada
      const bits = ruta.bitacora || [];
      const ultimoTramoPlanta = [...bits].reverse().find(b => 
        b.destino_nombre?.toLowerCase() === 'planta' && b.hora_llegada
      );
      
      if (ultimoTramoPlanta) {
        await supabase
          .from('viajes_bitacora')
          .update({ hora_llegada: nuevaHora })
          .eq('id_bitacora', ultimoTramoPlanta.id_bitacora);
      }
      
      // Recargar los datos
      loadRutas();
      setEditandoLlegada(null);
      alert('Hora de llegada actualizada correctamente');
    } catch (err: any) {
      console.error('Error guardando hora:', err);
      alert('Error al guardar: ' + err.message);
    }
  };

  // Filtros activos
  const [filterChofer, setFilterChofer] = useState('');
  const [filterRuta, setFilterRuta] = useState('');

  function getRange(p: Period, date: string): { from: string; to: string } {
    const d = parseISO(date);
    if (p === 'diario') return { from: date, to: date };
    if (p === 'semanal') {
      const fromDate = new Date(d);
      fromDate.setDate(d.getDate() - 7);
      return { 
        from: format(fromDate, 'yyyy-MM-dd'), 
        to: date 
      };
    }
    return {
      from: format(startOfMonth(d), 'yyyy-MM-dd'),
      to: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  }

  useEffect(() => { loadData(); }, [period, selectedDate, reportType]);
  useEffect(() => { loadCombustible(); }, [filtroFecha, reportType]);

  useEffect(() => {
    supabase.from('usuarios').select('id_usuario,nombre').eq('rol', 'chofer').then(r => { if (r.data) setChoferes(r.data); });
    supabase.from('rutas_base').select('id_ruta_base,nombre').then(r => { if (r.data) setRutasBase(r.data); });
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      const { data: rutasData } = await supabase
        .from('rutas')
        .select('*')
        .gte('fecha', from)
        .lte('fecha', to)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });

      if (rutasData && rutasData.length > 0) {
        const ids = rutasData.map(r => r.id_ruta);
        const { data: bitData } = await supabase.from('viajes_bitacora').select('*').in('id_ruta', ids).order('created_at', { ascending: true });
        
        // Cargar locales_ruta para cada ruta
        const { data: localesData } = await supabase.from('locales_ruta').select('*').in('id_ruta', ids).order('orden', { ascending: true });
        
        // Cargar fotos de evidencia por local
        const localRutaIds = localesData?.map(l => l.id_local_ruta) || [];
        let fotosMap: Record<string, FotoVisita[]> = {};
        if (localRutaIds.length > 0) {
          const { data: fotosData } = await supabase.from('fotos_visita').select('*').in('id_local_ruta', localRutaIds).order('orden', { ascending: true });
          if (fotosData) {
            (fotosData as FotoVisita[]).forEach(f => {
              if (!fotosMap[f.id_local_ruta]) fotosMap[f.id_local_ruta] = [];
              fotosMap[f.id_local_ruta].push(f as FotoVisita);
            });
          }
        }
        setFotosPorLocal(fotosMap);

        const enriched = (rutasData as Ruta[]).map(r => {
          const bits = (bitData as ViajeBitacora[] || []).filter(b => b.id_ruta === r.id_ruta);
          const locales = (localesData as LocalRuta[] || []).filter(l => l.id_ruta === r.id_ruta);
          
          // Ordenar bitácora por hora de creación
          const bitsOrdenados = [...bits].sort((a, b) => 
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          );
          
          // Usar directamente las horas de la ruta (sin buscar en bitácora)
          const horaSalidaReal = r.hora_salida_planta;
          const horaLlegadaReal = r.hora_llegada_planta;
          
          // Calcular duración solo si ambas horas existen
          const duracionMins = (horaSalidaReal && horaLlegadaReal) 
            ? calcularDuracionMinutos(horaSalidaReal, horaLlegadaReal) 
            : null;

          // Calcular distancia GPS total recorrida
          let distanciaGpsKm = 0;
          const bitsValidos = bitsOrdenados.filter(b => b.gps_llegada_lat && b.gps_llegada_lng);
          
          for (let i = 0; i < bitsValidos.length - 1; i++) {
            const p1 = bitsValidos[i];
            const p2 = bitsValidos[i+1];
            distanciaGpsKm += calcularDistanciaHaversine(
              p1.gps_llegada_lat!, p1.gps_llegada_lng!,
              p2.gps_llegada_lat!, p2.gps_llegada_lng!
            );
          }

          return { ...r, bitacora: bits, localesRuta: locales, duracionMins, horaLlegadaReal, distanciaGpsKm };
        });
        setAllRutas(enriched as RutaConBitacora[]);
      } else {
        setAllRutas([]);
      }
    } catch (err) {
      console.error('[Reportes] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

async function loadCombustible() {
    setCombustibleLoading(true);
    try {
      // Calcular rango de fechas según filtro
      const now = new Date();
      let fechaDesde = '';
      let fechaHasta = '';
      
      if (filtroFecha === 'dia') {
        const hoy = format(now, 'yyyy-MM-dd');
        fechaDesde = hoy;
        fechaHasta = hoy;
      } else if (filtroFecha === 'semana') {
        const day = now.getDay();
        const inicioSemana = new Date(now);
        inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
        fechaDesde = format(inicioSemana, 'yyyy-MM-dd');
        fechaHasta = format(now, 'yyyy-MM-dd');
      } else if (filtroFecha === 'mes') {
        fechaDesde = format(now, 'yyyy-MM');
      }
      
      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre, fecha)')
        .order('created_at', { ascending: false });
      
      // Si hay filtro de fecha, filtrar por rutas
      if (fechaDesde) {
        let rutasQuery = supabase
          .from('rutas')
          .select('id_ruta')
          .gte('fecha', fechaDesde);
        
        if (fechaHasta) {
          rutasQuery = rutasQuery.lte('fecha', fechaHasta);
        }
        
        const { data: rutasData } = await rutasQuery;
        
        const rutaIds = rutasData?.map(r => r.id_ruta) || [];
        if (rutaIds.length > 0) {
          query = query.in('id_ruta', rutaIds);
        } else {
          query = query.in('id_ruta', ['']); // vacío
        }
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('[DEBUG-Gastos] Error en query Supabase:', error);
        throw error;
      }


      if (data) {
        const mapped = (data as GastoCombustible[]).map(g => ({
          ...g,
          chofer_nombre: (g as any).usuarios?.nombre,
          ruta_nombre: (g as any).rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);
        
        // Debug: mostrar primeros 3 gastos con foto_url
        const conFoto = data.filter((g: any) => g.foto_url);
        conFoto.slice(0,3).forEach((g: any) => {
        });
        
        // Mapear fotos
        const fotosMap: Record<string, string> = {};
        data.forEach((g: any) => {
          if (g.foto_url) fotosMap[g.id_gasto] = g.foto_url;
        });
        setFotosCombustible(fotosMap);
      }
    } catch (err) {
      console.error('[Gastos] Error:', err);
    } finally {
      setCombustibleLoading(false);
    }
  }

  const gastosCombustible = useMemo(() => {
    return gastos.filter(g => 
      g.tipo_combustible && 
      ['glp', 'gasolina', 'diesel'].includes(g.tipo_combustible.toLowerCase())
    );
  }, [gastos]);
  const gastosOtros = useMemo(() => gastos.filter(g => g.tipo_combustible === 'otro'), [gastos]);
  
  const getGastosFiltrados = () => {
    const now = new Date();
    const day = now.getDay();
    const hoyStr = format(now, 'yyyy-MM-dd');
    
    if (filtroFecha === 'todo') {
      return { comb: gastosCombustible, otros: gastosOtros };
    }
    
    if (filtroFecha === 'dia') {
      const comb = gastosCombustible.filter(g => (g as any).rutas?.fecha === hoyStr);
      const otros = gastosOtros.filter(g => (g as any).rutas?.fecha === hoyStr);
      return { comb, otros };
    }
    
    if (filtroFecha === 'mes') {
      const mesStr = format(now, 'yyyy-MM');
      const comb = gastosCombustible.filter((g: any) => g.rutas?.fecha?.startsWith(mesStr));
      const otros = gastosOtros.filter((g: any) => g.rutas?.fecha?.startsWith(mesStr));
      return { comb, otros };
    }
    
    // semana (default)
    const inicioSemana = new Date(now);
    inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
    const semanaStr = format(inicioSemana, 'yyyy-MM-dd');
    
    const comb = gastosCombustible.filter(g => {
      const f = (g as any).rutas?.fecha;
      return f >= semanaStr && f <= hoyStr;
    });
    const otros = gastosOtros.filter(g => {
      const f = (g as any).rutas?.fecha;
      return f >= semanaStr && f <= hoyStr;
    });
    
    return { comb, otros };
  };

  const rutas = useMemo(() => {
    return allRutas.filter(r => {
      if (filterChofer && r.id_chofer !== filterChofer) return false;
      if (filterRuta && !r.nombre?.toLowerCase().includes(filterRuta.toLowerCase())) return false;
      return true;
    });
  }, [allRutas, filterChofer, filterRuta]);

  const { from, to } = getRange(period, selectedDate);
  const totalRutas = rutas.length;
  const finalizadas = rutas.filter(r => r.estado === 'finalizada').length;
  const enProgreso = rutas.filter(r => r.estado === 'en_progreso').length;
  const pendientes = totalRutas - finalizadas - enProgreso;

  const rangoLabel = {
    diario: format(parseISO(from), "EEEE d 'de' MMMM yyyy", { locale: es }),
    semanal: `${format(parseISO(from), "d MMM", { locale: es })} – ${format(parseISO(to), "d MMM yyyy", { locale: es })}`,
    mensual: format(parseISO(from), "MMMM yyyy", { locale: es }),
  }[period];

  const choferNombre = filterChofer ? choferes.find(c => c.id_usuario === filterChofer)?.nombre || '' : '';

  const handleDownloadFoto = (base64Data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportarFotosZip = async () => {
    const fotosConGastos = [...gastosCombustible, ...gastosOtros].filter(g => fotosCombustible[g.id_gasto]);
    if (fotosConGastos.length === 0) {
      alert('No hay fotos para exportar');
      return;
    }

    setDescargandoZip(true);
    try {
      const zip = new JSZip();
      const fecha = format(new Date(), 'yyyy-MM-dd');
      
      for (const gasto of fotosConGastos) {
        const fotoBase64 = fotosCombustible[gasto.id_gasto];
        if (fotoBase64) {
          const nombreArchivo = `${gasto.chofer_nombre || 'chofer'}_${gasto.tipo_combustible}_${gasto.monto}.jpg`;
          const base64Data = fotoBase64.split(',')[1];
          zip.file(nombreArchivo, base64Data, { base64: true });
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fotos_gastos_${fecha}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Zip] Error:', err);
      alert('Error al exportar fotos');
    } finally {
      setDescargandoZip(false);
    }
  };

  const handleExportarEvidenciaZip = async () => {
    const todasLasFotos: { foto: FotoVisita; local: any; ruta: any }[] = [];
    
    allRutas.forEach(ruta => {
      if (ruta.localesRuta) {
        ruta.localesRuta.forEach(local => {
          const fotos = fotosPorLocal[local.id_local_ruta] || [];
          fotos.forEach(foto => {
            todasLasFotos.push({ foto, local, ruta });
          });
        });
      }
    });

    if (todasLasFotos.length === 0) {
      alert('No hay fotos de evidencia para exportar');
      return;
    }

    setDescargandoZipEvidencia(true);
    try {
      const zip = new JSZip();
      const fecha = format(new Date(), 'yyyy-MM-dd');
      
      for (const item of todasLasFotos) {
        try {
          const response = await fetch(item.foto.foto_url);
          const blob = await response.blob();
          const nombreArchivo = `${item.ruta.nombre || 'ruta'}_${item.local.nombre || 'local'}_${item.foto.id_foto}.jpg`;
          zip.file(nombreArchivo, blob);
        } catch (err) {
          console.warn('[Evidencia] Error descargando foto:', item.foto.id_foto);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evidencia_fotos_${fecha}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Evidencia Zip] Error:', err);
      alert('Error al exportar evidencia');
    } finally {
      setDescargandoZipEvidencia(false);
    }
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `🚛 *Reporte Shimaya – ${rangoLabel.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `📦 Total rutas: *${totalRutas}*`,
      `✅ Finalizadas: *${finalizadas}*`,
      `🔵 En progreso: *${enProgreso}*`,
      `🟡 Pendientes: *${pendientes}*`,
      '',
      ...rutas.filter(r => r.estado === 'finalizada').map(r =>
        `🚛 ${r.nombre} (${r.placa || '-'}) · ${r.duracionMins ? formatMins(r.duracionMins) : 'sin tiempo'}`
      ),
      '',
      `_Generado desde Shimaya Rutas_`,
    ];
    const texto = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  // Generador PDF para Rutas
  const handleGeneratePDF = () => {
    setGenerating(true);
    const rows = rutas.map(r => {
      const bits = r.bitacora || [];
      const estadoBadge = r.estado === 'finalizada' ? '#22c55e' : r.estado === 'en_progreso' ? '#3b82f6' : '#eab308';
      const paradas = bits.map((b: any, i: number) => {
        const transito = b.hora_salida && b.hora_llegada
          ? calcularDuracionMinutos(b.hora_salida, b.hora_llegada) : null;
        const nextBit = bits[i + 1];
        const permanencia = b.hora_llegada && nextBit?.hora_salida
          ? calcularDuracionMinutos(b.hora_llegada, nextBit.hora_salida) : null;
        return `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;">${i + 1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${b.origen_nombre || '-'} → ${b.destino_nombre || '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_salida ? formatHoraLocal(b.hora_salida) : '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_llegada ? formatHoraLocal(b.hora_llegada) : '⏳'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:bold;color:#4f46e5;">${transito !== null ? transito + ' min' : '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:bold;color:#f59e0b;">${permanencia !== null ? permanencia + ' min' : '-'}</td>
        </tr>`;
      }).join('');

return `<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#1e293b;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong style="font-size:14px;">🚛 ${r.nombre}</strong>
            <span style="margin-left:10px;font-size:12px;opacity:0.6;">${r.placa || 'Sin placa'}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;opacity:0.7;">📅 ${r.fecha ? formatFriendlyDate(r.fecha) : '-'}</span>
            <span style="background:${estadoBadge}22;color:${estadoBadge};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;border:1px solid ${estadoBadge}44;">${r.estado?.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        <div style="padding:8px 16px;background:#f8fafc;font-size:12px;color:#64748b;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #e2e8f0;">
          ${r.hora_salida_planta ? `<span>🕐 Salida planta: <strong>${formatHoraLocal(r.hora_salida_planta)}</strong></span>` : ''}
          ${r.horaLlegadaReal ? `<span>🏁 Llegada planta: <strong>${formatHoraLocal(r.horaLlegadaReal)}</strong></span>` : ''}
          ${r.duracionMins ? `<span>⏱ Duración total: <strong>${formatMins(r.duracionMins)}</strong></span>` : ''}
        </div>
        ${bits.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">#</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Tramo</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Salida</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Llegada</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Trnsito</th>
            <th style="padding:6px 8px;text-align:left;color:#f59e0b;font-weight:600;">Permanencia</th>
          </tr></thead>
          <tbody>${paradas}</tbody>
        </table>` :
        '<p style="padding:10px 16px;color:#94a3b8;font-size:12px;font-style:italic;margin:0;">Sin movimientos registrados</p>'}
        ${incluirFotosEnPDF && (r.localesRuta || []).length > 0 ? (() => {
          const allFotos: { url: string; localName: string }[] = [];
          (r.localesRuta || []).forEach((local: any) => {
            const fotos = fotosPorLocal[local.id_local_ruta] || [];
            fotos.forEach((f: any) => {
              allFotos.push({ url: f.foto_url, localName: local.nombre || 'Local' });
            });
          });

          if (allFotos.length === 0) return '';

          return `<div style="padding:15px; background:#fff; border-top:1px solid #e2e8f0;">
            <p style="font-size:12px; font-weight:bold; color:#1e293b; margin:0 0 10px 0; border-bottom:2px solid #3b82f6; display:inline-block;">📸 EVIDENCIAS FOTOGRÁFICAS</p>
            <div style="width:100%;">
              ${allFotos.map(f => `
                <div style="width:48.5%; display:inline-block; vertical-align:top; margin-right:1%; margin-bottom:12px; break-inside:avoid; border:1px solid #f1f5f9; border-radius:8px; overflow:hidden; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                  <img src="${f.url}" style="width:100%; height:160px; object-fit:cover; display:block;" />
                  <div style="padding:6px 8px; background:#f8fafc; border-top:1px solid #f1f5f9;">
                    <p style="font-size:10px; color:#475569; font-weight:600; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${f.localName}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
        })() : ''}
      </div>`;
    }).join('');

    const filtrosTexto = [
      filterChofer ? `Chofer: ${choferNombre}` : '',
      filterRuta ? `Ruta: ${filterRuta}` : '',
    ].filter(Boolean).join(' · ') || 'Todos los registros';

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Shimaya – ${rangoLabel}</title>
<style>
  @media print { @page { margin: 18mm 15mm; } button { display: none !important; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: white; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; text-transform: capitalize; }
  .badge-row { display: flex; gap: 10px; padding: 12px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .badge { display: flex; flex-direction: column; align-items: center; padding: 8px 18px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
  .badge-val { font-size: 22px; font-weight: 900; color: #0f172a; }
  .badge-lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
  .filter-bar { padding: 8px 28px; background: #fffbeb; border-bottom: 1px solid #fde68a; font-size: 12px; color: #92400e; }
  .content { padding: 20px 28px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; padding: 16px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(34,197,94,0.4); }
  .close-btn { position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; z-index: 9999; }
</style>
</head>
<body>
<button class="close-btn" onclick="if(window.opener){window.close();}else{history.back();}">✕ Cerrar</button>
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <div>
      <p class="header-title">SHIMAYA RUTAS & LOGÍSTICA</p>
      <p class="header-sub">📋 Reporte ${period.charAt(0).toUpperCase() + period.slice(1)} · ${rangoLabel}</p>
    </div>
  </div>
  <div style="font-size:11px;opacity:0.5;text-align:right;">Generado:<br>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
</div>

${filtrosTexto !== 'Todos los registros' ? `<div class="filter-bar">🔍 Filtros aplicados: <strong>${filtrosTexto}</strong></div>` : ''}

<div class="badge-row">
  <div class="badge"><span class="badge-val">${totalRutas}</span><span class="badge-lbl">Total Rutas</span></div>
  <div class="badge"><span class="badge-val" style="color:#22c55e;">${finalizadas}</span><span class="badge-lbl">Finalizadas</span></div>
  <div class="badge"><span class="badge-val" style="color:#3b82f6;">${enProgreso}</span><span class="badge-lbl">En Progreso</span></div>
  <div class="badge"><span class="badge-val" style="color:#eab308;">${pendientes}</span><span class="badge-lbl">Pendientes</span></div>
</div>

<div class="content">
  ${rows || '<p style="color:#94a3b8;text-align:center;padding:40px;font-style:italic;">No hay rutas que coincidan con el filtro seleccionado.</p>'}
</div>
<div class="footer">Shimaya Rutas © ${new Date().getFullYear()} — Este reporte es de uso interno<br/><span style="font-size:10px;color:#94a3b8;">Desarrollado por BGD</span></div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</body></html>`;

const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
    setGenerating(false);
  };

  // Funciones combustible
  const gastosAgrupadosPorFecha = (): GrupoFecha[] => {
    const grupos: Record<string, GastoCombustible[]> = {};
    gastosCombustible.forEach(gasto => {
      const fecha = gasto.created_at ? new Date(new Date(gasto.created_at).getTime() + 19*60*60*1000).toISOString().split('T')[0] : 'sin fecha';
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(gasto);
    });
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, gastoss]) => ({
        fecha,
        gastos: gastoss,
        total: gastoss.reduce((sum, g) => sum + (g.monto || 0), 0)
      }));
  };

  const gastosAgrupadosPorChofer = (): GrupoChofer[] => {
    const grupos: Record<string, { nombre: string; gastos: GastoCombustible[] }> = {};
    gastosCombustible.forEach(gasto => {
      const choferId = gasto.id_chofer || 'sin chofer';
      const choferNombre = gasto.chofer_nombre || 'Sin nombre';
      if (!grupos[choferId]) {
        grupos[choferId] = { nombre: choferNombre, gastos: [] };
      }
      grupos[choferId].gastos.push(gasto);
    });
    return Object.entries(grupos)
      .sort(([, a], [, b]) => b.gastos.length - a.gastos.length)
      .map(([choferId, data]) => ({
        choferId,
        choferNombre: data.nombre,
        gastos: data.gastos,
        total: data.gastos.reduce((sum, g) => sum + (g.monto || 0), 0)
      }));
  };

  const totalesPorTipo = gastosCombustible.reduce((acc, g) => {
    const tipo = g.tipo_combustible || 'otro';
    acc[tipo] = (acc[tipo] || 0) + (g.monto || 0);
    return acc;
  }, {} as Record<string, number>);

  const totalGeneral = gastosCombustible.reduce((sum, g) => sum + (g.monto || 0), 0);

  const getFiltroLabel = () => {
    if (filtroFecha === 'dia') return 'Hoy';
    if (filtroFecha === 'semana') return 'Esta semana';
    if (filtroFecha === 'mes') return 'Este mes';
    return 'Todo';
  };

  const urlToBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleExportarOtrosPDF = () => {
    const periodoLabel = getFiltroLabel();
    const totalOtros = gastosOtros.reduce((sum, g) => sum + (g.monto || 0), 0);
    
    const gastosHTML = gastosOtros.map(gasto => {
      const estadoIcon = gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente' ? '⏳' : '✗';
      const estadoColor = gasto.estado === 'confirmado' ? '#22c55e' : gasto.estado === 'pendiente' ? '#eab308' : '#ef4444';
      
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px;color:#475569;">${gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy') : '-'}</td>
        <td style="padding:8px;font-weight:600;color:#1e293b;">${gasto.chofer_nombre || '-'}</td>
        <td style="padding:8px;color:#475569;">${gasto.ruta_nombre || '-'}</td>
        <td style="padding:8px;text-align:center;"><span style="background:${estadoColor}22;color:${estadoColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">${estadoIcon}</span></td>
        <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a;">S/ ${(gasto.monto || 0).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Otros Gastos - ${periodoLabel}</title>
<style>
  @media print { @page { margin: 18mm 15mm; } button { display: none !important; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: white; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; }
  .badge-row { display: flex; gap: 10px; padding: 16px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .badge { display: flex; flex-direction: column; align-items: center; padding: 8px 18px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
  .badge-val { font-size: 20px; font-weight: 900; color: #0f172a; }
  .badge-lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
  .content { padding: 20px 28px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; padding: 16px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
  .close-btn { position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; z-index: 9999; }
</style>
</head>
<body>
<button class="close-btn" onclick="if(window.opener){window.close();}else{history.back();}">✕ Cerrar</button>
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <div>
      <p class="header-title">💰 SHIMAYA RUTAS & LOGÍSTICA</p>
      <p class="header-sub">📋 Otros Gastos · ${periodoLabel}</p>
    </div>
  </div>
  <div style="font-size:11px;opacity:0.5;text-align:right;">Generado:<br>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
</div>

<div class="badge-row">
  <div class="badge"><span class="badge-val" style="color:#f59e0b;">S/ ${totalOtros.toFixed(2)}</span><span class="badge-lbl">Total General</span></div>
  <div class="badge"><span class="badge-val">${gastosOtros.length}</span><span class="badge-lbl">Total Gastos</span></div>
</div>

<div class="content">
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f1f5f9;">
      <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Fecha</th>
      <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Chofer</th>
      <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Ruta</th>
      <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Estado</th>
      <th style="padding:8px;text-align:right;color:#475569;font-weight:600;">Monto</th>
    </tr></thead>
    <tbody>${gastosHTML}</tbody>
    <tfoot style="background:#f1f5f9;font-weight:bold;">
      <tr>
        <td style="padding:8px;text-align:left;" colspan="4">Total</td>
        <td style="padding:8px;text-align:right;color:#16a34a;">S/ ${totalOtros.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<div class="footer">
  Shimaya Rutas & Logística · Reporte de Otros Gastos
</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const handleExportarCombustiblePDF = () => {
    const periodoLabel = getFiltroLabel();
    const estadoLabel = 'Todos';
    
    const gruposHTML = agruparPor === 'fecha' 
      ? gastosAgrupadosPorFecha().map(grupo => {
          const gastosHTML = grupo.gastos.map(gasto => {
            const estadoIcon = gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente_revision' ? '⏳' : '✗';
            const estadoColor = gasto.estado === 'confirmado' ? '#22c55e' : gasto.estado === 'pendiente_revision' ? '#eab308' : '#ef4444';
            
            return `<tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px;color:#475569;">${gasto.created_at ? formatPeru(gasto.created_at, 'HH:mm') : '-'}</td>
              <td style="padding:8px;font-weight:600;color:#1e293b;">${gasto.chofer_nombre || '-'}</td>
              <td style="padding:8px;color:#475569;text-transform:uppercase;">${gasto.tipo_combustible || '-'}</td>
              <td style="padding:8px;text-align:center;"><span style="background:${estadoColor}22;color:${estadoColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">${estadoIcon}</span></td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a;">S/ ${(gasto.monto || 0).toFixed(2)}</td>
            </tr>`;
          }).join('');
          
          return `<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <div style="background:#1e293b;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
              <div><strong style="font-size:14px;">📅 ${formatGroupDatePdf(grupo.fecha)}</strong></div>
              <div style="background:#22c55e22;color:#22c55e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">Total: S/ ${grupo.total.toFixed(2)}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Hora</th>
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Chofer</th>
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Tipo</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Estado</th>
                <th style="padding:8px;text-align:right;color:#475569;font-weight:600;">Monto</th>
              </tr></thead>
              <tbody>${gastosHTML}</tbody>
            </table>
          </div>`;
        })
      : gastosAgrupadosPorChofer().map(grupo => {
          const porTipo = grupo.gastos.reduce((acc, gg) => {
            const t = gg.tipo_combustible || 'otro';
            acc[t] = (acc[t] || 0) + (gg.monto || 0);
            return acc;
          }, {} as Record<string, number>);
          
          let detallesTipo = '';
          if (porTipo.glp) detallesTipo += `<span style="background:#22c55e22;color:#22c55e;padding:2px 8px;border-radius:4px;margin-right:4px;font-size:11px;">GLP: S/ ${porTipo.glp.toFixed(2)}</span>`;
          if (porTipo.gasolina) detallesTipo += `<span style="background:#3b82f622;color:#3b82f6;padding:2px 8px;border-radius:4px;margin-right:4px;font-size:11px;">Gasolina: S/ ${porTipo.gasolina.toFixed(2)}</span>`;
          if (porTipo.diesel) detallesTipo += `<span style="background:#f9731622;color:#f97316;padding:2px 8px;border-radius:4px;margin-right:4px;font-size:11px;">Diesel: S/ ${porTipo.diesel.toFixed(2)}</span>`;
          
          const gastosHTML = grupo.gastos.map(gasto => {
            const estadoIcon = gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente_revision' ? '⏳' : '✗';
            const estadoColor = gasto.estado === 'confirmado' ? '#22c55e' : gasto.estado === 'pendiente_revision' ? '#eab308' : '#ef4444';
            
            return `<tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px;color:#475569;">${gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM HH:mm') : '-'}</td>
              <td style="padding:8px;color:#475569;">${gasto.tipo_combustible || '-'}</td>
              <td style="padding:8px;text-align:center;"><span style="background:${estadoColor}22;color:${estadoColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">${estadoIcon}</span></td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a;">S/ ${(gasto.monto || 0).toFixed(2)}</td>
            </tr>`;
          }).join('');
          
          return `<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <div style="background:#1e293b;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
              <div><strong style="font-size:14px;">🚛 ${grupo.choferNombre}</strong></div>
              <div style="background:#22c55e22;color:#22c55e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">Total: S/ ${grupo.total.toFixed(2)} (${grupo.gastos.length} cargas)</div>
            </div>
            <div style="padding:8px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">${detallesTipo}</div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Hora</th>
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Tipo</th>
                <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Estado</th>
                <th style="padding:8px;text-align:right;color:#475569;font-weight:600;">Monto</th>
              </tr></thead>
              <tbody>${gastosHTML}</tbody>
            </table>
          </div>`;
        });
    
    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Combustible - ${periodoLabel}</title>
<style>
  @media print { @page { margin: 18mm 15mm; } button { display: none !important; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: white; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; }
  .badge-row { display: flex; gap: 10px; padding: 16px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .badge { display: flex; flex-direction: column; align-items: center; padding: 8px 18px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
  .badge-val { font-size: 20px; font-weight: 900; color: #0f172a; }
  .badge-lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
  .content { padding: 20px 28px; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; padding: 16px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(34,197,94,0.4); }
  .close-btn { position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; z-index: 9999; }
</style>
</head>
<body>
<button class="close-btn" onclick="if(window.opener){window.close();}else{history.back();}">✕ Cerrar</button>
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <div>
      <p class="header-title">⛽ SHIMAYA RUTAS & LOGÍSTICA</p>
      <p class="header-sub">📋 Reporte de Combustible · ${periodoLabel}</p>
    </div>
  </div>
  <div style="font-size:11px;opacity:0.5;text-align:right;">Generado:<br>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
</div>

<div class="badge-row">
  <div class="badge"><span class="badge-val" style="color:#22c55e;">S/ ${totalGeneral.toFixed(2)}</span><span class="badge-lbl">Total General</span></div>
  <div class="badge"><span class="badge-val">${gastosCombustible.length}</span><span class="badge-lbl">Total Cargas</span></div>
  <div class="badge"><span class="badge-val" style="color:#22c55e;">S/ ${(totalesPorTipo.glp || 0).toFixed(2)}</span><span class="badge-lbl">GLP</span></div>
  <div class="badge"><span class="badge-val" style="color:#3b82f6;">S/ ${(totalesPorTipo.gasolina || 0).toFixed(2)}</span><span class="badge-lbl">Gasolina</span></div>
  <div class="badge"><span class="badge-val" style="color:#f97316;">S/ ${(totalesPorTipo.diesel || 0).toFixed(2)}</span><span class="badge-lbl">Diesel</span></div>
</div>

<div class="content">
  <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Agrupado por: ${agruparPor === 'fecha' ? 'Fecha' : 'Chofer'}</p>
  ${gruposHTML.join('')}
  ${incluirFotosEnPDF ? (() => {
    const gastosConFoto = gastosCombustible.filter(g => fotosCombustible[g.id_gasto]);
    if (gastosConFoto.length === 0) return '';
    let fotosHTML = `<div style="margin-top:30px;">
      <h3 style="color:#1e293b;font-size:16px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">📸 Fotos de Comprobantes (${gastosConFoto.length})</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">`;
    gastosConFoto.forEach(gasto => {
      const fotoBase64 = fotosCombustible[gasto.id_gasto];
      if (fotoBase64) {
        fotosHTML += `<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <img src="${fotoBase64}" style="width:100%;height:120px;object-fit:cover;" />
          <div style="padding:8px;font-size:10px;color:#64748b;">
            <strong>${gasto.chofer_nombre || '-'}</strong><br/>
            S/ ${(gasto.monto || 0).toFixed(2)} - ${gasto.tipo_combustible?.toUpperCase() || '-'}<br/>
            ${gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy HH:mm') : ''}
          </div>
        </div>`;
      }
    });
    return fotosHTML + `</div></div>`;
  })() : ''}
</div>
<div class="footer">Shimaya Rutas © ${new Date().getFullYear()} — Este reporte es de uso interno<br/><span style="font-size:10px;color:#94a3b8;">Desarrollado por BGD</span></div>
<button class="Print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</body></html>`;

const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  };

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'diario', label: 'Diario' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensual', label: 'Mensual' },
  ];

  const hasFilters = filterChofer || filterRuta;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Reportes</h1>
          <p className="text-text-muted text-sm capitalize">{rangoLabel}</p>
          <p className="text-xs text-text-muted">Las fotos nuevas se guardan con marca de agua automáticamente.</p>
        </div>
        
        {/* Tipo de reporte */}
        <div className="flex bg-surface rounded-xl overflow-hidden border border-surface-light">
          <button
            onClick={() => setReportType('rutas')}
            className={`px-4 py-2 font-medium transition-colors ${reportType === 'rutas' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}
          >
            <Truck size={16} className="inline mr-2" />
            Rutas
          </button>
          <button
            onClick={() => setReportType('combustible')}
            className={`px-4 py-2 font-medium transition-colors ${reportType === 'combustible' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}
          >
            <Fuel size={16} className="inline mr-2" />
            Combustible
          </button>
          <button
            onClick={() => setReportType('otros')}
            className={`px-4 py-2 font-medium transition-colors ${reportType === 'otros' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}
          >
            <FileDown size={16} className="inline mr-2" />
            Otros
          </button>
        </div>
      </div>

      {reportType === 'rutas' ? (
        <>
          {/* FILTROS RUTAS */}
          <Card className="border-surface-light">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex bg-surface-light rounded-xl overflow-hidden border border-white/5">
                  {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)}
                      className={`px-5 py-2.5 text-sm font-black italic transition-all ${period === p.key ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-primary" />
                  <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="bg-surface-light border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center border-t border-white/5 pt-4">
                <Filter size={14} className="text-text-muted" />
                <span className="text-xs text-text-muted uppercase font-black tracking-widest">Filtrar por:</span>

                <div className="relative">
                  <select value={filterRuta} onChange={e => setFilterRuta(e.target.value)}
                    className="bg-surface-light border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white text-sm appearance-none focus:outline-none focus:border-primary min-w-[160px]">
                    <option value="">Todas las rutas</option>
                    {rutasBase.map(r => <option key={r.id_ruta_base} value={r.nombre}>{r.nombre}</option>)}
                  </select>
                </div>

                <div className="relative">
                  <select value={filterChofer} onChange={e => setFilterChofer(e.target.value)}
                    className="bg-surface-light border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white text-sm appearance-none focus:outline-none focus:border-primary min-w-[160px]">
                    <option value="">Todos los choferes</option>
                    {choferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
                  </select>
                </div>

                {hasFilters && (
                  <button onClick={() => { setFilterChofer(''); setFilterRuta(''); }}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                    <X size={12} /> Limpiar
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* BOTONES EXPORTAR */}
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={handleShareWhatsApp} disabled={rutas.length === 0} className="bg-[#25D366] hover:bg-[#1fb85a] flex items-center gap-2 font-black">
              <Share2 size={18} /> WhatsApp
            </Button>
            <Button onClick={handleGeneratePDF} disabled={generating} className="bg-green-600 hover:bg-green-700 flex items-center gap-2 font-black">
              <FileDown size={18} /> {generating ? 'Generando...' : 'Exportar PDF'}
            </Button>
            <label className="flex items-center gap-2 cursor-pointer bg-surface-light px-3 py-2 rounded-xl border border-white/10">
              <input 
                type="checkbox" 
                checked={incluirFotosEnPDF} 
                onChange={(e) => setIncluirFotosEnPDF(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-white text-sm">Incluir fotos</span>
            </label>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Rutas', value: totalRutas, color: 'text-white', icon: Truck },
              { label: 'Finalizadas', value: finalizadas, color: 'text-green-400', icon: CheckCircle2 },
              { label: 'En Progreso', value: enProgreso, color: 'text-blue-400', icon: Clock },
              { label: 'Pendientes', value: pendientes, color: 'text-yellow-400', icon: MapPin },
            ].map(s => (
              <Card key={s.label} className="border-surface-light">
                <CardContent className="p-5 flex items-center gap-4">
                  <s.icon size={22} className={s.color + ' opacity-70'} />
                  <div>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-text-muted text-xs">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* LISTA RUTAS */}
          {loading ? (
            <div className="text-white italic animate-pulse text-center py-16">Cargando datos...</div>
          ) : rutas.length === 0 ? (
            <div className="text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
              <Truck size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
              <p className="text-text-muted italic">No hay rutas que coincidan con los filtros.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rutas.map(ruta => {
                const bits = ruta.bitacora || [];
                const estadoColor = ruta.estado === 'finalizada' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : ruta.estado === 'en_progreso' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                return (
                  <Card key={ruta.id_ruta} className="border-surface-light/50 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Truck size={18} className="text-primary" />
                        <div>
                          <p className="font-black text-white italic">{ruta.nombre}</p>
                          <p className="text-xs text-text-muted">
                            🚛 {ruta.placa || 'Sin placa'} &nbsp;·&nbsp;
                            📅 {ruta.fecha ? formatFriendlyDate(ruta.fecha) : '-'} &nbsp;·&nbsp;
                            👤 {ruta.chofer_nombre || 'S/C'} {ruta.nombre_asistente ? `+ ${ruta.nombre_asistente}` : ''} &nbsp;·&nbsp;
                            📍 {ruta.km_inicio || '0'} → {ruta.km_fin || '?'} KM
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {editandoSalida === ruta.id_ruta ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={horaSalidaEdit}
                              onChange={(e) => setHoraSalidaEdit(e.target.value)}
                              className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-blue-500"
                            />
                            <button
                              onClick={() => guardarEdicionSalida(ruta)}
                              className="p-1 bg-green-600 hover:bg-green-700 rounded text-white"
                              title="Guardar"
                            ><Check size={14} /></button>
                            <button
                              onClick={() => setEditandoSalida(null)}
                              className="p-1 bg-gray-600 hover:bg-gray-700 rounded text-white"
                              title="Cancelar"
                            ><X size={14} /></button>
                          </div>
                        ) : (
                          <>
                            {ruta.hora_salida_planta && (
                              <span className="text-xs text-text-muted flex items-center gap-1">
                                🕐 <span className="cursor-pointer hover:text-white" onClick={() => iniciarEdicionSalida(ruta)}>
                                  {formatHoraLocal(ruta.hora_salida_planta)}
                                </span>
                              </span>
                            )}
                          </>
                        )}
                        {editandoLlegada === ruta.id_ruta ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={horaLlegadaEdit}
                              onChange={(e) => setHoraLlegadaEdit(e.target.value)}
                              className="bg-surface-light text-white text-xs px-2 py-1 rounded border border-primary"
                            />
                            <button
                              onClick={() => guardarEdicionLlegada(ruta)}
                              className="p-1 bg-green-600 hover:bg-green-700 rounded text-white"
                              title="Guardar"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditandoLlegada(null)}
                              className="p-1 bg-surface-light hover:bg-red-600 rounded text-text-muted hover:text-white"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : !editandoSalida && (
                          <button
                            onClick={() => iniciarEdicionLlegada(ruta)}
                            className="p-1 hover:bg-surface-light rounded text-text-muted hover:text-primary transition-colors"
                            title="Editar hora de llegada"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {ruta.estado === 'finalizada' && ruta.hora_salida_planta && ruta.horaLlegadaReal && (
                          <span className="text-xs text-text-muted ml-2">
                            🕐 {formatHoraLocal(ruta.hora_salida_planta)} → {formatHoraLocal(ruta.horaLlegadaReal)}
                            {ruta.duracionMins && ` (${formatMins(ruta.duracionMins)})`}
                          </span>
                        )}
                        <span className={`text-xs font-black uppercase px-2 py-1 rounded-full border ${estadoColor}`}>
                          {ruta.estado?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    {bits.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-text-muted border-b border-white/5">
                              {['#', 'Tramo', 'Salida', 'Llegada', 'Duración'].map(h => (
                                <th key={h} className="px-4 py-2 text-left font-bold uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bits.map((b: any, i: number) => {
                              const dur = b.hora_salida && b.hora_llegada ? calcularDuracionMinutos(b.hora_salida, b.hora_llegada) : null;
                              return (
                                <tr key={b.id_bitacora} className="border-b border-white/5 hover:bg-white/5">
                                  <td className="px-4 py-2 text-primary font-black">{i + 1}</td>
                                  <td className="px-4 py-2 text-white font-bold italic">{b.origen_nombre} <span className="text-primary">→</span> {b.destino_nombre}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_salida ? formatHoraLocal(b.hora_salida) : '-'}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_llegada ? formatHoraLocal(b.hora_llegada) : <span className="text-blue-400 animate-pulse">En camino</span>}</td>
                                  <td className="px-4 py-2 font-bold text-primary">{formatMins(dur)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-text-muted text-xs italic p-4">Sin movimientos registrados.</p>
                    )}

                    {/* Fotos de evidencia por local */}
                    {ruta.localesRuta && ruta.localesRuta.length > 0 && (
                      <div className="p-4 bg-surface-light/20 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-text-muted font-bold uppercase">📸 Evidencia por Local</p>
                          <button
                            onClick={handleExportarEvidenciaZip}
                            disabled={descargandoZipEvidencia}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <DownloadIcon size={12} />
                            {descargandoZipEvidencia ? 'Descargando...' : 'Descargar todas'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {ruta.localesRuta.map((local: any) => {
                            const fotos = fotosPorLocal[local.id_local_ruta] || [];
                            if (fotos.length === 0) return null;
                            return (
                              <div key={local.id_local_ruta} className="bg-surface rounded-lg p-2 border border-surface-light">
                                <p className="text-[10px] text-white font-medium truncate mb-1">{local.nombre || 'Local'}</p>
                                <div className="grid grid-cols-3 gap-1">
                                  {fotos.map((foto: any, idx: number) => (
                                    <div key={foto.id_foto} className="relative group">
                                      <button 
                                        onClick={() => {
                                          // Recopilar TODAS las fotos de la ruta para la galería
                                          const allRouteFotos: { url: string; title: string }[] = [];
                                          ruta.localesRuta.forEach((l: any) => {
                                            const lFotos = fotosPorLocal[l.id_local_ruta] || [];
                                            lFotos.forEach((f: any) => {
                                              allRouteFotos.push({ url: f.foto_url, title: l.nombre || 'Evidencia' });
                                            });
                                          });
                                          
                                          if (allRouteFotos.length === 0) {
                                            alert('No hay fotos disponibles');
                                            return;
                                          }
                                          
                                          const clickedIndex = allRouteFotos.findIndex(f => f.url === foto.foto_url);
                                          const finalIndex = clickedIndex >= 0 ? clickedIndex : 0;
                                          
                                          
                                          setActivePhoto({ 
                                            images: allRouteFotos, 
                                            index: finalIndex 
                                          });
                                        }}
                                        className="w-full block"
                                      >
                                        <img 
                                          src={foto.foto_url} 
                                          alt={`Evidencia ${idx + 1}`} 
                                          className="w-full aspect-square object-cover rounded cursor-zoom-in hover:brightness-110 transition-all"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="12"%3EImagen no disponible%3C/text%3E%3C/svg%3E';
                                          }}
                                        />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = document.createElement('a');
                                          link.href = foto.foto_url;
                                          link.download = `${local.nombre}_evidencia_${idx + 1}.jpg`;
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                        }}
                                        className="absolute bottom-1 right-1 bg-black/60 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Descargar"
                                      >
                                        <DownloadIcon size={12} className="text-white" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteEvidenciaFoto(foto.id_foto, local.id_local_ruta);
                                        }}
                                        className="absolute bottom-1 left-1 bg-red-600 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Eliminar"
                                      >
                                        <Trash2 size={12} className="text-white" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
        {/* REPORTES COMBUSTIBLE */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-title { font-size: 20px !important; font-weight: bold !important; }
          }
        `}</style>
        
        <div id="combustible-report-content" className="flex flex-wrap gap-4 mb-6">
          <select
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value as any)}
            className="bg-surface border border-surface-light rounded-lg px-4 py-2 text-white"
          >
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="todo">Todo</option>
          </select>

          <div className="flex gap-2">
            <button
              onClick={() => setAgruparPor('fecha')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${agruparPor === 'fecha' ? 'bg-blue-600 text-white' : 'bg-surface text-text-muted'}`}
            >
              <Calendar size={16} className="inline mr-2" />
              Por Fecha
            </button>
            <button
              onClick={() => setAgruparPor('chofer')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${agruparPor === 'chofer' ? 'bg-green-600 text-white' : 'bg-surface text-text-muted'}`}
            >
              <Truck size={16} className="inline mr-2" />
              Por Chofer
            </button>
          </div>

          <Button onClick={handleExportarCombustiblePDF} className="flex items-center gap-2">
            <Download size={18} />
            Exportar PDF
          </Button>
          <label className="flex items-center gap-2 cursor-pointer bg-surface-light px-3 py-2 rounded-xl border border-white/10">
            <input 
              type="checkbox" 
              checked={incluirFotosEnPDF} 
              onChange={(e) => setIncluirFotosEnPDF(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-white text-sm">Incluir fotos</span>
          </label>
        </div>

        {/* Título para impresión */}
        <div className="print-title hidden mb-4">
          <h1 className="text-xl font-bold">Reporte de Gastos de Combustible</h1>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Período: {filtroFecha === 'semana' ? 'Esta semana' : filtroFecha === 'mes' ? 'Este mes' : 'Todo'} | 
            Generado: {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </p>
        </div>

        {/* Totales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-green-300 uppercase font-bold">GLP</p>
              <p className="text-xl font-black text-green-400">S/ {(totalesPorTipo.glp || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-blue-300 uppercase font-bold">Gasolina</p>
              <p className="text-xl font-black text-blue-400">S/ {(totalesPorTipo.gasolina || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-orange-300 uppercase font-bold">Diesel</p>
              <p className="text-xl font-black text-orange-400">S/ {(totalesPorTipo.diesel || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-yellow-300 uppercase font-bold">Cargas</p>
              <p className="text-xl font-black text-yellow-400">{gastosCombustible.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-primary uppercase font-bold">TOTAL</p>
              <p className="text-xl font-black text-primary">S/ {totalGeneral.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>


        {/* Cards de Otros (Estacionamiento/Peaje) */}
        {gastosOtros.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-300 uppercase font-bold">Otros Semanal</p>
                <p className="text-xl font-black text-blue-400">S/ {getGastosFiltrados().otros.reduce((sum, g) => sum + (g.monto || 0), 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-300 uppercase font-bold">Transacciones</p>
                <p className="text-xl font-black text-blue-400">{getGastosFiltrados().otros.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista agrupada */}
        {combustibleLoading ? (
          <div className="text-center py-8 text-text-muted">Cargando...</div>
        ) : reportType === 'combustible' && agruparPor === 'fecha' ? (
          <div className="space-y-4">
            {gastosAgrupadosPorFecha().map(grupo => (
              <Card key={grupo.fecha}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-blue-400" size={20} />
                      <span className="font-bold text-white">
                        {formatGroupDate(grupo.fecha)}
                      </span>
                    </div>
                    <span className="text-green-400 font-bold">S/ {grupo.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {grupo.gastos.map(gasto => (
                      <div key={gasto.id_gasto} className="flex items-center justify-between text-sm bg-surface-light/30 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Truck size={14} className="text-text-muted" />
                          <span className="text-white">{gasto.chofer_nombre || 'Chofer'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible}
                          </span>
                          {gasto.kilometraje && (
                            <span className="text-[11px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded font-black italic">
                              📍 {gasto.kilometraje} KM
                            </span>
                          )}
                        </div>
                        <span className="text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reportType === 'combustible' && (
          <div className="space-y-4">
            {gastosAgrupadosPorChofer().map(grupo => (
              <Card key={grupo.choferId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Truck className="text-green-400" size={20} />
                      <span className="font-bold text-white">{grupo.choferNombre}</span>
                      <span className="text-text-muted text-sm">({grupo.gastos.length} cargas)</span>
                    </div>
                    <span className="text-green-400 font-bold">S/ {grupo.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {grupo.gastos.map(gasto => (
                      <div key={gasto.id_gasto} className="flex items-center justify-between text-sm bg-surface-light/30 p-2 rounded ml-6">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-text-muted" />
                          <span className="text-text-muted">
                            {gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy HH:mm') : '-'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible}
                          </span>
                          {gasto.kilometraje && (
                            <span className="text-[11px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded font-black italic">
                              📍 {gasto.kilometraje} KM
                            </span>
                          )}
                        </div>
                        <span className="text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {reportType === 'combustible' && gastosCombustible.length === 0 && (
          <div className="text-center py-12 no-print">
            <Fuel className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
            <p className="text-text-muted">Sin cargas de combustible en este período</p>
          </div>
        )}

        {reportType === 'combustible' && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  📸 Fotos de Comprobantes
                  <span className="text-text-muted text-sm font-normal">({gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).length})</span>
                </h3>
                {gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleExportarFotosZip}
                    disabled={descargandoZip}
                    className="flex items-center gap-1"
                  >
                    <DownloadIcon size={14} />
                    {descargandoZip ? 'Descargando...' : 'Descargar ZIP'}
                  </Button>
                )}
              </div>
              {gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).length === 0 ? (
                <p className="text-text-muted text-sm">No hay fotos de combustible</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).map(gasto => (
                    <div key={gasto.id_gasto} className="bg-surface-light/30 rounded-lg overflow-hidden">
                      <div className="relative">
                        <button 
                          onClick={() => {
                            const images = gastosCombustible
                              .filter(g => fotosCombustible[g.id_gasto])
                              .map(g => ({ url: fotosCombustible[g.id_gasto]!, title: `Comprobante Combustible - ${g.chofer_nombre}` }));
                            const currentIndex = images.findIndex(img => img.url === fotosCombustible[gasto.id_gasto]);
                            setActivePhoto({ images, index: currentIndex >= 0 ? currentIndex : 0 });
                          }}
                          className="w-full flex"
                        >
                          <img 
                            src={fotosCombustible[gasto.id_gasto]} 
                            alt="Comprobante" 
                            className="w-full h-40 object-cover cursor-zoom-in hover:brightness-110 transition-all" 
                          />
                        </button>
                        <div className="absolute bottom-2 right-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFoto(fotosCombustible[gasto.id_gasto], `${gasto.chofer_nombre}_${gasto.monto}.jpg`);
                            }}
                            className="bg-black/60 p-2 rounded-lg hover:bg-black/80 transition-colors"
                            title="Descargar"
                          >
                            <DownloadIcon size={14} className="text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGasto(gasto.id_gasto);
                            }}
                            className="bg-red-500/60 p-2 rounded-lg hover:bg-red-500/80 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} className="text-white" />
                          </button>
                        </div>
                      </div>
                      <div className="p-2 text-xs">
                        <p className="text-white font-bold">{gasto.chofer_nombre || '-'}</p>
                        <p className="text-green-400">S/ {(gasto.monto || 0).toFixed(2)} - {gasto.tipo_combustible?.toUpperCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {reportType === 'otros' && (
          <Card className="border-surface-light">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileDown size={24} className="text-red-500" />
                  SECCION OTROS GASTOS <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full ml-2">v6</span>
                </h2>
              </div>
              
              <p className="text-text-muted mb-4">Gastos adicionales como estacionamiento, peajes y otros.</p>

              <div className="flex flex-wrap gap-3 items-center mb-4">
                <div className="flex bg-surface-light rounded-xl overflow-hidden border border-white/5">
                  {[
                    { key: 'dia', label: 'Hoy' },
                    { key: 'semana', label: 'Semana' },
                    { key: 'mes', label: 'Mes' },
                    { key: 'todo', label: 'Todo' }
                  ].map(p => (
                    <button key={p.key} onClick={() => setFiltroFecha(p.key as any)}
                      className={`px-5 py-2.5 text-sm font-black italic transition-all ${filtroFecha === p.key ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {gastosOtros.length === 0 ? (
                <div className="text-center py-12 no-print">
                  <FileDown className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
                  <p className="text-text-muted">No hay otros gastos registrados</p>
                  {gastos.length > 0 && (
                    <p className="text-text-muted text-xs mt-2">Pero hay {gastos.length} gastos en total. Los tipos son: {[...new Set(gastos.map(g => g.tipo_combustible))].join(', ')}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <Button onClick={handleExportarOtrosPDF} className="flex items-center gap-2">
                      <Download size={18} />
                      Exportar PDF
                    </Button>
                  </div>

                  {/* TARJETAS estilo Detalle de Gastos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {gastosOtros.map(gasto => (
                      <div key={gasto.id_gasto} className="bg-surface-light/30 rounded-lg overflow-hidden">
                        <div className="relative">
                          {fotosCombustible[gasto.id_gasto] ? (
                            <button 
                              onClick={() => {
                                const images = gastosOtros
                                  .filter(g => fotosCombustible[g.id_gasto])
                                  .map(g => ({ url: fotosCombustible[g.id_gasto]!, title: `Gasto: ${g.chofer_nombre} - S/ ${g.monto}` }));
                                const currentIndex = images.findIndex(img => img.url === fotosCombustible[gasto.id_gasto]);
                                setActivePhoto({ images, index: currentIndex >= 0 ? currentIndex : 0 });
                              }}
                              className="w-full"
                            >
                              <img 
                                src={fotosCombustible[gasto.id_gasto]} 
                                alt="Comprobante" 
                                className="w-full h-40 object-cover cursor-zoom-in hover:brightness-110 transition-all" 
                              />
                            </button>
                          ) : (
                            <div className="w-full h-40 bg-surface-light/50 flex items-center justify-center">
                              <span className="text-text-muted text-4xl">-</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2 flex gap-1">
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Eliminar gasto de ${gasto.chofer_nombre || 'este registro'} por S/ ${(gasto.monto || 0).toFixed(2)}?`)) {
                                  handleDeleteGasto(gasto.id_gasto);
                                }
                              }}
                              className="bg-red-500/80 hover:bg-red-500 p-2 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={16} className="text-white" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3 text-sm">
                          <p className="text-white font-bold">{gasto.chofer_nombre || '-'}</p>
                          <p className="text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</p>
                          <p className="text-text-muted text-xs mt-1">
                            {gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy') : '-'}
                          </p>
                          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.estado === 'confirmado' ? 'bg-green-500/20 text-green-400' :
                            gasto.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {gasto.estado || '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total */}
                  <div className="mt-4 p-4 bg-surface-light/30 rounded-xl flex justify-between items-center">
                    <span className="text-white font-bold">Total Otros Gastos:</span>
                    <span className="text-green-400 font-black text-xl">S/ {getGastosFiltrados().otros.reduce((sum, g) => sum + (g.monto || 0), 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {showFotoModal && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setShowFotoModal(null)}
          >
            <div 
              className="relative max-w-4xl w-full cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowFotoModal(null)} 
                className="absolute -top-12 right-0 text-white hover:text-gray-300 flex items-center gap-2 bg-surface px-4 py-2 rounded-lg"
              >
                <X size={20} />
                Cerrar
              </button>
              <img 
                src={showFotoModal} 
                alt="Foto ampliada" 
                className="max-h-[80vh] w-full object-contain rounded-lg border border-surface-light"
              />
            </div>
          </div>
        )}
      </>
      )}
      {/* Visor de Imágenes en modo Galería */}
      <ImageModal 
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        images={activePhoto?.images || []}
        initialIndex={activePhoto?.index}
      />
    </div>
  );
}

