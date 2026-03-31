import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Plus, Settings, Trash2, Edit2, CheckCircle, X, Map } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RutaBase {
  id_ruta_base: string;
  nombre: string;
  locales_base?: { count: number }[] | any;
}

export default function RutasBase() {
  const [rutas, setRutas] = useState<RutaBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('rutas_base').select('*, locales_base(count)').order('nombre');
    if (data) setRutas(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('rutas_base')
      .insert({ nombre: newName.trim() })
      .select()
      .single();
    if (!error && data) {
      setRutas([...rutas, data]);
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

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('rutas_base').update({ nombre: editName.trim() }).eq('id_ruta_base', id);
    if (!error) {
      setRutas(rutas.map(r => r.id_ruta_base === id ? { ...r, nombre: editName.trim() } : r));
      setEditId(null);
    }
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

      {loading ? (
        <div className="text-white italic animate-pulse text-center py-10">Cargando plantillas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rutas.map(ruta => (
            <Card key={ruta.id_ruta_base} className="overflow-hidden border-surface-light hover:border-primary/30 transition-all group">
              {/* Color strip at top */}
              <div className="h-2 w-full" style={{ backgroundColor: getColor(ruta.nombre) }} />
              <CardContent className="p-6 space-y-4">
                {editId === ruta.id_ruta_base ? (
                  <div className="space-y-3">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEdit(ruta.id_ruta_base)}
                      className="bg-surface-light border-primary/40 text-white font-bold"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(ruta.id_ruta_base)} className="bg-primary flex-1">
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
                          onClick={() => { setEditId(ruta.id_ruta_base); setEditName(ruta.nombre); }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(ruta.id_ruta_base)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
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
