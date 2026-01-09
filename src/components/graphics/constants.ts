// CASA Brand Constants for Graphics Generator

// Color descriptions for AI prompts (not hex codes - AI interprets these)
export const CASA_COLORS = {
  primary: {
    black: "deep charcoal black, rich black (#1A1A1A equivalent)",
    amber: "warm amber gold, burnished amber, antique gold (#D4A853 equivalent)",
    white: "warm ivory, soft cream white, warm off-white (#F7F7F7 equivalent)"
  },
  secondary: {
    charcoal: "charcoal gray (#333333 equivalent)",
    darkGray: "dark warm gray (#555555 equivalent)",
    mediumGray: "stone gray, taupe gray (#8A8A8A equivalent)",
    lightGray: "light warm gray (#E5E5E5 equivalent)"
  },
  amberVariations: {
    light: "light amber gold (#E8C97A equivalent)",
    main: "warm amber gold (#D4A853 equivalent)",
    dark: "deep burnished amber (#B8923D equivalent)"
  }
} as const;

// Typography descriptions for AI prompts
export const CASA_TYPOGRAPHY = {
  titles: "elegant serif lettering, classic refined serif typography (Merriweather style)",
  body: "clean modern sans-serif, minimal readable sans-serif (Montserrat style)",
  style: "light weight with generous letter spacing"
} as const;

// Brand personality keywords
export const CASA_PERSONALITY = [
  "warm", "welcoming", "authentic", "progressive",
  "contemplative", "inclusive", "hopeful", "community-focused"
] as const;

// Visual style guidelines
export const CASA_VISUAL_STYLE = {
  corners: "rounded corners (4-20px depending on element)",
  spacing: "ample white space, breathing room",
  photography: "warm authentic community moments, soft natural lighting",
  composition: "asymmetric with overlapping elements, organic flow",
  mood: "inviting, serene, hopeful"
} as const;

// Output formats with dimensions
export const OUTPUT_FORMATS = {
  instagram_feed: {
    ratio: "1:1",
    width: 1080,
    height: 1080,
    label: "Instagram Feed",
    geminiRatio: "1:1"
  },
  instagram_portrait: {
    ratio: "4:5",
    width: 1080,
    height: 1350,
    label: "Instagram Retrato",
    geminiRatio: "3:4" // Closest supported ratio
  },
  instagram_story: {
    ratio: "9:16",
    width: 1080,
    height: 1920,
    label: "Instagram/WhatsApp Story",
    geminiRatio: "9:16"
  },
  facebook_post: {
    ratio: "16:9",
    width: 1200,
    height: 675,
    label: "Facebook Post",
    geminiRatio: "16:9"
  },
  powerpoint_16_9: {
    ratio: "16:9",
    width: 1920,
    height: 1080,
    label: "PowerPoint 16:9",
    geminiRatio: "16:9"
  },
  powerpoint_4_3: {
    ratio: "4:3",
    width: 1024,
    height: 768,
    label: "PowerPoint 4:3",
    geminiRatio: "4:3"
  },
  poster_vertical: {
    ratio: "3:4",
    width: 1200,
    height: 1600,
    label: "Poster Vertical",
    geminiRatio: "3:4"
  },
  web_banner: {
    ratio: "21:9",
    width: 2100,
    height: 900,
    label: "Banner Web Ultra-ancho",
    geminiRatio: "16:9" // Will need cropping
  }
} as const;

export type OutputFormat = keyof typeof OUTPUT_FORMATS;

