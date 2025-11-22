-- ================================================
-- MAKE USER AN ADMIN FOR LA MESA ABIERTA
-- ================================================

-- First, check your user ID
SELECT id, email FROM auth.users WHERE email LIKE '%your-email%';

-- Replace YOUR_USER_ID with your actual user ID from above
INSERT INTO mesa_abierta_admin_roles (user_id, role)
VALUES (
  'YOUR_USER_ID',
  'super_admin'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Verify admin status
SELECT
  u.email,
  ar.role,
  ar.created_at
FROM mesa_abierta_admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
WHERE ar.user_id = 'YOUR_USER_ID';
