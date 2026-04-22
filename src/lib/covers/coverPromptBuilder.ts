/**
 * CASA Cover Prompt Builder
 *
 * Builds structured JSON prompts for Nano Banana Pro (gemini-3-pro-image-preview)
 * that produce "cover" slides (liturgy main, liturgy reflection, sermon) with
 * title + subtitle + CASA logo rendered directly into the image.
 *
 * Companion module to `src/components/graphics/jsonPromptBuilder.ts`. Same
 * visual voice (Matisse/Picasso line art, Kinfolk-editorial composition,
 * CASA brand palette) but with cover-specific text hierarchy and a logo
 * section that instructs Gemini to USE the reference image as the logo —
 * the caller passes the CASA logo PNG via the edge function's
 * `referenceImage` parameter.
 */

import { CASA_BRAND } from '@/lib/brand-kit';

/**
 * Normalize a human name for safe embedding in a Gemini prompt. Keeps letters
 * (incl. accented Unicode), digits, whitespace, hyphens, dots, commas; strips
 * straight/smart quotes, backticks, parens, control chars, etc. Used on
 * preacher fields in all cover-prompt builders. The JSON.stringify escaping
 * around structured fields already stops syntactic injection — this adds a
 * defense-in-depth layer against prompt-shaping content.
 */
function sanitizeHumanName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s\-.,]/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Lighter sanitization for freeform text (titles) that may legitimately
 * contain broader punctuation. Strips only the characters that would break
 * the plaintext prompt template (double quotes, line breaks).
 */
