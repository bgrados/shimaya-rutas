import { FileDown, Download, Trash2, Edit2, Check, X, Image, MapPin } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { formatFriendlyDate } from '../../../../lib/timezone';
import { format } from 'date-fns';

interface PeajesReportProps {
  rangoLabel: string;
  peajesCalculados: number;
  peajesManualesMonto: number;
  peajesCompromisoMonto: number;
  peajesManuales: any[];
  ordenPeajes: 'asc' | 'desc';
  setOrdenPeajes: (val: 'asc' | 'desc') => void;
  editandoPeajeId: string | null;
  editandoPeajeDatos: any;
  setEditandoPeajeDatos: (val: any) => void;
  onSaveEdicion: () => void;
  onCancelEdicion: () => void;
  onIniciaEdicion: (gasto: any) => void;
  onEliminarGasto: (id: string) => void;
  onViewPhoto: (url: string) => void;
  onExportPDF: () => void;
}

export function PeajesReport({
  rangoLabel, peajesCalculados, peajesManualesMonto, peajesCompromisoMonto,
  peajesManuales, ordenPeajes, setOrdenPeajes,
  editandoPeajeId, editandoPeajeDatos, setEditandoPeajeDatos,
  onSaveEdicion, onCancelEdicion, onIniciaEdicion, onEliminarGasto,
  onViewPhoto, onExportPDF
}: PeajesReportProps) {
  return (
    <Card className="border-surface-light bg-surface shadow-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-3 italic uppercase tracking-tighter">
            <MapPin size={28} className="text-primary" />
            Reporte de Peajes
          </h2>
          {peajesManuales.length > 0 && (
            <Button onClick={onExportPDF} className="bg-primary hover:bg-primary-hover flex items-center gap-2 font-black uppercase italic shadow-lg shadow-primary/20">
              <Download size={18} /> Exportar PDF
            </Button>
          )}
        </div>

        {/* Resumen de Peajes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-background/50 p-5 rounded-2xl border border-white/5 shadow-inner">
            <p className="text-text-muted text-[10px] uppercase font-black tracking-widest mb-2">Peajes Automáticos</p>
            <p className="text-2xl font-black text-blue-400">S/ {peajesCalculados.toFixed(2)}</p>
            <p className="text-[9px] text-text-muted mt-2 uppercase">Basado en rutas ejecutadas</p>
          </div>
          <div className="bg-background/50 p-5 rounded-2xl border border-white/5 shadow-inner">
            <p className="text-text-muted text-[10px] uppercase font-black tracking-widest mb-2">Peajes Manuales</p>
            <p className="text-2xl font-black text-green-400">S/ {peajesManualesMonto.toFixed(2)}</p>
            <p className="text-[9px] text-text-muted mt-2 uppercase">Con ticket/foto (pagados)</p>
          </div>
          <div className="bg-background/50 p-5 rounded-2xl border border-white/5 shadow-inner border-yellow-500/20">
            <p className="text-yellow-500/70 text-[10px] uppercase font-black tracking-widest mb-2">Compromisos</p>
            <p className="text-2xl font-black text-yellow-500">S/ {peajesCompromisoMonto.toFixed(2)}</p>
            <p className="text-[9px] text-text-muted mt-2 uppercase">Pendientes por pagar</p>
          </div>
          <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 shadow-inner">
            <p className="text-primary text-[10px] uppercase font-black tracking-widest mb-2">Total Efectivo</p>
            <p className="text-2xl font-black text-white">S/ {(peajesCalculados + peajesManualesMonto).toFixed(2)}</p>
            <p className="text-[9px] text-text-muted mt-2 uppercase">Sin contar compromisos</p>
          </div>
        </div>

        {/* Detalle de peajes manuales */}
        {peajesManuales.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-sm font-black text-white uppercase italic tracking-widest mb-4 border-l-4 border-primary pl-3">Detalle de Tickets Manuales</h3>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-light/50 text-text-muted">
                    <th className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors uppercase text-[10px] font-black" onClick={() => setOrdenPeajes(ordenPeajes === 'asc' ? 'desc' : 'asc')}>
                      Fecha {ordenPeajes === 'asc' ? '↑' : '↓'}
                    </th>
                    <th className="text-left py-4 px-4 uppercase text-[10px] font-black">Evidencia</th>
                    <th className="text-left py-4 px-4 uppercase text-[10px] font-black">Chofer</th>
                    <th className="text-left py-4 px-4 uppercase text-[10px] font-black">Estado</th>
                    <th className="text-right py-4 px-4 uppercase text-[10px] font-black">Monto</th>
                    <th className="text-center py-4 px-4 uppercase text-[10px] font-black">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {peajesManuales.map((gasto: any) => (
                    <tr key={gasto.id_gasto} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4">
                        {editandoPeajeId === gasto.id_gasto ? (
                          <input type="date" value={editandoPeajeDatos?.fecha || ''} onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, fecha: e.target.value })}
                            className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:border-primary outline-none" />
                        ) : (
                          <span className="text-white font-bold italic">{gasto.fecha ? formatFriendlyDate(gasto.fecha) : '-'}</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {gasto.foto_url ? (
                          <button onClick={() => onViewPhoto(gasto.foto_url)} className="text-primary hover:scale-110 transition-transform flex items-center gap-1.5 font-bold text-xs uppercase">
                            <Image size={14} /> Ver Ticket
                          </button>
                        ) : <span className="text-text-muted italic opacity-50">-</span>}
                      </td>
                      <td className="py-4 px-4 text-white font-black italic">{gasto.chofer_nombre || '-'}</td>
                      <td className="py-4 px-4">
                        {editandoPeajeId === gasto.id_gasto ? (
                          <select value={editandoPeajeDatos?.tipo_combustible || 'peaje'} onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, tipo_combustible: e.target.value })}
                            className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:border-primary outline-none">
                            <option value="peaje">Pagado</option>
                            <option value="peaje_compromiso">Compromiso</option>
                          </select>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${gasto.tipo_combustible === 'peaje_compromiso' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                            {gasto.tipo_combustible === 'peaje_compromiso' ? 'Compromiso' : 'Pagado'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {editandoPeajeId === gasto.id_gasto ? (
                          <input type="number" step="0.10" value={editandoPeajeDatos?.monto || 0} onChange={(e) => setEditandoPeajeDatos({ ...editandoPeajeDatos, monto: e.target.value })}
                            className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs w-24 text-right focus:border-primary outline-none" />
                        ) : <span className="text-green-400 font-black text-base italic">S/ {(gasto.monto || 0).toFixed(2)}</span>}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center gap-2">
                          {editandoPeajeId === gasto.id_gasto ? (
                            <>
                              <button onClick={onSaveEdicion} className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-all" title="Guardar"><Check size={14} /></button>
                              <button onClick={onCancelEdicion} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Cancelar"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => onIniciaEdicion(gasto)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all" title="Editar"><Edit2 size={14} /></button>
                              <button onClick={() => onEliminarGasto(gasto.id_gasto)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Eliminar"><Trash2 size={14} /></button>
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
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl mt-4">
            <MapPin size={48} className="mx-auto mb-4 text-text-muted opacity-20" />
            <p className="text-text-muted italic font-medium">No se encontraron tickets manuales en este rango.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
