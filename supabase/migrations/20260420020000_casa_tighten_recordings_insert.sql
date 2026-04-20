-- =====================================================
-- Migration: 20260420020000_casa_tighten_recordings_insert
--
-- Purpose: Tighten RLS on church_leadership_recordings INSERT
--   policy so that callers must insert rows owned by themselves
--   (created_by = auth.uid()) in addition to the existing
--   meeting-access and write-permission checks.
--
-- Strictly additive: only the INSERT policy is dropped and
-- recreated. SELECT / UPDATE / DELETE policies are untouched.
-- =====================================================

DROP POLICY IF EXISTS "leadership_recordings_insert"
  ON church_leadership_recordings;

CREATE POLICY "leadership_recordings_insert"
  ON church_leadership_recordings FOR INSERT
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND public.can_access_leadership_meeting(meeting_id)
    AND created_by = auth.uid()
  );
