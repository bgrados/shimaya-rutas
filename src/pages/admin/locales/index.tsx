import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Plus, MapPin, Trash2, Edit2, CheckCircle, X, Phone, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LocalBase {
  id_local_base: string;
  nombre: string;
  direccion?: string;
  contacto?: string;
  telefono?: string;
  latitud?: number;
  longitud?: number;
}

export default function LocalesBase() {
  const navigate = useNavigate();
  const [locales, setLocales] = useState<LocalBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<LocalBase>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('locales_base').select('*').order('nombre');
    if (data) setLocales(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const startEdit = (local: LocalBase) => {
    setEditId(local.id_local_base);
    setEditData({ nombre: local.nombre, direccion: local.direccion, contacto: local.contacto, telefono: local.telefono });
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('locales_base').update(editData).eq('id_local_base', id);
    if (!error) {
      setLocales(locales.map(l => l.id_local_base === id ? { ...l, ...editData } : l));
      cancelEdit();
    } else {
      alert('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('locales_base').delete().eq('id_local_base', id);
    if (!error) setLocales(locales.filter(l => l.id_local_base !== id));
    else alert('Error: ' + error.message);
  };

  if (loading) return <div className="text-white italic animate-pulse py-10 text-center">Cargando locales...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Locales Base</h1>
          <p className="text-text-muted text-sm">{locales.length} locales registrados</p>
        </div>
        <Button className="flex items-center gap-2 bg-primary hover:bg-primary-hover" onClick={() => navigate('/admin/locales/nuevo')}>
          <Plus size={18} /> Nuevo Local
        </Button>
      </div>

      {locales.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-dashed border-surface-light rounded-2xl">
          <MapPin size={40} className="mx-auto mb-3 text-text-muted opacity-30" />
          <p className="text-text-muted italic">No hay locales registrados. ¡Agrega el primero!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locales.map(local => (
            <Card key={local.id_local_base} className="border-surface-light/50 hover:border-primary/20 transition-all group overflow-hidden">
              <CardContent className="p-5 space-y-4">
                {editId === local.id_local_base ? (
                  /* ---- MODO EDICIÓN ---- */
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Editando</p>
                    <Input
                      placeholder="Nombre"
                      value={editData.nombre || ''}
                      onChange={e => setEditData({ ...editData, nombre: e.target.value })}
                      className="bg-surface-light border-primary/30 text-white text-sm h-9"
                    />
                    <Input
                      placeholder="Dirección"
                      value={editData.direccion || ''}
                      onChange={e => setEditData({ ...editData, direccion: e.target.value })}
                      className="bg-surface-light border-white/10 text-white text-sm h-9"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Contacto"
                        value={editData.contacto || ''}
                        onChange={e => setEditData({ ...editData, contacto: e.target.value })}
                        className="bg-surface-light border-white/10 text-white text-sm h-9"
                      />
                      <Input
                        placeholder="Teléfono"
                        value={editData.telefono || ''}
                        onChange={e => setEditData({ ...editData, telefono: e.target.value })}
                        className="bg-surface-light border-white/10 text-white text-sm h-9"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => saveEdit(local.id_local_base)} disabled={saving} className="bg-primary flex-1">
                        <CheckCircle size={14} className="mr-1" /> {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="px-3">
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
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
                      {/* Controles — aparecen al hacer hover */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => startEdit(local)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(local.id_local_base, local.nombre)}
                          className="p-1.5 rounded-lg text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {(local.contacto || local.telefono) && (
                      <div className="border-t border-white/5 pt-3 space-y-1">
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
                      <p className="text-[10px] text-text-muted/50 font-mono">
                        {local.latitud.toFixed(4)}, {local.longitud?.toFixed(4)}
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
