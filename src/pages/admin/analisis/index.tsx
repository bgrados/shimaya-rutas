import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { 
  BarChart3, TrendingUp, Clock, Target, Truck, 
  Calendar, Filter, ChevronDown, ChevronUp, Info,
  Users, RefreshCw, AlertCircle
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
  visitas_realizadas: number;
  locales_unicos: number;
  visitas_extra: number;
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
  try {
    if (hora.includes('T')) {
      return hora.split('T')[1].substring(0, 5);
    }
    return hora.substring(0, 5);
  } catch {
    return '-';
  }
}

function formatDurationHuman(mins: number): string {
  if (!mins || mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function calcularTiempoMinutos(horaInicio: string | null, horaFin: string | null): number {
  if (!horaInicio || !horaFin) return 0;
  try {
    const s = new Date(horaInicio);
    const e = new Date(horaFin);
    const diff = e.getTime() - s.getTime();
    return diff > 0 ? Math.floor(diff / (1000 * 60)) : 0;
  } catch {
    return 0;
  }
}

function getDiaSemana(fecha: string): string {
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return dias[new Date(fecha).getDay()];
}

// Datos reales desde Supabase

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

    const totalReal = filtered.reduce((sum, r) => sum + (r.visitas_realizadas || 0), 0);
    const totalUnicos = filtered.reduce((sum, r) => sum + (r.locales_unicos || 0), 0);
    const totalExtra = filtered.reduce((sum, r) => sum + (r.visitas_extra || 0), 0);
    
    const tiempoPromedio = filtered.length > 0 
      ? filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / filtered.length 
      : 0;
    
    const conEficiencia = filtered.filter(r => (r.tiempo_estimado || 0) > 0);
    const eficienciaGlobal = conEficiencia.length > 0
      ? conEficiencia.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / conEficiencia.length
      : null;

    const rutasCompletadas = filtered.filter(r => r.estado === 'finalizada').length;

    return {
      totalReal,
      totalUnicos,
      totalExtra,
      tiempoPromedio,
      eficienciaGlobal,
      rutasCompletadas,
      totalRutas: filtered.length,
      totalHoras: filtered.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60
    };
  }, [rutas, choferFilter]);

  const comparacionSemanal = useMemo((): DiaStats[] => {
    // 0: Domingo, 1: Lunes, ...
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result: DiaStats[] = [];
    
    // Mostramos los últimos 7 días terminando en 'hoy' (fechaFin)
    const end = parseISO(fechaFin);
    
    for (let i = 6; i >= 0; i--) {
      const fechaActual = subDays(end, i);
      const fechaAnterior = subDays(fechaActual, 7);
      
      const rutasActual = rutas.filter(r => r.fecha === format(fechaActual, 'yyyy-MM-dd'));
      const rutasAnterior = rutas.filter(r => r.fecha === format(fechaAnterior, 'yyyy-MM-dd'));
      
      const tiempoActual = rutasActual.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const tiempoAnterior = rutasAnterior.reduce((sum, r) => sum + (r.tiempo_real || 0), 0) / 60;
      const entregas = rutasActual.reduce((sum, r) => sum + (r.entregas || 0), 0);
      
      const conEff = rutasActual.filter(r => (r.tiempo_estimado || 0) > 0);
      const eficiencia = conEff.length > 0
        ? conEff.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / conEff.length
        : 0;

      // Variación diaria
      const variacion = tiempoAnterior > 0 ? ((tiempoActual - tiempoAnterior) / tiempoAnterior) * 100 : 0;

      result.push({
        dia: dias[fechaActual.getDay()],
        fecha: format(fechaActual, 'yyyy-MM-dd'),
        semanaActual: Number(tiempoActual.toFixed(1)),
        semanaAnterior: Number(tiempoAnterior.toFixed(1)),
        entregas,
        eficiencia: Number(eficiencia.toFixed(0)),
        variacion: Number(variacion.toFixed(1))
      } as any);
    }
    return result;
  }, [rutas, fechaFin]);

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
      existing.entregas += ruta.visitas_realizadas || 0;
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
    
    if (rutas.length === 0) return;

    // 1. Variación de tiempo total semanal (Prioridad)
    const horasActual = comparacionSemanal.reduce((s, d) => s + d.semanaActual, 0);
    const horasAnterior = comparacionSemanal.reduce((s, d) => s + d.semanaAnterior, 0);
    
    if (horasAnterior > 0) {
      const diff = ((horasActual - horasAnterior) / horasAnterior) * 100;
      newInsights.push({
        tipo: diff < 0 ? ' positivo' : 'negativo',
        titulo: `${diff < 0 ? 'Se redujo' : 'Incrementó'} ${Math.abs(diff).toFixed(0)}% el tiempo total`,
        descripcion: `Vs la semana anterior (${horasAnterior.toFixed(1)}h → ${horasActual.toFixed(1)}h).`,
      });
    }

    // 2. Día más lento
    const diaLento = [...comparacionSemanal].sort((a, b) => b.semanaActual - a.semanaActual)[0];
    if (diaLento && diaLento.semanaActual > 0) {
      newInsights.push({
        tipo: 'negativo',
        titulo: `Día más lento: ${diaLento.dia}`,
        descripcion: `Registró el mayor tiempo de ruta en el periodo (${diaLento.semanaActual}h).`,
      });
    }
    
    // 3. Visitas extra (Ineficiencias)
    const extraVisits = stats.totalExtra;
    if (extraVisits > 0) {
      newInsights.push({
        tipo: 'negativo',
        titulo: `Se detectaron ${extraVisits} visitas adicionales`,
        descripcion: `Posibles regresos a locales o redundancias en las rutas del periodo.`,
      });
    }

    // 4. Chofer destacado
    if (rendimientoChoferes.length > 0) {
      const mejorChofer = rendimientoChoferes[0];
      newInsights.push({
        tipo: ' positivo',
        titulo: `Chofer más eficiente: ${mejorChofer.nombre}`,
        descripcion: `Logró el mejor balance entre paradas totales y tiempo de ruta.`,
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
      // 1. Fetch rutas in range
      const { data: rutasData, error: rutasError } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
        .order('fecha', { ascending: false });

      if (rutasError) throw rutasError;

      // 2. Fetch viajes_bitacora to count REAL visits (excluding Planta)
      const { data: bitacoraData, error: bitacoraError } = await supabase
        .from('viajes_bitacora')
        .select('id_ruta, destino_nombre, hora_llegada')
        .in('id_ruta', rutasData?.map(r => r.id_ruta) || []);

      if (bitacoraError) throw bitacoraError;

      if (rutasData && rutasData.length > 0) {
        const processed = rutasData.map(r => {
          const tReal = calcularTiempoMinutos(r.hora_salida_planta, r.hora_llegada_planta);
          
          // Filtro de paradas reales (idéntico a Viajes.tsx)
          const segments = bitacoraData?.filter(b => 
            b.id_ruta === r.id_ruta && 
            b.hora_llegada && 
            b.destino_nombre !== 'Planta'
          ) || [];

          const totalVisitas = segments.length;
          
          // Contar locales únicos
          const uniqueLocales = new Set(segments.map(s => s.destino_nombre?.toLowerCase().trim())).size;
          
          // Por ahora no hay tiempo_estimado en DB
          const tEstimado = 0; 
          
          return {
            ...r,
            chofer_nombre: r.usuarios?.nombre,
            tiempo_real: tReal,
            tiempo_estimado: tEstimado,
            eficiencia: tEstimado > 0 ? (tEstimado / tReal) * 100 : 0,
            visitas_realizadas: totalVisitas,
            locales_unicos: uniqueLocales,
            visitas_extra: totalVisitas - uniqueLocales
          };
        });
        setRutas(processed);
      } else {
        setRutas([]);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
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
            Análisis de desempeño logístico y métricas
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
            <option value="todos">Todos los choferes</option>
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
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-surface border border-surface-light overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <BarChart3 className="text-indigo-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Total Horas</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-black text-white">{stats.totalHoras.toFixed(1)}h</p>
                  {(() => {
                    const hActual = comparacionSemanal.reduce((s, d) => s + d.semanaActual, 0);
                    const hAnterior = comparacionSemanal.reduce((s, d) => s + d.semanaAnterior, 0);
                    if (hAnterior > 0) {
                      const diff = ((hActual - hAnterior) / hAnterior) * 100;
                      return (
                        <span className={`text-[10px] font-bold ${diff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff < 0 ? '↓' : '↑'} {Math.abs(diff).toFixed(0)}%
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Vs la semana anterior</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Target className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Visitas Realizadas</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-white">{stats.totalReal}</p>
                  <span className="text-[10px] text-text-muted">Total paradas</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">* Coincide con Seguimiento en Vivo</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Locales Únicos</p>
                <p className="text-xl font-black text-white">{stats.totalUnicos}</p>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Clientes distintos visitados</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <RefreshCw className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Visitas Extra</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-white">{stats.totalExtra}</p>
                  {stats.totalExtra > 0 && <span className="text-[10px] text-red-400 font-bold animate-pulse">Regresos</span>}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-text-muted mt-1 italic">Ineficiencias detectadas</p>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Truck className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold">Rutas</p>
                <p className="text-xl font-black text-white">{stats.rutasCompletadas}/{stats.totalRutas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Alerts */}
      {stats.totalRutas > 0 && stats.rutasCompletadas < stats.totalRutas && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-yellow-500" size={20} />
          <div>
            <p className="text-yellow-500 text-sm font-bold">Hay rutas incompletas</p>
            <p className="text-yellow-500/70 text-xs">Existen {stats.totalRutas - stats.rutasCompletadas} rutas que aún no han sido finalizadas en este periodo.</p>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {insights.slice(0, 3).map((insight, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-xl border ${
                insight.tipo.includes('positivo') ? 'bg-green-500/10 border-green-500/30' :
                insight.tipo.includes('negativo') ? 'bg-red-500/10 border-red-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}
            >
              <p className={`font-bold text-sm ${
                insight.tipo.includes('positivo') ? 'text-green-400' :
                insight.tipo.includes('negativo') ? 'text-red-400' :
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
              Comparando tiempo total de ruta entre semana actual y semana anterior
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
                <Bar dataKey="semanaActual" name="Esta semana" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="semanaAnterior" name="Semana anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
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
              Porcentaje de eficiencia tiempo estimado vs real
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={eficienciaDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="%" domain={[50, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(value: number, name: string, props: any) => {
                    const label = name === 'semanaActual' ? 'Esta semana' : 'Semana anterior';
                    const variacion = props.payload.variacion;
                    if (name === 'semanaActual' && variacion !== 0) {
                      return [`${value}h (${variacion > 0 ? '+' : ''}${variacion}%)`, label];
                    }
                    return [`${value}h`, label];
                  }}
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
            Puntaje combinado: eficiencia + tiempo + entregas
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
                  if (name === 'eficienciaPromedio') return [`${value.toFixed(0)}%`, 'Eficiencia'];
                  if (name === 'entregas') return [value, 'Visitas Realizadas'];
                  if (name === 'score') return [value.toFixed(1), 'Score General'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar dataKey="eficienciaPromedio" name="Eficiencia %" fill="#22c55e" radius={[0, 4, 4, 0]} />
              <Bar dataKey="entregas" name="Visitas Realizadas" fill="#6366f1" radius={[0, 4, 4, 0]} />
              <Bar dataKey="score" name="Score General" fill="#eab308" radius={[0, 4, 4, 0]} />
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