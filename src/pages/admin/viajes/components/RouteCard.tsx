import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Truck, ChevronDown, Clock, Printer, RefreshCw, FileText, MapPin, CheckCircle2, Timer, Plus } from 'lucide-react';
import { formatHoraPeru, formatDuration } from '../../../../lib/timezone';
import { RutaConDetalle } from '../hooks/useViajesData';

interface RouteCardProps {
  viaje: RutaConDetalle;
  isExpanded: boolean;
  onToggle: () => void;
  onPrint: (viaje: RutaConDetalle) => void;
  onEdit: (viaje: RutaConDetalle) => void;
  onCloseViaje: (viaje: RutaConDetalle) => void;
  onAddSegment: (id: string) => void;
  onUploadGuia: (local: any) => void;
  onDelete: (viaje: RutaConDetalle) => void;
  showForm: string | null;
  newSegment: { origen_nombre: string; destino_nombre: string };
  setNewSegment: (s: any) => void;
  handleAddSegment: (id: string) => void;
  setShowForm: (id: string | null) => void;
  isSubmitting: boolean;
}

export function RouteCard({ 
  viaje, isExpanded, onToggle, onPrint, onEdit, onCloseViaje, 
  onAddSegment, onUploadGuia, onDelete, showForm, newSegment, 
  setNewSegment, handleAddSegment, setShowForm, isSubmitting
}: RouteCardProps) {
  
  const ROUTE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    amarilla: { bg: '#713f12', border: '#ca8a04', text: '#fef08a', icon: '#fde047' },
    negra: { bg: '#1a1a1a', border: '#4a4a4a', text: '#d4d4d4', icon: '#ffffff' },
    guinda: { bg: '#7c1c2e', border: '#991b1b', text: '#fca5a5', icon: '#f87171' },
    verde: { bg: '#14532d', border: '#166534', text: '#86efac', icon: '#4ade80' },
  };

  const theme = ROUTE_COLORS[(viaje.nombre || '').toLowerCase()] || { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', icon: '#60a5fa' };

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

  const calcularDuracionTotal = () => {
    const bitacora = viaje.bitacora || [];
    if (bitacora.length === 0) return formatDuration(viaje.hora_salida_planta, viaje.hora_llegada_planta);
    const primerTramo = bitacora[0];
    const ultimoConLlegada = [...bitacora].reverse().find(b => b.hora_llegada);
    if (!primerTramo.hora_salida || !ultimoConLlegada?.hora_llegada) {
      return formatDuration(viaje.hora_salida_planta, viaje.hora_llegada_planta);
    }
    return formatDuration(primerTramo.hora_salida, ultimoConLlegada.hora_llegada);
  };

  return (
    <Card className={`overflow-hidden transition-all duration-300 border-surface-light/30 ${isExpanded ? 'ring-2 ring-primary/30 bg-surface-light/10' : 'bg-surface/50'}`}>
      <CardContent className="p-0">
        <div 
          className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-surface-light/20 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-start gap-4">
            <div 
              className="p-4 rounded-2xl shadow-inner transition-colors" 
              style={{ backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1, borderStyle: 'solid' }}
            >
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
                {viaje.nombre_asistente && (
                  <> | Asistente: <span className="text-white">{viaje.nombre_asistente}</span></>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 flex-1 max-w-sm">
            <div>
              <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Duración</p>
              <div className="flex items-center gap-2 text-primary font-bold">
                <Clock size={14} />
                <span>{calcularDuracionTotal()}</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-1">Progreso</p>
              <div className="flex items-center gap-2 text-white font-bold">
                <div className="flex gap-1">
                  {(viaje.bitacora || []).map((b, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${b.hora_llegada ? 'bg-green-500' : 'bg-primary animate-pulse'}`} />
                  ))}
                </div>
                <span className="text-[10px]">{viaje.bitacora?.length || 0} paradas</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {viaje.estado !== 'finalizada' && (
              <Button 
                size="sm" 
                className="font-black text-xs bg-red-600 hover:bg-red-700 h-8"
                onClick={(e) => { e.stopPropagation(); onCloseViaje(viaje); }}
              > CERRAR </Button>
            )}
            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${detailedStatus.color}`}>
              {detailedStatus.label}
            </span>
            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={20} className="text-text-muted" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="bg-black/40 p-6 md:p-8 border-t border-surface-light/50 animate-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-surface-light/30">
              <h4 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Bitácora de Movimientos</h4>
              <div className="flex gap-3">
                <Button size="sm" variant="ghost" className="text-xs font-bold text-text-muted hover:text-white" onClick={(e) => { e.stopPropagation(); onPrint(viaje); }}>
                  <Printer size={16} className="mr-2" /> PDF
                </Button>
                {viaje.estado !== 'finalizada' && (
                  <>
                    <Button size="sm" variant="secondary" className="font-bold border-white/10"
                      onClick={(e) => { e.stopPropagation(); onEdit(viaje); }}
                    > EDITAR </Button>
                    <Button size="sm" className="font-black italic shadow-lg shadow-primary/20"
                      onClick={(e) => { e.stopPropagation(); onAddSegment(viaje.id_ruta); }}
                    > <Plus size={16} className="mr-1" /> AGREGAR </Button>
                  </>
                )}
                <Button size="sm" className="font-black bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-100"
                  onClick={(e) => { e.stopPropagation(); onDelete(viaje); }}
                > ELIMINAR </Button>
              </div>
            </div>

            {showForm === viaje.id_ruta && (
              <div className="bg-surface p-6 rounded-2xl border-2 border-primary/30 mb-8 space-y-4 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    placeholder="DESDE (ORIGEN)" 
                    className="bg-background border border-surface-light p-2 rounded text-white" 
                    value={newSegment.origen_nombre} 
                    onChange={e => setNewSegment({ ...newSegment, origen_nombre: e.target.value })} 
                  />
                  <input 
                    placeholder="HACIA (DESTINO)" 
                    className="bg-background border border-surface-light p-2 rounded text-white" 
                    value={newSegment.destino_nombre} 
                    onChange={e => setNewSegment({ ...newSegment, destino_nombre: e.target.value })} 
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(null)}>CANCELAR</Button>
                  <Button size="sm" disabled={isSubmitting} onClick={() => handleAddSegment(viaje.id_ruta)}>
                    {isSubmitting ? 'GUARDANDO...' : 'REGISTRAR'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-primary/50 before:to-surface-light/30">
              {viaje.bitacora?.map((tramo: any, idx) => (
                <div key={tramo.id_bitacora || idx} className="flex gap-6 relative group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 text-xs font-black shadow-lg transition-all ${tramo.hora_llegada ? 'bg-green-500 text-black border-2 border-white/20' : 'bg-primary text-white animate-pulse ring-4 ring-primary/20'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                    <p className="text-sm font-black text-white italic uppercase">{tramo.origen_nombre} → {tramo.destino_nombre}</p>
                    <div className="flex items-center gap-4 text-[9px] text-text-muted font-bold uppercase tracking-widest mt-1">
                      <span>SALIDA: {formatHoraPeru(tramo.hora_salida)}</span>
                      {tramo.hora_llegada && <span className="text-green-500">LLEGADA: {formatHoraPeru(tramo.hora_llegada)} ({formatDuration(tramo.hora_salida, tramo.hora_llegada)})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {viaje.locales && viaje.locales.length > 0 && (
              <div className="mt-8 pt-6 border-t border-surface-light/30">
                <h4 className="text-sm font-black text-white uppercase italic mb-4">Destinos Planificados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viaje.locales.map(local => (
                    <div key={local.id_local_ruta} className="flex items-center justify-between bg-surface-light/5 p-3 rounded-xl border border-surface-light/20">
                      <span className="text-[11px] font-bold text-white uppercase truncate">{local.nombre}</span>
                      <Button size="sm" variant="ghost" className="text-[10px] font-black bg-primary/10 text-primary" onClick={(e) => { e.stopPropagation(); onUploadGuia(local); }}>
                        GUÍAS ({local.guias?.length || 0})
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
