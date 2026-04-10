import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logDelete } from '../../lib/audit';
import type { Ruta, Usuario, ViajeBitacora } from '../../types';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format, differenceInMinutes } from 'date-fns';

import { es } from 'date-fns/locale';
import { Truck, ChevronDown, Plus, CheckCircle2, Clock, Timer, Printer, RefreshCw } from 'lucide-react';

const formatPeru = (dateStr: string | null | undefined, fmt: string): string => {
  if (!dateStr) return '-';
  return format(new Date(dateStr), fmt);
};

const parseLocalDate = (dateStr: string | null) => {
  if (!dateStr || dateStr === 'Sin fecha') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
};

export default function AdminViajes() {
  const [rutas, setRutas] = useState<(Ruta & { chofer?: Usuario, bitacora?: ViajeBitacora[] })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRuta, setExpandedRuta] = useState<string | null>(null);
  
  const [showForm, setShowForm] = useState<string | null>(null);
  const [newSegment, setNewSegment] = useState({
    origen_nombre: '',
    destino_nombre: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ROUTE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    amarilla: { bg: '#713f12', border: '#ca8a04', text: '#fef08a', icon: '#fde047' },
    negra:   { bg: '#1a1a1a', border: '#4a4a4a', text: '#d4d4d4', icon: '#ffffff' },
    guinda:  { bg: '#7c1c2e', border: '#991b1b', text: '#fca5a5', icon: '#f87171' },
    verde:   { bg: '#14532d', border: '#166534', text: '#86efac', icon: '#4ade80' },
  };

  const getRouteTheme = (nombre: string) => {
    const n = (nombre || '').toString().toLowerCase();
    
    for (const [key, colors] of Object.entries(ROUTE_COLORS)) {
      if (n.includes(key)) {
        return {
          bg: colors.bg,
          border: colors.border,
          text: colors.text,
          icon: colors.icon,
        };
      }
    }
    
    return { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', icon: '#60a5fa' };
  };

  const loadData = async () => {
    setLoading(true);
    const { data: rutasData, error: rutasError } = await supabase
      .from('rutas')
      .select('*, chofer:usuarios!id_chofer (*)')
      .order('fecha', { ascending: false })
      .limit(100);
      
    if (!rutasError && rutasData) {
      const rutaIds = rutasData.map(r => r.id_ruta);
      const { data: bitacoraData } = await supabase
        .from('viajes_bitacora')
        .select('*')
        .in('id_ruta', rutaIds)
        .order('created_at', { ascending: true });

      const rutasWithBitacora = rutasData.map(r => ({
        ...r,
        bitacora: bitacoraData?.filter(b => b.id_ruta === r.id_ruta) || []
      }));

      setRutas(rutasWithBitacora);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Suscripción en tiempo real con manejo de reconexión y estado
    const channel = supabase
      .channel('seguimiento_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rutas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viajes_bitacora' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locales_ruta' }, () => loadData())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime conectado');
          loadData(); // Asegurar datos frescos al conectar
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('Realtime desconectado, reintentando...');
          setTimeout(loadData, 2000);
        }
      });

    // Fallback de actualización cada 5 minutos por si acaso
    const interval = setInterval(loadData, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

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
      if (newSegment.origen_nombre !== 'Planta') {
         await supabase.from('locales_ruta').update({ hora_salida: now }).eq('id_ruta', rutaId).eq('nombre', newSegment.origen_nombre);
      }
      await loadData();
      setShowForm(null);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '-';
    const mins = Math.abs(differenceInMinutes(new Date(end), new Date(start)));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handlePrint = (viaje: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Reporte de Viaje - ${viaje.nombre}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            h1 { font-style: italic; text-transform: uppercase; margin-bottom: 5px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .details { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; }
            .footer { margin-top: 50px; font-size: 10px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SHIMAYA - REPORTE DE VIAJE</h1>
            <p><strong>Ruta:</strong> ${viaje.nombre} | <strong>Placa:</strong> ${viaje.placa || 'N/A'}</p>
          </div>
          <div class="details">
            <div>
              <p><strong>Chofer:</strong> ${viaje.chofer?.nombre || 'No asignado'}</p>
              <p><strong>Fecha:</strong> ${viaje.fecha ? format(parseLocalDate(viaje.fecha)!, 'PPPP', { locale: es }) : 'S/F'}</p>
            </div>
            <div>
              <p><strong>Estado:</strong> ${viaje.estado.toUpperCase()}</p>
              <p><strong>Duración Total:</strong> ${formatDuration(viaje.hora_salida_planta, viaje.hora_llegada_planta)}</p>
            </div>
          </div>
          <h3>BITÁCORA DE MOVIMIENTOS</h3>
          <table>
            <thead>
              <tr>
                <th>Tramo</th>
                <th>Salida</th>
                <th>Llegada</th>
                <th>Tiempo Traslado</th>
              </tr>
            </thead>
            <tbody>
              ${viaje.bitacora?.map((t: any) => `
                <tr>
                  <td>${t.origen_nombre} -> ${t.destino_nombre}</td>
                  <td>${t.hora_salida ? formatPeru(t.hora_salida, 'HH:mm') : '-'}</td>
                  <td>${t.hora_llegada ? formatPeru(t.hora_llegada, 'HH:mm') : '-'}</td>
                  <td>${formatDuration(t.hora_salida, t.hora_llegada)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Documento generado automáticamente por el sistema de Gestión de Rutas Shimaya</div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredRutas = rutas.filter(r => {
     const search = searchTerm.toLowerCase();
     return r.nombre.toLowerCase().includes(search) || 
            (r.chofer?.nombre || '').toLowerCase().includes(search) ||
            (r.placa || '').toLowerCase().includes(search);
  });

  // Ordenar: primero en_progreso, luego pendiente, luego finalizada
  const sortedRutas = [...filteredRutas].sort((a, b) => {
    const estadoOrden: Record<string, number> = { 'en_progreso': 0, 'pendiente': 1, 'finalizada': 2 };
    const ordenA = estadoOrden[a.estado as string] ?? 3;
    const ordenB = estadoOrden[b.estado as string] ?? 3;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return (b.fecha || '').localeCompare(a.fecha || '');
  });

  // Agrupar por fecha pero mantener el orden de estado dentro de cada grupo
  const groupedRutas: Record<string, typeof sortedRutas> = {};
  for (const ruta of sortedRutas) {
    const date = ruta.fecha || 'Sin fecha';
    if (!groupedRutas[date]) groupedRutas[date] = [];
    groupedRutas[date].push(ruta);
  }

  if (loading) return <div className="p-4 text-white">Cargando Seguimiento de Viajes...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div>
              <h1 className="text-2xl font-bold text-white italic uppercase tracking-tighter">Seguimiento en Vivo</h1>
               <p className="text-text-muted text-sm flex items-center gap-2">
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                 Tiempo real activo
               </p>
            </div>
        </div>
        <div className="flex items-center gap-3">
           <Button size="sm" variant="secondary" onClick={loadData} className="flex items-center gap-2">
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             Actualizar
           </Button>
           <div className="w-full md:w-80">
              <Input 
                placeholder="Buscar chofer o placa..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-surface-light/10 border-primary/20 focus:border-primary/50"
              />
           </div>
        </div>
      </div>

      <div className="space-y-12">
        {Object.keys(groupedRutas).sort((a, b) => b.localeCompare(a)).map(date => (
          <div key={date} className="space-y-6">
            <div className="flex items-center gap-4 sticky top-0 bg-background z-10 py-2 border-b border-surface-light">
              <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em]">
                {date !== 'Sin fecha' ? format(parseLocalDate(date)!, 'PPPP', { locale: es }) : 'Sin Fecha'}
              </h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
               {groupedRutas[date].map(viaje => {
                  const isExpanded = expandedRuta === viaje.id_ruta;
                  const stopsCount = viaje.bitacora?.filter(b => b.hora_llegada).length || 0;
                  const theme = getRouteTheme(viaje.nombre);
                  
                  // Status detailed logic
                  const lastBitacora = viaje.bitacora && viaje.bitacora.length > 0 ? viaje.bitacora[viaje.bitacora.length - 1] : null;
                  let detailedStatus = { label: viaje.estado.replace('_', ' '), color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' };
                  
                  if (viaje.estado === 'finalizada') {
                    detailedStatus = { label: 'Finalizado', color: 'bg-green-500/10 text-green-500 border-green-500/30' };
                  } else if (viaje.estado === 'en_progreso' && lastBitacora) {
                    if (lastBitacora.hora_llegada) {
                      detailedStatus = { label: `EN LOCAL: ${lastBitacora.destino_nombre}`, color: 'bg-amber-500/10 text-amber-500 border-amber-500/40 animate-pulse' };
                    } else {
                      detailedStatus = { label: `EN CAMINO: ${lastBitacora.destino_nombre}`, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30 animate-pulse' };
                    }
                  }

                  return (
                    <Card key={viaje.id_ruta} className={`overflow-hidden transition-all duration-300 border-surface-light/30 ${isExpanded ? 'ring-2 ring-primary/30 bg-surface-light/10' : 'bg-surface/50'}`}>
                      <CardContent className="p-0">
                        <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-surface-light/20 transition-colors"
                          onClick={() => setExpandedRuta(isExpanded ? null : viaje.id_ruta)} >
                           <div className="flex items-start gap-4">
                             <div className="p-4 rounded-2xl shadow-inner transition-colors" style={{ backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1, borderStyle: 'solid' }}>
                               <Truck size={32} style={{ color: theme.icon }} />
                             </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">{viaje.nombre}</h3>
                                <span className="bg-primary/20 text-primary-light px-2 py-0.5 rounded text-[10px] font-black border border-primary/30">
                                  {viaje.placa || 'S/P'}
                                </span>
                              </div>
                              <p className="text-text-muted text-sm font-medium">
                                Chofer: <span className="text-white">{viaje.chofer?.nombre || 'No asignado'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-8 flex-1 max-w-sm">
                            <div>
                               <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Duración</p>
                               <div className="flex items-center gap-2 text-primary font-bold">
                                  <Clock size={14} />
                                  <span>{formatDuration(viaje.hora_salida_planta, viaje.hora_llegada_planta)}</span>
                               </div>
                            </div>
                            <div>
                               <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Progreso</p>
                               <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    {(viaje.bitacora || []).map((b, i) => (
                                      <div key={i} className={`w-2 h-2 rounded-full ${b.hora_llegada ? 'bg-green-500' : 'bg-primary animate-pulse'}`} />
                                    ))}
                                    {(!viaje.bitacora || viaje.bitacora.length === 0) && <div className="w-2 h-2 rounded-full bg-surface-light" />}
                                  </div>
                                  <span className="text-[10px] text-white font-bold">{stopsCount} paradas</span>
                               </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${detailedStatus.color}`}>
                              {detailedStatus.label}
                            </span>
                            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                               <ChevronDown size={20} className="text-text-muted"/>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-black/40 p-6 md:p-8 border-t border-surface-light/50 animate-in slide-in-from-top-4 duration-300">
                             <div className="flex justify-between items-center mb-8 pb-4 border-b border-surface-light/30">
                                <h4 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Bitácora de Movimientos</h4>
                                <div className="flex gap-3">
                                  <Button size="sm" variant="ghost" className="text-xs font-bold text-text-muted hover:text-white" onClick={(e) => { e.stopPropagation(); handlePrint(viaje); }}>
                                    <Printer size={16} className="mr-2" /> PDF
                                  </Button>
                                  {viaje.estado !== 'finalizada' && (
                                    <Button size="sm" variant="primary" className="font-black italic shadow-lg shadow-primary/20"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowForm(viaje.id_ruta);
                                        setNewSegment({ origen_nombre: viaje.bitacora?.length ? (viaje.bitacora[viaje.bitacora.length-1].destino_nombre || 'Local') : 'Planta', destino_nombre: '' });
                                      }}
                                    > <Plus size={16} className="mr-1" /> AGREGAR </Button>
                                  )}
                                  {viaje.estado !== 'finalizada' && (
                                     <Button size="sm" variant="danger" disabled={isSubmitting} className="font-black italic bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
                                       onClick={async (e) => {
                                         e.stopPropagation();
                                         if (window.confirm('¿Finalizar viaje y cerrar bitácora?')) {
                                           setIsSubmitting(true);
                                           try {
                                             const now = nowPeru();
                                             if (viaje.bitacora && viaje.bitacora.length > 0) {
                                               const lastTramo = viaje.bitacora[viaje.bitacora.length - 1];
                                               if (!lastTramo.hora_llegada) {
                                                 await supabase.from('viajes_bitacora').update({ hora_llegada: now }).eq('id_bitacora', lastTramo.id_bitacora);
                                               }
                                               if (lastTramo.destino_nombre !== 'Planta') {
                                                  await supabase.from('viajes_bitacora').insert({ id_ruta: viaje.id_ruta, id_chofer: viaje.id_chofer, origen_nombre: lastTramo.destino_nombre, destino_nombre: 'Planta', hora_salida: now, hora_llegada: now });
                                               }
                                             }
                                             await supabase.from('rutas').update({ estado: 'finalizada', hora_llegada_planta: now }).eq('id_ruta', viaje.id_ruta);
                                             await loadData();
                                           } finally { setIsSubmitting(false); }
                                         }
                                       }}
                                     > {isSubmitting ? 'CERRANDO...' : 'CERRAR VIAJE'} </Button>
                                  )}
                                  
                                  {/* Botón de eliminar solo para administradores */}
                                  <Button size="sm" variant="danger" disabled={isSubmitting} className="font-black bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-100"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm('¿Estás seguro de eliminar todo el registro de esta ruta diaria? Esta acción es irreversible.')) {
                                        setIsSubmitting(true);
                                        try {
                                          await logDelete('rutas', viaje.id_ruta, viaje);
                                          await supabase.from('viajes_bitacora').delete().eq('id_ruta', viaje.id_ruta);
                                          await supabase.from('locales_ruta').delete().eq('id_ruta', viaje.id_ruta);
                                          await supabase.from('rutas').delete().eq('id_ruta', viaje.id_ruta);
                                          await loadData();
                                        } catch (err) {
                                          console.error(err);
                                          alert('Error al eliminar la ruta.');
                                        } finally {
                                          setIsSubmitting(false);
                                        }
                                      }
                                    }}
                                  >
                                    ELIMINAR
                                  </Button>
                                </div>
                             </div>

                             {showForm === viaje.id_ruta && (
                                <div className="bg-surface p-6 rounded-2xl border-2 border-primary/30 mb-8 space-y-6 shadow-2xl animate-in zoom-in-95">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <Input label="DESDE (ORIGEN)" value={newSegment.origen_nombre} onChange={e => setNewSegment({...newSegment, origen_nombre: e.target.value})} />
                                      <Input label="HACIA (DESTINO)" placeholder="Nombre del local..." value={newSegment.destino_nombre} onChange={e => setNewSegment({...newSegment, destino_nombre: e.target.value})} />
                                   </div>
                                   <div className="flex justify-end gap-3 pt-2">
                                      <Button variant="ghost" size="sm" className="font-bold" onClick={(e) => { e.stopPropagation(); setShowForm(null); }}>CANCELAR</Button>
                                      <Button size="sm" disabled={isSubmitting} className="font-black px-8" onClick={(e) => { e.stopPropagation(); handleAddSegment(viaje.id_ruta); }}>
                                        {isSubmitting ? 'GUARDANDO...' : 'REGISTRAR SALIDA'}
                                      </Button>
                                   </div>
                                </div>
                             )}

                             <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primary/50 before:to-surface-light/30">
                                {viaje.bitacora?.map((tramo: any, idx) => (
                                  <div key={tramo.id_bitacora || idx} className="flex gap-6 relative group">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 text-xs font-black shadow-lg transition-all group-hover:scale-110 ${tramo.hora_llegada ? 'bg-green-500 text-black border-2 border-white/20' : 'bg-primary text-white animate-pulse ring-4 ring-primary/20'}`}>
                                        {idx + 1}
                                     </div>
                                     <div className="flex-1 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm transition-all group-hover:bg-white/10 group-hover:border-primary/40">
                                        <div className="flex items-center justify-between gap-4">
                                           <div className="space-y-1">
                                              <p className="text-sm font-black text-white italic tracking-tight uppercase">
                                                {tramo.origen_nombre} <span className="text-primary mx-1">→</span> {tramo.destino_nombre}
                                              </p>
                                              <div className="flex items-center gap-4 text-[9px] text-text-muted font-bold uppercase tracking-widest">
                                                <span className="flex items-center gap-1"><Clock size={10}/> SALIDA: {formatPeru(tramo.hora_salida, 'HH:mm')}</span>
                                                {tramo.hora_llegada && (
                                                  <span className="flex items-center gap-1 text-green-500 border-l border-white/10 pl-3">
                                                    <CheckCircle2 size={10}/> LLEGADA: {formatPeru(tramo.hora_llegada, 'HH:mm')} ({formatDuration(tramo.hora_salida, tramo.hora_llegada)})
                                                  </span>
                                                )}
                                                {idx > 0 && viaje.bitacora && viaje.bitacora[idx-1].hora_llegada && (
                                                  <span className="flex items-center gap-1 text-yellow-500 border-l border-white/10 pl-3">
                                                    <Timer size={10}/> PERMANENCIA: {formatDuration(viaje.bitacora[idx-1].hora_llegada, tramo.hora_salida)}
                                                  </span>
                                                )}
                                              </div>
                                           </div>
                                           {!tramo.hora_llegada && (
                                              <div className="hidden md:block bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border border-blue-500/20 animate-pulse">
                                                 EN CAMINO
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </div>
                                ))}
                                {(!viaje.bitacora || viaje.bitacora.length === 0) && (
                                  <div className="text-center py-10 opacity-20">
                                     <Truck size={48} className="mx-auto mb-2" />
                                     <p className="text-sm italic font-bold">Bitácora Vacía</p>
                                  </div>
                                )}
                             </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
               })}
            </div>
          </div>
        ))}
      </div>

      {rutas.length === 0 && (
        <div className="text-center py-32 bg-surface/50 rounded-3xl border-2 border-dashed border-surface-light">
           <Truck size={64} className="mx-auto mb-4 text-text-muted opacity-10" />
           <p className="text-xl font-bold text-text-muted italic">No se encontraron viajes con estos criterios.</p>
        </div>
      )}
    </div>
  );
}
