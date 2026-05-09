import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import {
  BarChart3, TrendingUp, Clock, Target, Truck,
  Calendar, Filter, ChevronDown, ChevronUp,
  MapPin, DollarSign
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatFriendlyDate } from '../../../lib/timezone';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

type Period = 'diario' | 'semanal' | 'mensual';

interface RutaConInfo {
  id_ruta: string;
  nombre: string;
  fecha: string;
  estado: string;
  id_chofer: string | null;
  chofer_nombre?: string;
  visitas_realizadas: number;
  km_recorridos: number;
  cantidad_peajes: number;
  peaje_calculado: number;
}

export default function AnalisisRutas() {
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterChofer, setFilterChofer] = useState('');
  const [loading, setLoading] = useState(true);
  const [rutas, setRutas] = useState<RutaConInfo[]>([]);
  const [choferes, setChoferes] = useState<{ id_usuario: string; nombre: string }[]>([]);
  const [rutasBase, setRutasBase] = useState<Record<string, { cantidad_peajes: number; costo_peaje: number }>>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'chofer').eq('activo', true).then(r => r.data && setChoferes(r.data));
    supabase.from('rutas_base').select('id_ruta_base, cantidad_peajes, costo_peaje').then(r => {
      if (r.data) {
        const map: Record<string, { cantidad_peajes: number; costo_peaje: number }> = {};
        r.data.forEach((rb: any) => {
          map[rb.id_ruta_base] = { cantidad_peajes: rb.cantidad_peajes || 0, costo_peaje: rb.costo_peaje || 0 };
        });
        setRutasBase(map);
      }
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [period, selectedDate, filterChofer]);

  function getRange(p: Period, date: string) {
    const d = new Date(date + 'T12:00:00');
    if (p === 'diario') return { from: date, to: date };
    if (p === 'semanal') {
      const fromDate = new Date(d);
      fromDate.setDate(d.getDate() - 7);
      return { from: format(fromDate, 'yyyy-MM-dd'), to: date };
    }
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
  }

  async function loadData() {
    setLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      const inicio = `${from}T00:00:00-05:00`;
      const fin = `${to}T23:59:59-05:00`;

      let query = supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .eq('estado', 'finalizada');
      if (filterChofer) query = query.eq('id_chofer', filterChofer);

      const { data: rutasData, error } = await query;
      if (error) throw error;

      if (rutasData && rutasData.length > 0) {
        const ids = rutasData.map(r => r.id_ruta);

        const { data: bitacoraData } = await supabase
          .from('viajes_bitacora')
          .select('id_ruta')
          .in('id_ruta', ids)
          .neq('destino_nombre', 'Planta');

        const visitasPorRuta: Record<string, number> = {};
        (bitacoraData || []).forEach((b: any) => {
          visitasPorRuta[b.id_ruta] = (visitasPorRuta[b.id_ruta] || 0) + 1;
        });

        const processed = rutasData.map((r: any) => {
          const km = (r.km_fin || 0) - (r.km_inicio || 0);
          const cfg = rutasBase[r.id_ruta_base] || { cantidad_peajes: 0, costo_peaje: 0 };
          const cantidad_peajes = cfg.cantidad_peajes;
          const peaje_calculado = cantidad_peajes * cfg.costo_peaje;

          return {
            id_ruta: r.id_ruta,
            nombre: r.nombre,
            fecha: r.fecha,
            estado: r.estado,
            id_chofer: r.id_chofer,
            chofer_nombre: r.usuarios?.nombre,
            visitas_realizadas: visitasPorRuta[r.id_ruta] || 0,
            km_recorridos: km > 0 ? km : 0,
            cantidad_peajes,
            peaje_calculado
          };
        });
        setRutas(processed);
      } else {
        setRutas([]);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  const { from, to } = getRange(period, selectedDate);
  const rangoLabel = period === 'diario' ? formatFriendlyDate(from) : `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;
  const choferNombre = filterChofer ? choferes.find(c => c.id_usuario === filterChofer)?.nombre || '' : '';

  const stats = useMemo(() => {
    const totalRutas = rutas.length;
    const totalVisitas = rutas.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    const totalKm = rutas.reduce((sum, r) => sum + (r.km_recorridos || 0), 0);
    const totalPeajesCantidad = rutas.reduce((sum, r) => sum + (r.cantidad_peajes || 0), 0);
    const totalPeajeCalculado = rutas.reduce((sum, r) => sum + (r.peaje_calculado || 0), 0);
    return { totalRutas, totalVisitas, totalKm, totalPeajesCantidad, totalPeajeCalculado };
  }, [rutas]);

  const peajesPorChofer = useMemo(() => {
    const choferMap: Record<string, { nombre: string; cantidad: number; calculado: number }> = {};
    rutas.forEach(r => {
      if (!r.id_chofer) return;
      const nombre = r.chofer_nombre || 'Sin nombre';
      if (!choferMap[r.id_chofer]) choferMap[r.id_chofer] = { nombre, cantidad: 0, calculado: 0 };
      choferMap[r.id_chofer].cantidad += r.cantidad_peajes;
      choferMap[r.id_chofer].calculado += r.peaje_calculado;
    });
    return Object.values(choferMap).sort((a, b) => b.calculado - a.calculado);
  }, [rutas]);

  const chartData = useMemo(() => {
    const diasMap: Record<string, { dia: string; rutas: number; visitas: number; peajes: number }> = {};
    rutas.forEach(r => {
      if (!r.fecha) return;
      const dia = format(new Date(r.fecha), 'dd/MM');
      if (!diasMap[dia]) diasMap[dia] = { dia, rutas: 0, visitas: 0, peajes: 0 };
      diasMap[dia].rutas += 1;
      diasMap[dia].visitas += r.visitas_realizadas || 0;
      diasMap[dia].peajes += r.peaje_calculado;
    });
    return Object.values(diasMap).slice(-7);
  }, [rutas]);

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando análisis...</div>;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-white">📊 Análisis de Rutas</h1>
        <div className="flex gap-3">
          <select value={filterChofer} onChange={e => setFilterChofer(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            <option value="">Todos los choferes</option>
            {choferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
          </select>
          <div className="flex bg-gray-800 rounded-lg overflow-hidden">
            {['diario', 'semanal', 'mensual'].map(p => (
              <button key={p} onClick={() => setPeriod(p as Period)} className={`px-4 py-2 text-sm font-medium ${period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {p === 'diario' ? '📅 Diario' : p === 'semanal' ? '📆 Semanal' : '📆 Mensual'}
              </button>
            ))}
          </div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
      </div>

      <p className="text-sm text-gray-400">📅 Período: <span className="text-blue-400">{rangoLabel}</span>{filterChofer && ` · 👤 Chofer: ${choferNombre}`}</p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-blue-500/20 rounded-full"><Truck className="text-blue-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalRutas}</p><p className="text-gray-400 text-sm">Rutas finalizadas <Tooltip content="Total de rutas completadas en el período" /></p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-green-500/20 rounded-full"><Target className="text-green-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalVisitas}</p><p className="text-gray-400 text-sm">Visitas reales <Tooltip content="Paradas en locales (excluye retorno a planta)" /></p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-orange-500/20 rounded-full"><MapPin className="text-orange-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalKm} km</p><p className="text-gray-400 text-sm">Kilómetros <Tooltip content="Kilómetros recorridos (km_fin - km_inicio)" /></p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-indigo-500/20 rounded-full"><DollarSign className="text-indigo-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalPeajesCantidad}</p><p className="text-gray-400 text-sm">Peajes cruzados <Tooltip content="Suma de la cantidad de peajes definidos en las rutas base" /></p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-green-500/20 rounded-full"><DollarSign className="text-green-400" /></div><div><p className="text-3xl font-bold text-white">S/ {stats.totalPeajeCalculado.toFixed(2)}</p><p className="text-gray-400 text-sm">Peajes estimados <Tooltip content="Peajes calculados (cantidad × costo unitario) según rutas base" /></p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4">📈 Rutas vs Visitas vs Peajes</h3><ResponsiveContainer width="100%" height={250}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} /><YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} /><YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} /><RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} /><Legend /><Bar yAxisId="left" dataKey="rutas" name="Rutas" fill="#6366f1" /><Bar yAxisId="left" dataKey="visitas" name="Visitas" fill="#22c55e" /><Bar yAxisId="right" dataKey="peajes" name="Peajes (S/)" fill="#f59e0b" /></BarChart></ResponsiveContainer></CardContent></Card>

        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4">🛣️ Peajes por Chofer</h3>
          {peajesPorChofer.length === 0 ? (<p className="text-gray-400 text-center py-8">Sin datos</p>) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700"><tr className="text-gray-400">
                  <th className="text-left py-2 px-2">Chofer</th>
                  <th className="text-center py-2 px-2">Peajes (cant)</th>
                  <th className="text-center py-2 px-2">Peaje estimado</th>
                </table></thead>
                <tbody>
                  {peajesPorChofer.map((c, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 px-2 text-white">{c.nombre}</td>
                      <td className="py-2 px-2 text-center text-gray-300">{c.cantidad} peajes</td>
                      <td className="py-2 px-2 text-center text-gray-300">S/ {c.calculado.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <h3 className="text-lg font-bold text-white mb-4">📋 Detalle de Rutas</h3>
          {rutas.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No hay rutas en el período seleccionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700"><tr className="text-gray-400">
                  <th className="text-left py-2 px-2">Ruta</th>
                  <th className="text-left py-2 px-2">Chofer</th>
                  <th className="text-center py-2 px-2">Fecha</th>
                  <th className="text-center py-2 px-2">Visitas</th>
                  <th className="text-center py-2 px-2">KM</th>
                  <th className="text-center py-2 px-2">Peajes (cant)</th>
                  <th className="text-center py-2 px-2">Peaje (S/)</th>
                </tr></thead>
                <tbody>
                  {rutas.map(r => (
                    <tr key={r.id_ruta} className="border-b border-gray-700/50">
                      <td className="py-2 px-2 text-white">{r.nombre}</td>
                      <td className="py-2 px-2 text-gray-300">{r.chofer_nombre || '-'}</td>
                      <td className="py-2 px-2 text-center text-gray-300">{formatFriendlyDate(r.fecha)}</td>
                      <td className="py-2 px-2 text-center text-gray-300">{r.visitas_realizadas}</td>
                      <td className="py-2 px-2 text-center text-gray-300">{r.km_recorridos} km</td>
                      <td className="py-2 px-2 text-center"><span className="px-2 py-1 rounded text-xs bg-indigo-500/20 text-indigo-400">{r.cantidad_peajes} peajes</span></td>
                      <td className="py-2 px-2 text-center text-green-400">S/ {r.peaje_calculado.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
