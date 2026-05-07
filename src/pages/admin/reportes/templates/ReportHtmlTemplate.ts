import { format } from 'date-fns';
import { formatFriendlyDate } from '../../../lib/timezone';
import { formatMins } from '../utils';

export function generateReportHtml(params: {
  rangoLabel: string;
  choferNombre: string;
  rutas: any[];
  fotosPorLocal: Record<string, any[]>;
  incluirFotos: boolean;
}) {
  const { rangoLabel, choferNombre, rutas, fotosPorLocal, incluirFotos } = params;

  const routesHTML = rutas.map(r => {
    const bits = r.bitacora || [];
    
    // TABLA DE TRAMOS
    const paradas = bits.map((b: any, i: number) => {
      const transito = b.hora_salida && b.hora_llegada
        ? Math.round((new Date(b.hora_llegada).getTime() - new Date(b.hora_salida).getTime()) / 60000) : null;
      
      const nextBit = bits[i + 1];
      const permanencia = b.hora_llegada && nextBit?.hora_salida
        ? Math.round((new Date(nextBit.hora_salida).getTime() - new Date(b.hora_llegada).getTime()) / 60000) : null;

      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${b.origen_nombre || '-'} → ${b.destino_nombre || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${b.hora_salida ? format(new Date(b.hora_salida), 'HH:mm') : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${b.hora_llegada ? format(new Date(b.hora_llegada), 'HH:mm') : '⏳'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#4f46e5;">${transito !== null ? transito + ' min' : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#f59e0b;">${permanencia !== null ? permanencia + ' min' : '-'}</td>
      </tr>`;
    }).join('');

    // FOTOS
    let fotosHTML = '';
    if (incluirFotos && r.localesRuta && r.localesRuta.length > 0) {
      const allFotos: { url: string; localName: string }[] = [];
      r.localesRuta.forEach((local: any) => {
        const fotos = fotosPorLocal[local.id_local_ruta] || [];
        fotos.forEach((f: any) => {
          allFotos.push({ url: f.foto_url, localName: local.nombre || 'Local' });
        });
      });

      if (allFotos.length > 0) {
        fotosHTML = `
        <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <p style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 12px;">📸 FOTOS DE EVIDENCIA (${allFotos.length})</p>
          <div style="display: flex; flex-wrap: wrap; gap: 12px;">
            ${allFotos.map(foto => `
              <div class="photo-card" onclick="openGallery('${foto.url}')">
                <img src="${foto.url}" data-caption="${foto.localName}" style="width: 100%; height: 150px; object-fit: cover;" />
                <div style="padding: 6px; font-size: 10px; text-align: center; background: white; font-weight: bold;">${foto.localName}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
      }
    }

    return `
      <div style="page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #1e293b; color: white; padding: 12px 16px;">
          <div style="font-size: 16px; font-weight: bold;">🚛 REPORTE DE RUTA: ${(r.nombre || 'SIN NOMBRE').toUpperCase()}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">
            📅 ${r.fecha ? formatFriendlyDate(r.fecha) : 'Fecha no disponible'} 
            ${r.placa ? `| 🚛 Placa: ${r.placa}` : ''}
            | Estado: ${r.estado?.replace('_', ' ') || 'Desconocido'}
          </div>
        </div>
        
        <div style="padding: 10px 16px; background: #f8fafc; font-size: 12px; display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0;">
          ${r.hora_salida_planta ? `<span>🕐 Salida planta: <strong>${format(new Date(r.hora_salida_planta), 'HH:mm')}</strong></span>` : ''}
          ${r.horaLlegadaReal ? `<span>🏁 Llegada planta: <strong>${format(new Date(r.horaLlegadaReal), 'HH:mm')}</strong></span>` : ''}
          ${r.durationMin ? `<span>⏱ Duración total: <strong>${formatMins(r.durationMin)}</strong></span>` : ''}
        </div>
        
        <div style="padding: 16px;">
          <p style="font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 10px;">📋 TRAMOS DE LA RUTA</p>
          ${bits.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 8px; text-align: left;">#</th>
                  <th style="padding: 8px; text-align: left;">Tramo</th>
                  <th style="padding: 8px; text-align: left;">Salida</th>
                  <th style="padding: 8px; text-align: left;">Llegada</th>
                  <th style="padding: 8px; text-align: left;">Tránsito</th>
                  <th style="padding: 8px; text-align: left;">Permanencia</th>
                </tr>
              </thead>
              <tbody>${paradas}</tbody>
            </table>
          ` : '<p style="color: #94a3b8; font-style: italic;">Sin movimientos registrados</p>'}
        </div>
        
        ${fotosHTML ? `<div style="border-top: 1px solid #e2e8f0;">${fotosHTML}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Rutas - Shimaya</title>
      <style>
        @media print {
          body { margin: 0; padding: 15px; }
          .no-print { display: none; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #fff; }
        h1 { color: #1e293b; font-size: 24px; margin-bottom: 5px; }
        .subtitle { color: #64748b; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        button { background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-bottom: 20px; }
        .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
        .close-btn { position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 14px; cursor: pointer; z-index: 9999; }
        .photo-card { width: 180px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white; cursor: pointer; transition: transform 0.2s; }
        .photo-card:hover { transform: scale(1.05); }
        #galleryModal { display: none; position: fixed; z-index: 20000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .gallery-content { max-width: 95%; max-height: 85%; object-fit: contain; border-radius: 4px; box-shadow: 0 0 30px rgba(0,0,0,0.5); }
        .gallery-nav { position: absolute; top: 50%; width: 100%; display: flex; justify-content: space-between; padding: 0 20px; box-sizing: border-box; transform: translateY(-50%); }
        .gallery-btn { background: rgba(255,255,255,0.1); color: white; border: none; width: 50px; height: 50px; cursor: pointer; border-radius: 50%; font-size: 24px; display: flex; align-items: center; justify-content: center; transition: background 0.3s; }
        .gallery-btn:hover { background: rgba(255,255,255,0.3); }
        .gallery-close { position: absolute; top: 20px; right: 20px; color: white; font-size: 35px; cursor: pointer; font-weight: bold; background: none; border: none; }
        .gallery-counter { position: absolute; bottom: 20px; color: white; font-size: 14px; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px; }
        .gallery-caption { position: absolute; top: 70px; color: white; font-size: 18px; font-weight: bold; text-align: center; width: 100%; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
      </style>
      <script>
        let currentImages = [];
        let currentIndex = 0;
        function openGallery(url) {
          const allImgs = Array.from(document.querySelectorAll('.photo-card img'));
          currentImages = allImgs.map(img => ({ src: img.src, caption: img.getAttribute('data-caption') }));
          currentIndex = currentImages.findIndex(img => img.src === url);
          if (currentIndex === -1) currentIndex = 0;
          updateGallery();
          document.getElementById('galleryModal').style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
        function updateGallery() {
          const item = currentImages[currentIndex];
          document.getElementById('galleryImg').src = item.src;
          document.getElementById('galleryCount').innerText = (currentIndex + 1) + ' / ' + currentImages.length;
          document.getElementById('galleryCaption').innerText = item.caption || '';
        }
        function nextImg(e) { if(e) e.stopPropagation(); currentIndex = (currentIndex + 1) % currentImages.length; updateGallery(); }
        function prevImg(e) { if(e) e.stopPropagation(); currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length; updateGallery(); }
        function closeGallery() { document.getElementById('galleryModal').style.display = 'none'; document.body.style.overflow = 'auto'; }
        document.addEventListener('keydown', (e) => {
          if (document.getElementById('galleryModal').style.display === 'flex') {
            if (e.key === 'ArrowRight') nextImg();
            if (e.key === 'ArrowLeft') prevImg();
            if (e.key === 'Escape') closeGallery();
          }
        });
      </script>
    </head>
    <body>
      <div id="galleryModal" onclick="closeGallery()">
        <button class="gallery-close" onclick="closeGallery()">✕</button>
        <div id="galleryCaption" class="gallery-caption"></div>
        <div class="gallery-nav">
          <button class="gallery-btn" onclick="prevImg(event)">‹</button>
          <button class="gallery-btn" onclick="nextImg(event)">›</button>
        </div>
        <img id="galleryImg" class="gallery-content" src="" onclick="event.stopPropagation()">
        <div id="galleryCount" class="gallery-counter"></div>
      </div>
      <button class="close-btn no-print" onclick="window.close();">✕ Cerrar</button>
      <button class="no-print" onclick="window.print();" style="margin-bottom:20px; background: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">🖨️ Imprimir / Guardar PDF</button>
      <h1>🚛 SHIMAYA RUTAS</h1>
      <div class="subtitle">📅 Período: ${rangoLabel} ${choferNombre ? `| 👤 Chofer: ${choferNombre}` : ''}</div>
      ${routesHTML}
      <div class="footer">Reporte generado desde Shimaya Rutas · ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
    </body>
    </html>`;
}
