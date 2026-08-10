-- E3a · AUDIO — pruebas del invariante de slug contra Postgres local.
--
-- Ejecutar (psql NO existe en el host; el cliente vive en el contenedor):
--
--   docker exec -i supabase_db_$(grep '^project_id' supabase/config.toml | cut -d'"' -f2) \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/slug.sql
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: el conjunto BASELINE del
-- seed (rango `…-9000-…`) queda intacto y el fichero es reejecutable sin `db reset`.
-- Las filas que crea van al rango `…-8000-…`, como manda el contrato de rangos de UUID.
--
-- MUTACIÓN DECLARADA (D18): en `assign_podcast_episode_slug`, en el camino de fallback,
-- conservar el `RETURN NEW` y dejar `NEW.slug := NULL`. El `CHECK` del paso 6 de la
-- migración lo caza y T1 se pone rojo.

\set ON_ERROR_STOP on

BEGIN;

-- ── Utilidades sólo de test ───────────────────────────────────────────────────
CREATE FUNCTION pg_temp.publicar(
  p_id UUID,
  p_title TEXT,
  p_date DATE,
  p_slug TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  -- Borrador primero, publicación después: es la forma que usan tanto el editor
  -- (`publishService`) como `podcast-backfill`.
  INSERT INTO public.church_podcast_episodes (id, title, episode_date, guid)
  VALUES (p_id, p_title, p_date, 'e2e-slug-' || p_id::TEXT);

  UPDATE public.church_podcast_episodes
  SET status = 'published',
      audio_url = 'https://example.invalid/' || p_id::TEXT || '.mp3',
      audio_size_bytes = 1000,
      duration_seconds = 60,
      published_at = NOW(),
      slug = COALESCE(p_slug, slug)
  WHERE id = p_id
  RETURNING slug INTO v_slug;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

\echo '=== T1 — fallback: publicar sin aportar slug'
DO $$
DECLARE v TEXT;
BEGIN
  v := pg_temp.publicar('00000000-e2e0-4000-8000-000000000001', 'Sin preferencia', '2026-05-04');
  ASSERT v = 'reflexion-2026-05-04', format('T1: se esperaba reflexion-2026-05-04, llegó %L', v);
END $$;

\echo '=== T2 — el fallback TAMBIÉN desempata'
DO $$
DECLARE v TEXT;
BEGIN
  v := pg_temp.publicar('00000000-e2e0-4000-8000-000000000002', 'Misma fecha', '2026-05-04');
  ASSERT v = 'reflexion-2026-05-04-2', format('T2: se esperaba reflexion-2026-05-04-2, llegó %L', v);
END $$;

\echo '=== T3 — unicidad: la misma base tres veces da x, x-2, x-3'
DO $$
DECLARE a TEXT; b TEXT; c TEXT;
BEGIN
  a := pg_temp.publicar('00000000-e2e0-4000-8000-000000000011', 'A', '2026-06-01', 'reflexion-de-prueba');
  b := pg_temp.publicar('00000000-e2e0-4000-8000-000000000012', 'B', '2026-06-02', 'reflexion-de-prueba');
  c := pg_temp.publicar('00000000-e2e0-4000-8000-000000000013', 'C', '2026-06-03', 'reflexion-de-prueba');
  ASSERT a = 'reflexion-de-prueba',   format('T3: primero %L', a);
  ASSERT b = 'reflexion-de-prueba-2', format('T3: segundo %L', b);
  ASSERT c = 'reflexion-de-prueba-3', format('T3: tercero %L', c);
END $$;

\echo '=== T4 — presupuesto del sufijo: 80 exactos, y la misma base en colisión sigue <= 80'
DO $$
DECLARE base TEXT; a TEXT; b TEXT;
BEGIN
  base := repeat('abcdefghij-', 7) || 'abc';          -- 80 caracteres exactos
  ASSERT char_length(base) = 80, 'T4: la base de prueba no mide 80';

  a := pg_temp.publicar('00000000-e2e0-4000-8000-000000000021', 'Larga', '2026-07-01', base);
  ASSERT a = base, format('T4: sin colisión se esperaba la base intacta, llegó %L', a);

  b := pg_temp.publicar('00000000-e2e0-4000-8000-000000000022', 'Larga otra vez', '2026-07-02', base);
  ASSERT char_length(b) <= 80, format('T4: %L mide %s', b, char_length(b));
  ASSERT b LIKE '%-2',         format('T4: se esperaba sufijo -2, llegó %L', b);
  ASSERT b NOT LIKE '%--2',    format('T4: guion sobrante sin recortar en %L', b);
  RAISE NOTICE 'T4: 80 -> % (% caracteres)', b, char_length(b);
END $$;

\echo '=== T5 — corte duro cuando no hay guion dentro del presupuesto'
DO $$
DECLARE v TEXT;
BEGIN
  v := pg_temp.publicar('00000000-e2e0-4000-8000-000000000031', 'Sin guiones', '2026-07-10', repeat('a', 100));
  ASSERT v = repeat('a', 80), format('T5: se esperaba corte duro a 80, llegó %L (%s)', v, char_length(v));
END $$;

\echo '=== T6 — inmutabilidad (D12): cambiar un slug asignado da 23514, nunca 23505'
DO $$
DECLARE v_state TEXT;
BEGIN
  BEGIN
    UPDATE public.church_podcast_episodes
    SET slug = 'otro-slug'
    WHERE id = '00000000-e2e0-4000-8000-000000000001';
    RAISE EXCEPTION 'T6: se esperaba 23514 y el UPDATE pasó';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    ASSERT v_state = '23514', format('T6: sqlstate %L', v_state);
    ASSERT SQLERRM LIKE 'slug inmutable%', format('T6: mensaje inesperado %L', SQLERRM);
  END;
END $$;

\echo '=== T7 — republicar conserva el mismo slug (D12)'
DO $$
DECLARE v TEXT;
BEGIN
  UPDATE public.church_podcast_episodes SET status = 'draft'
  WHERE id = '00000000-e2e0-4000-8000-000000000011';

  UPDATE public.church_podcast_episodes
  SET status = 'published', published_at = NOW()
  WHERE id = '00000000-e2e0-4000-8000-000000000011'
  RETURNING slug INTO v;

  ASSERT v = 'reflexion-de-prueba', format('T7: republicar cambió el slug a %L', v);
END $$;

\echo '=== T8 — hueco 3: agotados los 5 intentos, 23514 nombrando la base'
DO $$
DECLARE v_state TEXT;
BEGIN
  PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000042', 'D', '2026-08-02', 'ocupada');
  PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000043', 'E', '2026-08-03', 'ocupada');
  PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000044', 'F', '2026-08-04', 'ocupada');
  PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000045', 'G', '2026-08-05', 'ocupada');
  PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000046', 'H', '2026-08-06', 'ocupada');
  -- ocupada, ocupada-2 … ocupada-5 tomados: el sexto no tiene dónde caer.
  BEGIN
    PERFORM pg_temp.publicar('00000000-e2e0-4000-8000-000000000047', 'I', '2026-08-07', 'ocupada');
    RAISE EXCEPTION 'T8: se esperaba 23514 y la publicación pasó';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    ASSERT v_state = '23514', format('T8: sqlstate %L', v_state);
    ASSERT SQLERRM LIKE '%ocupada%', format('T8: el mensaje no nombra la base: %L', SQLERRM);
    RAISE NOTICE 'T8: %', SQLERRM;
  END;
END $$;

\echo '=== T9 — un borrador no lleva slug, aunque se aporte preferencia'
DO $$
DECLARE v TEXT;
BEGIN
  INSERT INTO public.church_podcast_episodes (id, title, episode_date, guid, slug)
  VALUES ('00000000-e2e0-4000-8000-000000000051', 'Borrador', '2026-09-01', 'e2e-slug-borrador', 'preferencia')
  RETURNING slug INTO v;
  ASSERT v IS NULL, format('T9: el borrador se quedó con %L', v);
END $$;

\echo '=== T10 — el caso podcast-backfill: la forma exacta de index.ts:353, sin slug'
DO $$
DECLARE v TEXT;
BEGIN
  INSERT INTO public.church_podcast_episodes (id, title, episode_date, guid)
  VALUES ('00000000-e2e0-4000-8000-000000000061', 'Histórico de Spotify', '2026-10-05', 'e2e-slug-backfill');

  UPDATE public.church_podcast_episodes
  SET status = 'published',
      audio_url = 'https://example.invalid/backfill.mp3',
      audio_size_bytes = 4242,
      duration_seconds = 600,
      mime_type = 'audio/mpeg',
      cover_url = NULL,
      published_at = NOW(),
      episode_number = 991
  WHERE id = '00000000-e2e0-4000-8000-000000000061'
  RETURNING slug INTO v;

  ASSERT v = 'reflexion-2026-10-05', format('T10: llegó %L', v);
  ASSERT char_length(v) BETWEEN 1 AND 80, 'T10: longitud fuera del CHECK';
END $$;

\echo '=== T11 — el CHECK del paso 6 ANTES del backfill falla (se demuestra el orden)'
DO $$
DECLARE v_state TEXT;
BEGIN
  -- Reconstruimos el estado previo a la migración: sin el CHECK del paso 6 y con el
  -- trigger apagado, de modo que exista una fila `published` con slug NULL.
  ALTER TABLE public.church_podcast_episodes
    DROP CONSTRAINT podcast_episode_published_has_slug;
  ALTER TABLE public.church_podcast_episodes
    DISABLE TRIGGER trg_podcast_episodes_slug;

  INSERT INTO public.church_podcast_episodes
    (id, title, episode_date, guid, status, published_at, audio_url, audio_size_bytes, duration_seconds)
  VALUES ('00000000-e2e0-4000-8000-000000000071', 'Preexistente sin slug', '2026-11-02',
          'e2e-slug-preexistente', 'published', NOW(),
          'https://example.invalid/pre.mp3', 10, 10);

  BEGIN
    ALTER TABLE public.church_podcast_episodes
      ADD CONSTRAINT podcast_episode_published_has_slug
      CHECK (status <> 'published' OR slug IS NOT NULL);
    RAISE EXCEPTION 'T11: el CHECK entró sobre una fila published sin slug';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    ASSERT v_state = '23514', format('T11: sqlstate %L', v_state);
    RAISE NOTICE 'T11: %', SQLERRM;
  END;
END $$;

\echo '=== TODOS LOS TESTS DE SLUG PASARON'

ROLLBACK;
