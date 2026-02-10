-- Create presentation_sessions table
-- Allows users to save and load presentation state across devices
-- Phase 1.6: Presentation Persistence

CREATE TABLE presentation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgy_id UUID NOT NULL REFERENCES liturgias(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Domingo 26 Enero - Preparado por María"
  description TEXT,     -- Optional notes

  -- Full state snapshot (JSONB for flexibility)
  state JSONB NOT NULL,
  -- Structure:
  -- {
  --   "tempSlides": [...],
  --   "styleState": { globalStyles, elementStyles, slideStyles },
  --   "logoState": {...},
  --   "textOverlayState": {...},
  --   "tempEdits": {...},
  --   "previewSlideIndex": 0,
  --   "liveSlideIndex": 0
  -- }

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional: link to service date
  service_date DATE,

  -- Soft delete
  is_archived BOOLEAN DEFAULT FALSE
);

-- Index for common queries
CREATE INDEX idx_presentation_sessions_liturgy ON presentation_sessions(liturgy_id);
CREATE INDEX idx_presentation_sessions_date ON presentation_sessions(service_date);
CREATE INDEX idx_presentation_sessions_created_by ON presentation_sessions(created_by);
CREATE INDEX idx_presentation_sessions_archived ON presentation_sessions(is_archived) WHERE is_archived = false;

-- RLS Policies
ALTER TABLE presentation_sessions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read sessions
CREATE POLICY "Users can view sessions"
  ON presentation_sessions FOR SELECT
  TO authenticated
  USING (true);

-- Users can create their own sessions
CREATE POLICY "Users can create sessions"
  ON presentation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON presentation_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON presentation_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_presentation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_presentation_sessions_updated_at
  BEFORE UPDATE ON presentation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_presentation_sessions_updated_at();

-- Comment for documentation
COMMENT ON TABLE presentation_sessions IS 'Stores presentation session snapshots for cross-device loading';
COMMENT ON COLUMN presentation_sessions.state IS 'Complete presentation state snapshot including tempSlides, styles, logos, and overlays';
