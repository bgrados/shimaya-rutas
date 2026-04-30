import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { PeajeCalculado } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Route, Truck, Calendar, FileText, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { nowPeru, formatOnlyDatePeru } from '../../../lib/timezone';


interface Chofer {
  id_usuario: string;
  nombre: string;
}

export default function GastosPeaje() {
  const [peajesCalculados, setPeajesCalculados] = useState<PeajeCalculado[]>([]);
  const [peajesManuales, setPeajesManuales] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroChofer, setFiltroChofer] = useState('');
  const [filtroVerManual, setFiltroVerManual] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Cargar choferes
      const { data: choferesData } = await supabase
        .from('usuarios')
        .select('id_usuario, nombre')
        .eq('rol', 'chofer')
        .eq('activo', true);
      if (choferesData) setChoferes(choferesData);

      // Cargar rutas finalizadas con información de ruta base
      const { data: rutasData } = await supabase
        .from('rutas')
        .select(`
          id_ruta,
          fecha,
          nombre as ruta_nombre,
          id_chofer,
          rutas_base:cantidad_peajes,
          rutas_base:costo_peaje
        `)
        .eq('estado', 'finalizada')
        .order('fecha', { ascending: false });

      // Cargar nombres de rutas base y choferes
      const { data: rutasBaseData } = await supabase.from('rutas_base').select('id_ruta_base, nombre');
      const rutasBaseMap = new Map(rutasBaseData?.map(rb => [rb.id_ruta_base, rb.nombre]) || []);
      
      // Enriquecer datos de rutas
      if (rutasData) {
        const enrichedRutas = rutasData.map((r: any) => ({
          ...r,
          ruta_base_nombre: rutasBaseMap.get(r.id_ruta_base) || r.ruta_nombre || 'Sin ruta base',
          chofer_nombre: choferesData?.find(c => c.id_usuario === r.id_chofer)?.nombre || 'Sin chofer'
        }));
        setPeajesCalculados(enrichedRutas);
      }

      // Cargar registros manuales legacy (soporta ambos formatos: 'manual' y 'MANUAL')
      const { data: manualesData } = await supabase
        .from('gastos_peaje')
        .select('*')
        .or(`tipo_registro.eq.manual,tipo_registro.eq.MANUAL`)
        .order('created_at', { ascending: false });
      if (manualesData) setPeajesManuales(manualesData);
    } catch (err) {
      console.error('[Peaje] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calcular peaje: cantidad_peajes * costo_peaje (solo si cantidad > 0)
  const calcularPeaje = (ruta: any): number => {
    const cantidad = ruta.cantidad_peajes || 0;
    const costo = ruta.costo_peaje || 0;
    if (cantidad <= 0) return 0;
    return cantidad * costo;
  };

  // Filtrar peajes calculados
  const peajesFiltrados = peajesCalculados.filter(p => {
    if (filtroChofer && p.id_chofer !== filtroChofer) return false;
    if (filtroFechaInicio && p.fecha && p.fecha < filtroFechaInicio) return false;
    if (filtroFechaFin && p.fecha && p.fecha > filtroFechaFin) return false;
    return true;
  });

  // Filtrar peajes manuales
  const peajesManualesFiltrados = peajesManuales.filter(p => {
    if (filtroChofer && p.id_chofer !== filtroChofer) return false;
    if (filtroFechaInicio && p.fecha && p.fecha < filtroFechaInicio) return false;
    if (filtroFechaFin && p.fecha && p.fecha > filtroFechaFin) return false;
    return true;
  });

  // Calcular totales
  const totalGeneral = peajesFiltrados.reduce((sum, p) => sum + calcularPeaje(p), 0);
  const totalPeajesCount = peajesFiltrados.filter(p => calcularPeaje(p) > 0).length;
  const totalManuales = peajesManualesFiltrados.reduce((sum, p) => sum + (p.monto || 0), 0);

  // Totales por ruta
  const totalesPorRuta = peajesFiltrados.reduce((acc, p) => {
    const key = p.ruta_base_nombre || 'Sin nombre';
    if (!acc[key]) acc[key] = { nombre: key, count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += calcularPeaje(p);
    return acc;
  }, {} as Record<string, { nombre: string; count: number; total: number }>);

  // Totales por chofer
  const totalesPorChofer = peajesFiltrados.reduce((acc, p) => {
    const key = p.chofer_nombre || 'Sin chofer';
    if (!acc[key]) acc[key] = { nombre: key, count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += calcularPeaje(p);
    return acc;
  }, {} as Record<string, { nombre: string; count: number; total: number }>);

  const generarPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(234, 179, 8);
    doc.text('REPORTE DE PEAJES', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${format(nowPeru(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    doc.text(`Filtros: ${filtroFechaInicio || 'Sin inicio'} - ${filtroFechaFin || 'Sin fin'}`, 14, 34);
    
    // Tabla de peajes calculados
    const tableData = peajesFiltrados.map(p => [
      p.fecha ? format(parseISO(p.fecha), 'dd/MM/yyyy') : '-',
      p.ruta_base_nombre || '-',
      p.chofer_nombre || '-',
      p.cantidad_peajes || 0,
      `S/ ${(p.costo_peaje || 0).toFixed(2)}`,
      `S/ ${calcularPeaje(p).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Fecha', 'Ruta Base', 'Chofer', 'Cant.', 'Costo Unit.', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [234, 179, 8], textColor: 0 },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Total peajes (calculados): ${totalPeajesCount}`, 14, finalY + 10);
    doc.text(`Monto total: S/ ${totalGeneral.toFixed(2)}`, 14, finalY + 18);

    if (peajesManualesFiltrados.length > 0) {
      doc.text(`Registros manuales legacy: ${peajesManualesFiltrados.length}`, 14, finalY + 28);
      doc.text(`Monto manual: S/ ${totalManuales.toFixed(2)}`, 14, finalY + 36);
    }

    doc.save(`reporte_peajes_${formatOnlyDatePeru()}.pdf`);
  };

  const exportarExcel = () => {
    const data = peajesFiltrados.map(p => ({
      Fecha: p.fecha,
      'Ruta Base': p.ruta_base_nombre || '-',
      'Ruta Diaria': p.ruta_nombre || '-',
      Chofer: p.chofer_nombre || '-',
      'Cant. Peajes': p.cantidad_peajes || 0,
      'Costo Unit.': p.costo_peaje || 0,
      'Total Peaje': calcularPeaje(p)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Peajes');
    XLSX.writeFile(wb, `peajes_${formatOnlyDatePeru()}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 uppercase italic tracking-tighter">
            <Route className="text-orange-400" /> Gastos de Peaje
          </h1>
          <p className="text-text-muted text-sm">Cálculo automático basado en rutas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generarPDF} variant="secondary" className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
            <FileText size={16} /> PDF
          </Button>
          <Button onClick={exportarExcel} variant="secondary" className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
            <FileSpreadsheet size={16} /> Excel
          </Button>
          <Button onClick={loadData} variant="ghost" className="text-text-muted hover:text-white">
            Actualizar
          </Button>
        </div>
      </div>

      {/* Info box */}
      <Card className="bg-orange-500/10 border-orange-500/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 font-bold text-sm">Sistema Automático de Peajes</p>
            <p className="text-orange-200/60 text-xs mt-1">
              Los peajes se calculan automáticamente según la configuración de cada ruta base: 
              <span className="text-orange-300 font-bold ml-1">peaje = cantidad × costo</span>.
              {!filtroVerManual && peajesManuales.length > 0 && (
                <button 
                  onClick={() => setFiltroVerManual(true)}
                  className="text-orange-400 underline ml-2 hover:text-orange-300"
                >
                  Ver {peajesManuales.length} registros manuales legacy
                </button>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-surface-light/30 p-4 rounded-xl">
        <div>
          <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Fecha inicio</label>
          <input 
            type="date" 
            value={filtroFechaInicio}
            onChange={(e) => setFiltroFechaInicio(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Fecha fin</label>
          <input 
            type="date" 
            value={filtroFechaFin}
            onChange={(e) => setFiltroFechaFin(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Chofer</label>
          <select 
            value={filtroChofer}
            onChange={(e) => setFiltroChofer(e.target.value)}
            className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
          >
            <option value="">Todos</option>
            {choferes.map(c => (
              <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
            ))}
          </select>
        </div>
        {filtroVerManual && (
          <div className="flex items-end">
            <Button 
              variant="ghost" 
              onClick={() => setFiltroVerManual(false)}
              className="text-red-400 hover:text-red-300"
            >
              <X size={16} className="mr-1" /> Ocultar Manuales
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-orange-300 uppercase font-bold">Total Calculado</p>
            <p className="text-2xl font-black text-orange-400">S/ {totalGeneral.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-orange-300 uppercase font-bold">Viajes con Peaje</p>
            <p className="text-2xl font-black text-white">{totalPeajesCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-light/50">
          <CardContent className="p-4 text-center">
            <p className="text-[10px] text-text-muted uppercase font-bold">Total x Ruta</p>
            <p className="text-2xl font-black text-white">{Object.keys(totalesPorRuta).length}</p>
          </CardContent>
        </Card>
        {peajesManuales.length > 0 && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-[10px] text-red-300 uppercase font-bold">Manuales Legacy</p>
              <p className="text-2xl font-black text-red-400">S/ {totalManuales.toFixed(2)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Totales por Ruta y Chofer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por Ruta */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
              <Route size={16} className="text-orange-400" /> Totales por Ruta
            </h3>
            {Object.keys(totalesPorRuta).length === 0 ? (
              <p className="text-text-muted text-center py-4 text-sm">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {Object.values(totalesPorRuta)
                  .sort((a, b) => b.total - a.total)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface-light/30 p-3 rounded-lg">
                      <div>
                        <p className="text-white font-bold text-sm">{item.nombre}</p>
                        <p className="text-text-muted text-xs">{item.count} viajes</p>
                      </div>
                      <p className="text-orange-400 font-black">S/ {item.total.toFixed(2)}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </CardContent>
        </Card>

        {/* Por Chofer */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
              <Truck size={16} className="text-orange-400" /> Totales por Chofer
            </h3>
            {Object.keys(totalesPorChofer).length === 0 ? (
              <p className="text-text-muted text-center py-4 text-sm">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {Object.values(totalesPorChofer)
                  .sort((a, b) => b.total - a.total)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface-light/30 p-3 rounded-lg">
                      <div>
                        <p className="text-white font-bold text-sm">{item.nombre}</p>
                        <p className="text-text-muted text-xs">{item.count} viajes</p>
                      </div>
                      <p className="text-orange-400 font-black">S/ {item.total.toFixed(2)}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla Principal */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-orange-400" /> Detalle de Peajes Calculados
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-500/20 text-white text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Ruta Base</th>
                  <th className="px-4 py-3 text-left">Ruta Diaria</th>
                  <th className="px-4 py-3 text-left">Chofer</th>
                  <th className="px-4 py-3 text-center">Cant.</th>
                  <th className="px-4 py-3 text-center">Costo</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {peajesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                      No hay peajes calculados para el período seleccionado
                    </td>
                  </tr>
                ) : (
                  peajesFiltrados.map((peaje, idx) => {
                    const total = calcularPeaje(peaje);
                    return (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-white">
                          {peaje.fecha ? format(parseISO(peaje.fecha), 'dd/MM/yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{peaje.ruta_base_nombre || '-'}</td>
                        <td className="px-4 py-3 text-text-muted text-xs">{peaje.ruta_nombre || '-'}</td>
                        <td className="px-4 py-3 text-text-muted">{peaje.chofer_nombre || '-'}</td>
                        <td className="px-4 py-3 text-center text-white font-bold">{peaje.cantidad_peajes || 0}</td>
                        <td className="px-4 py-3 text-center text-orange-400 font-medium">
                          {total > 0 ? `S/ ${(peaje.costo_peaje || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {total > 0 ? (
                            <span className="text-orange-400 font-black">S/ {total.toFixed(2)}</span>
                          ) : (
                            <span className="text-text-muted text-xs">Sin peaje</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Registros Manuales Legacy */}
      {filtroVerManual && peajesManuales.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-black text-red-400 uppercase italic mb-4 flex items-center gap-2">
              <AlertCircle size={16} /> Registros Manuales Legacy ({peajesManualesFiltrados.length})
            </h3>
            <p className="text-text-muted text-xs mb-4">
              Estos registros fueron ingresados manualmente antes del cambio al sistema automático. Son de solo lectura.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-500/20 text-white text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Peaje</th>
                    <th className="px-4 py-3 text-left">Monto</th>
                    <th className="px-4 py-3 text-left">Notas</th>
                    <th className="px-4 py-3 text-left">Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {peajesManualesFiltrados.map((peaje, idx) => (
                    <tr key={idx} className="hover:bg-white/5 opacity-70">
                      <td className="px-4 py-3 text-white">
                        {peaje.fecha ? format(parseISO(peaje.fecha), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-white">{peaje.nombre_peaje || '-'}</td>
                      <td className="px-4 py-3 text-red-400 font-black">S/ {(peaje.monto || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">{peaje.notas || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold">
                          MANUAL
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