// Category templates for different types of graphics
export const PROMPT_TEMPLATES = {
  general_announcement: {
    label: "Anuncio General",
    description: "Gráficos para anuncios y comunicaciones generales",
    basePrompt: `Editorial-style announcement graphic with quiet sophistication.

VISUAL APPROACH:
- Soft, diffused natural light washing across the composition
- A single elegant botanical element (olive branch, eucalyptus sprig, or wheat stalk) positioned asymmetrically, rendered in muted sage green or warm gray tones
- Subtle paper texture or linen-like grain for tactile warmth
- Gentle shadow play creating depth without heaviness

COMPOSITION:
- Rule of thirds placement with intentional negative space
- Element anchored to one corner or edge, leaving generous breathing room
- Soft cream (#F7F7F7) dominates with warm undertones
- One thin amber accent line (hairline weight) as a sophisticated divider or frame edge`,
    placeholders: [
      { key: "event_name", label: "Nombre del evento (opcional)", required: false },
      { key: "mood_modifier", label: "Ambiente/estado de ánimo", required: false }
    ]
  },

  assembly: {
    label: "Asamblea / Reunión",
    description: "Imágenes para reuniones comunitarias y asambleas",
    basePrompt: `Clean, professional gathering announcement with warmth.

VISUAL APPROACH:
- Abstract suggestion of community: soft overlapping circular forms in translucent warm grays
- Or: aerial view of a minimal wooden table corner with soft shadows
- Warm, golden-hour lighting quality (soft, not harsh)
- Subtle texture: fine linen or handmade paper quality

COMPOSITION:
- Geometric simplicity with organic softness
- Asymmetric balance - visual weight in lower third or corner
- Abundant cream/ivory space for text
- Single amber element: a thin rule, small dot, or subtle glow at focal point`,
    placeholders: [
      { key: "specific_focus", label: "Enfoque específico", required: false }
    ]
  },

  worship_service: {
    label: "Servicio de Adoración",
    description: "Gráficos para servicios dominicales y liturgia",
    basePrompt: `Contemplative, luminous worship graphic with reverent beauty.

VISUAL APPROACH:
- Ethereal light: soft rays filtering through, suggesting dawn or candlelight
- Minimal sacred geometry: a single graceful arch form, or gentle curve suggesting sacred space
- Soft atmospheric depth - like morning mist or incense haze
- Natural elements: a single dried flower, delicate fern frond, or smooth stone

COMPOSITION:
- Vertical flow suggesting transcendence
- Light source from upper portion creating gentle gradient
- Colors: warm ivory base, soft charcoal shadows, whisper of amber in the light
- Peaceful emptiness as a design element itself`,
    placeholders: [
      { key: "service_type", label: "Tipo de servicio", required: false },
      { key: "seasonal_element", label: "Elemento de temporada", required: false }
    ]
  },

  calendar_event: {
    label: "Evento del Calendario",
    description: "Diseños elegantes para eventos programados",
    basePrompt: `Sophisticated event card with editorial sensibility.

VISUAL APPROACH:
- Clean geometric forms: a subtle grid, elegant frame fragment, or architectural detail
- Lifestyle photography aesthetic: perhaps a corner of a journal, coffee cup edge, or fabric fold - all blurred and abstract
- Refined materiality: hints of natural materials (wood grain, marble veining, ceramic glaze) rendered softly
- Controlled color story: cream, warm gray, with amber as the precious accent

COMPOSITION:
- Magazine-layout elegance with intentional white space
- One strong visual anchor (corner, edge, or center) with everything else receding
- Typography-friendly zones clearly defined by the composition
- Subtle layering creating depth without complexity`,
    placeholders: [
      { key: "event_type", label: "Tipo de evento", required: false },
      { key: "time_of_year", label: "Época del año", required: false }
    ]
  },

  book_club: {
    label: "Club de Lectura",
    description: "Imágenes acogedoras para grupos de estudio",
    basePrompt: `Warm, intellectual atmosphere for reading gatherings.

VISUAL APPROACH:
- Evocative still life elements: edge of an open book, reading glasses shadow, or coffee steam wisps
- Rich but muted: deep charcoal shadows, warm cream light, amber glow as if from a lamp
- Textural richness: aged paper, soft wool, worn leather - suggested, not literal
- Intimate scale and warmth

COMPOSITION:
- Cozy corner aesthetic - visual weight in one area creating intimacy
- Soft focus and gentle vignetting
- Layered depth: foreground blur, focused middle, soft background
- Amber accent as warm light source or subtle highlight on an edge`,
    placeholders: [
      { key: "book_theme", label: "Tema del libro/discusión", required: false }
    ]
  },

  support_group: {
    label: "Grupo de Apoyo",
    description: "Gráficos sensibles para grupos de apoyo y cuidado pastoral",
    basePrompt: `Gentle, embracing design conveying safety and care.

VISUAL APPROACH:
- Soft, enveloping forms: gentle curves, cradling shapes, or nest-like compositions
- Healing natural elements: smooth river stones, soft moss texture, or gentle water ripple
- Warm, diffused light suggesting comfort and safety
- Tactile softness: cotton, clouds, or petals - abstracted into pure form

COMPOSITION:
- Centered or symmetrical for stability and calm
- Soft gradients from warm center to quiet edges
- No sharp angles or harsh contrasts
- Colors: soft warm whites, gentle grays, amber as a distant warm glow
- Maximum gentleness in every element`,
    placeholders: [
      { key: "group_focus", label: "Enfoque del grupo", required: false }
    ]
  },

  seasonal: {
    label: "Temporada Litúrgica",
    description: "Imágenes para las diferentes temporadas del año litúrgico",
    basePrompt: `Evocative liturgical season imagery with symbolic depth.

VISUAL APPROACH by season:
- Advent: Deep blue-gray twilight, single star or candle glow, anticipatory stillness
- Christmas: Warm golden light, evergreen sprig, gentle celebration
- Epiphany: Dawn light breaking, subtle radiance, journey suggested
- Lent: Muted earth tones, bare branch, contemplative shadows, desert simplicity
- Holy Week: Deep charcoal and amber, single thorn or nail shadow, profound quiet
- Easter: Soft morning light, white lily petal or empty space, joyful restraint
- Pentecost: Warm amber and soft red tones, gentle flame suggestion, movement in stillness
- Ordinary Time: Green growth, simple leaf or grass blade, peaceful continuity

COMPOSITION:
- Single powerful symbol, abstracted and elegant
- Generous negative space honoring the sacred
- Light as theology - direction and quality convey meaning
- Avoid literal or heavy-handed religious imagery`,
    placeholders: [
      { key: "season", label: "Temporada", required: true, options: [
        "Adviento", "Navidad", "Epifanía", "Cuaresma", "Semana Santa",
        "Pascua", "Pentecostés", "Tiempo Ordinario"
      ]},
      { key: "specific_symbols", label: "Símbolos específicos", required: false }
    ]
  },

  social_devotional: {
    label: "Devocional para RRSS",
    description: "Fondos contemplativos para citas y reflexiones",
    basePrompt: `Meditative background for scripture and reflection quotes.

VISUAL APPROACH:
- Abstract natural textures: watercolor wash, cloud formation, water surface, sand ripple
- Soft atmospheric photography: blurred landscape, bokeh light, gentle sky gradient
- Subtle paper or canvas texture for tactile warmth
- Whisper-quiet visual interest that supports rather than competes with text

COMPOSITION:
- Even, calm distribution - no strong focal points to compete with text
- Soft gradient or subtle texture variation for visual interest
- Central area kept especially quiet for text placement
- Colors: cream to soft warm gray gradient, with amber only as the faintest warm glow
- Think: the visual equivalent of silence`,
    placeholders: [
      { key: "theme", label: "Tema", required: false },
      { key: "scripture_mood", label: "Ambiente de la escritura", required: false }
    ]
  },

  special_event: {
    label: "Evento Especial",
    description: "Gráficos para celebraciones y eventos destacados",
    basePrompt: `Elevated celebration graphic with restrained festivity.

VISUAL APPROACH:
- Sophisticated party elements: champagne bubble suggestion, confetti abstracted into geometric dots, ribbon curve
- Rich materials: gold leaf texture (subtle), silk sheen, crystal refraction - all rendered with restraint
- Celebration through light: sparkle, glow, and shimmer rather than loud decoration
- Joyful but never garish

COMPOSITION:
- Dynamic asymmetry suggesting movement and celebration
- One area of visual richness balanced by generous empty space
- Amber/gold more present here but still elegant: perhaps 10-15% of composition
- Layer of subtle sparkle or light play
- Festive energy contained within sophisticated framework`,
    placeholders: [
      { key: "event_name", label: "Nombre del evento", required: true },
      { key: "special_elements", label: "Elementos especiales", required: false }
    ]
  }
} as const;

