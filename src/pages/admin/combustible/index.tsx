import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GastoCombustible, Usuario } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Fuel, Truck, Calendar, Download, FileText, FileSpreadsheet, Check, X, Eye, Image as ImageIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return format(d, 'yyyy-MM-dd');
  });
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [filtroChofer, setFiltroChofer] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const registrosPorPagina = 20;

  useEffect(() => {
    loadChoferes();
  }, []);

  useEffect(() => {
    loadGastos();
  }, [activeTab, filtroFechaDesde, filtroFechaHasta, filtroChofer]);

  const loadChoferes = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre')
      .eq('rol', 'chofer')
      .order('nombre');
    if (data) setChoferes(data);
  };

  const loadGastos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre)')
        .order('created_at', { ascending: false });

      if (filtroFechaDesde) {
        query = query.gte('created_at', `${filtroFechaDesde}T00:00:00`);
      }
      if (filtroFechaHasta) {
        query = query.lte('created_at', `${filtroFechaHasta}T23:59:59`);
      }
      if (filtroChofer) {
        query = query.eq('id_chofer', filtroChofer);
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
      .sort(([, a], [, b]) => b.total - a.total)
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

  const pendientesCount = gastos.filter(g => g.estado === 'pendiente_revision').length;
  const confirmadosCount = gastos.filter(g => g.estado === 'confirmado').length;

  const topChoferes = gastosAgrupadosPorChofer().slice(0, 5);

  const gastosPaginados = gastos.slice(
    (paginaActual - 1) * registrosPorPagina,
    paginaActual * registrosPorPagina
  );
  const totalPaginas = Math.ceil(gastos.length / registrosPorPagina);

  const getPeriodoLabel = () => {
    return `${format(parseISO(filtroFechaDesde), 'dd/MM/yyyy')} - ${format(parseISO(filtroFechaHasta), 'dd/MM/yyyy')}`;
  };

  const generarPDF = async () => {
    console.log('🚀 generandoPDF called');
    try {
    
    const doc = new jsPDF();
    const fechaActual = format(new Date(), 'yyyy-MM-dd');
    
    doc.setFontSize(18);
    doc.text('Reporte de Gastos de Combustible', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${getPeriodoLabel()} | Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Estado: ${activeTab === 'todos' ? 'Todos' : activeTab === 'pendientes' ? 'Pendientes' : 'Confirmados'}`, 14, 36);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Resumen por Tipo de Combustible', 14, 48);
    
    doc.setFontSize(10);
    let yPos = 56;
    doc.text(`GLP: S/ ${(totalesPorTipo.glp || 0).toFixed(2)}`, 14, yPos);
    doc.text(`Gasolina: S/ ${(totalesPorTipo.gasolina || 0).toFixed(2)}`, 60, yPos);
    doc.text(`Diesel: S/ ${(totalesPorTipo.diesel || 0).toFixed(2)}`, 110, yPos);
    yPos += 8;
    doc.setFontSize(11);
    doc.text(`TOTAL GENERAL: S/ ${totalGeneral.toFixed(2)}`, 14, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Total de cargas: ${gastos.length} | Pendientes: ${pendientesCount} | Confirmados: ${confirmadosCount}`, 14, yPos);
    
    const tableData: string[][] = [];
    
    if (agruparPor === 'fecha') {
      gastosAgrupadosPorFecha().forEach(grupo => {
        tableData.push([`--- ${format(parseISO(grupo.fecha), 'dd/MM/yyyy')} ---`, '', '', `S/ ${grupo.total.toFixed(2)}`]);
        grupo.gastos.forEach(gasto => {
          tableData.push([
            gasto.created_at ? format(new Date(gasto.created_at), 'HH:mm') : '',
            gasto.chofer_nombre || '-',
            gasto.tipo_combustible || '-',
            `S/ ${(gasto.monto || 0).toFixed(2)}`
          ]);
        });
      });
    } else {
      gastosAgrupadosPorChofer().forEach(grupo => {
        tableData.push([`--- ${grupo.choferNombre} ---`, '', '', `S/ ${grupo.total.toFixed(2)} (${grupo.gastos.length})`]);
        grupo.gastos.forEach(gasto => {
          tableData.push([
            gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM HH:mm') : '-',
            gasto.tipo_combustible || '-',
            gasto.estado === 'confirmado' ? '✓' : gasto.estado === 'pendiente_revision' ? '⏳' : '✗',
            `S/ ${(gasto.monto || 0).toFixed(2)}`
          ]);
        });
      });
    }

    autoTable(doc, {
      head: [['Hora', 'Chofer/Tipo', 'Combustible', 'Monto']],
      body: tableData,
      startY: yPos + 5,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' }
      }
    });

    doc.save(`reporte-combustible-${fechaActual}.pdf`);
  };

  const generarExcel = () => {
    setShowExportMenu(false);
    
    const fechaActual = format(new Date(), 'yyyy-MM-dd');
    const wb = XLSX.utils.book_new();
    
    const wsResumen = XLSX.utils.aoa_to_sheet([
      ['Reporte de Gastos de Combustible'],
      ['Período:', getPeriodoLabel()],
      ['Estado:', activeTab === 'todos' ? 'Todos' : activeTab === 'pendientes' ? 'Pendientes' : 'Confirmados'],
      ['Generado:', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['Resumen por Tipo'],
      ['Tipo', 'Total (S/)'],
      ['GLP', totalesPorTipo.glp || 0],
      ['Gasolina', totalesPorTipo.gasolina || 0],
      ['Diesel', totalesPorTipo.diesel || 0],
      ['TOTAL GENERAL', totalGeneral],
      [],
      ['Estadísticas'],
      ['Total de cargas', gastos.length],
      ['Pendientes', pendientesCount],
      ['Confirmados', confirmadosCount],
    ]);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    const wsPorChofer = XLSX.utils.aoa_to_sheet([
      ['Gastos por Chofer'],
      [],
      ['Chofer', 'Cargas', 'Total (S/)', 'GLP', 'Gasolina', 'Diesel'],
      ...gastosAgrupadosPorChofer().map(g => {
        const porTipo = g.gastos.reduce((acc, gg) => {
          const t = gg.tipo_combustible || 'otro';
          acc[t] = (acc[t] || 0) + (gg.monto || 0);
          return acc;
        }, {} as Record<string, number>);
        return [
          g.choferNombre,
          g.gastos.length,
          g.total,
          porTipo.glp || 0,
          porTipo.gasolina || 0,
          porTipo.diesel || 0
        ];
      })
    ]);
    XLSX.utils.book_append_sheet(wb, wsPorChofer, 'Por Chofer');
    
    const wsDetalle = XLSX.utils.aoa_to_sheet([
      ['Detalle de Gastos'],
      [],
      ['Fecha', 'Hora', 'Chofer', 'Tipo Combustible', 'Monto (S/)', 'Estado', 'Foto URL'],
      ...gastos.map(g => [
        g.created_at ? format(new Date(g.created_at), 'dd/MM/yyyy') : '-',
        g.created_at ? format(new Date(g.created_at), 'HH:mm') : '-',
        g.chofer_nombre || '-',
        g.tipo_combustible || '-',
        g.monto || 0,
        g.estado === 'confirmado' ? 'Confirmado' : g.estado === 'pendiente_revision' ? 'Pendiente' : 'Rechazado',
        g.foto_url || ''
      ])
    ]);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');
    
    XLSX.writeFile(wb, `reporte-combustible-${fechaActual}.xlsx`);
  };

  const actualizarEstado = async (idGasto: string, nuevoEstado: string) => {
    const { error } = await supabase
      .from('gastos_combustible')
      .update({ estado: nuevoEstado })
      .eq('id_gasto', idGasto);
    
    if (!error) {
      setGastos(gastos.map(g => 
        g.id_gasto === idGasto ? { ...g, estado: nuevoEstado } : g
      ));
    }
  };

  const tabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'confirmados', label: 'Confirmados' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Fuel className="text-primary" />
          Gastos Combustible
        </h1>
        
        <div className="flex gap-2">
          <Button onClick={() => console.log('PDF click')} className="flex items-center gap-2">
            <FileText size={18} />
            Exportar PDF
          </Button>
          <Button onClick={generarExcel} variant="secondary" className="flex items-center gap-2">
            <FileSpreadsheet size={18} />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
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

        <div className="flex gap-2 items-center">
          <label className="text-text-muted text-sm">Desde:</label>
          <input
            type="date"
            value={filtroFechaDesde}
            onChange={(e) => setFiltroFechaDesde(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          />
          <label className="text-text-muted text-sm">Hasta:</label>
          <input
            type="date"
            value={filtroFechaHasta}
            onChange={(e) => setFiltroFechaHasta(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>

        <select
          value={filtroChofer}
          onChange={(e) => setFiltroChofer(e.target.value)}
          className="bg-surface border border-surface-light rounded-lg px-4 py-2 text-white"
        >
          <option value="">Todos los choferes</option>
          {choferes.map(c => (
            <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
          ))}
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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

      {topChoferes.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Truck size={18} className="text-primary" />
              Top Choferes con más Gasto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {topChoferes.map((g, i) => (
                <div key={g.choferId} className="bg-surface-light/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black text-text-muted">#{i + 1}</span>
                    <span className="text-white font-medium text-sm truncate">{g.choferNombre}</span>
                  </div>
                  <p className="text-green-400 font-bold">S/ {g.total.toFixed(2)}</p>
                  <p className="text-text-muted text-xs">{g.gastos.length} cargas</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Eye size={18} className="text-primary" />
            Detalle de Gastos
            <span className="text-text-muted text-sm font-normal">({gastos.length} registros)</span>
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-text-muted">Cargando...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-light">
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Fecha</th>
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Chofer</th>
                      <th className="text-left py-3 px-2 text-text-muted font-medium">Tipo</th>
                      <th className="text-right py-3 px-2 text-text-muted font-medium">Monto</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Foto</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Estado</th>
                      <th className="text-center py-3 px-2 text-text-muted font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosPaginados.map(gasto => (
                      <tr key={gasto.id_gasto} className="border-b border-surface-light/30 hover:bg-surface-light/20">
                        <td className="py-3 px-2 text-white">
                          {gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td className="py-3 px-2 text-white">{gasto.chofer_nombre || 'Chofer'}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">
                          {gasto.foto_url ? (
                            <button
                              onClick={() => setShowFotoModal(gasto.foto_url!)}
                              className="p-1 hover:bg-surface-light rounded"
                            >
                              <ImageIcon size={18} className="text-blue-400" />
                            </button>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {gasto.estado === 'confirmado' ? (
                            <span className="text-green-400 text-xs">✓ Confirmado</span>
                          ) : gasto.estado === 'pendiente_revision' ? (
                            <span className="text-yellow-400 text-xs">⏳ Pendiente</span>
                          ) : (
                            <span className="text-red-400 text-xs">✗ Rechazado</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {gasto.estado === 'pendiente_revision' && (
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => actualizarEstado(gasto.id_gasto, 'confirmado')}
                                className="p-1 hover:bg-green-500/20 rounded"
                                title="Confirmar"
                              >
                                <Check size={16} className="text-green-400" />
                              </button>
                              <button
                                onClick={() => actualizarEstado(gasto.id_gasto, 'rechazado')}
                                className="p-1 hover:bg-red-500/20 rounded"
                                title="Rechazar"
                              >
                                <X size={16} className="text-red-400" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPaginas > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-text-muted text-sm">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {gastos.length === 0 && !loading && (
        <div className="text-center py-12">
          <Fuel className="mx-auto mb-4 text-text-muted opacity-50" size={48} />
          <p className="text-text-muted">No hay gastos registrados</p>
        </div>
      )}

      {showFotoModal && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFotoModal(null)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setShowFotoModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img 
              src={showFotoModal} 
              alt="Foto del ticket" 
              className="max-h-[80vh] w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
