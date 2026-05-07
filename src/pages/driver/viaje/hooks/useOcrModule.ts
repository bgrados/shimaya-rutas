import { useState, useCallback } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { corregirOrientacionImagenDesdeDataUrl, preprocesarImagenOcr } from '../utils/imageUtils';

export function useOcrModule() {
  const { showToast } = useToast();
  const [procesandoOCR, setProcesandoOCR] = useState(false);
  const [kmDetectado, setKmDetectado] = useState<number | null>(null);

  const procesarKilometraje = useCallback(async (dataUrl: string) => {
    setProcesandoOCR(true);
    setKmDetectado(null);
    try {
      showToast('info', '🔍 Procesando imagen...');
      const imgCorregida = await corregirOrientacionImagenDesdeDataUrl(dataUrl);
      const imgPreprocesada = await preprocesarImagenOcr(imgCorregida);
      
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.default.recognize(imgPreprocesada, 'eng', {
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: 7,
      });

      const text = result.data.text;
      const matches = text.match(/\b\d{3,8}\b/g);
      
      if (matches && matches.length > 0) {
        const km = parseInt(matches.sort((a, b) => b.length - a.length)[0]);
        if (!isNaN(km) && km > 0) {
          setKmDetectado(km);
          showToast('success', `✅ Kilometraje detectado: ${km.toLocaleString()}`);
          return km;
        }
      }
      showToast('warning', '⚠️ No se pudo leer. Intenta una foto más clara.');
      return null;
    } catch (err) {
      console.error('OCR Error:', err);
      showToast('error', 'Error al procesar la imagen');
      return null;
    } finally {
      setProcesandoOCR(false);
    }
  }, [showToast]);

  return {
    procesandoOCR,
    kmDetectado,
    procesarKilometraje,
    setKmDetectado
  };
}
