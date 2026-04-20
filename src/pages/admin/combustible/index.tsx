import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GastoCombustible, Usuario } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Fuel, Truck, Calendar, Download, FileText, FileSpreadsheet, Check, X, Eye, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatPeru } from '../../../lib/timezone';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const urlToBase64 = async (url: string): Promise<string | null> => {
  try {
    console.log('[PDF] Fetching URL:', url);
    
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'include'
    });
    console.log('[PDF] Response status:', response.status, response.statusText);
    if (!response.ok) {
      console.error('[PDF] Fetch failed:', response.status);
      return null;
    }
    const blob = await response.blob();
    console.log('[PDF] Blob size:', blob.size, 'type:', blob.type);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[PDF] Reader result length:', reader.result ? (reader.result as string).length : 0);
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.error('[PDF] Reader error');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e: any) {
    console.error('[PDF] Error fetching image:', e.message || e);
    return null;
  }
};

const urlToBase64Supabase = async (url: string): Promise<string | null> => {
  try {
    console.log('[PDF] Trying to download image from URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('[PDF] Fetch failed:', response.status, response.statusText);
      return null;
    }
    
    const blob = await response.blob();
    console.log('[PDF] Blob received:', blob.size, 'type:', blob.type);
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[PDF] Converted to base64, length:', (reader.result as string)?.length);
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.error('[PDF] FileReader error');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e: any) {
    console.error('[PDF] Error:', e.message || e);
    return null;
  }
};

type TabType = 'todos' | 'pendientes' | 'confirmados' | 'combustible' | 'otros';

interface GrupoFecha {
  fecha: string;
  gastos: GastoCombustible[];
  total: number;
}

interface GrupoChofer {
  choferId: string;
  choferNombre: string;
  gastos: GastoCombustible[];
  total: number;
}

