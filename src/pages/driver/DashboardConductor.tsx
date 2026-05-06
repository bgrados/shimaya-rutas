import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { Truck, MapPin, Clock, Calendar, TrendingUp, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatFriendlyDate } from '../../lib/timezone';

interface RutaPropia {
    id_ruta: string;
    nombre: string;
    fecha: string;
    estado: string;
    duracion_min?: number;
    km_recorridos?: number;
    visitas_realizadas: number;
}

interface StatsPropios {
    km_hoy: number;
    visitas_hoy: number;
    tiempo_hoy_min: number;
    rutas_completadas_semana: number;
    horas_semana_actual: number;
    horas_semana_anterior: number;
    porcentaje_cambio: number | null;
}

interface RutaPendiente {
    id_ruta: string;
    nombre: string;
    fecha: string;
    faltantes: string[];
    faltantesTexto: string;
}

export default function DashboardConductor() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [rutaActiva, setRutaActiva] = useState<RutaPropia | null>(null);
    const [ultimasRutas, setUltimasRutas] = useState<RutaPropia[]>([]);
    const [rutasPendientes, setRutasPendientes] = useState<RutaPendiente[]>([]);
    const [proximoDescanso, setProximoDescanso] = useState<string | null>(null);
    const [excepcionProxima, setExcepcionProxima] = useState<{ fecha: string; estado: string } | null>(null);
    const [stats, setStats] = useState<StatsPropios>({
        km_hoy: 0,
        visitas_hoy: 0,
        tiempo_hoy_min: 0,
        rutas_completadas_semana: 0,
        horas_semana_actual: 0,
        horas_semana_anterior: 0,
        porcentaje_cambio: null
    });

    useEffect(() => {
        cargarDatos();
    }, [profile?.id_usuario]);

    const cargarRutasPendientes = async () => {
        if (!profile?.id_usuario) return;

        const hace7Dias = new Date();
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        const hace7DiasStr = format(hace7Dias, 'yyyy-MM-dd');

        const { data: rutas } = await supabase
            .from('rutas')
            .select('*')
            .eq('id_chofer', profile.id_usuario)
            .eq('estado', 'finalizada')
            .gte('fecha', hace7DiasStr)
            .order('fecha', { ascending: false });

        if (!rutas) return;

        const pendientes: RutaPendiente[] = [];

        for (const ruta of rutas) {
            const faltantes: string[] = [];

            if (!ruta.km_fin || ruta.km_fin === 0) {
                faltantes.push('km_fin');
            }

            const { data: gastos } = await supabase
                .from('gastos_combustible')
                .select('id_gasto, foto_url, tipo_combustible')
                .eq('id_ruta', ruta.id_ruta);

            const gastosSinFoto = gastos?.filter(g => !g.foto_url) || [];
            if (gastosSinFoto.length > 0) {
                const tieneCombustible = gastosSinFoto.some(g => g.tipo_combustible !== 'peaje' && g.tipo_combustible !== 'peaje_compromiso');
                const tienePeaje = gastosSinFoto.some(g => g.tipo_combustible === 'peaje' || g.tipo_combustible === 'peaje_compromiso');
                if (tieneCombustible) faltantes.push('fotos_combustible');
                if (tienePeaje) faltantes.push('fotos_peaje');
            }

            const { data: bitacora } = await supabase
                .from('viajes_bitacora')
                .select('id_bitacora, hora_llegada')
                .eq('id_ruta', ruta.id_ruta);

            const tramosSinLlegada = bitacora?.filter(b => !b.hora_llegada) || [];
            if (tramosSinLlegada.length > 0) {
                faltantes.push(`llegadas (${tramosSinLlegada.length})`);
            }

            if (faltantes.length > 0) {
                pendientes.push({
                    id_ruta: ruta.id_ruta,
                    nombre: ruta.nombre || 'Sin nombre',
                    fecha: ruta.fecha,
                    faltantes,
                    faltantesTexto: faltantes.join(', ')
                });
            }
        }

        setRutasPendientes(pendientes);
    };

    const cargarDatos = async () => {
        if (!profile?.id_usuario) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const hoyStr = format(new Date(), 'yyyy-MM-dd');
            const inicioSemana = new Date();
            const dia = inicioSemana.getDay();
            const diffLunes = dia === 0 ? -6 : 1 - dia;
            inicioSemana.setDate(inicioSemana.getDate() + diffLunes);
            const inicioSemanaStr = format(inicioSemana, 'yyyy-MM-dd');
            const finSemanaStr = format(new Date(), 'yyyy-MM-dd');

            // 1. Ruta activa
            const { data: rutaActivaData } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_chofer', profile.id_usuario)
                .in('estado', ['pendiente', 'en_progreso'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (rutaActivaData) {
                const { data: bitacoraData } = await supabase
                    .from('viajes_bitacora')
                    .select('id_bitacora')
                    .eq('id_ruta', rutaActivaData.id_ruta)
                    .not('hora_llegada', 'is', null);

                setRutaActiva({
                    id_ruta: rutaActivaData.id_ruta,
                    nombre: rutaActivaData.nombre || 'Sin nombre',
                    fecha: rutaActivaData.fecha,
                    estado: rutaActivaData.estado,
                    visitas_realizadas: bitacoraData?.length || 0
                });
            } else {
                setRutaActiva(null);
            }

            // 2. Últimas 5 rutas finalizadas
            const { data: rutasData } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_chofer', profile.id_usuario)
                .eq('estado', 'finalizada')
                .order('fecha', { ascending: false })
                .limit(5);

            if (rutasData) {
                const rutasConVisitas = await Promise.all(rutasData.map(async (r) => {
                    const { count: visitas } = await supabase
                        .from('viajes_bitacora')
                        .select('*', { count: 'exact', head: true })
                        .eq('id_ruta', r.id_ruta)
                        .not('hora_llegada', 'is', null);

                    let duracion = 0;
                    if (r.hora_salida_planta && r.hora_llegada_planta) {
                        duracion = Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 60000);
                    }

                    let km = 0;
                    if (r.km_inicio && r.km_fin && r.km_fin > r.km_inicio) {
                        km = r.km_fin - r.km_inicio;
                    }

                    return {
                        id_ruta: r.id_ruta,
                        nombre: r.nombre || 'Sin nombre',
                        fecha: r.fecha,
                        estado: r.estado,
                        duracion_min: duracion,
                        km_recorridos: km,
                        visitas_realizadas: visitas || 0
                    };
                }));
                setUltimasRutas(rutasConVisitas);
            }

            // 3. Rutas pendientes de completar
            await cargarRutasPendientes();

            // 4. Estadísticas de hoy
            const { data: rutasHoy } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_chofer', profile.id_usuario)
                .eq('fecha', hoyStr)
                .eq('estado', 'finalizada');

            let kmHoy = 0;
            let tiempoHoy = 0;
            let visitasHoy = 0;

            if (rutasHoy && rutasHoy.length > 0) {
                for (const r of rutasHoy) {
                    if (r.km_inicio && r.km_fin && r.km_fin > r.km_inicio) {
                        kmHoy += (r.km_fin - r.km_inicio);
                    }
                    if (r.hora_salida_planta && r.hora_llegada_planta) {
                        tiempoHoy += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 60000);
                    }
                    const { count: vis } = await supabase
                        .from('viajes_bitacora')
                        .select('*', { count: 'exact', head: true })
                        .eq('id_ruta', r.id_ruta)
                        .not('hora_llegada', 'is', null);
                    visitasHoy += vis || 0;
                }
            }

            // 5. Estadísticas de la semana
            const { data: rutasSemanaActual } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_chofer', profile.id_usuario)
                .eq('estado', 'finalizada')
                .gte('fecha', inicioSemanaStr)
                .lte('fecha', finSemanaStr);

            const semanaAnteriorInicio = new Date(inicioSemana);
            semanaAnteriorInicio.setDate(semanaAnteriorInicio.getDate() - 7);
            const semanaAnteriorFin = new Date(finSemanaStr);
            semanaAnteriorFin.setDate(semanaAnteriorFin.getDate() - 7);
            const semanaAnteriorInicioStr = format(semanaAnteriorInicio, 'yyyy-MM-dd');
            const semanaAnteriorFinStr = format(semanaAnteriorFin, 'yyyy-MM-dd');

            const { data: rutasSemanaAnterior } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_chofer', profile.id_usuario)
                .eq('estado', 'finalizada')
                .gte('fecha', semanaAnteriorInicioStr)
                .lte('fecha', semanaAnteriorFinStr);

            let horasActual = 0;
            let rutasCompletadas = 0;
            (rutasSemanaActual || []).forEach(r => {
                if (r.hora_salida_planta && r.hora_llegada_planta) {
                    horasActual += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 3600000);
                    rutasCompletadas++;
                }
            });

            let horasAnterior = 0;
            (rutasSemanaAnterior || []).forEach(r => {
                if (r.hora_salida_planta && r.hora_llegada_planta) {
                    horasAnterior += Math.round((new Date(r.hora_llegada_planta).getTime() - new Date(r.hora_salida_planta).getTime()) / 3600000);
                }
            });

            const porcentajeCambio = horasAnterior > 0
                ? Math.round(((horasActual - horasAnterior) / horasAnterior) * 100)
                : null;

            setStats({
                km_hoy: kmHoy,
                visitas_hoy: visitasHoy,
                tiempo_hoy_min: tiempoHoy,
                rutas_completadas_semana: rutasCompletadas,
                horas_semana_actual: horasActual,
                horas_semana_anterior: horasAnterior,
                porcentaje_cambio: porcentajeCambio
            });

            // 6. Próximo descanso
            const diasDescanso = profile.dias_descanso || [];
            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const hoy = new Date();
            const hoyIndice = hoy.getDay();

            let proximoDia: string | null = null;
            let diasHasta = 7;

            for (let i = 1; i <= 7; i++) {
                const diaIndice = (hoyIndice + i) % 7;
                const diaNombre = diasSemana[diaIndice];
                if (diasDescanso.includes(diaNombre)) {
                    proximoDia = diaNombre;
                    diasHasta = i;
                    break;
                }
            }

            if (proximoDia) {
                setProximoDescanso(`${proximoDia} (en ${diasHasta} día${diasHasta !== 1 ? 's' : ''})`);
            } else {
                setProximoDescanso('Sin descanso programado');
            }

            // 7. Excepciones próximas
            const hoyStrFecha = format(new Date(), 'yyyy-MM-dd');
            const { data: excepciones } = await supabase
                .from('excepciones_descanso')
                .select('estado, fecha')
                .eq('id_chofer', profile.id_usuario)
                .gte('fecha', hoyStrFecha)
                .order('fecha', { ascending: true })
                .limit(1);

            if (excepciones && excepciones.length > 0) {
                setExcepcionProxima({
                    fecha: excepciones[0].fecha,
                    estado: excepciones[0].estado
                });
            } else {
                setExcepcionProxima(null);
            }

        } catch (err) {
            console.error('Error cargando dashboard conductor:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDuracion = (minutos: number) => {
        if (!minutos) return '-';
        const h = Math.floor(minutos / 60);
        const m = minutos % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}min`;
    };

    const handleContinuarViaje = () => {
        navigate('/driver/viaje');
    };

    const handleIniciarViaje = () => {
        navigate('/driver/viaje');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-text-muted">Cargando tu información...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4 pb-24">
            {/* Header con bienvenida y logout */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">
                        Mi Panel
                    </h1>
                    <p className="text-text-muted text-sm">
                        Bienvenido, <span className="text-primary font-bold">{profile?.nombre}</span>
                    </p>
                </div>
                <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-light/30 rounded-lg text-text-muted hover:text-white hover:bg-surface-light/50 transition-colors"
                    title="Cerrar sesión"
                >
                    <LogOut size={18} />
                    <span className="text-xs font-bold hidden sm:inline">Salir</span>
                </button>
            </div>

            {/* Próximo descanso y excepciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={18} className="text-primary" />
                        <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Próximo descanso</p>
                    </div>
                    <p className="text-lg font-black text-white">{proximoDescanso}</p>
                    {excepcionProxima && (
                        <p className="text-xs text-orange-400 mt-1">
                            ⚡ Excepción: {excepcionProxima.estado === 'descansa' ? 'Descansarás' : 'Trabajarás'} el {formatFriendlyDate(excepcionProxima.fecha)}
                        </p>
                    )}
                </div>

                <div className="bg-surface/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={18} className="text-primary" />
                        <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Mi rendimiento esta semana</p>
                    </div>
                    <p className="text-2xl font-black text-white">{stats.horas_semana_actual.toFixed(1)}h</p>
                    {stats.porcentaje_cambio !== null && (
                        <p className={`text-xs font-bold ${stats.porcentaje_cambio < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.porcentaje_cambio < 0 ? '↓' : '↑'} {Math.abs(stats.porcentaje_cambio)}% vs semana anterior
                        </p>
                    )}
                    {stats.porcentaje_cambio === null && stats.horas_semana_anterior === 0 && (
                        <p className="text-xs text-text-muted">Sin datos semana anterior</p>
                    )}
                </div>
            </div>

            {/* Ruta activa o botón para iniciar */}
            {rutaActiva ? (
                <Card className="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Truck size={24} className="text-primary" />
                            <div>
                                <p className="text-xs text-primary uppercase font-bold tracking-wider">Ruta en curso</p>
                                <p className="text-lg font-black text-white">{rutaActiva.nombre}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-text-muted text-xs">Estado</p>
                                <p className="text-white font-bold capitalize">{rutaActiva.estado === 'en_progreso' ? 'En progreso' : 'Pendiente'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-text-muted text-xs">Visitas realizadas</p>
                                <p className="text-white font-bold">{rutaActiva.visitas_realizadas}</p>
                            </div>
                        </div>
                        <Button
                            onClick={handleContinuarViaje}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-black"
                        >
                            Continuar Viaje →
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-surface border border-dashed border-primary/30">
                    <CardContent className="p-8 text-center">
                        <Truck size={48} className="mx-auto mb-4 text-text-muted opacity-30" />
                        <p className="text-white text-lg font-black mb-2">No tienes rutas activas</p>
                        <p className="text-text-muted text-sm mb-6">Inicia una nueva jornada para comenzar</p>
                        <Button
                            onClick={handleIniciarViaje}
                            className="bg-primary hover:bg-primary-hover text-white font-black px-8"
                        >
                            🚛 Iniciar Nueva Ruta
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Stats del día */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-light/20 rounded-xl p-3 text-center">
                    <MapPin size={18} className="mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-black text-white">{stats.visitas_hoy}</p>
                    <p className="text-[10px] text-text-muted uppercase font-bold">Visitas hoy</p>
                </div>
                <div className="bg-surface-light/20 rounded-xl p-3 text-center">
                    <Clock size={18} className="mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-black text-white">{stats.tiempo_hoy_min > 0 ? `${Math.floor(stats.tiempo_hoy_min / 60)}h` : '0h'}</p>
                    <p className="text-[10px] text-text-muted uppercase font-bold">Tiempo hoy</p>
                </div>
                <div className="bg-surface-light/20 rounded-xl p-3 text-center">
                    <Truck size={18} className="mx-auto mb-1 text-primary" />
                    <p className="text-2xl font-black text-white">{stats.km_hoy.toFixed(0)}</p>
                    <p className="text-[10px] text-text-muted uppercase font-bold">Kilómetros</p>
                </div>
            </div>

            {/* Rutas pendientes de completar */}
            {rutasPendientes.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-4">
                        <h2 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertCircle size={16} />
                            Rutas con información pendiente ({rutasPendientes.length})
                        </h2>
                        <div className="space-y-3">
                            {rutasPendientes.map(ruta => (
                                <div key={ruta.id_ruta} className="flex justify-between items-center p-3 bg-surface-light/20 rounded-lg">
                                    <div>
                                        <p className="text-white font-bold text-sm">{ruta.nombre}</p>
                                        <p className="text-text-muted text-[10px]">{formatFriendlyDate(ruta.fecha)}</p>
                                        <p className="text-yellow-400 text-[10px] mt-1">⚠️ Falta: {ruta.faltantesTexto}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => navigate(`/driver/ruta/completar/${ruta.id_ruta}`)}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                                    >
                                        Completar ruta
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Últimas rutas */}
            <Card>
                <CardContent className="p-4">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        Mis últimas rutas
                    </h2>
                    {ultimasRutas.length === 0 ? (
                        <p className="text-text-muted text-sm text-center py-4">No hay rutas completadas aún</p>
                    ) : (
                        <div className="space-y-2">
                            {ultimasRutas.map(ruta => (
                                <div key={ruta.id_ruta} className="flex justify-between items-center p-3 bg-surface-light/20 rounded-lg">
                                    <div>
                                        <p className="text-white font-bold text-sm">{ruta.nombre}</p>
                                        <p className="text-text-muted text-[10px]">{formatFriendlyDate(ruta.fecha)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-green-400 font-bold text-xs">{formatDuracion(ruta.duracion_min || 0)}</p>
                                        <p className="text-text-muted text-[10px]">{ruta.visitas_realizadas} visitas</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}