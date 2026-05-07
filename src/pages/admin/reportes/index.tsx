import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Ruta, GastoCombustible, FotoVisita, LocalRuta, ViajeBitacora } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FileDown, Download, Truck, Clock, MapPin, CheckCircle2, Calendar, Filter, X, Share2, Fuel, Download as DownloadIcon, Trash2, Edit2, Check, Image, Users } from 'lucide-react';
import { format, differenceInMinutes, endOfWeek, startOfMonth, endOfMonth, startOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatFriendlyDate, formatPeru } from '../../../lib/timezone';
import JSZip from 'jszip';
import { ImageModal } from '../../../components/ui/ImageModal';

type Period = 'diario' | 'semanal' | 'mensual';
type ReportType = 'rutas' | 'combustible' | 'peajes' | 'otros';

interface RutaConBitacora extends Ruta {
  bitacora?: ViajeBitacora[];
  durationMin?: number | null;
  localesRuta?: LocalRuta[];
  horaLlegadaReal?: string | null;
  distanciaGpsKm?: number | null;
}
interface Usuario { id_usuario: string; nombre: string; }
interface GrupoFecha { fecha: string; gastos: GastoCombustible[]; total: number; }
interface GrupoChofer { choferId: string; choferNombre: string; gastos: GastoCombustible[]; total: number; }

