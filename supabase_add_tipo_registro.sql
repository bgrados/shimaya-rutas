-- Agregar columna tipo_registro a viajes_bitacora
-- Esta columna indica si el registro fue automático (GPS) o manual

ALTER TABLE public.viajes_bitacora 
ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'automatico';

-- Comentario para documentación
COMMENT ON COLUMN public.viajes_bitacora.tipo_registro IS 'Tipo de registro: automatico (GPS) o manual (usuario)';

-- Actualizar los registros existentes para que sean automáticos por defecto
UPDATE public.viajes_bitacora 
SET tipo_registro = 'automatico' 
WHERE tipo_registro IS NULL;
