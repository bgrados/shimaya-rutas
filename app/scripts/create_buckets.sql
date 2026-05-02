-- Crear buckets de storage
-- Ejecutar este SQL en Supabase SQL Editor

-- 1. Crear bucket locales_fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('locales_fotos', 'locales_fotos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Crear bucket visitas_fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visitas_fotos', 'visitas_fotos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 3. Crear bucket combustible
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('combustible', 'combustible', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Políticas para locales_fotos
DROP POLICY IF EXISTS "locales_fotos_select" ON storage.objects;
CREATE POLICY "locales_fotos_select" ON storage.objects FOR SELECT USING (bucket_id = 'locales_fotos');

DROP POLICY IF EXISTS "locales_fotos_insert" ON storage.objects;
CREATE POLICY "locales_fotos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'locales_fotos');

DROP POLICY IF EXISTS "locales_fotos_update" ON storage.objects;
CREATE POLICY "locales_fotos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'locales_fotos');

-- Políticas para visitas_fotos
DROP POLICY IF EXISTS "visitas_fotos_select" ON storage.objects;
CREATE POLICY "visitas_fotos_select" ON storage.objects FOR SELECT USING (bucket_id = 'visitas_fotos');

DROP POLICY IF EXISTS "visitas_fotos_insert" ON storage.objects;
CREATE POLICY "visitas_fotos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'visitas_fotos');

DROP POLICY IF EXISTS "visitas_fotos_update" ON storage.objects;
CREATE POLICY "visitas_fotos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'visitas_fotos');

-- Políticas para combustible
DROP POLICY IF EXISTS "combustible_select" ON storage.objects;
CREATE POLICY "combustible_select" ON storage.objects FOR SELECT USING (bucket_id = 'combustible');

DROP POLICY IF EXISTS "combustible_insert" ON storage.objects;
CREATE POLICY "combustible_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'combustible');

DROP POLICY IF EXISTS "combustible_update" ON storage.objects;
CREATE POLICY "combustible_update" ON storage.objects FOR UPDATE USING (bucket_id = 'combustible');

-- Confirmar
SELECT name, public FROM storage.buckets;
