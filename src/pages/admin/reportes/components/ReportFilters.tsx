import { Calendar, Filter, Users, Fuel, Truck, MapPin, X, FileDown } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';

interface ReportFiltersProps {
  reportType: 'rutas' | 'combustible' | 'peajes' | 'otros';
  setReportType: (val: any) => void;
  period: 'diario' | 'semanal' | 'mensual';
  setPeriod: (val: any) => void;
  selectedDate: string;
  setSelectedDate: (val: string) => void;
  filterChofer: string;
  setFilterChofer: (val: string) => void;
  choferes: any[];
}

export function ReportFilters({
  reportType, setReportType,
  period, setPeriod,
  selectedDate, setSelectedDate,
  filterChofer, setFilterChofer,
  choferes
}: ReportFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setReportType('rutas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold italic uppercase transition-all border ${
            reportType === 'rutas' 
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(229,9,20,0.3)]' 
              : 'bg-surface-light text-text-muted border-white/5 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" /> Rutas
        </button>
        <button 
          onClick={() => setReportType('combustible')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold italic uppercase transition-all border ${
            reportType === 'combustible' 
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(229,9,20,0.3)]' 
              : 'bg-surface-light text-text-muted border-white/5 hover:text-white'
          }`}
        >
          <Fuel className="w-4 h-4" /> Combustible
        </button>
        <button 
          onClick={() => setReportType('peajes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold italic uppercase transition-all border ${
            reportType === 'peajes' 
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(229,9,20,0.3)]' 
              : 'bg-surface-light text-text-muted border-white/5 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" /> Peajes
        </button>
        <button 
          onClick={() => setReportType('otros')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold italic uppercase transition-all border ${
            reportType === 'otros' 
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(229,9,20,0.3)]' 
              : 'bg-surface-light text-text-muted border-white/5 hover:text-white'
          }`}
        >
          <FileDown className="w-4 h-4" /> Otros
        </button>
      </div>

      <Card className="border-surface-light bg-surface shadow-xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Período */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Período de Reporte</label>
              <div className="flex bg-background p-1 rounded-xl border border-white/5">
                {(['diario', 'semanal', 'mensual'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 py-2 text-xs font-black italic rounded-lg transition-all ${
                      period === p ? 'bg-surface-light text-primary shadow-inner' : 'text-text-muted hover:text-white'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Fecha */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Fecha Base</label>
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-white/5 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Chofer */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2">Filtrar por Chofer</label>
              <div className="relative group">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                <select
                  value={filterChofer}
                  onChange={(e) => setFilterChofer(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-background border border-white/5 rounded-xl text-sm font-bold text-white appearance-none focus:outline-none focus:border-primary/50 transition-all"
                >
                  <option value="">Todos los conductores</option>
                  {choferes.map(c => (
                    <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
                  ))}
                </select>
                {filterChofer && (
                  <button 
                    onClick={() => setFilterChofer('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
