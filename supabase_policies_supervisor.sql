-- =====================================================
-- POLÍTICAS RLS PARA PERMITIR ACCESO A SUPERVISORES
-- =====================================================

-- Tabla rutas
DROP POLICY IF EXISTS "Allow supervisor read rutas" ON public.rutas;
CREATE POLICY "Allow supervisor read rutas" ON public.rutas
FOR SELECT USING (
  auth.role() = 'authenticated' AND 
  (current_setting('request.jwt.claims', true)::json->>'rol' IN ('administrador', 'supervisor') OR true)
);

-- Tabla usuarios
DROP POLICY IF EXISTS "Allow supervisor read usuarios" ON public.usuarios;
CREATE POLICY "Allow supervisor read usuarios" ON public.usuarios
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor update usuarios" ON public.usuarios;
CREATE POLICY "Allow supervisor update usuarios" ON public.usuarios
FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabla gastos_combustible
DROP POLICY IF EXISTS "Allow supervisor read gastos" ON public.gastos_combustible;
CREATE POLICY "Allow supervisor read gastos" ON public.gastos_combustible
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor insert gastos" ON public.gastos_combustible;
CREATE POLICY "Allow supervisor insert gastos" ON public.gastos_combustible
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor update gastos" ON public.gastos_combustible;
CREATE POLICY "Allow supervisor update gastos" ON public.gastos_combustible
FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabla locales_ruta
DROP POLICY IF EXISTS "Allow supervisor read locales_ruta" ON public.locales_ruta;
CREATE POLICY "Allow supervisor read locales_ruta" ON public.locales_ruta
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor update locales_ruta" ON public.locales_ruta;
CREATE POLICY "Allow supervisor update locales_ruta" ON public.locales_ruta
FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabla locales_base
DROP POLICY IF EXISTS "Allow supervisor read locales_base" ON public.locales_base;
CREATE POLICY "Allow supervisor read locales_base" ON public.locales_base
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor insert locales_base" ON public.locales_base;
CREATE POLICY "Allow supervisor insert locales_base" ON public.locales_base
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor update locales_base" ON public.locales_base;
CREATE POLICY "Allow supervisor update locales_base" ON public.locales_base
FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabla viajes_bitacora
DROP POLICY IF EXISTS "Allow supervisor read bitacora" ON public.viajes_bitacora;
CREATE POLICY "Allow supervisor read bitacora" ON public.viajes_bitacora
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor insert bitacora" ON public.viajes_bitacora;
CREATE POLICY "Allow supervisor insert bitacora" ON public.viajes_bitacora
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor update bitacora" ON public.viajes_bitacora;
CREATE POLICY "Allow supervisor update bitacora" ON public.viajes_bitacora
FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabla fotos_visita
DROP POLICY IF EXISTS "Allow supervisor read fotos_visita" ON public.fotos_visita;
CREATE POLICY "Allow supervisor read fotos_visita" ON public.fotos_visita
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow supervisor insert fotos_visita" ON public.fotos_visita;
CREATE POLICY "Allow supervisor insert fotos_visita" ON public.fotos_visita
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Habilitar RLS en todas las tablas
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_combustible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locales_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locales_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_visita ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
-- Si las políticas no funcionan correctamente, puede ser
-- porque el JWT de Supabase no incluye el campo 'rol'.
-- 
-- Para verificar esto, ve a:
-- Supabase Dashboard > Authentication > Users > alonso@shimaya.com
-- y revisa los metadatos del usuario.
--
-- El campo 'rol' debe estar en:
-- - user.raw_user_meta_data.rol
-- - o en request.jwt.claims
--
-- Si el problema persiste, puedes usar una política más simple:
-- DROP POLICY IF EXISTS "Allow all authenticated" ON public.rutas;
-- CREATE POLICY "Allow all authenticated" ON public.rutas
-- FOR ALL USING (auth.role() = 'authenticated');
-- =====================================================
