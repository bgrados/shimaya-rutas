import React from 'react';
import { useQuery } from '../../../hooks/useQuery';
import type { Usuario } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Plus, User, Shield, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Usuarios() {
  const navigate = useNavigate();
  const { data: usuarios, loading, error } = useQuery<Usuario>('usuarios', '*', 'nombre');

  if (loading) return <div className="text-white">Cargando usuarios...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  const getRoleIcon = (rol: string) => {
    switch (rol) {
      case 'administrador': return <Shield size={20} className="text-primary" />;
      case 'chofer': return <Truck size={20} className="text-blue-500" />;
      default: return <User size={20} className="text-text-muted" />;
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
            <thead className="bg-surface-light text-text-muted">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Rol</th>
                <th className="px-6 py-4 font-medium">Teléfono</th>
                <th className="px-6 py-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-light text-white">
              {usuarios.map((user) => (
                <tr key={user.id_usuario} className="hover:bg-surface-light/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{user.nombre}</td>
                  <td className="px-6 py-4 text-text-muted">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 capitalize">
                      {getRoleIcon(user.rol)} {user.rol}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-muted">{user.telefono || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${user.activo ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
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
