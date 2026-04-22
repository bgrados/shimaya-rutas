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
  const [kilometrajeDetectado, setKilometrajeDetectado] = useState<number | null>(null);
  const [tipoDetectado, setTipoDetectado] = useState<string>('');
  const [manualMonto, setManualMonto] = useState('');
  const [manualKilometraje, setManualKilometraje] = useState('');
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

      const kilometrajePatterns = [
        /(\d{4,7})\s*km/i,
        /km[:\s]*(\d{4,7})/i,
        /kilom[.:\s]*(\d{4,7})/i,
        /odo[.:\s]*(\d{4,7})/i,
      ];

      let kmEncontrado: number | null = null;
      for (const pattern of kilometrajePatterns) {
        const match = text.match(pattern);
        if (match) {
          kmEncontrado = parseInt(match[1]);
          break;
        }
      }

      setMontoDetectado(montoEncontrado);
      setKilometrajeDetectado(kmEncontrado);
      setTipoDetectado(tipoEncontrado);
      
      if (montoEncontrado) {
        setManualMonto(montoEncontrado.toString());
      }
      if (kmEncontrado) {
        setManualKilometraje(kmEncontrado.toString());
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];

    // Método simple - directo con FileReader
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFoto(dataUrl);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // OCR opcional - no bloquea la preview
      processOCR(dataUrl).catch(console.error);
    };
    reader.onerror = (err) => console.error('[Foto] Reader error:', err);
    reader.readAsDataURL(file);
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
    if (!manualKilometraje || parseInt(manualKilometraje) <= 0) {
      setError('Ingresa el kilometraje actual');
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      let fotoUrl: string | null = null;
      
      
      if (!foto) {
        alert('⚠️ No hay foto para subir. Toma una foto primero.');
        return;
      }
      
      if (foto) {
        setSubiendoFoto(true);
        
        try {
          const fileName = `combustible_${idRuta}_${Date.now()}.jpg`;
          const filePath = `combustible/${fileName}`;

          // Convertir dataURL a blob de forma segura
          const base64Response = await fetch(foto);
          const blobToUpload = await base64Response.blob();
          
          
          // Validar blob
          if (!blobToUpload || blobToUpload.size === 0) {
            alert('Error: imagen vacía');
            setSubiendoFoto(false);
            setGuardando(false);
            return;
          }

          
          const uploadResult = await supabase.storage
            .from('combustible')
            .upload(filePath, blobToUpload, { 
              contentType: 'image/jpeg'
            });


          setSubiendoFoto(false);

          if (uploadResult.error) {
            console.error('[Combustible] ❌ Upload ERROR:', uploadResult.error);
            alert('ERROR al subir foto: ' + uploadResult.error.message);
            setError('Error al subir la foto: ' + uploadResult.error.message);
            setGuardando(false);
            return;
          }

          alert('✅ Foto subida, guardando gasto...');
          const { data: urlData } = supabase.storage.from('combustible').getPublicUrl(filePath);
          fotoUrl = urlData.publicUrl;
        } catch (err: any) {
          setSubiendoFoto(false);
          console.error('[Combustible] ❌ CATCH ERROR:', err);
          alert('ERROR al procesar foto: ' + err.message);
          setError('Error al procesar la foto: ' + err.message);
          setGuardando(false);
          return;
        }
      } else {
      }

      const { error: insertError } = await supabase.from('gastos_combustible').insert({
        id_ruta: idRuta,
        id_chofer: idChofer,
        tipo_combustible: tipoDetectado,
        monto: parseFloat(manualMonto),
        kilometraje: parseInt(manualKilometraje) || null,
        foto_url: fotoUrl,
        notas: notas || null,
        estado: 'confirmado',
        fecha: nowPeru()
      });

      if (insertError) {
        console.error('[Combustible] Insert error:', insertError);
        throw new Error(insertError.message);
      }

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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={20} />
                    Cámara
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex items-center justify-center gap-2 py-4"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute('capture');
                        fileInputRef.current.click();
                      }
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
                  <Check size={16} />
                  <span>Monto detectado: S/ {montoDetectado.toFixed(2)}</span>
                </div>
                {kilometrajeDetectado && (
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-bold border-t border-white/5 pt-1 mt-1">
                    <Truck size={16} />
                    <span>KM detectado: {kilometrajeDetectado} km</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium text-text-muted mb-1">Kilometraje</label>
            <input
              type="number"
              value={manualKilometraje}
              onChange={(e) => setManualKilometraje(e.target.value)}
              placeholder="0"
              className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary font-bold"
            />
          </div>
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
