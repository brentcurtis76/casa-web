-- =====================================================
-- CASA Presentation — liturgia-images Storage Bucket
-- Migration: 20260522000000_liturgia_images_storage
-- Created: 2026-05-22
-- Description: Creates the liturgia-images public Supabase
--   storage bucket for images imported via the presenter's
--   "Importar imágenes" flow. Replaces base64 data URLs stored
--   inside liturgia_elementos.slides JSONB rows.
-- Safety: Additive and idempotent — INSERT ... ON CONFLICT
--   DO NOTHING, and policy creation guarded by pg_policies.
-- =====================================================

-- 1. STORAGE BUCKET (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('liturgia-images', 'liturgia-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. STORAGE POLICIES
-- SELECT: anyone (public bucket)
-- INSERT/UPDATE/DELETE: authenticated users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'liturgia_images_storage_select'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "liturgia_images_storage_select" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'liturgia-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'liturgia_images_storage_insert'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "liturgia_images_storage_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'liturgia-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'liturgia_images_storage_update'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "liturgia_images_storage_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'liturgia-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'liturgia_images_storage_delete'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "liturgia_images_storage_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'liturgia-images');
  END IF;
END $$;
