import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { ArrowLeft, Plus, MapPin, Trash2, Edit2, CheckCircle, X, ChevronUp, ChevronDown, Zap, Route } from 'lucide-react';

interface RutaBase { 
  id_ruta_base: string; 
  nombre: string; 
  cantidad_peajes: number;
  costo_peaje: number;
}
interface LocalBase { id_local_base: string; id_ruta_base: string | null; nombre: string; orden: number; }

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
  const [allLocales, setAllLocales] = useState<LocalBase[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingPeaje, setEditingPeaje] = useState(false);
  const [editPeajeCantidad, setEditPeajeCantidad] = useState(0);
  const [editPeajeCosto, setEditPeajeCosto] = useState(0);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [rutaRes, localesRes, allLocalesRes] = await Promise.all([
      supabase.from('rutas_base').select('*').eq('id_ruta_base', id).single(),
      supabase.from('locales_base').select('*').eq('id_ruta_base', id).order('orden', { ascending: true }),
      supabase.from('locales_base').select('*')
    ]);
    if (rutaRes.data) {
      setRuta({
        ...rutaRes.data,
        cantidad_peajes: rutaRes.data.cantidad_peajes ?? 0,
        costo_peaje: rutaRes.data.costo_peaje ?? 0
      });
    }
    if (localesRes.data) setLocales(localesRes.data);
    if (allLocalesRes.data) setAllLocales(allLocalesRes.data);
    setLoading(false);
  }

  const handleSavePeaje = async () => {
    if (!id) return;
    const cantidad = Math.max(0, editPeajeCantidad);
    const costo = Math.max(0, editPeajeCosto);
    const { error } = await supabase
      .from('rutas_base')
      .update({ cantidad_peajes: cantidad, costo_peaje: costo })
      .eq('id_ruta_base', id);
    if (!error) {
      setRuta({ ...ruta!, cantidad_peajes: cantidad, costo_peaje: costo });
      setEditingPeaje(false);
    }
  };

  const startEditPeaje = () => {
    setEditingPeaje(true);
    setEditPeajeCantidad(ruta?.cantidad_peajes || 0);
    setEditPeajeCosto(ruta?.costo_peaje || 0);
  };

  useEffect(() => { load(); }, [id]);

  // Cargar locales libres seleccionados
  const handleLoadPredefined = async () => {
    if (!id || selectedPredefined.length === 0) return;
    setLoadingPredefined(true);
    const maxOrden = locales.length > 0 ? Math.max(...locales.map(l => l.orden)) : 0;
    
    // selectedPredefined ahora guarda los id_local_base de los locales libres
    let successCount = 0;
    const addedLocales: LocalBase[] = [];

    for (let i = 0; i < selectedPredefined.length; i++) {
        const localId = selectedPredefined[i];
        const { data, error } = await supabase
            .from('locales_base')
            .update({ id_ruta_base: id, orden: maxOrden + i + 1 })
            .eq('id_local_base', localId)
            .select()
            .single();
            
        if (!error && data) {
            successCount++;
            addedLocales.push(data);
        }
    }

    if (successCount > 0) {
      setLocales([...locales, ...addedLocales]);
      setAllLocales(allLocales.map(l => 
        addedLocales.find(a => a.id_local_base === l.id_local_base) ? addedLocales.find(a => a.id_local_base === l.id_local_base)! : l
      ));
    }
    
    setShowPredefined(false);
    setSelectedPredefined([]);
    setLoadingPredefined(false);
  };

  const togglePredefined = (localId: string) => {
    setSelectedPredefined(prev =>
      prev.includes(localId) ? prev.filter(id => id !== localId) : [...prev, localId]
    );
  };

  const handleAddLocal = async () => {
    if (!newLocalName.trim() || !id) return;
    
    const maxOrden = locales.length > 0 ? Math.max(...locales.map(l => l.orden)) : 0;
    
    // Verificamos si escribieron el nombre exacto de uno existente (case-insensitive)
    const existenteExacto = allLocales.find(l => l.nombre.toLowerCase() === newLocalName.trim().toLowerCase() && l.id_ruta_base !== id);
    
    if (existenteExacto) {
        // Usar existente
        const { data, error } = await supabase
            .from('locales_base')
            .update({ id_ruta_base: id, orden: maxOrden + 1 })
            .eq('id_local_base', existenteExacto.id_local_base)
            .select()
            .single();
        if (!error && data) {
            setLocales([...locales, data]);
            setAllLocales(allLocales.map(l => l.id_local_base === data.id_local_base ? data : l));
            setNewLocalName('');
            setAdding(false);
        } else {
            alert('Error al vincular local: ' + (error?.message || 'desconocido'));
        }
    } else {
        // Crear nuevo
        const { data, error } = await supabase
          .from('locales_base')
          .insert({ id_ruta_base: id, nombre: newLocalName.trim(), orden: maxOrden + 1 })
          .select()
          .single();
        if (!error && data) {
          setLocales([...locales, data]);
          setAllLocales([...allLocales, data]);
          setNewLocalName('');
          setAdding(false);
        } else {
          alert('Error al crear local: ' + (error?.message || 'desconocido'));
        }
    }
  };
  
  const handleAssignExisting = async (local: LocalBase) => {
    if (!id) return;
    const maxOrden = locales.length > 0 ? Math.max(...locales.map(l => l.orden)) : 0;
    const { data, error } = await supabase
        .from('locales_base')
        .update({ id_ruta_base: id, orden: maxOrden + 1 })
        .eq('id_local_base', local.id_local_base)
        .select()
        .single();
    if (!error && data) {
        setLocales([...locales, data]);
        setAllLocales(allLocales.map(l => l.id_local_base === data.id_local_base ? data : l));
        setNewLocalName('');
        setAdding(false);
        setShowSuggestions(false);
    } else {
        alert('Error: ' + (error?.message || 'desconocido'));
    }
  };

  const handleDeleteLocal = async (localId: string) => {
    if (!confirm('¿Desvincular esta parada de la ruta? (El local seguirá existiendo en el sistema)')) return;
    const { error } = await supabase.from('locales_base').update({ id_ruta_base: null, orden: null }).eq('id_local_base', localId);
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

  const localesDisponibles = allLocales.filter(l => l.id_ruta_base !== id);
  const localesLibres = localesDisponibles.filter(l => !l.id_ruta_base);
  const localesEnOtrasRutas = localesDisponibles.filter(l => l.id_ruta_base);
  
  const filteredSuggestions = newLocalName.trim().length >= 2 
    ? localesDisponibles.filter(l => l.nombre.toLowerCase().includes(newLocalName.toLowerCase()))
    : [];

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

      {/* Configuración de Peajes */}
      <Card className={ruta.cantidad_peajes > 0 ? "bg-orange-500/10 border-orange-500/30" : "bg-surface-light/30 border-surface-light"}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Route size={18} className={ruta.cantidad_peajes > 0 ? "text-orange-400" : "text-text-muted"} />
              <h3 className="text-sm font-black text-white uppercase italic">Configuración de Peajes</h3>
            </div>
            {!editingPeaje && (
              <Button size="sm" variant="ghost" onClick={startEditPeaje} className="text-orange-400 hover:text-orange-300">
                <Edit2 size={14} className="mr-1" /> Editar
              </Button>
            )}
          </div>
          
          {editingPeaje ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold ml-1 block mb-1">Cantidad de Peajes</label>
                  <Input
                    type="number"
                    min="0"
                    value={editPeajeCantidad}
                    onChange={e => setEditPeajeCantidad(parseInt(e.target.value) || 0)}
                    className="bg-surface border-orange-500/30 text-white font-bold"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold ml-1 block mb-1">Costo Unitario (S/)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPeajeCosto}
                    onChange={e => setEditPeajeCosto(parseFloat(e.target.value) || 0)}
                    className="bg-surface border-orange-500/30 text-white font-bold"
                  />
                </div>
              </div>
              <div className="bg-orange-500/20 rounded-xl p-4 text-center">
                <p className="text-[10px] text-orange-300 uppercase font-bold">Total Peaje por Viaje</p>
                <p className="text-orange-400 font-black text-3xl">
                  S/ {((editPeajeCantidad || 0) * (editPeajeCosto || 0)).toFixed(2)}
                </p>
                {editPeajeCantidad === 0 && (
                  <p className="text-orange-200/60 text-xs mt-2">
                    Esta ruta no generará peajes automáticos
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSavePeaje} className="bg-orange-500 hover:bg-orange-600 font-black flex-1">
                  <CheckCircle size={16} className="mr-2" /> Guardar Cambios
                </Button>
                <Button variant="ghost" onClick={() => setEditingPeaje(false)} className="text-text-muted">
                  <X size={16} className="mr-2" /> Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface/50 rounded-xl p-4 text-center">
                <p className="text-[10px] text-text-muted uppercase font-bold">Cantidad</p>
                <p className="text-white font-black text-2xl">{ruta.cantidad_peajes || 0}</p>
                <p className="text-text-muted text-[10px]">peajes</p>
              </div>
              <div className="bg-surface/50 rounded-xl p-4 text-center">
                <p className="text-[10px] text-text-muted uppercase font-bold">Costo Unit.</p>
                <p className="text-orange-400 font-black text-2xl">S/ {(ruta.costo_peaje || 0).toFixed(2)}</p>
                <p className="text-text-muted text-[10px]">por peaje</p>
              </div>
              <div className="col-span-2 bg-orange-500/20 rounded-xl p-4 text-center">
                <p className="text-[10px] text-orange-300 uppercase font-bold">Total Peaje por Viaje</p>
                <p className="text-orange-400 font-black text-3xl">
                  S/ {((ruta.cantidad_peajes || 0) * (ruta.costo_peaje || 0)).toFixed(2)}
                </p>
                {ruta.cantidad_peajes === 0 && (
                  <p className="text-orange-200/60 text-xs mt-2">
                    Ruta sin peajes configurados
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => { setAdding(true); setShowPredefined(false); }} className="bg-primary flex items-center gap-2">
          <Plus size={16} /> Agregar manual / Buscar
        </Button>
        <Button variant="secondary" onClick={() => { setShowPredefined(!showPredefined); setAdding(false); }} className="flex items-center gap-2">
          <Zap size={16} /> Ver Todos los Locales ({localesDisponibles.length})
        </Button>
      </div>

      {/* Panel de locales libres y en otras rutas */}
      {showPredefined && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-white font-black italic uppercase text-sm flex items-center gap-2">
              <Zap size={14} className="text-yellow-400" />
              Locales Disponibles
            </h3>
            {localesDisponibles.length === 0 ? (
               <p className="text-text-muted text-xs">No hay más locales en el sistema. Puedes crear uno nuevo desde el botón Agregar.</p>
            ) : (
                <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                
                {localesLibres.length > 0 && (
                  <div>
                    <p className="text-green-400/80 font-bold text-xs mb-2">Libres (Sin Ruta Asignada):</p>
                    <div className="grid grid-cols-2 gap-2">
                      {localesLibres.map(l => {
                        const seleccionado = selectedPredefined.includes(l.id_local_base);
                        return (
                          <button
                            key={l.id_local_base}
                            onClick={() => togglePredefined(l.id_local_base)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                               seleccionado
                                  ? 'bg-primary text-white ring-1 ring-primary shadow-lg shadow-primary/20'
                                  : 'bg-surface-light text-text-muted hover:text-white hover:bg-surface-light/80 border border-white/5'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              seleccionado ? 'border-white bg-white' : 'border-text-muted'
                            }`}>
                              {seleccionado && <span className="w-2 h-2 rounded-full bg-primary block" />}
                            </span>
                            <span className="truncate" title={l.nombre}>{l.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {localesEnOtrasRutas.length > 0 && (
                  <div className="pt-2">
                    <p className="text-yellow-500/80 font-bold text-xs mb-2">En otras Rutas (Al seleccionar, los robarás a esta ruta):</p>
                    <div className="grid grid-cols-2 gap-2">
                      {localesEnOtrasRutas.map(l => {
                        const seleccionado = selectedPredefined.includes(l.id_local_base);
                        return (
                          <button
                            key={l.id_local_base}
                            onClick={() => togglePredefined(l.id_local_base)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left opacity-80 ${
                               seleccionado
                                  ? 'bg-primary text-white ring-1 ring-primary shadow-lg shadow-primary/20 opacity-100'
                                  : 'bg-surface-light text-text-muted hover:text-white hover:bg-surface-light/80 border border-white/5'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              seleccionado ? 'border-yellow-400 bg-yellow-400' : 'border-text-muted'
                            }`}>
                              {seleccionado && <span className="w-2 h-2 rounded-full bg-surface block" />}
                            </span>
                            <span className="truncate" title={l.nombre}>{l.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
            )}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleLoadPredefined}
                disabled={selectedPredefined.length === 0 || loadingPredefined}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-black"
              >
                {loadingPredefined ? 'Agregando...' : `Añadir ${selectedPredefined.length} seleccionados`}
              </Button>
              <Button variant="ghost" onClick={() => { setShowPredefined(false); setSelectedPredefined([]); }}>
                <X size={14} className="mr-1" /> Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario de agregar manual */}
      {adding && (
        <Card className="border-primary/40 bg-primary/5 relative">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-white font-black uppercase italic text-sm">Nueva Parada (o buscar existente)</h3>
            <div className="relative">
                <Input
                  placeholder="Ej: Miraflores, San Isidro, Barranco..."
                  value={newLocalName}
                  onChange={e => {
                      setNewLocalName(e.target.value);
                      setShowSuggestions(true);
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleAddLocal()}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="bg-surface-light border-primary/30 text-white"
                  autoFocus
                />
                
                {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-light border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {filteredSuggestions.map(s => (
                            <button
                                key={s.id_local_base}
                                onClick={() => handleAssignExisting(s)}
                                className="w-full text-left px-4 py-2 text-sm text-text-muted hover:text-white hover:bg-primary/20 transition-colors border-b border-white/5 last:border-0 flex justify-between items-center"
                            >
                                <span>{s.nombre}</span>
                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">Agregar existente</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
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
