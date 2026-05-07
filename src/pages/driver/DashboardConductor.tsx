import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Truck, MapPin, Clock, Calendar, TrendingUp, AlertCircle, LogOut } from 'lucide-react';
import { formatFriendlyDate } from '../../lib/timezone';

// Hooks
import { useDriverDashboard } from './dashboard/hooks/useDriverDashboard';

export default function DashboardConductor() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const { profile, loading, rutaActiva, ultimasRutas, rutasPendientes, proximoDescanso, excepcionProxima, stats, refreshData } = useDriverDashboard();

    const formatDuracion = (minutos: number) => {
        if (!minutos) return '-';
        const h = Math.floor(minutos / 60);
        const m = minutos % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}min`;
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white uppercase italic tracking-tighter">Mi Panel</h1>
                    <p className="text-text-muted text-sm">Bienvenido, <span className="text-primary font-bold">{profile?.nombre}</span></p>
                </div>
                <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 bg-surface-light/30 rounded-lg text-text-muted hover:text-white hover:bg-surface-light/50">
                    <LogOut size={18} /> <span className="text-xs font-bold hidden sm:inline">Salir</span>
                </button>
            </div>

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
                        <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Mi rendimiento semana</p>
                    </div>
                    <p className="text-2xl font-black text-white">{stats.horas_semana_actual.toFixed(1)}h</p>
                    {stats.porcentaje_cambio !== null && (
                        <p className={`text-xs font-bold ${stats.porcentaje_cambio < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.porcentaje_cambio < 0 ? '↓' : '↑'} {Math.abs(stats.porcentaje_cambio)}% vs semana anterior
                        </p>
                    )}
                </div>
            </div>

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
                            <div><p className="text-text-muted text-xs">Estado</p><p className="text-white font-bold capitalize">{rutaActiva.estado === 'en_progreso' ? 'En progreso' : 'Pendiente'}</p></div>
                            <div className="text-right"><p className="text-text-muted text-xs">Visitas</p><p className="text-white font-bold">{rutaActiva.visitas_realizadas}</p></div>
                        </div>
                        <Button onClick={() => navigate('/driver/viaje')} className="w-full bg-primary font-black">Continuar Viaje →</Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-surface border border-dashed border-primary/30">
                    <CardContent className="p-8 text-center">
                        <Truck size={48} className="mx-auto mb-4 text-text-muted opacity-30" />
                        <p className="text-white text-lg font-black mb-2">No tienes rutas activas</p>
                        <Button onClick={() => navigate('/driver/viaje')} className="bg-primary font-black px-8">🚛 Iniciar Nueva Ruta</Button>
                    </CardContent>
                </Card>
            )}

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
                    <p className="text-[10px] text-text-muted uppercase font-bold">KM hoy</p>
                </div>
            </div>

            {rutasPendientes.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardContent className="p-4">
                        <h2 className="text-sm font-black text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertCircle size={16} /> Pendientes ({rutasPendientes.length})</h2>
                        <div className="space-y-3">
                            {rutasPendientes.map(ruta => (
                                <div key={ruta.id_ruta} className="flex justify-between items-center p-3 bg-surface-light/20 rounded-lg">
                                    <div><p className="text-white font-bold text-sm">{ruta.nombre}</p><p className="text-yellow-400 text-[10px] mt-1">⚠️ Falta: {ruta.faltantesTexto}</p></div>
                                    <Button size="sm" onClick={() => navigate(`/driver/ruta/completar/${ruta.id_ruta}`)} className="bg-yellow-600 font-bold">Completar</Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-4">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2"><Clock size={16} className="text-primary" /> Historial Reciente</h2>
                    {ultimasRutas.length === 0 ? <p className="text-text-muted text-sm text-center py-4">Sin rutas</p> : (
                        <div className="space-y-2">
                            {ultimasRutas.map(ruta => (
                                <div key={ruta.id_ruta} className="flex justify-between items-center p-3 bg-surface-light/20 rounded-lg">
                                    <div><p className="text-white font-bold text-sm">{ruta.nombre}</p><p className="text-text-muted text-[10px]">{formatFriendlyDate(ruta.fecha)}</p></div>
                                    <div className="text-right"><p className="text-green-400 font-bold text-xs">{formatDuracion(ruta.duracion_min || 0)}</p><p className="text-text-muted text-[10px]">{ruta.visitas_realizadas} visitas</p></div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}