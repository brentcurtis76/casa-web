-- =====================================================
-- Add Test Participants for La Mesa Abierta
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, check what months exist:
-- SELECT id, dinner_date, status FROM mesa_abierta_months;

-- The current open month is: 986b9d3b-df9b-43d7-944c-ef50e7ad726e (December 5, 2025)

-- Check available users:
-- SELECT id, email FROM auth.users LIMIT 20;

DO $$
DECLARE
    v_month_id UUID;
    v_user_ids UUID[];
    v_participant_id UUID;
    v_user_id UUID;
    v_email TEXT;
    v_counter INT := 0;
BEGIN
    -- Get the open month for December 2025
    SELECT id INTO v_month_id
    FROM mesa_abierta_months
    WHERE status = 'open'
    ORDER BY dinner_date DESC
    LIMIT 1;

    IF v_month_id IS NULL THEN
        RAISE EXCEPTION 'No open month found!';
    END IF;

    RAISE NOTICE 'Using month_id: %', v_month_id;

    -- Get all user IDs (excluding the admin brentcurtis76@gmail.com who might already be registered)
    FOR v_user_id, v_email IN
        SELECT u.id, u.email
        FROM auth.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM mesa_abierta_participants p
            WHERE p.user_id = u.id AND p.month_id = v_month_id
        )
        LIMIT 12  -- Get up to 12 users for testing
    LOOP
        v_counter := v_counter + 1;

        -- Alternate between hosts and guests (first 3 are hosts, rest are guests)
        IF v_counter <= 3 THEN
            -- Create HOST participant
            INSERT INTO mesa_abierta_participants (
                user_id, month_id, role_preference, has_plus_one,
                host_address, host_max_guests, phone_number, status
            ) VALUES (
                v_user_id,
                v_month_id,
                'host',
                CASE WHEN v_counter = 1 THEN true ELSE false END,  -- First host has +1
                CASE
                    WHEN v_counter = 1 THEN 'Av. Providencia 1234, Providencia, Santiago'
                    WHEN v_counter = 2 THEN 'Las Condes 567, Las Condes, Santiago'
                    ELSE 'Ñuñoa 890, Ñuñoa, Santiago'
                END,
                CASE
                    WHEN v_counter = 1 THEN 6
                    WHEN v_counter = 2 THEN 5
                    ELSE 4
                END,
                '+56 9 ' || (1000 + v_counter)::TEXT || ' ' || (2000 + v_counter)::TEXT,
                'pending'
            )
            RETURNING id INTO v_participant_id;

            RAISE NOTICE 'Created HOST participant for %: %', v_email, v_participant_id;

            -- Add dietary restriction for first host
            IF v_counter = 1 THEN
                INSERT INTO mesa_abierta_dietary_restrictions (
                    participant_id, restriction_type, description, severity, is_plus_one
                ) VALUES (
                    v_participant_id, 'vegetarian', 'No como carne roja', 'preference', false
                );
            END IF;

        ELSE
            -- Create GUEST participant
            INSERT INTO mesa_abierta_participants (
                user_id, month_id, role_preference, has_plus_one,
                plus_one_name, phone_number, status
            ) VALUES (
                v_user_id,
                v_month_id,
                'guest',
                CASE WHEN v_counter IN (4, 6, 8) THEN true ELSE false END,  -- Some guests have +1
                CASE WHEN v_counter IN (4, 6, 8) THEN 'Acompañante de ' || v_email ELSE NULL END,
                '+56 9 ' || (3000 + v_counter)::TEXT || ' ' || (4000 + v_counter)::TEXT,
                'pending'
            )
            RETURNING id INTO v_participant_id;

            RAISE NOTICE 'Created GUEST participant for %: %', v_email, v_participant_id;

            -- Add various dietary restrictions for guests
            CASE v_counter
                WHEN 4 THEN
                    -- Vegan guest
                    INSERT INTO mesa_abierta_dietary_restrictions (
                        participant_id, restriction_type, description, severity, is_plus_one
                    ) VALUES (
                        v_participant_id, 'vegan', 'Estrictamente vegano', 'preference', false
                    );
                WHEN 5 THEN
                    -- Gluten-free guest (allergy)
                    INSERT INTO mesa_abierta_dietary_restrictions (
                        participant_id, restriction_type, description, severity, is_plus_one
                    ) VALUES (
                        v_participant_id, 'gluten_free', 'Celíaco', 'allergy', false
                    );
                WHEN 6 THEN
                    -- Guest with nut allergy and their +1 is dairy-free
                    INSERT INTO mesa_abierta_dietary_restrictions (
                        participant_id, restriction_type, description, severity, is_plus_one
                    ) VALUES
                    (v_participant_id, 'nut_allergy', 'Alergia severa a nueces', 'allergy', false),
                    (v_participant_id, 'dairy_free', 'Intolerante a la lactosa', 'preference', true);
                WHEN 7 THEN
                    -- Kosher guest
                    INSERT INTO mesa_abierta_dietary_restrictions (
                        participant_id, restriction_type, description, severity, is_plus_one
                    ) VALUES (
                        v_participant_id, 'other', 'Kosher', 'religious', false
                    );
                WHEN 8 THEN
                    -- Guest with shellfish allergy
                    INSERT INTO mesa_abierta_dietary_restrictions (
                        participant_id, restriction_type, description, severity, is_plus_one
                    ) VALUES (
                        v_participant_id, 'shellfish_allergy', 'Alergia a mariscos', 'allergy', false
                    );
                ELSE
                    -- No restrictions for other guests
                    NULL;
            END CASE;
        END IF;

    END LOOP;

    RAISE NOTICE 'Created % participants total', v_counter;

END $$;

-- Verify what was created
SELECT
    p.id,
    u.email,
    p.role_preference,
    p.has_plus_one,
    p.plus_one_name,
    p.host_address,
    p.host_max_guests,
    p.status,
    array_agg(d.restriction_type) as dietary_restrictions
FROM mesa_abierta_participants p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN mesa_abierta_dietary_restrictions d ON d.participant_id = p.id
WHERE p.month_id = (SELECT id FROM mesa_abierta_months WHERE status = 'open' ORDER BY dinner_date DESC LIMIT 1)
GROUP BY p.id, u.email, p.role_preference, p.has_plus_one, p.plus_one_name, p.host_address, p.host_max_guests, p.status
ORDER BY p.role_preference, p.created_at;
