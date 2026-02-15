-- =====================================================
-- CASA Children's Ministry Module Schema
-- Migration: 20260215100000_casa_children_ministry_schema
-- Created: 2026-02-15
-- Description: Creates the 9 children's ministry tables
--   (church_children_age_groups, church_children_lessons,
--    church_children_lesson_materials, church_children_calendar,
--    church_children_volunteers, church_children_recurring_availability,
--    church_children_session_assignments, church_children_attendance,
--    church_children_inventory) with RLS policies, indexes,
--    triggers, and seed data.
-- Safety: All operations are additive (CREATE IF NOT EXISTS,
--   CREATE OR REPLACE, INSERT ON CONFLICT DO NOTHING).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent.
-- Depends on: 20260209000000_casa_rbac_schema.sql
--   (has_permission function must exist)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only church_children_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_children_age_groups -- Pre-seeded age groups
-- Fixed groups (not user-editable).
-- Display order determines UI ordering.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_age_groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL UNIQUE,
  min_age       INT         NOT NULL,
  max_age       INT         NOT NULL,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.2 church_children_lessons -- Lesson library
-- Reusable lesson plans for children's ministry.
-- FK to liturgias for optional linking to services.
-- Tags array for filtering. Status tracks draft/ready/archived.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_lessons (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  description     TEXT,
  age_group_id    UUID        REFERENCES church_children_age_groups(id) ON DELETE SET NULL,
  bible_reference TEXT,
  objectives      TEXT,
  content         TEXT,
  materials_needed TEXT,
  duration_minutes INT         DEFAULT 45,
  liturgy_id      UUID        REFERENCES liturgias(id) ON DELETE SET NULL,
  tags            TEXT[]      DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'archived')),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.3 church_children_lesson_materials -- Lesson attachments
-- Attachments/resources linked to lessons.
-- Type: document, image, link, video, story (future Cuentacuentos).
-- story_id is nullable for future integration.
-- CASCADE delete with parent lesson.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_lesson_materials (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID        NOT NULL REFERENCES church_children_lessons(id) ON DELETE CASCADE,
  name      TEXT        NOT NULL,
  type      TEXT        NOT NULL CHECK (type IN ('document', 'image', 'link', 'video', 'story')),
  url       TEXT        NOT NULL,
  story_id  UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.4 church_children_calendar -- Scheduled sessions
-- One row = one class on a specific date for an age group.
-- UNIQUE (date, age_group_id) prevents double-booking per group per day.
-- Status tracks scheduled/completed/cancelled.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_calendar (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL,
  start_time  TIME        DEFAULT '10:00',
  end_time    TIME        DEFAULT '11:00',
  age_group_id UUID        NOT NULL REFERENCES church_children_age_groups(id) ON DELETE CASCADE,
  lesson_id   UUID        REFERENCES church_children_lessons(id) ON DELETE SET NULL,
  location    TEXT        DEFAULT 'Sala Infantil',
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, age_group_id)
);

-- -----------------------------------------------------
-- 1.5 church_children_volunteers -- Volunteer registry
-- Registry of volunteers for children's ministry.
-- UNIQUE user_id allows at most one volunteer record per CASA user.
-- user_id nullable for external volunteers without CASA accounts.
-- is_active tracks active status.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_volunteers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  TEXT        NOT NULL,
  email         TEXT,
  phone         TEXT,
  is_active     BOOLEAN     DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.6 church_children_recurring_availability -- Weekly patterns
-- Weekly recurring availability for volunteers.
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- Unique on (volunteer_id, day_of_week, effective_from) allows
-- date-based versioning of availability.
-- effective_until nullable = indefinitely.
-- Self-service policy allows volunteers to manage own availability.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_recurring_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id    UUID        NOT NULL REFERENCES church_children_volunteers(id) ON DELETE CASCADE,
  day_of_week     INT         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_available    BOOLEAN     DEFAULT true,
  effective_from  DATE        DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(volunteer_id, day_of_week, effective_from)
);

