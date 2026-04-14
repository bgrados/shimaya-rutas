import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Ruta, GastoCombustible, FotoVisita } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FileDown, Download, Truck, Clock, MapPin, CheckCircle2, Calendar, Filter, X, Share2, Fuel, Download as DownloadIcon } from 'lucide-react';
import { format, differenceInMinutes, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatPeru, formatGroupDate, formatGroupDatePdf, getStartOfCurrentWeek, getEndOfCurrentWeek, formatFriendlyDate } from '../../../lib/timezone';
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

interface RutaConBitacora extends Ruta { bitacora?: any[]; duracionMins?: number | null; localesRuta?: any[]; }
interface Usuario { id_usuario: string; nombre: string; }
interface GrupoFecha { fecha: string; gastos: GastoCombustible[]; total: number; }
interface GrupoChofer { choferId: string; choferNombre: string; gastos: GastoCombustible[]; total: number; }

export default function Reportes() {
  const [reportType, setReportType] = useState<ReportType>('rutas');
  
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [allRutas, setAllRutas] = useState<RutaConBitacora[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [rutasBase, setRutasBase] = useState<{ id_ruta_base: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Estado para fotos de evidencia
  const [fotosPorLocal, setFotosPorLocal] = useState<Record<string, FotoVisita[]>>({});

  // Combustible state
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [combustibleLoading, setCombustibleLoading] = useState(true);
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [filtroFecha, setFiltroFecha] = useState<'semana' | 'mes' | 'todo'>('semana');
  const [activePhoto, setActivePhoto] = useState<{ images: { url: string; title: string }[]; index: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'ventas' | 'gastos' | 'peajes'>('ventas');
  const [fotosCombustible, setFotosCombustible] = useState<Record<string, string>>({});
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [incluirFotosEnPDF, setIncluirFotosEnPDF] = useState(true);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [descargandoZipEvidencia, setDescargandoZipEvidencia] = useState(false);

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
    const { from, to } = getRange(period, selectedDate);
    const { data: rutasData } = await supabase
      .from('rutas')
      .select('*')
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (rutasData && rutasData.length > 0) {
      const ids = rutasData.map((r: any) => r.id_ruta);
      const { data: bitData } = await supabase.from('viajes_bitacora').select('*').in('id_ruta', ids).order('created_at', { ascending: true });
      
      // Cargar locales_ruta para cada ruta
      const { data: localesData } = await supabase.from('locales_ruta').select('*').in('id_ruta', ids).order('orden', { ascending: true });
      
      // Cargar fotos de evidencia por local
      const localRutaIds = localesData?.map(l => l.id_local_ruta) || [];
      let fotosMap: Record<string, FotoVisita[]> = {};
      if (localRutaIds.length > 0) {
        const { data: fotosData } = await supabase.from('fotos_visita').select('*').in('id_local_ruta', localRutaIds).order('orden', { ascending: true });
        if (fotosData) {
          fotosData.forEach((f: any) => {
            if (!fotosMap[f.id_local_ruta]) fotosMap[f.id_local_ruta] = [];
            fotosMap[f.id_local_ruta].push(f as FotoVisita);
          });
        }
      }
      setFotosPorLocal(fotosMap);

      const enriched = rutasData.map((r: any) => {
        const bits = (bitData || []).filter((b: any) => b.id_ruta === r.id_ruta);
        const locales = (localesData || []).filter((l: any) => l.id_ruta === r.id_ruta);
        const duracionMins = r.hora_salida_planta && r.hora_llegada_planta
          ? differenceInMinutes(new Date(r.hora_llegada_planta), new Date(r.hora_salida_planta)) : null;
        return { ...r, bitacora: bits, localesRuta: locales, duracionMins };
      });
      setAllRutas(enriched as RutaConBitacora[]);
    } else {
      setAllRutas([]);
    }
    setLoading(false);
  }

  async function loadCombustible() {
    setCombustibleLoading(true);
    try {
      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre)')
        .order('created_at', { ascending: false });

      const fechaInicio = startOfWeek(new Date(), { weekStartsOn: 1 });
      
      if (filtroFecha === 'semana') {
        query = query.gte('created_at', fechaInicio.toISOString());
      } else if (filtroFecha === 'mes') {
        const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        query = query.gte('created_at', mesInicio.toISOString());
      }

      const { data } = await query;

      if (data) {
        const mapped = data.map((g: any) => ({
          ...g,
          chofer_nombre: g.usuarios?.nombre,
          ruta_nombre: g.rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);
        
        // Cargar fotos de TODOS los gastos
        const fotosMap: Record<string, string> = {};
        for (const gasto of data) {
          if (gasto.foto_url) {
            try {
              const base64 = await urlToBase64(gasto.foto_url);
              if (base64) {
                fotosMap[gasto.id_gasto] = base64;
              }
            } catch (e) {
              console.warn('[Gastos] Error loading foto:', gasto.id_gasto);
            }
          }
        }
        console.log('[Gastos] Fotos loaded:', Object.keys(fotosMap).length, 'de', data.length);
        setFotosCombustible(fotosMap);
      }
    } catch (err) {
      console.error('[Gastos] Error:', err);
    } finally {
      setCombustibleLoading(false);
    }
  }

  const gastosCombustible = useMemo(() => gastos.filter(g => g.tipo_combustible !== 'otro'), [gastos]);
  const gastosOtros = useMemo(() => gastos.filter(g => g.tipo_combustible === 'otro'), [gastos]);

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
    
    allRutas.forEach((ruta: any) => {
      if (ruta.localesRuta) {
        ruta.localesRuta.forEach((local: any) => {
          const fotos = fotosPorLocal[local.id_local_ruta] || [];
          fotos.forEach((foto: FotoVisita) => {
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
          ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
        const nextBit = bits[i + 1];
        const permanencia = b.hora_llegada && nextBit?.hora_salida
          ? differenceInMinutes(new Date(nextBit.hora_salida), new Date(b.hora_llegada)) : null;
        return `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;">${i + 1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${b.origen_nombre || '-'} → ${b.destino_nombre || '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_salida ? formatPeru(b.hora_salida, 'HH:mm') : '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_llegada ? formatPeru(b.hora_llegada, 'HH:mm') : '⏳'}</td>
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
          ${r.hora_salida_planta ? `<span>🕐 Salida planta: <strong>${formatPeru(r.hora_salida_planta, 'HH:mm')}</strong></span>` : ''}
          ${r.hora_llegada_planta ? `<span>🏁 Llegada planta: <strong>${formatPeru(r.hora_llegada_planta, 'HH:mm')}</strong></span>` : ''}
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
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Reportes</h1>
          <p className="text-text-muted text-sm capitalize">{rangoLabel}</p>
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
                            📅 {ruta.fecha ? formatFriendlyDate(ruta.fecha) : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {ruta.hora_salida_planta && (
                          <span className="text-xs text-text-muted">
                            🕐 {formatPeru(ruta.hora_salida_planta, 'HH:mm')}
                            {ruta.hora_llegada_planta && ` → ${formatPeru(ruta.hora_llegada_planta, 'HH:mm')}`}
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
                              const dur = b.hora_salida && b.hora_llegada ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
                              return (
                                <tr key={b.id_bitacora} className="border-b border-white/5 hover:bg-white/5">
                                  <td className="px-4 py-2 text-primary font-black">{i + 1}</td>
                                  <td className="px-4 py-2 text-white font-bold italic">{b.origen_nombre} <span className="text-primary">→</span> {b.destino_nombre}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_salida ? formatPeru(b.hora_salida, 'HH:mm') : '-'}</td>
                                  <td className="px-4 py-2 text-text-muted">{b.hora_llegada ? formatPeru(b.hora_llegada, 'HH:mm') : <span className="text-blue-400 animate-pulse">En camino</span>}</td>
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
                                          
                                          // Encontrar el índice de la foto clickeada en el array de la ruta
                                          const clickedIndex = allRouteFotos.findIndex(f => f.url === foto.foto_url);
                                          
                                          setActivePhoto({ 
                                            images: allRouteFotos, 
                                            index: clickedIndex >= 0 ? clickedIndex : 0 
                                          });
                                        }}
                                        className="w-full"
                                      >
                                        <img src={foto.foto_url} alt={`Foto ${idx + 1}`} className="w-full aspect-square object-cover rounded cursor-zoom-in hover:brightness-110 transition-all" />
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
                <p className="text-xs text-blue-300 uppercase font-bold">Otros Hoy</p>
                <p className="text-xl font-black text-blue-400">S/ {gastosOtros.reduce((sum, g) => sum + (g.monto || 0), 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-300 uppercase font-bold">Transacciones</p>
                <p className="text-xl font-black text-blue-400">{gastosOtros.length}</p>
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
                        <img 
                          src={fotosCombustible[gasto.id_gasto]} 
                          alt="Comprobante" 
                          className="w-full h-40 object-cover cursor-pointer"
                          onClick={() => setShowFotoModal(fotosCombustible[gasto.id_gasto])}
                        />
                        <button
                          onClick={() => handleDownloadFoto(fotosCombustible[gasto.id_gasto], `${gasto.chofer_nombre}_${gasto.monto}.jpg`)}
                          className="absolute bottom-2 right-2 bg-black/60 p-1.5 rounded-full hover:bg-black/80"
                          title="Descargar"
                        >
                          <DownloadIcon size={14} className="text-white" />
                        </button>
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
                  <FileDown size={24} className="text-primary" />
                  Otros Gastos
                </h2>
              </div>
              <p className="text-text-muted mb-4">Gastos adicionales como estacionamiento, peajes y otros.</p>

              <div className="flex flex-wrap gap-3 items-center mb-4">
                <div className="flex bg-surface-light rounded-xl overflow-hidden border border-white/5">
                  {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)}
                      className={`px-5 py-2.5 text-sm font-black italic transition-all ${period === p.key ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {gastosOtros.length === 0 ? (
                <div className="text-center py-12 no-print">
                  <FileDown className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
                  <p className="text-text-muted">No hay otros gastos registrados</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <Button onClick={handleExportarOtrosPDF} className="flex items-center gap-2">
                      <Download size={18} />
                      Exportar PDF
                    </Button>
                  </div>

                  <div className="bg-surface-light/30 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-surface text-text-muted uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 text-center">Foto</th>
                          <th className="px-4 py-3 text-left">Fecha</th>
                          <th className="px-4 py-3 text-left">Chofer</th>
                          <th className="px-4 py-3 text-left">Ruta</th>
                          <th className="px-4 py-3 text-right">Monto</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-light">
                        {gastosOtros.map(gasto => (
                          <tr key={gasto.id_gasto} className="hover:bg-surface-light/50">
                            <td className="px-4 py-3 text-center">
                              {fotosCombustible[gasto.id_gasto] ? (
                                <button 
                                  onClick={() => setShowFotoModal(fotosCombustible[gasto.id_gasto])}
                                  className="w-10 h-10 rounded-lg overflow-hidden border border-surface-light hover:border-primary transition-colors"
                                >
                                  <img 
                                    src={fotosCombustible[gasto.id_gasto]} 
                                    alt="Comprobante" 
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="text-text-muted">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-white">
                              {gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-4 py-3 text-white">{gasto.chofer_nombre || '-'}</td>
                            <td className="px-4 py-3 text-white">{gasto.ruta_nombre || '-'}</td>
                            <td className="px-4 py-3 text-green-400 text-right font-bold">
                              S/ {(gasto.monto || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                gasto.estado === 'confirmado' ? 'bg-green-500/20 text-green-400' :
                                gasto.estado === 'pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {gasto.estado || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-surface font-bold">
                        <tr>
                          <td></td>
                          <td className="px-4 py-3 text-white" colSpan={3}>Total</td>
                          <td className="px-4 py-3 text-green-400 text-right">
                            S/ {gastosOtros.reduce((sum, g) => sum + (g.monto || 0), 0).toFixed(2)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
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

