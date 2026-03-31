-- SCRIPT PARA ACTUALIZAR LA TABLA USUARIOS
-- Copia y pega esto en el SQL Editor de tu Supabase

ALTER TABLE IF EXISTS public.usuarios 
ADD COLUMN IF NOT EXISTS foto_url text,
ADD COLUMN IF NOT EXISTS placa_camion text;

-- Comentario para verificar que se ejecutó correctamente
COMMENT ON COLUMN public.usuarios.foto_url IS 'URL de la foto de perfil del chofer';
COMMENT ON COLUMN public.usuarios.placa_camion IS 'Número de placa del vehículo asignado';
