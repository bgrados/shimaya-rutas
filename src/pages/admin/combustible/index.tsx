import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { GastoCombustible, Usuario, Ruta } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Fuel, DollarSign, Truck, Calendar, Check, X, Eye, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';

type TabType = 'pendientes' | 'confirmados' | 'reportes';

export default function GastosCombustible() {
  const [gastos, setGastos] = useState<GastoCombustible[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pendientes');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGastos();
  }, [activeTab]);

  const loadGastos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('gastos_combustible')
        .select('*, usuarios(nombre), rutas(nombre)')
        .order('created_at', { ascending: false });

      if (activeTab === 'pendientes') {
        query = query.eq('estado', 'pendiente_revision');
      } else if (activeTab === 'confirmados') {
        query = query.eq('estado', 'confirmado');
      }

      const { data, error } = await query;

      if (data) {
        const mapped = data.map((g: any) => ({
          ...g,
          chofer_nombre: g.usuarios?.nombre,
          ruta_nombre: g.rutas?.nombre
        }));
        setGastos(mapped as GastoCombustible[]);
      }
    } catch (err) {
      console.error('[Gastos] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (gasto: GastoCombustible) => {
    const { error } = await supabase
      .from('gastos_combustible')
      .update({ estado: 'confirmado' })
      .eq('id_gasto', gasto.id_gasto);

    if (!error) {
      setGastos(prev => prev.filter(g => g.id_gasto !== gasto.id_gasto));
    }
  };

  const handleRechazar = async (gasto: GastoCombustible) => {
    const { error } = await supabase
      .from('gastos_combustible')
      .update({ estado: 'rechazado' })
      .eq('id_gasto', gasto.id_gasto);

    if (!error) {
      setGastos(prev => prev.filter(g => g.id_gasto !== gasto.id_gasto));
    }
  };

  const handleEdit = (gasto: GastoCombustible) => {
    setEditingId(gasto.id_gasto);
    setEditMonto(gasto.monto?.toString() || '');
    setEditTipo(gasto.tipo_combustible || 'glp');
  };

  const handleSaveEdit = async (gasto: GastoCombustible) => {
    if (!editMonto) return;
    setSaving(true);

    const { error } = await supabase
      .from('gastos_combustible')
      .update({ 
        monto: parseFloat(editMonto),
        tipo_combustible: editTipo,
        estado: 'confirmado'
      })
      .eq('id_gasto', gasto.id_gasto);

    if (!error) {
      setEditingId(null);
      setGastos(prev => prev.filter(g => g.id_gasto !== gasto.id_gasto));
    }
    setSaving(false);
  };

  // Calcular totales para reportes
  const totalesPorTipo = gastos.reduce((acc, g) => {
    const tipo = g.tipo_combustible || 'otro';
    acc[tipo] = (acc[tipo] || 0) + (g.monto || 0);
    return acc;
  }, {} as Record<string, number>);

  const totalGeneral = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

  const tabs = [
    { key: 'pendientes', label: 'Pendientes', icon: Filter },
    { key: 'confirmados', label: 'Confirmados', icon: Check },
    { key: 'reportes', label: 'Reportes', icon: DollarSign },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Fuel className="text-primary" />
          Gastos Combustible
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key 
                ? 'bg-primary text-white' 
                : 'bg-surface text-text-muted hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            {tab.key === 'pendientes' && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                {gastos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido según tab */}
      {activeTab === 'reportes' ? (
        <div className="space-y-6">
          {/* Totales por tipo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-green-300 uppercase font-bold">Total GLP</p>
                <p className="text-2xl font-black text-green-400">S/ {(totalesPorTipo.glp || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-blue-300 uppercase font-bold">Total Gasolina</p>
                <p className="text-2xl font-black text-blue-400">S/ {(totalesPorTipo.gasolina || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-orange-300 uppercase font-bold">Total Diesel</p>
                <p className="text-2xl font-black text-orange-400">S/ {(totalesPorTipo.diesel || 0).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-primary uppercase font-bold">TOTAL GENERAL</p>
                <p className="text-2xl font-black text-primary">S/ {totalGeneral.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de gastos */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-light/50 text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Fecha</th>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Chofer</th>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Ruta</th>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Tipo</th>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Monto</th>
                      <th className="px-4 py-3 font-black uppercase text-[10px]">Foto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-light">
                    {gastos.map(gasto => (
                      <tr key={gasto.id_gasto} className="hover:bg-surface-light/20">
                        <td className="px-4 py-3 text-white">
                          {gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td className="px-4 py-3 text-white">{gasto.chofer_nombre || '-'}</td>
                        <td className="px-4 py-3 text-text-muted text-xs">{gasto.ruta_nombre || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-green-400 font-bold">S/ {(gasto.monto || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {gasto.foto_url ? (
                            <a href={gasto.foto_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <Eye size={16} />
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                    {gastos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                          No hay gastos registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Lista de gastos pendientes/confirmados */
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-text-muted">Cargando...</div>
          ) : gastos.length === 0 ? (
            <div className="text-center py-8">
              <Fuel className="mx-auto mb-2 text-text-muted opacity-50" size={48} />
              <p className="text-text-muted">No hay gastos {activeTab}</p>
            </div>
          ) : (
            gastos.map(gasto => (
              <Card key={gasto.id_gasto} className="border-surface-light">
                <CardContent className="p-4">
                  {editingId === gasto.id_gasto ? (
                    /* Modo edición */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-400 font-bold">Editando gasto</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Monto</label>
                          <input
                            type="number"
                            step="0.01"
                            value={editMonto}
                            onChange={e => setEditMonto(e.target.value)}
                            className="w-full bg-background border border-surface-light rounded px-3 py-2 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-text-muted mb-1">Tipo</label>
                          <select
                            value={editTipo}
                            onChange={e => setEditTipo(e.target.value)}
                            className="w-full bg-background border border-surface-light rounded px-3 py-2 text-white"
                          >
                            <option value="glp">GLP</option>
                            <option value="gasolina">Gasolina</option>
                            <option value="diesel">Diesel</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(gasto)} isLoading={saving}>
                          <Check size={16} className="mr-1" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X size={16} className="mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Vista normal */
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">{gasto.chofer_nombre || 'Chofer'}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gasto.tipo_combustible === 'glp' ? 'bg-green-500/20 text-green-400' :
                            gasto.tipo_combustible === 'gasolina' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`}>
                            {gasto.tipo_combustible || 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mb-2">
                          {gasto.ruta_nombre || 'Ruta'} • {gasto.created_at ? format(new Date(gasto.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-bold text-lg">S/ {(gasto.monto || 0).toFixed(2)}</span>
                          {gasto.foto_url && (
                            <a href={gasto.foto_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                              <Eye size={14} /> Ver foto
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {activeTab === 'pendientes' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(gasto)}>
                            Editar
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleConfirmar(gasto)}>
                            <Check size={16} />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRechazar(gasto)}>
                            <X size={16} />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
