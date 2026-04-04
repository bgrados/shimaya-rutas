import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GastoCombustible } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Fuel, Truck, Calendar, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type TabType = 'todos' | 'pendientes' | 'confirmados';

interface GrupoFecha {
  fecha: string;
  gastos: GastoCombustible[];
  total: number;
}

interface GrupoChofer {
  choferId: string;
  choferNombre: string;
  gastos: GastoCombustible[];
  total: number;
}

export default function GastosCombustible() {
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [filtroFecha, setFiltroFecha] = useState<'semana' | 'mes' | 'todo'>('semana');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGastos();
  }, [activeTab, filtroFecha]);

  const loadGastos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre)')
        .order('created_at', { ascending: false });

      const fechaInicio = startOfWeek(new Date(), { weekStartsOn: 1 });
      
      if (filtroFecha === 'semana') {
        query = query.gte('created_at', fechaInicio.toISOString());
      } else if (filtroFecha === 'mes') {
        const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        query = query.gte('created_at', mesInicio.toISOString());
      }

      if (activeTab === 'pendientes') {
        query = query.eq('estado', 'pendiente_revision');
      } else if (activeTab === 'confirmados') {
        query = query.eq('estado', 'confirmado');
      }

      const { data } = await query;

      if (data) {
        const mapped = data.map((g: any) => ({
          ...g,
          chofer_nombre: g.usuarios?.nombre,
          ruta_nombre: g.rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);
      }
    } catch (err) {
      console.error('[Gastos] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const gastosAgrupadosPorFecha = (): GrupoFecha[] => {
    const grupos: Record<string, GastoCombustible[]> = {};
    gastos.forEach(gasto => {
      const fecha = gasto.created_at ? format(new Date(gasto.created_at), 'yyyy-MM-dd') : 'sin fecha';
      if (!grupos[fecha]) grupos[fecha] = [];
      grupos[fecha].push(gasto);
    });
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, gastoss]) => ({
        fecha,
        gastos: gastoss,
        total: gastoss.reduce((sum, g) => sum + (g.monto || 0), 0)
      }));
  };

  const gastosAgrupadosPorChofer = (): GrupoChofer[] => {
    const grupos: Record<string, { nombre: string; gastos: GastoCombustible[] }> = {};
    gastos.forEach(gasto => {
      const choferId = gasto.id_chofer || 'sin chofer';
      const choferNombre = gasto.chofer_nombre || 'Sin nombre';
      if (!grupos[choferId]) {
        grupos[choferId] = { nombre: choferNombre, gastos: [] };
      }
      grupos[choferId].gastos.push(gasto);
    });
    return Object.entries(grupos)
      .sort(([, a], [, b]) => b.gastos.length - a.gastos.length)
      .map(([choferId, data]) => ({
        choferId,
        choferNombre: data.nombre,
        gastos: data.gastos,
        total: data.gastos.reduce((sum, g) => sum + (g.monto || 0), 0)
      }));
  };

  const totalesPorTipo = gastos.reduce((acc, g) => {
    const tipo = g.tipo_combustible || 'otro';
    acc[tipo] = (acc[tipo] || 0) + (g.monto || 0);
    return acc;
  }, {} as Record<string, number>);

  const totalGeneral = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

  const exportarPDF = () => {
    window.print();
  };

  const tabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'confirmados', label: 'Confirmados' },
  ];

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-only { display: block !important; }
          .bg-surface { background: white !important; border: 1px solid #ddd !important; }
          .text-white { color: black !important; }
          .text-text-muted { color: #666 !important; }
          .print-title { font-size: 24px !important; font-weight: bold !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Fuel className="text-primary" />
          Gastos Combustible
        </h1>
        <Button onClick={exportarPDF} className="flex items-center gap-2">
          <Download size={18} />
          Exportar PDF
        </Button>
      </div>

      {/* Título para impresión */}
      <div className="print-only mb-4">
        <h1 className="print-title">Reporte de Gastos de Combustible</h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Período: {filtroFecha === 'semana' ? 'Esta semana' : filtroFecha === 'mes' ? 'Este mes' : 'Todo'} | 
          Generado: {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>

      {/* Filtros - no imprimir */}
      <div className="no-print flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.key ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value as any)}
          className="bg-surface border border-surface-light rounded-lg px-4 py-2 text-white"
        >
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="todo">Todo</option>
        </select>

        <div className="flex gap-2">
          <button
            onClick={() => setAgruparPor('fecha')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              agruparPor === 'fecha' ? 'bg-blue-600 text-white' : 'bg-surface text-text-muted'
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            Por Fecha
          </button>
          <button
            onClick={() => setAgruparPor('chofer')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              agruparPor === 'chofer' ? 'bg-green-600 text-white' : 'bg-surface text-text-muted'
            }`}
          >
            <Truck size={16} className="inline mr-2" />
            Por Chofer
          </button>
        </div>
      </div>

      {/* Totales */}
      <div ref={printRef} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-green-300 uppercase font-bold">GLP</p>
            <p className="text-xl font-black text-green-400">S/ {(totalesPorTipo.glp || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-blue-300 uppercase font-bold">Gasolina</p>
            <p className="text-xl font-black text-blue-400">S/ {(totalesPorTipo.gasolina || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-orange-300 uppercase font-bold">Diesel</p>
            <p className="text-xl font-black text-orange-400">S/ {(totalesPorTipo.diesel || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-yellow-300 uppercase font-bold">Cargas</p>
            <p className="text-xl font-black text-yellow-400">{gastos.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-primary uppercase font-bold">TOTAL</p>
            <p className="text-xl font-black text-primary">S/ {totalGeneral.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista agrupada */}
      {loading ? (
        <div className="text-center py-8 text-text-muted">Cargando...</div>
      ) : agruparPor === 'fecha' ? (
        <div className="space-y-4">
          {gastosAgrupadosPorFecha().map(grupo => (
            <Card key={grupo.fecha}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-blue-400" size={20} />
                    <span className="font-bold text-white">
                      {format(new Date(grupo.fecha), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                  </div>
                  <span className="text-green-400 font-bold">S/ {grupo.total.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  {grupo.gastos.map(gasto => (
                    <div key={gasto.id_gasto} className="flex items-center justify-between text-sm bg-surface-light/30 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-text-muted" />
                        <span className="text-white">{gasto.chofer_nombre || 'Chofer'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                          gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {gasto.tipo_combustible}
                        </span>
                      </div>
                      <span className="text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {gastosAgrupadosPorChofer().map(grupo => (
            <Card key={grupo.choferId}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="text-green-400" size={20} />
                    <span className="font-bold text-white">{grupo.choferNombre}</span>
                    <span className="text-text-muted text-sm">({grupo.gastos.length} cargas)</span>
                  </div>
                  <span className="text-green-400 font-bold">S/ {grupo.total.toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  {grupo.gastos.map(gasto => (
                    <div key={gasto.id_gasto} className="flex items-center justify-between text-sm bg-surface-light/30 p-2 rounded ml-6">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-text-muted" />
                        <span className="text-text-muted">
                          {gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                          gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {gasto.tipo_combustible}
                        </span>
                      </div>
                      <span className="text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {gastos.length === 0 && (
        <div className="text-center py-12 no-print">
          <Fuel className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
          <p className="text-text-muted">No hay gastos registrados</p>
        </div>
      )}
    </div>
  );
}

function startOfWeek(date: Date, options?: any): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
