import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Ruta } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FileDown, Truck, Clock, MapPin, CheckCircle2, Calendar, Filter, X, Share2 } from 'lucide-react';
import { format, differenceInMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function localToday(): string { return format(new Date(), 'yyyy-MM-dd'); }

function formatMins(mins: number | null) {
  if (mins === null || mins === undefined || isNaN(mins as number)) return '-';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Period = 'diario' | 'semanal' | 'mensual';
interface RutaConBitacora extends Ruta { bitacora?: any[]; duracionMins?: number | null; }
interface Usuario { id_usuario: string; nombre: string; }


export default function Reportes() {
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(localToday());
  const [allRutas, setAllRutas] = useState<RutaConBitacora[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [rutasBase, setRutasBase] = useState<{ id_ruta_base: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filtros activos
  const [filterChofer, setFilterChofer] = useState('');
  const [filterRuta, setFilterRuta] = useState('');

  function getRange(p: Period, date: string): { from: string; to: string } {
    const d = parseISO(date);
    if (p === 'diario') return { from: date, to: date };
    if (p === 'semanal') return {
      from: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
    return {
      from: format(startOfMonth(d), 'yyyy-MM-dd'),
      to: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  }

  useEffect(() => { loadData(); }, [period, selectedDate]);

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
      const enriched = rutasData.map((r: any) => {
        const bits = (bitData || []).filter((b: any) => b.id_ruta === r.id_ruta);
        const duracionMins = r.hora_salida_planta && r.hora_llegada_planta
          ? differenceInMinutes(new Date(r.hora_llegada_planta), new Date(r.hora_salida_planta)) : null;
        return { ...r, bitacora: bits, duracionMins };
      });
      setAllRutas(enriched as RutaConBitacora[]);
    } else {
      setAllRutas([]);
    }
    setLoading(false);
  }

  // Aplicar filtros locales
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

  // Compartir resumen por WhatsApp
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

  // ── GENERADOR DE PDF ────────────────────────────────────────────────────────
  const handleGeneratePDF = () => {
    setGenerating(true);
    const rows = rutas.map(r => {
      const bits = r.bitacora || [];
      const estadoBadge = r.estado === 'finalizada' ? '#22c55e' : r.estado === 'en_progreso' ? '#3b82f6' : '#eab308';
      const paradas = bits.map((b: any, i: number) => {
        // Tiempo de tránsito: de hora_salida a hora_llegada del mismo tramo
        const transito = b.hora_salida && b.hora_llegada
          ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
        // Permanencia en el local destino: tiempo desde hora_llegada hasta la hora_salida del SIGUIENTE tramo
        const nextBit = bits[i + 1];
        const permanencia = b.hora_llegada && nextBit?.hora_salida
          ? differenceInMinutes(new Date(nextBit.hora_salida), new Date(b.hora_llegada)) : null;
        return `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;">${i + 1}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;font-weight:600;">${b.origen_nombre || '-'} → ${b.destino_nombre || '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#475569;">${b.hora_llegada ? format(new Date(b.hora_llegada), 'HH:mm') : '⏳'}</td>
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
            <span style="font-size:12px;opacity:0.7;">📅 ${r.fecha ? format(parseISO(r.fecha), "EEEE d MMM", { locale: es }) : '-'}</span>
            <span style="background:${estadoBadge}22;color:${estadoBadge};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;border:1px solid ${estadoBadge}44;">${r.estado?.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        <div style="padding:8px 16px;background:#f8fafc;font-size:12px;color:#64748b;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #e2e8f0;">
          ${r.hora_salida_planta ? `<span>🕐 Salida planta: <strong>${format(new Date(r.hora_salida_planta), 'HH:mm')}</strong></span>` : ''}
          ${r.hora_llegada_planta ? `<span>🏁 Llegada planta: <strong>${format(new Date(r.hora_llegada_planta), 'HH:mm')}</strong></span>` : ''}
          ${r.duracionMins ? `<span>⏱ Duración total: <strong>${formatMins(r.duracionMins)}</strong></span>` : ''}
        </div>
        ${bits.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">#</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Tramo</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Salida</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Llegada</th>
            <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Tránsito</th>
            <th style="padding:6px 8px;text-align:left;color:#f59e0b;font-weight:600;">⏳ Permanencia</th>
          </tr></thead>
          <tbody>${paradas}</tbody>
        </table>` :
        '<p style="padding:10px 16px;color:#94a3b8;font-size:12px;font-style:italic;margin:0;">Sin movimientos registrados</p>'}
      </div>`;
    }).join('');

    const filtrosTexto = [
      filterChofer ? `Chofer: ${choferNombre}` : '',
      filterRuta   ? `Ruta: ${filterRuta}` : '',
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
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:16px;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="64" height="64" style="flex-shrink:0;">
      <circle cx="100" cy="100" r="98" fill="#111111"/>
      <circle cx="100" cy="100" r="98" fill="none" stroke="#cc2222" stroke-width="3"/>
      <rect x="28" y="85" width="95" height="52" rx="4" fill="#ffffff"/>
      <rect x="123" y="95" width="48" height="42" rx="4" fill="#ffffff"/>
      <rect x="128" y="100" width="36" height="22" rx="2" fill="#cc2222"/>
      <rect x="133" y="108" width="16" height="18" rx="2" fill="#ffffff" stroke="#cc2222" stroke-width="1.5"/>
      <rect x="115" y="85" width="4" height="52" fill="#cc2222"/>
      <rect x="28" y="106" width="95" height="5" fill="#cc2222"/>
      <circle cx="55" cy="140" r="14" fill="#333333" stroke="#cc2222" stroke-width="2"/><circle cx="55" cy="140" r="7" fill="#777"/><circle cx="55" cy="140" r="3" fill="#ccc"/>
      <circle cx="140" cy="140" r="14" fill="#333333" stroke="#cc2222" stroke-width="2"/><circle cx="140" cy="140" r="7" fill="#777"/><circle cx="140" cy="140" r="3" fill="#ccc"/>
      <rect x="172" y="118" width="6" height="10" rx="2" fill="#ffdd00"/>
      <text x="100" y="174" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="#cc2222" letter-spacing="1">SHIMAYA</text>
      <text x="100" y="193" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#888" letter-spacing="4">RUTAS</text>
    </svg>
    <div>
      <p class="header-title">SHIMAYA RUTAS &amp; LOGÍSTICA</p>
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
<div class="footer">Shimaya Rutas © ${new Date().getFullYear()} — Este reporte es de uso interno</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=750');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
    setGenerating(false);
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
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleShareWhatsApp}
            disabled={rutas.length === 0}
            className="bg-[#25D366] hover:bg-[#1fb85a] flex items-center gap-2 font-black shadow-lg shadow-green-800/20"
          >
            <Share2 size={18} /> WhatsApp
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={generating}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-700/20 font-black"
          >
            <FileDown size={18} />
            {generating ? 'Generando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <Card className="border-surface-light">
        <CardContent className="p-5 space-y-4">
          {/* Período + Fecha */}
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

          {/* Filtros Ruta + Chofer */}
          <div className="flex flex-wrap gap-3 items-center border-t border-white/5 pt-4">
            <Filter size={14} className="text-text-muted" />
            <span className="text-xs text-text-muted uppercase font-black tracking-widest">Filtrar por:</span>

            {/* Por Ruta */}
            <div className="relative">
              <select value={filterRuta} onChange={e => setFilterRuta(e.target.value)}
                className="bg-surface-light border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white text-sm appearance-none focus:outline-none focus:border-primary min-w-[160px]">
                <option value="">Todas las rutas</option>
                {rutasBase.map(r => <option key={r.id_ruta_base} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </div>

            {/* Por Chofer */}
            <div className="relative">
              <select value={filterChofer} onChange={e => setFilterChofer(e.target.value)}
                className="bg-surface-light border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white text-sm appearance-none focus:outline-none focus:border-primary min-w-[160px]">
                <option value="">Todos los choferes</option>
                {choferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Limpiar filtros */}
            {hasFilters && (
              <button onClick={() => { setFilterChofer(''); setFilterRuta(''); }}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                <X size={12} /> Limpiar filtros
              </button>
            )}

            {hasFilters && (
              <span className="text-xs text-primary italic ml-auto">
                {rutas.length} resultado{rutas.length !== 1 ? 's' : ''}
                {filterChofer ? ` · ${choferNombre}` : ''}
                {filterRuta ? ` · ${filterRuta}` : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* LISTA */}
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
                        📅 {ruta.fecha ? format(parseISO(ruta.fecha), "EEE d MMM", { locale: es }) : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ruta.hora_salida_planta && (
                      <span className="text-xs text-text-muted">
                        🕐 {format(new Date(ruta.hora_salida_planta), 'HH:mm')}
                        {ruta.hora_llegada_planta && ` → ${format(new Date(ruta.hora_llegada_planta), 'HH:mm')}`}
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
                          const dur = b.hora_salida && b.hora_llegada
                            ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
                          return (
                            <tr key={b.id_bitacora} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-4 py-2 text-primary font-black">{i + 1}</td>
                              <td className="px-4 py-2 text-white font-bold italic">
                                {b.origen_nombre} <span className="text-primary">→</span> {b.destino_nombre}
                              </td>
                              <td className="px-4 py-2 text-text-muted">{b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
                              <td className="px-4 py-2 text-text-muted">
                                {b.hora_llegada ? format(new Date(b.hora_llegada), 'HH:mm') : <span className="text-blue-400 animate-pulse">En camino</span>}
                              </td>
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
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-center text-text-muted text-xs italic pb-4">
        💡 El PDF incluye el logo Shimaya y todos los filtros aplicados actualmente.
      </p>
    </div>
  );
}
