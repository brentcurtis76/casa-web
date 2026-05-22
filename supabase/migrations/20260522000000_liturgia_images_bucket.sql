-- =====================================================
-- Liturgia Images Bucket - For imported presentation images
-- Public bucket. Authenticated users can write; anyone can read.
-- Additive only: no drops on existing objects/buckets.
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'liturgia-images',
  'liturgia-images',
  true,
  52428800, -- 50MB per image
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------
-- Read - public
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view liturgia images" ON storage.objects;
CREATE POLICY "Anyone can view liturgia images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'liturgia-images');

-- -----------------------------------------------------
-- Insert - authenticated
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload liturgia images" ON storage.objects;
CREATE POLICY "Authenticated users can upload liturgia images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'liturgia-images');

-- -----------------------------------------------------
-- Update - authenticated
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update liturgia images" ON storage.objects;
CREATE POLICY "Authenticated users can update liturgia images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'liturgia-images')
WITH CHECK (bucket_id = 'liturgia-images');

-- -----------------------------------------------------
-- Delete - authenticated
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete liturgia images" ON storage.objects;
CREATE POLICY "Authenticated users can delete liturgia images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'liturgia-images');
