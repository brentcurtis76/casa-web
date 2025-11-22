-- ================================================
-- CREATE TEST USERS FOR MOCK DATA (FIXED)
-- ================================================

-- Create 12 test users for La Mesa Abierta testing
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'mesaabierta_test' || i || '@test.local',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', 'Test User ' || i),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
FROM generate_series(1, 12) as i;

-- Also create profiles for these users
INSERT INTO profiles (id, full_name)
SELECT
  u.id,
  'Test User ' || ROW_NUMBER() OVER (ORDER BY u.created_at)
FROM auth.users u
WHERE u.email LIKE 'mesaabierta_test%@test.local'
ON CONFLICT (id) DO NOTHING;

-- Verify creation
SELECT COUNT(*) as total_users FROM auth.users;

-- Show the new test users
SELECT id, email, created_at
FROM auth.users
WHERE email LIKE 'mesaabierta_test%@test.local'
ORDER BY email;
