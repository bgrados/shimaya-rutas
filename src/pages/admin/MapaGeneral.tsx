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

  const ROUTE_COLORS: Record<string, string> = {
    'negra':    '#64748b',
    'guinda':   '#ef4444',
    'verde':    '#22c55e',
    'amarilla': '#eab308',
  };

  const getRouteColor = (nombre: string): string => {
    const n = nombre.toLowerCase();
    for (const [key, color] of Object.entries(ROUTE_COLORS)) {
      if (n.includes(key)) return color;
    }
    // Fallback por zona - orden importante: amarilla antes de este/verde
    if (n.includes('norte')) return '#64748b';
    if (n.includes('sur'))   return '#ef4444';
    if (n.includes('amarilla')) return '#eab308';
    if (n.includes('verde')) return '#22c55e';
    if (n.includes('este'))  return '#22c55e';
    if (n.includes('oeste') || n.includes('centro')) return '#eab308';
    // Color aleatorio para rutas no reconocidas
    const hash = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 55%)`;
  };

  const createCustomIcon = (color: string, nombre?: string) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 10px ${color}88;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: bold;
          color: white;
        ">${nombre ? nombre.substring(0, 2).toUpperCase() : ''}</div>
      `,
      className: 'custom-div-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  const createPlantaIcon = () => {
    return L.divIcon({
      html: `
        <div style="
          background-color: #3b82f6;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 15px #3b82f688;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          color: white;
        ">P</div>
      `,
      className: 'custom-div-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  const createCerradoIcon = () => {
    return L.divIcon({
      html: `
        <div style="
          background-color: #ef4444;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 12px #ef444488;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: white;
        ">X</div>
      `,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [rutasRes, localesRes] = await Promise.all([
          supabase.from('rutas_base').select('*'),
          supabase
            .from('locales_base')
            .select('*')
            .not('latitud', 'is', null)
            .not('longitud', 'is', null)
            .order('orden', { ascending: true })
        ]);

        if (rutasRes.error) console.error('[Mapa] Error rutas:', rutasRes.error);
        if (localesRes.error) console.error('[Mapa] Error locales:', localesRes.error);

        if (rutasRes.data) setRutasBase(rutasRes.data);
        if (localesRes.data) {
          console.log(`[Mapa] Locales cargados: ${localesRes.data.length}`);
          setLocales(localesRes.data);
        }
      } catch (err) {
        console.error('[Mapa] Error loading map data', err);
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

  const routesData = rutasBase.map(ruta => {
    const color = getRouteColor(ruta.nombre);
    const routeLocales = locales
      .filter(l => l.id_ruta_base === ruta.id_ruta_base)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const positions = routeLocales
      .filter(l => l.latitud && l.longitud)
      .map(l => [l.latitud, l.longitud] as [number, number]);

    return {
      ...ruta,
      locales: routeLocales,
      positions,
      color,
    };
  });

  const unassignedLocales = locales.filter(l => !l.id_ruta_base);
  const unassignedColor = '#94a3b8';
  
  // Separar planta de locales cerrados temporalmente usando la columna cerrado_temporal
  const plantaLocal = unassignedLocales.find(l => l.nombre?.toLowerCase().includes('planta'));
  const cerradosTemporales = locales.filter(l => l.cerrado_temporal === true);

  // Leyenda dinámica basada en rutas reales
  const leyenda = rutasBase.map(r => ({
    nombre: r.nombre,
    color: getRouteColor(r.nombre),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 uppercase italic tracking-tighter">
            <MapIcon className="text-primary" /> Visualización de Red Logística
          </h1>
          <p className="text-text-muted text-sm">
            Mostrando <span className="text-white font-bold">{locales.length}</span> locales en{' '}
            <span className="text-white font-bold">{rutasBase.length}</span> rutas base
          </p>
        </div>

        {/* Leyenda dinámica */}
        <div className="flex flex-wrap gap-3">
          {leyenda.map(r => (
            <div key={r.nombre} className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }}></div>
              <span className="text-[10px] font-bold text-white uppercase italic">{r.nombre}</span>
            </div>
          ))}
          {unassignedLocales.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">P</span>
              <span className="text-[10px] font-bold text-white uppercase italic">PLANTA</span>
            </div>
          )}
          {cerradosTemporales.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-light/30 px-3 py-1.5 rounded-full border border-white/5">
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">X</span>
              <span className="text-[10px] font-bold text-white uppercase italic">CERRADO</span>
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

          {routesData.map(route => (
            <React.Fragment key={route.id_ruta_base}>
              {route.positions.length > 1 && (
                <Polyline
                  positions={route.positions}
                  pathOptions={{ color: route.color, weight: 3, opacity: 0.6, dashArray: '10, 10' }}
                />
              )}
              {route.locales.map(local =>
                local.latitud && local.longitud ? (
                  <Marker
                    key={local.id_local_base}
                    position={[local.latitud, local.longitud]}
                    icon={createCustomIcon(route.color, local.nombre)}
                  >
                    <Popup>
                      <div className="p-1">
                        {local.foto_url && (
                          <img 
                            src={local.foto_url} 
                            alt={local.nombre}
                            style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px', display: 'block', opacity: 0.85 }}
                          />
                        )}
                        <h4 style={{ fontWeight: 'bold', color: '#111', fontSize: '12px', marginBottom: '4px', borderBottom: '1px solid #eee', paddingBottom: '2px' }}>{local.nombre}</h4>
                        <p style={{ fontSize: '10px', color: '#333', marginBottom: '4px', lineHeight: '1.2' }}>{local.direccion}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ background: '#ddd', color: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold' }}>Orden #{local.orden}</span>
                          <span style={{ background: '#f0f0f0', color: '#333', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold' }}>{route.nombre}</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </React.Fragment>
          ))}

          {/* PLANTA - solo si existe */}
          {plantaLocal && plantaLocal.latitud && plantaLocal.longitud && (
            <Marker
              key={plantaLocal.id_local_base}
              position={[plantaLocal.latitud, plantaLocal.longitud]}
              icon={createPlantaIcon()}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-gray-900">{plantaLocal.nombre}</h4>
                  <p className="text-[10px] text-gray-600 mb-1">{plantaLocal.direccion}</p>
                  <p className="text-[10px] text-blue-600 font-bold">PLANTA - Inicio y Fin de todas las rutas</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Locales cerrados temporalmente */}
          {cerradosTemporales.map(local =>
            local.latitud && local.longitud ? (
              <Marker
                key={local.id_local_base}
                position={[local.latitud, local.longitud]}
                icon={createCerradoIcon()}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-gray-900">{local.nombre}</h4>
                    <p className="text-[10px] text-gray-600 mb-1">{local.direccion}</p>
                    <p className="text-[10px] text-red-600 font-bold">⚠️ CERRADO TEMPORALMENTE</p>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}
        </MapContainer>

        <div className="absolute bottom-6 right-6 z-[1000] bg-surface/90 backdrop-blur-md p-4 rounded-xl border border-surface-light shadow-xl text-white max-w-[200px]">
          <h4 className="text-[10px] font-black uppercase italic tracking-widest text-primary mb-2 flex items-center gap-1">
            <Info size={12} /> Información de Red
          </h4>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] text-text-muted">Locales en mapa:</span>
              <span className="text-[9px] font-bold">{locales.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-text-muted">Zonas Activas:</span>
              <span className="text-[9px] font-bold">{rutasBase.length}</span>
            </div>
            {unassignedLocales.length > 0 && (
              <div className="flex justify-between">
                <span className="text-[9px] text-text-muted">PLANTA:</span>
                <span className="text-[9px] font-bold text-yellow-400">{unassignedLocales.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
