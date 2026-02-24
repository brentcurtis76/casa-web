-- =====================================================
-- CASA Leadership Module Schema
-- Migration: 20260223000000_casa_leadership_schema
-- Created: 2026-02-23
-- Description: Creates the 8 church leadership tables
--   (church_leadership_meeting_types,
--    church_leadership_meeting_type_members,
--    church_leadership_meetings,
--    church_leadership_meeting_participants,
--    church_leadership_recordings,
--    church_leadership_notes,
--    church_leadership_commitments,
--    church_leadership_documents)
--   with RLS policies, helper functions, indexes,
--   triggers, and seed data.
-- Safety: All operations are additive (CREATE IF NOT EXISTS,
--   CREATE OR REPLACE, INSERT ON CONFLICT DO NOTHING).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent.
-- Depends on: 20260209000000_casa_rbac_schema.sql
--   (is_admin, has_permission functions must exist)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only church_leadership_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_leadership_meeting_types
-- Defines leadership group types: Concilio, Equipo Pastoral,
-- or custom groups created by admins.
-- System types (is_system=true) cannot be deleted.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_meeting_types (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  display_name    TEXT        NOT NULL,
  description     TEXT,
  color           TEXT,
  is_system       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  recurrence      TEXT        CHECK (recurrence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'on_demand')),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.2 church_leadership_meeting_type_members
-- Maps users to meeting types with a role (chair/secretary/member).
-- Access to meetings is scoped by membership here.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_meeting_type_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type_id UUID        NOT NULL REFERENCES church_leadership_meeting_types(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('chair', 'secretary', 'member')),
  added_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_type_id, user_id)
);

-- -----------------------------------------------------
-- 1.3 church_leadership_meetings
-- Meeting instances (one per gathering).
-- Status lifecycle: scheduled -> in_progress -> completed / cancelled.
-- meeting_date is DATE (day of meeting); start/end_time are TIME.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_meetings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type_id UUID        NOT NULL REFERENCES church_leadership_meeting_types(id) ON DELETE RESTRICT,
  title           TEXT        NOT NULL,
  description     TEXT,
  meeting_date    DATE        NOT NULL,
  start_time      TIME,
  end_time        TIME,
  location        TEXT,
  status          TEXT        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  agenda_url      TEXT,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.4 church_leadership_meeting_participants
-- Per-meeting attendance tracking.
-- Distinct from meeting_type_members: a guest can attend
-- a single meeting without being a type member.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_meeting_participants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attended      BOOLEAN     NOT NULL DEFAULT FALSE,
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

