-- Migration: Create storage bucket for sermon music tracks
-- Part of PROMPT_004: Intro/Outro Music Integration

-- Create the sermon-music storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sermon-music',
  'sermon-music',
  false, -- Private bucket, authenticated access only
  10485760, -- 10MB max file size
  ARRAY['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sermon-music bucket

-- Admin can upload, update, delete files
CREATE POLICY "sermon_music_admin_all"
ON storage.objects FOR ALL
USING (
  bucket_id = 'sermon-music'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'sermon-music'
  AND EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid()
  )
);

-- All authenticated users can read files (for playback)
CREATE POLICY "sermon_music_authenticated_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sermon-music'
  AND auth.role() = 'authenticated'
);