function sanitizeForPlaintextPrompt(raw: string): string {
  return raw.replace(/["\n\r]/g, '').trim();
}

const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

/**
 * Shape of the `generate-illustration` edge function response. Exported so
 * callers can narrow `data` from the untyped `supabase.functions.invoke`
 * result without redefining the contract locally.
 */
export interface GenerateIllustrationResponse {
  illustrations: string[];
  validCount?: number;
  requestedCount?: number;
  error?: string;
}

interface CoverJsonPrompt {
  core: {
    subject: string;
    purpose: string;
  };
  text: {
    title: { content: string; style: string };
    subtitle?: { content: string; style: string };
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
    source: string;
  };
  composition: {
    layout: string;
    textPlacement: string;
    balance: string;
    aspectRatio: '4:3';
  };
  colors: {
    foundation: string;
    structure: string;
    accent: string;
    text: string;
  };
  typography: {
    titleFont: string;
    subtitleFont: string;
    hierarchy: string;
  };
  technical: {
    avoidList: string[];
    quality: string;
    textRendering: string;
  };
}

function commonPromptParts() {
  return {
    illustration: {
      style:
        'Single continuous flowing line art in the style of Henri Matisse or Pablo Picasso one-line drawings. Abstract and contemplative. Elegant, minimalist, with generous negative space. Hand-drawn organic curves — NOT geometric, NOT digital, NOT clipart.',
      lineColor: 'Medium gray (#666666) — single continuous line weight',
      accentColor: `Warm amber/gold (${CASA_BRAND.colors.primary.amber}) — used as accent on 20-30% of the illustration elements`,
      background: `MANDATORY EXACT COLOR: warm cream hex ${CASA_BRAND.colors.primary.white}. Flat solid fill — absolutely no gradient, no texture, no tonal variation, no vignetting, no lighting effects. The background must be the identical uniform ${CASA_BRAND.colors.primary.white} across the entire canvas and identical across every variation in this batch. Do not shift the hue warmer, cooler, lighter, or darker.`,
      placement:
        'The illustration occupies one side or the background of the composition, leaving clear space for the title and subtitle. Illustration and text coexist as a unified editorial layout.',
    },
    logo: {
      description:
        'A CASA logo is provided as a reference image. Use that reference image EXACTLY as the logo in the final composition — do NOT invent, redraw, or stylize a new logo. Preserve its original shape, proportions, line weights, and anti-aliasing.',
      placement:
        'Place the logo in the top-right corner of the image. The logo should occupy approximately 8-12% of the canvas width, with a comfortable margin (roughly 4-6% of canvas width) from both the top and right edges. Do not crop, rotate, or distort the logo.',
      source:
        'The logo comes from the reference image provided alongside this prompt. No other mark, seal, monogram, or watermark should appear anywhere in the image.',
    },
    composition: {
      layout:
        'Editorial magazine layout with intentional negative space. Matisse-style line art and typography coexist as a unified design — like a high-end gallery invitation or Kinfolk magazine spread.',
      balance:
        'Asymmetric with breathing room. 50-65% warm cream space. Line art anchored to one side, title text anchored to the other. Silencio Sagrado — negative space is active presence, not emptiness.',
      aspectRatio: '4:3' as const,
    },
    colors: {
      foundation: `Warm cream (${CASA_BRAND.colors.primary.white}) as the dominant background`,
      structure: `Medium gray (#666666) for line art, warm grays from ${CASA_BRAND.colors.secondary.grayLight} to charcoal ${CASA_BRAND.colors.secondary.carbon} for structural detail`,
      accent: `Warm amber/gold (${CASA_BRAND.colors.primary.amber}) — 20-30% of illustration accents, sparingly in text`,
      text: `${CASA_BRAND.colors.primary.black} for titles, ${CASA_BRAND.colors.secondary.grayDark} for subtitles, ${CASA_BRAND.colors.amber.dark} for rare amber accents`,
    },
    typography: {
      titleFont: `Elegant serif similar to ${CASA_BRAND.fonts.heading}, light weight (${CASA_BRAND.typography.h1.fontWeight}), generous letter spacing (${CASA_BRAND.typography.h1.letterSpacing}). Prominent, refined, commanding but not heavy.`,
      subtitleFont: `Clean sans-serif similar to ${CASA_BRAND.fonts.body}, weight ${CASA_BRAND.typography.body.fontWeight}, smaller than the title. Muted gray. Set in small-caps or uppercase when appropriate for a season label.`,
      hierarchy:
        'Title is the hero. Subtitle is a quiet caption — visible but clearly secondary. Subtle size and weight contrast, never dramatic.',
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
        'ANY religious figures (Jesus, saints, angels, biblical characters)',
        'crosses, halos, altars, or other religious symbols unless explicitly requested in the title',
        'inventing, redrawing, or stylizing the logo — use the reference image verbatim',
        'placeholder text, lorem ipsum, or sample copy — use ONLY the exact text provided',
      ],
      quality:
        'Museum/magazine quality. The line art must feel like an original Matisse drawing. The typography must feel like a master typographer set it by hand. Meticulous craftsmanship throughout.',
      textRendering:
        'ALL text must be rendered clearly and legibly as an integral part of the image composition. Text is part of the design, not overlaid. Professional typographic quality — proper kerning, leading, alignment. Use ONLY the exact text content provided.',
    },
  };
}

function jsonPromptToString(prompt: CoverJsonPrompt): string {
  return `Generate a finished 4:3 cover design based on the following structured specification.

CRITICAL INSTRUCTIONS:
1. The illustration MUST be Henri Matisse / Pablo Picasso one-line continuous line art — flowing gray (#666666) lines with warm amber/gold (${CASA_BRAND.colors.primary.amber}) accents on a warm cream (${CASA_BRAND.colors.primary.white}) background. Signature visual style, non-negotiable.
2. BACKGROUND COLOR IS MANDATORY AND FIXED: exact hex ${CASA_BRAND.colors.primary.white}. The background must be a perfectly flat, uniform ${CASA_BRAND.colors.primary.white} across the entire canvas — no gradients, no textures, no tonal shifts, no lighting effects, no vignetting. If you generate this scene as multiple variations, the background hex must be identical across every variation. Do not drift warmer, cooler, lighter, or darker.
3. Render ALL text elements directly into the image with professional typography. Text is part of the design, never a separate layer.
4. Use the provided reference image EXACTLY as the CASA logo, placed in the top-right corner. Do not redraw or restyle the logo.
5. Follow the color palette EXACTLY — warm cream background (${CASA_BRAND.colors.primary.white}), gray line art, amber accents, charcoal text.
6. TYPOGRAPHIC HIERARCHY IS MANDATORY: the title is the hero of the composition (large serif). Any subtitle MUST be distinctly smaller than the title — approximately 40-50% of the title's cap height. The subtitle is a quiet caption, never a co-equal line.
7. Follow the typography direction — elegant serif for titles, clean sans-serif for subtitles.
8. Use ONLY the exact text content provided in the specification. No placeholder text.
9. The final result must look like an editorial magazine cover — illustration and typography as a unified design.

DESIGN SPECIFICATION:
${JSON.stringify(prompt, null, 2)}`;
}

/**
 * Build a JSON prompt for the MAIN liturgy cover.
 * Gemini renders: liturgy title + liturgical season label + CASA logo (from reference image).
 * Pass `illustrationTheme` to override the default season-derived subject with a custom mood hint
 * (e.g. "storm-tossed boat", "walk to Emmaus").
 */
export function buildLiturgyCoverPrompt(args: {
  title: string;
  season: string;
  illustrationTheme?: string;
}): string {
  const { title, season, illustrationTheme } = args;
  const common = commonPromptParts();
  const themeOverride = illustrationTheme?.trim();
  const illustrationSubject = themeOverride
    ? themeOverride
    : `Contemplative scene evoking the ${season} liturgical season — abstract, suggestive of sacred reflection, no literal religious symbols`;

  const prompt: CoverJsonPrompt = {
    core: {
      subject: `Liturgy cover for "${title}" during the ${season} season`,
      purpose: 'Front cover slide introducing a Sunday liturgy in the CASA presentation',
    },
    text: {
      title: {
        content: title,
        style: `elegant serif, light weight (${CASA_BRAND.typography.h1.fontWeight}), generous letter spacing, color ${CASA_BRAND.colors.primary.black}, commanding but refined`,
      },
      subtitle: {
        content: season.toUpperCase(),
        style: `small-caps sans-serif, muted gray ${CASA_BRAND.colors.secondary.grayDark}, letter-spaced, DISTINCTLY SMALLER than the title — approximately 40-50% of the title's cap height — quiet and ecclesial. Never render at a size similar to the title.`,
      },
    },
    illustration: {
      ...common.illustration,
      subject: illustrationSubject,
    },
    logo: common.logo,
    composition: {
      ...common.composition,
      textPlacement:
        'Title anchored lower-left or lower-center, large and generous. Season label immediately above or below the title as a small-caps caption, tracked-out. Illustration occupies the upper-right or full background with the title reading against negative space. Logo in top-right corner per logo spec.',
    },
    colors: common.colors,
    typography: common.typography,
    technical: common.technical,
  };

  return jsonPromptToString(prompt);
}

/**
 * Build a short image-to-image recomposition prompt for the REFLECTION cover.
 * Paired with the selected main cover passed as `referenceImage` to the edge
 * function. Gemini keeps the illustration/composition and swaps only the text.
 *
 * The reflection cover renders the liturgy TITLE (same as the main cover) as
 * the hero, with the preacher name as a quiet caption beneath. No "Reflexión"
 * word on the image — its role as the reflection section is understood from
 * its position in the liturgy, not from a label on the cover.
 */
export function buildLiturgyReflectionCoverPrompt(args: {
  title: string;
  preacher: string;
}): string {
  const title = sanitizeForPlaintextPrompt(args.title);
  const preacher = sanitizeHumanName(args.preacher);
  const subtitleLine = preacher
    ? `Subtitle: "${preacher}" (clean sans-serif, muted gray ${CASA_BRAND.colors.secondary.grayDark}, DISTINCTLY SMALLER than the title — approximately 40-50% of the title's cap height, positioned as a quiet caption directly below the title)`
    : 'Subtitle: none — render the title alone, centered vertically';

  return `Recompose the provided reference image. Keep the illustration style, composition, color palette, logo placement, and overall editorial layout visually identical. Replace ONLY the text content with:

Title: "${title}" (elegant serif, same weight and treatment as the title in the reference image — this IS the liturgy name, the hero of the composition)
${subtitleLine}

CRITICAL typographic rule: the subtitle (preacher name) MUST be rendered distinctly smaller than the title — roughly 40-50% of the title's cap height. The title dominates the composition; the subtitle is a quiet caption, never a co-equal line. Do not render them at similar sizes.

Everything else — the Matisse-style line art, the warm cream background (EXACT hex ${CASA_BRAND.colors.primary.white}, flat uniform fill with no tonal variation from the reference), the amber accents, the CASA logo in the top-right corner, the aspect ratio (4:3), the typographic hierarchy — must remain visually identical to the reference image. Do NOT redraw the illustration. Do NOT redesign the layout. Do NOT change the color palette or background hue. Use ONLY the exact text content specified above.`;
}

/**
 * Build a JSON prompt for the SERMON cover (used by CoverArtGenerator).
 * Gemini renders: sermon title + preacher name + CASA logo (from reference image).
 * Pass `illustrationTheme` to override the default title-derived subject with a custom mood hint.
 */
export function buildSermonCoverPrompt(args: {
  title: string;
  preacher: string;
  illustrationTheme?: string;
}): string {
  const { title, illustrationTheme } = args;
  const preacher = sanitizeHumanName(args.preacher);
  const common = commonPromptParts();
  const themeOverride = illustrationTheme?.trim();
  const illustrationSubject = themeOverride
    ? themeOverride
    : `Abstract, contemplative scene evoking the theme of "${title}" — avoid literal depictions, keep it suggestive and reflective`;

  const prompt: CoverJsonPrompt = {
    core: {
      subject: `Sermon cover for "${title}" preached by ${preacher}`,
      purpose: 'Cover artwork for a sermon recording or reflection — distributed with the audio or as a standalone presentation slide',
    },
    text: {
      title: {
        content: title,
        style: `elegant serif, light weight (${CASA_BRAND.typography.h1.fontWeight}), generous letter spacing, color ${CASA_BRAND.colors.primary.black}, the clear hero of the composition`,
      },
      subtitle: {
        content: preacher,
        style: `clean sans-serif, weight ${CASA_BRAND.typography.body.fontWeight}, muted gray ${CASA_BRAND.colors.secondary.grayDark}, DISTINCTLY SMALLER than the title — approximately 40-50% of the title's cap height — preceded by a small warm amber (${CASA_BRAND.colors.primary.amber}) dot or subtle bullet as a quiet accent, positioned as a caption directly below the title. Never render at a size similar to the title.`,
      },
    },
    illustration: {
      ...common.illustration,
      subject: illustrationSubject,
    },
    logo: common.logo,
    composition: {
      ...common.composition,
      textPlacement:
        'Title as hero in the lower-left or lower-center, with generous negative space above. Preacher name as a small caption directly beneath the title, with a small amber dot accent before the name. Illustration occupies the upper portion or frames the title. Logo in top-right corner per logo spec.',
    },
    colors: common.colors,
    typography: common.typography,
    technical: common.technical,
  };

  return jsonPromptToString(prompt);
}

// ============================================
// LOGO LOADER
// ============================================

let cachedLogoPromise: Promise<string> | null = null;

/**
 * Load the CASA logo and return it as raw base64 (no `data:...` prefix),
 * ready to pass to the `generate-illustration` edge function as `referenceImage`.
 * Memoized per module load — subsequent calls reuse the same fetch.
 */
export function getCasaLogoAsBase64(): Promise<string> {
  if (!cachedLogoPromise) {
    cachedLogoPromise = fetchLogoAsBase64().catch((err) => {
      // Reset cache on failure so a later call can retry.
      cachedLogoPromise = null;
      throw err;
    });
  }
  return cachedLogoPromise;
}

async function fetchLogoAsBase64(): Promise<string> {
  const response = await fetch(CASA_LOGO_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load CASA logo from ${CASA_LOGO_PATH}: ${response.status}`);
  }
  const blob = await response.blob();
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not produce a string result'));
        return;
      }
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('FileReader result is not a data URL'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
