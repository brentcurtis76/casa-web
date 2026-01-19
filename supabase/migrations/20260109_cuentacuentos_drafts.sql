-- ============================================
-- Migración: Sistema de borradores para Cuentacuentos
-- Fecha: 2026-01-09
-- Descripción: Tabla y storage para guardar progreso de cuentos en creación
-- ============================================

-- Tabla para almacenar borradores de cuentos en progreso
CREATE TABLE IF NOT EXISTS cuentacuentos_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgia_id UUID REFERENCES liturgias(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Estado del flujo
  current_step VARCHAR(20) NOT NULL DEFAULT 'config'
    CHECK (current_step IN ('config', 'story', 'characters', 'scenes', 'cover', 'complete')),

  -- Configuración inicial
  config JSONB DEFAULT '{}'::jsonb,

  -- Cuento generado (texto, personajes, escenas - sin imágenes base64)
  story JSONB,

  -- Selecciones del usuario (índices de las opciones elegidas)
  selected_character_sheets JSONB DEFAULT '{}'::jsonb,
  selected_scene_images JSONB DEFAULT '{}'::jsonb,
  selected_cover INT,
  selected_end INT,

  -- Paths de imágenes en Storage
  image_paths JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Solo un draft por liturgia por usuario
  UNIQUE(liturgia_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cuentacuentos_drafts_liturgia ON cuentacuentos_drafts(liturgia_id);
CREATE INDEX IF NOT EXISTS idx_cuentacuentos_drafts_user ON cuentacuentos_drafts(user_id);

-- Habilitar RLS
ALTER TABLE cuentacuentos_drafts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - usuarios solo ven sus propios drafts
CREATE POLICY "Users can read own drafts" ON cuentacuentos_drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts" ON cuentacuentos_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts" ON cuentacuentos_drafts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts" ON cuentacuentos_drafts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_cuentacuentos_drafts_updated_at
  BEFORE UPDATE ON cuentacuentos_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Storage bucket para imágenes de drafts
-- ============================================

-- Crear bucket para imágenes de cuentacuentos (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cuentacuentos-drafts',
  'cuentacuentos-drafts',
  false,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Users can upload draft images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cuentacuentos-drafts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own draft images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cuentacuentos-drafts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own draft images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cuentacuentos-drafts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own draft images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cuentacuentos-drafts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- Comentarios
-- ============================================
COMMENT ON TABLE cuentacuentos_drafts IS 'Borradores de cuentos en progreso para el módulo Cuentacuentos';
COMMENT ON COLUMN cuentacuentos_drafts.current_step IS 'Paso actual del flujo de creación';
COMMENT ON COLUMN cuentacuentos_drafts.config IS 'Configuración inicial (lugar, personajes, estilo)';
COMMENT ON COLUMN cuentacuentos_drafts.story IS 'Cuento generado (texto, sin imágenes base64)';
COMMENT ON COLUMN cuentacuentos_drafts.selected_character_sheets IS 'Índices de character sheets seleccionados';
COMMENT ON COLUMN cuentacuentos_drafts.selected_scene_images IS 'Índices de imágenes de escenas seleccionadas';
