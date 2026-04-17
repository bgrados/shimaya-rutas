import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Plus, Settings, Trash2, Edit2, CheckCircle, X, Map, Route } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RutaBase {
  id_ruta_base: string;
  nombre: string;
  descripcion?: string | null;
  cantidad_peajes: number;
  costo_peaje: number;
  locales_base?: { count: number }[] | any;
}

export default function RutasBase() {
  const [rutas, setRutas] = useState<RutaBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPeajes, setEditPeajes] = useState({ cantidad: 0, costo: 0 });
  const [editMode, setEditMode] = useState<'nombre' | 'peaje'>('nombre');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('rutas_base').select('*, locales_base(count)').order('nombre');
    if (data) {
      const rutasConDefaults = data.map((r: any) => ({
        ...r,
        cantidad_peajes: r.cantidad_peajes ?? 0,
        costo_peaje: r.costo_peaje ?? 0
      }));
      setRutas(rutasConDefaults);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('rutas_base')
      .insert({ nombre: newName.trim(), cantidad_peajes: 0, costo_peaje: 0 })
      .select()
      .single();
    if (!error && data) {
      setRutas([...rutas, { ...data, cantidad_peajes: 0, costo_peaje: 0, locales_base: [] }]);
      setNewName('');
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta ruta base y todos sus locales?')) return;
    await supabase.from('locales_base').delete().eq('id_ruta_base', id);
    await supabase.from('rutas_base').delete().eq('id_ruta_base', id);
    setRutas(rutas.filter(r => r.id_ruta_base !== id));
  };

  const handleEditNombre = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('rutas_base').update({ nombre: editName.trim() }).eq('id_ruta_base', id);
    if (!error) {
      setRutas(rutas.map(r => r.id_ruta_base === id ? { ...r, nombre: editName.trim() } : r));
      setEditId(null);
    }
  };

  const handleEditPeaje = async (id: string) => {
    const cantidad = Math.max(0, parseInt(editPeajes.cantidad as any) || 0);
    const costo = Math.max(0, parseFloat(editPeajes.costo as any) || 0);
    const { error } = await supabase.from('rutas_base').update({ cantidad_peajes: cantidad, costo_peaje: costo }).eq('id_ruta_base', id);
    if (!error) {
      setRutas(rutas.map(r => r.id_ruta_base === id ? { ...r, cantidad_peajes: cantidad, costo_peaje: costo } : r));
      setEditId(null);
    }
  };

  const startEditPeaje = (ruta: RutaBase) => {
    setEditId(ruta.id_ruta_base);
    setEditMode('peaje');
    setEditPeajes({ cantidad: ruta.cantidad_peajes, costo: ruta.costo_peaje });
  };

  const startEditNombre = (ruta: RutaBase) => {
    setEditId(ruta.id_ruta_base);
    setEditMode('nombre');
    setEditName(ruta.nombre);
  };

  const ROUTE_COLORS: Record<string, string> = {
    negra: '#1a1a1a',
    guinda: '#7c1c2e',
    verde: '#14532d',
    amarilla: '#713f12',
  };

  const getColor = (nombre: string) => {
    const lower = nombre.toLowerCase();
    for (const [key, color] of Object.entries(ROUTE_COLORS)) {
      if (lower.includes(key)) return color;
    }
    return '#1e3a5f';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Rutas Base</h1>
          <p className="text-text-muted text-sm">Plantillas fijas que los choferes usan diariamente</p>
        </div>
        <Button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-primary hover:bg-primary-hover">
          <Plus size={18} /> Nueva Ruta
        </Button>
      </div>

      {/* Formulario de creación */}
      {creating && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-white font-black uppercase italic">Nueva Ruta Base</h3>
            <Input
              placeholder="Ej: Ruta Negra - Norte"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="bg-surface-light border-primary/40 text-white"
              autoFocus
            />
            <div className="flex gap-3">
              <Button onClick={handleCreate} className="bg-primary">
                <CheckCircle size={16} className="mr-2" /> Crear Ruta
              </Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setNewName(''); }}>
                <X size={16} className="mr-2" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="bg-orange-500/10 border-orange-500/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Route size={20} className="text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 font-bold text-sm">Configuración de Peajes</p>
            <p className="text-orange-200/60 text-xs mt-1">
              Cada ruta puede tener configuración de peajes (cantidad y costo). 
              El cálculo es automático: <span className="text-orange-300 font-bold">peaje = cantidad × costo</span>.
              Si cantidad es 0, la ruta no genera peajes.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-white italic animate-pulse text-center py-10">Cargando plantillas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rutas.map(ruta => (
            <Card key={ruta.id_ruta_base} className="overflow-hidden border-surface-light hover:border-primary/30 transition-all group">
              {/* Color strip at top */}
              <div className="h-2 w-full" style={{ backgroundColor: getColor(ruta.nombre) }} />
              <CardContent className="p-6 space-y-4">
                {editId === ruta.id_ruta_base && editMode === 'nombre' ? (
                  <div className="space-y-3">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEditNombre(ruta.id_ruta_base)}
                      className="bg-surface-light border-primary/40 text-white font-bold"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditNombre(ruta.id_ruta_base)} className="bg-primary flex-1">
                        <CheckCircle size={14} className="mr-1" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ) : editId === ruta.id_ruta_base && editMode === 'peaje' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Cantidad Peajes</label>
                        <Input
                          type="number"
                          min="0"
                          value={editPeajes.cantidad}
                          onChange={e => setEditPeajes({ ...editPeajes, cantidad: parseInt(e.target.value) || 0 })}
                          className="bg-surface-light border-primary/40 text-white font-bold"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-bold ml-1">Costo Unit. (S/)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editPeajes.costo}
                          onChange={e => setEditPeajes({ ...editPeajes, costo: parseFloat(e.target.value) || 0 })}
                          className="bg-surface-light border-primary/40 text-white font-bold"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-orange-400 text-center">
                      Total peaje: <span className="font-black">S/ {((editPeajes.cantidad || 0) * (editPeajes.costo || 0)).toFixed(2)}</span>
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEditPeaje(ruta.id_ruta_base)} className="bg-orange-500 hover:bg-orange-600 flex-1">
                        <CheckCircle size={14} className="mr-1" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 w-full border-b border-surface-light pb-3">
                        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: getColor(ruta.nombre) + '33' }}>
                          <Map size={20} style={{ color: getColor(ruta.nombre) === '#1a1a1a' ? '#aaa' : getColor(ruta.nombre) }} />
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-black text-white text-lg leading-tight">{ruta.nombre}</h3>
                          <p className="text-xs text-text-muted mt-1 font-bold tracking-widest uppercase">
                            {Array.isArray(ruta.locales_base) && ruta.locales_base[0] ? ruta.locales_base[0].count : 0} LOCALES
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditNombre(ruta)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                          title="Editar nombre"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(ruta.id_ruta_base)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Configuración de Peajes */}
                    <div className="bg-surface-light/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-orange-300 uppercase font-bold tracking-wider">Configuración Peajes</p>
                        <button
                          onClick={() => startEditPeaje(ruta)}
                          className="text-[10px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
                        >
                          <Edit2 size={10} /> Editar
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-surface/50 rounded-lg p-2">
                          <p className="text-text-muted text-[10px] uppercase">Cantidad</p>
                          <p className="text-white font-black text-lg">{ruta.cantidad_peajes || 0}</p>
                        </div>
                        <div className="bg-surface/50 rounded-lg p-2">
                          <p className="text-text-muted text-[10px] uppercase">Costo Unit.</p>
                          <p className="text-orange-400 font-black text-lg">S/ {(ruta.costo_peaje || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="bg-orange-500/20 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-orange-300 uppercase">Total por Viaje</p>
                        <p className="text-orange-400 font-black text-xl">
                          S/ {((ruta.cantidad_peajes || 0) * (ruta.costo_peaje || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <Link to={`/admin/rutas-base/${ruta.id_ruta_base}`}>
                      <Button variant="secondary" className="w-full flex items-center justify-center gap-2 mt-2">
                        <Settings size={16} /> Gestionar Locales
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          {rutas.length === 0 && !loading && (
            <div className="col-span-full text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
              <Map size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
              <p className="text-text-muted italic">No hay rutas base todavía. ¡Crea la primera!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
