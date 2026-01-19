-- Graphics Batches for CASA Graphics Generator V2
-- Migration: 20260105_graphics_batches.sql
-- Stores saved batches of generated graphics (4 formats per batch)

-- Enum for output formats (matching GraphicsGeneratorV2 format types)
DO $$ BEGIN
  CREATE TYPE graphics_format_v2 AS ENUM (
    'ppt_4_3',
    'instagram_post',
    'instagram_story',
    'facebook_post'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for event types
DO $$ BEGIN
  CREATE TYPE graphics_event_type AS ENUM (
    'mesa_abierta',
    'culto_dominical',
    'estudio_biblico',
    'retiro',
    'navidad',
    'cuaresma',
    'pascua',
    'bautismo',
    'comunidad',
    'musica',
    'oracion',
    'generic'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Graphics batches table - stores a set of 4 formats generated together
CREATE TABLE IF NOT EXISTS casa_graphics_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type graphics_event_type NOT NULL DEFAULT 'generic',
  event_date TEXT,
  event_time TEXT,
  event_location TEXT,
  illustration_base64 TEXT, -- The selected illustration (stored for reference)
  prompt_used TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Individual graphics within a batch
CREATE TABLE IF NOT EXISTS casa_graphics_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES casa_graphics_batches(id) ON DELETE CASCADE NOT NULL,
  format graphics_format_v2 NOT NULL,
  title TEXT NOT NULL, -- Per-format title (may have different line breaks)
  image_url TEXT NOT NULL, -- URL in Supabase Storage
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_graphics_batches_created_by ON casa_graphics_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_graphics_batches_created_at ON casa_graphics_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graphics_batches_event_type ON casa_graphics_batches(event_type);
CREATE INDEX IF NOT EXISTS idx_graphics_items_batch_id ON casa_graphics_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_graphics_items_format ON casa_graphics_items(format);

-- Enable RLS
ALTER TABLE casa_graphics_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE casa_graphics_items ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can manage, authenticated users can view
CREATE POLICY "Admins can manage graphics batches" ON casa_graphics_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'coordinator')
    )
  );

CREATE POLICY "Authenticated users can view graphics batches" ON casa_graphics_batches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage graphics items" ON casa_graphics_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'coordinator')
    )
  );

CREATE POLICY "Authenticated users can view graphics items" ON casa_graphics_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Storage bucket for graphics (if not exists)
-- Note: Run this in Supabase dashboard if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('casa-graphics', 'casa-graphics', true)
-- ON CONFLICT (id) DO NOTHING;
