-- =====================================================
-- WhatsApp Scheduling — pilot for music ministry
-- Additive only (no DROP / TRUNCATE / destructive ALTER).
-- Adds opt-in / suppression tracking on volunteer rows
-- and read/failure tracking on music_notification_logs.
-- =====================================================

-- 1. music_musicians: opt-in metadata and suppression flag
ALTER TABLE music_musicians
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_method TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_suppressed    BOOLEAN NOT NULL DEFAULT false;

-- 2. church_children_volunteers: same WhatsApp metadata as musicians
ALTER TABLE church_children_volunteers
  ADD COLUMN IF NOT EXISTS whatsapp_enabled       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_method TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_suppressed    BOOLEAN NOT NULL DEFAULT false;

-- 3. music_notification_logs: read receipt + failure reason
ALTER TABLE music_notification_logs
  ADD COLUMN IF NOT EXISTS read_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Indexes to speed up phone-based suppression lookups from the webhook
CREATE INDEX IF NOT EXISTS idx_music_musicians_phone
  ON music_musicians(phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_church_children_volunteers_phone
  ON church_children_volunteers(phone) WHERE phone IS NOT NULL;

-- Index to speed up external_id (wamid) lookups during status updates
CREATE INDEX IF NOT EXISTS idx_music_notification_logs_external_id
  ON music_notification_logs(external_id) WHERE external_id IS NOT NULL;

COMMENT ON COLUMN music_musicians.whatsapp_opt_in_at IS
  'Timestamp when the musician opted in to WhatsApp scheduling messages.';
COMMENT ON COLUMN music_musicians.whatsapp_opt_in_method IS
  'How opt-in was captured: formulario | verbal-coordinador | en-app.';
COMMENT ON COLUMN music_musicians.whatsapp_suppressed IS
  'true when the user replied STOP/BAJA. Send pipeline must skip suppressed rows.';

COMMENT ON COLUMN church_children_volunteers.whatsapp_enabled IS
  'Volunteer has consented to receive WhatsApp scheduling messages.';
COMMENT ON COLUMN church_children_volunteers.whatsapp_suppressed IS
  'true when the user replied STOP/BAJA. Send pipeline must skip suppressed rows.';

COMMENT ON COLUMN music_notification_logs.read_at IS
  'Filled by webhook when WhatsApp delivers a read receipt (status enum has no read value).';
COMMENT ON COLUMN music_notification_logs.failure_reason IS
  'Free-form reason for failed sends — Graph API error message or local gate reason.';
