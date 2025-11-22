-- Test if the is_mesa_admin function works for your user

-- 1. Check if your admin role exists
SELECT
  user_id,
  role,
  created_at
FROM mesa_abierta_admin_roles
WHERE user_id = '92d5dc7f-0a13-49b9-8b5b-9e5af7292ed6';

-- 2. Test the is_mesa_admin function
SELECT is_mesa_admin('92d5dc7f-0a13-49b9-8b5b-9e5af7292ed6') AS is_admin_result;

-- 3. Try to query participants as if you were the admin
SET LOCAL "request.jwt.claims" = '{"sub": "92d5dc7f-0a13-49b9-8b5b-9e5af7292ed6"}';

SELECT COUNT(*) AS participant_count
FROM mesa_abierta_participants;
