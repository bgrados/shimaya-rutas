-- Función para registrar auditoría en Supabase
CREATE OR REPLACE FUNCTION public.registrar_audit(
  p_tabla text,
  p_registro_id text,
  p_accion text,
  p_datos_anteriores text DEFAULT NULL,
  p_datos_nuevos text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_log (tabla, registro_id, accion, datos_anteriores, datos_nuevos, created_at)
  VALUES (
    p_tabla,
    p_registro_id,
    p_accion,
    p_datos_anteriores::jsonb,
    p_datos_nuevos::jsonb,
    now()
  );
END;
$$;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION public.registrar_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_audit TO anon;
