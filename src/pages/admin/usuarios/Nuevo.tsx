import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';

export default function NuevoUsuario() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('chofer');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

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
      // Verificar si ya existe en la tabla usuarios
      const { data: existing } = await supabase
        .from('usuarios')
        .select('id_usuario')
        .eq('email', email)
        .maybeSingle();
      
      if (existing) {
        setError('Este email ya está registrado en el sistema.');
        setLoadingSubmit(false);
        return;
      }

      // Crear usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        throw new Error(authError.message);
      }

      console.log('Auth response:', authData);

      // Obtener el ID del usuario de Auth
      // Si el usuario necesita confirmar email, session será null pero user tendrá el ID
      const userId = authData.user?.id;
      
      if (!userId) {
        throw new Error('No se pudo obtener el ID del usuario. Es posible que el email ya esté registrado.');
      }

      // Insertar en tabla usuarios con el ID correcto de Auth
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert({
          id_usuario: userId,
          nombre,
          email,
          rol,
          telefono: telefono || null,
          activo: true
        });

      if (dbError) {
        console.error('DB error:', dbError);
        throw new Error(dbError.message);
      }

      navigate('/admin/usuarios');
    } catch (err: any) {
      console.error('Error completo:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setLoadingSubmit(false);
    }
  };

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
      
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl text-blue-200 text-sm">
        <strong>Importante:</strong> Esto agregará al usuario en la base de datos de administración y roles. Para que la persona pueda acceder al sistema, debes asegurarte de registrar el mismo correo en el panel de <strong>Authentication</strong> de Supabase y otorgarle una contraseña.
      </div>
    </div>
  );
}
