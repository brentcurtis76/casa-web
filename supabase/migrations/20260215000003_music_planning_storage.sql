-- =====================================================
-- CASA Music Planning Module — Storage & RBAC Seeds
-- Migration: 20260215000003_music_planning_storage
-- Created: 2026-02-15
-- Description: Creates 3 Supabase storage buckets
--   (music-stems, music-chord-charts,
--   music-audio-references) with RLS policies, and
--   seeds RBAC permissions for the music_planning
--   resource.
-- Safety: All operations are additive. Uses INSERT
--   ON CONFLICT DO NOTHING for idempotency.
-- Depends on:
--   20260209000000_casa_rbac_schema.sql
--     (church_roles, church_permissions tables)
--   20260215000000_music_planning_schema.sql
-- =====================================================


-- =====================================================
-- 1. STORAGE BUCKETS
-- =====================================================

-- -----------------------------------------------------
-- 1.1 music-stems — Archivos de audio (stems)
-- Para pistas individuales del reproductor de práctica
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-stems', 'music-stems', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------
-- 1.2 music-chord-charts — Partituras y acordes
-- PDF e imágenes de diagramas de acordes
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-chord-charts', 'music-chord-charts', false)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------
-- 1.3 music-audio-references — Grabaciones de referencia
-- Archivos de audio subidos como referencia
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('music-audio-references', 'music-audio-references', false)
ON CONFLICT (id) DO NOTHING;


-- =====================================================
-- 2. STORAGE POLICIES — music-stems
-- SELECT: authenticated (for playback)
-- INSERT/UPDATE/DELETE: has_permission('canciones', 'write')
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_stems_storage_select'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_stems_storage_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'music-stems');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_stems_storage_insert'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_stems_storage_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'music-stems'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_stems_storage_update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_stems_storage_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'music-stems'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_stems_storage_delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_stems_storage_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'music-stems'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;


-- =====================================================
-- 3. STORAGE POLICIES — music-chord-charts
-- SELECT: authenticated
-- INSERT/UPDATE/DELETE: has_permission('canciones', 'write')
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_chord_charts_storage_select'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_chord_charts_storage_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'music-chord-charts');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_chord_charts_storage_insert'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_chord_charts_storage_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'music-chord-charts'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_chord_charts_storage_update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_chord_charts_storage_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'music-chord-charts'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_chord_charts_storage_delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_chord_charts_storage_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'music-chord-charts'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;


-- =====================================================
-- 4. STORAGE POLICIES — music-audio-references
-- SELECT: authenticated
-- INSERT/UPDATE/DELETE: has_permission('canciones', 'write')
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_audio_refs_storage_select'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_audio_refs_storage_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'music-audio-references');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_audio_refs_storage_insert'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_audio_refs_storage_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'music-audio-references'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_audio_refs_storage_update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_audio_refs_storage_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'music-audio-references'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'music_audio_refs_storage_delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "music_audio_refs_storage_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'music-audio-references'
        AND public.has_permission(auth.uid(), 'canciones', 'write')
      );
  END IF;
END $$;


-- =====================================================
-- 5. RBAC PERMISSION SEEDS — music_planning resource
-- Permisos para el recurso music_planning que cubre
-- gestión de músicos, calendario y asignaciones.
-- El recurso 'canciones' existente cubre la biblioteca
-- de canciones.
-- =====================================================

DO $$
DECLARE
  r_worship_coordinator UUID;
  r_general_admin UUID;
BEGIN
  -- Obtener IDs de roles
  SELECT id INTO r_worship_coordinator
  FROM church_roles WHERE name = 'worship_coordinator';

  SELECT id INTO r_general_admin
  FROM church_roles WHERE name = 'general_admin';

  -- worship_coordinator: read, write, manage en music_planning
  IF r_worship_coordinator IS NOT NULL THEN
    INSERT INTO church_permissions (role_id, resource, action) VALUES
      (r_worship_coordinator, 'music_planning', 'read'),
      (r_worship_coordinator, 'music_planning', 'write'),
      (r_worship_coordinator, 'music_planning', 'manage')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- general_admin: manage en music_planning
  -- (ya tiene acceso implícito vía is_admin(), pero
  -- se agrega explícitamente por consistencia)
  IF r_general_admin IS NOT NULL THEN
    INSERT INTO church_permissions (role_id, resource, action) VALUES
      (r_general_admin, 'music_planning', 'manage')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END;
$$;


-- =====================================================
-- COMPLETION
-- =====================================================
