-- =====================================================
-- CASA RBAC Schema — Multi-Role Access Control System
-- Migration: 20260209000000_casa_rbac_schema
-- Created: 2026-02-09
-- Description: Creates church_roles, church_user_roles,
--   church_permissions tables with RLS, SECURITY DEFINER
--   helper functions, seed data, and backward compat migration.
-- Safety: All operations are additive (CREATE, INSERT).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent via
--   IF NOT EXISTS and ON CONFLICT DO NOTHING.
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_roles — Defines the 11 CASA roles
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_church_roles_name ON church_roles(name);

-- -----------------------------------------------------
-- 1.2 church_user_roles — User-to-role assignments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES church_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_church_user_roles_user ON church_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_church_user_roles_role ON church_user_roles(role_id);

-- -----------------------------------------------------
-- 1.3 church_permissions — Role-to-resource permissions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES church_roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'write', 'manage')),
  UNIQUE(role_id, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_church_permissions_role ON church_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_church_permissions_resource ON church_permissions(resource);

-- =====================================================
-- 2. SECURITY DEFINER FUNCTIONS
-- These bypass RLS to avoid recursion when used inside
-- RLS policies. Pattern matches existing is_mesa_admin().
-- =====================================================

-- -----------------------------------------------------
-- 2.1 is_admin() — Check if user has general_admin role
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM church_user_roles cur
    JOIN church_roles cr ON cr.id = cur.role_id
    WHERE cur.user_id = p_user_id
      AND cr.name = 'general_admin'
  );
END;
$$;

-- -----------------------------------------------------
-- 2.2 get_user_roles() — Returns array of role names
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT COALESCE(array_agg(cr.name), ARRAY[]::TEXT[])
  INTO result
  FROM church_user_roles cur
  JOIN church_roles cr ON cr.id = cur.role_id
  WHERE cur.user_id = p_user_id;

  RETURN result;
END;
$$;

