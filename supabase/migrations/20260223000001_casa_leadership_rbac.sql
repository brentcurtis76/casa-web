-- =====================================================
-- CASA Leadership Module — RBAC Permissions
-- Migration: 20260223000001_casa_leadership_rbac
-- Created: 2026-02-23
-- Description: Inserts church_permissions rows for the
--   leadership resource so that Concilio Member,
--   Equipo Pastoral, and General Admin roles can access
--   the Leadership module.
-- Safety: All operations use INSERT ... ON CONFLICT DO NOTHING.
--   Additive only. Idempotent.
-- Depends on:
--   20260209000000_casa_rbac_schema.sql (church_permissions,
--   church_roles tables and seed data must exist)
-- CONTEXT: The initial RBAC seed (20260209000000) already
--   inserted partial leadership permissions:
--     general_admin:   leadership:manage
--     equipo_pastoral: leadership:read, leadership:write
--     concilio_member: leadership:read
--   This migration completes the set per Phase 5 spec:
--     general_admin:   leadership:read, leadership:write,
--                      leadership:manage (all three)
--     concilio_member: leadership:read, leadership:write
--     equipo_pastoral: leadership:read, leadership:write
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- General Admin: full leadership access (read + write + manage)
-- general_admin already has leadership:manage from the initial
-- RBAC seed. Adding read + write here for completeness.
-- All three use ON CONFLICT DO NOTHING so this is safe to re-run.
-- -----------------------------------------------------
INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'read'
FROM church_roles r
WHERE r.name = 'general_admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'write'
FROM church_roles r
WHERE r.name = 'general_admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'manage'
FROM church_roles r
WHERE r.name = 'general_admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- -----------------------------------------------------
-- Concilio Member: leadership read + write
-- (Initial RBAC seed only gave read. Adding write here.)
-- -----------------------------------------------------
INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'read'
FROM church_roles r
WHERE r.name = 'concilio_member'
ON CONFLICT (role_id, resource, action) DO NOTHING;

INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'write'
FROM church_roles r
WHERE r.name = 'concilio_member'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- -----------------------------------------------------
-- Equipo Pastoral: leadership read + write
-- (Initial RBAC seed already gave both. Repeated here
--  for explicit documentation and idempotency.)
-- -----------------------------------------------------
INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'read'
FROM church_roles r
WHERE r.name = 'equipo_pastoral'
ON CONFLICT (role_id, resource, action) DO NOTHING;

INSERT INTO church_permissions (role_id, resource, action)
SELECT r.id, 'leadership', 'write'
FROM church_roles r
WHERE r.name = 'equipo_pastoral'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- -----------------------------------------------------
-- Verification note:
-- After running this migration, the following permissions
-- should exist for the leadership resource:
--   general_admin:   read, write, manage
--   concilio_member: read, write
--   equipo_pastoral: read, write
-- No other roles have leadership access.
-- Access is further scoped at the row level via
-- is_leadership_member() and can_access_leadership_meeting()
-- helper functions defined in the schema migration.
-- -----------------------------------------------------

COMMIT;
