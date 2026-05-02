-- MIGRACION: 20240421_add_mileage.sql
-- Proposito: Habilitar el control de kilometraje en rutas y gastos de combustible

-- Agregar columnas
ALTER TABLE public.rutas 
ADD COLUMN IF NOT EXISTS km_inicio NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS km_fin NUMERIC;

ALTER TABLE public.gastos_combustible 
ADD COLUMN IF NOT EXISTS kilometraje NUMERIC;

-- Documentacion
COMMENT ON COLUMN public.rutas.km_inicio IS 'Kilometraje inicial registrado por el chofer';
COMMENT ON COLUMN public.rutas.km_fin IS 'Kilometraje final registrado por el chofer al llegar a planta';
COMMENT ON COLUMN public.gastos_combustible.kilometraje IS 'Kilometraje registrado durante la carga de combustible o gasto';
