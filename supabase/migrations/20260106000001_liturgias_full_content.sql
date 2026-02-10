-- ============================================
-- Migración: Extender sistema de liturgias para Constructor Completo
-- Fecha: 2026-01-06
-- Descripción: Agregar campos para almacenar contenido completo de liturgias
-- ============================================

-- Agregar columnas para almacenar el contenido completo
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS celebrante VARCHAR(255);
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS predicador VARCHAR(255);
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'borrador'
  CHECK (estado IN ('borrador', 'en-progreso', 'listo', 'archivado'));
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS porcentaje_completado INT DEFAULT 0;
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS portada_imagen_url TEXT;

-- Tabla para almacenar los elementos de la liturgia
CREATE TABLE IF NOT EXISTS liturgia_elementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgia_id UUID REFERENCES liturgias(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  orden INT NOT NULL,
  titulo VARCHAR(255),
  slides JSONB,  -- SlideGroup completo en JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsqueda por liturgia
CREATE INDEX IF NOT EXISTS idx_liturgia_elementos_liturgia ON liturgia_elementos(liturgia_id);

-- Constraint único: solo un elemento de cada tipo por liturgia
CREATE UNIQUE INDEX IF NOT EXISTS idx_liturgia_elementos_unique
ON liturgia_elementos(liturgia_id, tipo);

-- Habilitar RLS
ALTER TABLE liturgia_elementos ENABLE ROW LEVEL SECURITY;

-- Políticas para liturgia_elementos (usando la función existente is_liturgia_admin)
CREATE POLICY "Admins can read all elementos" ON liturgia_elementos
  FOR SELECT USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can insert elementos" ON liturgia_elementos
  FOR INSERT WITH CHECK (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can update elementos" ON liturgia_elementos
  FOR UPDATE USING (is_liturgia_admin(auth.uid()));

CREATE POLICY "Admins can delete elementos" ON liturgia_elementos
  FOR DELETE USING (is_liturgia_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_liturgia_elementos_updated_at
  BEFORE UPDATE ON liturgia_elementos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comentarios de documentación
-- ============================================

COMMENT ON COLUMN liturgias.celebrante IS 'Nombre del celebrante de la liturgia';
COMMENT ON COLUMN liturgias.predicador IS 'Nombre del predicador';
COMMENT ON COLUMN liturgias.estado IS 'Estado de la liturgia: borrador, en-progreso, listo, archivado';
COMMENT ON COLUMN liturgias.porcentaje_completado IS 'Porcentaje de elementos completados (0-100)';
COMMENT ON TABLE liturgia_elementos IS 'Elementos individuales de cada liturgia (portadas, oraciones, himnos, etc.)';
COMMENT ON COLUMN liturgia_elementos.slides IS 'Contenido de slides en formato JSON (SlideGroup)';
