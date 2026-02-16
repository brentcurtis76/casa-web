-- =====================================================
-- CASA Music Planning — music-packets Storage Bucket
-- Migration: 20260216100000_casa_music_packets_storage
-- Created: 2026-02-16
-- Description: Creates the music-packets Supabase storage
--   bucket (private) for generated PDF music packets, with
--   RLS policies for authenticated read and role-gated write.
-- Safety: All operations are additive and idempotent.
--   Uses INSERT ON CONFLICT DO NOTHING and IF NOT EXISTS.
-- Depends on:
--   20260209000000_casa_rbac_schema.sql
--     (has_permission function)
--   20260215000003_music_planning_storage.sql
--     (follows same pattern)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only music-related buckets are created here.
-- =====================================================

-- =====================================================
-- 1. STORAGE BUCKET — music-packets
-- Private bucket for generated PDF music packets
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('music-packets', 'music-packets', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. STORAGE POLICIES — music-packets
-- SELECT: authenticated (musicians need to download)
-- INSERT/UPDATE: has_permission('music_planning', 'write')
-- DELETE: has_permission('music_planning', 'manage')
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_packets_storage_select'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_packets_storage_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'music-packets');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_packets_storage_insert'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_packets_storage_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'music-packets'
        AND public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_packets_storage_update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_packets_storage_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'music-packets'
        AND public.has_permission(auth.uid(), 'music_planning', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_packets_storage_delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_packets_storage_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'music-packets'
        AND public.has_permission(auth.uid(), 'music_planning', 'manage')
      );
  END IF;
END $$;

-- =====================================================
-- COMPLETION
-- =====================================================