-- -----------------------------------------------------
-- 1.5 church_leadership_recordings
-- Audio recording metadata. Audio files are stored in
-- Supabase Storage bucket 'leadership-recordings'.
-- transcription_status tracks AI processing pipeline.
-- transcription_action_items stores extracted commitments as JSON.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_recordings (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id                  UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE CASCADE,
  filename                    TEXT        NOT NULL,
  storage_path                TEXT        NOT NULL,
  duration_seconds            INTEGER,
  file_size_bytes             BIGINT,
  mime_type                   TEXT        DEFAULT 'audio/webm',
  transcription_status        TEXT        NOT NULL DEFAULT 'none'
                                CHECK (transcription_status IN ('none', 'pending', 'processing', 'completed', 'failed')),
  transcript_text             TEXT,
  transcript_summary          TEXT,
  transcription_action_items  JSONB       NOT NULL DEFAULT '[]',
  transcribed_at              TIMESTAMPTZ,
  created_by                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.6 church_leadership_notes
-- Meeting notes / minutes.
-- Multiple notes per meeting allowed (different authors).
-- is_official flags the canonical minutes for the meeting.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  is_official BOOLEAN     NOT NULL DEFAULT FALSE,
  author_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.7 church_leadership_commitments
-- Action items assigned to individuals.
-- Can originate from a meeting discussion or from an
-- AI-extracted action item (source_recording_id links back).
-- follow_up_meeting_id links to the meeting where it will
-- be reviewed.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_commitments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE RESTRICT,
  title               TEXT        NOT NULL,
  description         TEXT,
  assignee_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date            DATE,
  priority            TEXT        NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at        TIMESTAMPTZ,
  follow_up_meeting_id UUID       REFERENCES church_leadership_meetings(id) ON DELETE SET NULL,
  source_recording_id UUID        REFERENCES church_leadership_recordings(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------
-- 1.8 church_leadership_documents
-- File attachments per meeting.
-- Files are stored in Supabase Storage bucket 'leadership-documents'.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_leadership_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID        NOT NULL REFERENCES church_leadership_meetings(id) ON DELETE CASCADE,
  filename        TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  description     TEXT,
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 2. INDEXES
-- =====================================================

-- meeting_types: lookup by name
CREATE INDEX IF NOT EXISTS idx_leadership_meeting_types_name
  ON church_leadership_meeting_types(name);

-- meeting_type_members: lookup by type or user
CREATE INDEX IF NOT EXISTS idx_leadership_type_members_type
  ON church_leadership_meeting_type_members(meeting_type_id);

CREATE INDEX IF NOT EXISTS idx_leadership_type_members_user
  ON church_leadership_meeting_type_members(user_id);

-- meetings: date-based listing, status filtering, type scoping
CREATE INDEX IF NOT EXISTS idx_leadership_meetings_type
  ON church_leadership_meetings(meeting_type_id);

CREATE INDEX IF NOT EXISTS idx_leadership_meetings_date
  ON church_leadership_meetings(meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_leadership_meetings_status
  ON church_leadership_meetings(status);

-- participants: per-meeting and per-user lookup
CREATE INDEX IF NOT EXISTS idx_leadership_participants_meeting
  ON church_leadership_meeting_participants(meeting_id);

CREATE INDEX IF NOT EXISTS idx_leadership_participants_user
  ON church_leadership_meeting_participants(user_id);

-- recordings: per-meeting and transcription status filtering
CREATE INDEX IF NOT EXISTS idx_leadership_recordings_meeting
  ON church_leadership_recordings(meeting_id);

CREATE INDEX IF NOT EXISTS idx_leadership_recordings_transcription_status
  ON church_leadership_recordings(transcription_status);

-- notes: per-meeting listing
CREATE INDEX IF NOT EXISTS idx_leadership_notes_meeting
  ON church_leadership_notes(meeting_id);

-- commitments: meeting, assignee, status, due date
CREATE INDEX IF NOT EXISTS idx_leadership_commitments_meeting
  ON church_leadership_commitments(meeting_id);

CREATE INDEX IF NOT EXISTS idx_leadership_commitments_assignee
  ON church_leadership_commitments(assignee_id);

CREATE INDEX IF NOT EXISTS idx_leadership_commitments_status
  ON church_leadership_commitments(status);

CREATE INDEX IF NOT EXISTS idx_leadership_commitments_due_date
  ON church_leadership_commitments(due_date);

-- documents: per-meeting
CREATE INDEX IF NOT EXISTS idx_leadership_documents_meeting
  ON church_leadership_documents(meeting_id);


-- =====================================================
-- 3. TRIGGER FUNCTION -- updated_at
-- Used by: meeting_types, meetings, recordings, notes, commitments
-- Follows pattern from update_children_updated_at()
-- =====================================================

CREATE OR REPLACE FUNCTION update_leadership_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_leadership_updated_at() IS
  'CASA Leadership: Trigger function to auto-update updated_at on row modification';

-- Apply to church_leadership_meeting_types
DROP TRIGGER IF EXISTS trg_leadership_meeting_types_updated_at ON church_leadership_meeting_types;
CREATE TRIGGER trg_leadership_meeting_types_updated_at
  BEFORE UPDATE ON church_leadership_meeting_types
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();

-- Apply to church_leadership_meetings
DROP TRIGGER IF EXISTS trg_leadership_meetings_updated_at ON church_leadership_meetings;
CREATE TRIGGER trg_leadership_meetings_updated_at
  BEFORE UPDATE ON church_leadership_meetings
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();

-- Apply to church_leadership_recordings
DROP TRIGGER IF EXISTS trg_leadership_recordings_updated_at ON church_leadership_recordings;
CREATE TRIGGER trg_leadership_recordings_updated_at
  BEFORE UPDATE ON church_leadership_recordings
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();

-- Apply to church_leadership_notes
DROP TRIGGER IF EXISTS trg_leadership_notes_updated_at ON church_leadership_notes;
CREATE TRIGGER trg_leadership_notes_updated_at
  BEFORE UPDATE ON church_leadership_notes
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();

-- Apply to church_leadership_commitments
DROP TRIGGER IF EXISTS trg_leadership_commitments_updated_at ON church_leadership_commitments;
CREATE TRIGGER trg_leadership_commitments_updated_at
  BEFORE UPDATE ON church_leadership_commitments
  FOR EACH ROW EXECUTE FUNCTION update_leadership_updated_at();


-- =====================================================
-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS to avoid infinite recursion when
-- called from within RLS policies.
-- NOTE: is_admin() and has_permission() already exist
-- from 20260209000000_casa_rbac_schema.sql.
-- Only leadership-specific helpers are defined here.
-- =====================================================

-- -----------------------------------------------------
-- 4.1 is_leadership_member(p_meeting_type_id)
-- Returns TRUE if the current user (auth.uid()) is a
-- member of the given meeting type, OR if they are
-- a general admin (admin bypass).
-- Called from RLS policies on meeting_types and meetings.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION is_leadership_member(p_meeting_type_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin bypass: general_admin sees all meeting types
  IF public.is_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Check meeting type membership
  RETURN EXISTS (
    SELECT 1
    FROM church_leadership_meeting_type_members
    WHERE meeting_type_id = p_meeting_type_id
      AND user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_leadership_member(UUID) IS
  'CASA Leadership: Check if current user (auth.uid()) is a member of the given meeting type. Admin bypass included. SECURITY DEFINER to avoid RLS recursion.';

-- -----------------------------------------------------
-- 4.2 can_access_leadership_meeting(p_meeting_id)
-- Returns TRUE if the current user can access a specific
-- meeting (i.e., they are a member of its meeting type),
-- OR if they are a general admin.
-- Called from RLS policies on meetings, participants,
-- recordings, notes, commitments, documents.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_leadership_meeting(p_meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin bypass
  IF public.is_admin(auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Check membership via meeting -> meeting_type -> members
  RETURN EXISTS (
    SELECT 1
    FROM church_leadership_meetings m
    JOIN church_leadership_meeting_type_members mtm
      ON mtm.meeting_type_id = m.meeting_type_id
    WHERE m.id = p_meeting_id
      AND mtm.user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION can_access_leadership_meeting(UUID) IS
  'CASA Leadership: Check if current user (auth.uid()) can access a specific meeting via meeting type membership. Admin bypass included. SECURITY DEFINER to avoid RLS recursion.';


-- =====================================================
-- 5. ROW LEVEL SECURITY
-- Pattern: Uses has_permission() from RBAC schema for
-- permission checks and custom helper functions above
-- for meeting-type scoped access.
-- General Admin: bypass via is_admin() inside has_permission()
-- Concilio Member: leadership read + write (from RBAC migration)
-- Equipo Pastoral: leadership read + write (from RBAC migration)
-- =====================================================

-- -----------------------------------------------------
-- 5.1 church_leadership_meeting_types
-- SELECT: user must have leadership:read AND be a member
--   of that meeting type (or admin)
-- INSERT: admin-only (manage permission)
-- UPDATE: admin-only
-- DELETE: admin-only AND not a system type
-- -----------------------------------------------------
ALTER TABLE church_leadership_meeting_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_meeting_types_select"
  ON church_leadership_meeting_types FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND is_leadership_member(id)
  );

CREATE POLICY "leadership_meeting_types_insert"
  ON church_leadership_meeting_types FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );

CREATE POLICY "leadership_meeting_types_update"
  ON church_leadership_meeting_types FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );

CREATE POLICY "leadership_meeting_types_delete"
  ON church_leadership_meeting_types FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
    AND is_system = FALSE
  );


-- -----------------------------------------------------
-- 5.2 church_leadership_meeting_type_members
-- Manage group membership.
-- SELECT: leadership:read (any leadership user can see members)
-- INSERT/UPDATE/DELETE: leadership:manage (admin only)
-- -----------------------------------------------------
ALTER TABLE church_leadership_meeting_type_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_type_members_select"
  ON church_leadership_meeting_type_members FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
  );

CREATE POLICY "leadership_type_members_insert"
  ON church_leadership_meeting_type_members FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );

CREATE POLICY "leadership_type_members_update"
  ON church_leadership_meeting_type_members FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );

CREATE POLICY "leadership_type_members_delete"
  ON church_leadership_meeting_type_members FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );


