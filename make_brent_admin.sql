-- ================================================
-- MAKE BRENT AN ADMIN FOR LA MESA ABIERTA
-- ================================================

-- Make brentcurtis76@gmail.com a super admin
INSERT INTO mesa_abierta_admin_roles (user_id, role)
SELECT
  id,
  'super_admin'
FROM auth.users
WHERE email = 'brentcurtis76@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Verify admin status
SELECT
  u.email,
  ar.role,
  ar.created_at
FROM mesa_abierta_admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
WHERE u.email = 'brentcurtis76@gmail.com';