-- -----------------------------------------------------
-- 1.7 church_children_session_assignments -- Per-session assignments
-- Per-session volunteer assignments (overrides recurring availability).
-- UNIQUE (calendar_id, volunteer_id) prevents double-assignment per session.
-- Role: lead, assistant, support
-- Status: assigned, confirmed, declined (volunteer self-service updates)
-- Self-service policy allows volunteers to update own status.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_session_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID        NOT NULL REFERENCES church_children_calendar(id) ON DELETE CASCADE,
  volunteer_id UUID        NOT NULL REFERENCES church_children_volunteers(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'assistant' CHECK (role IN ('lead', 'assistant', 'support')),
  status      TEXT        NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'declined')),
  assigned_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(calendar_id, volunteer_id)
);

-- -----------------------------------------------------
-- 1.8 church_children_attendance -- Simple check-in
-- Child attendance tracking (present/absent).
-- child_name stored as free text (privacy choice - no children registry).
-- No FK to children table. Coordinators type names per session.
-- age_group_id helps with reporting but is not required.
-- CASCADE delete with parent session.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id   UUID        NOT NULL REFERENCES church_children_calendar(id) ON DELETE CASCADE,
  child_name    TEXT        NOT NULL,
  age_group_id  UUID        REFERENCES church_children_age_groups(id) ON DELETE SET NULL,
  is_present    BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.9 church_children_inventory -- Supply tracking
-- Basic inventory for children's ministry supplies.
-- Category: craft, book, supply, equipment, other
-- quantity >= 0 enforced by CHECK constraint.
-- min_quantity defines low-stock threshold.
-- last_restocked_at tracks most recent restock date.
-- created_by tracks who created the item.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_children_inventory (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  category          TEXT        NOT NULL DEFAULT 'supply' CHECK (category IN ('craft', 'book', 'supply', 'equipment', 'other')),
  quantity          INT         DEFAULT 0 CHECK (quantity >= 0),
  min_quantity      INT         DEFAULT 0,
  location          TEXT        DEFAULT 'Sala Infantil',
  notes             TEXT,
  last_restocked_at TIMESTAMPTZ,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);


-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Lesson indexes for filtering and lookups
CREATE INDEX IF NOT EXISTS idx_church_children_lessons_age_group
  ON church_children_lessons(age_group_id);

CREATE INDEX IF NOT EXISTS idx_church_children_lessons_status
  ON church_children_lessons(status);

CREATE INDEX IF NOT EXISTS idx_church_children_lessons_liturgy
  ON church_children_lessons(liturgy_id) WHERE liturgy_id IS NOT NULL;

-- Lesson materials index for lesson detail queries
CREATE INDEX IF NOT EXISTS idx_church_children_materials_lesson
  ON church_children_lesson_materials(lesson_id);

-- Calendar indexes for date-based and group-based queries
CREATE INDEX IF NOT EXISTS idx_church_children_calendar_date
  ON church_children_calendar(date);

CREATE INDEX IF NOT EXISTS idx_church_children_calendar_age_group
  ON church_children_calendar(age_group_id);

