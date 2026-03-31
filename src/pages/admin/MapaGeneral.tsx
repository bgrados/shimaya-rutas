import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import type { RutaBase, LocalBase } from '../../types';
import { Loader2, Map as MapIcon, Info } from 'lucide-react';

export default function MapaGeneral() {
  const [rutasBase, setRutasBase] = useState<RutaBase[]>([]);
  const [locales, setLocales] = useState<LocalBase[]>([]);
  const [loading, setLoading] = useState(true);

  const getRouteColor = (nombre: string) => {
    const n = nombre.toLowerCase();
    if (n.includes('norte')) return '#64748b'; // Slate 500
    if (n.includes('sur')) return '#ef4444';   // Red 500
    if (n.includes('este')) return '#22c55e';  // Green 500
    if (n.includes('oeste') || n.includes('centro')) return '#eab308'; // Yellow 500
    return '#ffffff';
  };

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 15px ${color}88;
        "></div>
      `,
      className: 'custom-div-icon',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [rutasRes, localesRes] = await Promise.all([
          supabase.from('rutas_base').select('*'),
          supabase.from('locales_base').select('*').order('orden', { ascending: true })
        ]);

        if (rutasRes.data) setRutasBase(rutasRes.data);
        if (localesRes.data) setLocales(localesRes.data);
      } catch (err) {
        console.error("Error loading map data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="animate-pulse font-bold uppercase tracking-widest italic">Cargando Mapa de Lima...</p>
      </div>
    );
  }

  // Process routes
  const routesData = rutasBase.map(ruta => {
    const routeLocales = locales
      .filter(l => l.id_ruta_base === ruta.id_ruta_base)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
    
    // Create polyline coordinates
    const positions = routeLocales
      .filter(l => l.latitud && l.longitud)
      .map(l => [l.latitud, l.longitud] as [number, number]);

    const color = getRouteColor(ruta.nombre);

    return {
      ...ruta,
      locales: routeLocales,
      positions,
      color,
      icon: createCustomIcon(color)
    };
  });

  // Locales without route
  const unassignedLocales = locales.filter(l => !l.id_ruta_base);
  const unassignedColor = '#94a3b8'; // Slate 400
  const unassignedIcon = createCustomIcon(unassignedColor);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 uppercase italic tracking-tighter">
            <MapIcon className="text-primary" /> Visualización de Red Logística
          </h1>
          <p className="text-text-muted text-sm">
            Mostrando <span className="text-white font-bold">{locales.length}</span> locales en <span className="text-white font-bold">{rutasBase.length}</span> rutas base
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#64748b]"></div>
            <span className="text-[10px] font-bold text-white uppercase italic">Norte</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
            <span className="text-[10px] font-bold text-white uppercase italic">Sur</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
            <span className="text-[10px] font-bold text-white uppercase italic">Este</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
            <span className="text-[10px] font-bold text-white uppercase italic">O/C</span>
          </div>
          {unassignedLocales.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-3 h-3 rounded-full bg-[#94a3b8]"></div>
              <span className="text-[10px] font-bold text-white uppercase italic">S/R</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-[75vh] w-full rounded-2xl overflow-hidden border-2 border-surface-light shadow-2xl relative z-0 bg-surface">
        <MapContainer
          center={[-12.08, -77.03]}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Assigned routes */}
          {routesData.map(route => (
            <React.Fragment key={route.id_ruta_base}>
              {route.positions.length > 1 && (
                <Polyline
                  positions={route.positions}
                  pathOptions={{ color: route.color, weight: 3, opacity: 0.6, dashArray: '10, 10' }}
                />
              )}

              {route.locales.map(local => (
                local.latitud && local.longitud && (
                  <Marker 
                    key={local.id_local_base} 
                    position={[local.latitud, local.longitud]}
                    icon={route.icon}
                  >
                    <Popup className="custom-popup">
                      <div className="p-1">
                        <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">{local.nombre}</h4>
                        <p className="text-[10px] text-gray-600 mb-2 leading-tight">{local.direccion}</p>
                        <div className="flex items-center justify-between">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-black italic uppercase">
                            Orden #{local.orden}
                          </span>
                          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase italic">
                            {route.nombre}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}
            </React.Fragment>
          ))}

          {/* Unassigned Locales */}
          {unassignedLocales.map(local => (
            local.latitud && local.longitud && (
              <Marker 
                key={local.id_local_base} 
                position={[local.latitud, local.longitud]}
                icon={unassignedIcon}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-gray-900">{local.nombre}</h4>
                    <p className="text-[10px] text-gray-600">Local sin ruta asignada</p>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
        
        <div className="absolute bottom-6 right-6 z-[1000] bg-surface/90 backdrop-blur-md p-4 rounded-xl border border-surface-light shadow-xl text-white max-w-[200px]">
          <h4 className="text-[10px] font-black uppercase italic tracking-widest text-primary mb-2 flex items-center gap-1">
            <Info size={12} /> Información de Red
          </h4>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Se visualizan todas las locaciones base y sus tramos de conexión teóricos según el orden de visita.
          </p>
          <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] text-text-muted">Locales Totales:</span>
              <span className="text-[9px] font-bold">{locales.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-text-muted">Zonas Activas:</span>
              <span className="text-[9px] font-bold">{rutasBase.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