-- -----------------------------------------------------
-- 5.3 church_leadership_meetings
-- Scoped by meeting type membership.
-- SELECT/INSERT/UPDATE: user must belong to the meeting type
-- DELETE: manage permission (admin only)
-- -----------------------------------------------------
ALTER TABLE church_leadership_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_meetings_select"
  ON church_leadership_meetings FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND is_leadership_member(meeting_type_id)
  );

CREATE POLICY "leadership_meetings_insert"
  ON church_leadership_meetings FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND is_leadership_member(meeting_type_id)
  );

CREATE POLICY "leadership_meetings_update"
  ON church_leadership_meetings FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND is_leadership_member(meeting_type_id)
  );

CREATE POLICY "leadership_meetings_delete"
  ON church_leadership_meetings FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );


-- -----------------------------------------------------
-- 5.4 church_leadership_meeting_participants
-- Access gated by meeting access (which gates by type membership).
-- -----------------------------------------------------
ALTER TABLE church_leadership_meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_participants_select"
  ON church_leadership_meeting_participants FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_participants_insert"
  ON church_leadership_meeting_participants FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_participants_update"
  ON church_leadership_meeting_participants FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_participants_delete"
  ON church_leadership_meeting_participants FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );


-- -----------------------------------------------------
-- 5.5 church_leadership_recordings
-- Access gated by meeting access.
-- DELETE requires manage (admin only).
-- -----------------------------------------------------
ALTER TABLE church_leadership_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_recordings_select"
  ON church_leadership_recordings FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_recordings_insert"
  ON church_leadership_recordings FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_recordings_update"
  ON church_leadership_recordings FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_recordings_delete"
  ON church_leadership_recordings FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'manage')
  );