-- Volunteer indexes for lookup and filtering
CREATE INDEX IF NOT EXISTS idx_church_children_volunteers_user
  ON church_children_volunteers(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_church_children_volunteers_active
  ON church_children_volunteers(is_active);

-- Attendance index for session-based queries
CREATE INDEX IF NOT EXISTS idx_church_children_attendance_calendar
  ON church_children_attendance(calendar_id);

-- Inventory index for category filtering
CREATE INDEX IF NOT EXISTS idx_church_children_inventory_category
  ON church_children_inventory(category);


-- =====================================================
-- 3. TRIGGER FUNCTION -- updated_at
-- Applied to 4 mutable tables: lessons, calendar, volunteers, inventory
-- =====================================================

CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to church_children_lessons
DROP TRIGGER IF EXISTS trg_church_children_lessons_updated_at ON church_children_lessons;
CREATE TRIGGER trg_church_children_lessons_updated_at
  BEFORE UPDATE ON church_children_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();

-- Apply trigger to church_children_calendar
DROP TRIGGER IF EXISTS trg_church_children_calendar_updated_at ON church_children_calendar;
CREATE TRIGGER trg_church_children_calendar_updated_at
  BEFORE UPDATE ON church_children_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();

-- Apply trigger to church_children_volunteers
DROP TRIGGER IF EXISTS trg_church_children_volunteers_updated_at ON church_children_volunteers;
CREATE TRIGGER trg_church_children_volunteers_updated_at
  BEFORE UPDATE ON church_children_volunteers
  FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();

-- Apply trigger to church_children_inventory
DROP TRIGGER IF EXISTS trg_church_children_inventory_updated_at ON church_children_inventory;
CREATE TRIGGER trg_church_children_inventory_updated_at
  BEFORE UPDATE ON church_children_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();


-- =====================================================
-- 4. ROW LEVEL SECURITY
-- Uses public.has_permission() from RBAC migration.
-- Pattern: 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
-- Exceptions: Self-service policies for volunteers on 2 tables.
-- =====================================================

-- -----------------------------------------------------
-- 4.1 church_children_age_groups -- Read-only lookup table
-- Only SELECT allowed (read-only); no mutations via RLS
-- (creation happens via seed data and migrations only)
-- -----------------------------------------------------
ALTER TABLE church_children_age_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_age_groups_select" ON church_children_age_groups
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

-- No INSERT/UPDATE/DELETE policies — this is a reference table


-- -----------------------------------------------------
-- 4.2 church_children_lessons
-- Full CRUD for authorized coordinators/admins
-- -----------------------------------------------------
ALTER TABLE church_children_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_lessons_select" ON church_children_lessons
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_lessons_insert" ON church_children_lessons
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_lessons_update" ON church_children_lessons
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_lessons_delete" ON church_children_lessons
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- -----------------------------------------------------
-- 4.3 church_children_lesson_materials
-- Full CRUD for authorized coordinators/admins
-- Part of lesson management
-- -----------------------------------------------------
ALTER TABLE church_children_lesson_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_materials_select" ON church_children_lesson_materials
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_materials_insert" ON church_children_lesson_materials
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_materials_update" ON church_children_lesson_materials
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_materials_delete" ON church_children_lesson_materials
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- -----------------------------------------------------
-- 4.4 church_children_calendar
-- Full CRUD for authorized coordinators/admins
-- Calendar session management
-- -----------------------------------------------------
ALTER TABLE church_children_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_calendar_select" ON church_children_calendar
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_calendar_insert" ON church_children_calendar
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_calendar_update" ON church_children_calendar
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_calendar_delete" ON church_children_calendar
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- -----------------------------------------------------
-- 4.5 church_children_volunteers
-- Full CRUD for authorized coordinators/admins
-- Volunteer registry management
-- -----------------------------------------------------
ALTER TABLE church_children_volunteers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_volunteers_select" ON church_children_volunteers
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_volunteers_insert" ON church_children_volunteers
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_volunteers_update" ON church_children_volunteers
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_volunteers_delete" ON church_children_volunteers
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- -----------------------------------------------------
-- 4.6 church_children_recurring_availability
-- Standard policies for coordinators + self-service for volunteers
-- Volunteers can manage their own availability records
-- (FOR ALL with both USING and WITH CHECK per Architect Issue-4)
-- -----------------------------------------------------
ALTER TABLE church_children_recurring_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_recurring_select" ON church_children_recurring_availability
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_recurring_insert" ON church_children_recurring_availability
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_recurring_update" ON church_children_recurring_availability
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_recurring_delete" ON church_children_recurring_availability
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));

-- Self-service exception: Volunteers can manage their own availability
CREATE POLICY "church_children_recurring_own_volunteer" ON church_children_recurring_availability
  FOR ALL USING (
    auth.uid() IS NOT NULL
    AND volunteer_id IN (
      SELECT id FROM church_children_volunteers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND volunteer_id IN (
      SELECT id FROM church_children_volunteers WHERE user_id = auth.uid()
    )
  );


-- -----------------------------------------------------
-- 4.7 church_children_session_assignments
-- Standard policies for coordinators + self-service for volunteer status updates
-- Volunteers can confirm/decline their own assignments
-- (FOR UPDATE with both USING and WITH CHECK per Architect Issue-4)
-- -----------------------------------------------------
ALTER TABLE church_children_session_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_assignments_select" ON church_children_session_assignments
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_assignments_insert" ON church_children_session_assignments
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_assignments_update" ON church_children_session_assignments
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_assignments_delete" ON church_children_session_assignments
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));

