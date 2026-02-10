-- =====================================================
-- La Mesa Abierta - Storage Bucket & Policies
-- Run this after creating the bucket in Supabase Dashboard
-- =====================================================

-- Create storage bucket (alternative to dashboard creation)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mesa-abierta-photos',
  'mesa-abierta-photos',
  false,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can upload photos for their dinners" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all photos" ON storage.objects;

-- -----------------------------------------------------
-- 1. Upload Policy
-- -----------------------------------------------------
CREATE POLICY "Users can upload photos for their dinners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- -----------------------------------------------------
-- 2. Read Policy
-- -----------------------------------------------------
CREATE POLICY "Anyone can view photos"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'mesa-abierta-photos'
);

-- -----------------------------------------------------
-- 3. Update Policy
-- -----------------------------------------------------
CREATE POLICY "Users can update their own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- -----------------------------------------------------
-- 4. Delete Policy
-- -----------------------------------------------------
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- -----------------------------------------------------
-- 5. Admin Override
-- -----------------------------------------------------
CREATE POLICY "Admins can manage all photos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'mesa-abierta-photos'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);
