-- =====================================================
-- CASA Presentation — Transactional save for slide positions
-- Migration: 20260522000100_save_slides_positions_rpc
-- Created: 2026-05-22
-- Description: Adds save_liturgy_slides_positions() so the presenter
--   can atomically (a) update existing liturgia_elementos rows
--   (orden + slides/edited_slides) and (b) insert new rows for
--   imported temp slides. Previously the client looped UPDATE/INSERT
--   calls in JS — a mid-loop failure left partial state on the DB
--   while the API returned an error.
-- Safety: Additive only. New function, no destructive ALTER.
-- =====================================================

CREATE OR REPLACE FUNCTION public.save_liturgy_slides_positions(
  p_liturgy_id uuid,
  p_updates jsonb,
  p_inserts jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_update jsonb;
  v_insert jsonb;
  v_inserts_count integer := 0;
  v_updates_count integer := 0;
  v_id uuid;
BEGIN
  -- Require authenticated caller. Mirrors saveToLiturgyService.canSaveToLiturgy().
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No tienes permisos para guardar en esta liturgia'
      USING ERRCODE = '42501';
  END IF;

  -- Verify liturgy exists. ON DELETE CASCADE on liturgia_elementos.liturgia_id
  -- means a stale id would silently insert orphans without this check.
  IF NOT EXISTS (SELECT 1 FROM liturgias WHERE id = p_liturgy_id) THEN
    RAISE EXCEPTION 'Liturgia no encontrada: %', p_liturgy_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Updates: apply only the keys present in each entry so callers can
  -- update orden without touching slides, and vice versa.
  IF p_updates IS NOT NULL AND jsonb_typeof(p_updates) = 'array' THEN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates) LOOP
      v_id := (v_update->>'id')::uuid;
      IF v_id IS NULL THEN
        RAISE EXCEPTION 'Update entry missing id: %', v_update;
      END IF;

      -- Scope every update to this liturgy so a bad id can't touch another.
      UPDATE liturgia_elementos SET
        orden = COALESCE((v_update->>'orden')::integer, orden),
        slides = CASE
          WHEN v_update ? 'slides' THEN v_update->'slides'
          ELSE slides
        END,
        edited_slides = CASE
          WHEN v_update ? 'edited_slides' THEN v_update->'edited_slides'
          ELSE edited_slides
        END,
        updated_at = now()
      WHERE id = v_id AND liturgia_id = p_liturgy_id;

      IF FOUND THEN
        v_updates_count := v_updates_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- Inserts: each entry must include orden, tipo, titulo, slides.
  IF p_inserts IS NOT NULL AND jsonb_typeof(p_inserts) = 'array' THEN
    FOR v_insert IN SELECT * FROM jsonb_array_elements(p_inserts) LOOP
      INSERT INTO liturgia_elementos (
        liturgia_id, tipo, orden, titulo, slides, status, created_at, updated_at
      ) VALUES (
        p_liturgy_id,
        v_insert->>'tipo',
        (v_insert->>'orden')::integer,
        v_insert->>'titulo',
        v_insert->'slides',
        COALESCE(v_insert->>'status', 'completed'),
        now(),
        now()
      );
      v_inserts_count := v_inserts_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'updates_applied', v_updates_count,
    'inserts_applied', v_inserts_count
  );
END;
$$;

-- Allow authenticated users to call the function. The function itself
-- performs the auth check above; this just permits the EXECUTE.
GRANT EXECUTE ON FUNCTION public.save_liturgy_slides_positions(uuid, jsonb, jsonb)
  TO authenticated;
