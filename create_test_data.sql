-- Create Test Data for La Mesa Abierta Email Testing
-- This creates a complete test scenario with participants, matches, and assignments

-- First, get the December 2024 month ID
DO $$
DECLARE
  v_month_id UUID;
  v_test_user1 UUID;
  v_test_user2 UUID;
  v_test_user3 UUID;
  v_test_user4 UUID;
  v_test_user5 UUID;
  v_test_user6 UUID;
  v_test_user7 UUID;
  v_test_user8 UUID;
BEGIN
  -- Get the December 2024 month
  SELECT id INTO v_month_id FROM mesa_abierta_months WHERE month_date = '2024-12-01';

  IF v_month_id IS NULL THEN
    RAISE EXCEPTION 'December 2024 month not found!';
  END IF;

  -- Create test users (or get existing ones)
  -- User 1: Host
  SELECT id INTO v_test_user1 FROM auth.users WHERE email = 'host1.test@anglicanasanandres.cl';
  IF v_test_user1 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'host1.test@anglicanasanandres.cl',
      '{"full_name": "María Rodríguez"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user1;
  END IF;

  -- User 2: Host
  SELECT id INTO v_test_user2 FROM auth.users WHERE email = 'host2.test@anglicanasanandres.cl';
  IF v_test_user2 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'host2.test@anglicanasanandres.cl',
      '{"full_name": "Carlos González"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user2;
  END IF;

  -- User 3: Guest
  SELECT id INTO v_test_user3 FROM auth.users WHERE email = 'guest1.test@anglicanasanandres.cl';
  IF v_test_user3 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest1.test@anglicanasanandres.cl',
      '{"full_name": "Juan Pérez"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user3;
  END IF;

  -- User 4: Guest
  SELECT id INTO v_test_user4 FROM auth.users WHERE email = 'guest2.test@anglicanasanandres.cl';
  IF v_test_user4 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest2.test@anglicanasanandres.cl',
      '{"full_name": "Ana Martínez"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user4;
  END IF;

  -- User 5: Guest
  SELECT id INTO v_test_user5 FROM auth.users WHERE email = 'guest3.test@anglicanasanandres.cl';
  IF v_test_user5 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest3.test@anglicanasanandres.cl',
      '{"full_name": "Luis Silva"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user5;
  END IF;

  -- User 6: Guest
  SELECT id INTO v_test_user6 FROM auth.users WHERE email = 'guest4.test@anglicanasanandres.cl';
  IF v_test_user6 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest4.test@anglicanasanandres.cl',
      '{"full_name": "Patricia Fernández"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user6;
  END IF;

  -- User 7: Guest
  SELECT id INTO v_test_user7 FROM auth.users WHERE email = 'guest5.test@anglicanasanandres.cl';
  IF v_test_user7 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest5.test@anglicanasanandres.cl',
      '{"full_name": "Roberto López"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user7;
  END IF;

  -- User 8: Guest
  SELECT id INTO v_test_user8 FROM auth.users WHERE email = 'guest6.test@anglicanasanandres.cl';
  IF v_test_user8 IS NULL THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    VALUES (
      gen_random_uuid(),
      'guest6.test@anglicanasanandres.cl',
      '{"full_name": "Carmen Díaz"}'::jsonb,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_test_user8;
  END IF;

  -- Create participants (hosts)
  INSERT INTO mesa_abierta_participants (user_id, month_id, role_preference, assigned_role, has_plus_one, status, host_address, phone_number)
  VALUES
    (v_test_user1, v_month_id, 'host', 'host', FALSE, 'confirmed', 'Av. Vicente Pérez Rosales 1765, Puerto Varas', '+56 9 4162 3577'),
    (v_test_user2, v_month_id, 'host', 'host', FALSE, 'confirmed', 'Calle Principal 456, Puerto Varas', '+56 9 8765 4321');

  -- Create participants (guests)
  INSERT INTO mesa_abierta_participants (user_id, month_id, role_preference, assigned_role, has_plus_one, status, phone_number)
  VALUES
    (v_test_user3, v_month_id, 'guest', 'guest', FALSE, 'confirmed', '+56 9 1111 1111'),
    (v_test_user4, v_month_id, 'guest', 'guest', TRUE, 'confirmed', '+56 9 2222 2222'),
    (v_test_user5, v_month_id, 'guest', 'guest', FALSE, 'confirmed', '+56 9 3333 3333'),
    (v_test_user6, v_month_id, 'guest', 'guest', FALSE, 'confirmed', '+56 9 4444 4444'),
    (v_test_user7, v_month_id, 'guest', 'guest', FALSE, 'confirmed', '+56 9 5555 5555'),
    (v_test_user8, v_month_id, 'guest', 'guest', FALSE, 'confirmed', '+56 9 6666 6666');

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Month ID: %', v_month_id;
  RAISE NOTICE 'Total participants: 8 (2 hosts, 6 guests)';
  RAISE NOTICE 'NOTE: Run the Create Matches function in the admin panel to generate matches and assignments';
END $$;