-- Self-service exception: Volunteers can update their own assignment status
CREATE POLICY "church_children_assignments_own_status" ON church_children_session_assignments
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND volunteer_id IN (
      SELECT id FROM church_children_volunteers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND volunteer_id IN (
      SELECT id FROM church_children_volunteers WHERE user_id = auth.uid()
    )
  );


-- -----------------------------------------------------
-- 4.8 church_children_attendance
-- Full CRUD for authorized coordinators/admins
-- Attendance tracking (primarily create new records during sessions)
-- -----------------------------------------------------
ALTER TABLE church_children_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_attendance_select" ON church_children_attendance
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_attendance_insert" ON church_children_attendance
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_attendance_update" ON church_children_attendance
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_attendance_delete" ON church_children_attendance
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- -----------------------------------------------------
-- 4.9 church_children_inventory
-- Full CRUD for authorized coordinators/admins
-- Inventory management
-- -----------------------------------------------------
ALTER TABLE church_children_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_children_inventory_select" ON church_children_inventory
  FOR SELECT USING (public.has_permission(auth.uid(), 'children_ministry', 'read'));

CREATE POLICY "church_children_inventory_insert" ON church_children_inventory
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_inventory_update" ON church_children_inventory
  FOR UPDATE USING (public.has_permission(auth.uid(), 'children_ministry', 'write'));

CREATE POLICY "church_children_inventory_delete" ON church_children_inventory
  FOR DELETE USING (public.has_permission(auth.uid(), 'children_ministry', 'manage'));


-- =====================================================
-- 5. SEED DATA
-- =====================================================

-- Pre-seed 3 age groups (fixed, not user-editable)
INSERT INTO church_children_age_groups (name, min_age, max_age, display_order) VALUES
  ('Pequeños', 0, 4, 1),
  ('Medianos', 5, 8, 2),
  ('Grandes', 9, 12, 3)
ON CONFLICT (name) DO NOTHING;


-- =====================================================
-- 6. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE church_children_age_groups IS
  'CASA Children Ministry: Pre-seeded age groups (Pequeños 0-4, Medianos 5-8, Grandes 9-12)';

COMMENT ON TABLE church_children_lessons IS
  'CASA Children Ministry: Lesson library with reusable lesson plans for different age groups';

COMMENT ON TABLE church_children_lesson_materials IS
  'CASA Children Ministry: Attachments and resources for lessons (documents, images, videos, links)';

COMMENT ON TABLE church_children_calendar IS
  'CASA Children Ministry: Scheduled class sessions (one per age group per day, UNIQUE on date+age_group_id)';

COMMENT ON TABLE church_children_volunteers IS
  'CASA Children Ministry: Volunteer registry with optional user linkage. UNIQUE on user_id to prevent duplicates';

COMMENT ON TABLE church_children_recurring_availability IS
  'CASA Children Ministry: Weekly recurring availability patterns per volunteer. Self-service editable by volunteers';

COMMENT ON TABLE church_children_session_assignments IS
  'CASA Children Ministry: Per-session volunteer assignments with role (lead/assistant/support) and status. Self-service status updates by volunteers';

COMMENT ON TABLE church_children_attendance IS
  'CASA Children Ministry: Simple attendance tracking (present/absent). Child names stored as free text for privacy (no children registry)';

COMMENT ON TABLE church_children_inventory IS
  'CASA Children Ministry: Supply tracking with quantity, min_quantity thresholds, and category classification';

COMMENT ON FUNCTION update_children_updated_at() IS
  'CASA Children Ministry: Trigger function to auto-update updated_at timestamp on row modification for lessons, calendar, volunteers, inventory';


-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
