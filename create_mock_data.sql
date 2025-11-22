-- ================================================
-- MOCK DATA FOR TESTING MATCHING ALGORITHM
-- Month ID: 986b9d3b-df9b-43d7-944c-ef50e7ad726e
-- ================================================

-- Step 1: Check if we have enough users
SELECT COUNT(*) as user_count FROM auth.users;
-- You need at least 12 users. If you don't have enough, see note at bottom.

-- Step 2: Create mock participants using existing users
DO $$
DECLARE
  month_uuid UUID := '986b9d3b-df9b-43d7-944c-ef50e7ad726e';
  user_ids UUID[];
  i INT;
BEGIN
  -- Get first 12 user IDs
  SELECT ARRAY_AGG(id) INTO user_ids
  FROM (
    SELECT id FROM auth.users
    ORDER BY created_at
    LIMIT 12
  ) sub;

  -- Check if we have enough users
  IF array_length(user_ids, 1) < 12 THEN
    RAISE EXCEPTION 'Need at least 12 users. Only found %', array_length(user_ids, 1);
  END IF;

  -- Create 3 HOSTS
  INSERT INTO mesa_abierta_participants
    (user_id, month_id, role_preference, has_plus_one, host_max_guests, status)
  VALUES
    (user_ids[1], month_uuid, 'host', false, 5, 'pending'),
    (user_ids[2], month_uuid, 'host', false, 6, 'pending'),
    (user_ids[3], month_uuid, 'host', true, 5, 'pending'); -- Host with +1

  -- Create 9 GUESTS
  FOR i IN 4..12 LOOP
    INSERT INTO mesa_abierta_participants
      (user_id, month_id, role_preference, has_plus_one, status)
    VALUES
      (user_ids[i], month_uuid, 'guest',
       CASE WHEN i = 6 THEN true ELSE false END, -- Guest #6 has +1
       'pending');
  END LOOP;

  -- Add some dietary restrictions
  INSERT INTO mesa_abierta_dietary_restrictions
    (participant_id, restriction_type, severity, is_plus_one)
  SELECT
    p.id,
    CASE
      WHEN p.user_id = user_ids[4] THEN 'vegetarian'
      WHEN p.user_id = user_ids[7] THEN 'gluten_free'
      WHEN p.user_id = user_ids[10] THEN 'nut_allergy'
    END,
    CASE
      WHEN p.user_id = user_ids[10] THEN 'allergy'
      ELSE 'preference'
    END,
    false
  FROM mesa_abierta_participants p
  WHERE p.month_id = month_uuid
    AND p.user_id IN (user_ids[4], user_ids[7], user_ids[10]);

  RAISE NOTICE 'Mock data created successfully!';
END $$;

-- Step 3: Verify the data
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = '986b9d3b-df9b-43d7-944c-ef50e7ad726e'
GROUP BY role_preference;

-- Expected output:
-- role_preference | count | total_people
-- host           |   3   |   4 (one has +1)
-- guest          |   9   |  10 (one has +1)

-- Step 4: Check dietary restrictions
SELECT
  p.role_preference,
  d.restriction_type,
  d.severity,
  COUNT(*) as count
FROM mesa_abierta_dietary_restrictions d
JOIN mesa_abierta_participants p ON p.id = d.participant_id
WHERE p.month_id = '986b9d3b-df9b-43d7-944c-ef50e7ad726e'
GROUP BY p.role_preference, d.restriction_type, d.severity;

-- ================================================
-- NOTE: If you don't have 12 users
-- ================================================
-- You'll need to create test users first. Run this in a separate query:
/*
DO $$
DECLARE
  test_email TEXT;
  i INT;
BEGIN
  FOR i IN 1..12 LOOP
    test_email := 'test' || i || '@mesaabierta.test';

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
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      test_email,
      crypt('password123', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

  END LOOP;

  RAISE NOTICE 'Created 12 test users';
END $$;
*/
