-- Migration: Create sermon_music_tracks table for intro/outro music management
-- Part of PROMPT_004: Intro/Outro Music Integration

-- Create the sermon_music_tracks table
CREATE TABLE IF NOT EXISTS sermon_music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('intro', 'outro')),
  audio_url TEXT NOT NULL,
  duration_seconds NUMERIC(6,2),
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sermon_music_tracks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can manage (users in mesa_abierta_admin_roles)
CREATE POLICY "music_tracks_admin_manage" ON sermon_music_tracks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: All authenticated users can view tracks
CREATE POLICY "music_tracks_authenticated_read" ON sermon_music_tracks
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create unique partial indexes to ensure only one default per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_default_intro
  ON sermon_music_tracks(type)
  WHERE is_default = true AND type = 'intro';

CREATE UNIQUE INDEX IF NOT EXISTS idx_default_outro
  ON sermon_music_tracks(type)
  WHERE is_default = true AND type = 'outro';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sermon_music_tracks_type
  ON sermon_music_tracks(type);

-- Function to ensure only one default per type (helper for set default operation)
CREATE OR REPLACE FUNCTION set_music_track_as_default(track_id UUID)
RETURNS void AS $$
DECLARE
  track_type TEXT;
BEGIN
  -- Get the type of the track being set as default
  SELECT type INTO track_type FROM sermon_music_tracks WHERE id = track_id;

  IF track_type IS NULL THEN
    RAISE EXCEPTION 'Track not found';
  END IF;

  -- Unset all other defaults of the same type
  UPDATE sermon_music_tracks
  SET is_default = false
  WHERE type = track_type AND id != track_id;

  -- Set this track as default
  UPDATE sermon_music_tracks
  SET is_default = true
  WHERE id = track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_music_track_as_default(UUID) TO authenticated;

-- Comment on table
COMMENT ON TABLE sermon_music_tracks IS 'Stores intro and outro music tracks for sermon audio editing';
