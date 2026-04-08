/**
 * CASA JSON Prompt Builder
 * Builds structured JSON prompts for Nano Banana Pro (gemini-3-pro-image-preview)
 * that include text rendering instructions, brand kit colors, and editorial style.
 *
 * The model renders ALL text (title, subtitle, date, time, location) directly
 * into the image with professional typography — no Canvas overlay needed.
 */

import { CASA_BRAND } from '@/lib/brand-kit';
import { PROMPT_TEMPLATES, type PromptCategory } from './constants';
import type { EventData, FormatType } from './graphicsTypes';
import { FORMAT_DIMENSIONS } from './graphicsTypes';

// ============================================
// EVENT TYPE → PROMPT CATEGORY MAPPING
// ============================================

const EVENT_TO_CATEGORY: Record<string, PromptCategory> = {
  mesa_abierta: 'general_announcement',
  culto_dominical: 'worship_service',
  estudio_biblico: 'book_club',
  retiro: 'seasonal',
  navidad: 'seasonal',
  cuaresma: 'seasonal',
  pascua: 'seasonal',
  bautismo: 'worship_service',
  comunidad: 'assembly',
  musica: 'worship_service',
  oracion: 'social_devotional',
  generic: 'general_announcement',
};

// Event type subject descriptions (for the core.subject field)
const EVENT_SUBJECTS: Record<string, string> = {
  mesa_abierta: 'Community dinner gathering — people sharing a meal together in warmth and fellowship',
  culto_dominical: 'Sunday worship service — contemplative sacred space with reverent beauty',
  estudio_biblico: 'Bible study group — intimate intellectual gathering with warmth and depth',
  retiro: 'Spiritual retreat — mountain landscape, journey, nature, and peaceful reflection',
  navidad: 'Christmas celebration — warm golden light, gentle nativity, joyful restraint',
  cuaresma: 'Lenten season — muted earth tones, contemplative shadows, desert simplicity',
  pascua: 'Easter — soft morning light, resurrection joy, white lily, empty space',
  bautismo: 'Baptism — water, dove, light rays, new life and sacred beginning',
  comunidad: 'Community gathering — people united, connection, collaboration, togetherness',
  musica: 'Worship music — musical notes, instruments, sound and sacred melody',
  oracion: 'Prayer — candle flame, ascending light, meditation and spiritual depth',
  generic: 'Church community event — warm, welcoming, inclusive gathering',
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
  };
  style: {
    aesthetic: string;
    mood: string;
    approach: string;
    philosophy: string;
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
 * Build a structured JSON prompt for Nano Banana Pro that includes
 * text rendering instructions using the CASA brand kit.
 */
export function buildJsonPrompt(
  eventData: EventData,
  eventType: string,
  format: FormatType,
  options?: {
    customStyleApproach?: string;
    includeSubtitle?: boolean;
  }
): GraphicsJsonPrompt {
  const category = EVENT_TO_CATEGORY[eventType] || 'general_announcement';
  const template = PROMPT_TEMPLATES[category];
  const dims = FORMAT_DIMENSIONS[format];

  // Build text section — only include fields that have content
  const textSection: GraphicsJsonPrompt['text'] = {};

  if (eventData.title) {
    textSection.title = {
      content: eventData.title.replace(/\\n/g, '\n'),
      style: `elegant serif typography similar to ${CASA_BRAND.fonts.heading}, light weight (300), generous letter spacing (0.05em), prominent and commanding but not heavy`,
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

  // Get editorial approach from the template
  const editorialApproach = options?.customStyleApproach || template.basePrompt;

  return {
    core: {
      subject: EVENT_SUBJECTS[eventType] || EVENT_SUBJECTS.generic,
      purpose: 'church event announcement graphic for social media and presentations',
    },
    text: textSection,
    style: {
      aesthetic: 'Editorial sophistication — Kinfolk magazine meets sacred space. Quiet luxury. Intentional beauty. Every element earns its place.',
      mood: 'warm, contemplative, inviting, hopeful, serene — the visual equivalent of entering a sacred space where worldly noise fades',
      approach: editorialApproach,
      philosophy: 'Silencio Sagrado — contemplative minimalism where negative space is active presence. Elements float with generous breathing room. Amber appears like candlelight: scarce, precious, intentional. Text is sparse, essential, positioned with haiku precision.',
    },
    composition: {
      layout: 'Rule of thirds with intentional negative space. One strong visual anchor balanced by generous empty space.',
      textPlacement: 'Title prominent in upper or center area with clear hierarchy. Event details (date, time, location) grouped together with small amber icons (calendar, clock, pin) in a secondary position. All text must be rendered as part of the design.',
      balance: 'Asymmetric with breathing room. 60-75% warm cream/ivory space. Visual weight in one area creating sophisticated tension.',
      aspectRatio: `${dims.width}:${dims.height}`,
      dimensions: `${dims.width}x${dims.height} pixels`,
    },
    colors: {
      foundation: `Warm cream (${CASA_BRAND.colors.primary.white}) and soft ivory as the dominant background — 60-75% of composition`,
      structure: `Warm grays from light (${CASA_BRAND.colors.secondary.grayLight}) to charcoal (${CASA_BRAND.colors.secondary.carbon}) for structure and depth`,
      accent: `Muted amber/gold (${CASA_BRAND.colors.primary.amber}) — used sparingly like a jewel, 5-15% of composition. Variations: light ${CASA_BRAND.colors.amber.light}, main ${CASA_BRAND.colors.amber.main}, dark ${CASA_BRAND.colors.amber.dark}`,
      text: `${CASA_BRAND.colors.primary.black} for titles, ${CASA_BRAND.colors.secondary.grayDark} for subtitles and body, ${CASA_BRAND.colors.amber.dark} for accent details like date/time/location`,
    },
    typography: {
      titleFont: `Elegant serif similar to ${CASA_BRAND.fonts.heading}, light weight (${CASA_BRAND.typography.h1.fontWeight}), generous letter spacing (${CASA_BRAND.typography.h1.letterSpacing}). Large, commanding but refined.`,
      bodyFont: `Clean modern sans-serif similar to ${CASA_BRAND.fonts.body}, weight ${CASA_BRAND.typography.body.fontWeight}. Used for event details.`,
      hierarchy: 'Clear but gentle — subtle weight and size differences rather than dramatic contrast. Title is the hero, details recede gracefully.',
    },
    technical: {
      avoidList: [
        'clip art aesthetic',
        'stock photo clichés',
        'heavy ornate borders or art deco patterns',
        'bright saturated colors or high contrast',
        'busy compositions or competing focal points',
        'generic church graphic templates',
        'decorative flourishes',
        'literal or heavy-handed religious imagery',
      ],
      quality: 'Museum/magazine quality. Meticulous craftsmanship. Every element must feel like the result of hours of refinement by a master designer.',
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
1. Render ALL text elements directly into the image with professional typography. The text must be part of the design composition, not a separate layer.
2. Follow the color palette EXACTLY as specified — warm cream backgrounds, charcoal text, amber accents.
3. Follow the typography direction — serif for titles (like Merriweather), clean for details.
4. The result should look like a page from Kinfolk magazine or a high-end gallery invitation.
5. Leave NO placeholder text. Use ONLY the exact text content provided in the specification.
6. The image must be a complete, print-ready graphic — not a mockup or template.

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
  }
): string {
  const prompt = buildJsonPrompt(eventData, eventType, format, options);
  return jsonPromptToString(prompt);
}
