import { formatPeru } from '../../../../lib/timezone';
import type { Ruta, ViajeBitacora } from '../../../../types';

export const generarResumenWhatsApp = (ruta: Ruta, bitacora: ViajeBitacora[]) => {
  let mensaje = `*RESUMEN DE RUTA - SHIMAYA*\n`;
  mensaje += `--------------------------------\n`;
  mensaje += `*Ruta:* ${ruta.nombre}\n`;
  mensaje += `*Placa:* ${ruta.placa || 'N/A'}\n`;
  mensaje += `*Km Inicial:* ${ruta.km_inicio || 0}\n`;
  mensaje += `*Km Final:* ${ruta.km_fin || '?'}\n`;
  mensaje += `--------------------------------\n\n`;

  bitacora.forEach((b, index) => {
    mensaje += `*${index + 1}. ${b.destino_nombre}*\n`;
    mensaje += `🕒 Salida: ${formatPeru(b.hora_salida, 'HH:mm')}\n`;
    mensaje += `🕒 Llegada: ${formatPeru(b.hora_llegada, 'HH:mm')}\n`;
    if (b.observacion) mensaje += `📝 Nota: ${b.observacion}\n`;
    mensaje += `\n`;
  });

  return mensaje;
};
