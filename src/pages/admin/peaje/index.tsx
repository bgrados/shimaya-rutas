import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GastoPeaje, Usuario } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Route, Truck, Calendar, Download, FileText, FileSpreadsheet, Plus, Search, X, Eye, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PEAJES_PRECIO = {
  'Peaje Trapiche': 16.50,
  'Peaje La Joya': 16.50,
  'Peaje Pucusana': 16.50,
  'Peaje Cipreses': 16.50,
  'Peaje Conchán': 16.50,
  'Peaje Villa': 16.50,
  'Peaje San Juan de Lurigancho': 8.50,
  'Peaje Antenor Andaguaya': 8.50,
  'Peaje Chillón': 8.50,
  'otro': 0,
};

export default function GastosPeaje() {
  const [peajes, setPeajes] = useState<GastoPeaje[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPeaje, setSelectedPeaje] = useState<GastoPeaje | null>(null);
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  
  // Filtros
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [filtroChofer, setFiltroChofer] = useState('');
  
  // Formulario
  const [formIdRuta, setFormIdRuta] = useState('');
  const [formIdChofer, setFormIdChofer] = useState('');
  const [formNombrePeaje, setFormNombrePeaje] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
  const [formNotas, setFormNotas] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [peajesRes, choferesRes] = await Promise.all([
        supabase.from('gastos_peaje').select('*').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('*').eq('rol', 'chofer').eq('activo', true)
      ]);
      
      if (peajesRes.data) {
        // Enriquecer con nombres de chofer
        const peajesEnriquecidos = peajesRes.data.map(p => ({
          ...p,
          chofer_nombre: choferesRes.data?.find(c => c.id_usuario === p.id_chofer)?.nombre || 'Sin chofer'
        }));
        setPeajes(peajesEnriquecidos);
      }
      if (choferesRes.data) setChoferes(choferesRes.data);
    } catch (err) {
      console.error('[Peaje] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const peajesFiltrados = peajes.filter(p => {
    if (filtroChofer && p.id_chofer !== filtroChofer) return false;
    if (filtroFechaInicio && p.fecha && p.fecha < filtroFechaInicio) return false;
    if (filtroFechaFin && p.fecha && p.fecha > filtroFechaFin) return false;
    return true;
  });

  const totalMonto = peajesFiltrados.reduce((sum, p) => sum + (p.monto || 0), 0);
  const totalPeajes = peajesFiltrados.length;

  const handleNombrePeajeChange = (nombre: string) => {
    setFormNombrePeaje(nombre);
    const precio = PEAJES_PRECIO[nombre as keyof typeof PEAJES_PRECIO];
    if (precio) setFormMonto(precio.toFixed(2));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const { error } = await supabase.from('gastos_peaje').insert({
        id_ruta: formIdRuta || null,
        id_chofer: formIdChofer,
        nombre_peaje: formNombrePeaje,
        monto: parseFloat(formMonto) || 0,
        fecha: formFecha,
        tipo: 'normal',
        notas: formNotas || null
      });

      if (error) throw error;
      
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('[Peaje] Error:', err);
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  }

  function resetForm() {
    setFormIdRuta('');
    setFormIdChofer('');
    setFormNombrePeaje('');
    setFormMonto('');
    setFormFecha(new Date().toISOString().split('T')[0]);
    setFormNotas('');
  }

  const generarPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(234, 179, 8);
    doc.text('📄 REPORTE DE PEAJES', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    
    const tableData = peajesFiltrados.map(p => [
      p.fecha ? format(new Date(p.fecha), 'dd/MM/yyyy') : '-',
      p.nombre_peaje || '-',
      `S/ ${(p.monto || 0).toFixed(2)}`,
      p.chofer_nombre || '-',
      p.notas || '-'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Fecha', 'Peaje', 'Monto', 'Chofer', 'Notas']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [234, 179, 8], textColor: 0 },
      styles: { fontSize: 9 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Total peajes: ${totalPeajes}`, 14, finalY + 10);
    doc.text(`Total monto: S/ ${totalMonto.toFixed(2)}`, 14, finalY + 18);

    doc.save(`reporte_peajes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportarExcel = () => {
    const data = peajesFiltrados.map(p => ({
      Fecha: p.fecha,
      Peaje: p.nombre_peaje,
      Monto: p.monto,
      Chofer: p.chofer_nombre,
      Notas: p.notas
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Peajes');
    XLSX.writeFile(wb, `peajes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
            <Route className="text-primary" /> Gastos de Peaje
          </h1>
          <p className="text-text-muted text-sm">Controla el gasto de peajes por ruta</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus size={18} /> Registrar Peaje
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-light/30 p-4 rounded-xl">
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface-light/50">
          <CardContent className="p-4">
            <p className="text-[10px] text-text-muted uppercase">Total Peajes</p>
            <p className="text-2xl font-black text-white">{totalPeajes}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface-light/50">
          <CardContent className="p-4">
            <p className="text-[10px] text-text-muted uppercase">Total Gasto</p>
            <p className="text-2xl font-black text-green-400">S/ {totalMonto.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Botones exportar */}
      <div className="flex gap-2">
        <Button onClick={generarPDF} variant="secondary" className="flex items-center gap-2 bg-red-600 hover:bg-red-700">
          <FileText size={16} /> Exportar PDF
        </Button>
        <Button onClick={exportarExcel} variant="secondary" className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
          <FileSpreadsheet size={16} /> Exportar Excel
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-surface-light/30 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary/20 text-white text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Peaje</th>
              <th className="px-4 py-3 text-left">Monto</th>
              <th className="px-4 py-3 text-left">Chofer</th>
              <th className="px-4 py-3 text-left">Notas</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {peajesFiltrados.map(peaje => (
              <tr key={peaje.id_peaje} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white">
                  {peaje.fecha ? format(new Date(peaje.fecha), 'dd/MM/yyyy') : '-'}
                </td>
                <td className="px-4 py-3 text-white font-bold">{peaje.nombre_peaje || '-'}</td>
                <td className="px-4 py-3 text-green-400 font-black">S/ {(peaje.monto || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-text-muted">{peaje.chofer_nombre || '-'}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{peaje.notas || '-'}</td>
                <td className="px-4 py-3 text-center">
                  {peaje.foto_url && (
                    <button 
                      onClick={() => setShowFotoModal(peaje.foto_url!)}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <ImageIcon size={16} className="text-primary" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {peajesFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No hay registros de peajes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal registrar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Registrar Peaje</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Chofer</label>
                <select 
                  required
                  value={formIdChofer}
                  onChange={(e) => setFormIdChofer(e.target.value)}
                  className="w-full bg-surface-light border border-primary/20 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Seleccionar chofer...</option>
                  {choferes.map(c => (
                    <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Peaje</label>
                <select 
                  required
                  value={formNombrePeaje}
                  onChange={(e) => handleNombrePeajeChange(e.target.value)}
                  className="w-full bg-surface-light border border-primary/20 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Seleccionar peaje...</option>
                  {Object.keys(PEAJES_PRECIO).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Monto (S/)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value)}
                    className="w-full bg-surface-light border border-primary/20 rounded-xl px-3 py-2 text-white font-black"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Fecha</label>
                  <input 
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full bg-surface-light border border-primary/20 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Notas (opcional)</label>
                <textarea 
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full bg-surface-light border border-primary/20 rounded-xl px-3 py-2 text-white text-sm"
                  rows={2}
                  placeholder="Observaciones..."
                />
              </div>

              <Button 
                type="submit" 
                disabled={formLoading}
                className="w-full bg-primary hover:bg-primary-hover"
              >
                {formLoading ? 'Guardando...' : 'Guardar Peaje'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Modal foto */}
      {showFotoModal && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setShowFotoModal(null)}>
          <img src={showFotoModal} alt="Foto peaje" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setShowFotoModal(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}