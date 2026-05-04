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

  const procesarOCRKm = async (dataUrl: string) => {
    setProcesandoOCR(true);
    setKmDetectado(null);
    try {
      const result = await Tesseract.recognize(dataUrl, 'eng', {});
      const text = result.data.text;
      // Buscar número de 4-7 dígitos que sea el odómetro
      const matches = text.match(/\d{4,7}/g);
      if (matches && matches.length > 0) {
        // Tomar el número más largo encontrado
        const km = parseInt(matches.sort((a, b) => b.length - a.length)[0]);
        setKmDetectado(km);
        setKmInicio(km.toString());
      }
    } catch (err) {
      console.error('[OCR KM]', err);
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

            {/* Foto Kilometraje Inicial */}
            <div className="space-y-1">
              <label className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-1">Foto del Odómetro (Opcional)</label>
              {!fotoKmInicio ? (
                <button 
                  onClick={handleFotoKmInicio}
                  className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                >
                  <Camera size={24} />
                  <span className="text-xs font-bold uppercase">Tomar Foto del Odómetro</span>
                  <span className="text-[10px] text-text-muted">El número se detecta automáticamente</span>
                </button>
              ) : (
                <div className="relative group">
                  <img src={fotoKmInicio} className="w-full h-32 object-cover rounded-xl border-2 border-primary/50" />
                  <button 
                    onClick={() => { setFotoKmInicio(null); setKmDetectado(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-lg text-white"
                  >
                    <X size={14} />
                  </button>
                  {procesandoOCR && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                      <Loader2 className="text-white animate-spin" size={24} />
                      <span className="text-white text-xs font-bold">Detectando kilometraje...</span>
                    </div>
                  )}
                  {kmDetectado && !procesandoOCR && (
                    <div className="absolute bottom-2 left-2 right-2 bg-green-500/90 rounded-lg px-3 py-1 text-center">
                      <span className="text-white text-xs font-black">✅ KM detectado: {kmDetectado.toLocaleString()}</span>
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
