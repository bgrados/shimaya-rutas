import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { useToast } from '../../../../components/ui/Toast';
import { supabase } from '../../../../lib/supabase';
import type { LocalRuta } from '../../../../types';

interface ModalEvidenciaProps {
  local: LocalRuta;
  onClose: () => void;
  onSuccess: () => void;
}

const TARGET_WIDTH = 1280;
const LOGO_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTcvbdl7qk6b_Rb5ihYLyfkqzryxsK9uiU5w&s';
const MAX_SIZE_KB = 300;
const TARGET_QUALITY = 0.7;

interface OptimizedImage {
  blob: Blob;
  originalSize: number;
  finalSize: number;
  width: number;
  height: number;
}

const optimizeImage = (file: File): Promise<OptimizedImage> => {
  return new Promise((resolve, reject) => {
    const originalSize = file.size;
    console.log(`[Optimize] 📷 Archivo original: ${(originalSize / 1024).toFixed(1)}KB - ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Calcular nuevas dimensiones (max 1280px)
          let width = img.width;
          let height = img.height;
          
          if (width > TARGET_WIDTH) {
            const ratio = TARGET_WIDTH / width;
            width = TARGET_WIDTH;
            height = Math.round(height * ratio);
          }
          
          console.log(`[Optimize] 📐 Dimensiones: ${img.width}x${img.height} → ${width}x${height}`);
          
          // Crear canvas con las dimensiones calculadas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo crear el contexto')); return; }
          
          // Dibujar imagen redimensionada
          ctx.drawImage(img, 0, 0, width, height);
          
          // Agregar marca de agua
          await addWatermark(canvas);
          
          // Compresión iterativa para alcanzar <300KB
          let quality = TARGET_QUALITY;
          let blob: Blob | null = null;
          let attempts = 0;
          const maxAttempts = 5;
          
          do {
            blob = await new Promise<Blob | null>((res) => {
              canvas.toBlob((b) => res(b), 'image/jpeg', quality);
            });
            
            if (blob) {
              const sizeKB = blob.size / 1024;
              console.log(`[Optimize] 🔄 Intento ${attempts + 1}: calidad=${Math.round(quality*100)}%, tamaño=${sizeKB.toFixed(1)}KB`);
              
              if (sizeKB <= MAX_SIZE_KB || quality <= 0.3) {
                resolve({
                  blob,
                  originalSize: originalSize,
                  finalSize: blob.size,
                  width,
                  height
                });
                return;
              }
            }
            
            quality -= 0.1;
            attempts++;
          } while (attempts < maxAttempts && blob && blob.size > MAX_SIZE_KB * 1024);
          
          // Si aún supera el límite, intentar redimensionar más
          if (blob && blob.size > MAX_SIZE_KB * 1024) {
            console.log(`[Optimize] ⚠️ Intentando reducción adicional...`);
            
            const reducedWidth = Math.round(width * 0.7);
            const reducedHeight = Math.round(height * 0.7);
            
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = reducedWidth;
            smallCanvas.height = reducedHeight;
            
            const smallCtx = smallCanvas.getContext('2d');
            if (smallCtx) {
              smallCtx.drawImage(canvas, 0, 0, reducedWidth, reducedHeight);
              
              blob = await new Promise<Blob | null>((res) => {
                smallCanvas.toBlob((b) => res(b), 'image/jpeg', 0.5);
              });
            }
          }
          
          if (blob) {
            const finalSizeKB = blob.size / 1024;
            console.log(`[Optimize] ✅ Optimización completa: ${(originalSize/1024).toFixed(1)}KB → ${finalSizeKB.toFixed(1)}KB (reducción: ${Math.round((1 - finalSizeKB/(originalSize/1024))*100)}%)`);
            
            resolve({
              blob,
              originalSize: originalSize,
              finalSize: blob.size,
              width,
              height
            });
          } else {
            reject(new Error('Error al comprimir imagen'));
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Error al cargar imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(file);
  });
};

// Aplicar marca de agua a una URL de imagen existente (para reprocesar fotos antiguas)
const applyWatermarkToUrl = async (imageUrl: string): Promise<string | null> => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = imageUrl;
    });
    
    const canvas = document.createElement('canvas');
    const ratio = TARGET_WIDTH / img.width;
    canvas.width = TARGET_WIDTH;
    canvas.height = img.height * ratio;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    await addWatermark(canvas);
    
    return new Promise<string>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.7);
    });
  } catch (e) {
    return null;
  }
};

// Reprocesar fotos existentes con marca de agua
const reprocessExistingPhotos = async (fotos: { id_foto: string; foto_url: string }[], localId: string) => {
  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    const watermarkedBase64 = await applyWatermarkToUrl(foto.foto_url);
    
    if (watermarkedBase64) {
      const response = await fetch(watermarkedBase64);
      const blob = await response.blob();
      
      const fileName = `evidencia/wm_${localId}_${Date.now()}_${i}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('visitas_fotos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      
      if (!uploadError) {
        const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(fileName);
        await supabase.from('fotos_visita').update({ foto_url: data.publicUrl }).eq('id_foto', foto.id_foto);
      }
    }
  }
};

const addWatermark = async (canvas: HTMLCanvasElement): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('No context')); return; }
    
    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.onload = () => {
      // Logo tamaño medio (8% del ancho)
      const logoSize = canvas.width * 0.08;
      const padding = canvas.width * 0.012;
      
      // Posición: esquina inferior derecha
      const x = canvas.width - logoSize - padding;
      const y = canvas.height - logoSize - padding;
      
      ctx.save();
      
      // Fondo blanco INTERIOR pequeño (solo para que contraste el logo)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, logoSize + 4, logoSize + 4, 6);
      ctx.fill();
      
      // Logo con mejor visibilidad (60% transparencia)
      ctx.globalAlpha = 0.6;
      ctx.drawImage(logo, x, y, logoSize, logoSize);
      
      ctx.restore();
      resolve();
    };
    logo.onerror = () => {
      resolve();
    };
    logo.src = LOGO_URL;
  });
};

