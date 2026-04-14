import React, { useState, useEffect, useRef } from 'react';
import type { Usuario } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Plus, Shield, Truck, User, Edit2, Trash2, Key, Loader2, CheckCircle, X, Smartphone, Mail, Camera, Phone, Circle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Input } from '../../../components/ui/Input';
import { useNavigate } from 'react-router-dom';

interface UsuarioExtendido extends Usuario {
  connected?: boolean;
  lastSeen?: string;
}


/* ───────────── Sub-componente EditForm ───────────── */

interface EditFormProps {
  user: Usuario;
  onSave: (id: string, payload: any) => Promise<void>;
  onCancel: () => void;
}

function EditForm({ user, onSave, onCancel }: EditFormProps) {
  const [nombre, setNombre] = useState(user.nombre || '');
  const [rol, setRol] = useState(user.rol || 'chofer');
  const [telefono, setTelefono] = useState(user.telefono || '');
  const [placa, setPlaca] = useState(user.placa_camion || '');
  const [activo, setActivo] = useState(user.activo ?? true);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(user.foto_url || null);
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
    if (!fotoFile) return user.foto_url;
    const fileExt = fotoFile.name.split('.').pop();
    const fileName = `user_${user.id_usuario}_${Date.now()}.${fileExt}`;
    const filePath = `perfiles/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('perfiles').upload(filePath, fotoFile, { upsert: true });
    if (uploadError) {
      console.error('[EditForm] Error upload:', uploadError);
      alert('Error al subir la foto de perfil. Asegúrate de configurar el bucket "perfiles" como Público y con permisos (Policies) para INSERT.');
      return user.foto_url;
    }

    const { data } = supabase.storage.from('perfiles').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio.');
    setSaving(true);
    try {
      const photoUrl = await uploadPhoto();
      await onSave(user.id_usuario, {
        nombre: nombre.trim(),
        rol,
        telefono: telefono.trim() || null,
        placa_camion: placa.trim() || null,
        foto_url: photoUrl,
        activo,
        password: password.trim() || undefined
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-surface-light/30 border-y border-surface-light">
      <div className="space-y-4">
        <Input label="Nombre Completo" value={nombre} onChange={e => setNombre(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-tighter">Rol</label>
            <select 
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary appearance-none transition-colors"
              value={rol}
              onChange={e => setRol(e.target.value as any)}
            >
              <option value="chofer">Chofer</option>
              <option value="supervisor">Supervisor</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} type="tel" />
        </div>
        
        {rol === 'chofer' && (
          <Input label="Placa del Camión (Solo para choferes)" value={placa} onChange={e => setPlaca(e.target.value)} placeholder="Ej. ABC-123" />
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-tighter">Foto de Perfil</label>
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full bg-surface border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {fotoPreview ? <img src={fotoPreview} className="w-full h-full object-cover" /> : <User size={24} className="text-text-muted opacity-50"/>}
            </div>
            <div className="flex-1">
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
              <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Camera size={14} className="mr-2" /> Subir Foto
              </Button>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-text-muted mb-1 uppercase tracking-tighter">Nueva Contraseña (Opcional)</label>
          <div className="relative">
            <Input 
              type="password" 
              placeholder="Dejar vacío si no desea cambiarla" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="pr-10"
            />
            <Key size={14} className="absolute right-3 top-3 text-text-muted" />
          </div>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-white/5">
          <span className="text-xs font-bold uppercase text-text-muted">Estado de Cuenta</span>
          <button 
            type="button"
            onClick={() => setActivo(!activo)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${activo ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
          >
            {activo ? 'ACTIVADO' : 'DESACTIVADO'}
          </button>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}><X size={14} className="mr-1"/> Cancelar</Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} className="bg-primary hover:bg-primary-hover"><CheckCircle size={14} className="mr-1"/> Guardar Todo</Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Página principal Usuarios ───────────── */
export default function Usuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UsuarioExtendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usuariosOnline, setUsuariosOnline] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('usuarios').select('*').order('nombre');
      if (data) {
        // Combinar con estado online
        const usuariosActualizados = (data as Usuario[]).map(u => ({
          ...u,
          connected: usuariosOnline.has(u.id_usuario),
          lastSeen: new Date().toISOString()
        }));
        setUsuarios(usuariosActualizados);
      }
    } catch(err) {
      console.error('Error load:', err);
    } finally {
      setLoading(false);
    }
  };

  // Realtime para detectar usuarios conectados usando Presence
  useEffect(() => {
    load();
    
    // Definimos el canal primero
    const channel = supabase.channel('auth_presence');

    // Añadimos TODOS los callbacks ANTES de llamar a subscribe()
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach(key => {
          const users = state[key] as any[];
          users.forEach(u => {
            if (u.user_id) {
              onlineIds.add(u.user_id);
            }
          });
        });
        setUsuariosOnline(onlineIds);
        
        // Actualizamos los usuarios locales sin volver a llamar a load() (que hace el fetch completo)
        // para evitar loops infinitos o race conditions
        setUsuarios(prev => prev.map(u => ({
          ...u,
          connected: onlineIds.has(u.id_usuario)
        })));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: 'admin_view',
            email: 'admin',
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveEdit = async (id: string, payload: any) => {
    // 1. Update in Table
    const { error: tableErr } = await supabase
      .from('usuarios')
      .update({
        nombre: payload.nombre,
        rol: payload.rol,
        telefono: payload.telefono,
        activo: payload.activo,
        foto_url: payload.foto_url,
        placa_camion: payload.placa_camion,
        password: payload.password || undefined // Only update if provided
      })
      .eq('id_usuario', id);

    if (tableErr) return alert('Error al actualizar tabla: ' + tableErr.message);

    // 2. Auth Update (vía Edge Function) - Correr en paralelo para no bloquear la interfaz
    if (payload.password || payload.activo === false || payload.activo === true) {
      // No usamos await aquí para que la UI se cierre de inmediato
      supabase.functions.invoke('admin-auth', {
        body: { action: 'update_user', userId: id, password: payload.password, activo: payload.activo }
      }).then(({ error: authErr }) => {
        if (authErr) console.warn('[Auth Sync] Error:', authErr.message);
      }).catch(err => {
        console.warn('[Auth Sync] Fallo de conexión:', err);
      });
    }

    setUsuarios((prev: Usuario[]) => prev.map((u: Usuario) => u.id_usuario === id ? { ...u, ...payload } : u));
    setEditId(null);
  };



  const handleDelete = async (user: Usuario) => {
    if (!confirm(`¿Eliminar a "${user.nombre}"? No podrá volver a iniciar sesión.`)) return;
    setDeletingId(user.id_usuario);
    
    // Intentar delete en la tabla
    const { error: tableErr } = await supabase.from('usuarios').delete().eq('id_usuario', user.id_usuario);
    
    // Si hay error de foreign key constraint
    console.log('[handleDelete] Error:', tableErr?.message);
    if (tableErr && (tableErr.message?.indexOf('foreign key') >= 0 || tableErr.message?.indexOf('violates') >= 0 || tableErr.code === '23503')) {
      console.log('[handleDelete] Foreign key constraint detectado, intentando desactivar...');
      const { error: deactivateErr } = await supabase.from('usuarios').update({ activo: false }).eq('id_usuario', user.id_usuario);
      
      if (deactivateErr) {
        alert('Error al desactivar: ' + deactivateErr.message);
      } else {
        setUsuarios((prev: Usuario[]) => prev.map((u: Usuario) => u.id_usuario === user.id_usuario ? { ...u, activo: false } : u));
        alert('Usuario desactivado. El usuario tiene rutas asociadas y no puede ser eliminado hasta desvincularlas.');
      }
      setDeletingId(null);
      return;
    }
    
    if (tableErr) {
      alert('Error tabla: ' + tableErr.message);
      setDeletingId(null);
      return;
    }
    
    // Si el delete fue exitoso, también eliminar de Auth (solo para no choferes)
    if (user.rol !== 'chofer') {
      try {
        await supabase.functions.invoke('admin-auth', {
          body: { action: 'delete_user', userId: user.id_usuario }
        });
      } catch(err) {
        console.warn('Fallo Auth Delete:', err);
      }
    }
    
    setUsuarios((prev: Usuario[]) => prev.filter((u: Usuario) => u.id_usuario !== user.id_usuario));
    setDeletingId(null);
  };

  const getRoleIcon = (rol: string) => {
    switch (rol) {
      case 'administrador': return <Shield size={14} />;
      case 'chofer': return <Truck size={14} />;
      default: return <User size={14} />;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <Button className="flex items-center gap-2" onClick={() => navigate('/admin/usuarios/nuevo')}>
          <Plus size={20} /> Nuevo Usuario
        </Button>
      </div>

      <div className="bg-surface border border-surface-light rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-light/50 text-text-muted">
              <tr>
                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[10px]">Usuario / Contacto</th>
                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[10px]">Rol / Permisos</th>
                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[10px]">Estado</th>
                <th className="px-6 py-4 font-black uppercase tracking-tighter text-[10px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-light text-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-primary mb-2" size={24} />
                    <p className="text-text-muted text-xs uppercase font-black tracking-widest">Cargando Usuarios...</p>
                  </td>
                </tr>
              ) : usuarios.map((user) => (
                <React.Fragment key={user.id_usuario}>
                  <tr className={`hover:bg-surface-light/20 transition-colors ${editId === user.id_usuario ? 'bg-primary/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {user.foto_url ? (
                              <img src={user.foto_url} alt="" className="w-full h-full object-cover" onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }} />
                            ) : null}
                            <User size={20} className={`text-text-muted opacity-50 ${user.foto_url ? 'hidden' : ''}`}/>
                          </div>
                          {/* Indicador de conexión */}
                          {user.connected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-surface" title="Conectado"></div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white mb-0.5">{user.nombre}</span>
                            {user.connected && (
                              <span className="text-[10px] text-green-400 font-bold">● En línea</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-text-muted">
                            <span className="flex items-center gap-1"><Mail size={10} /> {user.email}</span>
                            {user.telefono && <span className="flex items-center gap-1"><Smartphone size={10} /> {user.telefono}</span>}
                            {user.placa_camion && <span className="flex items-center gap-1"><Truck size={10} /> {user.placa_camion}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                        user.rol === 'administrador' ? 'bg-primary/20 text-primary' : 
                        user.rol === 'supervisor' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {getRoleIcon(user.rol)} {user.rol}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${user.activo ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {user.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.telefono && (
                          <a
                            href={`https://wa.me/51${user.telefono.replace(/\D/g, '')}?text=Hola ${user.nombre}, tienes una consulta`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-green-500/20 rounded-lg text-green-500 transition-all"
                            title="Llamar por WhatsApp"
                          >
                            <Phone size={16} />
                          </a>
                        )}
                        <button 
                          onClick={() => setEditId(editId === user.id_usuario ? null : user.id_usuario)}
                          className="p-2 hover:bg-primary/20 rounded-lg text-text-muted hover:text-primary transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id_usuario}
                          className="p-2 hover:bg-red-500/20 rounded-lg text-text-muted hover:text-red-500 transition-all"
                        >
                          {deletingId === user.id_usuario ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {editId === user.id_usuario && (
                    <tr className="bg-surface-light/10">
                      <td colSpan={4} className="p-0">
                        <EditForm 
                          user={user} 
                          onCancel={() => setEditId(null)} 
                          onSave={handleSaveEdit}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-muted">No hay usuarios registrados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
