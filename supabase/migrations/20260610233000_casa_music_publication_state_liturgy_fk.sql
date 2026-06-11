-- ============================================
-- Migración: FK real para liturgy_id en music_publication_state
-- Fecha: 2026-06-10
-- Descripción: Convierte music_publication_state.liturgy_id de TEXT a UUID
--              nullable con FK a liturgias(id) ON DELETE SET NULL — el mismo
--              patrón que las tablas children (20260216190000) para preservar
--              el historial de publicación y el log de envíos
--              (music_packet_deliveries) si se elimina la liturgia.
--              Idempotente y segura en BDs con datos pre-existentes:
--              desvincula (NULL) cualquier liturgy_id no-UUID o huérfano
--              antes del cast y del constraint.
-- ============================================

-- 1. liturgy_id pasa a ser nullable (requisito de ON DELETE SET NULL y de la
--    reparación defensiva del paso 2). DROP NOT NULL es idempotente.
ALTER TABLE public.music_publication_state
  ALTER COLUMN liturgy_id DROP NOT NULL;

-- 2. Reparación defensiva: desvincular valores no-UUID u huérfanos para que
--    el cast (22P02) y el constraint (23503) no fallen en BDs con datos
--    antiguos. El cast a text permite ejecutar este paso tanto antes como
--    después de la conversión de tipo.
UPDATE public.music_publication_state m
SET liturgy_id = NULL
WHERE m.liturgy_id IS NOT NULL
  AND (
    m.liturgy_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR NOT EXISTS (
      SELECT 1 FROM public.liturgias l
      WHERE l.id::text = lower(m.liturgy_id::text)
    )
  );

-- 3. TEXT → UUID (no-op si la columna ya es uuid).
ALTER TABLE public.music_publication_state
  ALTER COLUMN liturgy_id TYPE uuid USING liturgy_id::uuid;

-- 4. FK con SET NULL. El par DROP/ADD reemplaza cualquier versión previa del
--    constraint y hace la migración re-ejecutable.
ALTER TABLE public.music_publication_state
  DROP CONSTRAINT IF EXISTS music_publication_state_liturgy_id_fkey;

ALTER TABLE public.music_publication_state
  ADD CONSTRAINT music_publication_state_liturgy_id_fkey
  FOREIGN KEY (liturgy_id) REFERENCES public.liturgias(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.music_publication_state.liturgy_id IS
  'Liturgy ID (UUID, FK a liturgias.id; NULL si la liturgia fue eliminada)';
