import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { Search } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function NuevoLocal() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  
  // Default to somewhere readable if no location
  const [position, setPosition] = useState<[number, number]>([-12.0464, -77.0428]); // Lima default
  const [zoom, setZoom] = useState(11);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          setPosition([lat, lng]);
        }
      },
    }),
    [],
  );

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      if (res.data && res.data.length > 0) {
        const result = res.data[0];
        setPosition([parseFloat(result.lat), parseFloat(result.lon)]);
        setZoom(16);
        setDireccion(result.display_name.split(',').slice(0,2).join(','));
      } else {
        alert("Dirección no encontrada. Mueve el mapa manualmente.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al buscar dirección.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !direccion) {
      setError('Debes ingresar nombre y dirección.');
      return;
    }

    setLoadingSubmit(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('locales_base')
        .insert({
          nombre,
          direccion,
          contacto,
          telefono,
          latitud: position[0],
          longitud: position[1]
        });

      if (insertError) throw insertError;
      navigate('/admin/locales');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al registrar el local.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-white mb-6">Agregar Nuevo Local con Ubicación</h1>
      
      {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-white mb-4">Datos del Local</h2>
            <form id="local-form" onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre del Local"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Tienda Central"
                required
              />
              
              <Input
                label="Dirección Confirmada"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                required
              />

              <Input
                label="Persona de Contacto (Opcional)"
                value={contacto}
                onChange={e => setContacto(e.target.value)}
              />

              <Input
                label="Teléfono (Opcional)"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
              />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col pt-6">
            <h2 className="text-lg font-bold text-white mb-4">Geolocalización Automática</h2>
            
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                 <input 
                   type="text" 
                   placeholder="Buscar dirección, distrito o calle..." 
                   className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                 />
              </div>
              <Button type="button" onClick={handleSearch} disabled={isSearching} className="flex gap-2">
                 <Search size={20} /> Buscar
              </Button>
            </div>
            
            <p className="text-sm text-text-muted mb-2">
               * Mueve el marcador libremente en el mapa para ajustar la precisión.
            </p>

            <div className="h-[300px] rounded-xl overflow-hidden border border-surface-light relative z-0">
               <MapContainer 
                 center={position} 
                 zoom={zoom} 
                 scrollWheelZoom={true} 
                 style={{ height: "100%", width: "100%" }}
               >
                 <ChangeView center={position} zoom={zoom} />
                 <TileLayer
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 />
                  <Marker
                    draggable={true}
                    eventHandlers={eventHandlers}
                    position={position}
                    ref={markerRef}
                  />
               </MapContainer>
            </div>
            
            <div className="text-xs text-text-muted mt-2 text-right">
              Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3 mt-6">
         <Button type="button" variant="ghost" onClick={() => navigate('/admin/locales')}>
            Cancelar
         </Button>
         <Button type="submit" form="local-form" isLoading={loadingSubmit} className="bg-green-600 hover:bg-green-700">
            Guardar Local Geolocalizado
         </Button>
      </div>
    </div>
  );
}
