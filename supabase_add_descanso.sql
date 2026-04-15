-- Agregar columna dias_descanso a tabla usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS dias_descanso TEXT[] DEFAULT '{}';

-- Crear RLS policy para actualizar dias_descanso
DROP POLICY IF EXISTS "Allow users to update dias_descanso" ON public.usuarios;
CREATE POLICY "Allow users to update dias_descanso" ON public.usuarios
FOR UPDATE USING (true) WITH CHECK (true);

-- Agregar comentario a la columna
COMMENT ON COLUMN public.usuarios.dias_descanso IS 'Array de días de descanso: lunes, martes, miercoles, jueves, viernes, sabado, domingo';
