-- =============================================
-- PUBLISHED RESOURCES TABLE
-- Tracks Cuentacuento and Reflexion PDFs published to home page
-- =============================================

-- Create published_resources table
CREATE TABLE IF NOT EXISTS published_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource identification
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('cuentacuento', 'reflexion')),
  liturgy_id UUID,
  liturgy_date DATE NOT NULL,

  -- Content metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Storage
  pdf_url TEXT NOT NULL,
  pdf_filename VARCHAR(255),
  file_size_bytes INTEGER,

  -- Publication tracking
  published_at TIMESTAMPTZ DEFAULT NOW(),
  published_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_published_resources_type ON published_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_published_resources_active ON published_resources(is_active, resource_type);
CREATE INDEX IF NOT EXISTS idx_published_resources_liturgy ON published_resources(liturgy_id);

-- Unique constraint: only one active resource per type
-- This allows one Cuentacuento AND one Reflexion to be active simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_published_resources_active_unique
ON published_resources(resource_type) WHERE is_active = true;

-- Enable RLS
ALTER TABLE published_resources ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active published resources (for home page)
CREATE POLICY "Anyone can read active published resources"
  ON published_resources
  FOR SELECT
  USING (is_active = true);

-- Policy: Admins can read all published resources
CREATE POLICY "Admins can read all published resources"
  ON published_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can insert/update/delete
CREATE POLICY "Admins can manage published resources"
  ON published_resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_published_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER published_resources_updated_at
  BEFORE UPDATE ON published_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_published_resources_updated_at();

-- =============================================
-- STORAGE BUCKET: liturgy-published
-- Public bucket for published PDF resources
-- =============================================

-- Create the bucket for published liturgy resources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'liturgy-published',
  'liturgy-published',
  true,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Anyone can view published liturgy PDFs (public bucket)
CREATE POLICY "Anyone can view published liturgy PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'liturgy-published');

-- Storage policy: Admins can upload published liturgy PDFs
CREATE POLICY "Admins can upload published liturgy PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'liturgy-published'
  AND EXISTS (SELECT 1 FROM mesa_abierta_admin_roles WHERE user_id = auth.uid())
);

-- Storage policy: Admins can update published liturgy PDFs
CREATE POLICY "Admins can update published liturgy PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'liturgy-published'
  AND EXISTS (SELECT 1 FROM mesa_abierta_admin_roles WHERE user_id = auth.uid())
);

-- Storage policy: Admins can delete published liturgy PDFs
CREATE POLICY "Admins can delete published liturgy PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'liturgy-published'
  AND EXISTS (SELECT 1 FROM mesa_abierta_admin_roles WHERE user_id = auth.uid())
);
