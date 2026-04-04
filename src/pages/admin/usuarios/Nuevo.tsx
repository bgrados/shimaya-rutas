import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { CheckCircle } from 'lucide-react';

export default function NuevoUsuario() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('chofer');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password) {
      setError('Nombre, correo y contraseña son obligatorios.');
      return;
    }
    
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoadingSubmit(true);
    setError('');

    try {
      const emailLower = email.toLowerCase().trim();
      
      console.log('[NuevoUsuario] Verificando email:', emailLower);

      const { data: existing } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .eq('email', emailLower)
        .maybeSingle();
      
      if (existing) {
        setError('Este email ya está registrado.');
        setLoadingSubmit(false);
        return;
      }

      console.log('[NuevoUsuario] Verificando en Auth...');
      try {
        const { data: existingAuth } = await supabase.auth.admin.getUserByEmail(emailLower);
        if (existingAuth?.user) {
          setError('Este email ya está registrado en Auth. Usa otro correo o recupera la contraseña.');
          setLoadingSubmit(false);
          return;
        }
      } catch (adminErr) {
        console.log('[NuevoUsuario] Admin check no disponible, continuando...');
      }

      console.log('[NuevoUsuario] Creando usuario en Auth...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailLower,
        password,
      });

      if (authError) {
        console.error('[NuevoUsuario] Auth error:', authError);
        
        if (authError.message.includes('already been registered')) {
          throw new Error('Este email ya está registrado. Usa otro correo.');
        }
        throw new Error(authError.message);
      }

      console.log('[NuevoUsuario] Auth response:', authData);

      const userId = authData.user?.id;
      
      if (!userId) {
        throw new Error('No se pudo obtener el ID del usuario. El email ya podría estar registrado.');
      }

      console.log('[NuevoUsuario] Insertando en tabla usuarios...');
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert({
          id_usuario: userId,
          nombre: nombre.trim(),
          email: emailLower,
          rol,
          telefono: telefono?.trim() || null,
          activo: true
        });

      if (dbError) {
        console.error('[NuevoUsuario] DB error:', dbError);
        
        console.log('[NuevoUsuario] Limpiando usuario de Auth...');
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch (cleanupError) {
          console.error('[NuevoUsuario] Error al limpiar usuario:', cleanupError);
        }
        
        if (dbError.message.includes('duplicate')) {
          throw new Error('El usuario ya existe en la base de datos.');
        }
        throw new Error(`Error al crear usuario: ${dbError.message}`);
      }

      console.log('[NuevoUsuario] Usuario creado exitosamente');
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/admin/usuarios');
      }, 2000);
      
    } catch (err: any) {
      console.error('[NuevoUsuario] Error completo:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-500/10 border border-green-500 text-green-500 p-8 rounded-xl text-center">
          <CheckCircle className="mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold mb-2">Usuario creado exitosamente</h2>
          <p className="text-green-200 mb-4">El usuario podrá iniciar sesión inmediatamente.</p>
          <p className="text-sm text-green-300">Redirigiendo a la lista de usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Agregar Nuevo Usuario</h1>
      
      {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">{error}</div>}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Nombre completo"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
            
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Rol</label>
              <select 
                className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none transition-colors"
                value={rol}
                onChange={e => setRol(e.target.value)}
                required
              >
                <option value="chofer">Chofer</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>

            <Input
              label="Teléfono (Opcional)"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />

            <Input
              label="Contraseña Inicial"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Mínimo 6 caracteres"
            />

            <div className="flex justify-end gap-3 pt-4 font-bold border-t border-surface-light">
              <Button type="button" variant="ghost" onClick={() => navigate('/admin/usuarios')}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={loadingSubmit}>
                Guardar Usuario
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
