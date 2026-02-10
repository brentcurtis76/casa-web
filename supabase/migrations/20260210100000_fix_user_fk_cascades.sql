-- =====================================================
-- Fix FK Cascades: auth.users(id) References
-- Migration: 20260210100000_fix_user_fk_cascades
-- Created: 2026-02-10
-- Description: Adds ON DELETE SET NULL to all FK columns
--   referencing auth.users(id) that currently lack cascade
--   behavior. This is required for the admin delete-user
--   feature to work without FK constraint violations.
-- Safety: All operations are ALTER TABLE only. No DROP
--   TABLE, no TRUNCATE, no data deletion. Each change
--   drops and recreates an individual FK constraint
--   (safe, non-destructive). Two NOT NULL columns are
--   made nullable to support SET NULL behavior.
-- Depends on: All prior migrations that created these tables
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only CASA tables are modified here.
-- =====================================================


-- =====================================================
-- 1. church_audit_log.user_id
--    Current: NOT NULL REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Audit records must survive user deletion.
--            The admin who performed the action may be
--            deleted later; the audit trail remains via
--            the details JSONB field.
-- =====================================================

-- Step 1a: Make the column nullable (required before SET NULL can work)
ALTER TABLE church_audit_log
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 1b: Drop the existing FK constraint and recreate with ON DELETE SET NULL
ALTER TABLE church_audit_log
  DROP CONSTRAINT IF EXISTS church_audit_log_user_id_fkey;

ALTER TABLE church_audit_log
  ADD CONSTRAINT church_audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 2. church_audit_log.target_user_id
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Same as above -- audit records must survive
--            deletion of the target user.
-- =====================================================

ALTER TABLE church_audit_log
  DROP CONSTRAINT IF EXISTS church_audit_log_target_user_id_fkey;

ALTER TABLE church_audit_log
  ADD CONSTRAINT church_audit_log_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 3. presentation_sessions.created_by
--    Current: NOT NULL REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Presentation sessions are reusable assets.
--            Deleting a user should not destroy shared
--            presentation data. SET NULL preserves the
--            session while removing the creator reference.
-- =====================================================

ALTER TABLE presentation_sessions
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE presentation_sessions
  DROP CONSTRAINT IF EXISTS presentation_sessions_created_by_fkey;

ALTER TABLE presentation_sessions
  ADD CONSTRAINT presentation_sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 4. liturgias.created_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Liturgies are important community records.
--            Deleting a user should not block the operation
--            or destroy liturgy data.
-- =====================================================

ALTER TABLE liturgias
  DROP CONSTRAINT IF EXISTS liturgias_created_by_fkey;

ALTER TABLE liturgias
  ADD CONSTRAINT liturgias_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 5. graphics_themes.created_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Themes are shared assets. Deleting the
--            creator should not affect theme availability.
-- =====================================================

ALTER TABLE graphics_themes
  DROP CONSTRAINT IF EXISTS graphics_themes_created_by_fkey;

ALTER TABLE graphics_themes
  ADD CONSTRAINT graphics_themes_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 6. sermon_music_tracks.created_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Music tracks are shared assets.
-- =====================================================

ALTER TABLE sermon_music_tracks
  DROP CONSTRAINT IF EXISTS sermon_music_tracks_created_by_fkey;

ALTER TABLE sermon_music_tracks
  ADD CONSTRAINT sermon_music_tracks_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 7. site_config.updated_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Site config is a singleton table. Deleting
--            the user who last updated it must not block
--            user deletion or destroy config.
-- =====================================================

ALTER TABLE site_config
  DROP CONSTRAINT IF EXISTS site_config_updated_by_fkey;

ALTER TABLE site_config
  ADD CONSTRAINT site_config_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 8. published_resources.published_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  Published resources (PDFs) are public-facing.
--            Deleting the publisher should not remove
--            published content.
-- =====================================================

ALTER TABLE published_resources
  DROP CONSTRAINT IF EXISTS published_resources_published_by_fkey;

ALTER TABLE published_resources
  ADD CONSTRAINT published_resources_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 9. mesa_abierta_admin_roles.created_by
--    Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--    Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--    Reason:  The admin who created another admin's role
--            assignment may be deleted. The role assignment
--            itself should persist.
-- =====================================================

ALTER TABLE mesa_abierta_admin_roles
  DROP CONSTRAINT IF EXISTS mesa_abierta_admin_roles_created_by_fkey;

ALTER TABLE mesa_abierta_admin_roles
  ADD CONSTRAINT mesa_abierta_admin_roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 10. mesa_abierta_photos.approved_by
--     Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--     Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--     Reason:  Approved photos should remain approved even
--             if the approving admin is later deleted.
-- =====================================================

ALTER TABLE mesa_abierta_photos
  DROP CONSTRAINT IF EXISTS mesa_abierta_photos_approved_by_fkey;

ALTER TABLE mesa_abierta_photos
  ADD CONSTRAINT mesa_abierta_photos_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- 11. mesa_abierta_testimonials.approved_by
--     Current: NULLABLE REFERENCES auth.users(id) [no cascade]
--     Target:  NULLABLE REFERENCES auth.users(id) ON DELETE SET NULL
--     Reason:  Same as photos -- approval status should
--             survive admin deletion.
-- =====================================================

ALTER TABLE mesa_abierta_testimonials
  DROP CONSTRAINT IF EXISTS mesa_abierta_testimonials_approved_by_fkey;

ALTER TABLE mesa_abierta_testimonials
  ADD CONSTRAINT mesa_abierta_testimonials_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =====================================================
-- TABLES ALREADY CORRECT (no changes needed)
-- =====================================================
-- church_user_roles.user_id        -> ON DELETE CASCADE  (OK)
-- church_user_roles.assigned_by    -> ON DELETE SET NULL  (OK)
-- mesa_abierta_admin_roles.user_id -> ON DELETE CASCADE  (OK)
-- mesa_abierta_participants.user_id -> ON DELETE CASCADE (OK)
-- mesa_abierta_photos.uploaded_by  -> ON DELETE CASCADE  (OK)
-- cuentacuentos_drafts.user_id     -> ON DELETE CASCADE  (OK)
-- casa_graphics_batches.created_by -> ON DELETE SET NULL  (OK)


-- =====================================================
-- COMPLETION
-- =====================================================

COMMENT ON TABLE church_audit_log IS
  'CASA RBAC: Append-only audit log for role assignments and other admin actions. RLS: admins read all, users read own entries. user_id and target_user_id are SET NULL on user deletion to preserve audit history.';
