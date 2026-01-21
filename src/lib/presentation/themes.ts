/**
 * Presentation Theme System
 * Controls visual appearance of all generated slides
 */

import { CASA_BRAND } from '@/lib/brand-kit';

export type PresentationTheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  primaryText: string;
  secondaryText: string;
  accent: string;
  accentText: string;
}

export interface ThemeAssets {
  logoUrl: string;
}

export interface Theme {
  id: PresentationTheme;
  name: string;
  colors: ThemeColors;
  assets: ThemeAssets;
}

export const THEMES: Record<PresentationTheme, Theme> = {
  light: {
    id: 'light',
    name: 'Claro',
    colors: {
      background: CASA_BRAND.colors.primary.white,      // #F7F7F7
      primaryText: CASA_BRAND.colors.primary.black,     // #1A1A1A
      secondaryText: CASA_BRAND.colors.secondary.grayDark, // #555555
      accent: CASA_BRAND.colors.primary.amber,          // #D4A853
      accentText: CASA_BRAND.colors.primary.black,      // #1A1A1A
    },
    assets: {
      logoUrl: '/images/logo-casa-dark.svg',  // Dark logo for light backgrounds
    },
  },
  dark: {
    id: 'dark',
    name: 'Oscuro',
    colors: {
      background: CASA_BRAND.colors.primary.black,      // #1A1A1A
      primaryText: CASA_BRAND.colors.primary.white,     // #F7F7F7
      secondaryText: CASA_BRAND.colors.secondary.grayLight, // #E5E5E5
      accent: CASA_BRAND.colors.primary.amber,          // #D4A853
      accentText: CASA_BRAND.colors.primary.black,      // #1A1A1A
    },
    assets: {
      logoUrl: '/images/logo-casa-white.svg', // White logo for dark backgrounds
    },
  },
};

export const DEFAULT_THEME: PresentationTheme = 'light';

/**
 * Get theme configuration by ID
 */
export function getTheme(themeId: PresentationTheme): Theme {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

/**
 * Get colors for AI prompt generation
 * Returns color descriptions for prompts that generate content
 */
export function getThemePromptColors(themeId: PresentationTheme): {
  background: string;
  text: string;
  accent: string;
} {
  return {
    background: themeId === 'dark' ? 'negro' : 'blanco',
    text: themeId === 'dark' ? 'blanco' : 'negro',
    accent: 'dorado/ámbar (#D4A853)',
  };
}

/**
 * Get slide styles based on theme
 * Provides consistent styling for all slide generators
 */
export function getThemedSlideStyles(theme: PresentationTheme) {
  const themeConfig = getTheme(theme);
  return {
    songTitle: {
      primaryColor: themeConfig.colors.primaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    songLyrics: {
      primaryColor: themeConfig.colors.primaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
    },
    prayerFull: {
      primaryColor: themeConfig.colors.primaryText,
      secondaryColor: themeConfig.colors.accent,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
      secondaryFont: CASA_BRAND.fonts.body,
    },
    prayerLeader: {
      primaryColor: themeConfig.colors.primaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
    },
    prayerResponse: {
      primaryColor: themeConfig.colors.accent,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
    },
    title: {
      primaryColor: themeConfig.colors.primaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    reading: {
      primaryColor: themeConfig.colors.primaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
    },
    announcement: {
      primaryColor: themeConfig.colors.secondaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.body,
    },
    blessing: {
      primaryColor: themeConfig.colors.accent,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    instruction: {
      primaryColor: themeConfig.colors.secondaryText,
      backgroundColor: themeConfig.colors.background,
      primaryFont: CASA_BRAND.fonts.heading,
    },
  };
}
