-- ============================================
-- Migración: Agregar configuración de portadas
-- Fecha: 2026-01-06
-- Descripción: Agregar campo JSONB para almacenar configuración de portadas
--              (alineación del logo, texto, escala y posición de ilustración)
-- ============================================

-- Agregar columna para configuración de portadas
ALTER TABLE liturgias ADD COLUMN IF NOT EXISTS portadas_config JSONB;

-- Comentario de documentación
COMMENT ON COLUMN liturgias.portadas_config IS 'Configuración de portadas: illustrationConfig (opacity, scale, positionX, positionY), logoAlignment, textAlignment';
