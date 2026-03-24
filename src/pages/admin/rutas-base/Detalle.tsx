import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { ArrowLeft, Plus, MapPin, Trash2, Edit2, CheckCircle, X, ChevronUp, ChevronDown, Zap } from 'lucide-react';

interface RutaBase { id_ruta_base: string; nombre: string; }
interface LocalBase { id_local_base: string; id_ruta_base: string; nombre: string; orden: number; }

// Locales predefinidos por tipo de ruta (clave = substring del nombre)
const LOCALES_PREDEFINIDOS: Record<string, string[]> = {
  'guinda': ['Puruchuco', 'Santa Anita', 'San Juan de Lurigancho', 'Los Olivos', 'Comas'],
  'negra':  ['Independencia', 'Los Olivos', 'San Martín de Porres', 'Carabayllo', 'Puente Piedra'],
  'verde':  ['Ate', 'La Molina', 'Surco', 'San Borja', 'Chorrillos'],
  'amarilla': ['Callao', 'Bellavista', 'La Perla', 'Carmen de la Legua', 'Ventanilla'],
};

function getLocalesPredefinidos(nombre: string): string[] {
  const lower = nombre.toLowerCase();
  for (const [key, locales] of Object.entries(LOCALES_PREDEFINIDOS)) {
    if (lower.includes(key)) return locales;
  }
  return [];
}

