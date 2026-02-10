-- ============================================
-- Migración: Sistema de Liturgias Antifonales CASA
-- Fecha: 2026-01-06
-- Descripción: Tablas para almacenar liturgias, lecturas bíblicas y oraciones antifonales
-- ============================================

-- Tabla principal de liturgias
CREATE TABLE IF NOT EXISTS liturgias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  resumen TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por fecha
CREATE INDEX IF NOT EXISTS idx_liturgias_fecha ON liturgias(fecha);

-- Tabla de lecturas bíblicas asociadas a cada liturgia
CREATE TABLE IF NOT EXISTS liturgia_lecturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgia_id UUID REFERENCES liturgias(id) ON DELETE CASCADE,
  cita VARCHAR(100) NOT NULL,        -- Ej: "Juan 3:16-21"
  texto TEXT NOT NULL,                -- Texto completo de la lectura
  version VARCHAR(20) DEFAULT 'NVI', -- NVI, RVR1960, etc.
  orden INT DEFAULT 0,               -- Para ordenar múltiples lecturas
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por liturgia
CREATE INDEX IF NOT EXISTS idx_liturgia_lecturas_liturgia ON liturgia_lecturas(liturgia_id);

-- Tabla de oraciones antifonales
CREATE TABLE IF NOT EXISTS liturgia_oraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgia_id UUID REFERENCES liturgias(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('invocacion', 'arrepentimiento', 'gratitud')),
  tiempos JSONB NOT NULL,             -- Array de {lider: string, congregacion: string}
  aprobada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por liturgia
CREATE INDEX IF NOT EXISTS idx_liturgia_oraciones_liturgia ON liturgia_oraciones(liturgia_id);

-- Constraint único: solo una oración de cada tipo por liturgia
CREATE UNIQUE INDEX IF NOT EXISTS idx_liturgia_oraciones_unique
ON liturgia_oraciones(liturgia_id, tipo);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE liturgias ENABLE ROW LEVEL SECURITY;
ALTER TABLE liturgia_lecturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE liturgia_oraciones ENABLE ROW LEVEL SECURITY;

-- Función helper para verificar si el usuario es admin
-- (Reutiliza la tabla mesa_abierta_admin_roles existente)
CREATE OR REPLACE FUNCTION is_liturgia_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mesa_abierta_admin_roles
    WHERE mesa_abierta_admin_roles.user_id = is_liturgia_admin.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para liturgias
CREATE POLICY "Admins can read all liturgias" ON liturgias
  FOR SELECT USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can insert liturgias" ON liturgias
  FOR INSERT WITH CHECK (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can update liturgias" ON liturgias
  FOR UPDATE USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can delete liturgias" ON liturgias
  FOR DELETE USING (is_liturgia_admin(auth.uid()));

-- Políticas para liturgia_lecturas
CREATE POLICY "Admins can read all lecturas" ON liturgia_lecturas
  FOR SELECT USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can insert lecturas" ON liturgia_lecturas
  FOR INSERT WITH CHECK (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can update lecturas" ON liturgia_lecturas
  FOR UPDATE USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can delete lecturas" ON liturgia_lecturas
  FOR DELETE USING (is_liturgia_admin(auth.uid()));

-- Políticas para liturgia_oraciones
CREATE POLICY "Admins can read all oraciones" ON liturgia_oraciones
  FOR SELECT USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can insert oraciones" ON liturgia_oraciones
  FOR INSERT WITH CHECK (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can update oraciones" ON liturgia_oraciones
  FOR UPDATE USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can delete oraciones" ON liturgia_oraciones
  FOR DELETE USING (is_liturgia_admin(auth.uid()));

-- ============================================
-- Trigger para updated_at automático
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_liturgias_updated_at
  BEFORE UPDATE ON liturgias
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liturgia_oraciones_updated_at
  BEFORE UPDATE ON liturgia_oraciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comentarios de documentación
-- ============================================

COMMENT ON TABLE liturgias IS 'Liturgias dominicales con título, fecha y resumen';
COMMENT ON TABLE liturgia_lecturas IS 'Lecturas bíblicas asociadas a cada liturgia';
COMMENT ON TABLE liturgia_oraciones IS 'Oraciones antifonales generadas (invocación, arrepentimiento, gratitud)';
COMMENT ON COLUMN liturgia_oraciones.tiempos IS 'JSON array: [{lider: string, congregacion: string}, ...]';
