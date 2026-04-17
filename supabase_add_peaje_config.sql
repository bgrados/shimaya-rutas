-- =====================================================
-- CONFIGURACIÓN AUTOMÁTICA DE PEAJES POR RUTA
-- Shimaya Rutas - Sistema de Gestión de Peajes
-- =====================================================

-- 1. Agregar columnas de configuración de peajes a rutas_base
-- Con valores por defecto para evitar NULLs
ALTER TABLE rutas_base 
ADD COLUMN IF NOT EXISTS cantidad_peajes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_peaje DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Asegurar que los valores existentes no sean NULL
UPDATE rutas_base SET cantidad_peajes = 0 WHERE cantidad_peajes IS NULL;
UPDATE rutas_base SET costo_peaje = 0 WHERE costo_peaje IS NULL;

-- 2. Agregar columna para marcar tipo de registro en gastos_peaje (compatibilidad)
ALTER TABLE gastos_peaje 
ADD COLUMN IF NOT EXISTS tipo_registro TEXT NOT NULL DEFAULT 'MANUAL';

-- 3. Marcar todos los registros existentes como 'MANUAL' (compatibilidad hacia atrás)
UPDATE gastos_peaje SET tipo_registro = 'MANUAL' WHERE tipo_registro IS NULL OR tipo_registro = '';

-- 4. Agregar constraint para valores positivos
-- Esto asegura que no haya valores negativos en cantidad_peajes
ALTER TABLE rutas_base ADD CONSTRAINT chk_cantidad_peajes_positive CHECK (cantidad_peajes >= 0);
ALTER TABLE rutas_base ADD CONSTRAINT chk_costo_peaje_positive CHECK (costo_peaje >= 0);

-- =====================================================
-- VERIFICACIÓN POST- EJECUCIÓN
-- =====================================================
-- Ejecutar estas consultas para verificar:

-- 1. Verificar que las columnas existen:
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'rutas_base' AND column_name IN ('cantidad_peajes', 'costo_peaje');

-- 2. Verificar que las columnas existen en gastos_peaje:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'gastos_peaje' AND column_name = 'tipo_registro';

-- 3. Verificar Constraints:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conname LIKE 'chk_%';

-- =====================================================
-- EJEMPLO DE CONFIGURACIÓN DE PEAJES POR RUTA
-- =====================================================
-- Descomentar y ejecutar según necesidad:

-- UPDATE rutas_base SET cantidad_peajes = 4, costo_peaje = 6.30 WHERE nombre ILIKE '%guinda%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 6.30 WHERE nombre ILIKE '%amarilla%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 7.50 WHERE nombre ILIKE '%verde%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 6.30 WHERE nombre ILIKE '%negra%';

-- =====================================================
-- ROLLBACK (si hay problemas)
-- =====================================================
-- ALTER TABLE rutas_base DROP COLUMN IF EXISTS cantidad_peajes;
-- ALTER TABLE rutas_base DROP COLUMN IF EXISTS costo_peaje;
-- ALTER TABLE gastos_peaje DROP COLUMN IF EXISTS tipo_registro;
