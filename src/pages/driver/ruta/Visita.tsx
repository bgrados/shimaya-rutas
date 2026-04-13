import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { LocalRuta, EstadoVisita, FotoVisita } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Camera, MapPin, ArrowLeft, CheckCircle2, Navigation, X, Loader2, Image } from 'lucide-react';
import { format } from 'date-fns';
import { formatPeru } from '../../../lib/timezone';

interface PhotoItem {
  preview: string;
  file: File;
  uploading?: boolean;
}

const MAX_PHOTOS = 5;
const TARGET_WIDTH = 1200;

function compressToWebP(file: File): Promise<Blob> {
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
        if (!ctx) {
          reject(new Error('No se pudo crear el contexto'));
          return;
        }
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
}

export default function VisitaLocal() {
  const { rId, vId } = useParams<{ rId: string; vId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [local, setLocal] = useState<LocalRuta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [observacion, setObservacion] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<FotoVisita[]>([]);
  const [gps, setGps] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    async function fetchLocal() {
      if (!vId) return;
      const { data, error } = await supabase.from('locales_ruta').select('*').eq('id_local_ruta', vId).single();
      if (!error && data) {
        setLocal(data as LocalRuta);
        setObservacion(data.observacion || '');
      }
      setLoading(false);
    }
    fetchLocal();
  }, [vId]);

  useEffect(() => {
    async function fetchExistingPhotos() {
      if (!vId) return;
      const { data } = await supabase
        .from('fotos_visita')
        .select('*')
        .eq('id_local_ruta', vId)
        .order('orden', { ascending: true });
      if (data) setExistingPhotos(data as FotoVisita[]);
    }
    fetchExistingPhotos();
  }, [vId]);

  const totalPhotos = photos.length + existingPhotos.length;

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newPhoto: PhotoItem = {
          preview: ev.target?.result as string,
          file,
        };
        setPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingPhoto = async (id_foto: string) => {
    try {
      await supabase.from('fotos_visita').delete().eq('id_foto', id_foto);
      setExistingPhotos(prev => prev.filter(p => p.id_foto !== id_foto));
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  const uploadPhoto = async (file: File, orden: number): Promise<string | null> => {
    try {
      const compressedBlob = await compressToWebP(file);
      const fileName = `${vId}_${Date.now()}_${orden}.webp`;
      const filePath = `evidencia/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('visitas_fotos')
        .upload(filePath, compressedBlob, { contentType: 'image/webp' });

      if (uploadError) {
        console.error('Error uploading:', uploadError);
        return null;
      }

      const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error('Error compressing/uploading:', err);
      return null;
    }
  };

  const handleFinalizar = async (estado: EstadoVisita) => {
    if (estado === 'visitado' && photos.length === 0 && existingPhotos.length === 0) {
      alert('Para marcar como "visitado" debes agregar al menos una foto como evidencia.');
      return;
    }

    setSaving(true);
    const now = nowPeru();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const orden = existingPhotos.length + i + 1;
      const url = await uploadPhoto(photo.file, orden);
      if (url) {
        await supabase.from('fotos_visita').insert({
          id_local_ruta: vId,
          foto_url: url,
          orden,
        });
      }
    }

    const updates = {
      estado_visita: estado,
      observacion,
      ...(gps ? { gps_lat: gps.lat, gps_lng: gps.lng } : {}),
      hora_salida: now
    };

    await supabase.from('locales_ruta').update(updates).eq('id_local_ruta', vId);
    navigate(`/driver/ruta/${rId}`);
  };

  if (loading) return <div className="text-white p-4 text-center mt-10">Cargando datos del local...</div>;
  if (!local) return <div className="text-white p-4 text-center mt-10">Local no encontrado</div>;

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="p-2 -ml-2 h-auto" onClick={() => navigate(`/driver/ruta/${rId}`)}>
          <ArrowLeft size={24} />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">{local.nombre}</h1>
          <p className="text-sm text-text-muted">{local.direccion}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-text-muted">Llegada registrada:</span>
            {local.hora_llegada ? (
              <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={16}/> {formatPeru(local.hora_llegada, 'HH:mm')}</span>
            ) : (
              <span className="text-yellow-500">No registrada</span>
            )}
          </div>
          
          {!local.hora_llegada && (
            <Button className="w-full flex items-center justify-center gap-2" size="lg" onClick={async () => {
              setSaving(true);
              let currentGps = gps;
              if (!currentGps && 'geolocation' in navigator) {
                try {
                  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
                  });
                  currentGps = { lat: position.coords.latitude, lng: position.coords.longitude };
                  setGps(currentGps);
                } catch (err) {
                  console.warn("GPS falló", err);
                  alert("No se pudo obtener tu ubicación. Igual se registrará la hora de llegada.");
                }
              }
              const now = nowPeru();
              await supabase.from('locales_ruta').update({
                hora_llegada: now,
                estado_visita: 'pendiente',
                ...(currentGps ? { gps_lat: currentGps.lat, gps_lng: currentGps.lng } : {})
              }).eq('id_local_ruta', vId);
              setLocal(prev => prev ? { ...prev, hora_llegada: now } : null);
              setSaving(false);
            }} isLoading={saving}>
              <MapPin size={20} /> Registrar Llegada a Local
            </Button>
          )}

          {local.latitud && local.longitud && (
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${local.latitud},${local.longitud}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold transition-colors"
            >
              <Navigation size={20} /> Ver ruta en Google Maps
            </a>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Camera size={18} className="text-primary"/> 
            📸 Evidencia Fotográfica (hasta 5 fotos)
            <span className="text-xs text-text-muted ml-2">({totalPhotos}/{MAX_PHOTOS})</span>
          </h3>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex items-center justify-center gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={totalPhotos >= MAX_PHOTOS}
            >
              <Camera size={16} />
              Cámara
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex items-center justify-center gap-1"
              onClick={() => galleryInputRef.current?.click()}
              disabled={totalPhotos >= MAX_PHOTOS}
            >
              <Image size={16} />
              Fototeca
            </Button>
          </div>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            multiple
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleAddPhoto}
            disabled={totalPhotos >= MAX_PHOTOS}
          />
          
          <input 
            type="file" 
            accept="image/*" 
            multiple
            ref={galleryInputRef} 
            className="hidden" 
            onChange={handleAddPhoto}
            disabled={totalPhotos >= MAX_PHOTOS}
          />
          
          <div className="grid grid-cols-3 gap-3">
            {existingPhotos.map((photo, idx) => (
              <div key={photo.id_foto} className="relative group aspect-square rounded-lg overflow-hidden border border-surface-light">
                <img src={photo.foto_url} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveExistingPhoto(photo.id_foto)}
                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            
            {photos.map((photo, idx) => (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-primary/50">
                <img src={photo.preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1"
                >
                  <X size={14} />
                </button>
                {photo.uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="text-white animate-spin" size={24} />
                  </div>
                )}
              </div>
            ))}

            {totalPhotos < MAX_PHOTOS && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-surface-light hover:border-primary rounded-lg flex flex-col items-center justify-center text-text-muted hover:text-white transition-colors gap-1"
              >
                <Camera size={20} />
                <span className="text-[10px] font-medium">Agregar</span>
              </button>
            )}
          </div>
        </div>

        <div>
           <label className="block text-sm font-medium text-white mb-2">Observaciones</label>
           <textarea
             className="w-full bg-surface border border-surface-light rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors min-h-[100px]"
             value={observacion}
             onChange={e => setObservacion(e.target.value)}
             placeholder="Alguna novedad durante la visita..."
           />
        </div>

        <div className="pt-6 border-t border-surface-light space-y-3">
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            size="lg" 
            isLoading={saving}
            onClick={() => handleFinalizar('visitado')}
            disabled={!local.hora_llegada}
          >
            <CheckCircle2 size={20} className="mr-2" /> Salida de Local (Finalizar)
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="secondary" 
              className="text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
              isLoading={saving}
              onClick={() => handleFinalizar('no_encontrado')}
            >
              No Encontrado
            </Button>
            <Button 
              variant="secondary" 
              className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
              isLoading={saving}
              onClick={() => handleFinalizar('cerrado')}
            >
              Cerrado
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}