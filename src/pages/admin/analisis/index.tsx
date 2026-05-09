import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import { BarChart3, TrendingUp, Clock, Target, Truck, Calendar, Filter, ChevronDown, ChevronUp, MapPin, DollarSign } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { formatFriendlyDate } from '../../../lib/timezone';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

type Period = 'diario' | 'semanal' | 'mensual';

export default function AnalisisRutas() {
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterChofer, setFilterChofer] = useState('');
  const [loading, setLoading] = useState(true);
  const [rutas, setRutas] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'chofer').eq('activo', true).then(r => r.data && setChoferes(r.data));
  }, []);

  useEffect(() => {
    loadData();
  }, [period, selectedDate, filterChofer]);

  function getRange(p, date) {
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

      let query = supabase.from('rutas').select('*, usuarios!rutas_id_chofer_fkey(nombre)').gte('fecha', inicio).lte('fecha', fin).eq('estado', 'finalizada');
      if (filterChofer) query = query.eq('id_chofer', filterChofer);

      const { data, error } = await query;
      if (error) throw error;

      const processed = (data || []).map(r => {
        const km = (r.km_fin || 0) - (r.km_inicio || 0);
        const peaje_calculado = (r.cantidad_peajes || 0) * (r.costo_peaje || 0);
        return {
          id_ruta: r.id_ruta,
          nombre: r.nombre,
          fecha: r.fecha,
          chofer_nombre: r.usuarios?.nombre,
          visitas_realizadas: r.visitas_realizadas || 0,
          km_recorridos: km > 0 ? km : 0,
          peaje_calculado: peaje_calculado || 0
        };
      });
      setRutas(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const { from, to } = getRange(period, selectedDate);
  const rangoLabel = period === 'diario' ? formatFriendlyDate(from) : `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;
  const choferNombre = filterChofer ? choferes.find(c => c.id_usuario === filterChofer)?.nombre || '' : '';

  const stats = {
    totalRutas: rutas.length,
    totalVisitas: rutas.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0),
    totalKm: rutas.reduce((sum, r) => sum + (r.km_recorridos || 0), 0),
    totalPeaje: rutas.reduce((sum, r) => sum + (r.peaje_calculado || 0), 0)
  };

  const peajesPorChofer = () => {
    const map = {};
    rutas.forEach(r => {
      if (!r.chofer_nombre) return;
      if (!map[r.chofer_nombre]) map[r.chofer_nombre] = { nombre: r.chofer_nombre, total: 0 };
      map[r.chofer_nombre].total += r.peaje_calculado;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  };

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
              <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 text-sm font-medium ${period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {p === 'diario' ? '📅 Diario' : p === 'semanal' ? '📆 Semanal' : '📆 Mensual'}
              </button>
            ))}
          </div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
        </div>
      </div>

      <p className="text-sm text-gray-400">📅 Período: <span className="text-blue-400">{rangoLabel}</span>{filterChofer && ` · 👤 Chofer: ${choferNombre}`}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-blue-500/20 rounded-full"><Truck className="text-blue-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalRutas}</p><p className="text-gray-400 text-sm">Rutas</p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-green-500/20 rounded-full"><Target className="text-green-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalVisitas}</p><p className="text-gray-400 text-sm">Visitas</p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-orange-500/20 rounded-full"><MapPin className="text-orange-400" /></div><div><p className="text-3xl font-bold text-white">{stats.totalKm} km</p><p className="text-gray-400 text-sm">Kilómetros</p></div></CardContent></Card>
        <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-5 flex items-center gap-4"><div className="p-3 bg-green-500/20 rounded-full"><DollarSign className="text-green-400" /></div><div><p className="text-3xl font-bold text-white">S/ {stats.totalPeaje.toFixed(2)}</p><p className="text-gray-400 text-sm">Peajes estimados</p></div></CardContent></Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4">🛣️ Peajes por Chofer</h3>{peajesPorChofer().length === 0 ? (<p className="text-gray-400 text-center py-8">Sin datos</p>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-gray-700"><tr className="text-gray-400"><th className="text-left py-2 px-2">Chofer</th><th className="text-center py-2 px-2">Total Peaje (S/)</th></tr></thead><tbody>{peajesPorChofer().map((c, i) => (<tr key={i} className="border-b border-gray-700/50"><td className="py-2 px-2 text-white">{c.nombre}</td><td className="py-2 px-2 text-center text-green-400">S/ {c.total.toFixed(2)}</td></tr>))}</tbody></table></div>)}</CardContent></Card>

      <Card className="bg-gray-800/50 border-gray-700"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4">📋 Detalle de Rutas</h3>{rutas.length === 0 ? (<p className="text-gray-400 text-center py-8">No hay rutas</p>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-gray-700"><tr className="text-gray-400"><th className="text-left py-2 px-2">Ruta</th><th className="text-left py-2 px-2">Chofer</th><th className="text-center py-2 px-2">Fecha</th><th className="text-center py-2 px-2">Visitas</th><th className="text-center py-2 px-2">KM</th><th className="text-center py-2 px-2">Peaje (S/)</th></tr></thead><tbody>{rutas.map(r => (<tr key={r.id_ruta} className="border-b border-gray-700/50"><td className="py-2 px-2 text-white">{r.nombre}</td><td className="py-2 px-2 text-gray-300">{r.chofer_nombre || '-'}</td><td className="py-2 px-2 text-center text-gray-300">{formatFriendlyDate(r.fecha)}</td><td className="py-2 px-2 text-center text-gray-300">{r.visitas_realizadas}</td><td className="py-2 px-2 text-center text-gray-300">{r.km_recorridos} km</td><td className="py-2 px-2 text-center text-green-400">S/ {r.peaje_calculado.toFixed(2)}</td></tr>))}</tbody></table></div>)}</CardContent></Card>
    </div>
  );
}
