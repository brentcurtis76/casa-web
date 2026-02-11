-- =====================================================
-- CASA Music Planning Module — Row Level Security
-- Migration: 20260215000001_music_planning_rls
-- Created: 2026-02-15
-- Description: Enables RLS on all 19 music planning
--   tables and creates granular access policies.
--   Access patterns:
--   - Song library (5 tables): SELECT for all
--     authenticated, write via 'canciones' resource
--   - Song usage log: SELECT via 'canciones' read,
--     INSERT for authenticated, UPDATE/DELETE via
--     'canciones' manage
--   - Musician tables (4 tables): Self-access via
--     user_id, coordinator via 'music_planning'
--   - Scheduling tables (7 tables): Authenticated
--     read, coordinator write via 'music_planning'
--   - Notifications: 'music_planning' read/write
--   - Practice sessions: Own records only
-- Safety: All operations use CREATE POLICY (additive).
--   No DROP POLICY. Idempotent via DO blocks.
-- Depends on:
--   20260215000000_music_planning_schema.sql
--   20260209000000_casa_rbac_schema.sql (has_permission)
-- RBAC resources used:
--   'canciones' — song library (shared with liturgist)
--   'music_planning' — musician mgmt, scheduling,
--     setlists, rehearsals, notifications
--     (worship_coordinator + general_admin only)
-- =====================================================


-- =====================================================
-- 1. ENABLE RLS ON ALL 19 TABLES
-- =====================================================

ALTER TABLE music_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_arrangements ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_stems ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_chord_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_audio_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_song_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_musicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_musician_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_recurring_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_service_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_rehearsal_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_rehearsal_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_setlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_practice_sessions ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 2. SONG LIBRARY POLICIES (resource: 'canciones')
-- music_songs, music_arrangements, music_stems,
-- music_chord_charts, music_audio_references:
--   SELECT: all authenticated
--   INSERT/UPDATE/DELETE: has_permission('canciones', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 2.1 music_songs
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_songs_select' AND tablename = 'music_songs') THEN
    CREATE POLICY "music_songs_select" ON music_songs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_songs_insert' AND tablename = 'music_songs') THEN
    CREATE POLICY "music_songs_insert" ON music_songs
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_songs_update' AND tablename = 'music_songs') THEN
    CREATE POLICY "music_songs_update" ON music_songs
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_songs_delete' AND tablename = 'music_songs') THEN
    CREATE POLICY "music_songs_delete" ON music_songs
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 2.2 music_arrangements
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_arrangements_select' AND tablename = 'music_arrangements') THEN
    CREATE POLICY "music_arrangements_select" ON music_arrangements
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_arrangements_insert' AND tablename = 'music_arrangements') THEN
    CREATE POLICY "music_arrangements_insert" ON music_arrangements
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_arrangements_update' AND tablename = 'music_arrangements') THEN
    CREATE POLICY "music_arrangements_update" ON music_arrangements
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_arrangements_delete' AND tablename = 'music_arrangements') THEN
    CREATE POLICY "music_arrangements_delete" ON music_arrangements
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 2.3 music_stems
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_stems_select' AND tablename = 'music_stems') THEN
    CREATE POLICY "music_stems_select" ON music_stems
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_stems_insert' AND tablename = 'music_stems') THEN
    CREATE POLICY "music_stems_insert" ON music_stems
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_stems_update' AND tablename = 'music_stems') THEN
    CREATE POLICY "music_stems_update" ON music_stems
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_stems_delete' AND tablename = 'music_stems') THEN
    CREATE POLICY "music_stems_delete" ON music_stems
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 2.4 music_chord_charts
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_chord_charts_select' AND tablename = 'music_chord_charts') THEN
    CREATE POLICY "music_chord_charts_select" ON music_chord_charts
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_chord_charts_insert' AND tablename = 'music_chord_charts') THEN
    CREATE POLICY "music_chord_charts_insert" ON music_chord_charts
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_chord_charts_update' AND tablename = 'music_chord_charts') THEN
    CREATE POLICY "music_chord_charts_update" ON music_chord_charts
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_chord_charts_delete' AND tablename = 'music_chord_charts') THEN
    CREATE POLICY "music_chord_charts_delete" ON music_chord_charts
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 2.5 music_audio_references
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_audio_references_select' AND tablename = 'music_audio_references') THEN
    CREATE POLICY "music_audio_references_select" ON music_audio_references
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_audio_references_insert' AND tablename = 'music_audio_references') THEN
    CREATE POLICY "music_audio_references_insert" ON music_audio_references
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_audio_references_update' AND tablename = 'music_audio_references') THEN
    CREATE POLICY "music_audio_references_update" ON music_audio_references
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_audio_references_delete' AND tablename = 'music_audio_references') THEN
    CREATE POLICY "music_audio_references_delete" ON music_audio_references
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'write'));
  END IF;
