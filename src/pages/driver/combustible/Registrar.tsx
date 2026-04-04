import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { GastoCombustible } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Camera, Fuel, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface RegistrarCombustibleProps {
  idRuta: string;
  idChofer: string;
  onClose?: () => void;
}

export default function RegistrarCombustible({ idRuta, idChofer, onClose }: RegistrarCombustibleProps) {
  const navigate = useNavigate();
  const [foto, setFoto] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [montoDetectado, setMontoDetectado] = useState<number | null>(null);
  const [tipoDetectado, setTipoDetectado] = useState<string>('glp');
  const [manualMonto, setManualMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
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

      // Buscar monto en el texto (buscar patrones como S/ 50.00, 50.00, S/.50.00)
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

      // Detectar tipo de combustible
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

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setFoto(dataUrl);
      await processOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleGuardar = async () => {
    if (!manualMonto || parseFloat(manualMonto) <= 0) {
      setError('Ingresa el monto del combustible');
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      let fotoUrl = foto;
      
      // Si hay foto, subir a Supabase Storage
      if (foto) {
        const fileExt = 'jpg';
        const fileName = `combustible_${idRuta}_${Date.now()}.${fileExt}`;
        const filePath = `combustible/${fileName}`;

        // Convertir dataURL a blob
        const response = await fetch(foto);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('combustible')
          .upload(filePath, blob, { upsert: true });

        if (uploadError) {
          console.error('[Combustible] Error upload:', uploadError);
        } else {
          const { data } = supabase.storage.from('combustible').getPublicUrl(filePath);
          fotoUrl = data.publicUrl;
        }
      }

      // Guardar en BD
      const { error: insertError } = await supabase.from('gastos_combustible').insert({
        id_ruta: idRuta,
        id_chofer: idChofer,
        tipo_combustible: tipoDetectado,
        monto: parseFloat(manualMonto),
        foto_url: fotoUrl,
        notas: notas || null,
        estado: montoDetectado ? 'pendiente_revision' : 'pendiente_revision',
        fecha: new Date().toISOString()
      });

      if (insertError) {
        console.error('[Combustible] Error insert:', insertError);
        throw new Error(insertError.message);
      }

      setGuardado(true);
      setTimeout(() => {
        if (onClose) onClose();
        else navigate('/driver');
      }, 2000);

    } catch (err: any) {
      console.error('[Combustible] Error:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (guardado) {
    return (
      <div className="p-4 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-500" size={48} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">¡Registrado!</h2>
        <p className="text-text-muted">El gasto de combustible ha sido registrado correctamente.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Registrar Combustible</h2>
        <Button variant="ghost" size="sm" onClick={onClose || (() => navigate('/driver'))}>
          <X size={24} />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Botón tomar foto */}
        <Card className="border-dashed border-2 border-surface-light">
          <CardContent className="p-6 text-center">
            {foto ? (
              <div className="relative">
                <img src={foto} alt="Comprobante" className="max-h-48 mx-auto rounded-lg" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute top-2 right-2 bg-surface/80"
                  onClick={() => { setFoto(null); setMontoDetectado(null); }}
                >
                  <X size={16} />
                </Button>
              </div>
            ) : (
              <button onClick={handleTakePhoto} className="w-full py-8">
                <Camera className="mx-auto mb-2 text-text-muted" size={48} />
                <p className="text-text-muted">Toca para tomar foto del ticket</p>
              </button>
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

        {/* OCR procesando */}
        {procesando && (
          <div className="text-center py-4">
            <Loader2 className="animate-spin mx-auto mb-2 text-primary" size={24} />
            <p className="text-text-muted text-sm">Procesando ticket... {ocrProgress}%</p>
            <div className="w-full bg-surface-light h-2 rounded-full mt-2">
              <div className="bg-primary h-full transition-all" style={{ width: `${ocrProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Mostrar resultado OCR */}
        {montoDetectado && !procesando && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Check size={20} />
                <span className="font-bold">Monto detectado: S/ {montoDetectado.toFixed(2)}</span>
              </div>
              <p className="text-xs text-green-300">Tipo detectado: {tipoDetectado.toUpperCase()}</p>
            </CardContent>
          </Card>
        )}

        {/* Si no detectó monto */}
        {!montoDetectado && !procesando && foto && (
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertTriangle size={20} />
                <span className="text-sm">No se pudo detectar el monto automáticamente</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campos manuales */}
        <div className="space-y-4">
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
            <label className="block text-sm font-medium text-text-muted mb-1">Tipo Combustible</label>
            <select
              value={tipoDetectado}
              onChange={(e) => setTipoDetectado(e.target.value)}
              className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
            >
              <option value="glp">GLP</option>
              <option value="gasolina">Gasolina</option>
              <option value="diesel">Diesel</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales..."
              className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary h-20 resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Botón guardar */}
        <Button
          className="w-full py-4 text-lg"
          onClick={handleGuardar}
          isLoading={guardando}
          disabled={!foto || !manualMonto}
        >
          <Fuel size={20} className="mr-2" />
          Registrar Gasto
        </Button>
      </div>
    </div>
  );
}
