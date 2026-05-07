import { MapPin, Download, Trash2, Image } from 'lucide-react';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { formatFriendlyDate } from '../../../../lib/timezone';

interface PeajesTableProps {
  data: any[];
  loading: boolean;
  onDelete: (id: string) => void;
  onViewImage: (url: string) => void;
  onExport: () => void;
}

export function PeajesTable({
  data,
  loading,
  onDelete,
  onViewImage,
  onExport
}: PeajesTableProps) {
  if (loading) {
    return <div className="text-white italic animate-pulse text-center py-16">Cargando datos de peajes...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
        <MapPin size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
        <p className="text-text-muted italic">No hay registros de peajes en este período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Registros de Peajes</h2>
        <Button onClick={onExport} className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
          <Download size={18} /> Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item) => (
          <Card key={item.id} className="border-surface-light hover:border-primary/30 transition-all group">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">S/ {item.monto?.toFixed(2)}</p>
                    <p className="text-xs text-text-muted uppercase font-black tracking-widest">
                      {formatFriendlyDate(item.fecha)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-text-muted hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Chofer:</span>
                  <span className="text-white font-bold">{item.chofer_nombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Ubicación:</span>
                  <span className="text-white italic">{item.nombre_peaje || 'No especificado'}</span>
                </div>
              </div>

              {item.foto_url && (
                <button
                  onClick={() => onViewImage(item.foto_url)}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-surface-light border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-primary/20 hover:border-primary/30 transition-all"
                >
                  <Image size={14} /> Ver Comprobante
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
