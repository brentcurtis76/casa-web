-- Fix: Add the updated_at trigger function that was missing
-- Run this if the main migration partially succeeded

-- Create the function first
CREATE OR REPLACE FUNCTION update_presentation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then create the trigger (drop first if it exists from a partial run)
DROP TRIGGER IF EXISTS trigger_update_presentation_sessions_updated_at ON presentation_sessions;

CREATE TRIGGER trigger_update_presentation_sessions_updated_at
  BEFORE UPDATE ON presentation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_presentation_sessions_updated_at();
