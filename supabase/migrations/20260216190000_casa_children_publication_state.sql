-- =====================================================
-- CASA Children's Ministry Publication & Delivery Schema
-- Migration: 20260216190000_casa_children_publication_state
-- Created: 2026-02-16
-- Description: Creates publication state and packet delivery
--   tracking tables for the children's ministry orchestration
--   feature (Liturgy Builder -> Children's Ministry integration).
--   Also seeds "Grupo Mixto" age group, grants Liturgist role
--   children_ministry permissions, and adds unique partial index
--   on lessons for idempotency.
-- Safety: All operations are additive (CREATE TABLE IF NOT EXISTS,
--   INSERT ON CONFLICT DO NOTHING). No DROP, TRUNCATE, or ALTER DROP.
--   Idempotent.
-- Depends on: 20260215100000_casa_children_ministry_schema.sql
--   20260209000000_casa_rbac_schema.sql
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only church_children_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. NEW TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_children_publication_state
-- Tracks publication of generated children's activities
-- linked to a specific liturgy and age group combination.
-- Idempotent by UNIQUE(liturgy_id, age_group_id).
-- One record = one published batch of activities for a
--   specific liturgy + age group pair (e.g., "Pequeños" group
--   for a specific Sunday service).
-- warning_snapshot stores JSON snapshot of any RLS/permission
--   warnings detected at publish time.
-- publish_version increments on re-publication.
-- published_by tracks which user triggered the publication.
-- published_at allows historical tracking.
-- lesson_id and calendar_id denormalized from FK relationships
--   for quick lookup without joins.
-- FKs use ON DELETE SET NULL to preserve publication history
--   even if lesson or calendar is deleted later.
-- - - - - - - - - - - - - - - - - - - - - - - - - -
CREATE TABLE IF NOT EXISTS church_children_publication_state (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgy_id        UUID          REFERENCES liturgias(id) ON DELETE SET NULL,
  age_group_id      UUID          NOT NULL REFERENCES church_children_age_groups(id) ON DELETE CASCADE,
  lesson_id         UUID          REFERENCES church_children_lessons(id) ON DELETE SET NULL,
  calendar_id       UUID          REFERENCES church_children_calendar(id) ON DELETE SET NULL,
  publish_version   INT           DEFAULT 1,
  published_by      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at      TIMESTAMPTZ   DEFAULT now(),
  warning_snapshot  JSONB,
  created_at        TIMESTAMPTZ   DEFAULT now(),
  updated_at        TIMESTAMPTZ   DEFAULT now(),
  UNIQUE(liturgy_id, age_group_id)
);

-- -----------------------------------------------------
-- 1.2 church_children_packet_deliveries
-- Tracks email delivery to volunteers for each publication.
-- One record = one volunteer notification per publication.
-- Idempotent by (publication_id, volunteer_id, email) pattern
--   managed in application code (no DB-level UNIQUE constraint,
--   to allow re-sends with updated status).
-- status: pending (queued), sent (via Resend), failed (error),
--   delivered (confirmed by email provider).
-- external_id: Resend message ID or similar provider identifier.
-- error_message: Captures delivery failure reason.
-- sent_at: Timestamp when email was actually sent.
-- CASCADE delete with parent publication ensures cleanup.
-- - - - - - - - - - - - - - - - - - - - - - - - - -
CREATE TABLE IF NOT EXISTS church_children_packet_deliveries (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id   UUID          NOT NULL REFERENCES church_children_publication_state(id) ON DELETE CASCADE,
  volunteer_id     UUID          REFERENCES church_children_volunteers(id) ON DELETE SET NULL,
  email            TEXT          NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  external_id      TEXT,
  error_message    TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   DEFAULT now()
);

-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Indexes on publication state for fast lookups and joins
CREATE INDEX IF NOT EXISTS idx_church_children_publication_state_liturgy
  ON church_children_publication_state(liturgy_id) WHERE liturgy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_church_children_publication_state_age_group
  ON church_children_publication_state(age_group_id);

CREATE INDEX IF NOT EXISTS idx_church_children_publication_state_published_at
  ON church_children_publication_state(published_at DESC);

-- Indexes on packet deliveries for query performance
CREATE INDEX IF NOT EXISTS idx_church_children_packet_deliveries_publication
  ON church_children_packet_deliveries(publication_id);

CREATE INDEX IF NOT EXISTS idx_church_children_packet_deliveries_volunteer
  ON church_children_packet_deliveries(volunteer_id);

CREATE INDEX IF NOT EXISTS idx_church_children_packet_deliveries_status
  ON church_children_packet_deliveries(status);

-- Unique partial index on lessons for idempotency
-- Prevents duplicate (liturgy_id, age_group_id) pairs
-- WHERE liturgy_id IS NOT NULL to allow NULL liturgy_id values
-- (lessons created without liturgy link are not subject to this constraint).
CREATE UNIQUE INDEX IF NOT EXISTS idx_church_children_lessons_liturgy_age_group_unique
  ON church_children_lessons(liturgy_id, age_group_id)
  WHERE liturgy_id IS NOT NULL;

-- =====================================================
-- 3. TRIGGERS -- updated_at auto-update
-- =====================================================

CREATE OR REPLACE FUNCTION update_children_publication_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_church_children_publication_state_updated_at ON church_children_publication_state;
CREATE TRIGGER trg_church_children_publication_state_updated_at
  BEFORE UPDATE ON church_children_publication_state
  FOR EACH ROW
  EXECUTE FUNCTION update_children_publication_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on both new tables
ALTER TABLE church_children_publication_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_children_packet_deliveries ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- 4.1 church_children_publication_state — Full CRUD for authorized
-- ---------------------------------------------------------
CREATE POLICY "church_children_publication_state_select"
  ON church_children_publication_state
  FOR SELECT
  USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_publication_state_insert"
  ON church_children_publication_state
  FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_publication_state_update"
  ON church_children_publication_state
  FOR UPDATE
  USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_publication_state_delete"
  ON church_children_publication_state
  FOR DELETE
  USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));

