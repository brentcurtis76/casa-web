-- Clean ALL La Mesa Abierta test data
-- This will remove all participants, matches, assignments, and test users

DO $$
DECLARE
  v_month_id UUID;
BEGIN
  -- Get the December 2024 month ID
  SELECT id INTO v_month_id FROM mesa_abierta_months WHERE month_date = '2024-12-01';

  IF v_month_id IS NOT NULL THEN
    -- Delete assignments (will cascade from matches, but let's be explicit)
    DELETE FROM mesa_abierta_assignments
    WHERE match_id IN (
      SELECT id FROM mesa_abierta_matches WHERE month_id = v_month_id
    );

    -- Delete matches
    DELETE FROM mesa_abierta_matches WHERE month_id = v_month_id;

    -- Delete dietary restrictions
    DELETE FROM mesa_abierta_dietary_restrictions
    WHERE participant_id IN (
      SELECT id FROM mesa_abierta_participants WHERE month_id = v_month_id
    );

    -- Delete WhatsApp messages
    DELETE FROM mesa_abierta_whatsapp_messages
    WHERE participant_id IN (
      SELECT id FROM mesa_abierta_participants WHERE month_id = v_month_id
    );

    -- Delete email logs
    DELETE FROM mesa_abierta_email_logs WHERE month_id = v_month_id;

    -- Delete participants
    DELETE FROM mesa_abierta_participants WHERE month_id = v_month_id;

    -- Delete test users
    DELETE FROM auth.users WHERE email LIKE '%test@anglicanasanandres.cl';

    RAISE NOTICE 'All test data cleaned successfully!';
  ELSE
    RAISE NOTICE 'December 2024 month not found, nothing to clean.';
  END IF;
END $$;
