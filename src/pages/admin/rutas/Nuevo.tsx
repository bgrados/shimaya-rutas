import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { RutaBase, Usuario, LocalBase } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NuevaRuta() {
  const navigate = useNavigate();
  const [rutasBase, setRutasBase] = useState<RutaBase[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [asistentes, setAsistentes] = useState<Usuario[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [nombre, setNombre] = useState(`Ruta ${format(new Date(), 'dd/MM/yyyy', { locale: es })}`);
  const [idRutaBase, setIdRutaBase] = useState('');
  const [idChofer, setIdChofer] = useState('');
  const [idAsistente, setIdAsistente] = useState('');
  const [placa, setPlaca] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConfig() {
      const [rutasRes, choferesRes] = await Promise.all([
        supabase.from('rutas_base').select('*').eq('activo', true),
        supabase.from('usuarios').select('*').in('rol', ['chofer', 'descansero']).eq('activo', true).order('nombre'),
        supabase.from('usuarios').select('*').in('rol', ['asistente', 'chofer']).eq('activo', true).order('nombre')
      ]);
      if (rutasRes.data) setRutasBase(rutasRes.data as RutaBase[]);
      if (choferesRes.data) setChoferes(choferesRes.data as Usuario[]);
      if (asistentesRes.data) setAsistentes(asistentesRes.data as Usuario[]);
      setLoadingConfig(false);
    }
    loadConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idRutaBase || !idChofer) {
      setError('Debes seleccionar una ruta base y un chofer asignado.');
      return;
    }

    setLoadingSubmit(true);
    setError('');

    try {
      // 1. Create the new Rutas entry
      const { data: newRoute, error: routeError } = await supabase
        .from('rutas')
        .insert({
          nombre,
          fecha: format(new Date(), 'yyyy-MM-dd'),
          estado: 'pendiente',
          id_ruta_base: idRutaBase,
          id_chofer: idChofer,
          id_asistente: idAsistente || null,
          nombre_asistente: idAsistente ? asistentes.find(a => a.id_usuario === idAsistente)?.nombre : null,
          placa,
          observaciones
        })
        .select()
        .single();

      if (routeError) throw routeError;

      // 2. Fetch all locales_base for this ruta_base
      const { data: localesBase, error: localesError } = await supabase
        .from('locales_base')
        .select('*')
        .eq('id_ruta_base', idRutaBase);

      if (localesError) throw localesError;

      // 3. Insert them into locales_ruta
      if (localesBase && localesBase.length > 0) {
        const localesRutaData = localesBase.map((local: LocalBase) => ({
          id_ruta: newRoute.id_ruta,
          id_local_base: local.id_local_base,
          nombre: local.nombre,
          direccion: local.direccion,
          latitud: local.latitud,
          longitud: local.longitud,
          orden: local.orden,
          estado_visita: 'pendiente'
        }));

        const { error: insertError } = await supabase
          .from('locales_ruta')
          .insert(localesRutaData);

        if (insertError) throw insertError;
      }

      // Success
      navigate('/admin/rutas');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al generar la ruta.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingConfig) return <div className="text-white">Cargando formulario...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Generar Diaria Nueva Ruta</h1>
      
      {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">{error}</div>}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Nombre de la ruta diaria"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Ruta Base (Plantilla)</label>
              <select 
                title="Ruta Base"
                className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none transition-colors"
                value={idRutaBase}
                onChange={e => setIdRutaBase(e.target.value)}
                required
              >
                <option value="">-- Seleccionar --</option>
                {rutasBase.map(r => (
                  <option key={r.id_ruta_base} value={r.id_ruta_base}>{r.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Chofer Asignado</label>
              <select 
                title="Chofer"
                className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none transition-colors"
                value={idChofer}
                onChange={e => setIdChofer(e.target.value)}
                required
              >
                <option value="">-- Seleccionar --</option>
                {choferes.map(c => {
                  const diasDescanso = c.dias_descanso || [];
                  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                  const diaHoy = diasSemana[new Date().getDay()];
                  const tieneDescansoHoy = diasDescanso.includes(diaHoy);
                  return (
                    <option key={c.id_usuario} value={c.id_usuario}>
                      {c.nombre} {tieneDescansoHoy ? '💤 (DESCANSO HOY)' : ''}
                    </option>
                  );
                })}
              </select>
              {idChofer && (() => {
                const choferSeleccionado = choferes.find(c => c.id_usuario === idChofer);
                const diasDescanso = choferSeleccionado?.dias_descanso || [];
                const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                const diaHoy = diasSemana[new Date().getDay()];
                if (diasDescanso.includes(diaHoy)) {
                  return (
                    <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                      ⚠️ Este chofer tiene descanso los días: {diasDescanso.join(', ')}
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Asistente (Ayudante)</label>
              <select 
                title="Asistente"
                className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none transition-colors"
                value={idAsistente}
                onChange={e => setIdAsistente(e.target.value)}
              >
                <option value="">-- Sin asistente --</option>
                {asistentes.map(a => (
                  <option key={a.id_usuario} value={a.id_usuario}>{a.nombre}</option>
                ))}
              </select>
            </div>

            <Input
              label="Placa del Camión"
              placeholder="Ej: ABC-123"
              value={placa}
              onChange={e => setPlaca(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Observaciones</label>
              <textarea
                className="w-full bg-background border border-surface-light rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors min-h-[100px] resize-y"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Instrucciones adicionales..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 font-bold border-t border-surface-light">
              <Button type="button" variant="ghost" onClick={() => navigate('/admin/rutas')}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={loadingSubmit}>
                Generar Ruta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
