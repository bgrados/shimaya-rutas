import { supabase } from './supabase';

export async function logAudit(
  tabla: string,
  registroId: string,
  accion: 'delete' | 'create' | 'update',
  datosAnteriores?: Record<string, unknown>,
  datosNuevos?: Record<string, unknown>
) {
  try {
    await supabase.rpc('registrar_audit', {
      p_tabla: tabla,
      p_registro_id: registroId,
      p_accion: accion,
      p_datos_anteriores: datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      p_datos_nuevos: datosNuevos ? JSON.stringify(datosNuevos) : null
    });
  } catch (err) {
    console.error('[Audit] Error logging:', err);
  }
}

export async function logDelete(
  tabla: string,
  registroId: string,
  datosEliminados: Record<string, unknown>
) {
  return logAudit(tabla, registroId, 'delete', datosEliminados, null);
}
