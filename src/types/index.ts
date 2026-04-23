export type UserRole = 'administrador' | 'supervisor' | 'chofer' | 'descansero' | 'asistente';

export interface Usuario {
  id_usuario: string;
  nombre: string;
  email: string;
  rol: UserRole;
  telefono: string | null;
  activo: boolean;
  foto_url: string | null;
  placa_camion: string | null;
  dias_descanso: string[];
  fecha_ingreso: string | null;
  dia_descanso: number;
  created_at: string;
}

export type TipoAsistencia = 'trabajo' | 'descanso' | 'falta' | 'permiso';

export interface AsistenciaChofer {
  id: string;
  id_chofer: string;
  fecha: string;
  estado: TipoAsistencia;
  observaciones: string | null;
  created_at: string;
}

export type RutaEstado = 'pendiente' | 'en_progreso' | 'finalizada';

export interface Ruta {
  id_ruta: string;
  nombre: string;
  fecha: string | null;
  estado: RutaEstado;
  id_ruta_base: string | null;
  id_chofer: string | null;
  placa: string | null;
  observaciones: string | null;
  hora_salida_planta: string | null;
  hora_llegada_planta: string | null;
  km_inicio: number | null;
  km_fin: number | null;
  id_asistente: string | null;
  nombre_asistente: string | null;
  created_at: string;
}

export interface RutaBase {
  id_ruta_base: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  cantidad_peajes: number;
  costo_peaje: number;
  created_at: string;
}

export interface LocalBase {
  id_local_base: string;
  id_ruta_base: string | null;
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  telefono: string | null;
  contacto: string | null;
  orden: number | null;
  foto_url: string | null;
  cerrado_temporal: boolean;
  created_at: string;
}

export type EstadoVisita = 'pendiente' | 'visitado' | 'cerrado' | 'no_encontrado';

export interface GuiaRemision {
  id_guia: string;
  id_local_ruta: string;
  archivo_url: string;
  comentario?: string;
  created_at: string;
}

export interface LocalRuta {
  id_local_ruta: string;
  id_ruta: string | null;
  id_local_base: string | null;
  nombre: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  orden: number | null;
  estado_visita: EstadoVisita | null;
  hora_llegada: string | null;
  hora_salida: string | null;
  observacion: string | null;
  foto_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  guias?: GuiaRemision[];
  created_at: string;
}

export interface Evento {
  id_evento: string;
  id_ruta: string | null;
  tipo: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface ViajeBitacora {
  id_bitacora: string;
  id_ruta: string | null;
  id_chofer: string | null;
  origen_nombre: string | null;
  destino_nombre: string | null;
  hora_salida: string | null;
  hora_llegada: string | null;
  gps_salida_lat: number | null;
  gps_salida_lng: number | null;
  gps_llegada_lat: number | null;
  gps_llegada_lng: number | null;
  created_at: string;
}

export type GastoCombustibleEstado = 'pendiente_revision' | 'confirmado' | 'rechazado';
export type TipoCombustible = 'glp' | 'gasolina' | 'diesel' | 'otro';

export interface GastoCombustible {
  id_gasto: string;
  id_ruta: string | null;
  id_chofer: string | null;
  tipo_combustible: TipoCombustible | null;
  monto: number | null;
  fecha: string | null;
  foto_url: string | null;
  notas: string | null;
  estado: GastoCombustibleEstado | null;
  kilometraje: number | null;
  ocr_confidence: number | null;
  created_at: string;
  chofer_nombre?: string;
  ruta_nombre?: string;
}

export interface FotoVisita {
  id_foto: string;
  id_local_ruta: string;
  foto_url: string;
  orden: number;
  created_at: string;
}

export type TipoPeaje = 'normal' | 'semanal' | 'mensual';

export interface GastoPeaje {
  id_peaje: string;
  id_ruta: string | null;
  id_chofer: string | null;
  nombre_peaje: string | null;
  monto: number | null;
  fecha: string | null;
  tipo: TipoPeaje | null;
  foto_url: string | null;
  notas: string | null;
  created_at: string;
  tipo_registro?: 'manual' | 'automatico';
  chofer_nombre?: string;
  ruta_nombre?: string;
  ruta_base_nombre?: string;
  cantidad_peajes?: number;
  costo_peaje?: number;
  peaje_calculado?: number;
}

export interface PeajeCalculado {
  id_ruta: string;
  fecha: string;
  ruta_nombre: string;
  ruta_base_nombre: string;
  chofer_nombre: string;
  cantidad_peajes: number;
  costo_peaje: number;
  total_peaje: number;
}

export interface AuditLog {
  id: number;
  tabla: string;
  registro_id: string;
  accion: 'delete' | 'create' | 'update';
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  created_at: string;
}

export type TipoFalta = 'falta' | 'permiso' | 'justificada' | 'medico' | 'suspension';

export interface Falta {
  id_falta: string;
  id_usuario: string;
  fecha: string;
  tipo: TipoFalta;
  observaciones: string | null;
  created_at: string;
  usuario_nombre?: string;
}

export interface PresenceUser {
  user_id: string;
  email: string;
  online_at: string;
}

export interface PresenceState {
  [key: string]: PresenceUser[];
}

export interface DashboardStats {
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
