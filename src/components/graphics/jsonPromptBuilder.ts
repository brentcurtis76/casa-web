/**
 * CASA JSON Prompt Builder
 * Builds structured JSON prompts for Nano Banana Pro (gemini-3-pro-image-preview)
 * that include text rendering instructions, brand kit colors, and editorial style.
 *
 * The model renders ALL text (title, subtitle, date, time, location, extraInfo)
 * directly into the image with professional typography — no Canvas overlay needed.
 *
 * Illustration style: Matisse/Picasso continuous line art — the CASA signature look.
 */

import { CASA_BRAND } from '@/lib/brand-kit';
import type { EventData, FormatType } from './graphicsTypes';
import { FORMAT_DIMENSIONS } from './graphicsTypes';

// ============================================
// EVENT TYPE FALLBACK HINTS
// ============================================
// These are ONLY used as a last resort when the user provides no title,
// subtitle, or illustration theme. They suggest a general mood/setting,
// NOT specific religious symbols. The user's actual input always takes priority.

const EVENT_FALLBACK_HINTS: Record<string, string> = {
  mesa_abierta: 'People gathering around a table, sharing a meal together',
  culto_dominical: 'Contemplative sacred space, candles, open book',
  estudio_biblico: 'Reading group, open book with lamp, coffee cup, notebook',
  retiro: 'Mountain landscape with path, trees, and birds in flight',
  navidad: 'Winter celebration, warm golden light, gift-giving, togetherness',
  cuaresma: 'Desert landscape, simplicity, sparse vegetation, contemplation',
  pascua: 'Sunrise, garden flowers, spring renewal, hope',
  bautismo: 'Water waves, dove, light rays, new beginnings',
  comunidad: 'Circle of people, joined hands, togetherness',
  musica: 'Musical notes, instruments, sound waves',
  oracion: 'Candle flame, ascending light, meditation',
  generic: 'Warm community gathering, open doors, welcome',
};

// ============================================
// JSON PROMPT STRUCTURE
// ============================================

export interface GraphicsJsonPrompt {
  core: {
    subject: string;
    purpose: string;
  };
  text: {
    title?: { content: string; style: string };
    subtitle?: { content: string; style: string };
    info?: {
      date?: string;
      time?: string;
      location?: string;
    };
    extraInfo?: { content: string; style: string };
  };
  illustration: {
    style: string;
    subject: string;
    lineColor: string;
    accentColor: string;
    background: string;
    placement: string;
  };
  logo: {
    description: string;
    placement: string;
    style: string;
  };
  composition: {
    layout: string;
    textPlacement: string;
    balance: string;
    aspectRatio: string;
    dimensions: string;
  };
  colors: {
    foundation: string;
    structure: string;
    accent: string;
    text: string;
  };
  typography: {
    titleFont: string;
    bodyFont: string;
    hierarchy: string;
  };
  technical: {
    avoidList: string[];
    quality: string;
    textRendering: string;
  };
}

// ============================================
// BUILDER
// ============================================

/**
 * Derive the illustration subject from user-provided fields.
 * The title is the primary signal — it tells the model what the event is about.
 * Subtitle and custom theme add nuance. Returns empty string if nothing useful.
 */
function buildSubjectFromUserInput(
  eventData: EventData,
  customTheme?: string
): string {
  // Custom illustration theme always wins — user explicitly described what they want
  if (customTheme?.trim()) {
    return customTheme.trim();
  }

  // Otherwise, build from title + subtitle
  const parts: string[] = [];
  if (eventData.title?.trim()) {
    parts.push(eventData.title.replace(/\\n/g, ' ').trim());
  }
  if (eventData.subtitle?.trim()) {
    parts.push(eventData.subtitle.trim());
  }

  return parts.join(' — ');
}

/**
 * Build a structured JSON prompt for Nano Banana Pro that includes
 * text rendering instructions using the CASA brand kit, with
 * Matisse/Picasso continuous line art illustrations.
 */
