-- =============================================
-- SITE CONFIGURATION TABLE
-- Stores global site settings like liturgical season
-- =============================================

-- Create site_config table for storing key-value configuration
CREATE TABLE IF NOT EXISTS site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(key);

-- Enable RLS
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read site config (it's public content)
CREATE POLICY "Anyone can read site config"
  ON site_config
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Only admins can modify site config"
  ON site_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW
  EXECUTE FUNCTION update_site_config_updated_at();

-- =============================================
-- INSERT DEFAULT LITURGICAL SEASON CONFIG
-- =============================================

INSERT INTO site_config (key, value, description) VALUES (
  'liturgical_season',
  '{
    "id": "epiphany",
    "name": "Tiempo de Epifanía",
    "scripture": {
      "reference": "Mateo 2:2",
      "text": "Hemos visto su estrella en el oriente y venimos a adorarle"
    },
    "theme": "La luz de Cristo se manifiesta al mundo",
    "accentColor": "#D4A853"
  }'::jsonb,
  'Configuración de la temporada litúrgica actual mostrada en el Hero de la página principal'
) ON CONFLICT (key) DO NOTHING;

-- =============================================
-- PRESET LITURGICAL SEASONS TABLE
-- Pre-configured seasons for easy selection
-- =============================================

CREATE TABLE IF NOT EXISTS liturgical_season_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scripture_reference TEXT NOT NULL,
  scripture_text TEXT NOT NULL,
  theme TEXT NOT NULL,
  accent_color TEXT DEFAULT '#D4A853',
  liturgical_color TEXT, -- Traditional liturgical color name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE liturgical_season_presets ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read presets
CREATE POLICY "Anyone can read presets"
  ON liturgical_season_presets
  FOR SELECT
  USING (true);

-- Policy: Only admins can modify presets
CREATE POLICY "Only admins can modify presets"
  ON liturgical_season_presets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Insert default liturgical season presets
INSERT INTO liturgical_season_presets (id, name, scripture_reference, scripture_text, theme, accent_color, liturgical_color, sort_order) VALUES
  ('advent', 'Adviento', 'Isaías 40:3', 'Preparad el camino del Señor, enderezad sus sendas', 'Un tiempo de espera y esperanza', '#7B5EA7', 'Morado', 1),
  ('christmas', 'Navidad', 'Lucas 2:10-11', 'Os traigo buenas nuevas de gran gozo: os ha nacido un Salvador', 'El Verbo se hizo carne y habitó entre nosotros', '#D4A853', 'Blanco/Oro', 2),
  ('epiphany', 'Tiempo de Epifanía', 'Mateo 2:2', 'Hemos visto su estrella en el oriente y venimos a adorarle', 'La luz de Cristo se manifiesta al mundo', '#D4A853', 'Blanco/Verde', 3),
  ('lent', 'Cuaresma', 'Joel 2:13', 'Rasgad vuestro corazón y no vuestros vestidos, y volved al Señor vuestro Dios', 'Un tiempo de reflexión y conversión', '#7B5EA7', 'Morado', 4),
  ('holy_week', 'Semana Santa', 'Filipenses 2:8', 'Se humilló a sí mismo, haciéndose obediente hasta la muerte, y muerte de cruz', 'Caminamos con Cristo hacia la cruz', '#8B0000', 'Rojo/Morado', 5),
  ('easter', 'Pascua de Resurrección', 'Juan 11:25', 'Yo soy la resurrección y la vida; el que cree en mí, aunque muera, vivirá', 'Cristo ha resucitado, aleluya', '#D4A853', 'Blanco/Oro', 6),
  ('pentecost', 'Pentecostés', 'Hechos 2:4', 'Todos fueron llenos del Espíritu Santo y comenzaron a hablar en otras lenguas', 'El Espíritu Santo desciende sobre la Iglesia', '#C41E3A', 'Rojo', 7),
  ('ordinary', 'Tiempo Ordinario', 'Miqueas 6:8', 'Practicar la justicia, amar la misericordia, y caminar humildemente con tu Dios', 'Crecemos juntos en fe y comunidad', '#2E8B57', 'Verde', 8)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  scripture_reference = EXCLUDED.scripture_reference,
  scripture_text = EXCLUDED.scripture_text,
  theme = EXCLUDED.theme,
  accent_color = EXCLUDED.accent_color,
  liturgical_color = EXCLUDED.liturgical_color,
  sort_order = EXCLUDED.sort_order;

-- =============================================
-- HELPER FUNCTION: Get current liturgical season
-- =============================================

CREATE OR REPLACE FUNCTION get_current_liturgical_season()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT value INTO result
  FROM site_config
  WHERE key = 'liturgical_season';

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;
