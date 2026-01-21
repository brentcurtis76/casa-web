-- Migration: Fix permission check in set_music_track_as_default function
-- PROMPT_004b Fix 4: Add permission check to SECURITY DEFINER function

CREATE OR REPLACE FUNCTION set_music_track_as_default(track_id UUID)
RETURNS void AS $$
DECLARE
  track_type TEXT;
BEGIN
  -- Permission check: only admins can set defaults
  IF NOT EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'coordinator')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only admins can set default tracks';
  END IF;

  -- Get the type of the track being set as default
  SELECT type INTO track_type
  FROM sermon_music_tracks
  WHERE id = track_id;

  IF track_type IS NULL THEN
    RAISE EXCEPTION 'Track not found';
  END IF;

  -- Unset any existing default for this type
  UPDATE sermon_music_tracks
  SET is_default = false
  WHERE type = track_type AND is_default = true;

  -- Set the new default
  UPDATE sermon_music_tracks
  SET is_default = true
  WHERE id = track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
