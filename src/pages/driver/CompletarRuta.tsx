import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, Save, Camera, X, CheckCircle, AlertCircle, Fuel, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatFriendlyDate, formatPeru } from '../../lib/timezone';

interface Ruta {
    id_ruta: string;
    nombre: string;
    fecha: string;
    km_inicio: number;
    km_fin: number | null;
    hora_salida_planta: string | null;
    hora_llegada_planta: string | null;
}

interface Gasto {
    id_gasto: string;
    tipo_combustible: string;
    monto: number;
    foto_url: string | null;
    kilometraje: number | null;
}

interface Tramo {
    id_bitacora: string;
    origen_nombre: string;
    destino_nombre: string;
    hora_salida: string | null;
    hora_llegada: string | null;
    orden: number;
}

export default function CompletarRuta() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ruta, setRuta] = useState<Ruta | null>(null);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [tramos, setTramos] = useState<Tramo[]>([]);
    const [kmFin, setKmFin] = useState('');
    const [editandoKmFin, setEditandoKmFin] = useState(false);
    const [editandoLlegadaPlanta, setEditandoLlegadaPlanta] = useState(false);
    const [horaLlegadaPlanta, setHoraLlegadaPlanta] = useState('');
    const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            cargarDatos();
        }
    }, [id]);

    const cargarDatos = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Cargar ruta
            const { data: rutaData } = await supabase
                .from('rutas')
                .select('*')
                .eq('id_ruta', id)
                .single();

            if (rutaData) {
                setRuta(rutaData as Ruta);
                setKmFin(rutaData.km_fin?.toString() || '');
                if (rutaData.hora_llegada_planta) {
                    const fecha = new Date(rutaData.hora_llegada_planta);
                    setHoraLlegadaPlanta(format(fecha, 'HH:mm'));
                }
            }

            // Cargar gastos (combustible y peajes)
            const { data: gastosData } = await supabase
                .from('gastos_combustible')
                .select('*')
                .eq('id_ruta', id)
                .order('created_at', { ascending: true });

            if (gastosData) {
                setGastos(gastosData as Gasto[]);
            }

            // Cargar bitácora (tramos)
            const { data: bitacoraData } = await supabase
                .from('viajes_bitacora')
                .select('*')
                .eq('id_ruta', id)
                .order('created_at', { ascending: true });

            if (bitacoraData) {
                setTramos(bitacoraData as Tramo[]);
            }

        } catch (err) {
            console.error('Error cargando ruta:', err);
        } finally {
            setLoading(false);
        }
    };

    const actualizarKmFin = async () => {
        const km = parseFloat(kmFin);
        if (isNaN(km) || km <= (ruta?.km_inicio || 0)) {
            alert('El kilometraje final debe ser mayor al inicial');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('rutas')
                .update({ km_fin: km })
                .eq('id_ruta', id);
            if (error) throw error;
            setRuta(prev => prev ? { ...prev, km_fin: km } : null);
            setEditandoKmFin(false);
            alert('Kilometraje actualizado');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const actualizarLlegadaPlanta = async () => {
        if (!horaLlegadaPlanta) return;
        setSaving(true);
        try {
            const fechaBase = ruta?.fecha ? new Date(ruta.fecha + 'T12:00:00') : new Date();
            const [h, m] = horaLlegadaPlanta.split(':').map(Number);
            fechaBase.setHours(h, m, 0, 0);
            const nuevaHora = fechaBase.toISOString();

            const { error } = await supabase
                .from('rutas')
                .update({ hora_llegada_planta: nuevaHora })
                .eq('id_ruta', id);
            if (error) throw error;

            setRuta(prev => prev ? { ...prev, hora_llegada_planta: nuevaHora } : null);
            setEditandoLlegadaPlanta(false);
            alert('Hora de llegada actualizada');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const subirFotoGasto = async (gasto: Gasto) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            setSubiendoFoto(gasto.id_gasto);
            try {
                const fileName = `gasto_${gasto.id_gasto}_${Date.now()}.jpg`;
                const filePath = `combustible/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('combustible_fotos')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('combustible_fotos')
                    .getPublicUrl(filePath);

                const { error: updateError } = await supabase
                    .from('gastos_combustible')
                    .update({ foto_url: data.publicUrl })
                    .eq('id_gasto', gasto.id_gasto);

                if (updateError) throw updateError;

                setGastos(prev => prev.map(g =>
                    g.id_gasto === gasto.id_gasto ? { ...g, foto_url: data.publicUrl } : g
                ));

                alert('Foto subida correctamente');
            } catch (err: any) {
                alert('Error al subir foto: ' + err.message);
            } finally {
                setSubiendoFoto(null);
            }
        };
        input.click();
    };

    const actualizarTramo = async (tramoId: string, campo: 'hora_salida' | 'hora_llegada', valor: string) => {
        setSaving(true);
        try {
            const fechaBase = ruta?.fecha ? new Date(ruta.fecha + 'T12:00:00') : new Date();
            const [h, m] = valor.split(':').map(Number);
            fechaBase.setHours(h, m, 0, 0);
            const nuevaHora = fechaBase.toISOString();

            const { error } = await supabase
                .from('viajes_bitacora')
                .update({ [campo]: nuevaHora })
                .eq('id_bitacora', tramoId);

            if (error) throw error;

            setTramos(prev => prev.map(t =>
                t.id_bitacora === tramoId ? { ...t, [campo]: nuevaHora } : t
            ));

            alert(`${campo === 'hora_salida' ? 'Salida' : 'Llegada'} actualizada`);
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const formatHora = (iso: string | null) => {
        if (!iso) return '';
        return format(new Date(iso), 'HH:mm');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-text-muted">Cargando ruta...</div>
            </div>
        );
    }

    if (!ruta) {
        return (
            <div className="p-4 text-center">
                <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
                <p className="text-white">Ruta no encontrada</p>
                <Button onClick={() => navigate('/driver')} className="mt-4">Volver al inicio</Button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/driver')} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-xl font-black text-white uppercase italic tracking-tighter">
                        Completar Ruta
                    </h1>
                    <p className="text-text-muted text-sm">{ruta.nombre} · {formatFriendlyDate(ruta.fecha)}</p>
                </div>
            </div>

            {/* Kilometraje Final */}
            <Card className="border-primary/30">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-text-muted uppercase font-bold">Kilometraje Final</p>
                            {editandoKmFin ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        type="number"
                                        value={kmFin}
                                        onChange={e => setKmFin(e.target.value)}
                                        className="w-32 bg-surface-light text-white"
                                        placeholder="Km final"
                                    />
                                    <Button size="sm" onClick={actualizarKmFin} disabled={saving} className="bg-green-600">
                                        <CheckCircle size={14} /> Guardar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditandoKmFin(false)}>Cancelar</Button>
                                </div>
                            ) : (
                                <p className="text-2xl font-black text-white">
                                    {ruta.km_fin || 'No registrado'}
                                </p>
                            )}
                        </div>
                        {!editandoKmFin && !ruta.km_fin && (
                            <Button size="sm" onClick={() => setEditandoKmFin(true)} className="bg-primary">
                                <Camera size={14} className="mr-1" /> Registrar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Llegada a Planta */}
            <Card className="border-primary/30">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-text-muted uppercase font-bold">Llegada a Planta</p>
                            {editandoLlegadaPlanta ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <Input
                                        type="time"
                                        value={horaLlegadaPlanta}
                                        onChange={e => setHoraLlegadaPlanta(e.target.value)}
                                        className="w-32 bg-surface-light text-white"
                                    />
                                    <Button size="sm" onClick={actualizarLlegadaPlanta} disabled={saving} className="bg-green-600">
                                        <CheckCircle size={14} /> Guardar
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditandoLlegadaPlanta(false)}>Cancelar</Button>
                                </div>
                            ) : (
                                <p className="text-2xl font-black text-white">
                                    {ruta.hora_llegada_planta ? formatHora(ruta.hora_llegada_planta) : 'No registrada'}
                                </p>
                            )}
                        </div>
                        {!editandoLlegadaPlanta && !ruta.hora_llegada_planta && (
                            <Button size="sm" onClick={() => setEditandoLlegadaPlanta(true)} className="bg-primary">
                                <Clock size={14} className="mr-1" /> Registrar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Gastos de Combustible y Peajes */}
            {gastos.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Fuel size={16} className="text-primary" />
                            Gastos registrados
                        </h2>
                        <div className="space-y-3">
                            {gastos.map(gasto => (
                                <div key={gasto.id_gasto} className="flex justify-between items-center p-3 bg-surface-light/20 rounded-lg">
                                    <div>
                                        <p className="text-white font-bold text-sm capitalize">
                                            {gasto.tipo_combustible === 'peaje' ? 'Peaje' :
                                                gasto.tipo_combustible === 'peaje_compromiso' ? 'Peaje (compromiso)' :
                                                    gasto.tipo_combustible}
                                        </p>
                                        <p className="text-green-400 text-xs font-bold">S/ {gasto.monto.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        {gasto.foto_url ? (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle size={16} className="text-green-400" />
                                                <span className="text-text-muted text-xs">Foto cargada</span>
                                            </div>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => subirFotoGasto(gasto)}
                                                disabled={subiendoFoto === gasto.id_gasto}
                                                className="bg-yellow-600 hover:bg-yellow-700"
                                            >
                                                {subiendoFoto === gasto.id_gasto ? 'Subiendo...' : <><Camera size={14} className="mr-1" /> Subir foto</>}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bitácora de Tramos */}
            {tramos.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h2 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            Bitácora de movimientos
                        </h2>
                        <div className="space-y-3">
                            {tramos.map((tramo, idx) => (
                                <div key={tramo.id_bitacora} className="p-3 bg-surface-light/20 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-white font-bold text-sm">
                                            {idx + 1}. {tramo.origen_nombre} → {tramo.destino_nombre}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {/* Hora Salida */}
                                        <div>
                                            <p className="text-[10px] text-text-muted uppercase">Salida</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-white text-sm font-mono">
                                                    {formatHora(tramo.hora_salida) || '--:--'}
                                                </p>
                                                {!tramo.hora_salida && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            const nuevaHora = prompt('Ingrese hora de salida (HH:MM)', '08:00');
                                                            if (nuevaHora && /^\d{2}:\d{2}$/.test(nuevaHora)) {
                                                                actualizarTramo(tramo.id_bitacora, 'hora_salida', nuevaHora);
                                                            }
                                                        }}
                                                        className="bg-primary h-7 text-xs"
                                                    >
                                                        Editar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {/* Hora Llegada */}
                                        <div>
                                            <p className="text-[10px] text-text-muted uppercase">Llegada</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-white text-sm font-mono">
                                                    {formatHora(tramo.hora_llegada) || '--:--'}
                                                </p>
                                                {!tramo.hora_llegada && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            const nuevaHora = prompt('Ingrese hora de llegada (HH:MM)', '08:00');
                                                            if (nuevaHora && /^\d{2}:\d{2}$/.test(nuevaHora)) {
                                                                actualizarTramo(tramo.id_bitacora, 'hora_llegada', nuevaHora);
                                                            }
                                                        }}
                                                        className="bg-primary h-7 text-xs"
                                                    >
                                                        Editar
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-text-muted text-xs mt-4 italic">
                            💡 Si falta alguna hora, puedes editarla haciendo clic en "Editar"
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Botón finalizar */}
            <div className="flex gap-3 pt-4">
                <Button
                    variant="secondary"
                    onClick={() => navigate('/driver')}
                    className="flex-1"
                >
                    Volver al panel
                </Button>
            </div>
        </div>
    );
}