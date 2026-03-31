import React from 'react';
import { useQuery } from '../../../hooks/useQuery';
import type { Ruta } from '../../../types';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Plus, Calendar, Map } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function RutasDiarias() {
  const navigate = useNavigate();
  const { data: rutas, loading, error } = useQuery<Ruta>('rutas', '*', 'fecha');

  if (loading) return <div className="text-white">Cargando rutas...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-500/20 text-yellow-500';
      case 'en_progreso': return 'bg-blue-500/20 text-blue-500';
      case 'finalizada': return 'bg-green-500/20 text-green-500';
      default: return 'bg-surface-light text-text-muted';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Rutas Diarias</h1>
        <Button className="flex items-center gap-2" onClick={() => navigate('/admin/rutas/nueva')}>
          <Plus size={20} /> Crear Ruta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rutas.map((ruta) => (
          <Card key={ruta.id_ruta}>
            <CardContent>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-surface-light p-3 rounded-xl text-primary">
                    <Map size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white mb-1">{ruta.nombre}</h3>
                    <div className="flex items-center text-xs text-text-muted gap-1">
                      <Calendar size={14} />
                      {ruta.fecha ? format(new Date(ruta.fecha), "dd MMM yyyy", { locale: es }) : 'Sin fecha'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-light">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(ruta.estado)}`}>
                  {ruta.estado.replace('_', ' ')}
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/rutas/${ruta.id_ruta}`)}>
                  Ver Detalles
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rutas.length === 0 && (
          <div className="col-span-full text-center py-12 bg-surface border border-surface-light rounded-2xl">
            <p className="text-text-muted">No hay rutas diarias registradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
