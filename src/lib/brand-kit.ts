/**
 * Brand Kit CASA - Constantes de diseño centralizadas
 * Comunidad Anglicana San Andrés
 */

export const CASA_BRAND = {
  colors: {
    primary: {
      black: '#1A1A1A',
      amber: '#D4A853',
      white: '#F7F7F7'
    },
    secondary: {
      carbon: '#333333',
      grayDark: '#555555',
      grayMedium: '#8A8A8A',
      grayLight: '#E5E5E5'
    },
    amber: {
      light: '#E8C97A',
      main: '#D4A853',
      dark: '#B8923D'
    }
  },
  fonts: {
    heading: 'Merriweather',
    body: 'Montserrat'
  },
  slide: {
    width: 1024,
    height: 768,
    aspectRatio: '4:3',
    padding: 48,
    borderRadius: 8
  },
  typography: {
    h1: {
      fontFamily: 'Merriweather',
      fontWeight: 300,
      fontSize: '36px',
      letterSpacing: '0.05em'
    },
    h2: {
      fontFamily: 'Merriweather',
      fontWeight: 300,
      fontSize: '28px',
      letterSpacing: '0.05em'
    },
    h3: {
      fontFamily: 'Montserrat',
      fontWeight: 600,
      fontSize: '18px'
    },
    body: {
      fontFamily: 'Montserrat',
      fontWeight: 400,
      fontSize: '14px',
      lineHeight: 1.6
    },
    caption: {
      fontFamily: 'Montserrat',
      fontWeight: 400,
      fontSize: '11px'
    },
    slideTitle: {
      fontFamily: 'Merriweather',
      fontWeight: 300,
      fontSize: '48px',
      letterSpacing: '0.05em'
    },
    slideLyrics: {
      fontFamily: 'Montserrat',
      fontWeight: 400,
      fontSize: '28px',
      lineHeight: 1.8
    },
    slideIndicator: {
      fontFamily: 'Montserrat',
      fontWeight: 400,
      fontSize: '14px'
    }
  },
  ui: {
    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '20px'
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      xxl: '48px'
    }
  }
} as const;

/**
 * Estilos predefinidos para slides
 */
export const SLIDE_STYLES = {
  songTitle: {
    primaryColor: CASA_BRAND.colors.primary.black,
    backgroundColor: CASA_BRAND.colors.primary.white,
    primaryFont: CASA_BRAND.fonts.heading
  },
  songLyrics: {
    primaryColor: CASA_BRAND.colors.primary.black,
    backgroundColor: CASA_BRAND.colors.primary.white,
    primaryFont: CASA_BRAND.fonts.body
  },
  prayerFull: {
    primaryColor: CASA_BRAND.colors.primary.black,
    secondaryColor: CASA_BRAND.colors.primary.amber,
    backgroundColor: CASA_BRAND.colors.primary.white,
    primaryFont: CASA_BRAND.fonts.body,
    secondaryFont: CASA_BRAND.fonts.body
  }
} as const;

export type CasaBrand = typeof CASA_BRAND;
export type SlideStyles = typeof SLIDE_STYLES;

// Note: Theme-aware styling is now in @/lib/presentation/themes
// Import getThemedSlideStyles and PresentationTheme directly from there