export function buildJsonPrompt(
  eventData: EventData,
  eventType: string,
  format: FormatType,
  options?: {
    customStyleApproach?: string;
    includeSubtitle?: boolean;
    extraInfo?: string;
    contextHint?: string;
  }
): GraphicsJsonPrompt {
  const dims = FORMAT_DIMENSIONS[format];

  // Derive the illustration subject from user input, NOT the event type.
  // Priority: custom illustration theme > title + subtitle > event type fallback
  const userSubject = buildSubjectFromUserInput(eventData, options?.customStyleApproach);
  const fallbackHint = EVENT_FALLBACK_HINTS[eventType] || EVENT_FALLBACK_HINTS.generic;
  let illustrationSubject = userSubject || fallbackHint;

  // If a context hint was provided, append it so the AI understands the theme
  // but it does NOT appear as text on the image
  if (options?.contextHint) {
    illustrationSubject += ` — Context: ${options.contextHint}`;
  }

  // Build text section — only include fields that have content
  const textSection: GraphicsJsonPrompt['text'] = {};

  if (eventData.title) {
    textSection.title = {
      content: eventData.title.replace(/\\n/g, '\n'),
      style: `elegant serif typography similar to ${CASA_BRAND.fonts.heading}, light weight (300), generous letter spacing (0.05em), prominent and commanding but not heavy, color ${CASA_BRAND.colors.primary.black}`,
    };
  }

  if (options?.includeSubtitle && eventData.subtitle) {
    textSection.subtitle = {
      content: eventData.subtitle,
      style: `italic serif in ${CASA_BRAND.fonts.heading} style, warm amber/gold color (${CASA_BRAND.colors.primary.amber}), smaller than title, gentle and refined`,
    };
  }

  const info: GraphicsJsonPrompt['text']['info'] = {};
  if (eventData.date) info.date = eventData.date;
  if (eventData.time) info.time = eventData.time;
  if (eventData.location) info.location = eventData.location;
  if (Object.keys(info).length > 0) {
    textSection.info = info;
  }

  if (options?.extraInfo?.trim()) {
    textSection.extraInfo = {
      content: options.extraInfo.trim(),
      style: `small clean sans-serif (${CASA_BRAND.fonts.body} style), weight 400, muted gray (${CASA_BRAND.colors.secondary.grayDark}), positioned near the bottom or below event details as a secondary note`,
    };
  }

  return {
    core: {
      subject: illustrationSubject,
      purpose: `event announcement graphic for "${illustrationSubject}" — for social media and presentations`,
    },
    text: textSection,
    illustration: {
      style: 'Single continuous flowing line art in the style of Henri Matisse or Pablo Picasso one-line drawings. Abstract and contemplative. Elegant, minimalist, with generous negative space. The line art should feel hand-drawn with organic flowing curves — NOT geometric, NOT digital, NOT clipart.',
      subject: illustrationSubject,
      lineColor: `Medium gray (#666666) — single continuous line weight`,
      accentColor: `Warm amber/gold (${CASA_BRAND.colors.primary.amber}) — used as accent on 20-30% of the illustration elements (highlights, key elements, artistic accents)`,
      background: `Warm cream (${CASA_BRAND.colors.primary.white}) — solid flat background`,
      placement: 'The illustration occupies one area of the composition (typically right side or background), leaving clear space for text. The illustration and text coexist as an integrated editorial layout.',
    },
    logo: {
      description: 'DO NOT generate any logo, watermark, monogram, emblem, seal, crest, or text mark anywhere in the image. A logo will be composited separately afterward.',
      placement: 'Avoid placing important illustration details or text in the bottom-right corner area so a small logo can be overlaid later without obscuring content. The background should continue naturally through that area — do NOT leave a blank, white, or visually distinct rectangle.',
      style: 'No logo in the generated image. Background continues seamlessly everywhere.',
    },
    composition: {
      layout: 'Editorial magazine layout with intentional negative space. The Matisse-style line art illustration and the typography coexist as a unified design — like a high-end gallery invitation or Kinfolk magazine spread.',
      textPlacement: 'Title prominent in upper-left or center area. Event details (date, time, location) grouped together with small amber icons (calendar, clock, pin) in a secondary position. Extra info as a quiet footnote near the bottom. All text rendered as part of the design.',
      balance: 'Asymmetric with breathing room. 50-65% warm cream/ivory space. Line art illustration anchored to one side, text to the other. Silencio Sagrado — negative space is active presence, not emptiness.',
      aspectRatio: `${dims.width}:${dims.height}`,
      dimensions: `${dims.width}x${dims.height} pixels`,
    },
    colors: {
      foundation: `Warm cream (${CASA_BRAND.colors.primary.white}) and soft ivory as the dominant background`,
      structure: `Medium gray (#666666) for line art illustration, warm grays from ${CASA_BRAND.colors.secondary.grayLight} to charcoal ${CASA_BRAND.colors.secondary.carbon} for structure`,
      accent: `Warm amber/gold (${CASA_BRAND.colors.primary.amber}) — used on 20-30% of the illustration AND sparingly in text accents. Variations: light ${CASA_BRAND.colors.amber.light}, main ${CASA_BRAND.colors.amber.main}, dark ${CASA_BRAND.colors.amber.dark}`,
      text: `${CASA_BRAND.colors.primary.black} for titles, ${CASA_BRAND.colors.secondary.grayDark} for body text, ${CASA_BRAND.colors.amber.dark} for detail accents (date/time/location)`,
    },
    typography: {
      titleFont: `Elegant serif similar to ${CASA_BRAND.fonts.heading}, light weight (${CASA_BRAND.typography.h1.fontWeight}), generous letter spacing (${CASA_BRAND.typography.h1.letterSpacing}). Large, commanding but refined.`,
      bodyFont: `Clean modern sans-serif similar to ${CASA_BRAND.fonts.body}, weight ${CASA_BRAND.typography.body.fontWeight}. Used for event details and extra info.`,
      hierarchy: 'Clear but gentle — subtle weight and size differences rather than dramatic contrast. Title is the hero, details recede gracefully. Extra info is the quietest element.',
    },
    technical: {
      avoidList: [
        'photographic or photorealistic imagery — use ONLY line art illustration',
        'filled shapes or solid color blocks in the illustration — lines only',
        'clip art aesthetic or stock illustration style',
        'heavy ornate borders or art deco patterns',
        'bright saturated colors or high contrast',
        'busy compositions or competing focal points',
        'generic church graphic templates',
        'digital or geometric illustration style — must feel hand-drawn',
        'ANY religious figures (Jesus, saints, angels, biblical characters) — illustrate the EVENT ACTIVITY described in the title, not religious symbolism',
        'crosses, halos, altars, or other religious symbols unless explicitly requested in the title',
        'ANY logo, watermark, monogram, emblem, seal, or text mark — the logo is added separately',
      ],
      quality: 'Museum/magazine quality. The line art must feel like an original Matisse drawing. The typography must feel like a master typographer set it by hand. Meticulous craftsmanship throughout.',
      textRendering: 'ALL text must be rendered clearly and legibly as an integral part of the image composition. Text is part of the design, not overlaid. Render with professional typographic quality — proper kerning, leading, and alignment.',
    },
  };
}

