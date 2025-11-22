-- =====================================================
-- Fix Participants RLS for Admin Viewing
-- Problem: is_mesa_admin() function causes recursion
-- Solution: Recreate with SECURITY DEFINER to bypass RLS
-- =====================================================

-- Recreate the helper function with SECURITY DEFINER
-- This allows it to check admin_roles without triggering RLS
CREATE OR REPLACE FUNCTION is_mesa_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Direct query without policy check (SECURITY DEFINER bypasses RLS)
  SELECT EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = user_uuid
  ) INTO admin_exists;

  RETURN admin_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the function
SELECT is_mesa_admin('92d5dc7f-0a13-49b9-8b5b-9e5af7292ed6') AS is_admin;

SELECT 'Admin function updated successfully!' AS status;