export const ModalEvidencia: React.FC<ModalEvidenciaProps> = ({ local, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [capturando, setCapturando] = useState(false);
  const [fotosCapturadas, setFotosCapturadas] = useState<{ preview: string; file: File; optimized?: OptimizedImage }[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [fotosExistentes, setFotosExistentes] = useState<{ id_foto: string; foto_url: string }[]>([]);
  const [loadingExistentes, setLoadingExistentes] = useState(true);
  const [reprocesando, setReprocesando] = useState(false);
  const [reprocesCount, setReprocesCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadFotosExistentes();
  }, [local.id_local_ruta]);

  const loadFotosExistentes = async () => {
    setLoadingExistentes(true);
    const { data, error } = await supabase
      .from('fotos_visita')
      .select('id_foto, foto_url')
      .eq('id_local_ruta', local.id_local_ruta);
    
    if (!error && data) {
      // Verificar si las fotos ya tienen marca de agua (contienen 'wm_')
      const fotosSinWM = data.filter(f => !f.foto_url.includes('/wm_'));
      
      if (fotosSinWM.length > 0 && !reprocesando) {
        console.log(`[Foto] ${fotosSinWM.length} fotos sin marca de agua, reprocesando...`);
        setReprocesando(true);
        setReprocesCount(fotosSinWM.length);
        
        try {
          await reprocessExistingPhotos(fotosSinWM, local.id_local_ruta);
          // Recargar fotos actualizadas
          const { data: updatedData } = await supabase
            .from('fotos_visita')
            .select('id_foto, foto_url')
            .eq('id_local_ruta', local.id_local_ruta);
          if (updatedData) setFotosExistentes(updatedData);
        } catch (e) {
          console.error('[Foto] Error reprocesando:', e);
        }
        
        setReprocesando(false);
      } else {
        setFotosExistentes(data);
      }
    }
    setLoadingExistentes(false);
  };

  // Eliminada función compressToWebP - ahora usa optimizeImage

  const handleAgregarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const disponibles = 5 - (fotosCapturadas.length + fotosExistentes.length);
      const nuevosArchivos = Array.from(e.target.files).slice(0, disponibles);
      
      setOptimizing(true);
      
      for (const file of nuevosArchivos) {
        try {
          const optimized = await optimizeImage(file);
          
          // Convertir blob a preview URL
          const previewUrl = URL.createObjectURL(optimized.blob);
          
          setFotosCapturadas(prev => [...prev, { 
            preview: previewUrl, 
            file, 
            optimized 
          }]);
          
          console.log(`[Foto] ✅ Optimizada: ${(optimized.originalSize/1024).toFixed(1)}KB → ${(optimized.finalSize/1024).toFixed(1)}KB`);
        } catch (err) {
          console.error('[Foto] Error optimizando:', err);
          // Usar imagen original si falla la optimización
          const reader = new FileReader();
          reader.onload = (ev) => {
            setFotosCapturadas(prev => [...prev, { 
              preview: ev.target?.result as string, 
              file 
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
      
      setOptimizing(false);
    }
    e.target.value = '';
  };

  const handleSubirFotos = async () => {
    if (fotosCapturadas.length === 0) return;
    setCapturando(true);
    
    try {
      const ordenBase = fotosExistentes.length + 1;
      
      for (let i = 0; i < fotosCapturadas.length; i++) {
        const { file, optimized } = fotosCapturadas[i];
        
        // Usar blob optimizado o convertir original a JPEG si no hay optimización
        const blobToUpload = optimized?.blob || await optimizeImage(file).then(o => o.blob);
        
        const fileName = `${local.id_local_ruta}_${Date.now()}_${i}.jpg`;
        const filePath = `evidencia/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('visitas_fotos')
          .upload(filePath, blobToUpload, { contentType: 'image/jpeg' });
        
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
        
        await supabase.from('fotos_visita').insert({
          id_local_ruta: local.id_local_ruta,
          foto_url: data.publicUrl,
          orden: ordenBase + i,
        });
        
        if (optimized) {
          console.log(`[Upload] ✅ Subida: ${local.nombre} - ${(optimized.finalSize/1024).toFixed(1)}KB`);
        }
      }
      
      showToast('success', 'Evidencia guardada correctamente');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error subiendo fotos:', err);
      showToast('error', 'No se pudieron guardar las fotos');
    } finally {
      setCapturando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
            📸 Evidencia: {local.nombre}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-white p-2">
            <X size={24} />
          </button>
        </div>
        
        {/* Indicador de reprocesamiento */}
          {reprocesando && (
            <div className="bg-orange-500/20 border border-orange-500/30 p-3 rounded-xl text-center">
              <p className="text-orange-400 text-xs font-bold">
                ⏳ Agregando marca de agua a {reprocesCount} foto(s)...
              </p>
            </div>
          )}
          
          {/* Indicador de optimización */}
          {optimizing && (
            <div className="bg-blue-500/20 border border-blue-500/30 p-3 rounded-xl text-center">
              <p className="text-blue-400 text-xs font-bold">
                🔄 Optimizando imagenes...
              </p>
            </div>
          )}

          <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Sube hasta 5 fotos de respaldo para tu visita.
          </p>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleAgregarFoto}
            accept="image/*"
            multiple
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-3">
             <Button 
               onClick={() => {
                 if (fileInputRef.current) {
                   fileInputRef.current.setAttribute('capture', 'environment');
                   fileInputRef.current.click();
                 }
               }}
               className="bg-surface-light hover:bg-white/10 text-white font-bold h-14 flex-col py-2"
               disabled={fotosCapturadas.length + fotosExistentes.length >= 5}
             >
               <Camera size={24} className="mb-1" />
               <span className="text-xs font-black">CÁMARA</span>
             </Button>
             <Button 
               onClick={() => {
                 if (fileInputRef.current) {
                   fileInputRef.current.removeAttribute('capture');
                   fileInputRef.current.click();
                 }
               }}
               className="bg-surface-light hover:bg-white/10 text-white font-bold h-14 flex-col py-2"
               disabled={fotosCapturadas.length + fotosExistentes.length >= 5}
             >
               <ImageIcon size={24} className="mb-1" />
               <span className="text-xs font-black">GALERÍA</span>
             </Button>
          </div>

          {/* Fotos por subir */}
          {fotosCapturadas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-primary font-black uppercase italic">Nuevas fotos ({fotosCapturadas.length}):</p>
              <div className="grid grid-cols-3 gap-2">
                {fotosCapturadas.map((foto, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/50">
                    <img src={foto.preview} alt="Vista previa" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 right-1 flex justify-between items-center">
                      {foto.optimized && (
                        <span className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                          {Math.round(foto.optimized.finalSize / 1024)}KB
                        </span>
                      )}
                      <button
                        onClick={() => {
                          // Liberar URL del blob optimizado
                          if (foto.optimized) {
                            URL.revokeObjectURL(foto.preview);
                          }
                          setFotosCapturadas(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="bg-red-600 text-white rounded-full p-1 ml-auto"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos existentes */}
          {fotosExistentes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted font-black uppercase italic">Fotos guardadas:</p>
              <div className="grid grid-cols-3 gap-2">
                {fotosExistentes.map((foto) => (
                  <div key={foto.id_foto} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                    <img src={foto.foto_url} alt="Evidencia" className="w-full h-full object-cover" />
                    <button
                      onClick={async () => {
                        if (confirm('¿Eliminar esta foto de evidencia?')) {
                          await supabase.from('fotos_visita').delete().eq('id_foto', foto.id_foto);
                          setFotosExistentes(prev => prev.filter(f => f.id_foto !== foto.id_foto));
                        }
                      }}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
                      title="Eliminar foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="flex-1 h-14 font-bold text-text-muted"
          >
            CANCELAR
          </Button>
          <Button 
            onClick={handleSubirFotos}
            disabled={capturando || fotosCapturadas.length === 0}
            className="flex-[2] bg-primary hover:bg-primary-hover h-14 font-black italic shadow-lg shadow-primary/20"
          >
            {capturando ? 'GUARDANDO...' : 'GUARDAR EVIDENCIA'}
          </Button>
        </div>
      </div>
    </div>
  );
};
