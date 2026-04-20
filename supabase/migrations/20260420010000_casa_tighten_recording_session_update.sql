-- =====================================================
-- Migration: 20260420010000_casa_tighten_recording_session_update
--
-- Purpose: Tighten RLS on church_leadership_recording_sessions
--   UPDATE policy so that callers can only update their own
--   recording sessions (user_id = auth.uid()) in addition to
--   the existing meeting-access and write-permission checks.
--
-- Strictly additive: only the UPDATE policy is dropped and
-- recreated. SELECT / INSERT / DELETE policies are untouched.
-- =====================================================

DROP POLICY IF EXISTS "leadership_rec_sessions_update"
  ON church_leadership_recording_sessions;

CREATE POLICY "leadership_rec_sessions_update"
  ON church_leadership_recording_sessions FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND public.can_access_leadership_meeting(meeting_id)
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'leadership', 'write')
    AND public.can_access_leadership_meeting(meeting_id)
    AND user_id = auth.uid()
  );
