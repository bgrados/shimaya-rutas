import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Camera, Fuel, Loader2, X, Check, AlertTriangle, Image } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { nowPeru } from '../../../lib/timezone';

const TARGET_WIDTH = 1280;
const MAX_SIZE_KB = 300;
const TARGET_QUALITY = 0.7;

const optimizeImage = (file: File): Promise<{ blob: Blob; originalSize: number; finalSize: number }> => {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    console.log(`[Optimize] 📷 Original: ${(originalSize / 1024).toFixed(1)}KB`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          let width = img.width;
          let height = img.height;
          
          if (width > TARGET_WIDTH) {
            const ratio = TARGET_WIDTH / width;
            width = TARGET_WIDTH;
            height = Math.round(height * ratio);
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No context')); return; }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = TARGET_QUALITY;
          let blob: Blob | null = null;
          let attempts = 0;
          
          do {
            blob = await new Promise<Blob | null>((res) => {
              canvas.toBlob((b) => res(b), 'image/jpeg', quality);
            });
            
            if (blob) {
              const sizeKB = blob.size / 1024;
              if (sizeKB <= MAX_SIZE_KB || quality <= 0.3) {
                console.log(`[Optimize] ✅ ${(originalSize/1024).toFixed(1)}KB → ${(blob.size/1024).toFixed(1)}KB`);
                resolve({ blob, originalSize, finalSize: blob.size });
                return;
              }
            }
            quality -= 0.1;
            attempts++;
          } while (attempts < 5 && blob && blob.size > MAX_SIZE_KB * 1024);
          
          if (blob) resolve({ blob, originalSize, finalSize: blob.size });
          else reject(new Error('Error compress'));
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error('Load error'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Read error'));
    reader.readAsDataURL(file);
  });
};

interface RegistrarCombustibleProps {
  idRuta: string;
  idChofer: string;
  onClose?: () => void;
}

export default function RegistrarCombustible({ idRuta, idChofer, onClose }: RegistrarCombustibleProps) {
  const navigate = useNavigate();
  const [foto, setFoto] = useState<string | null>(null);
  const [optimizedFoto, setOptimizedFoto] = useState<{ blob: Blob; originalSize: number; finalSize: number } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [montoDetectado, setMontoDetectado] = useState<number | null>(null);
  const [tipoDetectado, setTipoDetectado] = useState<string>('');
  const [manualMonto, setManualMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processOCR = async (imageData: string) => {
    setProcesando(true);
    setOcrProgress(0);
    
    try {
      const result = await Tesseract.recognize(imageData, 'spa', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const text = result.data.text.toLowerCase();
      console.log('[OCR] Texto detectado:', text);

      const montoPatterns = [
        /s\/\.\s*(\d+[.,]\d{2})/,
        /s\/\s*(\d+[.,]\d{2})/,
        /(\d+[.,]\d{2})\s*$/m,
        /total[:\s]*(\d+[.,]\d{2})/i,
        /importe[:\s]*(\d+[.,]\d{2})/i,
      ];

      let montoEncontrado: number | null = null;
      for (const pattern of montoPatterns) {
        const match = text.match(pattern);
        if (match) {
          montoEncontrado = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }

      let tipoEncontrado = 'glp';
      if (text.includes('gasolina') || text.includes('84') || text.includes('95') || text.includes('98')) {
        tipoEncontrado = 'gasolina';
      } else if (text.includes('diesel') || text.includes('gnv')) {
        tipoEncontrado = 'diesel';
      }

      setMontoDetectado(montoEncontrado);
      setTipoDetectado(tipoEncontrado);
      if (montoEncontrado) {
        setManualMonto(montoEncontrado.toString());
      }

    } catch (err) {
      console.error('[OCR] Error:', err);
      setMontoDetectado(null);
    } finally {
      setProcesando(false);
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[Foto] Archivo seleccionado:', file.name, file.size);
    alert('📷 Foto seleccionada: ' + file.name);

    try {
      const optimized = await optimizeImage(file);
      const previewUrl = URL.createObjectURL(optimized.blob);
      
      console.log('[Foto] Preview URL:', previewUrl);
      setOptimizedFoto(optimized);
      setFoto(previewUrl);
      await processOCR(previewUrl);
    } catch (err) {
      console.error('[Optimize] Error:', err);
      alert('Error al procesar: ' + err);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        setFoto(dataUrl);
        await processOCR(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGuardar = async () => {
    if (!tipoDetectado) {
      setError('Selecciona el tipo de combustible');
      return;
    }
    if (!manualMonto || parseFloat(manualMonto) <= 0) {
      setError('Ingresa el monto del combustible');
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      let fotoUrl: string | null = null;
      
      console.log('[Combustible] ========== GUARDANDO ==========');
      console.log('[Combustible] tipo:', tipoDetectado);
      console.log('[Combustible] monto:', manualMonto);
      console.log('[Combustible] foto:', foto ? 'SI' : 'NO');
      console.log('[Combustible] optimizedFoto:', optimizedFoto ? 'SI' : 'NO');
      console.log('[Combustible] guardando:', guardando);
      
      if (!foto) {
        alert('⚠️ No hay foto para subir. Toma una foto primero.');
        return;
      }
      
      if (foto) {
        console.log('[Combustible] ✅ ENTRO AL BLOQUE DE FOTO');
        setSubiendoFoto(true);
        
        try {
          const fileName = `combustible_${idRuta}_${Date.now()}.jpg`;
          const filePath = `combustible/${fileName}`;

          let blobToUpload: Blob;
          
          if (optimizedFoto?.blob) {
            blobToUpload = optimizedFoto.blob;
            console.log('[Combustible] Blob optimizado size:', blobToUpload.size);
          } else {
            console.log('[Combustible] Fallback: fetch blob');
            const res = await fetch(foto);
            blobToUpload = await res.blob();
            console.log('[Combustible] Fallback blob size:', blobToUpload.size);
          }

          console.log('[Combustible] === INICIANDO UPLOAD ===');
          console.log('[Combustible] Bucket:combustible');
          console.log('[Combustible] Path:', filePath);
          console.log('[Combustible] Blob type:', blobToUpload.type);
          
          // FORZAR error si no hay blob
          if (!blobToUpload || blobToUpload.size === 0) {
            console.error('[Combustible] ❌ Blob vacío!');
            setError('Error: la imagen está vacía');
            setSubiendoFoto(false);
            setGuardando(false);
            return;
          }
          
          const uploadResult = await supabase.storage
            .from('visitas_fotos')
            .upload(filePath, blobToUpload, { 
              contentType: 'image/jpeg'
            });

          console.log('[Combustible] Upload result:', uploadResult);

          setSubiendoFoto(false);

          if (uploadResult.error) {
            console.error('[Combustible] ❌ Upload ERROR:', uploadResult.error);
            alert('ERROR al subir foto: ' + uploadResult.error.message);
            setError('Error al subir la foto: ' + uploadResult.error.message);
            setGuardando(false);
            return;
          }

          console.log('[Combustible] ✅ Upload OK');
          const { data: urlData } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
          fotoUrl = urlData.publicUrl;
          console.log('[Combustible] URL guardada:', fotoUrl);
        } catch (err: any) {
          setSubiendoFoto(false);
          console.error('[Combustible] ❌ CATCH ERROR:', err);
          alert('ERROR al procesar foto: ' + err.message);
          setError('Error al procesar la foto: ' + err.message);
          setGuardando(false);
          return;
        }
      } else {
        console.log('[Combustible] ⚠️ NO HAY FOTO, saltando upload');
      }

      console.log('[Combustible] Insertando en DB tipo:', tipoDetectado);
      const { error: insertError } = await supabase.from('gastos_combustible').insert({
        id_ruta: idRuta,
        id_chofer: idChofer,
        tipo_combustible: tipoDetectado,
        monto: parseFloat(manualMonto),
        foto_url: fotoUrl,
        notas: notas || null,
        estado: 'confirmado',
        fecha: nowPeru()
      });

      if (insertError) {
        console.error('[Combustible] Insert error:', insertError);
        throw new Error(insertError.message);
      }

      console.log('[Combustible] ✅ Gasto guardado correctamente');
      setGuardado(true);
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);

    } catch (err: any) {
      console.error('[Combustible] Error general:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (guardado) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-500" size={32} />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">¡Registrado!</h2>
        <p className="text-text-muted text-sm">El gasto de combustible ha sido registrado.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Registrar Combustible</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>

      <div className="space-y-4">
        <Card className="border-dashed border-2 border-surface-light">
          <CardContent className="p-4 text-center">
            {foto ? (
              <div className="relative">
                <img src={foto} alt="Comprobante" className="max-h-40 mx-auto rounded-lg" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-1 right-1 bg-surface/80"
                  onClick={() => { setFoto(null); setOptimizedFoto(null); setMontoDetectado(null); }}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex items-center justify-center gap-2 py-4"
                    onClick={() => {
                      alert('Abriendo cámara...');
                      fileInputRef.current?.click();
                    }}
                  >
                    <Camera size={20} />
                    Cámara
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex items-center justify-center gap-2 py-4"
                    onClick={() => {
                      alert('Abriendo fototeca...');
                      fileInputRef.current?.click();
                    }}
                  >
                    <Image size={20} />
                    Fototeca
                  </Button>
                </div>
                <p className="text-text-muted text-xs text-center">Toca para agregar foto del ticket</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        {procesando && (
          <div className="text-center py-3">
            <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={20} />
            <p className="text-text-muted text-xs">Procesando... {ocrProgress}%</p>
          </div>
        )}

        {montoDetectado && !procesando && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Check size={16} />
                <span>Monto: S/ {montoDetectado.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Monto (S/)</label>
          <input
            type="number"
            step="0.01"
            value={manualMonto}
            onChange={(e) => setManualMonto(e.target.value)}
            placeholder="0.00"
            className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Tipo</label>
          <select
            value={tipoDetectado}
            onChange={(e) => setTipoDetectado(e.target.value)}
            className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
          >
            <option value="">Seleccionar...</option>
            <option value="glp">GLP</option>
            <option value="gasolina">Gasolina</option>
            <option value="diesel">Diesel</option>
            <option value="otro">Otro (estacionamiento/peaje)</option>
          </select>
        </div>

        {subiendoFoto && (
          <div className="bg-blue-500/10 border border-blue-500 text-blue-400 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Subiendo imagen...
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Button
          className="w-full py-3"
          onClick={handleGuardar}
          isLoading={guardando}
          disabled={!manualMonto || subiendoFoto}
        >
          <Fuel size={18} className="mr-2" />
          Registrar Gasto
        </Button>
      </div>
    </div>
  );
}
