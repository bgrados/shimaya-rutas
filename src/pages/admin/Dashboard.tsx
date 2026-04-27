import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { calcularAsistenciaMensual, getDiaDescansoLabel } from '../../lib/asistencia';
import { ListaAlertas, detectarInconsistenciasGlobales, detectarInconsistenciasRuta } from '../../components/ui/Alertas';
import type { Alerta } from '../../components/ui/Alertas';
import { Truck, MapPin, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Eye, Car, Route, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { formatPeru, formatHoraPeru } from '../../lib/timezone';
import { Link } from 'react-router-dom';
import type { DashboardStats, Usuario, Ruta } from '../../types';
import { useMemo } from 'react';

interface Stats {
  rutasActivas: number;
  rutasPendientes: number;
  rutasFinalizadas: number;
  visitasCompletadas: number;
  visitasPendientes: number;
  localesVisitados: number;
  numeroViajes: number;
  choferesEnRuta: number;
  choferesDisponibles: number;
  choferesDescanso: number;
  choferesSinRuta: number;
  totalChoferes: number;
  gastoCombustibleDia: number;
  gastoCombustibleSemana: number;
  gastoOtrosDia: number;
  gastoOtrosSemana: number;
  gastosHoy: number;
  peajeDia: number;
  peajeSemana: number;
  peajeMes: number;
  kmDia: number;
  kmSemana: number;
  kmMes: number;
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
  tipo?: 'combustible' | 'otros';
}

export default function AdminDashboard() {
  const [error, setError] = useState<string | null>(null);
  const [choferSeleccionado, setChoferSeleccionado] = useState<string | null>(null);
  const [listaChoferes, setListaChoferes] = useState<{id_usuario: string; nombre: string}[]>([]);
  const [mostrarSelectorChofer, setMostrarSelectorChofer] = useState(false);
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
    totalChoferes: 0,
    gastoCombustibleDia: 0,
    gastoCombustibleSemana: 0,
    gastoOtrosDia: 0,
    gastosHoy: 0,
    choferesSinRuta: 0,
    peajeDia: 0,
    peajeSemana: 0,
    peajeMes: 0,
    kmDia: 0,
    kmSemana: 0,
    kmMes: 0
  });
  const [rutasEnProgreso, setRutasEnProgreso] = useState<RutaEnProgreso[]>([]);
  const [topChoferes, setTopChoferes] = useState<TopChofer[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [asistenciaStats, setAsistenciaStats] = useState({ porcentaje: 0, trabajados: 0, descansos: 0, faltas: 0, programados: 0, totalChoferes: 0 });
  const [asistenciaPorChofer, setAsistenciaPorChofer] = useState<{nombre: string; porcentaje: number; trabajados: number; descansos: number; faltan: number; diaDescanso: number}[]>([]);

  useEffect(() => {
    loadChoferesList();
    loadDashboardData();
  }, [choferSeleccionado]);

  const loadChoferesList = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id_usuario, nombre')
      .eq('rol', 'chofer')
      .eq('activo', true)
      .order('nombre');
    if (data) {
      setListaChoferes(data);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    // Timeout de seguridad
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('La consulta está tardando demasiado. Verifica tu conexión.');
    }, 15000);
    
    try {
      const now = new Date();
      const day = now.getDay();
      const hoyStr = format(now, 'yyyy-MM-dd');
      
      const inicioSemana = new Date(now);
      inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
      const semanaStr = format(inicioSemana, 'yyyy-MM-dd');
      
      // Primer día del mes
      const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const mesStr = format(primerDiaMes, 'yyyy-MM-dd');


      let asistenciaQ = supabase.from('asistencia_chofer').select('*').gte('fecha', mesStr).lte('fecha', hoyStr);
      if (choferSeleccionado) {
        asistenciaQ = asistenciaQ.eq('id_chofer', choferSeleccionado);
      }

const usuariosQ = supabase.from('usuarios').select('id_usuario, nombre, fecha_ingreso, dia_descanso').eq('rol', 'chofer').order('nombre');

      const rutasDelMesQ = supabase.from('rutas').select('id_ruta, fecha, id_chofer').gte('fecha', mesStr).lte('fecha', hoyStr);

      const [rutasDelDiaRes, rutasDeSemanaRes, rutasDelMesRes, asistenciaRes, choferesDataRes] = await Promise.all([
        supabase.from('rutas').select('id_ruta').eq('fecha', hoyStr),
        supabase.from('rutas').select('id_ruta').gte('fecha', semanaStr).lte('fecha', hoyStr),
        rutasDelMesQ,
        asistenciaQ,
        usuariosQ
      ]);
      
      const rutaIdsDelDia = rutasDelDiaRes.data?.map(r => r.id_ruta) || [];
      const rutaIdsSemana = rutasDeSemanaRes.data?.map(r => r.id_ruta) || [];
      
      const emptyFilter = [''];
      const filterDia = rutaIdsDelDia.length > 0 ? rutaIdsDelDia : emptyFilter;
      const filterSemana = rutaIdsSemana.length > 0 ? rutaIdsSemana : emptyFilter;

      let combustibleDiaQ = supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', filterDia);
      let combustibleSemanaQ = supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', filterSemana);
      let otrosDiaQ = supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', filterDia);
      let otrosSemanaQ = supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', filterSemana);

      if (choferSeleccionado) {
        combustibleDiaQ = combustibleDiaQ.eq('id_chofer', choferSeleccionado);
        combustibleSemanaQ = combustibleSemanaQ.eq('id_chofer', choferSeleccionado);
        otrosDiaQ = otrosDiaQ.eq('id_chofer', choferSeleccionado);
        otrosSemanaQ = otrosSemanaQ.eq('id_chofer', choferSeleccionado);
      }

const asistenciaDelMesQ = supabase.from('asistencia_chofer').select('*').gte('fecha', mesStr).lte('fecha', hoyStr);

      const usuariosQAsistencia = supabase.from('usuarios').select('id_usuario, nombre, fecha_ingreso, dia_descanso').eq('rol', 'chofer').order('nombre');

      const rutasDelMesQAsistencia = supabase.from('rutas').select('id_ruta, fecha, id_chofer').gte('fecha', mesStr).lte('fecha', hoyStr);

      const [rutasRes, choferesRes, combustibleDiaRes, combustibleSemanaRes, otrosDiaRes, otrosSemanaRes, todosChoferesRes, asistenciaDelMesRes, choferesConInfoRes, rutasDelMesAsistenciaRes] = await Promise.all([
        supabase.from('rutas').select('*'),
        supabase.from('usuarios').select('id_usuario', { count: 'exact', head: true }).eq('rol', 'chofer').eq('activo', true),
        combustibleDiaQ,
        combustibleSemanaQ,
        otrosDiaQ,
        otrosSemanaQ,
        supabase.from('usuarios').select('id_usuario, dias_descanso, fecha_ingreso, dia_descanso').eq('rol', 'chofer').eq('activo', true),
        asistenciaDelMesQ,
        usuariosQAsistencia,
        rutasDelMesQAsistencia
      ]);

      clearTimeout(timeoutId);

      // Verificar si hay errores de permisos
      if (rutasRes.error) {
        if (rutasRes.error.message.includes('permission') || rutasRes.error.code === 'PGRST204') {
          setError('No tienes permisos para ver los datos del Panel de Control. Contacta al administrador.');
          setLoading(false);
          return;
        }
      }

      // Calcular día de descanso
      const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const diaHoy = diasSemana[now.getDay()];
      
      const todosChoferes = (todosChoferesRes.data as Usuario[]) || [];
      const choferesEnDescanso = todosChoferes.filter(c => {
        const diasDescanso = c.dias_descanso || [];
        return diasDescanso.includes(diaHoy);
      });
      const numDescanso = choferesEnDescanso.length;
      const numDisponibles = (choferesRes.count || 0) - numDescanso;
      
      const rutas = rutasRes.data || [];
      // APLICAR FILTRO POR CHOFER SI ESTÁ SELECCIONADO
      const rutasFiltradas = choferSeleccionado ? rutas.filter(r => r.id_chofer === choferSeleccionado) : rutas;
      const rutasDeHoy = rutasFiltradas.filter(r => (r.fecha || '').split('T')[0] === hoyStr);
      const rutasFinalizadas = rutasDeHoy.filter(r => r.estado === 'finalizada');
      const rutasEnCurso = rutasDeHoy.filter(r => r.estado === 'en_progreso');
      const rutasFinalizadasIds = rutasFinalizadas.map(r => r.id_ruta);
      
      // Contar choferes únicos activos SOLO con rutas en curso
      const choferesActivosEnCurso = new Set(rutasEnCurso.map(r => r.id_chofer).filter(Boolean));
      
      // Contar choferes únicos con rutas finalizadas o en curso (para stats)
      const rutasActivasYFinalizadas = [...rutasEnCurso, ...rutasFinalizadas];
      const choferesActivosUnicos = new Set(rutasActivasYFinalizadas.map(r => r.id_chofer).filter(Boolean));
      
      // Calcular choferes sin ruta activa hoy (que no tienen rutas en curso)
      const totalChoferesRegistrados = choferesRes.count || 0;
      const choferesSinRutaActiva = totalChoferesRegistrados - choferesActivosEnCurso.size;
      
      let visitasCompletadas = 0;
      let visitasPendientes = 0;
      let localesVisitados = 0;
      
      if (rutasFinalizadasIds.length > 0) {
        const { data: visData } = await supabase
          .from('locales_ruta')
          .select('estado_visita')
          .in('id_ruta', rutasFinalizadasIds);
        
        if (visData) {
          visitasCompletadas = visData.filter(v => v.estado_visita === 'visitado').length;
          visitasPendientes = visData.filter(v => v.estado_visita === 'pendiente').length;
          localesVisitados = visData.length;
        }
      }
      
      const gastoDia = combustibleDiaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const gastoSemana = combustibleSemanaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const gastoOtrosDia = otrosDiaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      const gastoOtrosSemana = otrosSemanaRes.data?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0;
      
      // Gastos Hoy = cargas combustible + cobros otros de hoy
      const cargasCombustibleHoy = combustibleDiaRes.data?.length || 0;
      const cobrosOtrosHoy = otrosDiaRes.data?.length || 0;
      const gastosHoy = cargasCombustibleHoy + cobrosOtrosHoy;
      
      // Calcular peajes automáticos
      const rutasFinalizadasDeHoy = rutasFiltradas.filter(r => r.estado === 'finalizada' && (r.fecha || '').split('T')[0] === hoyStr);
      const rutasFinalizadasDeSemana = rutasFiltradas.filter(r => r.estado === 'finalizada' && r.fecha >= semanaStr);
      const rutasFinalizadasDelMes = rutasFiltradas.filter(r => r.estado === 'finalizada' && r.fecha >= mesStr);
      
      // Obtener datos de rutas_base para cada ruta (incluyendo del mes)
      const rutasBaseIds = [...new Set([...rutasFinalizadasDeHoy, ...rutasFinalizadasDeSemana, ...rutasFinalizadasDelMes].map(r => r.id_ruta_base).filter(Boolean))];
      let rutasBaseMap: Record<string, { cantidad_peajes: number; costo_peaje: number }> = {};
      
      if (rutasBaseIds.length > 0) {
        const { data: rutasBaseData } = await supabase.from('rutas_base').select('id_ruta_base, cantidad_peajes, costo_peaje').in('id_ruta_base', rutasBaseIds);
        if (rutasBaseData) {
          rutasBaseData.forEach((rb) => {
            rutasBaseMap[rb.id_ruta_base] = {
              cantidad_peajes: rb.cantidad_peajes || 0,
              costo_peaje: rb.costo_peaje || 0
            };
          });
        }
      }
      
      const calcularPeajeRuta = (ruta: any) => {
        const config = rutasBaseMap[ruta.id_ruta_base];
        if (!config || config.cantidad_peajes <= 0) return 0;
        return config.cantidad_peajes * config.costo_peaje;
      };
      
      const peajeDia = rutasFinalizadasDeHoy.reduce((sum, r) => sum + calcularPeajeRuta(r), 0);
      const peajeSemana = rutasFinalizadasDeSemana.reduce((sum, r) => sum + calcularPeajeRuta(r), 0);
      const peajeMes = rutasFinalizadasDelMes.reduce((sum, r) => sum + calcularPeajeRuta(r), 0);
      
      const calcularKmRuta = (ruta: any) => {
        if (ruta.km_inicio != null && ruta.km_fin != null && ruta.km_fin >= ruta.km_inicio) {
          return ruta.km_fin - ruta.km_inicio;
        }
        return 0;
      };

      const kmDia = rutasFinalizadasDeHoy.reduce((sum, r) => sum + calcularKmRuta(r), 0);
      const kmSemana = rutasFinalizadasDeSemana.reduce((sum, r) => sum + calcularKmRuta(r), 0);
      const kmMes = rutasFinalizadasDelMes.reduce((sum, r) => sum + calcularKmRuta(r), 0);
      
      setStats({
        rutasActivas: rutasEnCurso.length,
        rutasPendientes: rutasEnCurso.length,
        rutasFinalizadas: rutasFinalizadas.length,
        visitasCompletadas: visitasCompletadas,
        visitasPendientes: visitasPendientes,
        localesVisitados: localesVisitados,
        numeroViajes: rutasFinalizadas.length,
        choferesEnRuta: choferesActivosEnCurso.size, // Solo rutas en curso
        choferesDisponibles: numDisponibles,
        choferesDescanso: numDescanso,
        choferesSinRuta: choferesSinRutaActiva, // Los que no tienen ruta activa
        totalChoferes: totalChoferesRegistrados,
        gastoCombustibleDia: gastoDia,
        gastoCombustibleSemana: gastoSemana,
        gastoOtrosDia: gastoOtrosDia,
        gastoOtrosSemana: gastoOtrosSemana,
        gastosHoy,
        peajeDia,
        peajeSemana,
        peajeMes,
        kmDia,
        kmSemana,
        kmMes
      });

      const { data: rutasProgreso } = await supabase
        .from('rutas')
        .select('*, usuarios!rutas_id_chofer_fkey(nombre)')
        .eq('fecha', hoyStr)
        .eq('estado', 'en_progreso');
        
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
        .in('id_ruta', filterSemana)
        .order('monto', { ascending: false });

      if (gastosChofer) {
        const groupedCombustible: Record<string, { nombre: string; total: number; cargas: number }> = {};
        const groupedOtros: Record<string, { nombre: string; total: number; cargas: number }> = {};
        
        gastosChofer.forEach((g) => {
          const choferId = g.id_chofer || '';
          if (g.tipo_combustible === 'otro') {
            // Es gasto de "otro" (estacionamiento, peaje, etc.)
            if (!groupedOtros[choferId]) {
              groupedOtros[choferId] = { nombre: g.usuarios?.nombre || 'Sin nombre', total: 0, cargas: 0 };
            }
            groupedOtros[choferId].total += g.monto || 0;
            groupedOtros[choferId].cargas += 1;
          } else {
            // Es gasto de combustible
            if (!groupedCombustible[choferId]) {
              groupedCombustible[choferId] = { nombre: g.usuarios?.nombre || 'Sin nombre', total: 0, cargas: 0 };
            }
            groupedCombustible[choferId].total += g.monto || 0;
            groupedCombustible[choferId].cargas += 1;
          }
        });
        
        const topCombustible = Object.entries(groupedCombustible)
          .map(([id, data]) => ({ chofer_nombre: data.nombre, total_gasto: data.total, cargas: data.cargas, tipo: 'combustible' }))
          .sort((a, b) => b.total_gasto - a.total_gasto)
          .slice(0, 5);
          
        const topOtros = Object.entries(groupedOtros)
          .map(([id, data]) => ({ chofer_nombre: data.nombre, total_gasto: data.total, cargas: data.cargas, tipo: 'otros' }))
          .sort((a, b) => b.total_gasto - a.total_gasto)
          .slice(0, 5);
        
        setTopChoferes([...topCombustible, ...topOtros]);
      }
      
      // Calcular asistencia mensual (SIEMPRE, aunque no haya gastos)
      const choferesConInfo = (choferesConInfoRes.data as any[]) || [];
      const rutasDelMes = (rutasDelMesAsistenciaRes.data as any[]) || [];
      const asistenciaManual = (asistenciaDelMesRes.data as any[]) || [];
      
      let totalTrabajados = 0;
      let totalDescansos = 0;
      let totalFaltas = 0;
      let totalProgramados = 0;
      let choferesConDatos = 0;
      const asistenciaPorChoferList: {nombre: string; porcentaje: number; trabajados: number; descansos: number; faltan: number; diaDescanso: number}[] = [];
      
      choferesConInfo.forEach(chofer => {
        const result = calcularAsistenciaMensual({
          chofer: chofer as any,
          rutasDelMes: rutasDelMes as any,
        });
        
        totalTrabajados += result.trabajados;
        totalDescansos += result.descansos;
        totalFaltas += result.faltan ?? 0;
        totalProgramados += result.programados;
        
        asistenciaPorChoferList.push({
          nombre: chofer.nombre,
          porcentaje: result.porcentaje,
          trabajados: result.trabajados,
          descansos: result.descansos,
          faltan: result.faltan ?? 0,
          diaDescanso: chofer.dia_descanso ?? -1
        });
        
        choferesConDatos++;
      });
      setAsistenciaPorChofer(asistenciaPorChoferList);
      
      const asistenciaPorcentaje = totalProgramados > 0 ? Math.round((totalTrabajados / totalProgramados) * 100) : 0;
      setAsistenciaStats({
        porcentaje: asistenciaPorcentaje,
        trabajados: totalTrabajados,
        descansos: totalDescansos,
        faltas: totalFaltas,
        programados: totalProgramados,
        totalChoferes: choferesConDatos
      });
      
      // Detectar inconsistencias globales (si hay gastos)
      if (gastosChofer) {
        const inconsistencias = detectarInconsistenciasGlobales(
          rutas,
          choferesActivosEnCurso.size,
          totalChoferesRegistrados,
          (combustibleSemanaRes.data || []).map(g => ({ fecha: g.created_at, monto: g.monto || 0 })),
          5
        );
        setAlertas(inconsistencias);
      }
    } catch (err: any) {
      console.error('ERROR DASHBOARD:', err);
      setError('Error al cargar los datos. Intenta de nuevo. ' + (err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => { setError(null); loadDashboardData(); }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

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
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-white">Panel General</h1>
        
        {/* Filtro por Chofer */}
        <div className="relative">
          <button
            onClick={() => setMostrarSelectorChofer(!mostrarSelectorChofer)}
            className="ml-4 px-3 py-1.5 bg-surface-light/30 border border-surface-light rounded-lg text-sm text-white flex items-center gap-2 hover:bg-surface-light/50"
          >
            {choferSeleccionado 
              ? listaChoferes.find(c => c.id_usuario === choferSeleccionado)?.nombre || 'Todos los choferes'
              : 'Todos los choferes'}
            <ChevronDown size={14} className={`transition-transform ${mostrarSelectorChofer ? 'rotate-180' : ''}`} />
          </button>
          
          {mostrarSelectorChofer && (
            <div className="absolute top-full mt-1 left-0 w-48 bg-surface border border-surface-light rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setChoferSeleccionado(null); setMostrarSelectorChofer(false); }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-surface-light/30 flex items-center justify-between"
              >
                <span>Todos los choferes</span>
                {choferSeleccionado === null && <span className="text-primary">✓</span>}
              </button>
              {listaChoferes.map(chofer => (
                <button
                  key={chofer.id_usuario}
                  onClick={() => { setChoferSeleccionado(chofer.id_usuario); setMostrarSelectorChofer(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-surface-light/30 flex items-center justify-between"
                >
                  <span>{chofer.nombre}</span>
                  {choferSeleccionado === chofer.id_usuario && <span className="text-primary">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas de inconsistencias */}
      {alertas.length > 0 && (
        <div className="bg-surface-light/20 border border-surface-light rounded-xl p-4">
          <ListaAlertas alertas={alertas} titulo="Alertas detectadas" />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Truck className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-blue-300 uppercase font-bold flex items-center gap-1">
                  Rutas Activas
                  <Tooltip content="Cantidad de rutas que están en ejecución en este momento." />
                </p>
                <p className="text-2xl font-black text-white">{stats.rutasActivas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Truck className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-green-300 uppercase font-bold flex items-center gap-1">
                  Viajes
                  <Tooltip content="Total de recorridos realizados en el día." />
                </p>
                <p className="text-2xl font-black text-white">{stats.numeroViajes}</p>
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
                <p className="text-xs text-green-300 uppercase font-bold flex items-center gap-1">
                  Locales
                  <Tooltip content="Cantidad de locales programados para visita en el día." />
                </p>
                <p className="text-2xl font-black text-white">{stats.localesVisitados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.choferesEnRuta > 0 ? 'from-primary/20 to-primary/10 border-primary/30' : 'from-surface-light/20 to-surface-light/10 border-surface-light/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.choferesEnRuta > 0 ? 'bg-primary/20' : 'bg-surface-light/30'}`}>
                <Users className={stats.choferesEnRuta > 0 ? 'text-primary' : 'text-text-muted'} size={20} />
              </div>
              <div>
                <p className={`text-xs uppercase font-bold flex items-center gap-1 ${stats.choferesEnRuta > 0 ? 'text-primary' : 'text-text-muted'}`}>
                  Choferes
                  <Tooltip content="Muestra choferes con rutas activas, en descanso o sin ruta asignada." />
                </p>
                <p className={`text-2xl font-black ${stats.choferesEnRuta > 0 ? 'text-white' : 'text-text-muted'}`}>
                  {stats.choferesEnRuta}/{stats.totalChoferes}
                </p>
                {stats.choferesEnRuta > 0 ? (
                  <p className="text-[10px] text-green-400">
                    {stats.choferesEnRuta} en ruta activa
                    {stats.choferesDescanso > 0 && ` · ${stats.choferesDescanso} descanso`}
                  </p>
                ) : (
                  <p className="text-[10px] text-text-muted">
                    Sin rutas activas
                    {stats.choferesDescanso > 0 && ` · ${stats.choferesDescanso} descanso`}
                  </p>
                )}
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
                <p className="text-xs text-yellow-300 uppercase font-bold flex items-center gap-1">
                  Combustible Hoy
                  <Tooltip content="Total gastado en combustible durante el día actual." />
                </p>
                <p className="text-2xl font-black text-white">S/ {stats.gastoCombustibleDia.toFixed(2)}</p>
                <p className="text-xs text-yellow-400/60">Sem: S/ {stats.gastoCombustibleSemana.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Car className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-xs text-blue-300 uppercase font-bold flex items-center gap-1">
                Otros Hoy
                <Tooltip content="Gastos adicionales del día como estacionamiento, peajes u otros." />
              </p>
              <p className="text-2xl font-black text-white">S/ {stats.gastoOtrosDia.toFixed(2)}</p>
              <p className="text-xs text-blue-400/60">Sem: S/ {stats.gastoOtrosSemana.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs flex items-center justify-center gap-1">
              Rutas en Curso
              <Tooltip content="Rutas que actualmente se encuentran en ejecución." />
            </p>
            <p className="text-xl font-bold text-yellow-400">{stats.rutasActivas}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs flex items-center justify-center gap-1">
              Rutas Finalizadas
              <Tooltip content="Rutas que ya fueron completadas correctamente en el día." />
            </p>
            <p className="text-xl font-bold text-green-400">{stats.rutasFinalizadas}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs flex items-center justify-center gap-1">
              Gasto Semana
              <Tooltip content="Total acumulado de combustible durante la semana." />
            </p>
            <p className="text-xl font-bold text-yellow-400">S/ {stats.gastoCombustibleSemana.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border border-surface-light">
          <CardContent className="p-3 text-center">
            <p className="text-text-muted text-xs flex items-center justify-center gap-1">
              Gastos Hoy
              <Tooltip content="Suma total de todos los gastos del día (combustible + otros)." />
            </p>
            <p className="text-xl font-bold text-primary">S/ {(stats.gastoCombustibleDia + stats.gastoOtrosDia).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Peajes Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-orange-300 text-xs flex items-center justify-center gap-1">
              Peajes Hoy
              <Tooltip content="Peajes calculados automáticamente según configuración de rutas." />
            </p>
            <p className="text-xl font-bold text-orange-400">S/ {stats.peajeDia.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-orange-300 text-xs flex items-center justify-center gap-1">
              Peajes Semana
              <Tooltip content="Peajes calculados de la semana según configuración de rutas." />
            </p>
            <p className="text-xl font-bold text-orange-400">S/ {stats.peajeSemana.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-600/20 border-orange-500/50">
          <CardContent className="p-3 text-center">
            <p className="text-orange-300 text-xs flex items-center justify-center gap-1">
              Total Peajes Mes
              <Tooltip content="Suma total de peajes de todas las rutas finalizadas desde el inicio del mes. Se reinicia automáticamente cada nuevo mes." />
            </p>
            <p className="text-xl font-bold text-orange-300">S/ {stats.peajeMes.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Kilometraje */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-emerald-300 text-xs flex items-center justify-center gap-1">
              KM Hoy
              <Tooltip content="Kilometraje total recorrido en rutas finalizadas hoy." />
            </p>
            <p className="text-xl font-bold text-emerald-400">{stats.kmDia} km</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-emerald-300 text-xs flex items-center justify-center gap-1">
              KM Semana
              <Tooltip content="Kilometraje total recorrido en la semana actual." />
            </p>
            <p className="text-xl font-bold text-emerald-400">{stats.kmSemana} km</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-600/20 border-emerald-500/50">
          <CardContent className="p-3 text-center">
            <p className="text-emerald-300 text-xs flex items-center justify-center gap-1">
              KM Mes
              <Tooltip content="Kilometraje total recorrido desde el inicio del mes." />
            </p>
            <p className="text-xl font-bold text-emerald-300">{stats.kmMes} km</p>
          </CardContent>
        </Card>
      </div>

      {/* Asistencia Mensual por Chofer */}
      <Card className="bg-blue-600/20 border-blue-500/50">
        <CardContent className="p-4">
          <p className="text-blue-300 text-xs flex items-center gap-1 mb-4">
            Asistencia Mensual
            <Tooltip content="Calculado desde fecha de ingreso y excluyendo día de descanso" />
          </p>
          {asistenciaPorChofer.length === 0 ? (
            <p className="text-white">Sin datos</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {asistenciaPorChofer.map((c, i) => (
                <div key={i} className="bg-surface-light/30 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-bold text-base">{c.nombre}</h3>
                      <p className="text-blue-300/70 text-xs">Descanso: {getDiaDescansoLabel(c.diaDescanso)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-400 font-black text-2xl">{c.porcentaje}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-500/10 rounded-lg p-2">
                      <p className="text-green-400 font-bold text-lg">{c.trabajados}</p>
                      <p className="text-green-300/70 text-[10px]">Trabajados</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-2">
                      <p className="text-blue-400 font-bold text-lg">{c.descansos}</p>
                      <p className="text-blue-300/70 text-[10px]">Descansos</p>
                    </div>
                    <div className={`rounded-lg p-2 ${c.faltan > 0 ? 'bg-red-500/10' : 'bg-surface-light/20'}`}>
                      <p className={`font-bold text-lg ${c.faltan > 0 ? 'text-red-400' : 'text-text-muted'}`}>{c.faltan}</p>
                      <p className={`text-[10px] ${c.faltan > 0 ? 'text-red-300/70' : 'text-text-muted/70'}`}>Faltas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rutas en Progreso - Agrupadas por Chofer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="text-primary" size={20} />
              Rutas en Progreso
              <Tooltip content="Rutas que actualmente se encuentran en ejecución." />
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
            <div className="space-y-4">
              {/* Agrupar rutas por chofer */}
              {(() => {
                const rutasPorChofer: Record<string, { rutas: RutaEnProgreso[]; chofer: string; placa: string }> = {};
                
                rutasEnProgreso.forEach(ruta => {
                  if (!rutasPorChofer[ruta.chofer_nombre]) {
                    rutasPorChofer[ruta.chofer_nombre] = {
                      rutas: [],
                      chofer: ruta.chofer_nombre,
                      placa: ruta.placa
                    };
                  }
                  rutasPorChofer[ruta.chofer_nombre].rutas.push(ruta);
                });

                return Object.values(rutasPorChofer).map(({ rutas, chofer, placa }) => {
                  const totalVisitas = rutas.reduce((sum, r) => sum + r.visitas_totales, 0);
                  const visitasCompletadas = rutas.reduce((sum, r) => sum + r.visitas_completadas, 0);
                  const progreso = getProgresoPorcentaje(visitasCompletadas, totalVisitas);
                  
                  return (
                    <div key={chofer} className="bg-surface-light/30 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-white font-bold flex items-center gap-2">
                            {chofer}
                            {rutas.length > 1 && (
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                {rutas.length} rutas
                              </span>
                            )}
                          </p>
                          <p className="text-text-muted text-sm">{placa}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-primary font-black text-xl">{progreso}%</p>
                          <p className="text-text-muted text-xs">
                            {visitasCompletadas}/{totalVisitas} visitas
                          </p>
                        </div>
                      </div>
                      
                      <div className="w-full bg-surface rounded-full h-2 mb-3">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>

                      {/* Lista de rutas individuales */}
                      {rutas.length > 1 && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-surface-light/50">
                          {rutas.map((ruta, idx) => {
                            const progRuta = getProgresoPorcentaje(ruta.visitas_completadas, ruta.visitas_totales);
                            return (
                              <div key={ruta.id_ruta} className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">
                                  {idx + 1}. {ruta.nombre}
                                </span>
                                <span className="text-white font-medium">
                                  {progRuta}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {rutas[0].hora_salida && (
                        <p className="text-text-muted text-xs mt-2">
                          Salida: {formatHoraPeru(rutas[0].hora_salida)}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Choferes */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="text-yellow-400" size={20} />
            Top Gastos de Semana
            <Tooltip content="Distribución de gastos de la semana por categoría (combustible y otros)." />
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
                    <span className={`text-[10px] px-2 py-0.5 rounded ${chofer.tipo === 'otros' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                      {chofer.tipo === 'otros' ? 'Otros' : 'Combustible'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">S/ {chofer.total_gasto.toFixed(2)}</p>
                    <p className="text-text-muted text-xs">{chofer.cargas} {chofer.tipo === 'otros' ? 'pagos' : 'cargas'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
