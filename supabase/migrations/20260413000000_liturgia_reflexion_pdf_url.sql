-- Migración: Agregar campo reflexion_pdf_url a tabla liturgias
-- Almacena la URL del PDF original de la reflexión en Supabase Storage
-- para que esté disponible en el paso de exportación (paso 4)

ALTER TABLE liturgias
ADD COLUMN IF NOT EXISTS reflexion_pdf_url TEXT;

COMMENT ON COLUMN liturgias.reflexion_pdf_url IS 'URL pública del PDF original de la reflexión en Supabase Storage. Se usa para publicar la reflexión en la página principal desde el paso de exportación.';