export type PromptCategory = keyof typeof PROMPT_TEMPLATES;

// Build the full prompt for Gemini
export function buildPrompt(
  category: PromptCategory,
  placeholders: Record<string, string>,
  customModifier?: string
): string {
  const template = PROMPT_TEMPLATES[category];

  let prompt = `Create an elegant, modern graphic design for a progressive church community.

DESIGN PHILOSOPHY:
Think Kinfolk magazine meets sacred space. Quiet luxury. Intentional beauty. Every element earns its place.

AESTHETIC DIRECTION:
- Editorial sophistication with spiritual warmth
- Natural materials and organic forms over geometric patterns
- Light as the primary design element - soft, directional, meaningful
- Texture and depth through photography-inspired techniques (bokeh, soft focus, atmospheric perspective)
- Color through restraint: cream/ivory dominates (70-80%), warm grays provide structure, amber/gold is the precious accent (5-15%)

WHAT TO AVOID:
- Clip art aesthetic or stock photo clichés
- Heavy ornate borders, art deco patterns, or decorative flourishes
- Bright saturated colors or high contrast
- Busy compositions or competing focal points
- Generic "church graphic" templates

COLOR PALETTE:
- Foundation: Warm cream (#F7F7F7) and soft ivory
- Structure: Warm grays from light (#E5E5E5) to charcoal (#333333)
- Accent: Muted amber/gold (#D4A853) - used like a jewel, not like paint
- Nature tones welcome: sage green, dusty rose, warm taupe - always muted

SPECIFIC DIRECTION FOR THIS GRAPHIC:
${template.basePrompt}`;

  // Add placeholder values
  const filledPlaceholders = Object.entries(placeholders)
    .filter(([_, value]) => value && value.trim())
    .map(([key, value]) => {
      const placeholder = template.placeholders.find(p => p.key === key);
      return `${placeholder?.label || key}: ${value}`;
    });

  if (filledPlaceholders.length > 0) {
    prompt += `\n\n${filledPlaceholders.join('\n')}`;
  }

  // Add custom modifier
  if (customModifier && customModifier.trim()) {
    prompt += `\n\nAdditional details: ${customModifier}`;
  }

  // Final instruction
  prompt += `\n\nImportant: Leave clear space for text overlay. Do not include any text in the image.`;

  return prompt;
}

