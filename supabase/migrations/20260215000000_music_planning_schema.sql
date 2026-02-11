-- =====================================================
-- CASA Music Planning Module — Schema
-- Migration: 20260215000000_music_planning_schema
-- Created: 2026-02-15
-- Description: Creates the 19 music planning tables
--   organized into 6 groups: Song Library (6),
--   Musician Availability (6), Rehearsal (3),
--   Setlist (2), Notifications (1), Practice (1).
--   Includes indexes, updated_at triggers, and
--   table comments.
-- Safety: All operations are additive (CREATE IF NOT
--   EXISTS, CREATE OR REPLACE). No DROP, TRUNCATE, or
--   ALTER DROP. Idempotent.
-- Depends on:
--   20260209000000_casa_rbac_schema.sql
--     (has_permission function must exist)
--   20241109000000_mesa_abierta_schema.sql
--     (update_updated_at_column trigger function)
-- SHARED DATABASE: This Supabase instance is shared
--   with Life OS. Only music_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES — Song Library (6 tables)
-- =====================================================

-- -----------------------------------------------------
-- 1.1 music_songs — Catálogo principal de canciones
-- Almacena metadatos de canciones, letra en jsonb,
-- y enlaces a recursos externos.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_songs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  artist            TEXT,
  slug              TEXT        UNIQUE NOT NULL,
  number            INTEGER,
  original_key      TEXT,
  tempo             TEXT        CHECK (tempo IN ('lenta', 'intermedia', 'rápida')),
  ccli_number       TEXT,
  duration_seconds  NUMERIC,
  themes            TEXT[],
  suggested_moments TEXT[],
  lyrics            JSONB,
  spotify_url       TEXT,
  youtube_url       TEXT,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 1.2 music_arrangements — Arreglos por canción
-- Cada canción puede tener múltiples arreglos
-- (ej: 'Original', 'Acústico', 'En vivo').
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_arrangements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id         UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  arrangement_key TEXT,
  description     TEXT,
  sort_order      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(song_id, name)
);

-- -----------------------------------------------------
-- 1.3 music_stems — Pistas de audio individuales
-- Un stem por tipo por arreglo (click, cues, pads, etc.)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_stems (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  arrangement_id    UUID        NOT NULL REFERENCES music_arrangements(id) ON DELETE CASCADE,
  stem_type         TEXT        NOT NULL CHECK (stem_type IN ('click', 'cues', 'pads', 'bass', 'drums', 'guitars', 'vocals', 'keys', 'other')),
  storage_path      TEXT        NOT NULL,
  file_name         TEXT,
  duration_seconds  NUMERIC,
  waveform_peaks    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(arrangement_id, stem_type)
);

-- -----------------------------------------------------
-- 1.4 music_chord_charts — Partituras y acordes
-- Archivos PDF/imagen asociados a un arreglo.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_chord_charts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  arrangement_id    UUID        NOT NULL REFERENCES music_arrangements(id) ON DELETE CASCADE,
  storage_path      TEXT        NOT NULL,
  file_type         TEXT        CHECK (file_type IN ('pdf', 'png', 'jpg')),
  transposition_key TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 1.5 music_audio_references — Referencias de audio
