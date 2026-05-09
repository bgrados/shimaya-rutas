import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tooltip } from '../../../components/ui/Tooltip';
import {
  BarChart3, TrendingUp, Clock, Target, Truck,
  Calendar, Filter, ChevronDown, ChevronUp,
  Users, RefreshCw, AlertCircle, MapPin
} from 'lucide-react';
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { formatFriendlyDate } from '../../../lib/timezone';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

type Period = 'diario' | 'semanal' | 'mensual';

interface RutaResumen {
  id_ruta: string;
  nombre: string;
  fecha: string;
  estado: string;
  id_chofer: string | null;
  chofer_nombre?: string;
  visitas_realizadas: number;
  duracion_min: number;
  km_recorridos: number;
}

export default function AnalisisRutas() {
  const [period, setPeriod] = useState<Period>('diario');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterChofer, setFilterChofer] = useState('');
  const [loading, setLoading] = useState(true);
  const [rutas, setRutas] = useState<RutaResumen[]>([]);
  const [choferes, setChoferes] = useState<{ id_usuario: string; nombre: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'diario', label: 'Diario' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensual', label: 'Mensual' },
  ];

  function getRange(p: Period, date: string): { from: string; to: string } {
    const d = new Date(date + 'T12:00:00');
    if (p === 'diario') return { from: date, to: date };
    if (p === 'semanal') {
      const fromDate = new Date(d);
      fromDate.setDate(d.getDate() - 7);
      return { from: format(fromDate, 'yyyy-MM-dd'), to: date };
    }
    return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
  }

  useEffect(() => {
    loadChoferes();
  }, []);

  useEffect(() => {
    loadData();
  }, [period, selectedDate, filterChofer]);

  const loadChoferes = async () => {
    const { data } = await supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'chofer').eq('activo', true);
    if (data) setChoferes(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { from, to } = getRange(period, selectedDate);
      const fechaInicio = `${from}T00:00:00-05:00`;
      const fechaFin = `${to}T23:59:59-05:00`;

      let query = supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .eq('estado', 'finalizada')
        .order('fecha', { ascending: false });

      if (filterChofer) query = query.eq('id_chofer', filterChofer);

      const { data: rutasData, error } = await query;
      if (error) throw error;

      if (rutasData && rutasData.length > 0) {
        const ids = rutasData.map(r => r.id_ruta);

        const { data: bitacoraData } = await supabase
          .from('viajes_bitacora')
          .select('id_ruta, destino_nombre')
          .in('id_ruta', ids);

        const visitasPorRuta: Record<string, number> = {};
        (bitacoraData || []).forEach((b: any) => {
          if (b.destino_nombre !== 'Planta') {
            visitasPorRuta[b.id_ruta] = (visitasPorRuta[b.id_ruta] || 0) + 1;
          }
        });

        const processed = rutasData.map(r => {
          let duracion_min = 0;
          if (r.hora_salida_planta && r.hora_llegada_planta) {
            const inicio = new Date(r.hora_salida_planta);
            const fin = new Date(r.hora_llegada_planta);
            duracion_min = Math.round((fin.getTime() - inicio.getTime()) / 1000 / 60);
          }
          const km_recorridos = (r.km_fin || 0) - (r.km_inicio || 0);

          return {
            id_ruta: r.id_ruta,
            nombre: r.nombre,
            fecha: r.fecha,
            estado: r.estado,
            id_chofer: r.id_chofer,
            chofer_nombre: r.usuarios?.nombre,
            visitas_realizadas: visitasPorRuta[r.id_ruta] || 0,
            duracion_min: duracion_min > 0 ? duracion_min : 0,
            km_recorridos: km_recorridos > 0 ? km_recorridos : 0
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
  };

  const { from, to } = getRange(period, selectedDate);
  const rangoLabel = period === 'diario' ? formatFriendlyDate(from) : `${formatFriendlyDate(from)} al ${formatFriendlyDate(to)}`;
  const choferNombre = filterChofer ? choferes.find(c => c.id_usuario === filterChofer)?.nombre || '' : '';

  const stats = useMemo(() => {
    const totalRutas = rutas.length;
    const totalVisitas = rutas.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    const totalHoras = rutas.reduce((sum, r) => sum + (r.duracion_min || 0), 0) / 60;
    const totalKm = rutas.reduce((sum, r) => sum + (r.km_recorridos || 0), 0);
    return { totalRutas, totalVisitas, totalHoras, totalKm };
  }, [rutas]);

  const chartData = useMemo(() => {
    const diasMap: Record<string, { dia: string; rutas: number; visitas: number }> = {};
    rutas.forEach(r => {
      if (!r.fecha) return;
      const dia = format(new Date(r.fecha), 'dd/MM');
      if (!diasMap[dia]) diasMap[dia] = { dia, rutas: 0, visitas: 0 };
      diasMap[dia].rutas += 1;
      diasMap[dia].visitas += r.visitas_realizadas || 0;
    });
    return Object.values(diasMap).slice(-7);
  }, [rutas]);

  const rendimientoChoferes = useMemo(() => {
    const choferMap: Record<string, { nombre: string; rutas: number; visitas: number; km: number; horas: number }> = {};
    rutas.forEach(r => {
      if (!r.id_chofer) return;
      const nombre = r.chofer_nombre || 'Sin nombre';
      if (!choferMap[r.id_chofer]) {
        choferMap[r.id_chofer] = { nombre, rutas: 0, visitas: 0, km: 0, horas: 0 };
      }
      choferMap[r.id_chofer].rutas += 1;
      choferMap[r.id_chofer].visitas += r.visitas_realizadas || 0;
      choferMap[r.id_chofer].km += r.km_recorridos || 0;
      choferMap[r.id_chofer].horas += r.duracion_min || 0;
    });
    return Object.values(choferMap)
      .map(c => ({ ...c, horas: c.horas / 60, eficiencia: c.visitas / (c.horas / 60 || 1) }))
      .sort((a, b) => b.visitas - a.visitas);
  }, [rutas]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-text-muted">Cargando análisis...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-primary" />
              Análisis de Rutas
            </h1>
            <p className="text-text-muted text-sm mt-1">Estadísticas y rendimiento de rutas finalizadas</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={filterChofer} onChange={(e) => setFilterChofer(e.target.value)} className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Todos los choferes</option>
              {choferes.map(c => <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>)}
            </select>
            <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-light text-text-muted hover:text-white text-sm">
              <Filter size={14} /> {showFilters ? 'Ocultar filtros' : 'Filtros avanzados'} {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-surface-light rounded-xl">
            <div className="flex bg-surface-light rounded-xl overflow-hidden border border-white/5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-5 py-2.5 text-sm font-black italic transition-all ${period === p.key ? 'bg-primary text-white' : 'text-text-muted hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-primary" />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-surface-light border border-white/10 rounded-xl px-3 py-2 text-white text-sm" />
            </div>
          </div>
        )}
        <p className="text-xs text-text-muted">📅 Período: <span className="text-primary font-bold">{rangoLabel}</span>{filterChofer && ` · 👤 Chofer: ${choferNombre}`}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface border border-surface-light"><CardContent className="p-5 flex items-center gap-4"><div className="p-2 bg-primary/20 rounded-lg"><Truck className="text-primary" size={22} /></div><div><p className="text-2xl font-black text-white">{stats.totalRutas}</p><p className="text-text-muted text-xs">Rutas</p></div></CardContent></Card>
        <Card className="bg-surface border border-surface-light"><CardContent className="p-5 flex items-center gap-4"><div className="p-2 bg-green-500/20 rounded-lg"><Target className="text-green-400" size={22} /></div><div><p className="text-2xl font-black text-white">{stats.totalVisitas}</p><p className="text-text-muted text-xs">Visitas</p></div></CardContent></Card>
        <Card className="bg-surface border border-surface-light"><CardContent className="p-5 flex items-center gap-4"><div className="p-2 bg-blue-500/20 rounded-lg"><Clock className="text-blue-400" size={22} /></div><div><p className="text-2xl font-black text-white">{stats.totalHoras.toFixed(1)}h</p><p className="text-text-muted text-xs">Horas</p></div></CardContent></Card>
        <Card className="bg-surface border border-surface-light"><CardContent className="p-5 flex items-center gap-4"><div className="p-2 bg-orange-500/20 rounded-lg"><MapPin className="text-orange-400" size={22} /></div><div><p className="text-2xl font-black text-white">{stats.totalKm.toFixed(0)} km</p><p className="text-text-muted text-xs">Kilómetros</p></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface border border-surface-light"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={20} />Rutas por Día</h3><ResponsiveContainer width="100%" height={250}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} /><YAxis stroke="#94a3b8" fontSize={12} /><RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} /><Legend /><Bar dataKey="rutas" name="Rutas" fill="#6366f1" radius={[4, 4, 0, 0]} /><Bar dataKey="visitas" name="Visitas" fill="#22c55e" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>

        <Card className="bg-surface border border-surface-light"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><TrendingUp size={20} />Rendimiento por Chofer</h3>{rendimientoChoferes.length === 0 ? (<p className="text-text-muted text-center py-8">Sin datos en el período</p>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-surface-light text-text-muted text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-2">Chofer</th><th className="text-center py-2 px-2">Rutas</th><th className="text-center py-2 px-2">Visitas</th><th className="text-center py-2 px-2">KM</th><th className="text-center py-2 px-2">Horas</th><th className="text-center py-2 px-2">Eficiencia</th></tr></thead><tbody>{rendimientoChoferes.map((c, i) => (<tr key={i} className="border-b border-white/5"><td className="py-2 px-2 text-white font-medium">{c.nombre}</td><td className="py-2 px-2 text-center text-text-muted">{c.rutas}</td><td className="py-2 px-2 text-center text-text-muted">{c.visitas}</td><td className="py-2 px-2 text-center text-text-muted">{c.km.toFixed(0)}</td><td className="py-2 px-2 text-center text-text-muted">{c.horas.toFixed(1)}</td><td className="py-2 px-2 text-center"><span className="px-2 py-1 rounded text-xs font-bold bg-primary/20 text-primary">{c.eficiencia.toFixed(1)} vis/h</span></td></tr>))}</tbody></table></div>)}</CardContent></Card>
      </div>

      <Card className="bg-surface border border-surface-light"><CardContent className="p-4"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Truck size={20} />Detalle de Rutas</h3>{rutas.length === 0 ? (<p className="text-text-muted text-center py-8">No hay rutas en el período seleccionado</p>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-surface-light text-text-muted text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-2">Ruta</th><th className="text-left py-2 px-2">Chofer</th><th className="text-center py-2 px-2">Fecha</th><th className="text-center py-2 px-2">Visitas</th><th className="text-center py-2 px-2">Duración</th><th className="text-center py-2 px-2">KM</th></tr></thead><tbody>{rutas.map(r => (<tr key={r.id_ruta} className="border-b border-white/5"><td className="py-2 px-2 text-white font-medium">{r.nombre}</td><td className="py-2 px-2 text-text-muted">{r.chofer_nombre || '-'}</td><td className="py-2 px-2 text-center text-text-muted">{formatFriendlyDate(r.fecha)}</td><td className="py-2 px-2 text-center text-text-muted">{r.visitas_realizadas}</td><td className="py-2 px-2 text-center text-text-muted">{r.duracion_min > 0 ? `${Math.floor(r.duracion_min / 60)}h ${r.duracion_min % 60}m` : '-'}</td><td className="py-2 px-2 text-center text-text-muted">{r.km_recorridos > 0 ? `${r.km_recorridos} km` : '-'}</td></tr>))}</tbody></table></div>)}</CardContent></Card>
    </div>
  );
}