END $$;


-- =====================================================
-- 3. SONG USAGE LOG POLICIES (resource: 'canciones')
-- SELECT: has_permission('canciones', 'read')
-- INSERT: any authenticated user
-- UPDATE/DELETE: has_permission('canciones', 'manage')
-- =====================================================

-- -----------------------------------------------------
-- 3.1 music_song_usage_log
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_song_usage_log_select' AND tablename = 'music_song_usage_log') THEN
    CREATE POLICY "music_song_usage_log_select" ON music_song_usage_log
      FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'read'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_song_usage_log_insert' AND tablename = 'music_song_usage_log') THEN
    CREATE POLICY "music_song_usage_log_insert" ON music_song_usage_log
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_song_usage_log_update' AND tablename = 'music_song_usage_log') THEN
    CREATE POLICY "music_song_usage_log_update" ON music_song_usage_log
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'manage'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_song_usage_log_delete' AND tablename = 'music_song_usage_log') THEN
    CREATE POLICY "music_song_usage_log_delete" ON music_song_usage_log
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'canciones', 'manage'));
  END IF;
END $$;


-- =====================================================
-- 4. MUSICIAN POLICIES (resource: 'music_planning')
-- music_musicians:
--   SELECT: own record OR has_permission('music_planning', 'read')
--   INSERT/UPDATE: own record OR has_permission('music_planning', 'write')
--   DELETE: has_permission('music_planning', 'manage')
-- =====================================================

-- -----------------------------------------------------
-- 4.1 music_musicians
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musicians_select_own' AND tablename = 'music_musicians') THEN
    CREATE POLICY "music_musicians_select_own" ON music_musicians
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musicians_insert' AND tablename = 'music_musicians') THEN
    CREATE POLICY "music_musicians_insert" ON music_musicians
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musicians_update' AND tablename = 'music_musicians') THEN
    CREATE POLICY "music_musicians_update" ON music_musicians
      FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musicians_delete' AND tablename = 'music_musicians') THEN
    CREATE POLICY "music_musicians_delete" ON music_musicians
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'manage'));
  END IF;
END $$;


-- =====================================================
-- 5. MUSICIAN DETAIL POLICIES (resource: 'music_planning')
-- music_musician_instruments, music_recurring_availability,
-- music_availability_overrides:
--   SELECT: own (via musician_id->user_id)
--     OR has_permission('music_planning', 'read')
--   INSERT/UPDATE: own OR has_permission('music_planning', 'write')
--   DELETE: own OR has_permission('music_planning', 'manage')
-- =====================================================

-- -----------------------------------------------------
-- 5.1 music_musician_instruments
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musician_instruments_select' AND tablename = 'music_musician_instruments') THEN
    CREATE POLICY "music_musician_instruments_select" ON music_musician_instruments
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musician_instruments_insert' AND tablename = 'music_musician_instruments') THEN
    CREATE POLICY "music_musician_instruments_insert" ON music_musician_instruments
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musician_instruments_update' AND tablename = 'music_musician_instruments') THEN
    CREATE POLICY "music_musician_instruments_update" ON music_musician_instruments
      FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_musician_instruments_delete' AND tablename = 'music_musician_instruments') THEN
    CREATE POLICY "music_musician_instruments_delete" ON music_musician_instruments
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;

-- -----------------------------------------------------
-- 5.2 music_recurring_availability
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_recurring_availability_select' AND tablename = 'music_recurring_availability') THEN
    CREATE POLICY "music_recurring_availability_select" ON music_recurring_availability
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_recurring_availability_insert' AND tablename = 'music_recurring_availability') THEN
    CREATE POLICY "music_recurring_availability_insert" ON music_recurring_availability
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_recurring_availability_update' AND tablename = 'music_recurring_availability') THEN
    CREATE POLICY "music_recurring_availability_update" ON music_recurring_availability
      FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_recurring_availability_delete' AND tablename = 'music_recurring_availability') THEN
    CREATE POLICY "music_recurring_availability_delete" ON music_recurring_availability
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;