-- -----------------------------------------------------
-- 2.3 has_permission() — Check if user has specific permission
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION has_permission(p_user_id UUID, p_resource TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- General admins have all permissions
  IF is_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission
  RETURN EXISTS (
    SELECT 1
    FROM church_permissions cp
    JOIN church_user_roles cur ON cur.role_id = cp.role_id
    WHERE cur.user_id = p_user_id
      AND cp.resource = p_resource
      AND cp.action = p_action
  );
END;
$$;

-- -----------------------------------------------------
-- 2.4 get_users_with_email() — Admin-only function to
--   join profiles with auth.users for email access
--   (Architect ISSUE-5: email lives in auth.users,
--    not in profiles table)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_users_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT is_admin(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    u.email::TEXT,
    p.avatar_url,
    u.phone::TEXT
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name ASC NULLS LAST;
END;
$$;

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all three tables
ALTER TABLE church_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_permissions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 3.1 church_roles — READ for all authenticated users
-- -----------------------------------------------------
CREATE POLICY "Authenticated users can view roles"
  ON church_roles FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------
-- 3.2 church_user_roles — Granular access
-- -----------------------------------------------------

-- SELECT: Users can see their own role assignments
CREATE POLICY "Users can view own role assignments"
  ON church_user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SELECT: Admins can see all role assignments
CREATE POLICY "Admins can view all role assignments"
  ON church_user_roles FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- INSERT: Only admins can assign roles
CREATE POLICY "Admins can insert role assignments"
  ON church_user_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- UPDATE: Only admins can update role assignments
CREATE POLICY "Admins can update role assignments"
  ON church_user_roles FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

-- DELETE: Only admins can remove role assignments
CREATE POLICY "Admins can delete role assignments"
  ON church_user_roles FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- -----------------------------------------------------
-- 3.3 church_permissions — READ only for authenticated
-- No INSERT/UPDATE/DELETE policies = no client mutations
-- -----------------------------------------------------
CREATE POLICY "Authenticated users can view permissions"
  ON church_permissions FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 4. SEED DATA — 11 Roles
-- =====================================================

INSERT INTO church_roles (name, display_name, description) VALUES
  ('general_admin', 'Administrador General', 'Acceso completo a todos los módulos y funciones del sistema'),
  ('liturgist', 'Liturgista', 'Crea, edita y elimina liturgias usando el Constructor de Liturgias'),
  ('av_volunteer', 'Voluntario AV', 'Acceso al Presentador, Reproductor de Stems y Generador de Gráficos'),
  ('worship_coordinator', 'Coordinador de Alabanza', 'Calendario de músicos, canciones, acordes y stems'),
  ('comms_volunteer', 'Voluntario de Comunicaciones', 'Acceso al Generador de Gráficos'),
  ('mesa_abierta_coordinator', 'Coordinador Mesa Abierta', 'Gestión del módulo Mesa Abierta'),
  ('financial_admin', 'Administrador Financiero', 'Acceso al módulo de Administración y Contabilidad'),
  ('concilio_member', 'Miembro del Concilio', 'Reportes financieros (solo lectura) y Liderazgo'),
  ('equipo_pastoral', 'Equipo Pastoral', 'Reportes financieros, Liderazgo y Liturgias'),
  ('children_ministry_coordinator', 'Coordinador Ministerio Infantil', 'Gestión completa del módulo de Ministerio Infantil'),
  ('children_ministry_volunteer', 'Voluntario Ministerio Infantil', 'Disponibilidad de calendario y lecciones asignadas')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 5. SEED DATA — Permissions per Role
--
-- Resource name mapping (Architect ISSUE-1):
--   Frontend module ID   → DB resource name
--   presenter            → presenter
--   eventos              → eventos
--   mesa-abierta         → mesa_abierta
--   graphics             → graphics
--   sermon-editor        → sermon_editor
--   constructor          → liturgy_builder
--   temporadas           → liturgy_seasons
--   oraciones            → oraciones
--   canciones            → canciones
--   elementos-fijos      → elementos_fijos
--   (future) financial   → financial
--   (future) leadership  → leadership
--   (future) children    → children_ministry
-- =====================================================

-- Helper: Use a DO block with variables for role IDs
DO $$
DECLARE
  r_general_admin UUID;
  r_liturgist UUID;
  r_av_volunteer UUID;
  r_worship_coordinator UUID;
  r_comms_volunteer UUID;
  r_mesa_abierta_coordinator UUID;
  r_financial_admin UUID;
  r_concilio_member UUID;
  r_equipo_pastoral UUID;
  r_children_coordinator UUID;
  r_children_volunteer UUID;
BEGIN
  -- Fetch role IDs
  SELECT id INTO r_general_admin FROM church_roles WHERE name = 'general_admin';
  SELECT id INTO r_liturgist FROM church_roles WHERE name = 'liturgist';
  SELECT id INTO r_av_volunteer FROM church_roles WHERE name = 'av_volunteer';
  SELECT id INTO r_worship_coordinator FROM church_roles WHERE name = 'worship_coordinator';
  SELECT id INTO r_comms_volunteer FROM church_roles WHERE name = 'comms_volunteer';
  SELECT id INTO r_mesa_abierta_coordinator FROM church_roles WHERE name = 'mesa_abierta_coordinator';
  SELECT id INTO r_financial_admin FROM church_roles WHERE name = 'financial_admin';
  SELECT id INTO r_concilio_member FROM church_roles WHERE name = 'concilio_member';
  SELECT id INTO r_equipo_pastoral FROM church_roles WHERE name = 'equipo_pastoral';
  SELECT id INTO r_children_coordinator FROM church_roles WHERE name = 'children_ministry_coordinator';
  SELECT id INTO r_children_volunteer FROM church_roles WHERE name = 'children_ministry_volunteer';

  -- ===================================================
  -- 5.1 general_admin — Manage on ALL resources
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_general_admin, 'presenter', 'manage'),
    (r_general_admin, 'eventos', 'manage'),
    (r_general_admin, 'mesa_abierta', 'manage'),
    (r_general_admin, 'graphics', 'manage'),
    (r_general_admin, 'sermon_editor', 'manage'),
    (r_general_admin, 'liturgy_builder', 'manage'),
    (r_general_admin, 'liturgy_seasons', 'manage'),
    (r_general_admin, 'oraciones', 'manage'),
    (r_general_admin, 'canciones', 'manage'),
    (r_general_admin, 'elementos_fijos', 'manage'),
    (r_general_admin, 'financial', 'manage'),
    (r_general_admin, 'leadership', 'manage'),
    (r_general_admin, 'children_ministry', 'manage')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.2 liturgist — Liturgy builder, seasons, prayers,
  --   songs, fixed elements (write); presenter (read)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_liturgist, 'liturgy_builder', 'read'),
    (r_liturgist, 'liturgy_builder', 'write'),
    (r_liturgist, 'liturgy_seasons', 'read'),
    (r_liturgist, 'liturgy_seasons', 'write'),
    (r_liturgist, 'oraciones', 'read'),
    (r_liturgist, 'oraciones', 'write'),
    (r_liturgist, 'canciones', 'read'),
    (r_liturgist, 'canciones', 'write'),
    (r_liturgist, 'elementos_fijos', 'read'),
    (r_liturgist, 'elementos_fijos', 'write'),
    (r_liturgist, 'presenter', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.3 av_volunteer — Presenter, graphics (read/write);
  --   sermon editor (read)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_av_volunteer, 'presenter', 'read'),
    (r_av_volunteer, 'presenter', 'write'),
    (r_av_volunteer, 'graphics', 'read'),
    (r_av_volunteer, 'graphics', 'write'),
    (r_av_volunteer, 'sermon_editor', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.4 worship_coordinator — Songs, presenter (read/write);
  --   liturgy builder (read)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_worship_coordinator, 'canciones', 'read'),
    (r_worship_coordinator, 'canciones', 'write'),
    (r_worship_coordinator, 'presenter', 'read'),
    (r_worship_coordinator, 'presenter', 'write'),
    (r_worship_coordinator, 'liturgy_builder', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.5 comms_volunteer — Graphics only (read/write)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_comms_volunteer, 'graphics', 'read'),
    (r_comms_volunteer, 'graphics', 'write')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.6 mesa_abierta_coordinator — Mesa Abierta (manage)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_mesa_abierta_coordinator, 'mesa_abierta', 'read'),
    (r_mesa_abierta_coordinator, 'mesa_abierta', 'write'),
    (r_mesa_abierta_coordinator, 'mesa_abierta', 'manage')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.7 financial_admin — Financial module (manage)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_financial_admin, 'financial', 'read'),
    (r_financial_admin, 'financial', 'write'),
    (r_financial_admin, 'financial', 'manage')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.8 concilio_member — Financial (read), leadership (read)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_concilio_member, 'financial', 'read'),
    (r_concilio_member, 'leadership', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.9 equipo_pastoral — Financial (read), leadership
  --   (read/write), liturgy builder (read/write)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_equipo_pastoral, 'financial', 'read'),
    (r_equipo_pastoral, 'leadership', 'read'),
    (r_equipo_pastoral, 'leadership', 'write'),
    (r_equipo_pastoral, 'liturgy_builder', 'read'),
    (r_equipo_pastoral, 'liturgy_builder', 'write'),
    (r_equipo_pastoral, 'liturgy_seasons', 'read'),
    (r_equipo_pastoral, 'oraciones', 'read'),
    (r_equipo_pastoral, 'canciones', 'read'),
    (r_equipo_pastoral, 'elementos_fijos', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.10 children_ministry_coordinator — Children (manage)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_children_coordinator, 'children_ministry', 'read'),
    (r_children_coordinator, 'children_ministry', 'write'),
    (r_children_coordinator, 'children_ministry', 'manage')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

  -- ===================================================
  -- 5.11 children_ministry_volunteer — Children (read only)
  -- ===================================================
  INSERT INTO church_permissions (role_id, resource, action) VALUES
    (r_children_volunteer, 'children_ministry', 'read')
  ON CONFLICT (role_id, resource, action) DO NOTHING;

