-- ================================================
-- RESET PASSWORD FOR brentcurtis76@gmail.com
-- New Password: Oasis4770
-- ================================================

-- Reset password for brentcurtis76@gmail.com
UPDATE auth.users
SET
  encrypted_password = crypt('Oasis4770', gen_salt('bf')),
  updated_at = NOW()
WHERE email = 'brentcurtis76@gmail.com';

-- Verify the user exists and was updated
SELECT
  id,
  email,
  updated_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'brentcurtis76@gmail.com';