// Types for the graphics system
export interface GeneratedImage {
  id: string;
  format: OutputFormat;
  aspectRatio: string;
  base64?: string;
  url?: string;
  prompt: string;
  generatedAt: Date;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface GenerationSession {
  id: string;
  category: PromptCategory;
  placeholders: Record<string, string>;
  customModifier?: string;
  formats: OutputFormat[];
  images: GeneratedImage[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
}

// ============================================
// NEW: Illustration Pattern System
// ============================================

// Illustration pattern themes for template-based graphics
export const ILLUSTRATION_PATTERNS = {
  christmas: {
    label: "Navidad / Celebraciones",
    description: "Ornamentos, velas, coronas, ángeles y estrellas",
    elements: [
      "hand-drawn Christmas ornaments and baubles",
      "delicate candle illustrations with flames",
      "simple wreaths with ribbon bows",
      "angel silhouettes with wings",
      "star patterns and snowflakes",
      "pine branches and holly leaves",
      "gift boxes with ribbons",
      "stockings and bells"
    ]
  },
  food_community: {
    label: "Comida / Comunidad",
    description: "Ollas, platos, manos y elementos de mesa",
    elements: [
      "simple pot and pan outlines",
      "plates and utensil sketches",
      "hands sharing food",
      "table gathering symbols",
      "bread and wine motifs",
      "coffee cups and bowls",
      "serving spoons and ladles",
      "grocery bags and baskets"
    ]
  },
  worship: {
    label: "Adoración / Liturgia",
    description: "Velas, cruces, palomas y elementos sagrados",
    elements: [
      "simple candle illustrations",
      "cross outlines in various styles",
      "dove silhouettes",
      "sacred geometry patterns",
      "flame motifs",
      "chalice and communion symbols",
      "open book illustrations",
      "praying hands sketches"
    ]
  },
  general: {
    label: "General / Botánico",
    description: "Elementos botánicos y formas abstractas",
    elements: [
      "botanical line drawings of leaves",
      "abstract community circle shapes",
      "connecting dots and lines",
      "leaf and branch patterns",
      "organic flowing curves",
      "simple flower outlines",
      "geometric shapes",
      "wave and ripple patterns"
    ]
  },
  children: {
    label: "Niños",
    description: "Elementos infantiles, juguetes y diversión",
    elements: [
      "simple toy illustrations (blocks, balls, teddy bears)",
      "balloon outlines floating",
      "star and moon doodles",
      "crayon-style scribbles and swirls",
      "simple animal faces (cats, dogs, birds)",
      "rainbow arcs and clouds",
      "paper airplane sketches",
      "lollipop and candy outlines",
      "hand-drawn smiley faces",
      "kite illustrations with tails"
    ]
  },
  teens: {
    label: "Adolescentes",
    description: "Elementos juveniles, música y tecnología",
    elements: [
      "headphone and music note illustrations",
      "smartphone and chat bubble outlines",
      "skateboard and sneaker sketches",
      "lightning bolt and star doodles",
      "game controller outlines",
      "microphone illustrations",
      "speech bubble patterns",
      "hashtag and @ symbols",
      "camera and photo frame sketches",
      "guitar and drum stick outlines"
    ]
  },
  seniors: {
    label: "Adultos Mayores",
    description: "Elementos tranquilos, tradicionales y acogedores",
    elements: [
      "teacup and saucer illustrations",
      "rocking chair outlines",
      "classic book and reading glasses sketches",
      "vintage clock faces",
      "knitting needles and yarn balls",
      "chess pieces and board game elements",
      "photo frame and memory album outlines",
      "garden flower and watering can sketches",
      "walking cane with elegant curve",
      "classic lamp and comfortable chair silhouettes"
    ]
  },
  community: {
    label: "Comunidad",
    description: "Personas unidas, conexión y colaboración",
    elements: [
      "hands joining together in circle",
      "group of people silhouettes",
      "heart shapes connected by lines",
      "chain link patterns",
      "house and home outlines",
      "bridge illustrations connecting",
      "tree with multiple branches",
      "puzzle pieces fitting together",
      "speech bubbles in conversation",
      "handshake illustrations"
    ]
  },
  sports: {
    label: "Deporte",
    description: "Actividad física, juegos y movimiento",
    elements: [
      "soccer ball and goal outlines",
      "basketball and hoop sketches",
      "running figure silhouettes",
      "tennis racket and ball",
      "swimming wave patterns",
      "bicycle illustrations",
      "jumping and stretching figures",
      "medal and trophy outlines",
      "whistle and stopwatch sketches",
      "water bottle and towel illustrations"
    ]
  },
  service: {
    label: "Servicio Comunitario",
    description: "Voluntariado, ayuda y solidaridad",
    elements: [
      "helping hands reaching out",
      "heart in hands illustrations",
      "donation box outlines",
      "broom and cleaning tool sketches",
      "hammer and tool belt illustrations",
      "grocery bag being shared",
      "blanket and clothing donations",
      "bandage and first aid symbols",
      "garden shovel and plant",
      "paintbrush and roller for community projects"
    ]
  },
  garage_sale: {
    label: "Venta de Garage",
    description: "Artículos, etiquetas de precio y tesoros",
    elements: [
      "price tag illustrations with strings",
      "cardboard box outlines overflowing",
      "vintage lamp and furniture sketches",
      "clothing on hangers",
      "book stacks and records",
      "toy and stuffed animal outlines",
      "picture frame collections",
      "dish and kitchenware illustrations",
      "shoe and accessory sketches",
      "cash register and coins"
    ]
  }
} as const;

export type IllustrationTheme = keyof typeof ILLUSTRATION_PATTERNS;

// Build prompt for pattern-only generation (no text)
export function buildPatternPrompt(
  themeKey: IllustrationTheme,
  aspectRatio: string
): string {
  const theme = ILLUSTRATION_PATTERNS[themeKey];

  return `Create a seamless illustration pattern background for a church event graphic.

CRITICAL REQUIREMENTS:
- DO NOT include any text, letters, numbers, or words anywhere in the image
- Leave the CENTER AREA (approximately 50% of the composition) mostly clear for text overlay
- Focus illustration elements around the EDGES and CORNERS

VISUAL STYLE:
- Hand-drawn, sketch-like line art illustrations
- Single color: dark charcoal/black lines (#1A1A1A) on warm cream background (#F7F7F7)
- Line weight: thin, delicate strokes (like pen and ink sketches)
- Scattered, organic placement - NOT a rigid grid pattern
- Professional editorial illustration quality

ILLUSTRATION ELEMENTS TO INCLUDE:
${theme.elements.map(e => `- ${e}`).join('\n')}

COMPOSITION FOR ${aspectRatio} ASPECT RATIO:
- Denser illustration clusters in corners and along edges
- Lighter, sparser elements as you move toward center
- Some elements can be partially cropped at edges for organic feel
- Vary element sizes (small, medium, large)
- Rotate some elements slightly for natural variation
- Maintain visual balance across the composition

COLOR SPECIFICATION:
- Background: Warm cream/ivory (#F7F7F7)
- Line art: Dark charcoal (#1A1A1A) - single color only
- NO fills, NO gradients, NO colors other than the line color
- Clean, crisp line work

OUTPUT:
- Clean vector-style line art appearance
- High contrast between lines and background
- Professional, editorial quality illustration`;
}

// Overlay configuration for canvas compositor
export const OVERLAY_CONFIG = {
  fonts: {
    title: {
      family: 'Montserrat',
      weight: 900, // Black
      sizeRatio: 0.07 // 7% of image height
    },
    subtitle: {
      family: 'Montserrat',
      weight: 400, // Regular
      sizeRatio: 0.03 // 3% of image height
    },
    infoBar: {
      family: 'Montserrat',
      weight: 500, // Medium
      sizeRatio: 0.022 // 2.2% of image height
    }
  },
  colors: {
    title: '#1A1A1A',
    subtitle: '#555555',
    infoBar: {
      background: 'rgba(255, 255, 255, 0.95)',
      text: '#333333',
      icons: '#D4A853'
    }
  },
  layout: {
    logoHeightRatio: 0.10, // 10% of image height
    logoTopRatio: 0.04, // 4% from top
    titleTopRatio: 0.20, // 20% from top
    subtitleTopRatio: 0.38, // 38% from top (after title)
    infoBarBottomRatio: 0.04, // 4% from bottom
    infoBarHeightRatio: 0.10, // 10% of image height
    horizontalPaddingRatio: 0.06 // 6% horizontal padding
  }
} as const;

// Interface for overlay content
export interface OverlayContent {
  logo: {
    base64?: string; // Optional - may not be provided
    visible: boolean;
  };
  title: {
    text: string;
    visible: boolean;
  };
  subtitle: {
    text: string;
    visible: boolean;
  };
  infoBar: {
    date?: string;
    time?: string;
    location?: string;
    cta?: string;
    visible: boolean;
  };
}

// Extended GeneratedImage interface for pattern system
export interface PatternGeneratedImage extends GeneratedImage {
  patternBase64?: string; // Store original pattern for re-compositing
  overlayConfig?: OverlayContent;
  illustrationTheme?: IllustrationTheme;
}
