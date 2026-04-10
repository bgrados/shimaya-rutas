-- Tabla de auditoría para registrar eliminaciones
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  tabla TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  accion TEXT NOT NULL CHECK (accion IN ('delete', 'create', 'update')),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy para que solo administradores puedan ver logs
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (true);

-- Policy para que solo autenticados puedan insertar
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Crear función helper para logging
CREATE OR REPLACE FUNCTION registrar_audit(
  p_tabla TEXT,
  p_registro_id TEXT,
  p_accion TEXT,
  p_datos_anteriores JSONB DEFAULT NULL,
  p_datos_nuevos JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_log (tabla, registro_id, accion, datos_anteriores, datos_nuevos)
  VALUES (p_tabla, p_registro_id, p_accion, p_datos_anteriores, p_datos_nuevos);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