-- Enlaces a grabaciones de referencia (YouTube, Spotify,
-- archivos subidos, etc.)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_audio_references (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  source_type TEXT        CHECK (source_type IN ('youtube', 'spotify', 'upload', 'other')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 1.6 music_song_usage_log — Registro de uso de canciones
-- Historial de cuándo se usó cada canción en un servicio.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_song_usage_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id           UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  arrangement_id    UUID        REFERENCES music_arrangements(id) ON DELETE SET NULL,
  service_date      DATE        NOT NULL,
  liturgical_moment TEXT,
  used_by           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(song_id, service_date, liturgical_moment)
);


-- =====================================================
-- 2. TABLES — Musician Availability (6 tables)
-- =====================================================

-- -----------------------------------------------------
-- 2.1 music_musicians — Perfiles de músicos
-- Cada músico puede estar vinculado a un usuario de
-- auth.users. Un usuario solo puede tener un perfil.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_musicians (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name    TEXT        NOT NULL,
  email           TEXT,
  phone           TEXT,
  whatsapp_enabled BOOLEAN    DEFAULT false,
  is_active       BOOLEAN     DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 2.2 music_musician_instruments — Instrumentos por músico
-- Detalle de instrumentos que toca cada músico con
-- nivel de proficiencia.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_musician_instruments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  musician_id UUID        NOT NULL REFERENCES music_musicians(id) ON DELETE CASCADE,
  instrument  TEXT        NOT NULL CHECK (instrument IN ('vocals', 'acoustic_guitar', 'electric_guitar', 'bass', 'drums', 'keys', 'percussion', 'sound_tech', 'other')),
  proficiency TEXT        CHECK (proficiency IN ('beginner', 'intermediate', 'advanced')),
  is_primary  BOOLEAN     DEFAULT false,
  UNIQUE(musician_id, instrument)
);

-- -----------------------------------------------------
-- 2.3 music_recurring_availability — Disponibilidad recurrente
-- Patrón de disponibilidad semanal del músico.
-- Un músico puede tener un patrón activo a la vez
-- (controlado por effective_from/effective_until).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_recurring_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  musician_id     UUID        NOT NULL REFERENCES music_musicians(id) ON DELETE CASCADE,
  pattern_type    TEXT        NOT NULL CHECK (pattern_type IN ('every_week', 'first_and_third', 'second_and_fourth', 'first_only', 'second_only', 'third_only', 'fourth_only', 'last_only', 'custom')),
  custom_weeks    INTEGER[],
  effective_from  DATE        NOT NULL,
  effective_until DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 2.4 music_service_dates — Fechas de servicio/culto
-- Registro de fechas planificadas para servicios.
-- UNIQUE en (date, service_type) para permitir múltiples
-- tipos de servicio en el mismo día (ej: domingo_principal
-- + especial) sin permitir duplicados del mismo tipo.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_service_dates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE        NOT NULL,
  service_type TEXT        NOT NULL DEFAULT 'domingo_principal' CHECK (service_type IN ('domingo_principal', 'especial', 'ensayo')),
  title        TEXT,
  notes        TEXT,
  status       TEXT        DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'completed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, service_type)
);

-- -----------------------------------------------------
-- 2.5 music_availability_overrides — Excepciones de disponibilidad
-- Sobreescritura de disponibilidad para una fecha
-- específica (tiene prioridad sobre el patrón recurrente).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_availability_overrides (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  musician_id           UUID        NOT NULL REFERENCES music_musicians(id) ON DELETE CASCADE,
  service_date_id       UUID        NOT NULL REFERENCES music_service_dates(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL CHECK (status IN ('available', 'unavailable', 'maybe')),
  preferred_instruments TEXT[],
  notes                 TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(musician_id, service_date_id)
);

-- -----------------------------------------------------
-- 2.6 music_service_assignments — Asignaciones de músicos
-- Quién toca qué instrumento en cada fecha de servicio.
-- Un músico por fecha (UNIQUE en service_date_id, musician_id).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_service_assignments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date_id     UUID        NOT NULL REFERENCES music_service_dates(id) ON DELETE CASCADE,
  musician_id         UUID        NOT NULL REFERENCES music_musicians(id) ON DELETE CASCADE,
  assigned_instrument TEXT        NOT NULL,
  assigned_role       TEXT,
  confirmed           BOOLEAN     DEFAULT false,
  confirmed_at        TIMESTAMPTZ,
  assigned_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ DEFAULT now(),
  notes               TEXT,
  UNIQUE(service_date_id, musician_id)
);


-- =====================================================
-- 3. TABLES — Rehearsal (3 tables)
-- =====================================================

-- -----------------------------------------------------
-- 3.1 music_rehearsals — Ensayos programados
-- Puede estar vinculado a una fecha de servicio.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_rehearsals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date_id UUID        REFERENCES music_service_dates(id) ON DELETE SET NULL,
  date            DATE        NOT NULL,
  start_time      TIME,
  end_time        TIME,
  location        TEXT,
  notes           TEXT,
  status          TEXT        DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 3.2 music_rehearsal_songs — Canciones para el ensayo
