-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This will make brentcurtis76@gmail.com a super_admin for La Mesa Abierta

INSERT INTO mesa_abierta_admin_roles (user_id, role)
SELECT id, 'super_admin'::mesa_abierta_admin_role
FROM auth.users
WHERE email = 'brentcurtis76@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'::mesa_abierta_admin_role;

-- Verify the admin was added
SELECT
  u.email,
  ar.role,
  ar.created_at
FROM mesa_abierta_admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
WHERE u.email = 'brentcurtis76@gmail.com';
