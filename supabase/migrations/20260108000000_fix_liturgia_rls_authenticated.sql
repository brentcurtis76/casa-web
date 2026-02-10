-- ============================================
-- Migración: Corregir RLS de liturgias para usuarios autenticados
-- Fecha: 2026-01-08
-- Problema: Solo admins pueden guardar liturgias
-- Solución: Permitir que cualquier usuario autenticado maneje sus propias liturgias
-- ============================================

-- Eliminar políticas antiguas basadas en admin
DROP POLICY IF EXISTS "Admins can read all liturgias" ON liturgias;
DROP POLICY IF EXISTS "Admins can insert liturgias" ON liturgias;
DROP POLICY IF EXISTS "Admins can update liturgias" ON liturgias;
DROP POLICY IF EXISTS "Admins can delete liturgias" ON liturgias;

-- Nuevas políticas para liturgias: cualquier usuario autenticado puede manejar sus propias liturgias
CREATE POLICY "Users can read own liturgias" ON liturgias
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own liturgias" ON liturgias
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own liturgias" ON liturgias
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own liturgias" ON liturgias
  FOR DELETE USING (auth.uid() = created_by);

-- Admins también pueden ver todas las liturgias (para panel de admin)
CREATE POLICY "Admins can read all liturgias" ON liturgias
  FOR SELECT USING (is_liturgia_admin(auth.uid()));

-- ============================================
-- Políticas para liturgia_elementos
-- ============================================

DROP POLICY IF EXISTS "Admins can read all elementos" ON liturgia_elementos;
DROP POLICY IF EXISTS "Admins can insert elementos" ON liturgia_elementos;
DROP POLICY IF EXISTS "Admins can update elementos" ON liturgia_elementos;
DROP POLICY IF EXISTS "Admins can delete elementos" ON liturgia_elementos;

-- Usuarios pueden manejar elementos de sus propias liturgias
CREATE POLICY "Users can read own liturgia elementos" ON liturgia_elementos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_elementos.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own liturgia elementos" ON liturgia_elementos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_elementos.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own liturgia elementos" ON liturgia_elementos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_elementos.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own liturgia elementos" ON liturgia_elementos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_elementos.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

-- ============================================
-- Políticas para liturgia_lecturas
-- ============================================

DROP POLICY IF EXISTS "Admins can read all lecturas" ON liturgia_lecturas;
DROP POLICY IF EXISTS "Admins can insert lecturas" ON liturgia_lecturas;
DROP POLICY IF EXISTS "Admins can update lecturas" ON liturgia_lecturas;
DROP POLICY IF EXISTS "Admins can delete lecturas" ON liturgia_lecturas;

CREATE POLICY "Users can read own liturgia lecturas" ON liturgia_lecturas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_lecturas.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own liturgia lecturas" ON liturgia_lecturas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_lecturas.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own liturgia lecturas" ON liturgia_lecturas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_lecturas.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own liturgia lecturas" ON liturgia_lecturas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_lecturas.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

-- ============================================
-- Políticas para liturgia_oraciones (si existe)
-- ============================================

DROP POLICY IF EXISTS "Admins can read all oraciones" ON liturgia_oraciones;
DROP POLICY IF EXISTS "Admins can insert oraciones" ON liturgia_oraciones;
DROP POLICY IF EXISTS "Admins can update oraciones" ON liturgia_oraciones;
DROP POLICY IF EXISTS "Admins can delete oraciones" ON liturgia_oraciones;

CREATE POLICY "Users can read own liturgia oraciones" ON liturgia_oraciones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_oraciones.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own liturgia oraciones" ON liturgia_oraciones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_oraciones.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own liturgia oraciones" ON liturgia_oraciones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_oraciones.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own liturgia oraciones" ON liturgia_oraciones
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM liturgias
      WHERE liturgias.id = liturgia_oraciones.liturgia_id
      AND liturgias.created_by = auth.uid()
    )
  );

-- ============================================
-- Verificación
-- ============================================
SELECT 'RLS policies updated successfully - authenticated users can now manage their own liturgies' AS status;