export default function GastosCombustible() {
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const getFechaActual = () => {
    const now = new Date();
    return format(now, 'yyyy-MM-dd');
  };
  
  const getInicioSemana = () => {
    const now = new Date();
    const day = now.getDay();
    const inicioSemana = new Date(now);
    inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
    return format(inicioSemana, 'yyyy-MM-dd');
  };
  
  const getFechasIniciales = () => {
    const desde = getInicioSemana();
    const hasta = getFechaActual();
    console.log('[DEBUG] Fechas iniciales calculadas:', desde, hasta);
    return { desde, hasta };
  };
  
  const initialDates = getFechasIniciales();
  
  const [forceKey, setForceKey] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>('');
  const [filtroChofer, setFiltroChofer] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 20;
  const [fotosCombustible, setFotosCombustible] = useState<Record<string, string>>({});
  const [editandoTipo, setEditandoTipo] = useState<string | null>(null);
  const [tipoEditando, setTipoEditando] = useState('');

  useEffect(() => {
    // Force reload to avoid cache
    console.log('[MOUNT] Componente combustible montado');
    loadChoferes();
    setPaginaActual(1);
    loadGastos();
  }, []);

  useEffect(() => {
    setPaginaActual(1);
    loadGastos();
  }, [activeTab, filtroFechaDesde, filtroFechaHasta, filtroChofer]);

  const loadChoferes = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre')
      .eq('rol', 'chofer')
      .order('nombre');
    if (data) setChoferes(data);
  };

  const loadGastos = async () => {
    setLoading(true);
    
// Si no hay fechas, usar la semana actual
    let desde = filtroFechaDesde;
    let hasta = filtroFechaHasta;
    
    if (!desde || !hasta) {
      const now = new Date();
      const day = now.getDay();
      const inicioSemana = new Date(now);
      inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
      desde = format(inicioSemana, 'yyyy-MM-dd');
      hasta = format(now, 'yyyy-MM-dd');
      console.log('[Combustible] Fechas por defecto:', desde, hasta);
    } else {
      console.log('[Combustible] Fechas usadas:', desde, hasta);
    }
       
    // Primero obtener las rutas dentro del rango de fechas
    let rutasQuery = supabase.from('rutas').select('id_ruta, fecha');
       
    if (desde) {
      rutasQuery = rutasQuery.gte('fecha', desde);
    }
    if (hasta) {
      rutasQuery = rutasQuery.lte('fecha', hasta);
    }
      
      const { data: rutasData, error: rutasError } = await rutasQuery;
      console.log('[Combustible] Fechas filtro:', filtroFechaDesde, '-', filtroFechaHasta);
      console.log('[Combustible] Rutas encontradas:', rutasData?.length, rutasError);
      console.log('[Combustible] Rutas:', rutasData?.map(r => r.fecha));
      
      const rutaIds = rutasData?.map(r => r.id_ruta) || [];
      console.log('[Combustible] Ruta IDs:', rutaIds);
      
      // Si no hay rutas, no mostrar nada
      if (rutaIds.length === 0) {
        setGastos([]);
        setLoading(false);
        return;
      }
      
      // Luego obtener gastos de esas rutas
      let query = supabase
        .from('gastos_combustible')
        .select('id_gasto, id_chofer, id_ruta, tipo_combustible, monto, foto_url, estado, created_at, usuarios(nombre), rutas(nombre, fecha)')
        .in('id_ruta', rutaIds)
        .order('created_at', { ascending: false });

      if (filtroChofer) {
        query = query.eq('id_chofer', filtroChofer);
      }
      if (activeTab === 'pendientes') {
        query = query.eq('estado', 'pendiente_revision');
      } else if (activeTab === 'confirmados') {
        query = query.eq('estado', 'confirmado');
      } else if (activeTab === 'rechazados') {
        query = query.eq('estado', 'rechazado');
      } else if (activeTab === 'combustible') {
        query = query.in('tipo_combustible', ['glp', 'gasolina', 'diesel']);
      } else if (activeTab === 'otros') {
        query = query.eq('tipo_combustible', 'otro');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Gastos] Error:', error);
      }
      
      if (data) {
        console.log('[Gastos] activos - tab:', activeTab);
        console.log('[Gastos] Total:', data.length);
        console.log('[Gastos] Tipos:', [...new Set(data.map((g: any) => g.tipo_combustible))]);
        console.log('[Gastos] Detalle:', data.map(g => `${g.tipo_combustible} - S/${g.monto}`));
        console.log('Gastos con fotos:', data.filter((g: any) => g.foto_url).length);
        const mapped = data.map((g: any) => ({
          ...g,
          chofer_nombre: g.usuarios?.nombre,
          ruta_nombre: g.rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);
      console.log('[Combustible] Gastos cargados:', mapped?.length, 'GLP:', mapped?.filter(g => g.tipo_combustible === 'glp').reduce((s, g) => s + (g.monto || 0), 0));
      alert(`CARGADOS: ${mapped?.length} gastos. GLP: S/${mapped?.filter(g => g.tipo_combustible === 'glp').reduce((s, g) => s + (g.monto || 0), 0)}`);
        
        // Cargar fotos de combustible
        const fotosMap: Record<string, string> = {};
        for (const gasto of data) {
          if (gasto.foto_url) {
            const base64 = await urlToBase64(gasto.foto_url);
            if (base64) {
              fotosMap[gasto.id_gasto] = base64;
            }
          }
        }
        setFotosCombustible(fotosMap);
      }
    } catch (err) {
      console.error('[Gastos] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const gastosAgrupadosPorFecha = (): GrupoFecha[] => {
    const grupos: Record<string, GastoCombustible[]> = {};
    gastos.forEach(gasto => {
      const fecha = gasto.created_at ? formatPeru(gasto.created_at, 'yyyy-MM-dd') : 'sin fecha';
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
    gastos.forEach(gasto => {
      const choferId = gasto.id_chofer || 'sin chofer';
      const choferNombre = gasto.chofer_nombre || 'Sin nombre';
      if (!grupos[choferId]) {
        grupos[choferId] = { nombre: choferNombre, gastos: [] };
      }
      grupos[choferId].gastos.push(gasto);
    });
    return Object.entries(grupos)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([choferId, data]) => ({
        choferId,
        choferNombre: data.nombre,
        gastos: data.gastos,
        total: data.gastos.reduce((sum, g) => sum + (g.monto || 0), 0)
      }));
  };

  const totalesPorTipo = gastos.reduce((acc, g) => {
    const tipo = g.tipo_combustible || 'otro';
    acc[tipo] = (acc[tipo] || 0) + (g.monto || 0);
    return acc;
  }, {} as Record<string, number>);

  const totalGeneral = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

  const pendientesCount = gastos.filter(g => g.estado === 'pendiente_revision').length;
  const confirmadosCount = gastos.filter(g => g.estado === 'confirmado').length;

  const topChoferes = gastosAgrupadosPorChofer().slice(0, 5);

  const gastosPaginados = gastos.slice(
    (paginaActual - 1) * registrosPorPagina,
    paginaActual * registrosPorPagina
  );
  const totalPaginas = Math.ceil(gastos.length / registrosPorPagina);

  const getPeriodoLabel = () => {
    return `${format(parseISO(filtroFechaDesde), 'dd/MM/yyyy')} - ${format(parseISO(filtroFechaHasta), 'dd/MM/yyyy')}`;
  };

  const generarPDF = () => {
    const periodoLabel = getPeriodoLabel();
    const estadoLabel = activeTab === 'todos' ? 'Todos' : activeTab === 'pendientes' ? 'Pendientes' : 'Confirmados';
    
    const formatMins = (mins: number | null) => {
      if (mins === null) return '-';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    
    // Generar HTML para cada grupo
    const gruposHTML = agruparPor === 'fecha' 
      ? gastosAgrupadosPorFecha().map(grupo => {
          const gastosHTML = grupo.gastos.map(gasto => {
            const tieneFoto = fotosCombustible[gasto.id_gasto];
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
              <div><strong style="font-size:14px;">📅 ${format(parseISO(grupo.fecha), 'dd MMMM yyyy', { locale: es })}</strong></div>
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
            const tieneFoto = fotosCombustible[gasto.id_gasto];
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
    
    // Fotos de comprobantes
    const gastosConFoto = gastos.filter(g => fotosCombustible[g.id_gasto]);
    let fotosHTML = '';
    if (gastosConFoto.length > 0) {
      fotosHTML = `<div style="margin-top:30px;">
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
              const fechaPeru = gasto.created_at ? new Date(new Date(gasto.created_at).getTime() + 5 * 60 * 60 * 1000) : null;
              fechaPeru ? format(fechaPeru, 'dd/MM/yyyy HH:mm') : ''
            </div>
          </div>`;
        }
      });
      
      fotosHTML += `</div></div>`;
    }
    
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
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <div>
      <p class="header-title">⛽ SHIMAYA RUTAS & LOGÍSTICA</p>
      <p class="header-sub">📋 Reporte de Combustible · ${periodoLabel}</p>
    </div>
  </div>
  <div style="font-size:11px;opacity:0.5;text-align:right;">Generado:<br>${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
</div>
<button class="close-btn" onclick="if(window.opener){window.close();}else{history.back();}">✕ Cerrar</button>

<div class="badge-row">
  <div class="badge"><span class="badge-val" style="color:#22c55e;">S/ ${totalGeneral.toFixed(2)}</span><span class="badge-lbl">Total General</span></div>
  <div class="badge"><span class="badge-val">${gastos.length}</span><span class="badge-lbl">Total Cargas</span></div>
  <div class="badge"><span class="badge-val" style="color:#eab308;">${pendientesCount}</span><span class="badge-lbl">Pendientes</span></div>
  <div class="badge"><span class="badge-val" style="color:#22c55e;">${confirmadosCount}</span><span class="badge-lbl">Confirmados</span></div>
  <div class="badge"><span class="badge-val" style="color:#22c55e;">S/ ${(totalesPorTipo.glp || 0).toFixed(2)}</span><span class="badge-lbl">GLP</span></div>
  <div class="badge"><span class="badge-val" style="color:#3b82f6;">S/ ${(totalesPorTipo.gasolina || 0).toFixed(2)}</span><span class="badge-lbl">Gasolina</span></div>
  <div class="badge"><span class="badge-val" style="color:#f97316;">S/ ${(totalesPorTipo.diesel || 0).toFixed(2)}</span><span class="badge-lbl">Diesel</span></div>
</div>

<div class="content">
  <p style="font-size:12px;color:#64748b;margin-bottom:16px;">Agrupado por: ${agruparPor === 'fecha' ? 'Fecha' : 'Chofer'} · Estado: ${estadoLabel}</p>
  ${gruposHTML.join('')}
  ${fotosHTML}
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

  const generarExcel = () => {
    const fechaActual = format(new Date(), 'yyyy-MM-dd');
    const wb = XLSX.utils.book_new();
    
    const wsResumen = XLSX.utils.aoa_to_sheet([
      ['Reporte de Gastos de Combustible'],
      ['Período:', getPeriodoLabel()],
      ['Estado:', activeTab === 'todos' ? 'Todos' : activeTab === 'pendientes' ? 'Pendientes' : 'Confirmados'],
      ['Generado:', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['Resumen por Tipo'],
      ['Tipo', 'Total (S/)'],
      ['GLP', totalesPorTipo.glp || 0],
      ['Gasolina', totalesPorTipo.gasolina || 0],
      ['Diesel', totalesPorTipo.diesel || 0],
      ['TOTAL GENERAL', totalGeneral],
      [],
      ['Estadísticas'],
      ['Total de cargas', gastos.length],
      ['Pendientes', pendientesCount],
      ['Confirmados', confirmadosCount],
    ]);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    const wsPorChofer = XLSX.utils.aoa_to_sheet([
      ['Gastos por Chofer'],
      [],
      ['Chofer', 'Cargas', 'Total (S/)', 'GLP', 'Gasolina', 'Diesel'],
      ...gastosAgrupadosPorChofer().map(g => {
        const porTipo = g.gastos.reduce((acc, gg) => {
          const t = gg.tipo_combustible || 'otro';
          acc[t] = (acc[t] || 0) + (gg.monto || 0);
          return acc;
        }, {} as Record<string, number>);
        return [
          g.choferNombre,
          g.gastos.length,
          g.total,
          porTipo.glp || 0,
          porTipo.gasolina || 0,
          porTipo.diesel || 0
        ];
      })
    ]);
    XLSX.utils.book_append_sheet(wb, wsPorChofer, 'Por Chofer');
    
    const wsDetalle = XLSX.utils.aoa_to_sheet([
      ['Detalle de Gastos'],
      [],
      ['Fecha', 'Hora', 'Chofer', 'Tipo Combustible', 'Monto (S/)', 'Estado', 'Foto URL'],
      ...gastos.map(g => [
        g.created_at ? formatPeru(g.created_at, 'dd/MM/yyyy') : '-',
        g.created_at ? formatPeru(g.created_at, 'HH:mm') : '-',
        g.chofer_nombre || '-',
        g.tipo_combustible || '-',
        g.monto || 0,
        g.estado === 'confirmado' ? 'Confirmado' : g.estado === 'pendiente_revision' ? 'Pendiente' : 'Rechazado',
        g.foto_url || ''
      ])
    ]);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');
    
    XLSX.writeFile(wb, `reporte-combustible-${fechaActual}.xlsx`);
  };

  const actualizarEstado = async (idGasto: string, nuevoEstado: string) => {
    const { error } = await supabase
      .from('gastos_combustible')
      .update({ estado: nuevoEstado })
      .eq('id_gasto', idGasto);
    
    if (!error) {
      setGastos(gastos.map(g => 
        g.id_gasto === idGasto ? { ...g, estado: nuevoEstado } : g
      ));
    }
  };

  const actualizarTipo = async (idGasto: string) => {
    if (!tipoEditando) return;
    
    const { error } = await supabase
      .from('gastos_combustible')
      .update({ tipo_combustible: tipoEditando })
      .eq('id_gasto', idGasto);
    
    if (!error) {
      setGastos(gastos.map(g => 
        g.id_gasto === idGasto ? { ...g, tipo_combustible: tipoEditando as any } : g
      ));
    }
    setEditandoTipo(null);
    setTipoEditando('');
  };

  const eliminarGasto = async (idGasto: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) return;
    
    const { error } = await supabase
      .from('gastos_combustible')
      .delete()
      .eq('id_gasto', idGasto);
    
    if (!error) {
      setGastos(gastos.filter(g => g.id_gasto !== idGasto));
    }
  };

  const tabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'combustible', label: 'GLP/Gas/Diesel' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'confirmados', label: 'Confirmados' },
    { key: 'otros', label: 'Otros' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Fuel className="text-primary" />
          Gastos Combustible
        </h1>
        
        <div className="flex gap-2">
          <Button onClick={generarPDF} className="flex items-center gap-2">
            <FileText size={18} />
            Exportar PDF
          </Button>
          <Button onClick={generarExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
            <FileSpreadsheet size={18} />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.key ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-text-muted text-sm">Desde:</label>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          />
          <label className="text-text-muted text-sm">Hasta:</label>
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        <select
          value={filtroChofer}
          onChange={(e) => setFiltroChofer(e.target.value)}
          className="bg-surface border border-surface-light rounded-lg px-4 py-2 text-white"
        >
          <option value="">Todos los choferes</option>
          {choferes.map(c => (
            <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={() => setAgruparPor('fecha')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              agruparPor === 'fecha' ? 'bg-blue-600 text-white' : 'bg-surface text-text-muted'
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            Por Fecha
          </button>
          <button
            onClick={() => setAgruparPor('chofer')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              agruparPor === 'chofer' ? 'bg-green-600 text-white' : 'bg-surface text-text-muted'
            }`}
          >
            <Truck size={16} className="inline mr-2" />
            Por Chofer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
        <Card className="bg-blue-500/20 border-blue-500/40">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-blue-300 uppercase font-bold">Otros (Est/Pej)</p>
            <p className="text-xl font-black text-blue-400">S/ {(totalesPorTipo.otro || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-primary uppercase font-bold">TOTAL Combustible</p>
            <p className="text-xl font-black text-primary">S/ {((totalesPorTipo.glp || 0) + (totalesPorTipo.gasolina || 0) + (totalesPorTipo.diesel || 0)).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {topChoferes.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Truck size={18} className="text-primary" />
              Top Choferes con más Gasto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {topChoferes.map((g, i) => (
                <div key={g.choferId} className="bg-surface-light/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-text-muted">#{i + 1}</span>
                    <span className="text-white font-medium text-sm truncate">{g.choferNombre}</span>
                  </div>
                  <p className="text-green-400 font-bold">S/ {g.total.toFixed(2)}</p>
                  <p className="text-text-muted text-xs">{g.gastos.length} cargas</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Eye size={18} className="text-primary" />
            Detalle de Gastos
            <span className="text-text-muted text-sm font-normal">({gastos.length} registros)</span>
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-text-muted">Cargando...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-light">
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Fecha</th>
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Chofer</th>
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Tipo</th>
                      <th className="text-right py-3 px-2 text-text-muted font-medium">Monto</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Foto</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Estado</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosPaginados.map(gasto => (
                      <tr key={gasto.id_gasto} className="border-b border-surface-light/30 hover:bg-surface-light/20">
                        <td className="py-3 px-2 text-white">
                          {gasto.created_at ? formatPeru(gasto.created_at, 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td className="py-3 px-2 text-white">{gasto.chofer_nombre || 'Chofer'}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">
                          {gasto.foto_url ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setShowFotoModal(gasto.foto_url!)}
                                className="p-1 hover:bg-surface-light rounded"
                              >
                                <ImageIcon size={18} className="text-blue-400" />
                              </button>
                              <span className="text-xs text-text-muted">✓</span>
                            </div>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {gasto.estado === 'confirmado' ? (
                            <span className="text-green-400 text-xs">✓ Confirmado</span>
                          ) : gasto.estado === 'pendiente_revision' ? (
                            <span className="text-yellow-400 text-xs">⏳ Pendiente</span>
                          ) : gasto.estado === 'rechazado' ? (
                            <div>
                              <span className="text-red-400 text-xs">✗ Rechazado</span>
                              {gasto.notas && <p className="text-[10px] text-text-muted mt-1">Motivo: {gasto.notas}</p>}
                            </div>
                          ) : (
                            <span className="text-red-400 text-xs">✗ Rechazado</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {editandoTipo === gasto.id_gasto ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={tipoEditando}
                                onChange={(e) => setTipoEditando(e.target.value)}
                                className="bg-surface border border-primary rounded px-1 py-0.5 text-xs text-white"
                              >
                                <option value="glp">GLP</option>
                                <option value="gasolina">Gasolina</option>
                                <option value="diesel">Diesel</option>
                                <option value="otro">Otro</option>
                              </select>
                              <button
                                onClick={() => actualizarTipo(gasto.id_gasto)}
                                className="p-1 hover:bg-green-500/20 rounded"
                                title="Guardar"
                              >
                                <Check size={14} className="text-green-400" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditandoTipo(null);
                                  setTipoEditando('');
                                }}
                                className="p-1 hover:bg-red-500/20 rounded"
                                title="Cancelar"
                              >
                                <X size={14} className="text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditandoTipo(gasto.id_gasto);
                                  setTipoEditando(gasto.tipo_combustible || 'glp');
                                }}
                                className="p-1 hover:bg-primary/20 rounded"
                                title="Cambiar tipo"
                              >
                                <Fuel size={14} className="text-primary" />
                              </button>
                              <button
                                onClick={() => eliminarGasto(gasto.id_gasto)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-text-muted text-sm">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {gastos.length === 0 && !loading && (
        <div className="text-center py-12">
          <Fuel className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
          <p className="text-text-muted">No hay gastos registrados</p>
        </div>
      )}

      {showFotoModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFotoModal(null)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setShowFotoModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img 
              src={showFotoModal} 
              alt="Foto del ticket" 
              className="max-h-[80vh] w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
