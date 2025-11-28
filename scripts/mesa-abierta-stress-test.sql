-- =====================================================
-- Mesa Abierta Stress Test Script
-- Run each scenario separately in Supabase SQL Editor
-- =====================================================

-- STEP 1: Create a test month (run once)
-- =====================================================
INSERT INTO mesa_abierta_months (id, month_date, dinner_date, dinner_time, registration_deadline, status)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  '2025-02-01',
  '2025-02-15',
  '19:30:00',
  '2025-02-10',
  'open'
)
ON CONFLICT (id) DO UPDATE SET status = 'open';

-- =====================================================
-- SCENARIO 1: Many guests, few hosts (capacity stress)
-- 3 hosts (capacity ~15), 20 guests (~26 people with +1s)
-- Expected: Some guests on waitlist
-- Requires: 23 users minimum
-- =====================================================

-- Clean up previous test data for this month
DELETE FROM mesa_abierta_dietary_restrictions
WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
UPDATE mesa_abierta_months SET status = 'open' WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

DO $$
DECLARE
  v_month_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_user_ids UUID[];
  v_user_id UUID;
  v_participant_id UUID;
  v_idx INT;
BEGIN
  -- Get available users
  SELECT array_agg(id) INTO v_user_ids FROM (SELECT id FROM auth.users LIMIT 26) u;

  IF array_length(v_user_ids, 1) < 23 THEN
    RAISE NOTICE 'Need at least 23 users for this scenario. Have: %', array_length(v_user_ids, 1);
    RETURN;
  END IF;

  -- Create 3 hosts with varying capacities
  FOR v_idx IN 1..3 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, host_address, host_max_guests, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'host',
      v_idx = 1, -- First host has +1
      'Test Address ' || v_idx,
      4 + v_idx, -- Capacities: 5, 6, 7
      'pending',
      '+56900000' || v_idx
    );
    RAISE NOTICE 'Created host % with capacity %', v_idx, 4 + v_idx;
  END LOOP;

  -- Create 20 guests (mix of +1s)
  FOR v_idx IN 4..23 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, plus_one_name, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'guest',
      v_idx % 3 = 0, -- Every 3rd guest has +1
      CASE WHEN v_idx % 3 = 0 THEN 'Plus One ' || v_idx ELSE NULL END,
      'pending',
      '+56900000' || v_idx
    )
    RETURNING id INTO v_participant_id;

    -- Add dietary restrictions to some guests
    IF v_idx % 5 = 0 THEN
      INSERT INTO mesa_abierta_dietary_restrictions (participant_id, restriction_type, severity, description, is_plus_one)
      VALUES (v_participant_id, 'vegetarian', 'preference', 'No meat', false);
    END IF;
    IF v_idx % 7 = 0 THEN
      INSERT INTO mesa_abierta_dietary_restrictions (participant_id, restriction_type, severity, description, is_plus_one)
      VALUES (v_participant_id, 'gluten_free', 'allergy', 'Celiac disease', false);
    END IF;
  END LOOP;

  RAISE NOTICE 'SCENARIO 1: Created 3 hosts and 20 guests';
END $$;

-- Verify scenario 1 setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 1 ELSE 0 END) as with_plus_one,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY role_preference;


-- =====================================================
-- SCENARIO 2: Many hosts, few guests (min 5 people test)
-- 10 hosts, 8 guests
-- Expected: Most hosts go to waitlist, only 1-2 dinners created
-- =====================================================

-- Clean up previous test data
DELETE FROM mesa_abierta_dietary_restrictions
WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
UPDATE mesa_abierta_months SET status = 'open' WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

DO $$
DECLARE
  v_month_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_user_ids UUID[];
  v_user_id UUID;
  v_idx INT;
BEGIN
  SELECT array_agg(id) INTO v_user_ids FROM (SELECT id FROM auth.users LIMIT 20) u;

  IF array_length(v_user_ids, 1) < 18 THEN
    RAISE NOTICE 'Need at least 18 users for this scenario';
    RETURN;
  END IF;

  -- Create 10 hosts
  FOR v_idx IN 1..10 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, host_address, host_max_guests, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'host',
      v_idx <= 3, -- First 3 hosts have +1
      'Test Address ' || v_idx,
      5 + (v_idx % 3), -- Capacities: 5, 6, 7 rotating
      'pending',
      '+56900000' || v_idx
    );
  END LOOP;

  -- Create 8 guests
  FOR v_idx IN 11..18 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, plus_one_name, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'guest',
      v_idx % 2 = 0, -- Half have +1
      CASE WHEN v_idx % 2 = 0 THEN 'Plus One ' || v_idx ELSE NULL END,
      'pending',
      '+56900000' || v_idx
    );
  END LOOP;

  RAISE NOTICE 'SCENARIO 2: Created 10 hosts and 8 guests';
