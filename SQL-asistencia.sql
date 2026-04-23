-- =====================================================
-- ASISTENCIA MENSUAL - Migración deBase de Datos
-- =====================================================

-- 1. Agregar columnas nuevas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_ingreso date;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dia_descanso integer;

-- 2. Migrar datos existentes
UPDATE usuarios 
SET 
  dia_descanso = CASE 
    WHEN dias_descanso[1] ILIKE 'lunes%' THEN 1
    WHEN dias_descanso[1] ILIKE 'martes%' THEN 2
    WHEN dias_descanso[1] ILIKE 'miercoles%' THEN 3
    WHEN dias_descanso[1] ILIKE 'jueves%' THEN 4
    WHEN dias_descanso[1] ILIKE 'viernes%' THEN 5
    WHEN dias_descanso[1] ILIKE 'sabado%' THEN 6
    ELSE 0
  END,
  fecha_ingreso = COALESCE(fecha_ingreso, (created_at)::date)
WHERE dia_descanso IS NULL OR fecha_ingreso IS NULL;

-- 3. Verificar migración
SELECT 
  nombre,
  dias_descanso,
  dia_descanso,
  fecha_ingreso,
  created_at
FROM usuarios 
WHERE rol = 'chofer' 
ORDER BY nombre;

-- 4. Aplicar restricciones ( opcional, después de verificar )
-- ALTER TABLE usuarios ALTER COLUMN fecha_ingreso SET NOT NULL;
-- ALTER TABLE usuarios ALTER COLUMN dia_descanso SET NOT NULL;