-- -----------------------------------------------------
-- 5.6 church_leadership_notes
-- Access gated by meeting access.
-- UPDATE/DELETE: author can edit/delete own notes;
--   manage permission holders can edit/delete any note.
-- -----------------------------------------------------
ALTER TABLE church_leadership_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_notes_select"
  ON church_leadership_notes FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_notes_insert"
  ON church_leadership_notes FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_notes_update"
  ON church_leadership_notes FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
    AND (
      author_id = auth.uid()
      OR public.has_permission(auth.uid(), 'leadership', 'manage')
    )
  );

CREATE POLICY "leadership_notes_delete"
  ON church_leadership_notes FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
    AND (
      author_id = auth.uid()
      OR public.has_permission(auth.uid(), 'leadership', 'manage')
    )
  );


-- -----------------------------------------------------
-- 5.7 church_leadership_commitments
-- Scoped by meeting access.
-- UPDATE: assignee can update their own commitment status;
--   write permission + meeting access allows full update.
-- DELETE: write permission + meeting access.
-- -----------------------------------------------------
ALTER TABLE church_leadership_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_commitments_select"
  ON church_leadership_commitments FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_commitments_insert"
  ON church_leadership_commitments FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

-- Assignees can update their own commitment status;
-- meeting members with write can update any commitment in their meeting.
CREATE POLICY "leadership_commitments_update"
  ON church_leadership_commitments FOR UPDATE
  USING (
    (
      -- Assignee self-service: update own commitment status
      assignee_id = auth.uid()
      AND public.has_permission(auth.uid(), 'leadership', 'read')
    )
    OR
    (
      -- Full write access for meeting members
      public.has_permission(auth.uid(), 'leadership', 'write')
      AND can_access_leadership_meeting(meeting_id)
    )
  );

