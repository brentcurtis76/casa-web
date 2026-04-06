-- ============================================
-- Migration: Add primary_session_id to liturgias + admin UPDATE policy
-- Date: 2026-04-03
-- Feature: Prepared Presentation Handoff (Liturgist to AV Team)
-- Task: CASA-PREP-HANDOFF
--
-- Changes:
--   1. Add primary_session_id UUID column to liturgias with FK to
--      presentation_sessions(id) ON DELETE SET NULL
--   2. Add role-based UPDATE policy so liturgists/admins can set
--      primary_session_id on liturgias they did not create
--
-- Required by Architect review: the existing UPDATE policy
-- ("Users can update own liturgias") only allows auth.uid() = created_by,
-- which blocks setPrimarySession() for any user who is not the liturgy creator.
-- The is_liturgia_admin() function already exists from migration
-- 20260303000000_casa_fix_liturgia_rls_rbac.sql.
--
-- Instance: mulsqxfhxxdsadxsljss (SHARED with Life OS)
-- Only church_* tables are touched. No Life OS tables affected.
-- ============================================

-- ============================================
-- Step 1: Add primary_session_id column
-- ============================================
ALTER TABLE liturgias
  ADD COLUMN IF NOT EXISTS primary_session_id UUID
    REFERENCES presentation_sessions(id)
    ON DELETE SET NULL;

-- ============================================
-- Step 2: Index for FK lookups
-- (supports getPrimarySession queries from liturgias)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_liturgias_primary_session_id
  ON liturgias(primary_session_id)
  WHERE primary_session_id IS NOT NULL;

-- ============================================
-- Step 3: Role-based UPDATE policy for liturgias
--
-- The existing "Users can update own liturgias" policy remains in place
-- (creator can always update their own liturgy).
-- This new policy adds a parallel path: liturgists and general_admins
-- can update ANY liturgia, including setting primary_session_id.
--
-- is_liturgia_admin(user_id) checks:
--   - church_roles.name IN ('general_admin', 'liturgist')  [via church_user_roles]
--   - OR mesa_abierta_admin_roles (legacy compat)
--
-- Uses DO $$ block to avoid duplicate policy error on re-run.
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liturgias'
      AND policyname = 'Admins can update liturgias'
  ) THEN
    CREATE POLICY "Admins can update liturgias" ON liturgias
      FOR UPDATE
      USING (is_liturgia_admin(auth.uid()));
  END IF;
END;
$$;

-- ============================================
-- Verification
-- ============================================
SELECT
  'primary_session_id column added and admin UPDATE policy created for liturgias' AS status,
  (
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'liturgias' AND column_name = 'primary_session_id'
  ) AS column_exists,
  (
    SELECT policyname FROM pg_policies
    WHERE tablename = 'liturgias' AND policyname = 'Admins can update liturgias'
  ) AS policy_exists;
