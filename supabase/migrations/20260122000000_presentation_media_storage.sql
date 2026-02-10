-- =====================================================
-- Presentation Media Storage - For Video and Image uploads
-- Run this in Supabase SQL Editor or via migration
-- =====================================================

-- Create storage bucket for presentation media (videos, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presentation-media',
  'presentation-media',
  true, -- Public bucket for easy playback
  524288000, -- 500MB max file size (for videos)
  ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY[
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Anyone can view presentation media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload presentation media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update presentation media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete presentation media" ON storage.objects;

-- -----------------------------------------------------
-- 1. Read Policy - Public access for playback
-- -----------------------------------------------------
CREATE POLICY "Anyone can view presentation media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'presentation-media');

-- -----------------------------------------------------
-- 2. Upload Policy - Authenticated users can upload
-- -----------------------------------------------------
CREATE POLICY "Authenticated users can upload presentation media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'presentation-media');

-- -----------------------------------------------------
-- 3. Update Policy - Authenticated users can update
-- -----------------------------------------------------
CREATE POLICY "Authenticated users can update presentation media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'presentation-media')
WITH CHECK (bucket_id = 'presentation-media');

-- -----------------------------------------------------
-- 4. Delete Policy - Authenticated users can delete
-- -----------------------------------------------------
CREATE POLICY "Authenticated users can delete presentation media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'presentation-media');
