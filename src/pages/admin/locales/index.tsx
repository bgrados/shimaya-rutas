import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Plus, MapPin, Trash2, Edit2, CheckCircle, X, Phone, User, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

// Fix iconos Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center[0], center[1], zoom]);
  return null;
}

interface LocalBase {
  id_local_base: string;
  id_ruta_base: string | null;
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  contacto: string | null;
  orden: number | null;
  foto_url: string | null;
  created_at: string;
}

/* ───────────── Sub-componente EditForm ───────────── */
interface EditFormProps {
  local: LocalBase;
  onSave: (id: string, payload: Partial<LocalBase>) => Promise<void>;
  onCancel: () => void;
}

function EditForm({ local, onSave, onCancel }: EditFormProps) {
  const [nombre, setNombre] = useState(local.nombre || '');
  const [direccion, setDireccion] = useState(local.direccion || '');
  const [contacto, setContacto] = useState(local.contacto || '');
  const [telefono, setTelefono] = useState(local.telefono || '');
  const [latitud, setLatitud] = useState<number>(local.latitud ?? -12.0464);
  const [longitud, setLongitud] = useState<number>(local.longitud ?? -77.0428);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(local.foto_url || null);
  const markerRef = useRef<L.Marker>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFotoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setFotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!fotoFile) return local.foto_url;
    const fileExt = fotoFile.name.split('.').pop();
    const fileName = `local_${local.id_local_base}_${Date.now()}.${fileExt}`;
    const filePath = `locales/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('locales_fotos').upload(filePath, fotoFile);
    if (uploadError) {
      console.error('[EditForm] Error upload:', uploadError);
      return local.foto_url;
    }

    const { data } = supabase.storage.from('locales_fotos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const hasCoords = local.latitud !== null && local.latitud !== -12.0464;
  const zoom = hasCoords ? 16 : 11;

  const handleSearch = async () => {
    if (!direccion.trim()) {
      alert('Escribe una dirección o distrito para buscar en el mapa.');
      return;
    }
    setSearching(true);
    try {
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Lima, Peru')}&limit=1`
      );
      if (res.data?.length > 0) {
        setLatitud(parseFloat(res.data[0].lat));
        setLongitud(parseFloat(res.data[0].lon));
      } else {
        alert('No se encontró esa dirección. Intenta con el nombre del distrito.');
      }
    } catch {
      alert('Error de conexión al buscar dirección.');
    } finally {
      setSearching(false);
    }
  };

  const handleDragEnd = () => {
    if (markerRef.current) {
      const { lat, lng } = markerRef.current.getLatLng();
      setLatitud(lat);
      setLongitud(lng);
    }
  };

  const handleSave = async () => {
    // 1. Validaciones básicas
    if (!nombre.trim()) {
      alert('El nombre del local es obligatorio.');
      return;
    }

    // 2. Validación de Teléfono (Opcional)
    if (telefono.trim()) {
      const phoneRegex = /^[0-9+() -]{7,15}$/;
      if (!phoneRegex.test(telefono.trim())) {
        alert('El formato del teléfono no es válido (mínimo 7 dígitos).');
        return;
      }
    }

    setSaving(true);
    try {
      const photoUrl = await uploadPhoto();
      await onSave(local.id_local_base, {
        nombre: nombre.trim(),
        direccion: direccion.trim() || null,
        contacto: contacto.trim() || null,
        telefono: telefono.trim() || null,
        latitud,
        longitud,
        foto_url: photoUrl,
      });
    } catch (err: any) {
      console.error('[EditForm] Error handleSave:', err);
      alert('Error inesperado al intentar guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
          <Edit2 size={14} /> Editando: {local.nombre}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Izquierda: Formulario */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Nombre del Local *</label>
            <Input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="bg-surface-light border-primary/30 text-white text-sm"
              placeholder="Ej. Tienda Central"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Dirección del Local</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej. Minka, Callao..."
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                className="flex-1 bg-surface-light border-white/10 text-white text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSearch}
                disabled={searching}
                className="bg-primary/20 text-primary hover:bg-primary/30 shrink-0"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span className="ml-1">{searching ? '' : 'Ubicar'}</span>
              </Button>
            </div>
            <p className="text-[10px] text-text-muted mt-1 italic">
              * Escribe el nombre del local o distrito y presiona Ubicar para ver en el mapa →
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Contacto (Opcional)</label>
              <Input
                value={contacto}
                onChange={e => setContacto(e.target.value)}
                className="bg-surface-light border-white/10 text-white text-sm"
                placeholder="Nombre persona"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Teléfono (Opcional)</label>
              <Input
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                className="bg-surface-light border-white/10 text-white text-sm"
                placeholder="987654321"
                type="tel"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
             <label className="text-[10px] text-text-muted mb-1 block uppercase font-bold tracking-tighter">Imagen de Fondo</label>
             <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoChange} />
             
             {fotoPreview ? (
               <div className="relative rounded-lg overflow-hidden border border-white/10 group h-20">
                 <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Button type="button" variant="ghost" size="sm" className="text-white text-[10px]" onClick={() => fileInputRef.current?.click()}>CAMBIAR FOTO</Button>
                 </div>
               </div>
             ) : (
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full h-20 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-text-muted hover:text-white transition-colors"
               >
                 <Plus size={16} />
                 <span className="text-[10px] font-bold">AÑADIR FOTO</span>
               </button>
             )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-white/5">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !nombre.trim()}
              className="bg-green-600 hover:bg-green-700 flex-1 disabled:opacity-50"
            >
              {saving
                ? <><Loader2 size={14} className="mr-2 animate-spin" /> Guardando...</>
                : <><CheckCircle size={14} className="mr-2" /> Guardar y Cerrar</>
              }
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="px-4">
              <X size={14} className="mr-1" /> Cancelar
            </Button>
          </div>
        </div>

        {/* Derecha: Mapa */}
        <div className="bg-surface-light/30 rounded-xl p-3 border border-surface-light flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-muted">Ubicación en el mapa</label>
            <span className="font-mono text-[9px] text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
              {latitud.toFixed(5)}, {longitud.toFixed(5)}
            </span>
          </div>

          <div className="h-[230px] rounded-lg overflow-hidden border border-surface-light relative z-0">
            <MapContainer
              center={[latitud, longitud]}
              zoom={zoom}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
            >
              <ChangeView center={[latitud, longitud]} zoom={zoom} />
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker
                draggable={true}
                eventHandlers={{ dragend: handleDragEnd }}
                position={[latitud, longitud]}
                ref={markerRef}
              />
            </MapContainer>
          </div>
          <p className="text-[10px] text-text-muted leading-tight">
            * Puedes arrastrar el pin para ajustar la posición exacta del local.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Página principal LocalesBase ───────────── */
export default function LocalesBase() {
  const navigate = useNavigate();
  const [locales, setLocales] = useState<LocalBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('locales_base').select('*').order('nombre');
    if (data) setLocales(data as LocalBase[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (id: string, payload: Partial<LocalBase>) => {
    console.log('[LocalesBase] saveEdit →', id, payload);
    const { data, error } = await supabase
      .from('locales_base')
      .update(payload)
      .eq('id_local_base', id)
      .select()
      .single();

    if (error) {
      console.error('[LocalesBase] Error al guardar:', error);
      alert('Error al guardar: ' + (error.message || JSON.stringify(error)));
      return;
    }

    console.log('[LocalesBase] Guardado OK:', data);
    setLocales(prev => prev.map(l => l.id_local_base === id ? { ...l, ...(data as LocalBase) } : l));
    setEditId(null);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);

    const { error } = await supabase.from('locales_base').delete().eq('id_local_base', id);

    if (!error) {
      setLocales(prev => prev.filter(l => l.id_local_base !== id));
    } else if (error.code === '23503') {
      const forzar = confirm(
        `⚠️ "${nombre}" tiene historial de viajes.\n\n` +
        `Podemos desvincularlo del historial (los reportes no se pierden) y luego eliminarlo.\n\n` +
        `¿Deseas forzar la eliminación?`
      );
      if (forzar) {
        const { error: unlinkErr } = await supabase
          .from('locales_ruta')
          .update({ id_local_base: null })
          .eq('id_local_base', id);

        if (unlinkErr) {
          alert('No se pudo desvincular el historial: ' + unlinkErr.message);
        } else {
          const { error: delErr } = await supabase.from('locales_base').delete().eq('id_local_base', id);
          if (!delErr) {
            setLocales(prev => prev.filter(l => l.id_local_base !== id));
          } else {
            alert('Error al eliminar: ' + delErr.message);
          }
        }
      }
    } else {
      alert('Error: ' + error.message);
    }

    setDeletingId(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-text-muted">
      <Loader2 size={20} className="animate-spin" /> Cargando locales...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Locales Base</h1>
          <p className="text-text-muted text-sm">{locales.length} locales registrados</p>
        </div>
        <Button
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover"
          onClick={() => navigate('/admin/locales/nuevo')}
        >
          <Plus size={18} /> Nuevo Local
        </Button>
      </div>

      {locales.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
          <MapPin size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-text-muted italic">No hay locales registrados. ¡Agrega el primero!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {locales.map(local => (
            <Card
              key={local.id_local_base}
              className={`relative border-surface-light/50 transition-all group overflow-hidden ${
                editId === local.id_local_base
                  ? 'col-span-full ring-2 ring-primary/40 shadow-xl shadow-primary/10'
                  : 'hover:border-primary/20'
              }`}
            >
              {local.foto_url && editId !== local.id_local_base && (
                <div className="absolute inset-0 z-0">
                  <img src={local.foto_url} alt="" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
                </div>
              )}
              
              <CardContent className="p-5 relative z-10">
                {editId === local.id_local_base ? (
                  <EditForm
                    local={local}
                    onSave={handleSave}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  /* ---- MODO VISTA ---- */
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="bg-primary/20 p-2 rounded-lg text-primary flex-shrink-0 mt-0.5">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-white italic truncate">{local.nombre}</h3>
                          {local.direccion && (
                            <p className="text-text-muted text-xs mt-0.5 line-clamp-2">{local.direccion}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => setEditId(local.id_local_base)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(local.id_local_base, local.nombre)}
                          disabled={deletingId === local.id_local_base}
                          className="p-1.5 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Eliminar"
                        >
                          {deletingId === local.id_local_base
                            ? <Loader2 size={15} className="animate-spin" />
                            : <Trash2 size={15} />
                          }
                        </button>
                      </div>
                    </div>

                    {(local.contacto || local.telefono) && (
                      <div className="border-t border-white/5 pt-3 mt-3 space-y-1">
                        {local.contacto && (
                          <p className="text-xs text-text-muted flex items-center gap-1.5">
                            <User size={11} className="text-primary/60" /> {local.contacto}
                          </p>
                        )}
                        {local.telefono && (
                          <p className="text-xs text-text-muted flex items-center gap-1.5">
                            <Phone size={11} className="text-primary/60" /> {local.telefono}
                          </p>
                        )}
                      </div>
                    )}

                    {local.latitud && (
                      <p className="text-[10px] text-text-muted/50 font-mono mt-3">
                        📍 {local.latitud.toFixed(4)}, {local.longitud?.toFixed(4)}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
