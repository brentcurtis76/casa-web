/**
 * CASA Graphics Generator Types
 * Shared type definitions for the drag-and-drop editor and template compositor.
 */

export type FormatType = 'ppt_4_3' | 'instagram_post' | 'instagram_story' | 'facebook_post';

export type TextAlign = 'left' | 'center' | 'right';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Google Slides-style selection colors */
export const SELECTION_COLORS = {
  border: '#4285f4',
  borderHover: 'rgba(66, 133, 244, 0.4)',
  handleFill: '#ffffff',
  handleBorder: '#dadce0',
  handleShadow: '0 1px 2px rgba(0,0,0,0.1)',
  badgeBg: '#4285f4',
  badgeText: '#ffffff',
  selectedBg: 'rgba(66, 133, 244, 0.04)',
} as const;

export interface EventData {
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  location: string;
}

export interface GeneratedGraphic {
  format: FormatType;
  base64: string;
  width: number;
  height: number;
}

/** Position of an element in base coordinates (before scaling) */
export interface ElementPosition {
  x: number;
  y: number;
  textAlign?: TextAlign;
}

/** Illustration has extra properties */
export interface IllustrationPosition extends ElementPosition {
  scale: number;   // 0.3 to 3.0
  opacity: number; // 0.05 to 1.0
}

/** Logo position */
export interface LogoPosition extends ElementPosition {
  size: number; // base size in px (before scaling)
}

/** All element positions for a single format */
export interface ElementPositions {
  title: ElementPosition;
  subtitle: ElementPosition;
  date: ElementPosition;
  time: ElementPosition;
  location: ElementPosition;
  illustration: IllustrationPosition;
  logo: LogoPosition;
}

/** All element positions across all formats */
export type AllElementPositions = Record<FormatType, ElementPositions>;

/**
 * Default element positions per format.
 * Extracted from the hardcoded coordinates in each layout function of templateCompositor.ts.
 * These represent the "design template" positions — the starting point before any user adjustments.
 */
export const DEFAULT_ELEMENT_POSITIONS: AllElementPositions = {
  // PPT 4:3 (base 1024x768)
  ppt_4_3: {
    title: { x: 59, y: 151, textAlign: 'left' },
    subtitle: { x: 59, y: -1, textAlign: 'left' }, // y=-1 means "auto: position after title"
    date: { x: 75, y: 444, textAlign: 'left' },
    time: { x: 77, y: 500, textAlign: 'left' },
    location: { x: 75, y: 557, textAlign: 'left' },
    illustration: { x: 530, y: 140, scale: 1.0, opacity: 0.15 },
    logo: { x: 457, y: 34, size: 110 },
  },

  // Instagram Post 1:1 (base 1080x1080)
  instagram_post: {
    title: { x: 42, y: 140, textAlign: 'left' },
    subtitle: { x: 42, y: -1, textAlign: 'left' },
    date: { x: 42, y: 486, textAlign: 'left' },
    time: { x: 42, y: 613, textAlign: 'left' },
    location: { x: 42, y: 740, textAlign: 'left' },
    illustration: { x: 240, y: 0, scale: 1.0, opacity: 0.15 },
    logo: { x: 497, y: 901, size: 87 },
  },

  // Instagram Story 9:16 (base 1080x1920)
  instagram_story: {
    title: { x: 72, y: 286, textAlign: 'left' },
    subtitle: { x: 72, y: -1, textAlign: 'left' },
    date: { x: 72, y: 807, textAlign: 'left' },
    time: { x: 72, y: 970, textAlign: 'left' },
    location: { x: 72, y: 1133, textAlign: 'left' },
    illustration: { x: 63, y: 750, scale: 1.0, opacity: 0.15 },
    logo: { x: 0, y: 0, size: 0 }, // No logo in IG Story
  },

  // Facebook Post (base 1200x630)
  facebook_post: {
    title: { x: 63, y: -1, textAlign: 'left' }, // y=-1 means "auto: vertically centered"
    subtitle: { x: 63, y: -1, textAlign: 'left' },
    date: { x: 645, y: 200, textAlign: 'left' },
    time: { x: 645, y: 295, textAlign: 'left' },
    location: { x: 645, y: 390, textAlign: 'left' },
    illustration: { x: 50, y: 20, scale: 1.0, opacity: 0.13 },
    logo: { x: 1044, y: 512, size: 93 },
  },
};

/** Base dimensions for each format (before 2x scaling) */
export const FORMAT_DIMENSIONS: Record<FormatType, { width: number; height: number }> = {
  ppt_4_3: { width: 1024, height: 768 },
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  facebook_post: { width: 1200, height: 630 },
};

/** Illustration area dimensions per format (from compositor layout configs) */
export const ILLUSTRATION_AREA: Record<FormatType, { width: number; height: number }> = {
  ppt_4_3: { width: 470, height: 513 },
  instagram_post: { width: 954, height: 1041 },
  instagram_story: { width: 954, height: 1041 },
  facebook_post: { width: 545, height: 595 },
};

/** Title max width per format (for text alignment anchor calculation) */
export const TITLE_MAX_WIDTH: Record<FormatType, number> = {
  ppt_4_3: 600,
  instagram_post: 900,
  instagram_story: 900,
  facebook_post: 550,
};

/** Element metadata for the drag editor */
export const ELEMENT_META: Record<string, { label: string; color: string }> = {
  title: { label: 'Titulo', color: '#1A1A1A' },
  subtitle: { label: 'Subtitulo', color: '#B8923D' },
  date: { label: 'Fecha', color: '#B8923D' },
  time: { label: 'Hora', color: '#B8923D' },
  location: { label: 'Ubicacion', color: '#B8923D' },
  illustration: { label: 'Ilustracion', color: '#8A8A8A' },
  logo: { label: 'Logo', color: '#333333' },
};

/** Deep clone helper for ElementPositions */
export function clonePositions(positions: AllElementPositions): AllElementPositions {
  return JSON.parse(JSON.stringify(positions));
}
