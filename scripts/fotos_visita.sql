-- Tabla para fotos de evidencia por visita de local
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla fotos_visita SIN foreign key inicialmente
CREATE TABLE IF NOT EXISTS fotos_visita (
  id_foto UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_local_ruta TEXT NOT NULL,
  foto_url TEXT NOT NULL,
  orden INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar ROW SECURITY
ALTER TABLE fotos_visita ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso
DROP POLICY IF EXISTS "fotos_visita_all" ON fotos_visita;
CREATE POLICY "fotos_visita_all" ON fotos_visita
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_fotos_visita_local_ruta ON fotos_visita(id_local_ruta);
