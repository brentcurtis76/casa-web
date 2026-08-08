-- P1 · UPGRADE · opt-out del plato principal
-- Additive only. PR1 (excepción a la regla de prefijo de tabla) y PR2 (autorización para
-- aplicar a la instancia compartida) concedidos por Brent el 2026-08-06; ver el Decision
-- Log de docs/plan/upgrade/PLAN.md.

ALTER TABLE public.mesa_abierta_participants
  ADD COLUMN IF NOT EXISTS can_bring_main_dish BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.get_my_dinner_summary(p_month_id uuid)
RETURNS TABLE (match_id uuid, total_people integer, main_dish_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id,
         (1 + (CASE WHEN hp.has_plus_one THEN 1 ELSE 0 END)
            + COALESCE((SELECT SUM(1 + CASE WHEN gp.has_plus_one THEN 1 ELSE 0 END)
                        FROM public.mesa_abierta_assignments a
                        JOIN public.mesa_abierta_participants gp ON gp.id = a.guest_participant_id
                        WHERE a.match_id = m.id), 0))::integer,
         ((CASE WHEN m.host_food_assignment = 'main_course' THEN 1 ELSE 0 END)
            + COALESCE((SELECT COUNT(*) FROM public.mesa_abierta_assignments a2
                        WHERE a2.match_id = m.id AND a2.food_assignment = 'main_course'), 0))::integer
  FROM public.mesa_abierta_matches m
  JOIN public.mesa_abierta_participants hp ON hp.id = m.host_participant_id
  WHERE m.month_id = p_month_id
    AND (
      hp.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.mesa_abierta_assignments a3
                 JOIN public.mesa_abierta_participants p3 ON p3.id = a3.guest_participant_id
                 WHERE a3.match_id = m.id AND p3.user_id = auth.uid())
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_dinner_summary(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_dinner_summary(uuid) TO authenticated;
