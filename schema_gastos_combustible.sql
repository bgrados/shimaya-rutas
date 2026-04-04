CREATE TABLE IF NOT EXISTS public.gastos_combustible (
    id_gasto UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    id_ruta UUID REFERENCES public.rutas(id_ruta) ON DELETE CASCADE,
    id_chofer UUID REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
    tipo_combustible TEXT CHECK (tipo_combustible IN ('glp', 'gasolina', 'diesel', 'otro')) DEFAULT 'glp',
    monto NUMERIC(10, 2),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    foto_url TEXT,
    notas TEXT,
    estado TEXT DEFAULT 'pendiente_revision' CHECK (estado IN ('pendiente_revision', 'confirmado', 'rechazado')),
    ocr_confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gastos_combustible ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura a usuarios autenticados" ON public.gastos_combustible FOR SELECT USING (true);

CREATE POLICY "Permitir insert a choferes y supervisores"
ON public.gastos_combustible FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id_usuario = auth.uid() 
        AND rol IN ('chofer', 'supervisor', 'administrador')
    )
);

CREATE POLICY "Permitir update a supervisores"
ON public.gastos_combustible FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.usuarios 
        WHERE id_usuario = auth.uid() 
        AND rol IN ('supervisor', 'administrador')
    )
);

CREATE INDEX IF NOT EXISTS idx_gastos_combustible_ruta ON public.gastos_combustible(id_ruta);
CREATE INDEX IF NOT EXISTS idx_gastos_combustible_chofer ON public.gastos_combustible(id_chofer);
CREATE INDEX IF NOT EXISTS idx_gastos_combustible_fecha ON public.gastos_combustible(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_combustible_estado ON public.gastos_combustible(estado);
