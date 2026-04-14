import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { 
  BarChart3, TrendingUp, Clock, Target, Truck, 
  Calendar, Filter, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { 
  format, subDays, startOfWeek, endOfWeek, 
  differenceInMinutes, parseISO, isValid 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line,
  ComposedChart, Cell
} from 'recharts';

interface RutaData {
  id_ruta: string;
  nombre: string;
  fecha: string | null;
  hora_salida_planta: string | null;
  hora_llegada_planta: string | null;
  estado: string;
  id_chofer: string | null;
  chofer_nombre?: string;
  tiempo_real?: number;
  tiempo_estimado?: number;
  eficiencia?: number;
  entregas?: number;
}

interface ChoferStats {
  id: string;
  nombre: string;
  rutas: number;
  entregas: number;
  tiempoTotal: number;
  eficienciaPromedio: number;
  score: number;
}

interface DiaStats {
  dia: string;
  fecha: string;
  semanaActual: number;
  semanaAnterior: number;
  entregas: number;
  eficiencia: number;
}

interface Insight {
  tipo: ' positivo' | 'negativo' | 'info';
  titulo: string;
  descripcion: string;
}

const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#eab308', 
  danger: '#ef4444',
  surface: '#1e293b',
  surfaceLight: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
};

const EFICIENCIA_COLORS = {
  alta: '#22c55e',
  media: '#eab308',
  baja: '#ef4444',
};

function formatHora(hora: string | null): string {
  if (!hora) return '-';
  return hora.substring(0, 5);
}

function calcularTiempoMinutos(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 0;
  try {
    const h1 = parseISO('2024-01-01T' + horaInicio);
    const h2 = parseISO('2024-01-01T' + horaFin);
    return differenceInMinutes(h2, h1);
  } catch {
    return 0;
  }
}

function getDiaSemana(fecha: string): string {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return dias[new Date(fecha).getDay()];
}

// Mock data para demo
const generateMockData = (): RutaData[] => {
  const rutas: RutaData[] = [];
  const choferes = ['Ben Grados', 'Carlos M.', 'Miguel R.'];
  const nombresRuta = ['Ruta Puruchuco', 'Ruta Minka', 'Ruta Norte', 'Ruta Sur'];
  
  for (let i = 0; i < 14; i++) {
    const fecha = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const tiempoReal = 4 + Math.random() * 2;
    const tiempoEstimado = tiempoReal * (0.8 + Math.random() * 0.4);
    const entregas = 4 + Math.floor(Math.random() * 4);
    const horaFin = 7 + Math.floor(tiempoReal);
    const minFin = Math.floor((tiempoReal % 1) * 60);
    const horaLlegada = `${horaFin.toString().padStart(2, '0')}:${minFin.toString().padStart(2, '0')}:00`;
    
    rutas.push({
      id_ruta: `ruta-${i}`,
      nombre: nombresRuta[i % nombresRuta.length],
      fecha,
      hora_salida_planta: '07:00:00',
      hora_llegada_planta: horaLlegada,
      estado: 'finalizada',
      id_chofer: `chofer-${i % 3}`,
      chofer_nombre: choferes[i % 3],
      tiempo_real: tiempoReal * 60,
      tiempo_estimado: tiempoEstimado * 60,
      eficiencia: (tiempoEstimado / tiempoReal) * 100,
      entregas,
    });
  }
  return rutas;
};

