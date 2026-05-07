import { FileDown, Download, Trash2, Image, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { formatFriendlyDate } from '../../../../lib/timezone';
import { format } from 'date-fns';

interface OtrosGastosReportProps {
  gastos: any[];
  fotos: Record<string, string>;
  rangoLabel: string;
  onExportPDF: () => void;
  onDeleteGasto: (id: string, monto: number, chofer: string) => void;
  onViewPhoto: (images: any[], index: number) => void;
}

export function OtrosGastosReport({
  gastos, fotos, rangoLabel,
  onExportPDF, onDeleteGasto, onViewPhoto
}: OtrosGastosReportProps) {
  const totalOtros = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

  return (
    <div className="space-y-6">
      <Card className="border-surface-light bg-surface shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-3 italic uppercase tracking-tighter">
                <FileDown size={28} className="text-primary" />
                Otros Gastos
              </h2>
              <p className="text-text-muted text-xs font-black uppercase tracking-widest mt-1 opacity-60">{rangoLabel}</p>
            </div>
            {gastos.length > 0 && (
              <Button onClick={onExportPDF} className="bg-primary hover:bg-primary-hover flex items-center gap-2 font-black uppercase italic shadow-lg shadow-primary/20">
                <Download size={18} /> Exportar Reporte
              </Button>
            )}
          </div>

          {gastos.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
              <FileDown size={60} className="mx-auto mb-4 text-text-muted opacity-20" />
              <p className="text-text-muted italic text-lg">No hay registros de otros gastos.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {gastos.map(gasto => (
                  <div key={gasto.id_gasto} className="bg-background rounded-2xl overflow-hidden border border-white/5 group relative shadow-xl hover:border-primary/30 transition-all duration-300">
                    <div className="relative aspect-square overflow-hidden bg-surface-light/20">
                      {fotos[gasto.id_gasto] ? (
                        <img src={fotos[gasto.id_gasto]} alt="Comprobante" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                          <Image size={40} className="text-text-muted mb-2" />
                          <span className="text-[10px] font-black uppercase">Sin Foto</span>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-4 gap-2">
                        {fotos[gasto.id_gasto] && (
                          <button onClick={() => {
                            const images = gastos.filter(g => fotos[g.id_gasto]).map(g => ({ url: fotos[g.id_gasto]!, title: `Gasto: ${g.chofer_nombre} - S/ ${g.monto}` }));
                            const idx = images.findIndex(img => img.url === fotos[gasto.id_gasto]);
                            onViewPhoto(images, idx);
                          }} className="flex-1 py-2 bg-white text-black rounded-xl font-black text-[10px] uppercase italic hover:bg-primary hover:text-white transition-all">
                            VER GRANDE
                          </button>
                        )}
                        <button onClick={() => onDeleteGasto(gasto.id_gasto, gasto.monto, gasto.chofer_nombre)}
                          className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-black italic uppercase tracking-tight truncate max-w-[150px]">{gasto.chofer_nombre || 'CHOFER'}</p>
                          <p className="text-text-muted text-[10px] font-bold uppercase">{gasto.fecha ? formatFriendlyDate(gasto.fecha) : '-'}</p>
                        </div>
                        <span className="text-green-400 font-black text-lg italic tracking-tighter">S/ {(gasto.monto || 0).toFixed(2)}</span>
                      </div>
                      
                      <div className="bg-surface-light/30 p-3 rounded-xl border border-white/5">
                        <p className="text-text-muted text-[9px] font-black uppercase tracking-widest mb-1">Concepto</p>
                        <p className="text-white text-xs italic leading-relaxed line-clamp-2">{gasto.descripcion || 'Sin descripción detallada'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          gasto.estado === 'confirmado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          gasto.estado === 'pendiente' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {gasto.estado === 'confirmado' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                          {gasto.estado || 'PENDIENTE'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex flex-col md:flex-row justify-between items-center gap-4 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    <FileDown className="text-primary" size={24} />
                  </div>
                  <div>
                    <p className="text-text-muted text-xs font-black uppercase tracking-widest">Inversión Total Otros Gastos</p>
                    <p className="text-white/50 text-[10px] italic">Sumatoria de todos los conceptos registrados en el periodo</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-green-400 font-black text-4xl italic tracking-tighter">S/ {totalOtros.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
