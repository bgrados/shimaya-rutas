import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Truck, MapPin, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface Stats {
  rutasActivas: number;
  rutasPendientes: number;
  rutasFinalizadas: number;
  visitasCompletadas: number;
  visitasPendientes: number;
  choferesEnRuta: number;
  totalChoferes: number;
  gastoCombustibleDia: number;
  gastoCombustibleSemana: number;
  cargasHoy: number;
}

interface RutaEnProgreso {
  id_ruta: string;
  nombre: string;
  chofer_nombre: string;
  placa: string;
  estado: string;
  hora_salida: string;
  visitas_totales: number;
  visitas_completadas: number;
  created_at: string;
}

interface TopChofer {
  chofer_nombre: string;
  total_gasto: number;
  cargas: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    rutasActivas: 0,
    rutasPendientes: 0,
    rutasFinalizadas: 0,
    visitasCompletadas: 0,
    visitasPendientes: 0,
    choferesEnRuta: 0,
    totalChoferes: 0,
    gastoCombustibleDia: 0,
    gastoCombustibleSemana: 0,
    cargasHoy: 0
  });
  const [rutasEnProgreso, setRutasEnProgreso] = useState<RutaEnProgreso[]>([]);
  const [topChoferes, setTopChoferes] = useState<TopChofer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const day = now.getDay();
      const hoyStr = format(now, 'yyyy-MM-dd');
      
      const inicioSemana = new Date(now);
      inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
      const semanaStr = format(inicioSemana, 'yyyy-MM-dd');

      console.log('[Dashboard] Fechas - hoy:', hoyStr, 'semana:', semanaStr);

      const rutasRes = await supabase.from('rutas').select('*').eq('fecha', hoyStr);
      const choferesRes = await supabase.from('usuarios').select('id_usuario').eq('rol', 'chofer').eq('activo', true);
      
      const combustibleDiaRes = await supabase.from('gastos_combustible').select('monto').gte('created_at', `${hoyStr}T00:00:00`);
      const combustibleSemanaRes = await supabase.from('gastos_combustible').select('monto').gte('created_at', `${semanaStr}T00:00:00`);
      
      console.log('[Dashboard] Combustible dia:', combustibleDiaRes.data);
      console.log('[Dashboard] Combustible semana:', combustibleSemanaRes.data);

      const rutas = rutasRes.data || [];
      const rutasIds = rutas.map(r => r.id_ruta);
      
      let visitasCompletadas = 0;
      let visitasPendientes = 0;
      if (rutasIds.length > 0) {
        const { data: visData } = await supabase
          .from('locales_ruta')
          .select('estado_visita, hora_llegada')
          .in('id_ruta', rutasIds);
        
        if (visData) {
          const hoy = new Date().toISOString().split('T')[0];
          const visHoy = visData.filter(v => v.hora_llegada && v.hora_llegada.startsWith(hoy));
          visitasCompletadas = visHoy.filter(v => v.estado_visita === 'visitado').length;
          visitasPendientes = visData.filter(v => v.estado_visita === 'pendiente').length;
        }
      }
      
      console.log('[Dashboard] Rutas:', rutas.map(r => r.estado));
      console.log('[Dashboard] Visitas HOJUE - completadas:', visitasCompletadas, 'pendientes:', visitasPendientes);
      
      const gastoDia = combustibleDiaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const gastoSemana = combustibleSemanaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      
      console.log('[Dashboard] Gasto dia:', gastoDia, 'Gasto semana:', gastoSemana);
      
      setStats({
        rutasActivas: rutas.filter(r => r.estado === 'en_progreso').length,
        rutasPendientes: rutas.filter(r => r.estado === 'pendiente').length,
        rutasFinalizadas: rutas.filter(r => r.estado === 'finalizada').length,
        visitasCompletadas: visitasCompletadas,
        visitasPendientes: visitasPendientes,
        choferesEnRuta: rutas.filter(r => r.estado === 'en_progreso').length,
        totalChoferes: choferesRes.count || 0,
        gastoCombustibleDia: gastoDia,
        gastoCombustibleSemana: gastoSemana,
        cargasHoy: gastoDia
      });

      const { data: rutasProgreso } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .eq('estado', 'en_progreso')
        .limit(5);
        
      if (rutasProgreso) {
        const rutasConVisitas = await Promise.all(
          rutasProgreso.map(async (r: any) => {
            const { count: total } = await supabase
              .from('locales_ruta')
              .select('*', { count: 'exact', head: true })
              .eq('id_ruta', r.id_ruta);
            
            const { count: completadas } = await supabase
              .from('locales_ruta')
              .select('*', { count: 'exact', head: true })
              .eq('id_ruta', r.id_ruta)
              .eq('estado_visita', 'visitado');
            
            return {
              id_ruta: r.id_ruta,
              nombre: r.nombre || 'Ruta sin nombre',
              chofer_nombre: r.usuarios?.nombre || 'Sin chofer',
              placa: r.placa || '-',
              estado: r.estado,
              hora_salida: r.hora_salida_planta,
              visitas_totales: total || 0,
              visitas_completadas: completadas || 0,
              created_at: r.created_at
            };
          })
        );
        setRutasEnProgreso(rutasConVisitas);
      }

      const { data: gastosChofer } = await supabase
        .from('gastos_combustible')
        .select('*, usuarios!gastos_combustible_id_chofer_fkey(nombre)')
        .gte('created_at', `${semanaStr}T00:00:00`)
        .order('monto', { ascending: false });

      if (gastosChofer) {
        const grouped: Record<string, { nombre: string; total: number; cargas: number }> = {};
        gastosChofer.forEach((g: any) => {
          const choferId = g.id_chofer;
          if (!grouped[choferId]) {
            grouped[choferId] = { nombre: g.usuarios?.nombre || 'Sin nombre', total: 0, cargas: 0 };
          }
          grouped[choferId].total += g.monto || 0;
          grouped[choferId].cargas += 1;
        });
        
        const top = Object.entries(grouped)
          .map(([id, data]) => ({ chofer_nombre: data.nombre, total_gasto: data.total, cargas: data.cargas }))
          .sort((a, b) => b.total_gasto - a.total_gasto)
          .slice(0, 5);
        setTopChoferes(top);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProgresoPorcentaje = (completadas: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completadas / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Panel General</h1>
        <button 
          onClick={loadDashboardData}
          className="text-text-muted hover:text-white text-sm flex items-center gap-1"
        >
          <Clock size={14} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Truck className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase font-bold">Rutas Activas</p>
                <p className="text-2xl font-black text-white">{stats.rutasActivas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <MapPin className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold">Visitas</p>
                <p className="text-2xl font-black text-white">{stats.visitasCompletadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Users className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xs text-primary uppercase font-bold">Choferes</p>
                <p className="text-2xl font-black text-white">{stats.choferesEnRuta}/{stats.totalChoferes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Fuel className="text-yellow-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-yellow-300 uppercase font-bold">Combustible Hoy</p>
                <p className="text-2xl font-black text-white">S/ {stats.gastoCombustibleDia.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs">Rutas Pendientes</p>
            <p className="text-xl font-bold text-yellow-400">{stats.rutasPendientes}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs">Rutas Finalizadas</p>
            <p className="text-xl font-bold text-green-400">{stats.rutasFinalizadas}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs">Gasto Semana</p>
            <p className="text-xl font-bold text-yellow-400">S/ {stats.gastoCombustibleSemana.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs">Cargas Hoy</p>
            <p className="text-xl font-bold text-primary">{stats.cargasHoy}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rutas en Progreso */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="text-primary" size={20} />
              Rutas en Progreso
            </h2>
            <Link to="/admin/rutas" className="text-primary text-sm hover:underline">
              Ver todas
            </Link>
          </div>
          
          {rutasEnProgreso.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <AlertCircle className="mx-auto mb-2 opacity-50" size={32} />
              <p>No hay rutas en progreso</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rutasEnProgreso.map(ruta => {
                const progreso = getProgresoPorcentaje(ruta.visitas_completadas, ruta.visitas_totales);
                return (
                  <div key={ruta.id_ruta} className="bg-surface-light/30 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-white font-medium">{ruta.nombre}</p>
                        <p className="text-text-muted text-sm">
                          {ruta.chofer_nombre} • {ruta.placa}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-bold">{progreso}%</p>
                        <p className="text-text-muted text-xs">
                          {ruta.visitas_completadas}/{ruta.visitas_totales} visitas
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                    {ruta.hora_salida && (
                      <p className="text-text-muted text-xs mt-2">
                        Salida: {format(new Date(ruta.hora_salida), 'HH:mm')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Choferes */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <TrendingUp className="text-yellow-400" size={20} />
              Top Gastos - Semana
            </h2>
            
            {topChoferes.length === 0 ? (
              <p className="text-text-muted text-center py-4">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {topChoferes.map((chofer, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-surface-light/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-text-muted'}`}>
                        #{index + 1}
                      </span>
                      <span className="text-white">{chofer.chofer_nombre}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">S/ {chofer.total_gasto.toFixed(2)}</p>
                      <p className="text-text-muted text-xs">{chofer.cargas} cargas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Fuel className="text-green-400" size={20} />
              Estado Combustible
            </h2>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-green-400 text-3xl font-black">S/ {stats.gastoCombustibleDia.toFixed(2)}</p>
                <p className="text-text-muted text-sm">Gasto Hoy</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-yellow-400 text-xl font-bold">{stats.cargasHoy}</p>
                  <p className="text-text-muted text-xs">Cargas Hoy</p>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <p className="text-blue-400 text-xl font-bold">S/ {stats.gastoCombustibleSemana.toFixed(0)}</p>
                  <p className="text-text-muted text-xs">Semana</p>
                </div>
              </div>
              
              <Link 
                to="/admin/combustible"
                className="block w-full text-center py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Ver Detalle Combustible
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-bold text-white mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/admin/rutas/nueva" className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center hover:bg-blue-500/20 transition-colors">
              <p className="text-blue-400 font-medium text-sm">Nueva Ruta</p>
            </Link>
            <Link to="/admin/combustible" className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center hover:bg-yellow-500/20 transition-colors">
              <p className="text-yellow-400 font-medium text-sm">Revisar Combustible</p>
            </Link>
            <Link to="/admin/usuarios" className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center hover:bg-green-500/20 transition-colors">
              <p className="text-green-400 font-medium text-sm">Choferes</p>
            </Link>
            <Link to="/admin/reportes" className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-center hover:bg-purple-500/20 transition-colors">
              <p className="text-purple-400 font-medium text-sm">Reportes</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