-- Lista de canciones a practicar en un ensayo.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_rehearsal_songs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id    UUID        NOT NULL REFERENCES music_rehearsals(id) ON DELETE CASCADE,
  song_id         UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  arrangement_id  UUID        REFERENCES music_arrangements(id) ON DELETE SET NULL,
  sort_order      INTEGER     DEFAULT 0,
  notes           TEXT,
  UNIQUE(rehearsal_id, song_id)
);

-- -----------------------------------------------------
-- 3.3 music_rehearsal_attendees — Asistentes al ensayo
-- Control de RSVP y asistencia real.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_rehearsal_attendees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id UUID       NOT NULL REFERENCES music_rehearsals(id) ON DELETE CASCADE,
  musician_id UUID        NOT NULL REFERENCES music_musicians(id) ON DELETE CASCADE,
  rsvp_status TEXT        DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined')),
  attended    BOOLEAN,
  notified_at TIMESTAMPTZ,
  UNIQUE(rehearsal_id, musician_id)
);


-- =====================================================
-- 4. TABLES — Setlist (2 tables)
-- =====================================================

-- -----------------------------------------------------
-- 4.1 music_setlists — Setlists por servicio
-- Un setlist por fecha de servicio (UNIQUE en service_date_id).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_setlists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date_id UUID        NOT NULL REFERENCES music_service_dates(id) ON DELETE CASCADE,
  title           TEXT,
  status          TEXT        DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'presented')),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_date_id)
);

-- -----------------------------------------------------
-- 4.2 music_setlist_items — Ítems del setlist
-- Canciones ordenadas dentro de un setlist.
-- UNIQUE en (setlist_id, song_id) para prevenir canciones
-- duplicadas. sort_order sin constraint para reordenamiento
-- flexible con numeración por gaps (1000, 2000, 3000...).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_setlist_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id        UUID        NOT NULL REFERENCES music_setlists(id) ON DELETE CASCADE,
  song_id           UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  arrangement_id    UUID        REFERENCES music_arrangements(id) ON DELETE SET NULL,
  liturgical_moment TEXT,
  song_key          TEXT,
  sort_order        INTEGER     DEFAULT 0,
  notes             TEXT,
  transition_notes  TEXT,
  UNIQUE(setlist_id, song_id)
);


-- =====================================================
-- 5. TABLES — Notifications (1 table)
-- =====================================================

-- -----------------------------------------------------
-- 5.1 music_notification_logs — Registro de notificaciones
-- Registro de notificaciones enviadas por email/WhatsApp
-- a los músicos. Seguimiento de estado de entrega.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_notification_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id      UUID        REFERENCES music_musicians(id) ON DELETE CASCADE,
  notification_type TEXT        NOT NULL CHECK (notification_type IN ('assignment', 'reminder_1week', 'reminder_1day', 'availability_request', 'rehearsal_invite', 'rehearsal_reminder', 'schedule_published', 'cancellation')),
  channel           TEXT        CHECK (channel IN ('email', 'whatsapp')),
  subject           TEXT,
  message_content   TEXT,
  external_id       TEXT,
  status            TEXT        DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================
-- 6. TABLES — Practice Sessions (1 table)
-- =====================================================

-- -----------------------------------------------------
-- 6.1 music_practice_sessions — Sesiones de práctica
-- Registro de sesiones de práctica individual con
-- control de stems, loop y tempo.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS music_practice_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id         UUID        NOT NULL REFERENCES music_songs(id) ON DELETE CASCADE,
  arrangement_id  UUID        REFERENCES music_arrangements(id) ON DELETE SET NULL,
  stem_volumes    JSONB,
  loop_start      NUMERIC,
  loop_end        NUMERIC,
  tempo_factor    NUMERIC     DEFAULT 1.0,
  duration_seconds INTEGER,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ
);


-- =====================================================
-- 7. INDEXES
-- =====================================================

-- Song Library indexes
CREATE INDEX IF NOT EXISTS idx_music_songs_slug
  ON music_songs(slug);

CREATE INDEX IF NOT EXISTS idx_music_songs_title
  ON music_songs(title);

CREATE INDEX IF NOT EXISTS idx_music_songs_created_by
  ON music_songs(created_by);

CREATE INDEX IF NOT EXISTS idx_music_arrangements_song_id
  ON music_arrangements(song_id);