export default function DetalleRutaBase() {
  const { id } = useParams<{ id: string }>();
  const [ruta, setRuta] = useState<RutaBase | null>(null);
  const [locales, setLocales] = useState<LocalBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingPredefined, setLoadingPredefined] = useState(false);
  const [showPredefined, setShowPredefined] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>([]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [rutaRes, localesRes] = await Promise.all([
      supabase.from('rutas_base').select('*').eq('id_ruta_base', id).single(),
      supabase.from('locales_base').select('*').eq('id_ruta_base', id).order('orden', { ascending: true })
    ]);
    if (rutaRes.data) setRuta(rutaRes.data);
    if (localesRes.data) setLocales(localesRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Cargar locales predefinidos seleccionados
  const handleLoadPredefined = async () => {
    if (!id || selectedPredefined.length === 0) return;
    setLoadingPredefined(true);
    const maxOrden = locales.length > 0 ? Math.max(...locales.map(l => l.orden)) : 0;
    const nuevos = selectedPredefined.map((nombre, i) => ({
      id_ruta_base: id,
      nombre,
      orden: maxOrden + i + 1
    }));
    const { data, error } = await supabase.from('locales_base').insert(nuevos).select();
    if (!error && data) {
      setLocales([...locales, ...data]);
    } else {
      console.error('Error al cargar locales:', error);
    }
    setShowPredefined(false);
    setSelectedPredefined([]);
    setLoadingPredefined(false);
  };

  const togglePredefined = (nombre: string) => {
    setSelectedPredefined(prev =>
      prev.includes(nombre) ? prev.filter(n => n !== nombre) : [...prev, nombre]
    );
  };

  const handleAddLocal = async () => {
    if (!newLocalName.trim() || !id) return;
    const maxOrden = locales.length > 0 ? Math.max(...locales.map(l => l.orden)) : 0;
    const { data, error } = await supabase
      .from('locales_base')
      .insert({ id_ruta_base: id, nombre: newLocalName.trim(), orden: maxOrden + 1 })
      .select()
      .single();
    if (!error && data) {
      setLocales([...locales, data]);
      setNewLocalName('');
      setAdding(false);
    } else {
      alert('Error: ' + (error?.message || 'desconocido'));
    }
  };

  const handleDeleteLocal = async (localId: string) => {
    if (!confirm('¿Eliminar esta parada?')) return;
    const { error } = await supabase.from('locales_base').delete().eq('id_local_base', localId);
    if (!error) {
      const updated = locales
        .filter(l => l.id_local_base !== localId)
        .map((l, i) => ({ ...l, orden: i + 1 }));
      for (const l of updated) {
        await supabase.from('locales_base').update({ orden: l.orden }).eq('id_local_base', l.id_local_base);
      }
      setLocales(updated);
    }
  };

  const handleEditLocal = async (localId: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('locales_base').update({ nombre: editName.trim() }).eq('id_local_base', localId);
    if (!error) {
      setLocales(locales.map(l => l.id_local_base === localId ? { ...l, nombre: editName.trim() } : l));
      setEditId(null);
    }
  };

  const moveLocal = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= locales.length) return;
    const updated = [...locales];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    const reordered = updated.map((l, i) => ({ ...l, orden: i + 1 }));
    setLocales(reordered);
    for (const l of reordered) {
      await supabase.from('locales_base').update({ orden: l.orden }).eq('id_local_base', l.id_local_base);
    }
  };

  if (loading) return <div className="text-white italic animate-pulse py-10 text-center">Cargando...</div>;
  if (!ruta) return <div className="text-white">Ruta no encontrada.</div>;

  const predefinidos = getLocalesPredefinidos(ruta.nombre);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/rutas-base">
          <Button variant="ghost" className="p-2 h-auto text-text-muted hover:text-white">
            <ArrowLeft size={22} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">{ruta.nombre}</h1>
          <p className="text-text-muted text-sm">{locales.length} paradas configuradas</p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => { setAdding(true); setShowPredefined(false); }} className="bg-primary flex items-center gap-2">
          <Plus size={16} /> Agregar manual
        </Button>
        {predefinidos.length > 0 && (
          <Button variant="secondary" onClick={() => { setShowPredefined(!showPredefined); setAdding(false); }} className="flex items-center gap-2">
            <Zap size={16} /> Cargar distritos predefinidos
          </Button>
        )}
      </div>

      {/* Panel de predefinidos */}
      {showPredefined && predefinidos.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-white font-black italic uppercase text-sm flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              Distritos de {ruta.nombre}
            </h3>
            <p className="text-text-muted text-xs">Selecciona los distritos a agregar:</p>
            <div className="grid grid-cols-2 gap-2">
              {predefinidos.map(d => {
                const yaExiste = locales.some(l => l.nombre.toLowerCase() === d.toLowerCase());
                const seleccionado = selectedPredefined.includes(d);
                return (
                  <button
                    key={d}
                    disabled={yaExiste}
                    onClick={() => togglePredefined(d)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                      yaExiste
                        ? 'opacity-30 cursor-not-allowed bg-white/5 text-text-muted'
                        : seleccionado
                          ? 'bg-primary text-white ring-1 ring-primary shadow-lg shadow-primary/20'
                          : 'bg-surface-light text-text-muted hover:text-white hover:bg-surface-light/80 border border-white/5'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      yaExiste ? 'border-white/20' :
                      seleccionado ? 'border-white bg-white' : 'border-text-muted'
                    }`}>
                      {seleccionado && <span className="w-2 h-2 rounded-full bg-primary block" />}
                      {yaExiste && <span className="text-[8px] leading-none">✓</span>}
                    </span>
                    {d}
                    {yaExiste && <span className="text-[10px] ml-auto opacity-60">ya existe</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleLoadPredefined}
                disabled={selectedPredefined.length === 0 || loadingPredefined}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-black"
              >
                {loadingPredefined ? 'Cargando...' : `Agregar ${selectedPredefined.length} seleccionados`}
              </Button>
              <Button variant="ghost" onClick={() => { setShowPredefined(false); setSelectedPredefined([]); }}>
                <X size={14} className="mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario de agregar manual */}
      {adding && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-white font-black uppercase italic text-sm">Nueva Parada</h3>
            <Input
              placeholder="Ej: Miraflores, San Isidro, Barranco..."
              value={newLocalName}
              onChange={e => setNewLocalName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLocal()}
              className="bg-surface-light border-primary/30 text-white"
              autoFocus
            />
            <div className="flex gap-3">
              <Button onClick={handleAddLocal} className="bg-primary">
                <CheckCircle size={16} className="mr-2" /> Agregar
              </Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setNewLocalName(''); }}>
                <X size={16} className="mr-2" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de locales */}
      <div className="space-y-3">
        <h2 className="text-xs font-black text-text-muted uppercase tracking-[0.25em] italic flex items-center gap-2">
          <div className="flex-1 h-[1px] bg-white/5" />
          Orden de Paradas
          <div className="flex-1 h-[1px] bg-white/5" />
        </h2>

        {locales.length === 0 ? (
          <div className="text-center py-12 bg-surface border border-dashed border-surface-light rounded-2xl">
            <MapPin size={32} className="mx-auto mb-3 text-text-muted opacity-30" />
            <p className="text-text-muted italic text-sm">Sin paradas. Usa "Cargar distritos predefinidos" o agrega manual.</p>
          </div>
        ) : (
          locales.map((local, idx) => (
            <Card key={local.id_local_base} className="border-surface-light/50 hover:border-primary/20 transition-all group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-sm flex-shrink-0">
                  {local.orden}
                </div>
                <div className="flex-1">
                  {editId === local.id_local_base ? (
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditLocal(local.id_local_base)}
                        className="bg-surface-light border-primary/30 text-white h-9 text-sm"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleEditLocal(local.id_local_base)} className="bg-primary px-3">
                        <CheckCircle size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="px-2">
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-primary flex-shrink-0" />
                      <span className="text-white font-bold italic">{local.nombre}</span>
                    </div>
                  )}
                </div>
                {editId !== local.id_local_base && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveLocal(idx, 'up')} disabled={idx === 0} className="p-1.5 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors">
                      <ChevronUp size={15} />
                    </button>
                    <button onClick={() => moveLocal(idx, 'down')} disabled={idx === locales.length - 1} className="p-1.5 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors">
                      <ChevronDown size={15} />
                    </button>
                    <button onClick={() => { setEditId(local.id_local_base); setEditName(local.nombre); }} className="p-1.5 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteLocal(local.id_local_base)} className="p-1.5 rounded text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {locales.length > 0 && (
        <div className="bg-surface-light/10 border border-white/5 rounded-xl p-4">
          <p className="text-xs text-text-muted italic text-center">
            💡 El chofer verá estas paradas automáticamente al seleccionar esta ruta base.
          </p>
        </div>
      )}
    </div>
  );
}