/**
 * Convert a GraphicsJsonPrompt to a formatted prompt string
 * that Nano Banana Pro can interpret.
 */
export function jsonPromptToString(prompt: GraphicsJsonPrompt): string {
  const jsonStr = JSON.stringify(prompt, null, 2);

  return `Generate a complete, finished graphic design based on the following structured specification.

CRITICAL INSTRUCTIONS:
1. The illustration MUST be in the style of Henri Matisse / Pablo Picasso one-line continuous line art — flowing gray (#666666) lines with warm amber/gold (#D4A853) accents on a warm cream background. This is the signature visual style and is non-negotiable.
2. Render ALL text elements directly into the image with professional typography. The text must be part of the design composition, not a separate layer.
3. Follow the color palette EXACTLY — warm cream background, gray line art, amber accents, charcoal text.
4. Follow the typography direction — serif for titles, clean sans-serif for details.
5. Leave NO placeholder text. Use ONLY the exact text content provided in the specification.
6. The final result must look like an editorial magazine layout where a Matisse-style illustration and elegant typography coexist as a unified design.

DESIGN SPECIFICATION:
${jsonStr}`;
}

/**
 * Convenience function: build and stringify in one call.
 */
export function buildJsonPromptString(
  eventData: EventData,
  eventType: string,
  format: FormatType,
  options?: {
    customStyleApproach?: string;
    includeSubtitle?: boolean;
    extraInfo?: string;
    contextHint?: string;
  }
): string {
  const prompt = buildJsonPrompt(eventData, eventType, format, options);
  return jsonPromptToString(prompt);
}
