-- =====================================================
-- CASA Leadership — Recording Sessions & Segments
-- Migration: 20260420000000_casa_leadership_recording_sessions
-- Created: 2026-04-20
-- Description: Additive tables supporting the popup-window
--   recorder with segmented uploads and crash recovery.
--     - church_leadership_recording_sessions: one row per
--       live recording session (active/completed/abandoned).
--     - church_leadership_recording_segments: immutable
--       segment rows (~2-minute chunks) uploaded while a
--       session is active. Enables incremental AI
--       transcription and crash-safe finalization.
-- Safety: Additive only (CREATE IF NOT EXISTS, CREATE OR
--   REPLACE, CREATE POLICY). No DROP, TRUNCATE, or
--   destructive ALTER. Idempotent.
-- Depends on: 20260223000000_casa_leadership_schema.sql
--   (church_leadership_meetings, can_access_leadership_meeting,
--    update_leadership_updated_at must exist)
-- SHARED DATABASE: Only church_leadership_* tables are touched.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_leadership_recording_sessions
-- One row per live recording session. Created when the
-- popup opens, updated every live-snapshot upload, and
-- closed (status=completed|abandoned) when recording
-- stops or is recovered.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_recording_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id           UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE CASCADE,
  user_id              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at             TIMESTAMPTZ,
  last_live_path       TEXT,
  mime_type            TEXT        NOT NULL DEFAULT 'audio/webm',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.2 church_leadership_recording_segments
-- Immutable per-segment rows. segment_index is 0-based
-- and unique per session. storage_path points at an
-- independently-playable webm/opus file.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_recording_segments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID        NOT NULL REFERENCES church_leadership_recording_sessions(id) ON DELETE CASCADE,
  segment_index     INTEGER     NOT NULL CHECK (segment_index >= 0),
  storage_path      TEXT        NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ NOT NULL,
  duration_seconds  NUMERIC     NOT NULL CHECK (duration_seconds >= 0),
  size_bytes        BIGINT      NOT NULL CHECK (size_bytes >= 0),
  mime_type         TEXT        NOT NULL DEFAULT 'audio/webm',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, segment_index)
);


-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leadership_rec_sessions_meeting
  ON church_leadership_recording_sessions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_leadership_rec_sessions_user
  ON church_leadership_recording_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_leadership_rec_sessions_status
  ON church_leadership_recording_sessions(status);

CREATE INDEX IF NOT EXISTS idx_leadership_rec_segments_session
  ON church_leadership_recording_segments(session_id);


-- =====================================================
-- 3. TRIGGERS — updated_at on sessions
-- Reuses update_leadership_updated_at() from
-- 20260223000000_casa_leadership_schema.sql.
-- =====================================================

DROP TRIGGER IF EXISTS trg_leadership_rec_sessions_updated_at
  ON church_leadership_recording_sessions;
CREATE TRIGGER trg_leadership_rec_sessions_updated_at
  BEFORE UPDATE ON church_leadership_recording_sessions
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();


-- =====================================================
-- 4. ROW LEVEL SECURITY
-- Mirrors church_leadership_recordings policy shape:
--   SELECT/INSERT/UPDATE require leadership:write +
--     meeting-scoped access via can_access_leadership_meeting().
--     (Recordings require read on SELECT — matched here.)
--   DELETE requires leadership:manage (admin only).
-- =====================================================

-- -----------------------------------------------------
-- 4.1 church_leadership_recording_sessions
-- -----------------------------------------------------
ALTER TABLE church_leadership_recording_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_rec_sessions_select"
  ON church_leadership_recording_sessions FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_rec_sessions_insert"
  ON church_leadership_recording_sessions FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_rec_sessions_update"
  ON church_leadership_recording_sessions FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_rec_sessions_delete"
  ON church_leadership_recording_sessions FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );


-- -----------------------------------------------------
-- 4.2 church_leadership_recording_segments
-- Access scoped via the parent session -> meeting.
-- -----------------------------------------------------
ALTER TABLE church_leadership_recording_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_rec_segments_select"
  ON church_leadership_recording_segments FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND EXISTS (
      SELECT 1 FROM church_leadership_recording_sessions s
      WHERE s.id = session_id
        AND can_access_leadership_meeting(s.meeting_id)
    )
  );

CREATE POLICY "leadership_rec_segments_insert"
  ON church_leadership_recording_segments FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND EXISTS (
      SELECT 1 FROM church_leadership_recording_sessions s
      WHERE s.id = session_id
        AND can_access_leadership_meeting(s.meeting_id)
    )
  );

CREATE POLICY "leadership_rec_segments_update"
  ON church_leadership_recording_segments FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND EXISTS (
      SELECT 1 FROM church_leadership_recording_sessions s
      WHERE s.id = session_id
        AND can_access_leadership_meeting(s.meeting_id)
    )
  );

CREATE POLICY "leadership_rec_segments_delete"
  ON church_leadership_recording_segments FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );


-- =====================================================
-- 5. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE church_leadership_recording_sessions IS
  'CASA Leadership: Live recording session for the popup recorder. One row per session, status tracks active/completed/abandoned. last_heartbeat_at updated by live-snapshot uploads.';

COMMENT ON TABLE church_leadership_recording_segments IS
  'CASA Leadership: Immutable ~2-minute recording segments uploaded while a session is active. Enables incremental AI transcription and crash-safe finalization. Unique on (session_id, segment_index).';

COMMIT;
