import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { LocalRuta, EstadoVisita } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Camera, MapPin, ArrowLeft, CheckCircle2, Navigation } from 'lucide-react';
import { format } from 'date-fns';

export default function VisitaLocal() {
  const { rId, vId } = useParams<{ rId: string; vId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [local, setLocal] = useState<LocalRuta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [observacion, setObservacion] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [gps, setGps] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    async function fetchLocal() {
      if (!vId) return;
      const { data, error } = await supabase.from('locales_ruta').select('*').eq('id_local_ruta', vId).single();
      if (!error && data) {
        setLocal(data as LocalRuta);
        setObservacion(data.observacion || '');
        if (data.foto_url) setFotoPreview(data.foto_url);
      }
      setLoading(false);
    }
    fetchLocal();
  }, [vId]);

  const handleLlegada = async () => {
    setSaving(true);
    
    // Obtener GPS y guardar de INMEDIATO
    let currentGps = gps;
    if (!currentGps && 'geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        currentGps = { lat: position.coords.latitude, lng: position.coords.longitude };
        setGps(currentGps);
      } catch (err) {
        console.warn("GPS falló o denegado durante llegada.", err);
      }
    }

    const now = new Date().toISOString();
    await supabase.from('locales_ruta').update({
      hora_llegada: now,
      estado_visita: 'pendiente',
      ...(currentGps ? { gps_lat: currentGps.lat, gps_lng: currentGps.lng } : {})
    }).eq('id_local_ruta', vId);
    
    setLocal(prev => prev ? { ...prev, hora_llegada: now } : null);
    setSaving(false);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFotoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!fotoFile || !vId) return null;
    const fileExt = fotoFile.name.split('.').pop();
    const fileName = `${vId}_${Date.now()}.${fileExt}`;
    const filePath = `visitas/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('visitas_fotos').upload(filePath, fotoFile);
    
    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('visitas_fotos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFinalizar = async (estado: EstadoVisita) => {
    setSaving(true);
    const now = new Date().toISOString();
    
    let photoUrl = local?.foto_url;
    if (fotoFile) {
      const uploadedUrl = await uploadPhoto();
      if (uploadedUrl) photoUrl = uploadedUrl;
    }

    const updates = {
      estado_visita: estado,
      observacion,
      foto_url: photoUrl,
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
              <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={16}/> {format(new Date(local.hora_llegada), 'HH:mm')}</span>
            ) : (
              <span className="text-yellow-500">No registrada</span>
            )}
          </div>
          
          {!local.hora_llegada && (
            <Button className="w-full flex items-center justify-center gap-2" size="lg" onClick={handleLlegada} isLoading={saving}>
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
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Camera size={18} className="text-primary"/> Fotografía</h3>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handlePhotoCapture} 
          />
          
          {fotoPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-surface-light group">
              <img src={fotoPreview} alt="Evidencia" className="w-full h-48 object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Cambiar foto</Button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-surface-light hover:border-primary rounded-xl flex flex-col items-center justify-center text-text-muted hover:text-white transition-colors gap-2"
            >
              <Camera size={32} />
              <span className="text-sm font-medium">Tomar foto de evidencia</span>
            </button>
          )}
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
