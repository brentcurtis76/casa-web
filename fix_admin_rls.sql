-- =====================================================
-- Fix Admin Roles RLS Policy
-- Problem: Chicken-and-egg - users can't check if they're admin
-- Solution: Allow users to read their own admin role
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can view admin roles" ON mesa_abierta_admin_roles;

-- Create new policy: Users can view their own admin role
CREATE POLICY "Users can view own admin role"
  ON mesa_abierta_admin_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Keep the super admin management policy
-- (already exists, no change needed)
