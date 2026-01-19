-- ============================================
-- Migración: Convertir signed URLs a públicas en cuentacuentos
-- Fecha: 2026-01-14
-- Descripción: Las imágenes de cuentacuentos se guardaron con signed URLs
--              que expiran en 24 horas. Esta migración convierte las URLs
--              firmadas (/object/sign/) a públicas (/object/public/).
--              El bucket ya es público (migración 20260111).
-- ============================================

-- Paso 1: Convertir /object/sign/ a /object/public/ en slides
UPDATE liturgia_elementos
SET slides = REPLACE(
  slides::text,
  '/object/sign/',
  '/object/public/'
)::jsonb
WHERE tipo = 'cuentacuentos'
  AND slides IS NOT NULL
  AND slides::text LIKE '%/object/sign/%';

-- Paso 2: Convertir /object/sign/ a /object/public/ en edited_slides
UPDATE liturgia_elementos
SET edited_slides = REPLACE(
  edited_slides::text,
  '/object/sign/',
  '/object/public/'
)::jsonb
WHERE tipo = 'cuentacuentos'
  AND edited_slides IS NOT NULL
  AND edited_slides::text LIKE '%/object/sign/%';

-- Paso 3: Limpiar query params de token en slides
-- Las signed URLs tienen formato: .../path?token=xxx
-- Las públicas son: .../path (sin query params)
-- Usamos regexp_replace para eliminar ?token=... hasta el final de la URL o hasta la siguiente comilla

-- Nota: Esta es una limpieza más agresiva usando regexp
-- Si la URL contiene ?token=, se elimina todo desde ? hasta " o }
UPDATE liturgia_elementos
SET slides = regexp_replace(
  slides::text,
  '\?token=[^"}\]]+',
  '',
  'g'
)::jsonb
WHERE tipo = 'cuentacuentos'
  AND slides IS NOT NULL
  AND slides::text LIKE '%?token=%';

UPDATE liturgia_elementos
SET edited_slides = regexp_replace(
  edited_slides::text,
  '\?token=[^"}\]]+',
  '',
  'g'
)::jsonb
WHERE tipo = 'cuentacuentos'
  AND edited_slides IS NOT NULL
  AND edited_slides::text LIKE '%?token=%';

-- Verificación: Contar cuántas filas tienen cuentacuentos con imágenes
-- (Solo para logging, no afecta la migración)
DO $$
DECLARE
  total_cuentacuentos INTEGER;
  with_images INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_cuentacuentos
  FROM liturgia_elementos
  WHERE tipo = 'cuentacuentos';

  SELECT COUNT(*) INTO with_images
  FROM liturgia_elementos
  WHERE tipo = 'cuentacuentos'
    AND (
      slides::text LIKE '%imageUrl%'
      OR edited_slides::text LIKE '%imageUrl%'
    );

  RAISE NOTICE 'Total cuentacuentos: %, Con imágenes: %', total_cuentacuentos, with_images;
END $$;
