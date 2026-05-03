import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Truck, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Car, Route, MapPin, DollarSign } from 'lucide-react';
import { DashboardStats } from '../../types';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    rutasActivas: 0,
    rutasPendientes: 0,
    rutasFinalizadas: 0,
    visitasCompletadas: 0,
    visitasPendientes: 0,
    localesVisitados: 0,
    numeroViajes: 0,
    choferesEnRuta: 0,
    choferesDisponibles: 0,
    choferesDescanso: 0,
    choferesSinRuta: 0,
    totalChoferes: 0,
    gastoCombustibleDia: 0,
    gastoCombustibleSemana: 0,
    gastoOtrosDia: 0,
    gastoOtrosSemana: 0,
    gastosHoy: 0,
    peajeDia: 0,
    peajeSemana: 0,
    peajeMes: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const hoy = new Date().toISOString().split('T')[0];
      const inicioSemana = new Date();
      inicioSemana.setDate(inicioSemana.getDate() - 7);
      const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicioMesStr = inicioMes.toISOString().split('T')[0];

      // Rutas
      const { data: rutas } = await supabase
        .from('rutas')
        .select('estado, fecha')
        .gte('fecha', inicioSemanaStr);

      const rutasActivas = rutas?.filter(r => r.estado === 'en_progreso').length || 0;
      const rutasPendientes = rutas?.filter(r => r.estado === 'pendiente').length || 0;
      const rutasFinalizadas = rutas?.filter(r => r.estado === 'finalizada').length || 0;

      // Rutas de hoy para choferes
      const { data: rutasHoy } = await supabase
        .from('rutas')
        .select('id_ruta, id_chofer, estado')
        .eq('fecha', hoy);

      const choferesEnRutaIds = rutasHoy?.filter(r => r.estado === 'en_progreso').map(r => r.id_chofer) || [];

      // Usuarios choferes
      const { data: choferes } = await supabase
        .from('usuarios')
        .select('id_usuario, activo, dias_descanso')
        .eq('rol', 'chofer')
        .eq('activo', true);

      const totalChoferes = choferes?.length || 0;
      const diaSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];
      const choferesDescanso = choferes?.filter(c => c.dias_descanso?.includes(diaSemana)).length || 0;
      const choferesEnRuta = choferesEnRutaIds.length;
      const choferesSinRuta = totalChoferes - choferesEnRuta - choferesDescanso;

      // Locales visitados hoy
      const { data: localesHoy } = await supabase
        .from('locales_ruta')
        .select('estado_visita, id_ruta')
        .in('id_ruta', rutasHoy?.map(r => r.id_ruta) || []);

      const visitasCompletadas = localesHoy?.filter(l => l.estado_visita === 'visitado').length || 0;
      const visitasPendientes = localesHoy?.filter(l => l.estado_visita === 'pendiente').length || 0;

      // Gastos combustible
      const { data: combustibleHoy } = await supabase
        .from('gastos_combustible')
        .select('monto')
        .eq('fecha', hoy);

      const { data: combustibleSemana } = await supabase
        .from('gastos_combustible')
        .select('monto')
        .gte('fecha', inicioSemanaStr);

      const gastoCombustibleDia = combustibleHoy?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const gastoCombustibleSemana = combustibleSemana?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;

      // Peajes
      const { data: peajesHoy } = await supabase
        .from('gastos_peaje')
        .select('monto')
        .eq('fecha', hoy);

      const { data: peajesSemana } = await supabase
        .from('gastos_peaje')
        .select('monto')
        .gte('fecha', inicioSemanaStr);

      const { data: peajesMes } = await supabase
        .from('gastos_peaje')
        .select('monto')
        .gte('fecha', inicioMesStr);

      const peajeDia = peajesHoy?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const peajeSemana = peajesSemana?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const peajeMes = peajesMes?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;

      setStats({
        rutasActivas,
        rutasPendientes,
        rutasFinalizadas,
        visitasCompletadas,
        visitasPendientes,
        localesVisitados: visitasCompletadas,
        numeroViajes: rutasActivas,
        choferesEnRuta,
        choferesDisponibles: choferesSinRuta,
        choferesDescanso,
        choferesSinRuta,
        totalChoferes,
        gastoCombustibleDia,
        gastoCombustibleSemana,
        gastoOtrosDia: 0,
        gastoOtrosSemana: 0,
        gastosHoy: gastoCombustibleDia + peajeDia,
        peajeDia,
        peajeSemana,
        peajeMes,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('[Dashboard] Error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);

  if (loading) return (
    <div className="p-4 text-white text-center mt-10">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
      <p>Cargando panel de control...</p>
    </div>
  );

  if (error) return (
    <div className="p-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadDashboardData} className="px-4 py-2 bg-red-500 text-white rounded">
          Reintentar
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Panel de Control</h1>

      {/* RUTAS HOY */}
      <h2 className="text-sm font-bold text-text-muted uppercase mb-3">Rutas de Hoy</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Route className="text-blue-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase font-bold">En Progreso</p>
                <p className="text-2xl font-black text-white">{stats.rutasActivas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="text-yellow-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-yellow-300 uppercase font-bold">Pendientes</p>
                <p className="text-2xl font-black text-white">{stats.rutasPendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="text-green-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold">Finalizadas</p>
                <p className="text-2xl font-black text-white">{stats.rutasFinalizadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CHOFERES */}
      <h2 className="text-sm font-bold text-text-muted uppercase mb-3">Choferes</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Truck className="text-purple-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-purple-300 uppercase font-bold">En Ruta</p>
                <p className="text-2xl font-black text-white">{stats.choferesEnRuta}</p>
                <p className="text-xs text-text-muted">de {stats.totalChoferes} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <Users className="text-gray-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-300 uppercase font-bold">Disponibles</p>
                <p className="text-2xl font-black text-white">{stats.choferesDisponibles}</p>
                <p className="text-xs text-text-muted">{stats.choferesDescanso} en descanso</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* VISITAS */}
      <h2 className="text-sm font-bold text-text-muted uppercase mb-3">Visitas de Hoy</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <MapPin className="text-green-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold">Completadas</p>
                <p className="text-2xl font-black text-white">{stats.visitasCompletadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <MapPin className="text-orange-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-orange-300 uppercase font-bold">Pendientes</p>
                <p className="text-2xl font-black text-white">{stats.visitasPendientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GASTOS */}
      <h2 className="text-sm font-bold text-text-muted uppercase mb-3">Gastos</h2>
      <div className="grid grid-cols-1 gap-3 mb-6">
        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Fuel className="text-red-400" size={18} />
              </div>
              <p className="text-sm font-bold text-white">Combustible</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted">Hoy</p>
                <p className="text-lg font-black text-white">{formatCurrency(stats.gastoCombustibleDia)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Semana</p>
                <p className="text-lg font-black text-white">{formatCurrency(stats.gastoCombustibleSemana)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <DollarSign className="text-yellow-400" size={18} />
              </div>
              <p className="text-sm font-bold text-white">Peajes</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-muted">Hoy</p>
                <p className="text-lg font-black text-white">{formatCurrency(stats.peajeDia)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Semana</p>
                <p className="text-lg font-black text-white">{formatCurrency(stats.peajeSemana)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Mes</p>
                <p className="text-lg font-black text-white">{formatCurrency(stats.peajeMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-surface-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-500/20 rounded-lg">
                <TrendingUp className="text-teal-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-teal-300 uppercase font-bold">Total Gastos Hoy</p>
                <p className="text-2xl font-black text-white">{formatCurrency(stats.gastosHoy)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
