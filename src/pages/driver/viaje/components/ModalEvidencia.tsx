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

const TARGET_WIDTH = 1200;

export const ModalEvidencia: React.FC<ModalEvidenciaProps> = ({ local, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [capturando, setCapturando] = useState(false);
  const [fotosCapturadas, setFotosCapturadas] = useState<{ preview: string; file: File }[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<{ id_foto: string; foto_url: string }[]>([]);
  const [loadingExistentes, setLoadingExistentes] = useState(true);
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
      setFotosExistentes(data);
    }
    setLoadingExistentes(false);
  };

  const compressToWebP = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = TARGET_WIDTH / img.width;
          canvas.width = TARGET_WIDTH;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo crear el contexto')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al comprimir'));
          }, 'image/webp', 0.8);
        };
        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleAgregarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const disponibles = 5 - (fotosCapturadas.length + fotosExistentes.length);
      
      Array.from(e.target.files).slice(0, disponibles).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFotosCapturadas(prev => [...prev, { preview: ev.target?.result as string, file }]);
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const handleSubirFotos = async () => {
    if (fotosCapturadas.length === 0) return;
    setCapturando(true);
    
    try {
      const ordenBase = fotosExistentes.length + 1;
      
      for (let i = 0; i < fotosCapturadas.length; i++) {
        const { file } = fotosCapturadas[i];
        const compressedBlob = await compressToWebP(file);
        
        const fileName = `${local.id_local_ruta}_${Date.now()}_${i}.webp`;
        const filePath = `evidencia/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('visitas_fotos')
          .upload(filePath, compressedBlob, { contentType: 'image/webp' });
        
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
        
        await supabase.from('fotos_visita').insert({
          id_local_ruta: local.id_local_ruta,
          foto_url: data.publicUrl,
          orden: ordenBase + i,
        });
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
            capture="environment"
          />

          <div className="flex gap-3">
             <Button 
               onClick={() => fileInputRef.current?.click()}
               className="flex-1 bg-surface-light hover:bg-white/10 text-white font-bold h-14"
               disabled={fotosCapturadas.length + fotosExistentes.length >= 5}
             >
               <Camera size={20} className="mr-2" /> CÁMARA
             </Button>
          </div>

          {/* Fotos por subir */}
          {fotosCapturadas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-primary font-black uppercase italic">Nuevas fotos:</p>
              <div className="grid grid-cols-3 gap-2">
                {fotosCapturadas.map((foto, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/50">
                    <img src={foto.preview} alt="Vista previa" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setFotosCapturadas(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                    >
                      <X size={12} />
                    </button>
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
                  <div key={foto.id_foto} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                    <img src={foto.foto_url} alt="Evidencia" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <ImageIcon size={20} className="text-white" />
                    </div>
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