CREATE INDEX IF NOT EXISTS idx_music_stems_arrangement_id
  ON music_stems(arrangement_id);

CREATE INDEX IF NOT EXISTS idx_music_chord_charts_arrangement_id
  ON music_chord_charts(arrangement_id);

CREATE INDEX IF NOT EXISTS idx_music_audio_references_song_id
  ON music_audio_references(song_id);

CREATE INDEX IF NOT EXISTS idx_music_song_usage_log_song_id
  ON music_song_usage_log(song_id);

CREATE INDEX IF NOT EXISTS idx_music_song_usage_log_service_date
  ON music_song_usage_log(service_date);

CREATE INDEX IF NOT EXISTS idx_music_song_usage_log_arrangement_id
  ON music_song_usage_log(arrangement_id);

-- Musician indexes
CREATE INDEX IF NOT EXISTS idx_music_musicians_user_id
  ON music_musicians(user_id);

CREATE INDEX IF NOT EXISTS idx_music_musicians_is_active
  ON music_musicians(is_active);

CREATE INDEX IF NOT EXISTS idx_music_musician_instruments_musician_id
  ON music_musician_instruments(musician_id);

CREATE INDEX IF NOT EXISTS idx_music_recurring_availability_musician_id
  ON music_recurring_availability(musician_id);

-- Service dates and assignments
CREATE INDEX IF NOT EXISTS idx_music_service_dates_date_type
  ON music_service_dates(date, service_type);

CREATE INDEX IF NOT EXISTS idx_music_service_dates_status
  ON music_service_dates(status);

CREATE INDEX IF NOT EXISTS idx_music_availability_overrides_musician_id
  ON music_availability_overrides(musician_id);

CREATE INDEX IF NOT EXISTS idx_music_availability_overrides_service_date_id
  ON music_availability_overrides(service_date_id);

CREATE INDEX IF NOT EXISTS idx_music_service_assignments_service_date_id
  ON music_service_assignments(service_date_id);

CREATE INDEX IF NOT EXISTS idx_music_service_assignments_musician_id
  ON music_service_assignments(musician_id);

CREATE INDEX IF NOT EXISTS idx_music_service_assignments_assigned_by
  ON music_service_assignments(assigned_by);

-- Rehearsal indexes
CREATE INDEX IF NOT EXISTS idx_music_rehearsals_service_date_id
  ON music_rehearsals(service_date_id);

CREATE INDEX IF NOT EXISTS idx_music_rehearsals_date
  ON music_rehearsals(date);

CREATE INDEX IF NOT EXISTS idx_music_rehearsals_created_by
  ON music_rehearsals(created_by);

CREATE INDEX IF NOT EXISTS idx_music_rehearsal_songs_rehearsal_id
  ON music_rehearsal_songs(rehearsal_id);

CREATE INDEX IF NOT EXISTS idx_music_rehearsal_songs_song_id
  ON music_rehearsal_songs(song_id);

CREATE INDEX IF NOT EXISTS idx_music_rehearsal_attendees_rehearsal_id
  ON music_rehearsal_attendees(rehearsal_id);

CREATE INDEX IF NOT EXISTS idx_music_rehearsal_attendees_musician_id
  ON music_rehearsal_attendees(musician_id);

-- Setlist indexes
CREATE INDEX IF NOT EXISTS idx_music_setlists_service_date_id
  ON music_setlists(service_date_id);

CREATE INDEX IF NOT EXISTS idx_music_setlists_created_by
  ON music_setlists(created_by);

CREATE INDEX IF NOT EXISTS idx_music_setlist_items_setlist_id
  ON music_setlist_items(setlist_id);

