import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { ListaAlertas, detectarInconsistenciasGlobales, Alerta } from '../../components/ui/Alertas';
import { Truck, MapPin, Users, Fuel, TrendingUp, Clock, CheckCircle, AlertCircle, Car, Route, DollarSign, Activity, ChevronDown, ChevronUp, Calendar, UserCheck, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { formatHoraPeru } from '../../lib/timezone';
import { toDate } from 'date-fns-tz';
import { Link } from 'react-router-dom';

// New Components
import { PerformancePulse } from './dashboard/components/PerformancePulse';
import { StatsGrid } from './dashboard/components/StatsGrid';
import { ChoferesStatus } from './dashboard/components/ChoferesStatus';
import { ActiveRoutes } from './dashboard/components/ActiveRoutes';

interface Stats {
    rutasActivas: number;
    rutasPendientes: number;
    rutasFinalizadas: number;
    visitasCompletadas: number;
    visitasPendientes: number;
    localesVisitados: number;
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
    totalGastosOperativosHoy: number;
}

interface RutaEnProgreso {
    id_ruta: string;
    nombre: string;
    chofer_id: string;
    chofer_nombre: string;
    placa: string;
    estado: string;
    hora_salida: string;
    visitas_totales: number;
    visitas_completadas: number;
}

interface TopChofer {
    chofer_nombre: string;
    total_gasto: number;
    cargas: number;
    tipo?: 'combustible' | 'otros';
}

interface RendimientoDia {
    promedioHistoricoMinutos: number;
    tiempoHoyMinutos: number;
    diferenciaPct: number | null;
    rutasConDatos: number;
    label: string;
}

interface EstadoChofer {
    id: string;
    nombre: string;
    descansoNormal: string;
    tieneExcepcionHoy: boolean;
    descansaHoy: boolean;
    motivo: string;
    enRuta: boolean;
}

const diasMap: Record<string, string> = {
    '0': 'domingo', '1': 'lunes', '2': 'martes', '3': 'miércoles',
    '4': 'jueves', '5': 'viernes', '6': 'sábado', 'ninguno': 'ninguno'
};

export default function Dashboard() {
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats>({
        rutasActivas: 0, rutasPendientes: 0, rutasFinalizadas: 0,
        visitasCompletadas: 0, visitasPendientes: 0, localesVisitados: 0,
        choferesEnRuta: 0, choferesDisponibles: 0, choferesDescanso: 0,
        choferesSinRuta: 0, totalChoferes: 0,
        gastoCombustibleDia: 0, gastoCombustibleSemana: 0,
        gastoOtrosDia: 0, gastoOtrosSemana: 0, gastosHoy: 0,
        peajeDia: 0, peajeSemana: 0,
        totalGastosOperativosHoy: 0
    });
    const [rutasEnProgreso, setRutasEnProgreso] = useState<RutaEnProgreso[]>([]);
    const [topChoferes, setTopChoferes] = useState<TopChofer[]>([]);
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [rendimiento, setRendimiento] = useState<RendimientoDia | null>(null);
    const [estadoChoferes, setEstadoChoferes] = useState<EstadoChofer[]>([]);
    const [loading, setLoading] = useState(true);
    const [choferFilter, setChoferFilter] = useState<string>('todos');
    const [choferes, setChoferes] = useState<{ id_usuario: string; nombre: string }[]>([]);
    const [expandedChoferes, setExpandedChoferes] = useState<Set<string>>(new Set());

    const toggleExpand = (choferId: string) => {
        setExpandedChoferes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(choferId)) {
                newSet.delete(choferId);
            } else {
                newSet.add(choferId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [choferFilter]);

    const calcularMinutos = (inicio: string | null, fin: string | null): number => {
        if (!inicio || !fin) return 0;
        try {
            const toMins = (h: string) => {
                if (h.includes('T')) {
                    const d = toDate(h, { timeZone: 'America/Lima' });
                    return d.getHours() * 60 + d.getMinutes();
                }
                const [hh, mm] = h.split(':').map(Number);
                return (hh || 0) * 60 + (mm || 0);
            };
            const diff = toMins(fin) - toMins(inicio);
            return diff > 0 && diff < 1440 ? diff : 0;
        } catch { return 0; }
    };

    const loadDashboardData = async () => {
        setLoading(true);
        setError(null);

        const timeoutId = setTimeout(() => {
            setLoading(false);
            setError('La consulta está tardando demasiado. Verifica tu conexión.');
        }, 15000);

        try {
            const nowPeru = new Date();
            const hoyStr = format(nowPeru, 'yyyy-MM-dd');
            const inicioSemana = new Date(nowPeru);
            const day = nowPeru.getDay();
            inicioSemana.setDate(inicioSemana.getDate() - day + (day === 0 ? -6 : 1));
            const semanaStr = format(inicioSemana, 'yyyy-MM-dd');
            const hace30 = new Date(nowPeru);
            hace30.setDate(hace30.getDate() - 30);
            const hace30Str = format(hace30, 'yyyy-MM-dd');

            const rutasHoyQuery = supabase.from('rutas').select('*').eq('fecha', hoyStr);
            const rutasSemanaQuery = supabase.from('rutas').select('id_ruta, id_ruta_base').gte('fecha', semanaStr).lte('fecha', hoyStr);
            const rutasHistQuery = supabase.from('rutas').select('hora_salida_planta, hora_llegada_planta, fecha, id_chofer').eq('estado', 'finalizada').gte('fecha', hace30Str);

            if (choferFilter !== 'todos') {
                rutasHoyQuery.eq('id_chofer', choferFilter);
                rutasSemanaQuery.eq('id_chofer', choferFilter);
                rutasHistQuery.eq('id_chofer', choferFilter);
            }

            const [rutasHoyRes, rutasSemanaRes, rutasHistRes, choferesRes, todosChoferesRes] = await Promise.all([
                rutasHoyQuery,
                rutasSemanaQuery,
                rutasHistQuery,
                supabase.from('usuarios').select('id_usuario', { count: 'exact', head: true }).eq('rol', 'chofer').eq('activo', true),
                supabase.from('usuarios').select('id_usuario, nombre, dias_descanso').eq('rol', 'chofer').eq('activo', true)
            ]);

            if (todosChoferesRes?.data) setChoferes(todosChoferesRes.data);

            clearTimeout(timeoutId);

            if (rutasHoyRes.error) {
                setError('Error al cargar rutas. Verifica tu conexión.');
                setLoading(false);
                return;
            }

            const rutasHoy = rutasHoyRes.data || [];
            const rutaIdsDelDia = rutasHoy.map(r => r.id_ruta);
            const rutaIdsSemana = rutasSemanaRes.data?.map(r => r.id_ruta) || [];

            const tieneRutasDia = rutaIdsDelDia.length > 0;
            const tieneRutasSemana = rutaIdsSemana.length > 0;

            let combustibleDiaRes = { data: [] as any[] };
            let combustibleSemanaRes = { data: [] as any[] };
            let otrosDiaRes = { data: [] as any[] };
            let otrosSemanaRes = { data: [] as any[] };

            if (tieneRutasDia) {
                const results = await Promise.all([
                    supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', rutaIdsDelDia),
                    supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', rutaIdsDelDia),
                ]);
                combustibleDiaRes = results[0];
                otrosDiaRes = results[1];
            }

            if (tieneRutasSemana) {
                const results = await Promise.all([
                    supabase.from('gastos_combustible').select('monto').neq('tipo_combustible', 'otro').in('id_ruta', rutaIdsSemana),
                    supabase.from('gastos_combustible').select('monto').eq('tipo_combustible', 'otro').in('id_ruta', rutaIdsSemana),
                ]);
                combustibleSemanaRes = results[0];
                otrosSemanaRes = results[1];
            }

            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const diaHoy = diasSemana[nowPeru.getDay()];
            const todosChoferes = todosChoferesRes.data || [];

            const choferesConEstado: EstadoChofer[] = todosChoferes.map((c: any) => {
                const diasDescansoArray = c.dias_descanso || [];
                const descansoNormalNumerico = diasDescansoArray.length > 0 ? diasDescansoArray[0] : 'ninguno';
                const descansoNormal = diasMap[descansoNormalNumerico] || descansoNormalNumerico;
                const tieneExcepcionHoy = false;
                const descansaExcepcion = false;
                const descansaHoy = descansaExcepcion || (c.dias_descanso || []).includes(diaHoy);

                return {
                    id: c.id_usuario,
                    nombre: c.nombre,
                    descansoNormal,
                    tieneExcepcionHoy,
                    descansaHoy,
                    motivo: descansaHoy ? (tieneExcepcionHoy ? 'Excepción semanal' : 'Descanso fijo') : 'Laborando',
                    enRuta: false
                };
            });

            const rutasEnCurso = rutasHoy.filter(r => r.estado === 'en_progreso');
            const rutasPendientes = rutasHoy.filter(r => r.estado === 'pendiente');
            const rutasFinalizadas = rutasHoy.filter(r => r.estado === 'finalizada');

            const choferesActivosEnCurso = new Set(rutasEnCurso.map(r => r.id_chofer).filter(Boolean));

            choferesConEstado.forEach(c => {
                c.enRuta = choferesActivosEnCurso.has(c.id);
            });

            setEstadoChoferes(choferesConEstado);

            const numDescanso = choferesConEstado.filter(c => c.descansaHoy).length;
            const totalChoferesRegistrados = choferesRes.count || 0;
            const numDisponibles = Math.max(0, totalChoferesRegistrados - numDescanso - choferesActivosEnCurso.size);

            const rutasActivasIds = [...rutasEnCurso, ...rutasFinalizadas].map(r => r.id_ruta);
            let visitasCompletadas = 0, visitasPendientes = 0, localesVisitados = 0;

            if (rutasActivasIds.length > 0) {
                const { data: visData } = await supabase
                    .from('locales_ruta').select('estado_visita').in('id_ruta', rutasActivasIds);
                if (visData) {
                    visitasCompletadas = visData.filter(v => v.estado_visita === 'visitado').length;
                    visitasPendientes = visData.filter(v => v.estado_visita === 'pendiente').length;
                    localesVisitados = visData.length;
                }
            }

            const gastoDia = combustibleDiaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
            const gastoSemana = combustibleSemanaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
            const gastoOtrosDia = otrosDiaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;
            const gastoOtrosSemana = otrosSemanaRes.data?.reduce((s, g) => s + (g.monto || 0), 0) || 0;

            const rutasBaseIds = [...new Set(rutasHoy.map(r => r.id_ruta_base).filter(Boolean))];
            const rutasBaseIdsSemana = [...new Set(rutasSemanaRes.data?.map((_: any) => _.id_ruta_base).filter(Boolean) || [])];
            const rutasBaseMap: Record<string, { cantidad_peajes: number; costo_peaje: number }> = {};

            const allRutasBaseIds = [...new Set([...rutasBaseIds, ...rutasBaseIdsSemana])];
            if (allRutasBaseIds.length > 0) {
                const { data: rbData } = await supabase.from('rutas_base')
                    .select('id_ruta_base, cantidad_peajes, costo_peaje').in('id_ruta_base', allRutasBaseIds);
                rbData?.forEach((rb: any) => {
                    rutasBaseMap[rb.id_ruta_base] = { cantidad_peajes: rb.cantidad_peajes || 0, costo_peaje: rb.costo_peaje || 0 };
                });
            }

            const calcPeaje = (ruta: any) => {
                const cfg = rutasBaseMap[ruta.id_ruta_base];
                return cfg ? cfg.cantidad_peajes * cfg.costo_peaje : 0;
            };

            const peajeDia = rutasFinalizadas.reduce((s, r) => s + calcPeaje(r), 0);
            const rutasSemanaCompletas = rutasSemanaRes.data || [];
            const peajeSemana = rutasSemanaCompletas.reduce((s: number, r: any) => s + calcPeaje(r), 0);
            const totalGastosOperativosHoy = gastoDia + gastoOtrosDia + peajeDia;

            setStats({
                rutasActivas: rutasEnCurso.length,
                rutasPendientes: rutasPendientes.length,
                rutasFinalizadas: rutasFinalizadas.length,
                visitasCompletadas, visitasPendientes, localesVisitados,
                choferesEnRuta: choferesActivosEnCurso.size,
                choferesDisponibles: numDisponibles,
                choferesDescanso: numDescanso,
                choferesSinRuta: totalChoferesRegistrados - choferesActivosEnCurso.size,
                totalChoferes: totalChoferesRegistrados,
                gastoCombustibleDia: gastoDia, gastoCombustibleSemana: gastoSemana,
                gastoOtrosDia, gastoOtrosSemana,
                gastosHoy: gastoDia + gastoOtrosDia,
                peajeDia, peajeSemana,
                totalGastosOperativosHoy
            });

            if (rutasEnCurso.length > 0) {
                const rutasProgresoQuery = supabase
                    .from('rutas').select('*, usuarios!rutas_id_chofer_fkey(nombre)')
                    .eq('fecha', hoyStr).eq('estado', 'en_progreso');

                if (choferFilter !== 'todos') rutasProgresoQuery.eq('id_chofer', choferFilter);

                const { data: rutasProgreso } = await rutasProgresoQuery;

                if (rutasProgreso) {
                    const conVisitas = await Promise.all(rutasProgreso.map(async (r: any) => {
                        const [{ count: total }, { count: completadas }] = await Promise.all([
                            supabase.from('locales_ruta').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta),
                            supabase.from('locales_ruta').select('*', { count: 'exact', head: true }).eq('id_ruta', r.id_ruta).eq('estado_visita', 'visitado')
                        ]);
                        return {
                            id_ruta: r.id_ruta,
                            nombre: r.nombre || 'Ruta sin nombre',
                            chofer_id: r.id_chofer,
                            chofer_nombre: r.usuarios?.nombre || 'Sin chofer',
                            placa: r.placa || '-',
                            estado: r.estado,
                            hora_salida: r.hora_salida_planta,
                            visitas_totales: total || 0,
                            visitas_completadas: completadas || 0,
                        };
                    }));
                    setRutasEnProgreso(conVisitas);
                }
            } else {
                setRutasEnProgreso([]);
            }

            if (tieneRutasSemana) {
                const gastosQuery = supabase
                    .from('gastos_combustible')
                    .select('monto, created_at')
                    .in('id_ruta', rutaIdsSemana);

                if (choferFilter !== 'todos') gastosQuery.eq('id_chofer', choferFilter);

                const { data: gastosSemana } = await gastosQuery;

                const inconsistencias = detectarInconsistenciasGlobales(
                    rutasHoy, choferesActivosEnCurso.size, totalChoferesRegistrados,
                    (gastosSemana || []).map((g: any) => ({ fecha: g.created_at, monto: g.monto })), 5
                );
                setAlertas(inconsistencias);
            }

            if (tieneRutasSemana) {
                const gastosTopQuery = supabase
                    .from('gastos_combustible')
                    .select('*, usuarios!gastos_combustible_id_chofer_fkey(nombre)')
                    .in('id_ruta', rutaIdsSemana);

                if (choferFilter !== 'todos') gastosTopQuery.eq('id_chofer', choferFilter);

                const { data: gastosChofer } = await gastosTopQuery;

                if (gastosChofer) {
                    const grpComb: Record<string, { nombre: string; total: number; cargas: number }> = {};
                    const grpOtros: Record<string, { nombre: string; total: number; cargas: number }> = {};
                    gastosChofer.forEach((g: any) => {
                        const id = g.id_chofer;
                        const grp = g.tipo_combustible === 'otro' ? grpOtros : grpComb;
                        if (!grp[id]) grp[id] = { nombre: g.usuarios?.nombre || 'Sin nombre', total: 0, cargas: 0 };
                        grp[id].total += g.monto || 0;
                        grp[id].cargas++;
                    });
                    const topComb = Object.values(grpComb).map(d => ({ chofer_nombre: d.nombre, total_gasto: d.total, cargas: d.cargas, tipo: 'combustible' as const })).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 5);
                    const topOtros = Object.values(grpOtros).map(d => ({ chofer_nombre: d.nombre, total_gasto: d.total, cargas: d.cargas, tipo: 'otros' as const })).sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 3);
                    setTopChoferes([...topComb, ...topOtros]);
                }
            }

            const histData = rutasHistRes.data || [];
            const diaSemanaHoy = nowPeru.getDay();
            const rutasMismoDia = histData.filter(r => {
                if (!r.fecha) return false;
                try {
                    return toDate(r.fecha + 'T00:00:00', { timeZone: 'America/Lima' }).getDay() === diaSemanaHoy;
                } catch { return false; }
            });

            const tiemposHistoricos = rutasMismoDia
                .map(r => calcularMinutos(r.hora_salida_planta, r.hora_llegada_planta))
                .filter(t => t > 30 && t < 600);

            const promedioHist = tiemposHistoricos.length > 0
                ? tiemposHistoricos.reduce((a, b) => a + b, 0) / tiemposHistoricos.length
                : 0;

            const tiemposHoy = rutasFinalizadas
                .map((r: any) => calcularMinutos(r.hora_salida_planta, r.hora_llegada_planta))
                .filter((t: number) => t > 0);

            const tiempoPromedioHoy = tiemposHoy.length > 0
                ? tiemposHoy.reduce((a: number, b: number) => a + b, 0) / tiemposHoy.length
                : 0;

            const diferenciaPct = promedioHist > 0 && tiempoPromedioHoy > 0
                ? ((tiempoPromedioHoy - promedioHist) / promedioHist) * 100
                : null;

            const diasNombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            setRendimiento({
                promedioHistoricoMinutos: Math.round(promedioHist),
                tiempoHoyMinutos: Math.round(tiempoPromedioHoy),
                diferenciaPct: diferenciaPct !== null ? Math.round(diferenciaPct) : null,
                rutasConDatos: tiemposHistoricos.length,
                label: diasNombres[diaSemanaHoy]
            });

        } catch (err) {
            console.error('[Dashboard] Error:', err);
            setError('Error al cargar los datos. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const formatMins = (mins: number) => {
        if (!mins) return '-';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const getProgreso = (completadas: number, total: number) =>
        total === 0 ? 0 : Math.round((completadas / total) * 100);

    const rutasPorChofer = rutasEnProgreso.reduce((acc, ruta) => {
        if (!acc[ruta.chofer_id]) {
            acc[ruta.chofer_id] = {
                nombre: ruta.chofer_nombre,
                placa: ruta.placa,
                rutas: []
            };
        }
        acc[ruta.chofer_id].rutas.push(ruta);
        return acc;
    }, {} as Record<string, { nombre: string; placa: string; rutas: RutaEnProgreso[] }>);

    if (error) return (
        <div className="p-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={() => { setError(null); loadDashboardData(); }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                    Reintentar
                </button>
            </div>
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-text-muted">Cargando dashboard...</div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-white">Panel General</h1>
                    {choferFilter !== 'todos' && (
                        <div className="bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-xl">
                            <p className="text-primary text-sm font-bold">
                                {choferes.find(c => c.id_usuario === choferFilter)?.nombre || 'Chofer'}
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={choferFilter}
                        onChange={e => setChoferFilter(e.target.value)}
                        className="bg-surface border border-surface-light rounded-lg px-3 py-2 text-white text-sm"
                    >
                        <option value="todos">Todos los choferes</option>
                        {choferes.map(c => (
                            <option key={c.id_usuario} value={c.id_usuario}>{c.nombre}</option>
                        ))}
                    </select>
                    <button onClick={loadDashboardData}
                        className="text-text-muted hover:text-white text-sm flex items-center gap-1">
                        <Clock size={14} /> Actualizar
                    </button>
                </div>
            </div>

            {alertas.length > 0 && (
                <div className="bg-surface-light/20 border border-surface-light rounded-xl p-4">
                    <ListaAlertas alertas={alertas} titulo="Alertas detectadas" />
                </div>
            )}

            <PerformancePulse rendimiento={rendimiento} />

            <StatsGrid stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChoferesStatus estadoChoferes={estadoChoferes} />
                <ActiveRoutes 
                    rutasPorChofer={rutasPorChofer} 
                    expandedChoferes={expandedChoferes} 
                    toggleExpand={toggleExpand} 
                />
            </div>

            {topChoferes.length > 0 && (
                <Card className="border-surface-light/50 bg-surface/30 backdrop-blur-md">
                    <CardContent className="p-5">
                        <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2 mb-6">
                            <TrendingUp className="text-yellow-400" size={20} />
                            Top Gastos de Semana
                            <Tooltip content="Distribución de gastos de la semana por categoría." />
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topChoferes.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-white/5 hover:border-primary/20 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xl font-black italic ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-text-muted'}`}>
                                            #{i + 1}
                                        </span>
                                        <div>
                                            <span className="text-white font-black italic uppercase text-sm">{c.chofer_nombre}</span>
                                            <p className={`text-[10px] font-black uppercase mt-0.5 ${c.tipo === 'otros' ? 'text-blue-400' : 'text-green-400'}`}>
                                                {c.tipo === 'otros' ? 'Otros Gastos' : 'Combustible'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-black italic text-lg">S/ {c.total_gasto.toFixed(2)}</p>
                                        <p className="text-text-muted text-[10px] font-bold uppercase">{c.cargas} {c.tipo === 'otros' ? 'operaciones' : 'cargas'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-surface-light/50 bg-surface/30 backdrop-blur-md">
                <CardContent className="p-5">
                    <h2 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Accesos Rápidos</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <QuickLink to="/admin/rutas/nueva" label="Nueva Ruta" color="blue" />
                        <QuickLink to="/admin/combustible" label="Combustible" color="yellow" />
                        <QuickLink to="/admin/usuarios" label="Choferes" color="green" />
                        <QuickLink to="/admin/reportes" label="Reportes" color="purple" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function QuickLink({ to, label, color }: { to: string, label: string, color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20',
        yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20',
        green: 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20',
        purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
    };

    return (
        <Link to={to} className={`p-4 border rounded-2xl text-center transition-all group ${colors[color]}`}>
            <p className="font-black italic uppercase tracking-widest text-xs group-hover:scale-105 transition-transform">{label}</p>
        </Link>
    );
}