-- ---------------------------------------------------------
-- 4.2 church_children_packet_deliveries — Full CRUD for authorized
-- ---------------------------------------------------------
CREATE POLICY "church_children_packet_deliveries_select"
  ON church_children_packet_deliveries
  FOR SELECT
  USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_packet_deliveries_insert"
  ON church_children_packet_deliveries
  FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_packet_deliveries_update"
  ON church_children_packet_deliveries
  FOR UPDATE
  USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_packet_deliveries_delete"
  ON church_children_packet_deliveries
  FOR DELETE
  USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));

-- =====================================================
-- 5. SEED DATA
-- =====================================================

-- Add "Grupo Mixto" (all ages 0-12) age group
INSERT INTO church_children_age_groups (name, min_age, max_age, display_order) VALUES
  ('Grupo Mixto', 0, 12, 4)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. RBAC PERMISSIONS -- Grant Liturgist children_ministry access
-- =====================================================

-- Add children_ministry read and write permissions for Liturgist role
-- This is MANDATORY per Architect review: without this, RLS blocks
-- Liturgist from creating/updating children's ministry records via
-- the orchestration service.
INSERT INTO church_permissions (role_id, resource, action)
SELECT cr.id, 'children_ministry', 'read'
FROM church_roles cr
WHERE cr.name = 'liturgist'
ON CONFLICT (role_id, resource, action) DO NOTHING;

INSERT INTO church_permissions (role_id, resource, action)
SELECT cr.id, 'children_ministry', 'write'
FROM church_roles cr
WHERE cr.name = 'liturgist'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- =====================================================
-- 7. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE church_children_publication_state IS
  'CASA Children Ministry: Publication state for generated children activities linked to liturgy+age_group. Tracks versioning, who published when, and warning snapshots.';

COMMENT ON TABLE church_children_packet_deliveries IS
  'CASA Children Ministry: Email delivery tracking for volunteer notifications. One row per volunteer per publication, with status and provider IDs.';

COMMENT ON FUNCTION update_children_publication_updated_at() IS
  'CASA Children Ministry: Trigger function to auto-update updated_at timestamp on publication state modifications.';

-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
