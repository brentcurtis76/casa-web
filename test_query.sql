-- Test query to verify data structure matches what Edge Function expects
-- This simulates what the send-mesa-notifications function is trying to query

SELECT
  m.id as match_id,
  m.dinner_date,
  m.dinner_time,
  -- Host info
  h_part.id as host_participant_id,
  h_part.host_address,
  h_part.phone_number,
  h_user.email as host_email,
  h_user.raw_user_meta_data->>'full_name' as host_name,
  -- Guest assignments
  a.id as assignment_id,
  a.food_assignment,
  g_part.id as guest_participant_id,
  g_part.has_plus_one,
  g_user.email as guest_email,
  g_user.raw_user_meta_data->>'full_name' as guest_name
FROM mesa_abierta_matches m
JOIN mesa_abierta_participants h_part ON h_part.id = m.host_participant_id
JOIN auth.users h_user ON h_user.id = h_part.user_id
LEFT JOIN mesa_abierta_assignments a ON a.match_id = m.id
LEFT JOIN mesa_abierta_participants g_part ON g_part.id = a.guest_participant_id
LEFT JOIN auth.users g_user ON g_user.id = g_part.user_id
WHERE m.month_id = (SELECT id FROM mesa_abierta_months WHERE month_date = '2024-12-01')
ORDER BY m.id, a.id;
