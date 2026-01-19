-- Graphics Themes table for customizable illustration patterns
-- Allows admins to create, edit, and delete themes for the graphics generator

CREATE TABLE IF NOT EXISTS graphics_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- Unique identifier for the theme (e.g., 'christmas', 'custom_theme_1')
  label TEXT NOT NULL, -- Display name (e.g., 'Navidad / Celebraciones')
  description TEXT, -- Short description of the theme
  icon TEXT DEFAULT 'Palette', -- Lucide icon name
  elements TEXT[] NOT NULL, -- Array of illustration element descriptions
  is_default BOOLEAN DEFAULT FALSE, -- True for built-in themes that can't be deleted
  is_active BOOLEAN DEFAULT TRUE, -- Allows disabling themes without deleting
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE graphics_themes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read active themes
CREATE POLICY "Anyone can read active themes"
  ON graphics_themes
  FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can insert themes
CREATE POLICY "Admins can insert themes"
  ON graphics_themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can update themes
CREATE POLICY "Admins can update themes"
  ON graphics_themes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can delete non-default themes
CREATE POLICY "Admins can delete non-default themes"
  ON graphics_themes
  FOR DELETE
  USING (
    is_default = false AND
    EXISTS (
      SELECT 1 FROM mesa_abierta_admin_roles
      WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_graphics_themes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER graphics_themes_updated_at
  BEFORE UPDATE ON graphics_themes
  FOR EACH ROW
  EXECUTE FUNCTION update_graphics_themes_updated_at();

-- Insert default themes
INSERT INTO graphics_themes (key, label, description, icon, elements, is_default) VALUES
  ('christmas', 'Navidad / Celebraciones', 'Ornamentos, velas, coronas, ángeles y estrellas', 'TreePine',
   ARRAY['hand-drawn Christmas ornaments and baubles', 'delicate candle illustrations with flames', 'simple wreaths with ribbon bows', 'angel silhouettes with wings', 'star patterns and snowflakes', 'pine branches and holly leaves', 'gift boxes with ribbons', 'stockings and bells'],
   true),
  ('food_community', 'Comida / Comunidad', 'Ollas, platos, manos y elementos de mesa', 'Utensils',
   ARRAY['simple pot and pan outlines', 'plates and utensil sketches', 'hands sharing food', 'table gathering symbols', 'bread and wine motifs', 'coffee cups and bowls', 'serving spoons and ladles', 'grocery bags and baskets'],
   true),
  ('worship', 'Adoración / Liturgia', 'Velas, cruces, palomas y elementos sagrados', 'Church',
   ARRAY['simple candle illustrations', 'cross outlines in various styles', 'dove silhouettes', 'sacred geometry patterns', 'flame motifs', 'chalice and communion symbols', 'open book illustrations', 'praying hands sketches'],
   true),
  ('general', 'General / Botánico', 'Elementos botánicos y formas abstractas', 'Leaf',
   ARRAY['botanical line drawings of leaves', 'abstract community circle shapes', 'connecting dots and lines', 'leaf and branch patterns', 'organic flowing curves', 'simple flower outlines', 'geometric shapes', 'wave and ripple patterns'],
   true),
  ('children', 'Niños', 'Elementos infantiles, juguetes y diversión', 'Baby',
   ARRAY['simple toy illustrations (blocks, balls, teddy bears)', 'balloon outlines floating', 'star and moon doodles', 'crayon-style scribbles and swirls', 'simple animal faces (cats, dogs, birds)', 'rainbow arcs and clouds', 'paper airplane sketches', 'lollipop and candy outlines', 'hand-drawn smiley faces', 'kite illustrations with tails'],
   true),
  ('teens', 'Adolescentes', 'Elementos juveniles, música y tecnología', 'Headphones',
   ARRAY['headphone and music note illustrations', 'smartphone and chat bubble outlines', 'skateboard and sneaker sketches', 'lightning bolt and star doodles', 'game controller outlines', 'microphone illustrations', 'speech bubble patterns', 'hashtag and @ symbols', 'camera and photo frame sketches', 'guitar and drum stick outlines'],
   true),
  ('seniors', 'Adultos Mayores', 'Elementos tranquilos, tradicionales y acogedores', 'Heart',
   ARRAY['teacup and saucer illustrations', 'rocking chair outlines', 'classic book and reading glasses sketches', 'vintage clock faces', 'knitting needles and yarn balls', 'chess pieces and board game elements', 'photo frame and memory album outlines', 'garden flower and watering can sketches', 'walking cane with elegant curve', 'classic lamp and comfortable chair silhouettes'],
   true),
  ('community', 'Comunidad', 'Personas unidas, conexión y colaboración', 'Users',
   ARRAY['hands joining together in circle', 'group of people silhouettes', 'heart shapes connected by lines', 'chain link patterns', 'house and home outlines', 'bridge illustrations connecting', 'tree with multiple branches', 'puzzle pieces fitting together', 'speech bubbles in conversation', 'handshake illustrations'],
   true),
  ('sports', 'Deporte', 'Actividad física, juegos y movimiento', 'Dumbbell',
   ARRAY['soccer ball and goal outlines', 'basketball and hoop sketches', 'running figure silhouettes', 'tennis racket and ball', 'swimming wave patterns', 'bicycle illustrations', 'jumping and stretching figures', 'medal and trophy outlines', 'whistle and stopwatch sketches', 'water bottle and towel illustrations'],
   true),
  ('service', 'Servicio Comunitario', 'Voluntariado, ayuda y solidaridad', 'HandHeart',
   ARRAY['helping hands reaching out', 'heart in hands illustrations', 'donation box outlines', 'broom and cleaning tool sketches', 'hammer and tool belt illustrations', 'grocery bag being shared', 'blanket and clothing donations', 'bandage and first aid symbols', 'garden shovel and plant', 'paintbrush and roller for community projects'],
   true),
  ('garage_sale', 'Venta de Garage', 'Artículos, etiquetas de precio y tesoros', 'Tag',
   ARRAY['price tag illustrations with strings', 'cardboard box outlines overflowing', 'vintage lamp and furniture sketches', 'clothing on hangers', 'book stacks and records', 'toy and stuffed animal outlines', 'picture frame collections', 'dish and kitchenware illustrations', 'shoe and accessory sketches', 'cash register and coins'],
   true);