-- -----------------------------------------------------
-- 5.3 music_availability_overrides
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_availability_overrides_select' AND tablename = 'music_availability_overrides') THEN
    CREATE POLICY "music_availability_overrides_select" ON music_availability_overrides
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_availability_overrides_insert' AND tablename = 'music_availability_overrides') THEN
    CREATE POLICY "music_availability_overrides_insert" ON music_availability_overrides
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_availability_overrides_update' AND tablename = 'music_availability_overrides') THEN
    CREATE POLICY "music_availability_overrides_update" ON music_availability_overrides
      FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_availability_overrides_delete' AND tablename = 'music_availability_overrides') THEN
    CREATE POLICY "music_availability_overrides_delete" ON music_availability_overrides
      FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;


-- =====================================================
-- 6. SERVICE DATE POLICIES (resource: 'music_planning')
-- SELECT: all authenticated
-- INSERT/UPDATE/DELETE: has_permission('music_planning', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 6.1 music_service_dates
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_dates_select' AND tablename = 'music_service_dates') THEN
    CREATE POLICY "music_service_dates_select" ON music_service_dates
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_dates_insert' AND tablename = 'music_service_dates') THEN
    CREATE POLICY "music_service_dates_insert" ON music_service_dates
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_dates_update' AND tablename = 'music_service_dates') THEN
    CREATE POLICY "music_service_dates_update" ON music_service_dates
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_dates_delete' AND tablename = 'music_service_dates') THEN
    CREATE POLICY "music_service_dates_delete" ON music_service_dates
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;


-- =====================================================
-- 7. SERVICE ASSIGNMENT POLICIES (resource: 'music_planning')
-- SELECT: own (musician_id->user_id) OR has_permission read
-- INSERT/UPDATE/DELETE: has_permission('music_planning', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 7.1 music_service_assignments
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_assignments_select' AND tablename = 'music_service_assignments') THEN
    CREATE POLICY "music_service_assignments_select" ON music_service_assignments
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_assignments_insert' AND tablename = 'music_service_assignments') THEN
    CREATE POLICY "music_service_assignments_insert" ON music_service_assignments
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_assignments_update' AND tablename = 'music_service_assignments') THEN
    CREATE POLICY "music_service_assignments_update" ON music_service_assignments
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_service_assignments_delete' AND tablename = 'music_service_assignments') THEN
    CREATE POLICY "music_service_assignments_delete" ON music_service_assignments
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;


-- =====================================================
-- 8. REHEARSAL POLICIES (resource: 'music_planning')
-- music_rehearsals, music_rehearsal_songs:
--   SELECT: all authenticated
--   INSERT/UPDATE/DELETE: has_permission('music_planning', 'write')
-- music_rehearsal_attendees:
--   SELECT: own (musician_id->user_id) OR has_permission read
--   UPDATE: own OR has_permission write
--   INSERT/DELETE: has_permission('music_planning', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 8.1 music_rehearsals
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsals_select' AND tablename = 'music_rehearsals') THEN
    CREATE POLICY "music_rehearsals_select" ON music_rehearsals
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsals_insert' AND tablename = 'music_rehearsals') THEN
    CREATE POLICY "music_rehearsals_insert" ON music_rehearsals
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsals_update' AND tablename = 'music_rehearsals') THEN
    CREATE POLICY "music_rehearsals_update" ON music_rehearsals
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsals_delete' AND tablename = 'music_rehearsals') THEN
    CREATE POLICY "music_rehearsals_delete" ON music_rehearsals
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 8.2 music_rehearsal_songs
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_songs_select' AND tablename = 'music_rehearsal_songs') THEN
    CREATE POLICY "music_rehearsal_songs_select" ON music_rehearsal_songs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_songs_insert' AND tablename = 'music_rehearsal_songs') THEN
    CREATE POLICY "music_rehearsal_songs_insert" ON music_rehearsal_songs
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_songs_update' AND tablename = 'music_rehearsal_songs') THEN
    CREATE POLICY "music_rehearsal_songs_update" ON music_rehearsal_songs
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_songs_delete' AND tablename = 'music_rehearsal_songs') THEN
    CREATE POLICY "music_rehearsal_songs_delete" ON music_rehearsal_songs
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 8.3 music_rehearsal_attendees
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_attendees_select' AND tablename = 'music_rehearsal_attendees') THEN
    CREATE POLICY "music_rehearsal_attendees_select" ON music_rehearsal_attendees
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'read')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_attendees_update' AND tablename = 'music_rehearsal_attendees') THEN
    CREATE POLICY "music_rehearsal_attendees_update" ON music_rehearsal_attendees
      FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM music_musicians WHERE id = musician_id AND user_id = auth.uid())
        OR public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_attendees_insert' AND tablename = 'music_rehearsal_attendees') THEN
    CREATE POLICY "music_rehearsal_attendees_insert" ON music_rehearsal_attendees
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_rehearsal_attendees_delete' AND tablename = 'music_rehearsal_attendees') THEN
    CREATE POLICY "music_rehearsal_attendees_delete" ON music_rehearsal_attendees
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;


-- =====================================================
-- 9. SETLIST POLICIES (resource: 'music_planning')
-- SELECT: all authenticated
-- INSERT/UPDATE/DELETE: has_permission('music_planning', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 9.1 music_setlists
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlists_select' AND tablename = 'music_setlists') THEN
    CREATE POLICY "music_setlists_select" ON music_setlists
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlists_insert' AND tablename = 'music_setlists') THEN
    CREATE POLICY "music_setlists_insert" ON music_setlists
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlists_update' AND tablename = 'music_setlists') THEN
    CREATE POLICY "music_setlists_update" ON music_setlists
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlists_delete' AND tablename = 'music_setlists') THEN
    CREATE POLICY "music_setlists_delete" ON music_setlists
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

-- -----------------------------------------------------
-- 9.2 music_setlist_items
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlist_items_select' AND tablename = 'music_setlist_items') THEN
    CREATE POLICY "music_setlist_items_select" ON music_setlist_items
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlist_items_insert' AND tablename = 'music_setlist_items') THEN
    CREATE POLICY "music_setlist_items_insert" ON music_setlist_items
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlist_items_update' AND tablename = 'music_setlist_items') THEN
    CREATE POLICY "music_setlist_items_update" ON music_setlist_items
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_setlist_items_delete' AND tablename = 'music_setlist_items') THEN
    CREATE POLICY "music_setlist_items_delete" ON music_setlist_items
      FOR DELETE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;


-- =====================================================
-- 10. NOTIFICATION LOG POLICIES (resource: 'music_planning')
-- SELECT: has_permission('music_planning', 'read')
-- INSERT/UPDATE: has_permission('music_planning', 'write')
-- =====================================================

-- -----------------------------------------------------
-- 10.1 music_notification_logs
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_notification_logs_select' AND tablename = 'music_notification_logs') THEN
    CREATE POLICY "music_notification_logs_select" ON music_notification_logs
      FOR SELECT TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'read'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_notification_logs_insert' AND tablename = 'music_notification_logs') THEN
    CREATE POLICY "music_notification_logs_insert" ON music_notification_logs
      FOR INSERT TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_notification_logs_update' AND tablename = 'music_notification_logs') THEN
    CREATE POLICY "music_notification_logs_update" ON music_notification_logs
      FOR UPDATE TO authenticated
      USING (public.has_permission(auth.uid(), 'music_planning', 'write'));
  END IF;
END $$;


-- =====================================================
-- 11. PRACTICE SESSION POLICIES
-- All operations: own records only (user_id = auth.uid())
-- =====================================================

-- -----------------------------------------------------
-- 11.1 music_practice_sessions
-- -----------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_practice_sessions_select' AND tablename = 'music_practice_sessions') THEN
    CREATE POLICY "music_practice_sessions_select" ON music_practice_sessions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_practice_sessions_insert' AND tablename = 'music_practice_sessions') THEN
    CREATE POLICY "music_practice_sessions_insert" ON music_practice_sessions
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_practice_sessions_update' AND tablename = 'music_practice_sessions') THEN
    CREATE POLICY "music_practice_sessions_update" ON music_practice_sessions
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'music_practice_sessions_delete' AND tablename = 'music_practice_sessions') THEN
    CREATE POLICY "music_practice_sessions_delete" ON music_practice_sessions
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
