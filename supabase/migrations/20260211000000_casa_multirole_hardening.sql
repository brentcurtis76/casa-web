-- =====================================================
-- CASA Multi-Role Hardening — Permissions RPC + Audit Log
-- Migration: 20260211000000_casa_multirole_hardening
-- Created: 2026-02-11
-- Description: Adds get_user_permissions() RPC for
--   permission caching in AuthContext, and creates
--   church_audit_log table for role change auditing.
-- Safety: All operations are additive (CREATE, INSERT).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent via
--   CREATE OR REPLACE, IF NOT EXISTS, and DO/EXCEPTION.
-- Depends on: 20260209000000_casa_rbac_schema
-- =====================================================

-- =====================================================
-- 1. RPC: get_user_permissions()
-- Returns all (resource, action) pairs for a user,
-- unioned across all of the user's assigned roles.
-- For admins: returns ALL resource/action combinations.
-- Auth guard: only the user themselves or an admin
-- can call this function (Architect MUST FIX #2).
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(resource TEXT, action TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard: only the user themselves or an admin can query permissions
  IF p_user_id != auth.uid() AND NOT is_admin(auth.uid()) THEN
    RETURN;  -- Return empty set (no error, no data leak)
  END IF;

  -- Admin bypass: return ALL resource/action combinations
  IF is_admin(p_user_id) THEN
    RETURN QUERY
    SELECT DISTINCT cp.resource, cp.action
    FROM church_permissions cp
    ORDER BY cp.resource, cp.action;
    RETURN;
  END IF;

  -- Standard user: return the union of permissions from all assigned roles
  RETURN QUERY
  SELECT DISTINCT cp.resource, cp.action
  FROM church_permissions cp
  JOIN church_user_roles cur ON cur.role_id = cp.role_id
  WHERE cur.user_id = p_user_id
  ORDER BY cp.resource, cp.action;
END;
$$;

COMMENT ON FUNCTION get_user_permissions(UUID) IS
  'CASA RBAC: Returns all (resource, action) permission pairs for a user, unioned across all roles. Auth-guarded: only self or admin can call. SECURITY DEFINER, RLS-safe.';

-- =====================================================
-- 2. TABLE: church_audit_log
-- Append-only audit log for role changes and other
-- administrative actions. No UPDATE or DELETE policies.
-- =====================================================

CREATE TABLE IF NOT EXISTS church_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. INDEXES on church_audit_log
-- Architect recommendations: target_user_id for
-- "show all changes for user X" queries, and
-- created_at DESC for chronological pagination.
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_church_audit_log_target
  ON church_audit_log(target_user_id);

CREATE INDEX IF NOT EXISTS idx_church_audit_log_created
  ON church_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_church_audit_log_user
  ON church_audit_log(user_id);

-- =====================================================
-- 4. ENABLE RLS on church_audit_log
-- =====================================================

ALTER TABLE church_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES on church_audit_log
--
-- SELECT: Admins can read all rows.
--         Non-admins can read rows where they are
--         the actor (user_id) or the target (target_user_id).
-- INSERT: Only admins can insert audit log entries
--         (only admins can modify roles, and audit log
--         entries should only be created alongside
--         role mutations). Prevents log injection by
--         non-admin users (Architect MUST FIX #2).
-- No UPDATE or DELETE policies: audit logs are append-only.
-- =====================================================

-- SELECT: Admins can read all audit log entries
DO $$
BEGIN
  CREATE POLICY "Admins can view all audit log entries"
    ON church_audit_log FOR SELECT
    TO authenticated
    USING (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- SELECT: Users can read audit log entries where they are actor or target
DO $$
BEGIN
  CREATE POLICY "Users can view own audit log entries"
    ON church_audit_log FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR target_user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: Only admins can insert audit log entries
DO $$
BEGIN
  CREATE POLICY "Admins can insert audit log entries"
    ON church_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 6. TABLE COMMENT
-- =====================================================

COMMENT ON TABLE church_audit_log IS
  'CASA RBAC: Append-only audit log for role assignments and other admin actions. RLS: admins read all, users read own entries.';

-- =====================================================
-- COMPLETION
-- =====================================================