END $$;

-- Verify scenario 2 setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 1 ELSE 0 END) as with_plus_one,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY role_preference;


-- =====================================================
-- SCENARIO 3: All participants have +1s
-- 5 hosts (all with +1), 15 guests (all with +1)
-- Expected: Tests capacity math with +1s everywhere
-- =====================================================

-- Clean up
DELETE FROM mesa_abierta_dietary_restrictions
WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
UPDATE mesa_abierta_months SET status = 'open' WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

DO $$
DECLARE
  v_month_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_user_ids UUID[];
  v_user_id UUID;
  v_idx INT;
BEGIN
  SELECT array_agg(id) INTO v_user_ids FROM (SELECT id FROM auth.users LIMIT 20) u;

  IF array_length(v_user_ids, 1) < 20 THEN
    RAISE NOTICE 'Need at least 20 users for this scenario';
    RETURN;
  END IF;

  -- Create 5 hosts ALL with +1
  FOR v_idx IN 1..5 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, plus_one_name, host_address, host_max_guests, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'host',
      true,
      'Host Plus One ' || v_idx,
      'Test Address ' || v_idx,
      6, -- All capacity 6 (so 5 guest spots after +1)
      'pending',
      '+56900000' || v_idx
    );
  END LOOP;

  -- Create 15 guests ALL with +1
  FOR v_idx IN 6..20 LOOP
    v_user_id := v_user_ids[v_idx];
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, plus_one_name, status, phone_number)
    VALUES (
      v_month_id,
      v_user_id,
      'guest',
      true,
      'Guest Plus One ' || v_idx,
      'pending',
      '+56900000' || v_idx
    );
  END LOOP;

  RAISE NOTICE 'SCENARIO 3: Created 5 hosts (all +1) and 15 guests (all +1)';
  RAISE NOTICE 'Total people: 5 hosts + 5 host +1s + 15 guests + 15 guest +1s = 40 people';
  RAISE NOTICE 'Capacity: 5 hosts x 5 guest spots = 25 guest spots (for 30 guest-side people)';
END $$;

-- Verify scenario 3 setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 1 ELSE 0 END) as with_plus_one,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY role_preference;


-- =====================================================
-- SCENARIO 4: Small group edge case
-- 1 host, 2 guests (both without +1)
-- Expected: Creates dinner with 3 people (allowed exception)
-- =====================================================

-- Clean up
DELETE FROM mesa_abierta_dietary_restrictions
WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
UPDATE mesa_abierta_months SET status = 'open' WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

DO $$
DECLARE
  v_month_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_user_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_user_ids FROM (SELECT id FROM auth.users LIMIT 3) u;

  -- 1 host
  INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, host_address, host_max_guests, status, phone_number)
  VALUES (v_month_id, v_user_ids[1], 'host', false, 'Test Address', 5, 'pending', '+56900000001');

  -- 2 guests
  INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, status, phone_number)
  VALUES (v_month_id, v_user_ids[2], 'guest', false, 'pending', '+56900000002');
  INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, status, phone_number)
  VALUES (v_month_id, v_user_ids[3], 'guest', false, 'pending', '+56900000003');

  RAISE NOTICE 'SCENARIO 4: Created 1 host and 2 guests (3 total people)';
END $$;

-- Verify scenario 4 setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY role_preference;


-- =====================================================
-- SCENARIO 5: Exact capacity fit
-- 2 hosts (capacity 5 each = 10 spots), 10 solo guests
-- Expected: Perfect distribution, no waitlist
-- =====================================================

-- Clean up
DELETE FROM mesa_abierta_dietary_restrictions
WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_assignments
WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
UPDATE mesa_abierta_months SET status = 'open' WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

DO $$
DECLARE
  v_month_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_user_ids UUID[];
  v_idx INT;
