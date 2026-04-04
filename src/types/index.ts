export type UserRole = 'administrador' | 'supervisor' | 'chofer';

export interface Usuario {
  id_usuario: string;
  nombre: string;
  email: string;
  rol: UserRole;
  telefono: string | null;
  activo: boolean;
  foto_url: string | null;
  placa_camion: string | null;
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
  created_at: string;
}

export interface RutaBase {
  id_ruta_base: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
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
  created_at: string;
}

export type EstadoVisita = 'pendiente' | 'visitado' | 'cerrado' | 'no_encontrado';

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
  ocr_confidence: number | null;
  created_at: string;
  chofer_nombre?: string;
  ruta_nombre?: string;
}
