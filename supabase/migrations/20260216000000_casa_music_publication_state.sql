-- =====================================================
-- CASA Music Planning — Publication State & Packet Delivery
-- Migration: 20260216000000_casa_music_publication_state
-- Created: 2026-02-16
-- Description: Creates 2 new tables to track liturgy → setlist
--   publication state and musician packet delivery status.
--   Enables versioning, packet generation tracking, and
--   email delivery logging for the Liturgy → Programación
--   Musical workflow.
-- Safety: All operations are additive (CREATE IF NOT EXISTS).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent.
-- Depends on:
--   20260215000000_music_planning_schema.sql
--     (music_service_dates, music_setlists, music_musicians)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only music_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES — Publication State Tracking (2 tables)
-- =====================================================

-- -----------------------------------------------------
-- 1.1 music_publication_state
-- Tracks which liturgy published to which setlist,
-- with versioning for updates and warning snapshots.
-- liturgy_id is TEXT to support both UUID and local IDs.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_publication_state (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgy_id       TEXT        NOT NULL,
  service_date_id  UUID        NOT NULL REFERENCES music_service_dates(id) ON DELETE CASCADE,
  setlist_id       UUID        NOT NULL REFERENCES music_setlists(id) ON DELETE CASCADE,
  publish_version  INTEGER     NOT NULL DEFAULT 1,
  published_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_packet_path TEXT,
  warning_snapshot JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(liturgy_id, service_date_id)
);

COMMENT ON TABLE music_publication_state IS
  'CASA Music: Publication state tracking from Liturgy Builder to Programación Musical with versioning';

COMMENT ON COLUMN music_publication_state.liturgy_id IS
  'Liturgy ID (TEXT to support UUID from liturgias table or local non-UUID identifiers)';

COMMENT ON COLUMN music_publication_state.publish_version IS
  'Publication version counter (increments on re-publish from same liturgy to same service date)';

COMMENT ON COLUMN music_publication_state.warning_snapshot IS
  'JSON snapshot of warnings at publish time (missing chord charts, audio references, stems)';

-- -----------------------------------------------------
-- 1.2 music_packet_deliveries
-- Logs each packet delivery attempt per musician per
-- publication. Tracks email send status and external
-- service IDs (Resend, etc.).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_packet_deliveries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID        NOT NULL REFERENCES music_publication_state(id) ON DELETE CASCADE,
  musician_id    UUID        REFERENCES music_musicians(id) ON DELETE SET NULL,
  email          TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  external_id    TEXT,
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE music_packet_deliveries IS
  'CASA Music: Packet delivery log per musician per publication with email send tracking';

COMMENT ON COLUMN music_packet_deliveries.status IS
  'Delivery status: pending (queued), sent (API accepted), delivered (confirmed), failed (error)';

COMMENT ON COLUMN music_packet_deliveries.external_id IS
  'External service ID (e.g., Resend message ID) for delivery tracking';

-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Publication state indexes
CREATE INDEX IF NOT EXISTS idx_music_publication_state_liturgy_id
  ON music_publication_state(liturgy_id);

CREATE INDEX IF NOT EXISTS idx_music_publication_state_service_date_id
  ON music_publication_state(service_date_id);

CREATE INDEX IF NOT EXISTS idx_music_publication_state_setlist_id
  ON music_publication_state(setlist_id);

CREATE INDEX IF NOT EXISTS idx_music_publication_state_published_by
  ON music_publication_state(published_by);

-- Packet delivery indexes
CREATE INDEX IF NOT EXISTS idx_music_packet_deliveries_publication_id
  ON music_packet_deliveries(publication_id);

CREATE INDEX IF NOT EXISTS idx_music_packet_deliveries_musician_id
  ON music_packet_deliveries(musician_id);

CREATE INDEX IF NOT EXISTS idx_music_packet_deliveries_status
  ON music_packet_deliveries(status);

-- =====================================================
-- 3. TRIGGERS — updated_at auto-update
-- Reuses existing update_updated_at_column() from
-- Mesa Abierta migration (20241109000000).
-- Applied to music_publication_state (has updated_at).
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_publication_state_updated_at') THEN
    CREATE TRIGGER trg_music_publication_state_updated_at
      BEFORE UPDATE ON music_publication_state
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE music_publication_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_packet_deliveries ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 4.1 music_publication_state policies
-- READ: All authenticated users can view publication state
-- WRITE: Authenticated users can create/update (app layer handles role checks)
-- DELETE: Authenticated users can delete (app layer handles role checks)
-- -----------------------------------------------------

CREATE POLICY "Authenticated users can read publication state"
  ON music_publication_state
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert publication state"
  ON music_publication_state
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update publication state"
  ON music_publication_state
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete publication state"
  ON music_publication_state
  FOR DELETE
  TO authenticated
  USING (true);

-- -----------------------------------------------------
-- 4.2 music_packet_deliveries policies
-- READ: All authenticated users can view delivery logs
-- WRITE: Authenticated users can create/update (app layer handles role checks)
-- DELETE: Authenticated users can delete (app layer handles role checks)
-- -----------------------------------------------------

CREATE POLICY "Authenticated users can read packet deliveries"
  ON music_packet_deliveries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert packet deliveries"
  ON music_packet_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update packet deliveries"
  ON music_packet_deliveries
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete packet deliveries"
  ON music_packet_deliveries
  FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
