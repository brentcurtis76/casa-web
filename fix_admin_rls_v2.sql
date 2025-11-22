-- =====================================================
-- Fix Admin Roles RLS - Avoid Infinite Recursion
-- Problem: is_mesa_admin() function causes recursion
-- Solution: Allow authenticated users to view their own role
--          Management done via service role (Edge Functions)
-- =====================================================

-- Drop ALL existing policies on mesa_abierta_admin_roles
DROP POLICY IF EXISTS "Admins can view admin roles" ON mesa_abierta_admin_roles;
DROP POLICY IF EXISTS "Users can view own admin role" ON mesa_abierta_admin_roles;
DROP POLICY IF EXISTS "Super admins can manage admin roles" ON mesa_abierta_admin_roles;

-- Simple policy: Authenticated users can see their own admin role (no recursion)
CREATE POLICY "Users can view own admin role"
  ON mesa_abierta_admin_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Note: INSERT/UPDATE/DELETE operations should be done via Edge Functions
-- using service role key to bypass RLS. This avoids recursion issues.

-- Verify the fix
SELECT 'Admin RLS policies updated successfully!' AS status;
