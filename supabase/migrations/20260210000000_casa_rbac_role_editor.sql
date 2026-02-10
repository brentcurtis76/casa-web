-- =====================================================
-- CASA RBAC Role Editor — Admin Mutation Policies
-- Migration: 20260210000000_casa_rbac_role_editor
-- Created: 2026-02-10
-- Description: Adds is_system flag to church_roles for
--   protecting seeded roles from deletion, and adds
--   admin-only RLS mutation policies on church_roles
--   and church_permissions to support the Role Editor UI.
-- Safety: All operations are additive (ALTER ADD COLUMN,
--   UPDATE, CREATE POLICY). No DROP, TRUNCATE, or
--   destructive changes. Idempotent via IF NOT EXISTS
--   and DO/EXCEPTION patterns.
-- Depends on: 20260209000000_casa_rbac_schema
-- =====================================================

-- =====================================================
-- 1. ADD is_system COLUMN TO church_roles
-- =====================================================

ALTER TABLE church_roles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 2. MARK SEEDED ROLES AS SYSTEM ROLES
-- =====================================================

UPDATE church_roles
SET is_system = true
WHERE name IN (
  'general_admin',
  'liturgist',
  'av_volunteer',
  'worship_coordinator',
  'comms_volunteer',
  'mesa_abierta_coordinator',
  'financial_admin',
  'concilio_member',
  'equipo_pastoral',
  'children_ministry_coordinator',
  'children_ministry_volunteer'
);

-- =====================================================
-- 3. ADMIN MUTATION POLICIES ON church_roles
--    (SELECT policy already exists from base migration)
-- =====================================================

-- INSERT: Only admins can create new roles
DO $$
BEGIN
  CREATE POLICY "Admins can insert roles"
    ON church_roles FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE: Only admins can update roles
DO $$
BEGIN
  CREATE POLICY "Admins can update roles"
    ON church_roles FOR UPDATE
    TO authenticated
    USING (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: Only admins can delete roles
DO $$
BEGIN
  CREATE POLICY "Admins can delete roles"
    ON church_roles FOR DELETE
    TO authenticated
    USING (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 4. ADMIN MUTATION POLICIES ON church_permissions
--    (SELECT policy already exists from base migration.
--     No UPDATE policy needed — permissions are toggled
--     via INSERT/DELETE of rows, not row updates.)
-- =====================================================

-- INSERT: Only admins can add permissions
DO $$
BEGIN
  CREATE POLICY "Admins can insert permissions"
    ON church_permissions FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DELETE: Only admins can remove permissions
DO $$
BEGIN
  CREATE POLICY "Admins can delete permissions"
    ON church_permissions FOR DELETE
    TO authenticated
    USING (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 5. ADD COMMENT FOR is_system COLUMN
-- =====================================================

COMMENT ON COLUMN church_roles.is_system IS
  'True for the 11 seeded CASA roles. System roles cannot be deleted via the UI.';

-- =====================================================
-- COMPLETION
-- =====================================================