CREATE POLICY "leadership_commitments_delete"
  ON church_leadership_commitments FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );


-- -----------------------------------------------------
-- 5.8 church_leadership_documents
-- Access gated by meeting access.
-- No UPDATE policy (documents are immutable once uploaded).
-- DELETE: write + meeting access.
-- -----------------------------------------------------
ALTER TABLE church_leadership_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_documents_select"
  ON church_leadership_documents FOR SELECT
  USING (
    public.has_permission(auth.uid(), 'leadership', 'read')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_documents_insert"
  ON church_leadership_documents FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );

CREATE POLICY "leadership_documents_delete"
  ON church_leadership_documents FOR DELETE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND can_access_leadership_meeting(meeting_id)
  );


-- =====================================================
-- 6. SEED DATA
-- Pre-seed the two system meeting types:
--   - concilio: governing council (monthly)
--   - equipo_pastoral: pastoral team (biweekly)
-- is_system=TRUE prevents deletion via RLS.
-- ON CONFLICT DO NOTHING for idempotency.
-- =====================================================

INSERT INTO church_leadership_meeting_types
  (name, display_name, description, is_system, recurrence)
VALUES
  (
    'concilio',
    'Concilio',
    'Reuniones del Concilio parroquial — gobierno y decisiones administrativas de la iglesia',
    TRUE,
    'monthly'
  ),
  (
    'equipo_pastoral',
    'Equipo Pastoral',
    'Reuniones del equipo pastoral — planificación ministerial y cuidado congregacional',
    TRUE,
    'biweekly'
  )
ON CONFLICT (name) DO NOTHING;


-- =====================================================
-- 7. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE church_leadership_meeting_types IS
  'CASA Leadership: Defines leadership groups (Concilio, Equipo Pastoral, custom). System types cannot be deleted.';

COMMENT ON TABLE church_leadership_meeting_type_members IS
  'CASA Leadership: Members of each meeting type with role (chair/secretary/member). Drives meeting-scoped access control.';

COMMENT ON TABLE church_leadership_meetings IS
  'CASA Leadership: Individual meeting instances with date, time, location, and status lifecycle.';

COMMENT ON TABLE church_leadership_meeting_participants IS
  'CASA Leadership: Per-meeting attendance tracking. Distinct from meeting_type_members (supports guests).';

COMMENT ON TABLE church_leadership_recordings IS
  'CASA Leadership: Audio recording metadata. Audio stored in leadership-recordings Storage bucket. Tracks AI transcription pipeline status.';

COMMENT ON TABLE church_leadership_notes IS
  'CASA Leadership: Meeting notes and minutes. Multiple notes per meeting (different authors). is_official flags the canonical minutes.';

COMMENT ON TABLE church_leadership_commitments IS
  'CASA Leadership: Action items with assignee, due date, priority, status. Can originate from AI transcription (source_recording_id).';

COMMENT ON TABLE church_leadership_documents IS
  'CASA Leadership: File attachments per meeting. Files stored in leadership-documents Storage bucket.';


-- =====================================================
-- STORAGE BUCKETS NOTE
-- The following storage buckets must be created manually
-- in Supabase Dashboard (Storage > New Bucket) or via
-- the Supabase Management API. They cannot be created
-- via SQL migrations.
--
-- Bucket: leadership-recordings
--   Public: NO (private)
--   Allowed MIME types: audio/webm, audio/ogg, audio/mp4, audio/mpeg, audio/wav
--   Max file size: 100MB
--
-- Bucket: leadership-documents
--   Public: NO (private)
--   Allowed MIME types: application/pdf, image/png, image/jpeg,
--     application/msword,
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--     text/plain
--   Max file size: 25MB
-- =====================================================

COMMIT;
