-- Create a function to fetch multiple users by their IDs
-- This allows Edge Functions to access auth.users data
CREATE OR REPLACE FUNCTION get_users_by_ids(user_ids uuid[])
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
    u.email,
    u.raw_user_meta_data
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;
