import { Fuel, Download, Trash2, Calendar, Truck, Image, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { formatFriendlyDate } from '../../../../lib/timezone';
import { format } from 'date-fns';
import { GastoCombustible } from '../../../../types';

interface CombustibleReportProps {
  loading: boolean;
  gastos: GastoCombustible[];
  fotos: Record<string, string>;
  agruparPor: 'fecha' | 'chofer';
  setAgruparPor: (val: 'fecha' | 'chofer') => void;
  totalesPorTipo: any;
  totalGeneral: number;
  rangoLabel: string;
  onExportPDF: () => void;
  onExportZip: () => void;
  onDeleteGasto: (id: string) => void;
  onDownloadFoto: (url: string, name: string) => void;
  onViewPhoto: (images: any[], index: number) => void;
  descargandoZip: boolean;
  incluirFotosEnPDF: boolean;
  setIncluirFotosEnPDF: (val: boolean) => void;
}

export function CombustibleReport({
  loading, gastos, fotos,
  agruparPor, setAgruparPor,
  totalesPorTipo, totalGeneral, rangoLabel,
  onExportPDF, onExportZip, onDeleteGasto, onDownloadFoto, onViewPhoto,
  descargandoZip, incluirFotosEnPDF, setIncluirFotosEnPDF
}: CombustibleReportProps) {

  const gastosAgrupadosPorFecha = () => {
    const grupos: Record<string, { fecha: string; total: number; gastos: any[] }> = {};
    gastos.forEach(g => {
      const f = g.fecha || 'Sin fecha';
      if (!grupos[f]) grupos[f] = { fecha: f, total: 0, gastos: [] };
      grupos[f].total += (g.monto || 0);
      grupos[f].gastos.push(g);
    });
    return Object.values(grupos).sort((a, b) => b.fecha.localeCompare(a.fecha));
  };

  const gastosAgrupadosPorChofer = () => {
    const grupos: Record<string, { choferId: string; choferNombre: string; total: number; gastos: any[] }> = {};
    gastos.forEach(g => {
      const cid = g.id_chofer || 'unknown';
      if (!grupos[cid]) grupos[cid] = { choferId: cid, choferNombre: g.chofer_nombre || 'Sin nombre', total: 0, gastos: [] };
      grupos[cid].total += (g.monto || 0);
      grupos[cid].gastos.push(g);
    });
    return Object.values(grupos).sort((a, b) => b.total - a.total);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex bg-surface-light rounded-xl p-1 border border-white/5">
          <button onClick={() => setAgruparPor('fecha')}
            className={`px-4 py-1.5 text-xs font-black italic rounded-lg transition-all ${agruparPor === 'fecha' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
            POR FECHA
          </button>
          <button onClick={() => setAgruparPor('chofer')}
            className={`px-4 py-1.5 text-xs font-black italic rounded-lg transition-all ${agruparPor === 'chofer' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
            POR CHOFER
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onExportPDF} className="flex items-center gap-2">
            <Download size={18} /> Exportar PDF
          </Button>
          <label className="flex items-center gap-2 cursor-pointer bg-surface-light px-3 py-2 rounded-xl border border-white/10">
            <input type="checkbox" checked={incluirFotosEnPDF} onChange={(e) => setIncluirFotosEnPDF(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-white text-sm">Incluir fotos</span>
          </label>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {gastos.length > 0 && (
          <>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-green-300 uppercase font-black tracking-widest">GLP</p>
                <p className="text-xl font-black text-green-400">S/ {(totalesPorTipo.glp || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-blue-300 uppercase font-black tracking-widest">Gasolina</p>
                <p className="text-xl font-black text-blue-400">S/ {(totalesPorTipo.gasolina || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-orange-300 uppercase font-black tracking-widest">Diesel</p>
                <p className="text-xl font-black text-orange-400">S/ {(totalesPorTipo.diesel || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-yellow-300 uppercase font-black tracking-widest">Cargas</p>
            <p className="text-xl font-black text-yellow-400">{gastos.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-primary uppercase font-black tracking-widest">TOTAL</p>
            <p className="text-xl font-black text-primary">S/ {totalGeneral.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted italic animate-pulse">Cargando registros...</div>
      ) : gastos.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
          <Fuel size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-text-muted italic">No hay gastos de combustible para este período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agruparPor === 'fecha' ? (
            gastosAgrupadosPorFecha().map(grupo => (
              <Card key={grupo.fecha} className="border-surface-light">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-primary" size={18} />
                      <span className="font-black text-white italic uppercase">{formatFriendlyDate(grupo.fecha)}</span>
                    </div>
                    <span className="text-green-400 font-black">S/ {grupo.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {grupo.gastos.map(g => (
                      <div key={g.id_gasto} className="flex items-center justify-between text-sm bg-background/50 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <Truck size={14} className="text-text-muted" />
                          <span className="text-white font-bold">{g.chofer_nombre || 'Chofer'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            g.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            g.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {g.tipo_combustible}
                          </span>
                          {g.kilometraje && (
                            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-black italic">
                              📍 {g.kilometraje} KM
                            </span>
                          )}
                        </div>
                        <span className="text-green-400 font-black">S/ {(g.monto || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            gastosAgrupadosPorChofer().map(grupo => (
              <Card key={grupo.choferId} className="border-surface-light">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="text-primary" size={18} />
                      <span className="font-black text-white italic uppercase">{grupo.choferNombre}</span>
                      <span className="text-text-muted text-[10px] font-black">({grupo.gastos.length} CARGAS)</span>
                    </div>
                    <span className="text-green-400 font-black">S/ {grupo.total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {grupo.gastos.map(g => (
                      <div key={g.id_gasto} className="flex items-center justify-between text-sm bg-background/50 p-2.5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-text-muted" />
                          <span className="text-text-muted font-bold">{g.fecha ? formatFriendlyDate(g.fecha) : '-'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            g.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            g.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {g.tipo_combustible}
                          </span>
                          {g.kilometraje && (
                            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded font-black italic">
                              📍 {g.kilometraje} KM
                            </span>
                          )}
                        </div>
                        <span className="text-green-400 font-black">S/ {(g.monto || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Fotos Seccion */}
      {!loading && gastos.filter(g => fotos[g.id_gasto]).length > 0 && (
        <Card className="mt-6 border-surface-light bg-surface/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-black italic uppercase tracking-tighter flex items-center gap-2">
                📸 Fotos de Comprobantes
                <span className="text-text-muted text-xs font-normal">({gastos.filter(g => fotos[g.id_gasto]).length})</span>
              </h3>
              <Button size="sm" variant="outline" onClick={onExportZip} disabled={descargandoZip} className="flex items-center gap-2 border-white/10">
                <Download size={14} /> {descargandoZip ? 'Comprimiendo...' : 'Descargar ZIP'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {gastos.filter(g => fotos[g.id_gasto]).map(gasto => (
                <div key={gasto.id_gasto} className="bg-background rounded-xl overflow-hidden border border-white/5 group relative">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={fotos[gasto.id_gasto]} alt="Comprobante" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button onClick={() => {
                        const images = gastos.filter(g => fotos[g.id_gasto]).map(g => ({ url: fotos[g.id_gasto]!, title: `Comprobante: ${g.chofer_nombre} - S/ ${g.monto}` }));
                        const idx = images.findIndex(img => img.url === fotos[gasto.id_gasto]);
                        onViewPhoto(images, idx);
                      }} className="p-2 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all">
                        <Image size={18} />
                      </button>
                      <button onClick={() => onDownloadFoto(fotos[gasto.id_gasto]!, `${gasto.chofer_nombre}_${gasto.monto}.jpg`)}
                        className="p-2 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-all">
                        <Download size={18} />
                      </button>
                      <button onClick={() => onDeleteGasto(gasto.id_gasto)}
                        className="p-2 bg-white text-black rounded-full hover:bg-red-600 hover:text-white transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-light/50">
                    <p className="text-white font-bold truncate text-xs uppercase">{gasto.chofer_nombre || '-'}</p>
                    <p className="text-green-400 font-black text-sm">S/ {(gasto.monto || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