END;
$$;

-- =====================================================
-- 6. BACKWARD COMPATIBILITY MIGRATION
-- Copy existing mesa_abierta_admin_roles users into
-- church_user_roles with general_admin role.
-- This ensures all current admins retain full access.
-- Uses ON CONFLICT DO NOTHING for idempotency.
-- Does NOT modify mesa_abierta_admin_roles or is_mesa_admin().
-- =====================================================

INSERT INTO church_user_roles (user_id, role_id, assigned_by, assigned_at)
SELECT
  mar.user_id,
  (SELECT id FROM church_roles WHERE name = 'general_admin'),
  mar.created_by,
  mar.created_at
FROM mesa_abierta_admin_roles mar
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =====================================================
-- COMPLETION
-- =====================================================

COMMENT ON TABLE church_roles IS 'CASA RBAC: Available roles for the multi-role access system';
COMMENT ON TABLE church_user_roles IS 'CASA RBAC: User-to-role assignments with audit trail';
COMMENT ON TABLE church_permissions IS 'CASA RBAC: Role-to-resource permission grants';
COMMENT ON FUNCTION is_admin(UUID) IS 'CASA RBAC: Check if user has general_admin role (SECURITY DEFINER, RLS-safe)';
COMMENT ON FUNCTION get_user_roles(UUID) IS 'CASA RBAC: Get array of role names for a user (SECURITY DEFINER, RLS-safe)';
COMMENT ON FUNCTION has_permission(UUID, TEXT, TEXT) IS 'CASA RBAC: Check if user has permission on resource (SECURITY DEFINER, RLS-safe)';
COMMENT ON FUNCTION get_users_with_email() IS 'CASA RBAC: Admin-only function to list users with email from auth.users';