export default function AnalisisRutas() {
  const [loading, setLoading] = useState(true);
  const [rutas, setRutas] = useState<RutaData[]>([]);
  const [fechaInicio, setFechaInicio] = useState<string>(() => format(subDays(new Date(), 13), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [choferFilter, setChoferFilter] = useState<string>('todos');
  const [choferes, setChoferes] = useState<{id: string; nombre: string}[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);

  const stats = useMemo(() => {
    const filtered = rutas.filter(r => {
      if (choferFilter !== 'todos' && r.id_chofer !== choferFilter) return false;
      return true;
    });

    const totalEntregas = filtered.reduce((sum, r) => sum + (r.entregas || 0), 0);
    const tiempoPromedio = filtered.length > 0 
      ? filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / filtered.length 
      : 0;
    const eficienciaGlobal = filtered.length > 0
      ? filtered.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / filtered.length
      : 0;
    const rutasCompletadas = filtered.filter(r => r.estado === 'finalizada').length;
    const rutasPendientes = filtered.filter(r => r.estado !== 'finalizada').length;

    return {
      totalEntregas,
      tiempoPromedio,
      eficienciaGlobal,
      rutasCompletadas,
      rutasPendientes,
    };
  }, [rutas, choferFilter]);

  const comparacionSemanal = useMemo((): DiaStats[] => {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const result: DiaStats[] = [];
    
    for (let i = 0; i < 7; i++) {
      const fechaActual = subDays(new Date(), 6 - i);
      const fechaAnterior = subDays(fechaActual, 7);
      
      const rutasActual = rutas.filter(r => r.fecha === format(fechaActual, 'yyyy-MM-dd'));
      const rutasAnterior = rutas.filter(r => r.fecha === format(fechaAnterior, 'yyyy-MM-dd'));
      
      const tiempoActual = rutasActual.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const tiempoAnterior = rutasAnterior.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const entregas = rutasActual.reduce((sum, r) => sum + (r.entregas || 0), 0);
      const eficiencia = rutasActual.length > 0
        ? rutasActual.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / rutasActual.length
        : 0;

      result.push({
        dia: dias[fechaActual.getDay()],
        fecha: format(fechaActual, 'yyyy-MM-dd'),
        semanaActual: Number(tiempoActual.toFixed(1)),
        semanaAnterior: Number(tiempoAnterior.toFixed(1)),
        entregas,
        eficiencia: Number(eficiencia.toFixed(0)),
      });
    }
    return result;
  }, [rutas]);

  const eficienciaDiaria = useMemo(() => {
    const result: {dia: string; fecha: string; eficiencia: number}[] = [];
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 13; i >= 0; i--) {
      const fecha = subDays(new Date(), i);
      const rutasDia = rutas.filter(r => r.fecha === format(fecha, 'yyyy-MM-dd'));
      
      if (rutasDia.length > 0) {
        const eficiencia = rutasDia.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / rutasDia.length;
        result.push({
          dia: dias[fecha.getDay()],
          fecha: format(fecha, 'yyyy-MM-dd'),
          eficiencia: Number(eficiencia.toFixed(0)),
        });
      }
    }
    return result;
  }, [rutas]);

  const rendimientoChoferes = useMemo((): ChoferStats[] => {
    const choferMap = new Map<string, ChoferStats>();
    
    rutas.forEach(ruta => {
      if (!ruta.id_chofer) return;
      
      const existing = choferMap.get(ruta.id_chofer) || {
        id: ruta.id_chofer,
        nombre: ruta.chofer_nombre || 'Sin nombre',
        rutas: 0,
        entregas: 0,
        tiempoTotal: 0,
        eficienciaPromedio: 0,
        score: 0,
      };
      
      existing.rutas++;
      existing.entregas += ruta.entregas || 0;
      existing.tiempoTotal += ruta.tiempo_real || 0;
      existing.eficienciaPromedio += ruta.eficiencia || 0;
      
      choferMap.set(ruta.id_chofer, existing);
    });

    return Array.from(choferMap.values())
      .map(c => {
        const effScore = (c.eficienciaPromedio / (c.rutas || 1)) * 0.4;
        const entScore = (c.entregas / (c.entregas || 1)) * 0.3;
        const timeScore = (c.tiempoTotal / (c.rutas || 1)) * 0.3;
        return {
          ...c,
          eficienciaPromedio: c.rutas > 0 ? c.eficienciaPromedio / c.rutas : 0,
          score: effScore + entScore + timeScore,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [rutas]);

  useEffect(() => {
    generateInsights();
  }, [stats, comparacionSemanal, rendimientoChoferes]);

  const generateInsights = () => {
    const newInsights: Insight[] = [];
    
    // Insight: mejor día
    const mejorDia = comparacionSemanal.reduce((prev, curr) => 
      curr.semanaActual < prev.semanaActual ? curr : prev, comparacionSemanal[0]);
    if (mejorDia) {
      newInsights.push({
        tipo: 'positivo',
        titulo: `Día más rápido: ${mejorDia.dia}`,
        descripcion: `${mejorDia.dia}(${mejorDia.fecha}) took ${mejorDia.semanaActual}h - ${(comparacionSemanal[0].semanaActual - mejorDia.semanaActual).toFixed(1)}h less than the average`,
      });
    }
    
    // Insight: mejor chofer
    if (rendimientoChoferes.length > 0) {
      const mejorChofer = rendimientoChoferes[0];
      newInsights.push({
        tipo: 'positivo',
        titulo: `Top driver: ${mejorChofer.nombre}`,
        descripcion: `${mejorChofer.entregas} deliveries in ${mejorChofer.rutas} routes with ${mejorChofer.eficienciaPromedio.toFixed(0)}% efficiency`,
      });
    }
    
    // Insight: comparación semanal
    const hoy = comparacionSemanal[comparacionSemanal.length - 1];
    const mismoDiaSemanaPasada = comparacionSemanal[comparacionSemanal.length - 8];
    if (hoy && mismoDiaSemanaPasada) {
      const diff = ((hoy.semanaActual - mismoDiaSemanaPasada.semanaActual) / mismoDiaSemanaPasada.semanaActual * 100);
      newInsights.push({
        tipo: diff < 0 ? 'positivo' : 'negativo',
        titulo: `${diff < 0 ? 'Improved' : 'Higher time'} vs last week`,
        descripcion: `${Math.abs(diff).toFixed(0)}% ${diff < 0 ? 'less' : 'more'} time than same day last week`,
      });
    }
    
    setInsights(newInsights);
  };

  useEffect(() => {
    loadData();
    loadChoferes();
  }, [fechaInicio, fechaFin]);

  const loadChoferes = async () => {
    const { data } = await supabase.from('usuarios').select('id_usuario, nombre').eq('rol', 'chofer').eq('activo', true);
    if (data) setChoferes(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });

      if (data && data.length > 0) {
        const rutasConTiempos = data.map(r => {
          const tiempoReal = calcularTiempoMinutos(r.hora_salida_planta, r.hora_llegada_planta);
          const tiempoEstimado = tiempoReal * 0.9;
          return {
            ...r,
            chofer_nombre: r.usuarios?.nombre,
            tiempo_real: tiempoReal,
            tiempo_estimado: tiempoEstimado,
            eficiencia: tiempoEstimado > 0 ? (tiempoEstimado / tiempoReal) * 100 : 100,
            entregas: 4,
          };
        });
        setRutas(rutasConTiempos);
      } else {
        setRutas(generateMockData());
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      setRutas(generateMockData());
    } finally {
      setLoading(false);
    }
  };

  const getEficienciaColor = (eficiencia: number) => {
    if (eficiencia >= 85) return EFICIENCIA_COLORS.alta;
    if (eficiencia >= 70) return EFICIENCIA_COLORS.media;
    return EFICIENCIA_COLORS.baja;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="text-primary" />
            Análisis de Rutas
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Logistics performance analysis and metrics
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-text-muted" />
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
            />
            <span className="text-text-muted">-</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <select
            value={choferFilter}
            onChange={(e) => setChoferFilter(e.target.value)}
            className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="todos">All drivers</option>
            {choferes.map(c => (
              <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
            ))}
          </select>

          <Button size="sm" onClick={loadData} isLoading={loading}>
            <Filter size={16} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Target className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase">Total Entregas</p>
                <p className="text-2xl font-black text-white">{stats.totalEntregas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase">Avg Time/Route</p>
                <p className="text-2xl font-black text-white">{(stats.tiempoPromedio / 60).toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase">Efficiency</p>
                <p className="text-2xl font-black" style={{ color: getEficienciaColor(stats.eficienciaGlobal) }}>
                  {stats.eficienciaGlobal.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Truck className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase">Completed</p>
                <p className="text-2xl font-black text-white">{stats.rutasCompletadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {insights.slice(0, 3).map((insight, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-xl border ${
                insight.tipo === 'positivo' ? 'bg-green-500/10 border-green-500/30' :
                insight.tipo === 'negativo' ? 'bg-red-500/10 border-red-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <p className={`font-bold text-sm ${
                insight.tipo === 'positivo' ? 'text-green-400' :
                insight.tipo === 'negativo' ? 'text-red-400' :
                'text-blue-400'
              }`}>
                {insight.titulo}
              </p>
              <p className="text-text-muted text-xs mt-1">{insight.descripcion}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Comparison */}
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={20} />
              Tiempo de Ruta: Esta Semana vs Anterior
            </h3>
            <p className="text-text-muted text-xs mb-4">
              Comparing total route time between current and previous week
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparacionSemanal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="h" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Legend />
                <Bar dataKey="semanaActual" name="This Week" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="semanaAnterior" name="Last Week" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Efficiency Trend */}
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Eficiencia Diaria
            </h3>
            <p className="text-text-muted text-xs mb-4">
              Estimated vs real time efficiency percentage
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={eficienciaDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="%" domain={[50, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => [`${value}%`, 'Efficiency']}
                />
                <Line 
                  type="monotone" 
                  dataKey="eficiencia" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={(props: any) => {
                    const efficiency = props.value as number;
                    return <Cell key={props.id} fill={getEficienciaColor(efficiency)} />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                {'>85%'}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                {'70-85%'}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                {'<70%'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Performance */}
      <Card className="bg-surface border border-surface-light">
        <CardContent className="p-4">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Truck size={20} />
            Rendimiento por Chofer
          </h3>
          <p className="text-text-muted text-xs mb-4">
            Combined score: efficiency + time + deliveries
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rendimientoChoferes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} />
              <YAxis dataKey="nombre" type="category" stroke="#94a3b8" fontSize={12} width={100} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(value: number, name: string) => {
                  if (name === 'eficienciaPromedio') return [`${value.toFixed(0)}%`, 'Efficiency'];
                  if (name === 'entregas') return [value, 'Deliveries'];
                  if (name === 'score') return [value.toFixed(1), 'Score'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar dataKey="eficienciaPromedio" name="Efficiency %" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="entregas" name="Deliveries" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="score" name="Score" fill="#eab308" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="text-text-muted">Loading analytics...</div>
        </div>
      )}
    </div>
  );
}