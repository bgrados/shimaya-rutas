import { useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { formatPeru } from '../../../lib/timezone';
import { ImageModal } from '../../../components/ui/ImageModal';
import { useToast } from '../../../components/ui/Toast';
import { getRange } from './utils';

// Components
import { ReportFilters } from './components/ReportFilters';
import { CombustibleReport } from './components/CombustibleReport';
import { PeajesReport } from './components/PeajesReport';
import { OtrosGastosReport } from './components/OtrosGastosReport';
import { RutasReport } from './components/RutasReport';

// Hooks
import { useReportData, Period, RutaConBitacora } from './hooks/useReportData';
import { useReportExport } from './hooks/useReportExport';

export type ReportType = 'rutas' | 'combustible' | 'peajes' | 'otros';

export default function Reportes() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('rutas');

  // FILTROS GLOBALES
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterChofer, setFilterChofer] = useState('');
  const [filterRutaNombre, setFilterRutaNombre] = useState('');

  // DATA HOOK
  const {
    allRutas,
    choferes,
    rutasBase,
    loading,
    fotosPorLocal,
    gastos,
    combustibleLoading,
    fotosCombustible,
    refreshData,
    refreshCombustible,
    setGastos,
    setAllRutas,
    setFotosPorLocal
  } = useReportData(period, selectedDate, filterChofer);

  // EXPORT HOOK
  const {
    generating,
    descargandoZip,
    handleExportPDF,
    handleExportEvidenciaZip,
    handleShareWhatsApp
  } = useReportExport();

  // LOCAL STATE FOR UI
  const [activePhoto, setActivePhoto] = useState<{ images: { url: string; title: string }[]; index: number } | null>(null);
  const [editandoLlegada, setEditandoLlegada] = useState<string | null>(null);
  const [horaLlegadaEdit, setHoraLlegadaEdit] = useState('');
  const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
  const [incluirFotosEnPDF, setIncluirFotosEnPDF] = useState(true);
  const [ordenPeajes, setOrdenPeajes] = useState<'asc' | 'desc'>('desc');
  const [agruparPor, setAgruparPor] = useState<'fecha' | 'chofer'>('fecha');
  const [editandoPeajeId, setEditandoPeajeId] = useState<string | null>(null);
  const [editandoPeajeDatos, setEditandoPeajeDatos] = useState<any>(null);

  // DERIVED DATA
  const { from, to } = getRange(period, selectedDate);
  const rangoLabel = period === 'diario' 
    ? format(new Date(from + 'T12:00:00'), 'dd MMM yyyy') 
    : `${format(new Date(from + 'T12:00:00'), 'dd MMM')} al ${format(new Date(to + 'T12:00:00'), 'dd MMM yyyy')}`;

  const rutasFiltradas = useMemo(() => {
    return allRutas.filter(r => {
      if (filterRutaNombre && !r.nombre?.toLowerCase().includes(filterRutaNombre.toLowerCase())) return false;
      return true;
    });
  }, [allRutas, filterRutaNombre]);

  const gastosCombustible = useMemo(() => gastos.filter(g => 
    !['otro', 'estacionamiento', 'peaje', 'peaje_compromiso'].includes(g.tipo_combustible || '')
  ), [gastos]);

  const gastosOtros = useMemo(() => gastos.filter(g => 
    ['otro', 'estacionamiento', 'peaje', 'peaje_compromiso'].includes(g.tipo_combustible || '')
  ), [gastos]);

  const peajesManuales = useMemo(() => {
    let filtered = gastos.filter(g => g.tipo_combustible === 'peaje' || g.tipo_combustible === 'peaje_compromiso');
    
    filtered = filtered.filter(g => {
      const fechaRaw = g.fecha || (g as any).created_at || '';
      const fechaGasto = formatPeru(fechaRaw, 'yyyy-MM-dd');
      return fechaGasto >= from && fechaGasto <= to;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.fecha || (a as any).created_at || '').getTime();
      const dateB = new Date(b.fecha || (b as any).created_at || '').getTime();
      return ordenPeajes === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [gastos, from, to, ordenPeajes]);

  const peajesCalculados = useMemo(() => {
    const finalizadas = allRutas.filter(r => r.estado === 'finalizada');
    return finalizadas.reduce((total, ruta) => {
      const rb = rutasBase.find(base => base.id_ruta_base === ruta.id_ruta_base);
      return total + (rb ? (rb.cantidad_peajes || 0) * (rb.costo_peaje || 0) : 0);
    }, 0);
  }, [allRutas, rutasBase]);

  // ACTIONS
  const handleDeleteEvidenciaFoto = async (fotoId: string, localId: string) => {
    if (!confirm('¿Eliminar esta foto de evidencia?')) return;
    try {
      const { error } = await supabase.from('fotos_visita').delete().eq('id_foto', fotoId);
      if (error) throw error;
      setFotosPorLocal(prev => ({
        ...prev,
        [localId]: prev[localId].filter(f => f.id_foto !== fotoId)
      }));
      showToast('success', 'Foto eliminada');
    } catch (err: any) {
      showToast('error', 'Error al eliminar: ' + err.message);
    }
  };

  const handleDeleteGasto = async (id_gasto: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const { error } = await supabase.from('gastos_combustible').delete().eq('id_gasto', id_gasto);
      if (error) throw error;
      setGastos(prev => prev.filter(g => g.id_gasto !== id_gasto));
      showToast('success', 'Gasto eliminado');
    } catch (err: any) {
      showToast('error', 'Error: ' + err.message);
    }
  };

  const guardarEdicionLlegada = async (ruta: RutaConBitacora, nuevaHora: string) => {
    try {
      const { error } = await supabase.from('rutas').update({ hora_llegada_planta: nuevaHora }).eq('id_ruta', ruta.id_ruta);
      if (error) throw error;
      refreshData();
      setEditandoLlegada(null);
      showToast('success', 'Hora actualizada');
    } catch (err: any) {
      showToast('error', 'Error: ' + err.message);
    }
  };

  const guardarEdicionPeaje = async () => {
    if (!editandoPeajeId || !editandoPeajeDatos) return;
    try {
      const { error } = await supabase.from('gastos_combustible').update({
        monto: parseFloat(editandoPeajeDatos.monto),
        fecha: editandoPeajeDatos.fecha + 'T12:00:00-05:00',
        tipo_combustible: editandoPeajeDatos.tipo_combustible
      }).eq('id_gasto', editandoPeajeId);
      if (error) throw error;
      refreshCombustible();
      setEditandoPeajeId(null);
      showToast('success', 'Peaje actualizado');
    } catch (err: any) {
      showToast('error', 'Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-surface/50 backdrop-blur-xl">
        <CardContent className="p-6">
          <ReportFilters 
            reportType={reportType}
            setReportType={setReportType}
            period={period}
            setPeriod={setPeriod}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            filterChofer={filterChofer}
            setFilterChofer={setFilterChofer}
            choferes={choferes}
            onRefresh={refreshData}
          />
        </CardContent>
      </Card>

      {reportType === 'rutas' && (
        <RutasReport 
          loading={loading}
          rutas={rutasFiltradas}
          filtros={{ searchTerm: filterRutaNombre }}
          setFiltros={(f) => setFilterRutaNombre(f.searchTerm)}
          rangoLabel={rangoLabel}
          onExportPDF={() => handleExportPDF({
            rangoLabel, filterChofer, choferes, allRutas: rutasFiltradas, fotosPorLocal, incluirFotosEnPDF
          })}
          onEditLlegada={(id) => setEditandoLlegada(id)}
          onSaveLlegada={guardarEdicionLlegada}
          editandoLlegada={editandoLlegada}
          horaLlegadaEdit={horaLlegadaEdit}
          setHoraLlegadaEdit={setHoraLlegadaEdit}
          fotosPorLocal={fotosPorLocal}
          onExportEvidenciaZip={() => handleExportEvidenciaZip(rutasFiltradas, fotosPorLocal)}
          onDeleteFoto={handleDeleteEvidenciaFoto}
          onViewPhoto={(images, index) => setActivePhoto({ images, index })}
          descargandoZip={descargandoZip}
        />
      )}

      {reportType === 'combustible' && (
        <CombustibleReport 
          loading={combustibleLoading}
          gastos={gastosCombustible}
          fotos={fotosCombustible}
          agruparPor={agruparPor}
          setAgruparPor={setAgruparPor}
          totalesPorTipo={{}} // Calculado dentro o pasado
          totalGeneral={gastosCombustible.reduce((s, g) => s + (g.monto || 0), 0)}
          rangoLabel={rangoLabel}
          onExportPDF={() => {}} // Implementar similar a handleExportPDF
          onExportZip={() => {}}
          onDeleteGasto={handleDeleteGasto}
          onDownloadFoto={() => {}}
          onViewPhoto={(images, index) => setActivePhoto({ images, index })}
          descargandoZip={descargandoZip}
          incluirFotosEnPDF={incluirFotosEnPDF}
          setIncluirFotosEnPDF={setIncluirFotosEnPDF}
        />
      )}

      {reportType === 'peajes' && (
        <PeajesReport 
          rangoLabel={rangoLabel}
          peajesCalculados={peajesCalculados}
          peajesManualesMonto={peajesManuales.filter(g => g.tipo_combustible === 'peaje').reduce((s, g) => s + (g.monto || 0), 0)}
          peajesCompromisoMonto={peajesManuales.filter(g => g.tipo_combustible === 'peaje_compromiso').reduce((s, g) => s + (g.monto || 0), 0)}
          peajesManuales={peajesManuales}
          ordenPeajes={ordenPeajes}
          setOrdenPeajes={setOrdenPeajes}
          editandoPeajeId={editandoPeajeId}
          editandoPeajeDatos={editandoPeajeDatos}
          setEditandoPeajeDatos={setEditandoPeajeDatos}
          onSaveEdicion={guardarEdicionPeaje}
          onCancelEdicion={() => { setEditandoPeajeId(null); setEditandoPeajeDatos(null); }}
          onIniciaEdicion={(g) => { setEditandoPeajeId(g.id_gasto); setEditandoPeajeDatos(g); }}
          onEliminarGasto={handleDeleteGasto}
          onViewPhoto={(url) => setShowFotoModal(url)}
          onExportPDF={() => {}}
        />
      )}

      {reportType === 'otros' && (
        <OtrosGastosReport 
          gastos={gastosOtros}
          fotos={fotosCombustible}
          rangoLabel={rangoLabel}
          onExportPDF={() => {}}
          onDeleteGasto={handleDeleteGasto}
          onViewPhoto={(images, index) => setActivePhoto({ images, index })}
        />
      )}

      {showFotoModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowFotoModal(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowFotoModal(null)} className="absolute -top-12 right-0 text-white flex items-center gap-2 bg-surface px-4 py-2 rounded-lg">
              <X size={20} /> Cerrar
            </button>
            <img src={showFotoModal} alt="Ampliada" className="max-h-[80vh] w-full object-contain rounded-lg" />
          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        images={activePhoto?.images || []}
        initialIndex={activePhoto?.index}
      />
    </div>
  );
}