BEGIN
  SELECT array_agg(id) INTO v_user_ids FROM (SELECT id FROM auth.users LIMIT 12) u;

  -- 2 hosts with capacity 5 each (no +1)
  FOR v_idx IN 1..2 LOOP
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, host_address, host_max_guests, status, phone_number)
    VALUES (v_month_id, v_user_ids[v_idx], 'host', false, 'Test Address ' || v_idx, 5, 'pending', '+56900000' || v_idx);
  END LOOP;

  -- 10 solo guests
  FOR v_idx IN 3..12 LOOP
    INSERT INTO mesa_abierta_participants (month_id, user_id, role_preference, has_plus_one, status, phone_number)
    VALUES (v_month_id, v_user_ids[v_idx], 'guest', false, 'pending', '+56900000' || v_idx);
  END LOOP;

  RAISE NOTICE 'SCENARIO 5: Created 2 hosts (cap 5 each) and 10 solo guests';
  RAISE NOTICE 'Expected: 2 dinners with 6 people each (host + 5 guests)';
END $$;

-- Verify scenario 5 setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY role_preference;


-- =====================================================
-- CLEANUP: Delete test month when done
-- =====================================================
-- DELETE FROM mesa_abierta_dietary_restrictions
-- WHERE participant_id IN (SELECT id FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
-- DELETE FROM mesa_abierta_assignments
-- WHERE match_id IN (SELECT id FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
-- DELETE FROM mesa_abierta_matches WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
-- DELETE FROM mesa_abierta_participants WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
-- DELETE FROM mesa_abierta_months WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';


-- =====================================================
-- VERIFICATION QUERIES (run after matching)
-- =====================================================

-- Check match results
SELECT
  m.id as match_id,
  m.guest_count,
  p.has_plus_one as host_has_plus_one,
  (SELECT COUNT(*) FROM mesa_abierta_assignments a WHERE a.match_id = m.id) as assigned_guests,
  (SELECT SUM(CASE WHEN pp.has_plus_one THEN 2 ELSE 1 END)
   FROM mesa_abierta_assignments a
   JOIN mesa_abierta_participants pp ON pp.id = a.guest_participant_id
   WHERE a.match_id = m.id) as guest_side_people,
  1 + (CASE WHEN p.has_plus_one THEN 1 ELSE 0 END) +
  (SELECT COALESCE(SUM(CASE WHEN pp.has_plus_one THEN 2 ELSE 1 END), 0)
   FROM mesa_abierta_assignments a
   JOIN mesa_abierta_participants pp ON pp.id = a.guest_participant_id
   WHERE a.match_id = m.id) as total_people
FROM mesa_abierta_matches m
JOIN mesa_abierta_participants p ON p.id = m.host_participant_id
WHERE m.month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
ORDER BY m.created_at;

-- Check participant statuses after matching
SELECT
  status,
  role_preference,
  assigned_role,
  COUNT(*) as count
FROM mesa_abierta_participants
WHERE month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY status, role_preference, assigned_role
ORDER BY status, role_preference;

-- Verify minimum 5 people rule
SELECT
  m.id,
  1 + (CASE WHEN hp.has_plus_one THEN 1 ELSE 0 END) as host_side,
  COALESCE(SUM(CASE WHEN gp.has_plus_one THEN 2 ELSE 1 END), 0) as guest_side,
  1 + (CASE WHEN hp.has_plus_one THEN 1 ELSE 0 END) +
  COALESCE(SUM(CASE WHEN gp.has_plus_one THEN 2 ELSE 1 END), 0) as total_people,
  CASE WHEN 1 + (CASE WHEN hp.has_plus_one THEN 1 ELSE 0 END) +
       COALESCE(SUM(CASE WHEN gp.has_plus_one THEN 2 ELSE 1 END), 0) >= 5
       THEN 'OK' ELSE 'BELOW MIN (exception allowed)' END as status
FROM mesa_abierta_matches m
JOIN mesa_abierta_participants hp ON hp.id = m.host_participant_id
LEFT JOIN mesa_abierta_assignments a ON a.match_id = m.id
LEFT JOIN mesa_abierta_participants gp ON gp.id = a.guest_participant_id
WHERE m.month_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
GROUP BY m.id, hp.has_plus_one;
