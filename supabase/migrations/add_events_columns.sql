-- Add new columns to events table for enhanced event display
ALTER TABLE events
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

-- Create storage bucket for event images
-- Public: YES (images need to be viewable on the public website)
-- File size limit: 5MB
-- Allowed MIME types: images only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,
  5242880,  -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Allow public read access to event images (needed for website display)
CREATE POLICY "Public read access for event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Only allow admins to upload event images
-- Checks that the user exists in mesa_abierta_admin_roles
CREATE POLICY "Admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);

-- Only allow admins to update event images
CREATE POLICY "Admins can update event images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);

-- Only allow admins to delete event images
CREATE POLICY "Admins can delete event images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);
