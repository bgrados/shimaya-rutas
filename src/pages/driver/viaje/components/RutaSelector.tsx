import React, { useState } from 'react';
import { Truck, PlusCircle, ChevronDown, Play, RefreshCw, Camera, X, Loader2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Card, CardContent } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import Tesseract from 'tesseract.js';

interface RutaSelectorProps {
  loadingRutasBase: boolean;
  rutasBase: any[];
  selectedRutaBase: string;
  setSelectedRutaBase: (val: string) => void;
  nuevaPlaca: string;
  handlePlacaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tienePlacaAsignada: boolean;
  createError: string;
  loadError: string;
  isCreating: boolean;
  kmInicio: string;
  setKmInicio: (val: string) => void;
  fotoKmInicio: string | null;
  setFotoKmInicio: (val: string | null) => void;
  handleCrearRuta: () => void;
}

// Función para corregir orientación vertical de imagen
const corregirOrientacionImagen = (dataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      let rotationAngle = 0;

      // Detectar si la imagen está en vertical (alto > ancho) y corregir
      if (height > width) {
        canvas.width = height;
        canvas.height = width;
        rotationAngle = -90; // Rotar para que los números queden horizontales
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      if (rotationAngle !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotationAngle * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
      } else {
        ctx.drawImage(img, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// Función para preprocesar imagen (escala grises + alto contraste)
const preprocesarImagenOCR = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Escala de grises + binarización (alto contraste)
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const value = gray > 128 ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export function RutaSelector({
  loadingRutasBase,
  rutasBase,
  selectedRutaBase,
  setSelectedRutaBase,
  nuevaPlaca,
  handlePlacaChange,
  tienePlacaAsignada,
  createError,
  loadError,
  isCreating,
  kmInicio,
  setKmInicio,
  fotoKmInicio,
  setFotoKmInicio,
  handleCrearRuta
}: RutaSelectorProps) {
  const [procesandoOCR, setProcesandoOCR] = useState(false);
  const [kmDetectado, setKmDetectado] = useState<number | null>(null);
  const [errorOCR, setErrorOCR] = useState<string | null>(null);

  const procesarOCRKm = async (dataUrl: string) => {
    setProcesandoOCR(true);
    setKmDetectado(null);
    setErrorOCR(null);

    try {
      // PASO 1: Corregir orientación (fotos verticales)
      const imgCorregida = await corregirOrientacionImagen(dataUrl);

      // PASO 2: Preprocesar imagen (mejorar contraste)
      const imgPreprocesada = await preprocesarImagenOCR(imgCorregida);

      // PASO 3: Ejecutar OCR optimizado
      const result = await Tesseract.recognize(
        imgPreprocesada,
        'eng',
        {
          logger: (m) => console.log('[OCR]', m),
          tessedit_char_whitelist: '0123456789', // Solo números
          tessedit_pageseg_mode: 7, // Modo: línea de texto única
        }
      );

      const text = result.data.text;
      console.log('[OCR] Texto detectado:', text);

      // PASO 4: Buscar números de odómetro (3-8 dígitos)
      const matches = text.match(/\b\d{3,8}\b/g);

      if (matches && matches.length > 0) {
        // Tomar el número más largo (generalmente es el odómetro)
        const km = parseInt(matches.sort((a, b) => b.length - a.length)[0]);

        if (!isNaN(km) && km > 0) {
          setKmDetectado(km);
          setKmInicio(km.toString());
          // Mostrar feedback visual en la UI
          return;
        }
      }

      // Si no se detectó nada, mostrar advertencia
      setErrorOCR('No se pudo leer el número. Toma la foto HORIZONTALMENTE y con buena luz.');

    } catch (err) {
      console.error('[OCR KM] Error:', err);
      setErrorOCR('Error al procesar la imagen. Intenta nuevamente.');
    } finally {
      setProcesandoOCR(false);
    }
  };

  const handleFotoKmInicio = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          const dataUrl = re.target?.result as string;
          setFotoKmInicio(dataUrl);
          procesarOCRKm(dataUrl);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="p-4 space-y-8 max-w-lg mx-auto pb-24">
      <div className="text-center space-y-2 pt-8">
        <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-primary">
          <Truck size={40} />
        </div>
        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Nueva Jornada</h1>
        <p className="text-text-muted text-sm">Selecciona una plantilla y placa para iniciar tu ruta del día.</p>
        <div className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg p-2 mt-2">
          📸 Al tomar la foto del odómetro, <strong class="font-black">APUNTA HORIZONTALMENTE</strong> para mejor detección
        </div>
      </div>

      <Card className="border-primary/30 bg-surface shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <PlusCircle size={120} />
        </div>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Plantilla de Ruta</label>
              {loadingRutasBase ? (
                <div className="bg-surface-light rounded-xl px-4 py-3 text-text-muted text-sm">
                  ⏳ Cargando plantillas...
                </div>
              ) : !rutasBase.length ? (
                <div className="bg-surface-light rounded-xl px-4 py-3 text-text-muted text-sm">
                  Selecciona una plantilla...
                </div>
              ) : (
                <div className="relative">
                  <select
                    className="w-full bg-surface-light border-2 border-primary/20 rounded-xl px-4 py-3 text-white font-bold italic appearance-none focus:border-primary transition-colors cursor-pointer"
                    value={selectedRutaBase}
                    onChange={e => setSelectedRutaBase(e.target.value)}
                  >
                    <option value="" disabled>Elige tu ruta...</option>
                    {rutasBase.map(r => (
                      <option key={r.id_ruta_base} value={r.id_ruta_base} className="bg-surface text-white">
                        {r.nombre} ({r.locales_count} paradas)
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
                    <ChevronDown size={20} className="text-primary" />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">
                {tienePlacaAsignada ? '🚛 Vehículo Asignado' : 'Placa del Vehículo'}
              </label>
              {tienePlacaAsignada ? (
                <div className="bg-green-500/10 border-2 border-green-500/30 rounded-xl px-4 py-3 text-green-400 font-black italic uppercase text-lg tracking-widest text-center">
                  {nuevaPlaca}
                </div>
              ) : (
                <Input
                  placeholder="ABC-123"
                  className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg tracking-widest"
                  value={nuevaPlaca}
                  onChange={handlePlacaChange}
                  maxLength={7}
                />
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">
                Kilometraje Inicial
              </label>
              <Input
                type="number"
                placeholder="0"
                className="bg-surface-light border-2 border-primary/20 text-white font-black italic uppercase text-lg tracking-widest"
                value={kmInicio}
                onChange={e => setKmInicio(e.target.value)}
              />
            </div>

            {/* Foto Kilometraje Inicial - MEJORADA */}
            <div className="space-y-1">
              <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Foto del Odómetro (Opcional)</label>
              {!fotoKmInicio ? (
                <button
                  onClick={handleFotoKmInicio}
                  className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                >
                  <Camera size={24} />
                  <span className="text-xs font-bold uppercase">Tomar Foto del Odómetro</span>
                  <span className="text-[10px] text-text-muted">El número se detecta automáticamente (mejor en horizontal)</span>
                </button>
              ) : (
                <div className="relative group">
                  <img src={fotoKmInicio} className="w-full h-32 object-cover rounded-xl border-2 border-primary/50" />
                  <button
                    onClick={() => { setFotoKmInicio(null); setKmDetectado(null); setErrorOCR(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                  {procesandoOCR && (
                    <div className="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                      <Loader2 className="text-primary animate-spin" size={28} />
                      <span className="text-white text-xs font-bold">Leyendo odómetro...</span>
                      <span className="text-[10px] text-text-muted">Esto puede tomar unos segundos</span>
                    </div>
                  )}
                  {kmDetectado && !procesandoOCR && (
                    <div className="absolute bottom-2 left-2 right-2 bg-green-500/95 rounded-lg px-3 py-2 text-center">
                      <span className="text-white text-xs font-black">✅ Kilometraje detectado: {kmDetectado.toLocaleString()} km</span>
                    </div>
                  )}
                  {errorOCR && !procesandoOCR && !kmDetectado && (
                    <div className="absolute bottom-2 left-2 right-2 bg-red-500/95 rounded-lg px-3 py-2 text-center">
                      <span className="text-white text-xs font-black">⚠️ {errorOCR}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {createError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
                ❌ {createError}
              </div>
            )}
            {loadError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-bold">
                ❌ {loadError}
              </div>
            )}
          </div>

          <Button
            onClick={handleCrearRuta}
            disabled={isCreating || !selectedRutaBase || (!nuevaPlaca.trim() && !tienePlacaAsignada) || !kmInicio || rutasBase.length === 0}
            className="w-full h-16 text-xl font-black italic bg-primary hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isCreating ? '⏳ CREANDO RUTA...' : '🚛 INICIAR MI RUTA'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}