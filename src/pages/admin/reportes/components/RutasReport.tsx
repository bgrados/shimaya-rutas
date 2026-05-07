import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Search, MapPin, Truck, Clock, CheckCircle2, Calendar, Download, Edit2, Check, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { formatFriendlyDate } from '../../../../lib/timezone';
import { format, differenceInMinutes } from 'date-fns';
import { formatMins } from '../utils';
import { Ruta } from '../../../../types';

interface RutasReportProps {
  loading: boolean;
  rutas: Ruta[];
  filtros: { searchTerm: string };
  setFiltros: (f: any) => void;
  rangoLabel: string;
  onExportPDF: () => void;
  onEditLlegada: (id: string | null, time?: string) => void;
  onSaveLlegada: (ruta: Ruta, newTime: string) => void;
  editandoLlegada: string | null;
  horaLlegadaEdit: string;
  setHoraLlegadaEdit: (v: string) => void;
  fotosPorLocal: Record<string, any[]>;
  onExportEvidenciaZip: () => void;
  onDeleteFoto: (fotoId: string, localId: string) => void;
  onViewPhoto: (images: any[], index: number) => void;
  descargandoZip: boolean;
}

export function RutasReport({
  loading, rutas, filtros, setFiltros, rangoLabel,
  onExportPDF, onEditLlegada, onSaveLlegada, editandoLlegada, horaLlegadaEdit, setHoraLlegadaEdit,
  fotosPorLocal, onExportEvidenciaZip, onDeleteFoto, onViewPhoto, descargandoZip
}: RutasReportProps) {

  const rutasFiltradas = rutas.filter(r => 
    r.nombre?.toLowerCase().includes(filtros.searchTerm.toLowerCase()) ||
    r.placa?.toLowerCase().includes(filtros.searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          <input
            type="text"
            placeholder="Buscar por ruta o placa..."
            value={filtros.searchTerm}
            onChange={(e) => setFiltros({ ...filtros, searchTerm: e.target.value })}
            className="w-full bg-surface-light/30 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-white placeholder:text-text-muted/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
          />
        </div>
        <Button onClick={onExportPDF} className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20">
          <Download size={18} /> Exportar Listado
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">Total Rutas</p>
          <p className="text-2xl font-black text-white">{rutas.length}</p>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">Finalizadas</p>
          <p className="text-2xl font-black text-green-400">{rutas.filter(r => r.estado === 'finalizada').length}</p>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">En Proceso</p>
          <p className="text-2xl font-black text-blue-400">{rutas.filter(r => r.estado === 'en_proceso').length}</p>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-white/5">
          <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest">Pendientes</p>
          <p className="text-2xl font-black text-yellow-400">{rutas.filter(r => r.estado === 'pendiente').length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 italic text-text-muted animate-pulse">Analizando rutas...</div>
      ) : rutasFiltradas.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-3xl border-2 border-dashed border-white/5">
          <MapPin size={48} className="mx-auto mb-4 text-text-muted opacity-20" />
          <p className="text-text-muted">No se encontraron rutas con los criterios seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rutasFiltradas.map(ruta => {
            const bits = ruta.bitacora || [];
            const estadoColor = 
              ruta.estado === 'finalizada' ? 'border-green-500/30 text-green-400 bg-green-500/5' :
              ruta.estado === 'en_proceso' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
              'border-yellow-500/30 text-yellow-400 bg-yellow-500/5';

            return (
              <Card key={ruta.id_ruta} className="border-white/5 hover:border-primary/20 transition-all shadow-xl group">
                <div className="p-4 md:p-5 flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-surface-light rounded-2xl group-hover:bg-primary/10 transition-colors">
                      <Truck className="text-text-muted group-hover:text-primary transition-colors" size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{ruta.nombre}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-text-muted font-bold">
                        <span className="flex items-center gap-1.5"><Truck size={12} /> {ruta.placa || 'S/P'}</span>
                        <span className="flex items-center gap-1.5"><Calendar size={12} /> {ruta.fecha ? formatFriendlyDate(ruta.fecha) : '-'}</span>
                        <span className="flex items-center gap-1.5"><Users size={12} /> {ruta.chofer_nombre || 'S/C'}</span>
                        <span className="flex items-center gap-1.5"><MapPin size={12} /> {ruta.km_inicio || '0'} → {ruta.km_fin || '?'} KM</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {ruta.hora_salida_planta && (
                      <div className="text-right hidden md:block">
                        <p className="text-[10px] text-text-muted uppercase font-black tracking-widest">Cronología</p>
                        <p className="text-xs text-white font-bold italic">
                          {format(new Date(ruta.hora_salida_planta), 'HH:mm')}
                          {ruta.horaLlegadaReal && ` → ${format(new Date(ruta.horaLlegadaReal), 'HH:mm')}`}
                        </p>
                        <p className="text-[10px] text-primary font-black italic">{ruta.durationMin ? formatMins(ruta.durationMin) : ''}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {editandoLlegada === ruta.id_ruta ? (
                        <div className="flex items-center gap-1.5 bg-background p-1 rounded-xl border border-primary/30">
                          <input type="time" value={horaLlegadaEdit} onChange={(e) => setHoraLlegadaEdit(e.target.value)}
                            className="bg-transparent text-white text-xs px-2 py-1 outline-none font-black italic" />
                          <button onClick={() => onSaveLlegada(ruta, horaLlegadaEdit)} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"><Check size={14} /></button>
                          <button onClick={() => onEditLlegada(null)} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setHoraLlegadaEdit(ruta.horaLlegadaReal ? format(new Date(ruta.horaLlegadaReal), 'HH:mm') : ''); onEditLlegada(ruta.id_ruta); }}
                          className="p-2.5 bg-surface-light rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 transition-all border border-white/5">
                          <Edit2 size={16} />
                        </button>
                      )}
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border-2 ${estadoColor}`}>
                        {ruta.estado?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {bits.length > 0 && (
                  <div className="px-5 pb-5">
                    <div className="overflow-hidden rounded-2xl border border-white/5 bg-background/30 shadow-inner">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface-light/50 text-text-muted border-b border-white/5">
                            <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Tramos</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Salida</th>
                            <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Llegada</th>
                            <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[9px]">Duración</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                          {bits.map((b: any, i: number) => {
                            const dur = b.hora_salida && b.hora_llegada ? differenceInMinutes(new Date(b.hora_llegada), new Date(b.hora_salida)) : null;
                            return (
                              <tr key={b.id_bitacora} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-primary font-black italic">#{i+1}</span>
                                    <span className="text-white font-bold italic uppercase tracking-tight">{b.origen_nombre} → {b.destino_nombre}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-text-muted font-bold">{b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
                                <td className="px-4 py-3">
                                  {b.hora_llegada ? <span className="text-text-muted font-bold">{format(new Date(b.hora_llegada), 'HH:mm')}</span> : 
                                    <span className="text-blue-400 animate-pulse font-black italic uppercase text-[9px]">En tránsito</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-primary font-black italic">{formatMins(dur)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Evidencias */}
                {ruta.localesRuta && ruta.localesRuta.some((l: any) => (fotosPorLocal[l.id_local_ruta] || []).length > 0) && (
                  <div className="p-5 border-t border-white/5 bg-surface-light/10 rounded-b-3xl">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] text-text-muted font-black uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon size={14} className="text-primary" /> Evidencia Fotográfica
                      </p>
                      <button onClick={onExportEvidenciaZip} disabled={descargandoZip} className="text-[10px] text-primary font-black uppercase italic hover:underline flex items-center gap-1">
                        <Download size={12} /> {descargandoZip ? 'Comprimiendo...' : 'Descargar ZIP'}
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      {ruta.localesRuta.map((local: any) => {
                        const fotos = fotosPorLocal[local.id_local_ruta] || [];
                        if (fotos.length === 0) return null;
                        return (
                          <div key={local.id_local_ruta} className="space-y-2">
                            <p className="text-[9px] text-white/50 font-black uppercase tracking-tighter truncate max-w-[100px]">{local.nombre}</p>
                            <div className="flex gap-1.5">
                              {fotos.map((foto, idx) => (
                                <div key={foto.id_foto} className="relative group/img overflow-hidden rounded-xl border border-white/10 shadow-lg">
                                  <img src={foto.foto_url} alt="Evidencia" className="w-16 h-16 object-cover cursor-zoom-in hover:scale-110 transition-transform duration-500" 
                                    onClick={() => {
                                      const allRouteFotos: any[] = [];
                                      ruta.localesRuta.forEach((l: any) => {
                                        (fotosPorLocal[l.id_local_ruta] || []).forEach(f => allRouteFotos.push({ url: f.foto_url, title: l.nombre }));
                                      });
                                      const clickedIdx = allRouteFotos.findIndex(f => f.url === foto.foto_url);
                                      onViewPhoto(allRouteFotos, clickedIdx >= 0 ? clickedIdx : 0);
                                    }}
                                  />
                                  <button onClick={() => onDeleteFoto(foto.id_foto, local.id_local_ruta)} 
                                    className="absolute inset-0 bg-red-600/80 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Trash2 size={12} />
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
    </div>
  );
}

function Users({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
