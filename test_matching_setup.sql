-- ================================================
-- TEST DATA SETUP FOR MATCHING ALGORITHM
-- ================================================

-- Step 1: Create a test month (January 2025)
INSERT INTO mesa_abierta_months (month_date, registration_deadline, dinner_date, status)
VALUES (
  '2025-01-01',
  '2025-01-10 23:59:59',
  '2025-01-15',
  'open'
)
ON CONFLICT (month_date) DO UPDATE SET status = 'open'
RETURNING id;

-- Note: Copy the month ID from above, then use it below (replace YOUR_MONTH_ID)

-- Step 2: Check if you have test users
SELECT id, email FROM auth.users LIMIT 5;

-- Step 3: Create test participants (replace USER_IDs and MONTH_ID)
-- Example with 3 hosts and 9 guests = 12 total

-- HOSTS
INSERT INTO mesa_abierta_participants
  (user_id, month_id, role_preference, has_plus_one, host_max_guests, status)
VALUES
  ('YOUR_USER_ID_1', 'YOUR_MONTH_ID', 'host', false, 5, 'pending'),
  ('YOUR_USER_ID_2', 'YOUR_MONTH_ID', 'host', false, 6, 'pending'),
  ('YOUR_USER_ID_3', 'YOUR_MONTH_ID', 'host', true, 5, 'pending'); -- Host with +1

-- GUESTS
INSERT INTO mesa_abierta_participants
  (user_id, month_id, role_preference, has_plus_one, status)
VALUES
  ('YOUR_USER_ID_4', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_5', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_6', 'YOUR_MONTH_ID', 'guest', true, 'pending'),  -- Guest with +1
  ('YOUR_USER_ID_7', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_8', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_9', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_10', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_11', 'YOUR_MONTH_ID', 'guest', false, 'pending'),
  ('YOUR_USER_ID_12', 'YOUR_MONTH_ID', 'guest', false, 'pending');

-- Step 4: Add some dietary restrictions (optional)
INSERT INTO mesa_abierta_dietary_restrictions
  (participant_id, restriction_type, severity, is_plus_one)
SELECT
  p.id,
  'vegetarian',
  'preference',
  false
FROM mesa_abierta_participants p
WHERE p.month_id = 'YOUR_MONTH_ID'
  AND p.role_preference = 'guest'
LIMIT 2;

-- Step 5: Verify setup
SELECT
  role_preference,
  COUNT(*) as count,
  SUM(CASE WHEN has_plus_one THEN 2 ELSE 1 END) as total_people
FROM mesa_abierta_participants
WHERE month_id = 'YOUR_MONTH_ID'
GROUP BY role_preference;

-- Expected output:
-- role_preference | count | total_people
-- host           |   3   |   4 (one has +1)
-- guest          |   9   |  10 (one has +1)
-- Total capacity needed: 14 people (4 hosts + 10 guests)
-- Host capacity: 3 hosts * ~5 guests each = 15 capacity ✓
