-- Create table for tracking absences and permissions
CREATE TABLE IF NOT EXISTS public.faltas (
    id_falta uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    id_usuario uuid REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    fecha date NOT NULL,
    tipo text DEFAULT 'falta' CHECK (tipo IN ('falta', 'permiso', 'justificada', 'medico', 'suspension')),
    observaciones text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(id_usuario, fecha)
);

-- Enable RLS
ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

-- Create policy for administrators and supervisors
CREATE POLICY "Admin can do everything with faltas" 
ON public.faltas 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id_usuario = auth.uid() 
    AND rol IN ('administrador', 'supervisor')
  )
);

-- Create policy for users to see their own faltas
CREATE POLICY "Users can see their own faltas" 
ON public.faltas 
FOR SELECT 
TO authenticated 
USING (id_usuario = auth.uid());
