-- =====================================================
-- CASA Music Planning — Harden RLS on Publication Tables
-- Migration: 20260216100001_casa_harden_publication_rls
-- Created: 2026-02-16
-- Description: Replaces permissive USING(true)/WITH CHECK(true)
--   policies on music_publication_state and music_packet_deliveries
--   with least-privilege policies:
--   - SELECT: authenticated (all roles can view)
--   - INSERT/UPDATE: has_permission('music_planning', 'write')
--   - DELETE: has_permission('music_planning', 'manage')
-- Safety: All operations are additive/idempotent. Drops only
--   the known-permissive policies from the initial migration,
--   then creates replacements.
-- Depends on:
--   20260216000000_casa_music_publication_state.sql
--   20260209000000_casa_rbac_schema.sql (has_permission)
-- SHARED DATABASE: Only music_* tables affected.
-- =====================================================

-- =====================================================
-- 1. DROP old permissive policies — music_publication_state
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert publication state" ON music_publication_state;
DROP POLICY IF EXISTS "Authenticated users can update publication state" ON music_publication_state;
DROP POLICY IF EXISTS "Authenticated users can delete publication state" ON music_publication_state;

-- Keep the SELECT policy (it was already correct: authenticated + USING(true))
-- We'll leave it as-is since read access for all authenticated users is desired.

-- =====================================================
-- 2. New least-privilege policies — music_publication_state
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pub_state_insert_role_gated'
      AND tablename = 'music_publication_state'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pub_state_insert_role_gated" ON music_publication_state
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pub_state_update_role_gated'
      AND tablename = 'music_publication_state'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pub_state_update_role_gated" ON music_publication_state
      FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pub_state_delete_role_gated'
      AND tablename = 'music_publication_state'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pub_state_delete_role_gated" ON music_publication_state
      FOR DELETE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;

-- =====================================================
-- 3. DROP old permissive policies — music_packet_deliveries
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can insert packet deliveries" ON music_packet_deliveries;
DROP POLICY IF EXISTS "Authenticated users can update packet deliveries" ON music_packet_deliveries;
DROP POLICY IF EXISTS "Authenticated users can delete packet deliveries" ON music_packet_deliveries;

-- Keep SELECT as-is (authenticated read access is correct for delivery logs)

-- =====================================================
-- 4. New least-privilege policies — music_packet_deliveries
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pkt_deliver_insert_role_gated'
      AND tablename = 'music_packet_deliveries'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pkt_deliver_insert_role_gated" ON music_packet_deliveries
      FOR INSERT TO authenticated
      WITH CHECK (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pkt_deliver_update_role_gated'
      AND tablename = 'music_packet_deliveries'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pkt_deliver_update_role_gated" ON music_packet_deliveries
      FOR UPDATE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      )
      WITH CHECK (
        public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_pkt_deliver_delete_role_gated'
      AND tablename = 'music_packet_deliveries'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "music_pkt_deliver_delete_role_gated" ON music_packet_deliveries
      FOR DELETE TO authenticated
      USING (
        public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;

-- =====================================================
-- COMPLETION
-- =====================================================
