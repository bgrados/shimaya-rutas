import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import type { RutaBase, LocalBase } from '../../types';
import { Loader2, Map as MapIcon, Info, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function MapaGeneral() {
  const [rutasBase, setRutasBase] = useState<RutaBase[]>([]);
  const [locales, setLocales] = useState<LocalBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(true);
  const [plantaLocation, setPlantaLocation] = useState<{ lat: number; lng: number } | null>(null);

  const ROUTE_COLORS: Record<string, string> = {
    'negra': '#64748b',
    'guinda': '#ef4444',
    'verde': '#22c55e',
    'amarilla': '#eab308',
  };

  const getRouteColor = (nombre: string): string => {
    const n = nombre.toLowerCase();
    for (const [key, color] of Object.entries(ROUTE_COLORS)) {
      if (n.includes(key)) return color;
    }
    const hash = nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 55%)`;
  };

  // Nuevo: crear icono con número de orden
  const createNumberedIcon = (color: string, order: number) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 10px ${color}88;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: white;
        ">${order}</div>
      `,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
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

        if (rutasRes.data) {
          setRutasBase(rutasRes.data);
          const stored = localStorage.getItem('mapa_visible_routes');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const visibleSet = new Set(parsed);
              setVisibleRoutes(visibleSet);
              setShowAll(visibleSet.size === rutasRes.data.length);
            } catch (e) {
              const allIds = rutasRes.data.map((r: RutaBase) => r.id_ruta_base);
              setVisibleRoutes(new Set(allIds));
              setShowAll(true);
            }
          } else {
            const allIds = rutasRes.data.map((r: RutaBase) => r.id_ruta_base);
            setVisibleRoutes(new Set(allIds));
            setShowAll(true);
          }
        }
        if (localesRes.data) {
          setLocales(localesRes.data);
          // Buscar Planta
          const planta = localesRes.data.find(l => l.nombre?.toLowerCase().includes('planta'));
          if (planta?.latitud && planta?.longitud) {
            setPlantaLocation({ lat: planta.latitud, lng: planta.longitud });
          }
        }
      } catch (err) {
        console.error('[Mapa] Error loading map data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (rutasBase.length > 0 && visibleRoutes.size > 0) {
      localStorage.setItem('mapa_visible_routes', JSON.stringify([...visibleRoutes]));
    }
  }, [visibleRoutes, rutasBase]);

  const toggleRoute = (routeId: string) => {
    setVisibleRoutes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(routeId)) {
        newSet.delete(routeId);
      } else {
        newSet.add(routeId);
      }
      setShowAll(newSet.size === rutasBase.length);
      return newSet;
    });
  };

  const toggleAllRoutes = () => {
    if (showAll) {
      setVisibleRoutes(new Set());
      setShowAll(false);
    } else {
      const allIds = rutasBase.map(r => r.id_ruta_base);
      setVisibleRoutes(new Set(allIds));
      setShowAll(true);
    }
  };

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

    // 🔥 MEJORA: Agregar retorno a Planta si existe
    let fullPositions = [...positions];
    let returnToPlanta = false;
    if (plantaLocation && positions.length > 0) {
      fullPositions.push([plantaLocation.lat, plantaLocation.lng]);
      returnToPlanta = true;
    }

    return {
      ...ruta,
      locales: routeLocales,
      positions: fullPositions,
      originalPositions: positions,
      returnToPlanta,
      color,
      visible: visibleRoutes.has(ruta.id_ruta_base),
    };
  });

  const unassignedLocales = locales.filter(l => !l.id_ruta_base);
  const plantaLocal = unassignedLocales.find(l => l.nombre?.toLowerCase().includes('planta'));
  const cerradosTemporales = locales.filter(l => l.cerrado_temporal === true);
  const visibleRoutesCount = routesData.filter(r => r.visible).length;

  const leyenda = rutasBase.map(r => ({
    nombre: r.nombre,
    color: getRouteColor(r.nombre),
    visible: visibleRoutes.has(r.id_ruta_base),
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
          <p className="text-text-muted text-xs mt-1">
            💡 Los números en los marcadores indican el <span className="text-primary">orden de visita</span>.
            La línea punteada muestra el <span className="text-primary">retorno a Planta</span>.
          </p>
        </div>

        <div className="bg-surface-light/30 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted uppercase font-bold">Filtrar rutas</span>
            <button
              onClick={toggleAllRoutes}
              className="text-[10px] text-primary hover:text-primary-light flex items-center gap-1"
            >
              {showAll ? <EyeOff size={12} /> : <Eye size={12} />}
              {showAll ? 'Ocultar todas' : 'Mostrar todas'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-w-md">
            {leyenda.map(r => (
              <button
                key={r.nombre}
                onClick={() => {
                  const route = rutasBase.find(rb => rb.nombre === r.nombre);
                  if (route) toggleRoute(route.id_ruta_base);
                }}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all text-[10px] font-bold ${r.visible
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-text-muted opacity-50'
                  }`}
              >
                {r.visible ? <CheckSquare size={12} /> : <Square size={12} />}
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="uppercase italic">{r.nombre}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-text-muted">
            Mostrando {visibleRoutesCount} de {rutasBase.length} rutas
          </div>
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

          {routesData.map(route => route.visible && (
            <React.Fragment key={route.id_ruta_base}>
              {/* Línea de ruta (ida + retorno a Planta) */}
              {route.positions.length > 1 && (
                <Polyline
                  positions={route.positions}
                  pathOptions={{
                    color: route.color,
                    weight: 3,
                    opacity: 0.6,
                    dashArray: route.returnToPlanta ? '10, 10' : undefined
                  }}
                />
              )}
              {/* Marcadores con número de orden */}
              {route.locales.map((local, idx) =>
                local.latitud && local.longitud ? (
                  <Marker
                    key={local.id_local_base}
                    position={[local.latitud, local.longitud]}
                    icon={createNumberedIcon(route.color, idx + 1)}
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

          {/* PLANTA */}
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
                  <p className="text-[10px] text-blue-600 font-bold">🏭 PLANTA - Inicio y Fin de todas las rutas</p>
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

        <div className="absolute bottom-6 right-6 z-[1000] bg-surface/90 backdrop-blur-md p-4 rounded-xl border border-surface-light shadow-xl text-white max-w-[220px]">
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
              <span className="text-[9px] font-bold">{visibleRoutesCount}</span>
            </div>
            {plantaLocal && (
              <div className="flex justify-between">
                <span className="text-[9px] text-text-muted">PLANTA:</span>
                <span className="text-[9px] font-bold text-yellow-400">1</span>
              </div>
            )}
            {cerradosTemporales.length > 0 && (
              <div className="flex justify-between">
                <span className="text-[9px] text-text-muted">Cerrados:</span>
                <span className="text-[9px] font-bold text-red-400">{cerradosTemporales.length}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-white/10 text-[8px] text-text-muted">
            🔢 Números = Orden de visita<br />
            ⬚ Línea punteada = Retorno a Planta
          </div>
        </div>
      </div>
    </div>
  );
}
