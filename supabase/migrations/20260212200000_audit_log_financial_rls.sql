-- =====================================================
-- Financial Audit Log RLS: INSERT Policy for Financial Writers
-- Migration: 20260212200000_audit_log_financial_rls
-- Created: 2026-02-12
-- Description: Adds an INSERT policy on church_audit_log
--   allowing users with financial write permission to
--   insert audit log entries scoped to financial resource
--   types only.
--
-- WHY THIS IS NEEDED:
--   The existing INSERT policy ("Admins can insert audit
--   log entries") only allows is_admin(auth.uid()), which
--   means only general_admin users can write to the audit
--   log. The financial module (Phase 4B) requires that
--   financial_admin users can also write audit entries when
--   they create, update, or delete transactions. Without
--   this policy, financial mutations would silently fail
--   to record audit trail entries due to RLS violations.
--
-- SCOPE:
--   The policy is intentionally scoped: the WITH CHECK
--   clause requires that the details JSONB contains a
--   resource_type field starting with 'fin_'. This
--   prevents financial writers from injecting audit
--   entries for non-financial resources (e.g., role
--   changes, admin actions).
--
-- Safety: Additive only (CREATE POLICY). No DROP, no
--   TRUNCATE, no ALTER. Idempotent via DO/EXCEPTION
--   WHEN duplicate_object.
-- Depends on:
--   - 20260209000000_casa_rbac_schema (has_permission fn)
--   - 20260211000000_casa_multirole_hardening (audit table)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only CASA policies are modified here.
-- =====================================================


-- =====================================================
-- 1. INSERT policy: Financial writers can insert
--    financial audit entries
--
-- Allows authenticated users who have the 'financial'
-- resource 'write' permission to insert audit log rows,
-- but ONLY when the details JSONB contains a
-- resource_type starting with 'fin_'.
--
-- has_permission() is SECURITY DEFINER, so it bypasses
-- RLS on church_permissions/church_user_roles -- safe
-- to use in a policy WITH CHECK clause.
--
-- Note: general_admin users already pass the existing
-- "Admins can insert audit log entries" policy, so this
-- new policy only adds coverage for non-admin financial
-- writers (e.g., financial_admin role).
-- =====================================================

DO $$
BEGIN
  CREATE POLICY "Financial writers can insert financial audit entries"
    ON church_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (
      public.has_permission(auth.uid(), 'financial', 'write')
      AND (details->>'resource_type')::text LIKE 'fin_%'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================
-- COMPLETION
-- =====================================================