CREATE INDEX IF NOT EXISTS idx_music_setlist_items_song_id
  ON music_setlist_items(song_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_music_notification_logs_recipient_id
  ON music_notification_logs(recipient_id);

CREATE INDEX IF NOT EXISTS idx_music_notification_logs_status
  ON music_notification_logs(status);

-- Practice session indexes
CREATE INDEX IF NOT EXISTS idx_music_practice_sessions_user_id
  ON music_practice_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_music_practice_sessions_song_id
  ON music_practice_sessions(song_id);


-- =====================================================
-- 8. TRIGGERS — updated_at auto-update
-- Reuses existing update_updated_at_column() from
-- Mesa Abierta migration (20241109000000).
-- Applied to the 7 tables that have updated_at columns.
-- =====================================================

-- 8.1 music_songs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_songs_updated_at') THEN
    CREATE TRIGGER trg_music_songs_updated_at
      BEFORE UPDATE ON music_songs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.2 music_arrangements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_arrangements_updated_at') THEN
    CREATE TRIGGER trg_music_arrangements_updated_at
      BEFORE UPDATE ON music_arrangements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.3 music_musicians
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_musicians_updated_at') THEN
    CREATE TRIGGER trg_music_musicians_updated_at
      BEFORE UPDATE ON music_musicians
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.4 music_recurring_availability
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_recurring_availability_updated_at') THEN
    CREATE TRIGGER trg_music_recurring_availability_updated_at
      BEFORE UPDATE ON music_recurring_availability
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.5 music_service_dates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_service_dates_updated_at') THEN
    CREATE TRIGGER trg_music_service_dates_updated_at
      BEFORE UPDATE ON music_service_dates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.6 music_rehearsals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_rehearsals_updated_at') THEN
    CREATE TRIGGER trg_music_rehearsals_updated_at
      BEFORE UPDATE ON music_rehearsals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 8.7 music_setlists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_music_setlists_updated_at') THEN
    CREATE TRIGGER trg_music_setlists_updated_at
      BEFORE UPDATE ON music_setlists
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- =====================================================
-- 9. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE music_songs IS
  'CASA Music: Catálogo principal de canciones con metadatos, letra y enlaces externos';

COMMENT ON TABLE music_arrangements IS
  'CASA Music: Arreglos musicales por canción (Original, Acústico, En vivo, etc.)';

COMMENT ON TABLE music_stems IS
  'CASA Music: Pistas de audio individuales (stems) por arreglo para el reproductor de práctica';

COMMENT ON TABLE music_chord_charts IS
  'CASA Music: Partituras y diagramas de acordes (PDF/imagen) por arreglo';

COMMENT ON TABLE music_audio_references IS
  'CASA Music: Enlaces a grabaciones de referencia (YouTube, Spotify, archivos subidos)';

COMMENT ON TABLE music_song_usage_log IS
  'CASA Music: Historial de uso de canciones en servicios para análisis y rotación';

COMMENT ON TABLE music_musicians IS
  'CASA Music: Perfiles de músicos vinculados a auth.users con datos de contacto';

COMMENT ON TABLE music_musician_instruments IS
  'CASA Music: Instrumentos que toca cada músico con nivel de proficiencia';

COMMENT ON TABLE music_recurring_availability IS
  'CASA Music: Patrón de disponibilidad recurrente (cada semana, 1ro y 3ro, etc.)';

COMMENT ON TABLE music_service_dates IS
  'CASA Music: Fechas de servicio/culto planificadas con estado de planificación';

COMMENT ON TABLE music_availability_overrides IS
  'CASA Music: Excepciones puntuales de disponibilidad por fecha de servicio';

COMMENT ON TABLE music_service_assignments IS
  'CASA Music: Asignación de músicos e instrumentos por fecha de servicio';

COMMENT ON TABLE music_rehearsals IS
  'CASA Music: Ensayos programados con fecha, hora, ubicación y estado';

COMMENT ON TABLE music_rehearsal_songs IS
  'CASA Music: Canciones planificadas para un ensayo con arreglo y orden';

COMMENT ON TABLE music_rehearsal_attendees IS
  'CASA Music: RSVP y control de asistencia de músicos a ensayos';

COMMENT ON TABLE music_setlists IS
  'CASA Music: Setlist de canciones por servicio (un setlist por fecha)';

COMMENT ON TABLE music_setlist_items IS
  'CASA Music: Ítems ordenados del setlist con momento litúrgico y tonalidad';

COMMENT ON TABLE music_notification_logs IS
  'CASA Music: Registro de notificaciones enviadas por email/WhatsApp a músicos';

COMMENT ON TABLE music_practice_sessions IS
  'CASA Music: Sesiones de práctica individual con control de stems, loop y tempo';


-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
