-- E3a · AUDIO · `slug` de episodio: invariante en la base
--
-- Additive only (D9). Fichero NUEVO: `20260610090000_church_podcast_episodes.sql` ya está
-- en `schema_migrations` y editarlo dejaría `db reset` verde en local sin aplicar nada a
-- una base desplegada.
--
-- D23 — la base garantiza el slug; el cliente sólo aporta una preferencia. Ningún
-- publicador puede olvidarse de ponerlo, porque ya no es su trabajo.
-- D12 — el slug es inmutable: transición única `NULL → valor`, y `published ⇒ slug NOT NULL`.
--
-- EL ORDEN DE ESTE FICHERO NO ES NEGOCIABLE. El `CHECK` del paso 6 antes del backfill del
-- paso 2 falla sobre una tabla con filas `published` sin slug — medido, no supuesto.

-- ── 1. Columna ─────────────────────────────────────────────────────────────────
ALTER TABLE public.church_podcast_episodes
  ADD COLUMN IF NOT EXISTS slug TEXT;

COMMENT ON COLUMN public.church_podcast_episodes.slug IS
  'Slug público del episodio (/reflexiones/<slug>). Lo asigna el trigger trg_podcast_episodes_slug al publicar; el cliente sólo aporta una preferencia. Inmutable una vez asignado (D12).';

-- ── 2. Backfill de las filas `published` anteriores a esta migración ───────────
-- No reproduce la derivación de TS a propósito: duplicar el algoritmo crearía dos fuentes
-- que derivan. Los episodios históricos sólo necesitan un slug estable, único y válido.
WITH backfill AS (
  SELECT
    id,
    'reflexion-' || to_char(episode_date, 'YYYY-MM-DD') AS base,
    ROW_NUMBER() OVER (PARTITION BY episode_date ORDER BY created_at, id) AS n
  FROM public.church_podcast_episodes
  WHERE status = 'published' AND slug IS NULL
)
UPDATE public.church_podcast_episodes AS e
SET slug = CASE WHEN b.n = 1 THEN b.base ELSE b.base || '-' || b.n END
FROM backfill AS b
WHERE e.id = b.id;

-- ── 3. Longitud ───────────────────────────────────────────────────────────────
ALTER TABLE public.church_podcast_episodes
  ADD CONSTRAINT podcast_episode_slug_length
  CHECK (slug IS NULL OR char_length(slug) BETWEEN 1 AND 80);

-- ── 4. Unicidad — el árbitro real de la concurrencia, no el `NOT EXISTS` ───────
CREATE UNIQUE INDEX IF NOT EXISTS idx_podcast_episodes_slug
  ON public.church_podcast_episodes (slug)
  WHERE slug IS NOT NULL;

-- ── 5. Trigger de asignación ──────────────────────────────────────────────────
-- Presupuesto del sufijo (hueco 1): la base se re-trunca a `80 − len(sufijo)`, y el sufijo
-- máximo es `-5` (2 caracteres), así que el resultado nunca pasa de 80 por construcción.
-- Truncado (hueco 2): corta en el último `-` dentro del presupuesto; si no hay ninguno,
-- corte duro y recorte del `-` sobrante.
CREATE OR REPLACE FUNCTION public.church_podcast_episode_slug_body(
  p_base TEXT,
  p_budget INT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT rtrim(
    CASE
      WHEN char_length(p_base) <= p_budget THEN p_base
      WHEN strpos(reverse(left(p_base, p_budget)), '-') > 0
        THEN left(p_base, p_budget - strpos(reverse(left(p_base, p_budget)), '-'))
      ELSE left(p_base, p_budget)
    END,
    '-'
  );
$$;

CREATE OR REPLACE FUNCTION public.assign_podcast_episode_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base      TEXT;
  v_suffix    TEXT;
  v_candidate TEXT;
  v_attempt   INT;
BEGIN
  -- Inmutabilidad (D12). Un slug asignado no cambia nunca: `23514`, jamás `23505`,
  -- que entraría en el reintento del cliente y lo haría girar en vano.
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'slug inmutable: el episodio % ya tiene el slug %', OLD.id, OLD.slug
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- El slug se asigna al publicar. Un borrador no lo lleva, y una preferencia aportada
  -- antes de publicar no se guarda sin resolver.
  IF NEW.status IS DISTINCT FROM 'published' THEN
    NEW.slug := NULL;
    RETURN NEW;
  END IF;

  -- Preferencia del cliente si la hay; si no, el fallback `reflexion-<episode_date>`,
  -- que además desempata como cualquier otra base.
  -- El `btrim` de guiones no es normalización (eso es de TS): es lo que garantiza que el
  -- truncado del hueco 2 nunca devuelva cadena vacía, porque tras él la base no empieza
  -- por `-` y el último `-` dentro del presupuesto cae siempre en posición ≥ 2.
  v_base := nullif(btrim(btrim(coalesce(NEW.slug, '')), '-'), '');
  IF v_base IS NULL THEN
    v_base := 'reflexion-' || to_char(NEW.episode_date, 'YYYY-MM-DD');
  END IF;

  -- Hueco 3: cinco intentos en total — sin sufijo, luego `-2`…`-5`.
  FOR v_attempt IN 1..5 LOOP
    IF v_attempt = 1 THEN
      v_suffix := '';
    ELSE
      v_suffix := '-' || v_attempt::TEXT;
    END IF;

    v_candidate :=
      public.church_podcast_episode_slug_body(v_base, 80 - char_length(v_suffix))
      || v_suffix;

    IF NOT EXISTS (
      SELECT 1
      FROM public.church_podcast_episodes
      WHERE slug = v_candidate
        AND id <> NEW.id
    ) THEN
      NEW.slug := v_candidate;
      RETURN NEW;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'no hay slug libre para la base % tras 5 intentos', v_base
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_podcast_episodes_slug ON public.church_podcast_episodes;
CREATE TRIGGER trg_podcast_episodes_slug
  BEFORE INSERT OR UPDATE ON public.church_podcast_episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_podcast_episode_slug();

-- ── 6. `published ⇒ slug NOT NULL` (D12) ──────────────────────────────────────
ALTER TABLE public.church_podcast_episodes
  ADD CONSTRAINT podcast_episode_published_has_slug
  CHECK (status <> 'published' OR slug IS NOT NULL);
