-- Recreate get_users_by_ids with proper SECURITY DEFINER and permissions
-- This allows Edge Functions to access auth.users data via RPC

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_users_by_ids(uuid[]);

-- Create the function with SECURITY DEFINER to run with definer's privileges
CREATE OR REPLACE FUNCTION public.get_users_by_ids(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  email text,
  raw_user_meta_data jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.raw_user_meta_data
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

-- Force the owner to postgres to ensure proper privileges
ALTER FUNCTION public.get_users_by_ids(uuid[]) OWNER TO postgres;

-- Grant execute permissions to the roles that Edge Functions use
GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_users_by_ids(uuid[]) TO service_role;
