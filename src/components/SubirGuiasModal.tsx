import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';
import { X, Upload, FileText, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import type { LocalRuta, GuiaRemision } from '../types';

interface SubirGuiasModalProps {
  local: LocalRuta;
  onClose: () => void;
}

export function SubirGuiasModal({ local, onClose }: SubirGuiasModalProps) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [guias, setGuias] = useState<GuiaRemision[]>(local.guias || []);

  const loadGuias = async () => {
    const { data } = await supabase
      .from('guias_remision')
      .select('*')
      .eq('id_local_ruta', local.id_local_ruta)
      .order('created_at', { ascending: true });
    if (data) setGuias(data);
  };

  React.useEffect(() => {
    loadGuias();

    const channel = supabase
      .channel(`guias_local_${local.id_local_ruta}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'guias_remision',
        filter: `id_local_ruta=eq.${local.id_local_ruta}`
      }, () => loadGuias())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [local.id_local_ruta]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Compress image before upload with higher quality for legibility
        const options = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 2000,
          useWebWorker: true,
          initialQuality: 0.9
        };
        const compressedFile = await imageCompression(file, options);
        
        // Upload to storage
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `${local.id_local_ruta}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${local.id_ruta}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('guias')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('guias')
          .getPublicUrl(filePath);

        // Save reference in database
        const { error: dbError } = await supabase
          .from('guias_remision')
          .insert({
            id_local_ruta: local.id_local_ruta,
            archivo_url: publicUrl
          });

        if (dbError) throw dbError;
      }
    } catch (error: any) {
      console.error('Error uploading guias:', error);
      alert('Error al subir guías: ' + error.message);
    } finally {
      setUploading(false);
      // reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (id_guia: string, url: string) => {
    if (!window.confirm('¿Eliminar esta guía?')) return;
    
    setDeletingId(id_guia);
    try {
      // Intenta borrar del storage usando la ruta del archivo
      try {
        const urlParts = url.split('/');
        const fileName = urlParts.pop();
        if (fileName && local.id_ruta) {
           await supabase.storage.from('guias').remove([`${local.id_ruta}/${fileName}`]);
        }
      } catch (err) {
        console.warn('No se pudo borrar archivo del storage', err);
      }

      const { error } = await supabase.from('guias_remision').delete().eq('id_guia', id_guia);
      if (error) throw error;
      
      // Actualizar estado local inmediatamente para feedback visual
      setGuias(prev => prev.filter(g => g.id_guia !== id_guia));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-surface-light w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 md:p-6 border-b border-surface-light flex justify-between items-center bg-black/20">
          <div>
            <h3 className="text-xl font-black text-white italic leading-tight">Guías de Remisión</h3>
            <p className="text-sm text-text-muted mt-1 font-medium">{local.nombre}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-light/50 text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {guias.map((guia, i) => (
              <div key={guia.id_guia} className="flex flex-col gap-2">
                <div className="relative group rounded-xl overflow-hidden aspect-[4/5] border border-surface-light bg-black/50">
                  <img src={guia.archivo_url} alt={`Guia ${i+1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-[10px] font-bold font-mono text-white">
                    Guía {i+1}
                  </div>
                  {deletingId === guia.id_guia ? (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleDelete(guia.id_guia, guia.archivo_url)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                      title="Eliminar Guía"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <input 
                  type="text"
                  placeholder="Tags (ej: Arroz, Salmon)"
                  defaultValue={guia.comentario || ''}
                  onBlur={async (e) => {
                    const val = e.target.value;
                    const { error } = await supabase.from('guias_remision').update({ comentario: val }).eq('id_guia', guia.id_guia);
                    if (error) console.error('Error updating comentario:', error);
                  }}
                  className="bg-surface-light/30 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-primary w-full"
                />
              </div>
            ))}
            
            <label className="relative flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors cursor-pointer group">
              <input 
                type="file" 
                multiple 
                accept="image/jpeg, image/png, application/pdf" // We might store jpg only ideally
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <>
                  <Loader2 size={32} className="animate-spin text-primary mb-2" />
                  <span className="text-xs font-bold text-primary">Subiendo...</span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <Upload size={24} className="text-primary" />
                  </div>
                  <span className="text-xs font-black text-white px-4 text-center tracking-tight">AGREGAR GUÍA</span>
                  <span className="text-[10px] text-text-muted mt-1">JPG, PNG</span>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="p-4 bg-surface-light/10 border-t border-surface-light flex justify-end">
          <Button onClick={onClose} className="font-bold">Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
