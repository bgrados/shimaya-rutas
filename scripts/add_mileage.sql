-- SCRIPT DE MIGRACIÓN: AGREGAR COLUMNAS DE KILOMETRAJE
-- EJECUTAR ESTO EN EL SQL EDITOR DE SUPABASE

-- 1. Agregar columnas a la tabla de rutas
ALTER TABLE public.rutas 
ADD COLUMN IF NOT EXISTS km_inicio NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS km_fin NUMERIC;

-- 2. Agregar columna a la tabla de gastos de combustible
ALTER TABLE public.gastos_combustible 
ADD COLUMN IF NOT EXISTS kilometraje NUMERIC;

-- 3. Comentarios para documentación del esquema
COMMENT ON COLUMN public.rutas.km_inicio IS 'Kilometraje registrado al iniciar el viaje';
COMMENT ON COLUMN public.rutas.km_fin IS 'Kilometraje registrado al finalizar el viaje';
COMMENT ON COLUMN public.gastos_combustible.kilometraje IS 'Kilometraje del vehículo al momento de la carga de combustible o gasto';
