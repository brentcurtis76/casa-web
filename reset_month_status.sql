-- Reset month status back to 'open' for testing
-- This allows you to re-run the matching algorithm

UPDATE mesa_abierta_months
SET status = 'open'
WHERE month_date = '2024-12-01';
