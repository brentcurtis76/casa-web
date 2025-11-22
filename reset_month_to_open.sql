-- Reset December 2024 month to 'open' status for testing
-- This allows you to run the matching algorithm again

UPDATE mesa_abierta_months
SET status = 'open'
WHERE month_date = '2024-12-01';

-- Reset all participants to 'pending' status
UPDATE mesa_abierta_participants
SET
  status = 'pending',
  assigned_role = NULL
WHERE month_id IN (
  SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01'
);

-- Delete existing matches and assignments
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (
  SELECT id FROM mesa_abierta_matches
  WHERE month_id IN (
    SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01'
  )
);

DELETE FROM mesa_abierta_matches
WHERE month_id IN (
  SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01'
);

SELECT 'Month reset to open status - ready for matching!' AS status;
