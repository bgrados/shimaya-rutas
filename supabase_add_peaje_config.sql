-- =====================================================
-- CONFIGURACIÓN AUTOMÁTICA DE PEAJES POR RUTA
-- Shimaya Rutas - Sistema de Gestión de Peajes
-- =====================================================

-- 1. Agregar columnas de configuración de peajes a rutas_base
ALTER TABLE rutas_base 
ADD COLUMN IF NOT EXISTS cantidad_peajes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS costo_peaje DECIMAL(10,2) DEFAULT 0;

-- 2. Agregar columna para marcar tipo de registro en gastos_peaje (compatibilidad)
ALTER TABLE gastos_peaje 
ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'manual';

-- 3. Marcar todos los registros existentes como 'manual' (compatibilidad hacia atrás)
UPDATE gastos_peaje SET tipo_registro = 'manual' WHERE tipo_registro IS NULL OR tipo_registro = '';

-- =====================================================
-- EJEMPLO DE CONFIGURACIÓN DE PEAJES POR RUTA
-- =====================================================
-- 
-- UPDATE rutas_base SET cantidad_peajes = 4, costo_peaje = 6.30 WHERE nombre ILIKE '%guinda%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 6.30 WHERE nombre ILIKE '%amarilla%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 7.50 WHERE nombre ILIKE '%verde%';
-- UPDATE rutas_base SET cantidad_peajes = 1, costo_peaje = 6.30 WHERE nombre ILIKE '%negra%';
--
-- NOTA: Ajustar los valores según la configuración real de peajes
-- =====================================================