function formatMins(mins: number | null) {
  if (mins === null || mins === undefined || isNaN(mins as number)) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const calcularDistanciaHaversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
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

  // FILTROS GLOBALES
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterChofer, setFilterChofer] = useState('');

  const [allRutas, setAllRutas] = useState<RutaConBitacora[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [rutasBase, setRutasBase] = useState<{ id_ruta_base: string; nombre: string; cantidad_peajes?: number; costo_peaje?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [fotosPorLocal, setFotosPorLocal] = useState<Record<string, FotoVisita[]>>({});

  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [combustibleLoading, setCombustibleLoading] = useState(true);
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [activePhoto, setActivePhoto] = useState<{ images: { url: string; title: string }[]; index: number } | null>(null);

  const [editandoLlegada, setEditandoLlegada] = useState<string | null>(null);
  const [horaLlegadaEdit, setHoraLlegadaEdit] = useState('');
  const [fotosCombustible, setFotosCombustible] = useState<Record<string, string>>({});
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [incluirFotosEnPDF, setIncluirFotosEnPDF] = useState(true);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [descargandoZipEvidencia, setDescargandoZipEvidencia] = useState(false);
  const [ordenPeajes, setOrdenPeajes] = useState<'asc' | 'desc'>('desc');
  const [filterRutaNombre, setFilterRutaNombre] = useState('');

  const handleDeleteEvidenciaFoto = async (fotoId: string, localId: string) => {
    if (!confirm('¿Eliminar esta foto de evidencia?')) return;

    try {
      const { error } = await supabase
        .from('fotos_visita')
        .delete()
        .eq('id_foto', fotoId);

      if (error) throw error;

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
      const gasto = gastos.find(g => g.id_gasto === id_gasto);

      if (gasto?.foto_url) {
        try {
          const urlParts = gasto.foto_url.split('/');
          const fileName = urlParts.slice(-2).join('/');
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

      setGastos(prev => prev.filter(g => g.id_gasto !== id_gasto));
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

  const iniciarEdicionLlegada = (ruta: RutaConBitacora) => {
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

    const fechaBase = ruta.fecha ? new Date(ruta.fecha + 'T12:00:00') : new Date();
    const [h, m] = horaLlegadaEdit.split(':').map(Number);
    fechaBase.setHours(h, m, 0, 0);

    const nuevaHora = fechaBase.toISOString();

    try {
      const { error } = await supabase
        .from('rutas')
        .update({ hora_llegada_planta: nuevaHora })
        .eq('id_ruta', ruta.id_ruta);

      if (error) throw error;

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

      loadData();
      setEditandoLlegada(null);
      alert('Hora de llegada actualizada correctamente');
    } catch (err: any) {
      console.error('Error guardando hora:', err);
      alert('Error al guardar: ' + err.message);
    }
  };

  function getRange(p: Period, date: string): { from: string; to: string } {
    const d = new Date(date + 'T12:00:00');

    if (p === 'diario') {
      return { from: date, to: date };
    } else if (p === 'semanal') {
      const fromDate = new Date(d);
      fromDate.setDate(d.getDate() - 7);
      return { from: format(fromDate, 'yyyy-MM-dd'), to: date };
    } else {
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
    }
  }

  useEffect(() => {
    console.log('[v2.2] Cargando datos de reportes...');
    loadData();
    loadCombustible();
  }, [period, selectedDate, filterChofer]);

  useEffect(() => {
    supabase.from('usuarios').select('id_usuario,nombre').eq('rol', 'chofer').then(r => { if (r.data) setChoferes(r.data); });
    supabase.from('rutas_base').select('id_ruta_base,nombre,cantidad_peajes,costo_peaje').then(r => { if (r.data) setRutasBase(r.data); });
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      // Usar rangos con zona horaria de Perú (UTC-5) para evitar el desfase
      // Si la columna es TIMESTAMPTZ, esto asegura que el rango empiece exactamente a las 00:00 de Lima
      const fromPeru = `${from}T00:00:00-05:00`;
      const toPeru = `${to}T23:59:59-05:00`;

      let query = supabase
        .from('rutas')
        .select('*')
        .gte('fecha', fromPeru)
        .lte('fecha', toPeru)
        .order('fecha', { ascending: false });

      if (filterChofer) {
        query = query.eq('id_chofer', filterChofer);
      }

      const { data: rutasData, error: rutasError } = await query;

      if (rutasError) throw rutasError;

      if (rutasData && rutasData.length > 0) {
        const ids = rutasData.map(r => r.id_ruta);
        const { data: bitData, error: bitError } = await supabase.from('viajes_bitacora').select('*').in('id_ruta', ids).order('created_at', { ascending: true });
        if (bitError) console.warn('[LoadData] Error bitácora:', bitError);

        const { data: localesData, error: localesError } = await supabase.from('locales_ruta').select('*').in('id_ruta', ids).order('orden', { ascending: true });
        if (localesError) console.warn('[LoadData] Error locales:', localesError);

        const localRutaIds = localesData?.map(l => l.id_local_ruta) || [];
        const fotosMap: Record<string, FotoVisita[]> = {};
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
          try {
            const bits = (bitData as ViajeBitacora[] || []).filter(b => b.id_ruta === r.id_ruta);
            const locales = (localesData as LocalRuta[] || []).filter(l => l.id_ruta === r.id_ruta);

            const bitsOrdenados = [...bits].sort((a, b) =>
              new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            );

            let horaLlegadaReal = r.hora_llegada_planta;
            for (let i = bitsOrdenados.length - 1; i >= 0; i--) {
              if (bitsOrdenados[i].hora_llegada) {
                horaLlegadaReal = bitsOrdenados[i].hora_llegada;
                break;
              }
            }

            let distanciaGpsKm = 0;
            const bitsValidos = bitsOrdenados.filter(b => b.gps_llegada_lat && b.gps_llegada_lng);
            for (let i = 0; i < bitsValidos.length - 1; i++) {
              distanciaGpsKm += calcularDistanciaHaversine(
                bitsValidos[i].gps_llegada_lat!, bitsValidos[i].gps_llegada_lng!,
                bitsValidos[i + 1].gps_llegada_lat!, bitsValidos[i + 1].gps_llegada_lng!
              );
            }

            let durationMin: number | null = null;
            const salidas = bitsOrdenados.filter(b => b.hora_salida).map(b => new Date(b.hora_salida!));
            const llegadas = bitsOrdenados.filter(b => b.hora_llegada).map(b => new Date(b.hora_llegada!));
            if (salidas.length > 0 && llegadas.length > 0) {
              const primeraSalida = new Date(Math.min(...salidas.map(d => d.getTime())));
              const ultimaLlegada = new Date(Math.max(...llegadas.map(d => d.getTime())));
              durationMin = differenceInMinutes(ultimaLlegada, primeraSalida);
            }

            return { ...r, bitacora: bits, localesRuta: locales, durationMin, horaLlegadaReal, distanciaGpsKm };
          } catch (err) {
            return { ...r, bitacora: [], localesRuta: [], durationMin: null, horaLlegadaReal: r.hora_llegada_planta, distanciaGpsKm: 0 };
          }
        });
        setAllRutas(enriched as RutaConBitacora[]);
      } else {
        setAllRutas([]);
      }
    } catch (error) {
      console.error('Error en loadData:', error);
      setAllRutas([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombustible() {
    setCombustibleLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);

      // Usar rangos con zona horaria de Perú (UTC-5) para evitar el desfase
      const fromPeru = `${from}T00:00:00-05:00`;
      const toPeru = `${to}T23:59:59-05:00`;

      console.log(`[Combustible] Consultando rango Lima: ${fromPeru} a ${toPeru}`);

      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre, fecha)')
        .gte('fecha', fromPeru)
        .lte('fecha', toPeru)
        .order('fecha', { ascending: false });

      if (filterChofer) {
        query = query.eq('id_chofer', filterChofer);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Combustible] Error:', error);
        throw error;
      }

      console.log(`[Combustible] Gastos encontrados: ${data?.length || 0}`);

      if (data) {
        const mapped = (data as GastoCombustible[]).map(g => ({
          ...g,
          chofer_nombre: (g as any).usuarios?.nombre,
          ruta_nombre: (g as any).rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);

        const fotosMap: Record<string, string> = {};
        data.forEach((g: any) => {
          if (g.foto_url) fotosMap[g.id_gasto] = g.foto_url;
        });
        setFotosCombustible(fotosMap);
      }
    } catch (err) {
      console.error('[Combustible] Error:', err);
    } finally {
      setCombustibleLoading(false);
    }
  }

  const gastosCombustible = useMemo(() => gastos.filter(g => g.tipo_combustible !== 'otro' && g.tipo_combustible !== 'estacionamiento' && g.tipo_combustible !== 'peaje' && g.tipo_combustible !== 'peaje_compromiso'), [gastos]);
  const gastosOtros = useMemo(() => gastos.filter(g => g.tipo_combustible === 'otro' || g.tipo_combustible === 'estacionamiento' || g.tipo_combustible === 'peaje' || g.tipo_combustible === 'peaje_compromiso'), [gastos]);

  const peajesManuales = useMemo(() => {
    let filtered = gastos.filter(g => g.tipo_combustible === 'peaje' || g.tipo_combustible === 'peaje_compromiso');

    const { from, to } = getRange(period, selectedDate);

    filtered = filtered.filter(g => {
      const fechaRaw = g.fecha || (g as any).created_at || '';
      // Convertir a fecha de Perú (UTC-5) para evitar el desfase de 1 día
      const fechaGasto = formatPeru(fechaRaw, 'yyyy-MM-dd');
      return fechaGasto >= from && fechaGasto <= to;
    });

    if (filterChofer) {
      filtered = filtered.filter(g => g.id_chofer === filterChofer);
    }

    return filtered.sort((a, b) => {
      const fechaA = a.fecha || (a as any).created_at || '';
      const fechaB = b.fecha || (b as any).created_at || '';
      const dateA = new Date(fechaA).getTime();
      const dateB = new Date(fechaB).getTime();
      return ordenPeajes === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [gastos, period, selectedDate, filterChofer, ordenPeajes]);

  const peajesManualesMonto = peajesManuales
    .filter(g => g.tipo_combustible === 'peaje')
    .reduce((sum, g) => sum + (g.monto || 0), 0);

  const peajesCompromisoMonto = peajesManuales
    .filter(g => g.tipo_combustible === 'peaje_compromiso')
    .reduce((sum, g) => sum + (g.monto || 0), 0);

  const peajesCalculados = useMemo(() => {
    if (!allRutas || allRutas.length === 0) return 0;
    const rutasFiltradas = allRutas.filter(r => r.estado === 'finalizada');
    let total = 0;

    rutasFiltradas.forEach(ruta => {
      const rutaBase = rutasBase.find(rb => rb.id_ruta_base === ruta.id_ruta_base);
      if (rutaBase && typeof rutaBase === 'object') {
        const datos = rutaBase as any;
        const cantidadPeajes = datos.cantidad_peajes || 0;
        const costoPeaje = datos.costo_peaje || 0;
        total += cantidadPeajes * costoPeaje;
      }
    });
    return total;
  }, [allRutas, rutasBase]);

  const [editandoPeajeId, setEditandoPeajeId] = useState<string | null>(null);
  const [editandoPeajeDatos, setEditandoPeajeDatos] = useState<any>(null);

  const iniciarEdicionPeaje = (gasto: any) => {
    setEditandoPeajeId(gasto.id_gasto);
    setEditandoPeajeDatos({ ...gasto });
  };

  const guardarEdicionPeaje = async () => {
    if (!editandoPeajeId || !editandoPeajeDatos) return;

    const { error } = await supabase.from('gastos_combustible').update({
      monto: parseFloat(editandoPeajeDatos.monto),
      fecha: editandoPeajeDatos.fecha + 'T12:00:00-05:00',
      tipo_combustible: editandoPeajeDatos.tipo_combustible
    }).eq('id_gasto', editandoPeajeId);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      setGastos(prev => prev.map(g =>
        g.id_gasto === editandoPeajeId ? { ...g, ...editandoPeajeDatos } : g
      ));
      setEditandoPeajeId(null);
      setEditandoPeajeDatos(null);
      alert('Registro actualizado');
    }
  };

  const eliminarGastoPeaje = async (idGasto: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro de peaje?')) return;

    const { error } = await supabase.from('gastos_combustible').delete().eq('id_gasto', idGasto);

    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      setGastos(prev => prev.filter(g => g.id_gasto !== idGasto));
      alert('Registro eliminado');
    }
  };

  const getGastosFiltrados = () => {
    return { comb: gastosCombustible, otros: gastosOtros };
  };

  const rutas = useMemo(() => {
    let filtered = allRutas.filter(r => {
      if (filterChofer && r.id_chofer !== filterChofer) return false;
      if (filterRutaNombre && !r.nombre?.toLowerCase().includes(filterRutaNombre.toLowerCase())) return false;
      return true;
    });
    return filtered;
  }, [allRutas, filterChofer, filterRutaNombre]);

  const { from, to } = getRange(period, selectedDate);
  const totalRutas = rutas.length;
  const finalizadas = rutas.filter(r => r.estado === 'finalizada').length;
  const enProgreso = rutas.filter(r => r.estado === 'en_progreso').length;
  const pendientes = totalRutas - finalizadas - enProgreso;

  const rangoLabel = period === 'diario' ? formatFriendlyDate(from) : `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;

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
        `🚛 ${r.nombre} (${r.placa || '-'}) · ${r.durationMin ? formatMins(r.durationMin) : 'sin tiempo'}`
      ),
      '',
      `_Generado desde Shimaya Rutas_`,
    ];
    const texto = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  const handleGeneratePDF = () => {
    setGenerating(true);

    // Generar HTML para cada ruta
    const rows = rutas.map(r => {
      const bits = r.bitacora || [];
      const estadoBadge = r.estado === 'finalizada' ? '#22c55e' : r.estado === 'en_progreso' ? '#3b82f6' : '#eab308';

      // TABLA DE TRAMOS
      const paradas = bits.map((b: any, i: number) => {
        const transito = b.hora_salida && b.hora_llegada
          ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
        const nextBit = bits[i + 1];
        const permanencia = b.hora_llegada && nextBit?.hora_salida
          ? differenceInMinutes(new Date(nextBit.hora_salida), new Date(b.hora_llegada)) : null;
        return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${b.origen_nombre || '-'} → ${b.destino_nombre || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${b.hora_llegada ? format(new Date(b.hora_llegada), 'HH:mm') : '⏳'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#4f46e5;">${transito !== null ? transito + ' min' : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#f59e0b;">${permanencia !== null ? permanencia + ' min' : '-'}</td>
      </tr>`;
      }).join('');

      // FOTOS (se generan pero se colocan AL FINAL, después de la tabla)
      let fotosHTML = '';
      if (incluirFotosEnPDF && r.localesRuta && r.localesRuta.length > 0) {
        const allFotos: { url: string; localName: string }[] = [];
        r.localesRuta.forEach((local: any) => {
          const fotos = fotosPorLocal[local.id_local_ruta] || [];
          fotos.forEach((f: any) => {
            allFotos.push({ url: f.foto_url, localName: local.nombre || 'Local' });
          });
        });

        if (allFotos.length > 0) {
          fotosHTML = `
          <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <p style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 12px;">📸 FOTOS DE EVIDENCIA (${allFotos.length})</p>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              ${allFotos.map(foto => `
                <div style="width: 120px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;">
                  <img src="${foto.url}" style="width: 100%; height: 100px; object-fit: cover;" />
                  <div style="padding: 6px; font-size: 10px; text-align: center; background: white;">${foto.localName}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        }
      }

      // ESTRUCTURA CORRECTA: 
      // 1. TÍTULO DE RUTA
      // 2. TABLA DE TRAMOS
      // 3. FOTOS (AL FINAL)
      return `
      <div style="page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <!-- TÍTULO DE LA RUTA -->
        <div style="background: #1e293b; color: white; padding: 12px 16px;">
          <div style="font-size: 16px; font-weight: bold;">🚛 REPORTE DE RUTA: ${(r.nombre || 'SIN NOMBRE').toUpperCase()}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">
            📅 ${r.fecha ? formatFriendlyDate(r.fecha) : 'Fecha no disponible'} 
            ${r.placa ? `| 🚛 Placa: ${r.placa}` : ''}
            | Estado: ${r.estado?.replace('_', ' ') || 'Desconocido'}
          </div>
        </div>
        
        <!-- INFORMACIÓN GENERAL -->
        <div style="padding: 10px 16px; background: #f8fafc; font-size: 12px; display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0;">
          ${r.hora_salida_planta ? `<span>🕐 Salida planta: <strong>${format(new Date(r.hora_salida_planta), 'HH:mm')}</strong></span>` : ''}
          ${r.horaLlegadaReal ? `<span>🏁 Llegada planta: <strong>${format(new Date(r.horaLlegadaReal), 'HH:mm')}</strong></span>` : ''}
          ${r.durationMin ? `<span>⏱ Duración total: <strong>${formatMins(r.durationMin)}</strong></span>` : ''}
        </div>
        
        <!-- TABLA DE TRAMOS (VIAJES BITÁCORA) -->
        <div style="padding: 16px;">
          <p style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 10px;">📋 TRAMOS DE LA RUTA</p>
          ${bits.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 8px; text-align: left;">#</th>
                  <th style="padding: 8px; text-align: left;">Tramo</th>
                  <th style="padding: 8px; text-align: left;">Salida</th>
                  <th style="padding: 8px; text-align: left;">Llegada</th>
                  <th style="padding: 8px; text-align: left;">Tránsito</th>
                  <th style="padding: 8px; text-align: left;">Permanencia</th>
                </tr>
              </thead>
              <tbody>${paradas}</tbody>
            </table>
          ` : '<p style="color: #94a3b8; font-style: italic;">Sin movimientos registrados</p>'}
        </div>
        
        <!-- SECCIÓN DE FOTOS (AL FINAL DEL BLOQUE DE RUTA) -->
        ${fotosHTML ? `<div style="border-top: 1px solid #e2e8f0;">${fotosHTML}</div>` : ''}
      </div>
    `;
    }).join('');

    // HTML COMPLETO
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Rutas - Shimaya</title>
      <style>
        @media print {
          body { margin: 0; padding: 15px; }
          .no-print { display: none; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #fff; }
        h1 { color: #1e293b; font-size: 24px; margin-bottom: 5px; }
        .subtitle { color: #64748b; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        button { background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-bottom: 20px; }
        .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print();" style="margin-bottom:20px;">🖨️ Imprimir / Guardar PDF</button>
      <h1>🚛 SHIMAYA RUTAS</h1>
      <div class="subtitle">📅 Período: ${rangoLabel} ${filterChofer ? `| 👤 Chofer: ${choferNombre}` : ''}</div>
      ${routesHTML}
      <div class="footer">Reporte generado desde Shimaya Rutas · ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
    </body>
    </html>
  `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_rutas_${format(new Date(), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  const gastosAgrupadosPorFecha = (): GrupoFecha[] => {
    const grupos: Record<string, GastoCombustible[]> = {};
    gastosCombustible.forEach(gasto => {
      const fecha = gasto.fecha ? formatPeru(gasto.fecha, 'yyyy-MM-dd') : 'sin fecha';
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

  const getPeriodoLabel = () => {
    if (period === 'diario') return formatFriendlyDate(selectedDate);
    if (period === 'semanal') {
      const { from, to } = getRange('semanal', selectedDate);
      return `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;
    }
    const { from, to } = getRange('mensual', selectedDate);
    return `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;
  };

  const handleExportarOtrosPDF = () => {
    const periodoLabel = getPeriodoLabel();
    const totalOtros = gastosOtros.reduce((sum, g) => sum + (g.monto || 0), 0);

    const gastosHTML = gastosOtros.map(gasto => {
      const estadoIcon = gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente' ? '⏳' : '✗';
      const estadoColor = gasto.estado === 'confirmado' ? '#22c55e' : gasto.estado === 'pendiente' ? '#eab308' : '#ef4444';

      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px;color:#475569;">${gasto.fecha ? formatFriendlyDate(gasto.fecha) : '-'}</td>
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

  const handleExportarPeajesPDF = () => {
    const periodoLabel = getPeriodoLabel();
    const peajesFiltrados = peajesManuales;

    const peajesHTML = peajesFiltrados.map((gasto: any) => {
      const tipoLabel = gasto.tipo_combustible === 'peaje_compromiso' ? 'Compromiso' : 'Pagado';
      const fechaMostrar = gasto.fecha ? formatFriendlyDate(gasto.fecha) : '-';
      const fotoHTML = gasto.foto_url ? `<br><img src="${gasto.foto_url}" style="max-height:80px;border-radius:4px;margin-top:4px;">` : '';

      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px;color:#475569;">${fechaMostrar}</td>
        <td style="padding:8px;font-weight:600;color:#1e293b;">${gasto.chofer_nombre || '-'}</td>
        <td style="padding:8px;color:#475569;">${tipoLabel}${fotoHTML}</td>
        <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a;">S/ ${(gasto.monto || 0).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const totalPeajes = peajesFiltrados.reduce((sum, g: any) => sum + (g.monto || 0), 0).toFixed(2);

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte de Peajes - ${periodoLabel}</title>
<style>
  @media print { @page { margin: 15mm; } button, .no-print { display: none !important; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: white; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: white; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header-title { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 4px; }
  .controls { padding: 12px 28px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
  .checkbox-label input { width: 16px; height: 16px; cursor: pointer; }
  .badge-row { display: flex; gap: 10px; padding: 16px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; padding: 10px; text-align: left; color: #475569; font-weight: 600; }
  td { vertical-align: top; }
  .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: right; }
  .total-label { font-size: 14px; color: #475569; }
  .total-value { font-size: 24px; font-weight: 900; color: #16a34a; }
</style>
</head>
<body>
  <div class="controls no-print">
    <label class="checkbox-label">
      <input type="checkbox" id="incluirFotos" checked onchange="window.toggleFotos(this.checked)"> 
      Incluir fotos en el reporte
    </label>
    <div>
      <button onclick="window.close()" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;margin-right:10px;">✕ Cerrar</button>
      <button onclick="window.print()" style="background:#16a34a;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button>
    </div>
  </div>
  <div class="header">
    <div>
      <h1 class="header-title">💰 REPORTE DE PEAJES</h1>
      <div class="header-sub">Shimaya Rutas & Logística</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;opacity:0.8;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
    </div>
  </div>
  
  <div class="badge-row">
    <span class="badge badge-blue">📅 Período: ${periodoLabel}</span>
    <span class="badge badge-green">📊 Registros: ${peajesFiltrados.length}</span>
    <span class="badge badge-red">💵 Total: S/ ${totalPeajes}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Chofer</th>
        <th>Tipo / Evidencia</th>
        <th style="text-align:right;">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${peajesHTML}
    </tbody>
  </table>

  <div class="footer">
    <span class="total-label">Total Peajes: </span>
    <span class="total-value">S/ ${totalPeajes}</span>
  </div>
  
  <script>
    function toggleFotos(mostrar) {
      const fotos = document.querySelectorAll('.foto-row');
      fotos.forEach(f => f.style.display = mostrar ? '' : 'none');
    }
  </script>
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
    const periodoLabel = getPeriodoLabel();

    const gruposHTML = agruparPor === 'fecha'
      ? gastosAgrupadosPorFecha().map(grupo => {
        const gastosHTML = grupo.gastos.map(gasto => {
          const estadoIcon = gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente_revision' ? '⏳' : '✗';
          const estadoColor = gasto.estado === 'confirmado' ? '#22c55e' : gasto.estado === 'pendiente_revision' ? '#eab308' : '#ef4444';

          return `<tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px;color:#475569;">${gasto.created_at ? format(new Date(gasto.created_at), 'HH:mm') : '-'}</td>
              <td style="padding:8px;font-weight:600;color:#1e293b;">${gasto.chofer_nombre || '-'}</td>
              <td style="padding:8px;color:#475569;text-transform:uppercase;">${gasto.tipo_combustible || '-'}</td>
              <td style="padding:8px;text-align:center;"><span style="background:${estadoColor}22;color:${estadoColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold;">${estadoIcon}</span></td>
              <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a;">S/ ${(gasto.monto || 0).toFixed(2)}</td>
            </tr>`;
        }).join('');

        return `<div style="page-break-inside:avoid;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <div style="background:#1e293b;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
              <div><strong style="font-size:14px;">📅 ${formatFriendlyDate(grupo.fecha)}</strong></div>
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
              <td style="padding:8px;color:#475569;">${gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM HH:mm') : '-'}</td>
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
                <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Fecha/Hora</th>
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
            ${gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy HH:mm') : ''}
          </div>
        </div>`;
          }
        });
        return fotosHTML + `</div></div>`;
      })() : ''}
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
  };

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'diario', label: 'Diario' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensual', label: 'Mensual' },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER con filtros globales */}
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Reportes</h1>

        {/* Filtros Globales */}
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
                <select value={filterChofer} onChange={e => setFilterChofer(e.target.value)}
                  className="bg-surface-light border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white text-sm appearance-none focus:outline-none focus:border-primary min-w-[160px]">
                  <option value="">Todos los choferes</option>
                  {choferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
                </select>
              </div>

              {filterChofer && (
                <button onClick={() => setFilterChofer('')}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                  <X size={12} /> Limpiar
                </button>
              )}
            </div>

            <p className="text-xs text-text-muted">
              📅 Período seleccionado: <span className="text-primary font-bold">{rangoLabel}</span>
              {filterChofer && ` · 👤 Chofer: ${choferNombre}`}
            </p>
          </CardContent>
        </Card>

        {/* Pestañas de tipo de reporte */}
        <div className="flex bg-surface rounded-xl overflow-hidden border border-surface-light w-fit">
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
            onClick={() => setReportType('peajes')}
            className={`px-4 py-2 font-medium transition-colors ${reportType === 'peajes' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}
          >
            <FileDown size={16} className="inline mr-2" />
            Peajes
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

      {/* CONTENIDO SEGÚN PESTAÑA */}
      {reportType === 'rutas' && (
        <>
          {/* Filtro adicional por nombre de ruta (solo para rutas) */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nombre de ruta..."
                value={filterRutaNombre}
                onChange={e => setFilterRutaNombre(e.target.value)}
                className="bg-surface-light border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-primary w-64"
              />
              {filterRutaNombre && (
                <button onClick={() => setFilterRutaNombre('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-400">
                  <X size={14} />
                </button>
              )}
            </div>
            {(filterChofer || filterRutaNombre) && (
              <button onClick={() => { setFilterChofer(''); setFilterRutaNombre(''); }}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                <X size={12} /> Limpiar todos
              </button>
            )}
          </div>

          {/* BOTONES EXPORTAR RUTAS */}
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

          {/* STATS RUTAS */}
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
                        {ruta.hora_salida_planta && (
                          <span className="text-xs text-text-muted">
                            🕐 {format(new Date(ruta.hora_salida_planta), 'HH:mm')}
                            {ruta.horaLlegadaReal && ` → ${format(new Date(ruta.horaLlegadaReal), 'HH:mm')}`}
                            {ruta.durationMin && ` (${formatMins(ruta.durationMin)})`}
                            {ruta.distanciaGpsKm && ` · 🧭 ~${ruta.distanciaGpsKm.toFixed(1)} km`}
                          </span>
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
                        ) : (
                          <button
                            onClick={() => iniciarEdicionLlegada(ruta)}
                            className="p-1 hover:bg-surface-light rounded text-text-muted hover:text-primary transition-colors"
                            title="Editar hora de llegada"
                          >
                            <Edit2 size={14} />
                          </button>
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
                              const dur = b.hora_salida && b.hora_llegada ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
                              return (
                                <tr key={b.id_bitacora} className="border-b border-white/5 hover:bg-white/5">
                                  <td className="px-4 py-2 text-primary font-black">{i + 1}</td>
                                  <td className="px-4 py-2 text-white font-bold italic">{b.origen_nombre} <span className="text-primary">→</span> {b.destino_nombre}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_llegada ? format(new Date(b.hora_llegada), 'HH:mm') : <span className="text-blue-400 animate-pulse">En camino</span>}</td>
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

                                          setActivePhoto({ images: allRouteFotos, index: finalIndex });
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
      )}

      {reportType === 'combustible' && (
        <>
          <div className="flex flex-wrap gap-4 mb-4">
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

          {/* Totales Combustible */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {gastosCombustible.length > 0 && (
              <>
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
              </>
            )}
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

          {combustibleLoading ? (
            <div className="text-center py-8 text-text-muted">Cargando...</div>
          ) : gastosCombustible.length === 0 ? (
            <div className="text-center py-12">
              <Fuel className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
              <p className="text-text-muted">No hay gastos de combustible para la fecha seleccionada</p>
            </div>
          ) : agruparPor === 'fecha' ? (
            <div className="space-y-4">
              {gastosAgrupadosPorFecha().map(grupo => (
                <Card key={grupo.fecha}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-blue-400" size={20} />
                        <span className="font-bold text-white">
                          {formatFriendlyDate(grupo.fecha)}
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
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
          ) : (
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
                            <span className="text-text-muted">📅</span>
                            {gasto.fecha ? formatFriendlyDate(gasto.fecha) : '-'}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
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

          {/* Fotos de Combustible */}
          {gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    📸 Fotos de Comprobantes
                    <span className="text-text-muted text-sm font-normal">({gastosCombustible.filter(g => fotosCombustible[g.id_gasto]).length})</span>
                  </h3>
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
                </div>
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
              </CardContent>
            </Card>
          )}
        </>
      )}

      {reportType === 'peajes' && (
        <Card className="border-surface-light">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileDown size={24} className="text-blue-500" />
                REPORTE DE PEAJES
              </h2>
            </div>

            <p className="text-text-muted mb-4">Período: <span className="text-primary font-bold">{rangoLabel}</span></p>

            {/* Resumen de Peajes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-xs uppercase font-bold mb-1">Peajes Automáticos</p>
                <p className="text-2xl font-black text-blue-400">
                  S/ {peajesCalculados.toFixed(2)}
                </p>
                <p className="text-text-muted text-[10px] mt-1">Basado en rutas ejecutadas</p>
              </div>
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-xs uppercase font-bold mb-1">Peajes Manuales</p>
                <p className="text-2xl font-black text-green-400">
                  S/ {peajesManualesMonto.toFixed(2)}
                </p>
                <p className="text-text-muted text-[10px] mt-1">Con ticket/foto (pagados)</p>
              </div>
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-xs uppercase font-bold mb-1">Compromisos Peaje</p>
                <p className="text-2xl font-black text-yellow-400">
                  S/ {peajesCompromisoMonto.toFixed(2)}
                </p>
                <p className="text-text-muted text-[10px] mt-1">Tickets pendientes por pagar</p>
              </div>
              <div className="bg-surface-light/30 p-4 rounded-xl border border-white/5">
                <p className="text-text-muted text-xs uppercase font-bold mb-1">Total Peajes</p>
                <p className="text-2xl font-black text-white">
                  S/ {(peajesCalculados + peajesManualesMonto).toFixed(2)}
                </p>
                <p className="text-text-muted text-[10px] mt-1">Sin contar compromisos</p>
              </div>
            </div>

            {/* Detalle de peajes manuales */}
            {peajesManuales.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold text-white mb-3">Peajes con Ticket/Foto</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted border-b border-white/10">
                        <th className="text-left py-2 px-3 cursor-pointer hover:text-primary" onClick={() => setOrdenPeajes(ordenPeajes === 'asc' ? 'desc' : 'asc')}>
                          Fecha {ordenPeajes === 'asc' ? '↑' : '↓'}
                        </th>
                        <th className="text-left py-2 px-3">Foto</th>
                        <th className="text-left py-2 px-3">Chofer</th>
                        <th className="text-left py-2 px-3">Tipo</th>
                        <th className="text-right py-2 px-3">Monto</th>
                        <th className="text-center py-2 px-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peajesManuales.map((gasto: any) => (
                        <tr key={gasto.id_gasto} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3">
                            {editandoPeajeId === gasto.id_gasto ? (
                              <input
                                type="date"
                                value={editandoPeajeDatos?.fecha || ''}
                                onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, fecha: e.target.value })}
                                className="bg-surface border border-white/20 rounded px-2 py-1 text-white text-xs"
                              />
                            ) : (
                              <span className="text-white text-xs">
                                {gasto.fecha ? formatFriendlyDate(gasto.fecha) : (gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy') : '-')}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {gasto.foto_url ? (
                              <button
                                onClick={() => setShowFotoModal(gasto.foto_url)}
                                className="text-primary hover:text-primary/80 text-xs flex items-center gap-1"
                              >
                                <Image size={14} /> Ver
                              </button>
                            ) : (
                              <span className="text-text-muted text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-white font-medium text-xs">
                            {gasto.chofer_nombre || '-'}
                          </td>
                          <td className="py-2 px-3">
                            {editandoPeajeId === gasto.id_gasto ? (
                              <select
                                value={editandoPeajeDatos?.tipo_combustible || 'peaje'}
                                onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, tipo_combustible: e.target.value })}
                                className="bg-surface border border-white/20 rounded px-2 py-1 text-white text-xs"
                              >
                                <option value="peaje">Pagado</option>
                                <option value="peaje_compromiso">Compromiso</option>
                                <option value="estacionamiento">Estacionamiento</option>
                                <option value="otro">Otro</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${gasto.tipo_combustible === 'peaje_compromiso'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                                }`}>
                                {gasto.tipo_combustible === 'peaje_compromiso' ? 'Compromiso' : gasto.tipo_combustible === 'peaje' ? 'Pagado' : gasto.tipo_combustible}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {editandoPeajeId === gasto.id_gasto ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editandoPeajeDatos?.monto || 0}
                                onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, monto: e.target.value })}
                                className="bg-surface border border-white/20 rounded px-2 py-1 text-white text-xs w-20 text-right"
                              />
                            ) : (
                              <span className="text-green-400 font-bold text-xs">
                                S/ {(gasto.monto || 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex justify-center gap-1">
                              {editandoPeajeId === gasto.id_gasto ? (
                                <>
                                  <button onClick={guardarEdicionPeaje} className="text-green-400 hover:text-green-300 p-1" title="Guardar">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => { setEditandoPeajeId(null); setEditandoPeajeDatos(null); }} className="text-red-400 hover:text-red-300 p-1" title="Cancelar">
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => iniciarEdicionPeaje(gasto)} className="text-blue-400 hover:text-blue-300 p-1" title="Editar">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => eliminarGastoPeaje(gasto.id_gasto)} className="text-red-400 hover:text-red-300 p-1" title="Eliminar">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {peajesManuales.length === 0 && peajesCalculados === 0 && (
              <div className="text-center py-8">
                <FileDown className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
                <p className="text-text-muted">No hay registros de peajes en el período seleccionado</p>
              </div>
            )}

            {peajesManuales.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleExportarPeajesPDF} className="flex items-center gap-2">
                  <Download size={18} /> Exportar PDF
                </Button>
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
                OTROS GASTOS
              </h2>
            </div>

            <p className="text-text-muted mb-4">Período: <span className="text-primary font-bold">{rangoLabel}</span></p>

            {gastosOtros.length === 0 ? (
              <div className="text-center py-12">
                <FileDown className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
                <p className="text-text-muted">No hay otros gastos registrados en este período</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <Button onClick={handleExportarOtrosPDF} className="flex items-center gap-2">
                    <Download size={18} />
                    Exportar PDF
                  </Button>
                </div>

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
                          {gasto.fecha ? format(new Date(gasto.fecha), 'dd/MM/yyyy') : '-'}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${gasto.estado === 'confirmado' ? 'bg-green-500/20 text-green-400' :
                          gasto.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                          {gasto.estado || '-'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-surface-light/30 rounded-xl flex justify-between items-center">
                  <span className="text-white font-bold">Total Otros Gastos:</span>
                  <span className="text-green-400 font-black text-xl">S/ {gastosOtros.reduce((sum, g) => sum + (g.monto || 0), 0).toFixed(2)}</span>
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
      <ImageModal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        images={activePhoto?.images || []}
        initialIndex={activePhoto?.index}
      />
    </div>
  );
}
// v2.4 - Timezone and PDF order fix confirmed
