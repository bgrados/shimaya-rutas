import { useState } from 'react';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { generateReportHtml } from '../templates/ReportHtmlTemplate';
import { useToast } from '../../../../components/ui/Toast';
import type { RutaConBitacora, Usuario } from './useReportData';
import type { FotoVisita } from '../../../../types';

interface ExportOptions {
  rangoLabel: string;
  filterChofer: string;
  choferes: Usuario[];
  allRutas: RutaConBitacora[];
  fotosPorLocal: Record<string, FotoVisita[]>;
  incluirFotosEnPDF: boolean;
}

export function useReportExport() {
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState(false);

  const handleExportPDF = (options: ExportOptions) => {
    setGenerating(true);
    try {
      const choferNombre = options.filterChofer 
        ? options.choferes.find(c => c.id_usuario === options.filterChofer)?.nombre || '' 
        : '';
        
      const html = generateReportHtml({
        rangoLabel: options.rangoLabel,
        choferNombre,
        rutas: options.allRutas,
        fotosPorLocal: options.fotosPorLocal,
        incluirFotos: options.incluirFotosEnPDF
      });

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('error', 'Error al generar el reporte');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportEvidenciaZip = async (allRutas: RutaConBitacora[], fotosPorLocal: Record<string, FotoVisita[]>) => {
    const todasLasFotos: { foto: FotoVisita; local: any; ruta: any }[] = [];

    allRutas.forEach(ruta => {
      if (ruta.localesRuta) {
        ruta.localesRuta.forEach(local => {
          const fotos = fotosPorLocal[local.id_local_ruta] || [];
          fotos.forEach(foto => {
            todasLasFotos.push({ foto, local, ruta });
          });
        });
      }
    });

    if (todasLasFotos.length === 0) {
      alert('No hay fotos de evidencia para exportar');
      return;
    }

    setDescargandoZip(true);
    try {
      const zip = new JSZip();
      const fecha = format(new Date(), 'yyyy-MM-dd');

      for (const item of todasLasFotos) {
        try {
          const response = await fetch(item.foto.foto_url);
          const blob = await response.blob();
          const nombreArchivo = `${item.ruta.nombre || 'ruta'}_${item.local.nombre || 'local'}_${item.foto.id_foto}.jpg`;
          zip.file(nombreArchivo, blob);
        } catch (err) {
          console.warn('[Evidencia] Error descargando foto:', item.foto.id_foto);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evidencia_fotos_${fecha}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Evidencia Zip] Error:', err);
      showToast('error', 'Error al exportar evidencia');
    } finally {
      setDescargandoZip(false);
    }
  };

  const handleShareWhatsApp = (rangoLabel: string, totalRutas: number, finalizadas: number, enProgreso: number, pendientes: number, rutasFinalizadas: any[]) => {
    const lines = [
      `🚛 *Reporte Shimaya – ${rangoLabel.toUpperCase()}*`,
      `━━━━━━━━━━━━━━━━━━━`,
      `📦 Total rutas: *${totalRutas}*`,
      `✅ Finalizadas: *${finalizadas}*`,
      `🔵 En progreso: *${enProgreso}*`,
      `🟡 Pendientes: *${pendientes}*`,
      '',
      ...rutasFinalizadas.map(r =>
        `🚛 ${r.nombre} (${r.placa || '-'}) · ${r.durationMin ? `${Math.floor(r.durationMin/60)}h ${r.durationMin%60}m` : 'sin tiempo'}`
      ),
      '',
      `_Generado desde Shimaya Rutas_`,
    ];
    const texto = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  return {
    generating,
    descargandoZip,
    handleExportPDF,
    handleExportEvidenciaZip,
    handleShareWhatsApp
  };
}
