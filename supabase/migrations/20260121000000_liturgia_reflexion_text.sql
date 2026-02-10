-- Migración: Agregar campo reflexion_texto a tabla liturgias
-- Fecha: 2026-01-21
-- Descripción: Permite almacenar el texto extraído del PDF de reflexión
--              para enriquecer el contexto de generación de oraciones y cuentos

-- Agregar columna para el texto de la reflexión
ALTER TABLE liturgias
ADD COLUMN IF NOT EXISTS reflexion_texto TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN liturgias.reflexion_texto IS 'Texto completo extraído del PDF de reflexión del predicador. Se usa para enriquecer el contexto de generación de oraciones y cuentos.';
