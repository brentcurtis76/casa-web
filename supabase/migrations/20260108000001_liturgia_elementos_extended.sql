-- ============================================
-- Migración: Extender tabla liturgia_elementos para persistencia completa
-- Fecha: 2026-01-08
-- Descripción: Agregar campos faltantes para guardar sourceId, status, config, etc.
-- ============================================

-- Agregar columna para ID de la fuente (canción, cuentacuento, etc.)
ALTER TABLE liturgia_elementos ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

-- Agregar columna para estado del elemento
ALTER TABLE liturgia_elementos ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'));

-- Agregar columna para configuración adicional (Story data, announcement configs, etc.)
ALTER TABLE liturgia_elementos ADD COLUMN IF NOT EXISTS config JSONB;

-- Agregar columna para contenido personalizado (oraciones manuales, etc.)
ALTER TABLE liturgia_elementos ADD COLUMN IF NOT EXISTS custom_content TEXT;

-- Agregar columna para slides editados (para elementos fijos modificados)
ALTER TABLE liturgia_elementos ADD COLUMN IF NOT EXISTS edited_slides JSONB;

-- ============================================
-- Comentarios de documentación
-- ============================================

COMMENT ON COLUMN liturgia_elementos.source_id IS 'ID de la fuente: canción, cuentacuento, etc.';
COMMENT ON COLUMN liturgia_elementos.status IS 'Estado del elemento: pending, in_progress, completed, skipped';
COMMENT ON COLUMN liturgia_elementos.config IS 'Configuración adicional en JSON (storyData, announcementConfigs, etc.)';
COMMENT ON COLUMN liturgia_elementos.custom_content IS 'Contenido personalizado para oraciones manuales';
COMMENT ON COLUMN liturgia_elementos.edited_slides IS 'Slides editados para elementos fijos modificados';
