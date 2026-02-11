-- =====================================================
-- CASA Music Planning Module — Helper Functions
-- Migration: 20260215000002_music_planning_functions
-- Created: 2026-02-15
-- Description: Creates 3 SECURITY DEFINER helper
--   functions for the music planning module:
--   1. get_musician_effective_availability — Computes
--      each musician's availability for a service date
--      from recurring patterns and overrides
--   2. get_available_musicians_for_date — Returns IDs
--      of available musicians for a specific date
--   3. get_song_usage_stats — Aggregates song usage
--      analytics from the usage log
-- Safety: All operations use CREATE OR REPLACE.
--   No DROP. Idempotent.
-- Depends on:
--   20260215000000_music_planning_schema.sql
-- =====================================================


-- =====================================================
-- 1. get_musician_effective_availability
-- Calcula la disponibilidad efectiva de cada músico
-- activo para una fecha de servicio específica.
-- Prioridad: override > recurring pattern > no_pattern
-- =====================================================

CREATE OR REPLACE FUNCTION get_musician_effective_availability(p_service_date_id UUID)
RETURNS TABLE (
  musician_id   UUID,
  display_name  TEXT,
  status        TEXT,
  source        TEXT,
  instruments   TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_date DATE;
  v_day_of_month INTEGER;
  v_week_of_month INTEGER;
  v_last_day_of_month DATE;
  v_is_last_week BOOLEAN;
BEGIN
  -- Obtener la fecha del servicio
  SELECT sd.date INTO v_service_date
  FROM music_service_dates sd
  WHERE sd.id = p_service_date_id;

  IF v_service_date IS NULL THEN
    RETURN;
  END IF;

  -- Calcular qué semana del mes es
  v_day_of_month := EXTRACT(DAY FROM v_service_date);
  v_week_of_month := CEIL(v_day_of_month::NUMERIC / 7);

  -- Determinar si es la última semana del mes
  v_last_day_of_month := (DATE_TRUNC('month', v_service_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_is_last_week := (v_last_day_of_month - v_service_date) < 7;

  RETURN QUERY
  SELECT
    m.id AS musician_id,
    m.display_name,
    CASE
      -- Si hay override, usar su estado
      WHEN ao.status IS NOT NULL THEN ao.status
      -- Si hay patrón recurrente, computar disponibilidad
      WHEN ra.pattern_type IS NOT NULL THEN
        CASE
          WHEN ra.pattern_type = 'every_week' THEN 'available'
          WHEN ra.pattern_type = 'first_and_third' AND v_week_of_month IN (1, 3) THEN 'available'
          WHEN ra.pattern_type = 'second_and_fourth' AND v_week_of_month IN (2, 4) THEN 'available'
          WHEN ra.pattern_type = 'first_only' AND v_week_of_month = 1 THEN 'available'
          WHEN ra.pattern_type = 'second_only' AND v_week_of_month = 2 THEN 'available'
          WHEN ra.pattern_type = 'third_only' AND v_week_of_month = 3 THEN 'available'
          WHEN ra.pattern_type = 'fourth_only' AND v_week_of_month = 4 THEN 'available'
          WHEN ra.pattern_type = 'last_only' AND v_is_last_week THEN 'available'
          WHEN ra.pattern_type = 'custom' AND v_week_of_month = ANY(ra.custom_weeks) THEN 'available'
          ELSE 'unavailable'
        END
      -- Sin patrón
      ELSE 'no_pattern'
    END AS status,
    CASE
      WHEN ao.status IS NOT NULL THEN 'override'
      WHEN ra.pattern_type IS NOT NULL THEN 'recurring'
      ELSE 'none'
    END AS source,
    -- Instrumentos del músico
    COALESCE(
      (SELECT array_agg(mi.instrument ORDER BY mi.is_primary DESC NULLS LAST)
       FROM music_musician_instruments mi
       WHERE mi.musician_id = m.id),
      ARRAY[]::TEXT[]
    ) AS instruments
  FROM music_musicians m
  -- Left join con override para esta fecha
  LEFT JOIN music_availability_overrides ao
    ON ao.musician_id = m.id
    AND ao.service_date_id = p_service_date_id
  -- Left join con patrón recurrente activo
  LEFT JOIN LATERAL (
    SELECT ra2.pattern_type, ra2.custom_weeks
    FROM music_recurring_availability ra2
    WHERE ra2.musician_id = m.id
      AND ra2.effective_from <= v_service_date
      AND (ra2.effective_until IS NULL OR ra2.effective_until >= v_service_date)
    ORDER BY ra2.effective_from DESC
    LIMIT 1
  ) ra ON true
  WHERE m.is_active = true
  ORDER BY m.display_name;
END;
$$;


-- =====================================================
-- 2. get_available_musicians_for_date
-- Versión simplificada que retorna solo los IDs de
-- músicos disponibles para una fecha específica.
-- =====================================================

CREATE OR REPLACE FUNCTION get_available_musicians_for_date(p_date DATE)
RETURNS TABLE (
  musician_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_of_month INTEGER;
  v_week_of_month INTEGER;
  v_last_day_of_month DATE;
  v_is_last_week BOOLEAN;
  v_service_date_id UUID;
BEGIN
  -- Calcular semana del mes
  v_day_of_month := EXTRACT(DAY FROM p_date);
  v_week_of_month := CEIL(v_day_of_month::NUMERIC / 7);

  -- Determinar si es la última semana
  v_last_day_of_month := (DATE_TRUNC('month', p_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_is_last_week := (v_last_day_of_month - p_date) < 7;

  -- Buscar service_date_id si existe
  SELECT sd.id INTO v_service_date_id
  FROM music_service_dates sd
  WHERE sd.date = p_date;

  RETURN QUERY
  SELECT m.id AS musician_id
  FROM music_musicians m
  WHERE m.is_active = true
    AND (
      -- Caso 1: Override explícito como 'available'
      (v_service_date_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM music_availability_overrides ao
        WHERE ao.musician_id = m.id
          AND ao.service_date_id = v_service_date_id
          AND ao.status = 'available'
      ))
      OR
      -- Caso 2: Sin override 'unavailable' y patrón recurrente coincide
      (
        -- No hay override 'unavailable'
        NOT EXISTS (
          SELECT 1 FROM music_availability_overrides ao
          WHERE ao.musician_id = m.id
            AND v_service_date_id IS NOT NULL
            AND ao.service_date_id = v_service_date_id
            AND ao.status IN ('unavailable', 'maybe')
        )
        -- Y tiene un patrón recurrente que coincide
        AND EXISTS (
          SELECT 1 FROM music_recurring_availability ra
          WHERE ra.musician_id = m.id
            AND ra.effective_from <= p_date
            AND (ra.effective_until IS NULL OR ra.effective_until >= p_date)
            AND (
              ra.pattern_type = 'every_week'
              OR (ra.pattern_type = 'first_and_third' AND v_week_of_month IN (1, 3))
              OR (ra.pattern_type = 'second_and_fourth' AND v_week_of_month IN (2, 4))
              OR (ra.pattern_type = 'first_only' AND v_week_of_month = 1)
              OR (ra.pattern_type = 'second_only' AND v_week_of_month = 2)
              OR (ra.pattern_type = 'third_only' AND v_week_of_month = 3)
              OR (ra.pattern_type = 'fourth_only' AND v_week_of_month = 4)
              OR (ra.pattern_type = 'last_only' AND v_is_last_week)
              OR (ra.pattern_type = 'custom' AND v_week_of_month = ANY(ra.custom_weeks))
            )
        )
      )
    );
END;
$$;


-- =====================================================
-- 3. get_song_usage_stats
-- Estadísticas de uso de una canción en los últimos
-- N días (default 365).
-- =====================================================

CREATE OR REPLACE FUNCTION get_song_usage_stats(p_song_id UUID, p_days INTEGER DEFAULT 365)
RETURNS TABLE (
  total_uses    BIGINT,
  last_used     DATE,
  moments       TEXT[],
  avg_gap_days  NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff_date DATE;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_days;

  RETURN QUERY
  WITH usage_data AS (
    SELECT
      sul.service_date,
      sul.liturgical_moment
    FROM music_song_usage_log sul
    WHERE sul.song_id = p_song_id
      AND sul.service_date >= v_cutoff_date
    ORDER BY sul.service_date
  ),
  date_gaps AS (
    SELECT
      service_date,
      service_date - LAG(service_date) OVER (ORDER BY service_date) AS gap_days
    FROM (SELECT DISTINCT service_date FROM usage_data) sub
  )
  SELECT
    COUNT(*)::BIGINT AS total_uses,
    MAX(ud.service_date) AS last_used,
    COALESCE(
      (SELECT array_agg(DISTINCT ud2.liturgical_moment)
       FROM usage_data ud2
       WHERE ud2.liturgical_moment IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS moments,
    COALESCE(
      (SELECT ROUND(AVG(dg.gap_days), 1)
       FROM date_gaps dg
       WHERE dg.gap_days IS NOT NULL),
      0
    ) AS avg_gap_days
  FROM usage_data ud;
END;
$$;


-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION get_musician_effective_availability(UUID) IS
  'CASA Music: Calcula disponibilidad efectiva de todos los músicos activos para una fecha de servicio (override > patrón recurrente > sin patrón)';

COMMENT ON FUNCTION get_available_musicians_for_date(DATE) IS
  'CASA Music: Retorna IDs de músicos disponibles para una fecha (override available o patrón recurrente coincidente sin override unavailable)';

COMMENT ON FUNCTION get_song_usage_stats(UUID, INTEGER) IS
  'CASA Music: Estadísticas de uso de una canción (total, última fecha, momentos litúrgicos, promedio de días entre usos)';
