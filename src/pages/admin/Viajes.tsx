import { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { logDelete } from '../../lib/audit';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw, Truck } from 'lucide-react';
import { nowPeru, formatHoraPeru, formatDuration } from '../../lib/timezone';
import { SubirGuiasModal } from '../../components/SubirGuiasModal';

// Hooks & Components
import { useViajesData, RutaConDetalle } from './viajes/hooks/useViajesData';
import { RouteCard } from './viajes/components/RouteCard';

const parseLocalDate = (dateStr: string | null) => {
  if (!dateStr || dateStr === 'Sin fecha') return null;
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } catch { return null; }
};

export default function AdminViajes() {
  const { rutas, allChoferes, allAsistentes, loading, refreshData } = useViajesData();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRuta, setExpandedRuta] = useState<string | null>(null);
  const [editingLocalParaGuia, setEditingLocalParaGuia] = useState<any>(null);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [newSegment, setNewSegment] = useState({ origen_nombre: '', destino_nombre: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingRuta, setEditingRuta] = useState<RutaConDetalle | null>(null);
  const [editFormData, setEditFormData] = useState({
    id_chofer: '', id_asistente: '', placa: '', observaciones: ''
  });

  // HANDLERS
  const handleCloseViaje = async (viaje: RutaConDetalle) => {
    if (!window.confirm('¿Finalizar viaje y cerrar bitácora?')) return;
    setIsSubmitting(true);
    try {
      const now = nowPeru();
      if (viaje.bitacora && viaje.bitacora.length > 0) {
        const lastTramo = viaje.bitacora[viaje.bitacora.length - 1];
        if (!lastTramo.hora_llegada) {
          await supabase.from('viajes_bitacora').update({ hora_llegada: now }).eq('id_bitacora', lastTramo.id_bitacora);
        }
        if (lastTramo.destino_nombre !== 'Planta') {
          await supabase.from('viajes_bitacora').insert({ 
            id_ruta: viaje.id_ruta, 
            id_chofer: viaje.id_chofer, 
            origen_nombre: lastTramo.destino_nombre, 
            destino_nombre: 'Planta', 
            hora_salida: now, 
            hora_llegada: now 
          });
        }
      }
      await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', viaje.id_ruta);
      refreshData();
    } finally { setIsSubmitting(false); }
  };

  const handleAddSegment = async (rutaId: string) => {
    if (!newSegment.origen_nombre || !newSegment.destino_nombre) return;
    setIsSubmitting(true);
    try {
      const now = nowPeru();
      await supabase.from('viajes_bitacora').insert({
        id_ruta: rutaId,
        origen_nombre: newSegment.origen_nombre,
        destino_nombre: newSegment.destino_nombre,
        hora_salida: now,
      });
      await supabase.from('rutas').update({ estado: 'en_progreso' }).eq('id_ruta', rutaId);
      refreshData();
      setShowForm(null);
    } finally { setIsSubmitting(false); }
  };

  const handleUpdateRuta = async () => {
    if (!editingRuta) return;
    setIsSubmitting(true);
    try {
      const selectedAsistente = allAsistentes.find(a => a.id_usuario === editFormData.id_asistente);
      const { error } = await supabase.from('rutas').update({
        id_chofer: editFormData.id_chofer,
        id_asistente: editFormData.id_asistente || null,
        nombre_asistente: selectedAsistente?.nombre || null,
        placa: editFormData.placa,
        observaciones: editFormData.observaciones
      }).eq('id_ruta', editingRuta.id_ruta);
      if (error) throw error;
      refreshData();
      setEditingRuta(null);
    } catch (err) { alert('Error al actualizar la ruta'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteViaje = async (viaje: RutaConDetalle) => {
    if (!window.confirm('¿Estás seguro de eliminar todo el registro de esta ruta diaria?')) return;
    setIsSubmitting(true);
    try {
      const { data: localesData } = await supabase.from('locales_ruta').select('id_local_ruta').eq('id_ruta', viaje.id_ruta);
      const localesIds = localesData?.map(l => l.id_local_ruta) || [];
      if (localesIds.length > 0) await supabase.from('fotos_visita').delete().in('id_local_ruta', localesIds);
      await supabase.from('gastos_combustible').delete().eq('id_ruta', viaje.id_ruta);
      await supabase.from('viajes_bitacora').delete().eq('id_ruta', viaje.id_ruta);
      await supabase.from('locales_ruta').delete().eq('id_ruta', viaje.id_ruta);
      await logDelete('rutas', viaje.id_ruta, viaje);
      await supabase.from('rutas').delete().eq('id_ruta', viaje.id_ruta);
      refreshData();
    } catch (err) { alert('Error al eliminar'); } finally { setIsSubmitting(false); }
  };

  const handlePrint = (viaje: RutaConDetalle) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html><head><title>Reporte - ${viaje.nombre}</title><style>body{font-family:sans-serif;padding:40px;color:#333;}h1{font-style:italic;text-transform:uppercase;margin-bottom:5px;}.header{border-bottom:2px solid #000;padding-bottom:20px;margin-bottom:30px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:12px;text-align:left;}th{background:#f5f5f5;font-size:12px;text-transform:uppercase;}</style></head>
      <body>
        <div class="header"><h1>SHIMAYA - REPORTE DE VIAJE</h1><p><strong>Ruta:</strong> ${viaje.nombre} | <strong>Placa:</strong> ${viaje.placa || 'N/A'}</p></div>
        <p><strong>Chofer:</strong> ${viaje.chofer?.nombre || 'No asignado'}</p>
        <p><strong>Fecha:</strong> ${viaje.fecha ? format(parseLocalDate(viaje.fecha)!, 'PPPP', { locale: es }) : 'S/F'}</p>
        <h3>BITÁCORA</h3>
        <table><thead><tr><th>Tramo</th><th>Salida</th><th>Llegada</th><th>Duración</th></tr></thead><tbody>
          ${viaje.bitacora?.map(t => `<tr><td>${t.origen_nombre} → ${t.destino_nombre}</td><td>${formatHoraPeru(t.hora_salida)}</td><td>${t.hora_llegada ? formatHoraPeru(t.hora_llegada) : '-'}</td><td>${formatDuration(t.hora_salida, t.hora_llegada)}</td></tr>`).join('')}
        </tbody></table>
        <script>window.print();</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // FILTERED DATA
  const groupedRutas = useMemo(() => {
    const filtered = rutas.filter(r => {
      const s = searchTerm.toLowerCase();
      return r.nombre?.toLowerCase().includes(s) || r.chofer?.nombre?.toLowerCase().includes(s) || r.placa?.toLowerCase().includes(s);
    });
    const sorted = [...filtered].sort((a, b) => {
      const estadoOrden: Record<string, number> = { 'en_progreso': 0, 'pendiente': 1, 'finalizada': 2 };
      const ordenA = estadoOrden[a.estado as string] ?? 3;
      const ordenB = estadoOrden[b.estado as string] ?? 3;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return (b.fecha || '').localeCompare(a.fecha || '');
    });
    const grouped: Record<string, RutaConDetalle[]> = {};
    for (const r of sorted) {
      const date = r.fecha || 'Sin fecha';
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(r);
    }
    return grouped;
  }, [rutas, searchTerm]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white italic uppercase tracking-tighter">Seguimiento en Vivo</h1>
          <p className="text-text-muted text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
            Tiempo real activo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={refreshData} className="flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
          </Button>
          <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-80" />
        </div>
      </div>

      <div className="space-y-12">
        {Object.keys(groupedRutas).sort((a, b) => b.localeCompare(a)).map(date => (
          <div key={date} className="space-y-6">
            <div className="flex items-center gap-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2 border-b border-white/5">
              <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em]">
                {date !== 'Sin fecha' ? format(parseLocalDate(date)!, 'PPPP', { locale: es }) : 'Sin Fecha'}
              </h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {groupedRutas[date].map(viaje => (
                <RouteCard 
                  key={viaje.id_ruta}
                  viaje={viaje}
                  isExpanded={expandedRuta === viaje.id_ruta}
                  onToggle={() => setExpandedRuta(expandedRuta === viaje.id_ruta ? null : viaje.id_ruta)}
                  onPrint={handlePrint}
                  onEdit={(v) => {
                    setEditingRuta(v);
                    setEditFormData({ id_chofer: v.id_chofer || '', id_asistente: v.id_asistente || '', placa: v.placa || '', observaciones: v.observaciones || '' });
                  }}
                  onCloseViaje={handleCloseViaje}
                  onAddSegment={(id) => {
                    setShowForm(id);
                    setNewSegment({ origen_nombre: viaje.bitacora?.length ? (viaje.bitacora[viaje.bitacora.length - 1].destino_nombre || 'Local') : 'Planta', destino_nombre: '' });
                  }}
                  onUploadGuia={setEditingLocalParaGuia}
                  onDelete={handleDeleteViaje}
                  showForm={showForm}
                  newSegment={newSegment}
                  setNewSegment={setNewSegment}
                  handleAddSegment={handleAddSegment}
                  setShowForm={setShowForm}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {editingLocalParaGuia && <SubirGuiasModal local={editingLocalParaGuia} onClose={() => setEditingLocalParaGuia(null)} />}

      {editingRuta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-surface p-6 rounded-2xl border border-white/10 shadow-2xl space-y-6">
            <h3 className="text-xl font-black text-white uppercase italic border-b border-white/5 pb-2">Editar Ruta</h3>
            <div className="space-y-4">
              <select className="w-full bg-background border border-white/10 rounded-lg p-2 text-white" value={editFormData.id_chofer} onChange={e => setEditFormData({ ...editFormData, id_chofer: e.target.value })}>
                {allChoferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
              </select>
              <select className="w-full bg-background border border-white/10 rounded-lg p-2 text-white" value={editFormData.id_asistente} onChange={e => setEditFormData({ ...editFormData, id_asistente: e.target.value })}>
                <option value="">-- Sin asistente --</option>
                {allAsistentes.map(a => <option key={a.id_usuario} value={a.id_usuario}>{a.nombre}</option>)}
              </select>
              <Input label="Placa" value={editFormData.placa} onChange={e => setEditFormData({ ...editFormData, placa: e.target.value })} />
              <textarea className="w-full bg-background border border-white/10 rounded-lg p-2 text-white min-h-[80px]" placeholder="Observaciones" value={editFormData.observaciones} onChange={e => setEditFormData({ ...editFormData, observaciones: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <Button variant="ghost" onClick={() => setEditingRuta(null)}>CANCELAR</Button>
              <Button onClick={handleUpdateRuta} disabled={isSubmitting}>GUARDAR</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
