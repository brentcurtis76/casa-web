/**
 * Convierte elementos personalizados al formato SlideGroup de la arquitectura de liturgias
 */

import { v4 as uuidv4 } from 'uuid';
import type { CustomElementConfig } from '@/types/shared/liturgy';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import { getThemedSlideStyles, PresentationTheme, DEFAULT_THEME } from '@/lib/presentation/themes';

/**
 * Genera un ID unico
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Opciones para la generacion de slides de elementos personalizados
 */
export interface CustomElementToSlidesOptions {
  theme?: PresentationTheme;
}

/**
 * Convierte un elemento personalizado de tipo image-slide a SlideGroup
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup con el slide de imagen
 */
export function customImageSlideToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);
  const sourceId = `custom-${generateId()}`;

  const slides: Slide[] = [
    {
      id: generateId(),
      type: 'custom-image',
      content: {
        primary: config.title || config.label,
        subtitle: config.subtitle,
        imageUrl: config.imageUrl,
      },
      style: {
        primaryColor: themedStyles.title.primaryColor,
        backgroundColor: themedStyles.title.backgroundColor,
        primaryFont: themedStyles.title.primaryFont,
      },
      metadata: {
        sourceComponent: 'custom-element',
        sourceId,
        order: 1,
        groupTotal: 1,
      },
    },
  ];

  return {
    id: generateId(),
    type: 'custom',
    title: config.label,
    slides,
    metadata: {
      sourceComponent: 'custom-element',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte un elemento personalizado de tipo title-slide a SlideGroup
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup con el slide de titulo
 */
export function customTitleSlideToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);
  const sourceId = `custom-${generateId()}`;

  const slides: Slide[] = [
    {
      id: generateId(),
      type: 'title',
      content: {
        primary: config.titleText || config.label,
        subtitle: config.subtitleText,
      },
      style: {
        primaryColor: themedStyles.title.primaryColor,
        backgroundColor: themedStyles.title.backgroundColor,
        primaryFont: themedStyles.title.primaryFont,
      },
      metadata: {
        sourceComponent: 'custom-element',
        sourceId,
        order: 1,
        groupTotal: 1,
      },
    },
  ];

  return {
    id: generateId(),
    type: 'custom',
    title: config.label,
    slides,
    metadata: {
      sourceComponent: 'custom-element',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte un elemento personalizado de tipo call-response a SlideGroup
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup con slide de titulo + slides de tiempos (lider/congregacion)
 */
export function customCallResponseToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);
  const sourceId = `custom-${generateId()}`;
  const tiempos = config.tiempos || [];
  const totalSlides = 1 + tiempos.length;

  const slides: Slide[] = [];

  // Slide de titulo
  slides.push({
    id: generateId(),
    type: 'title',
    content: {
      primary: config.label,
    },
    style: {
      primaryColor: themedStyles.title.primaryColor,
      backgroundColor: themedStyles.title.backgroundColor,
      primaryFont: themedStyles.title.primaryFont,
    },
    metadata: {
      sourceComponent: 'custom-element',
      sourceId,
      order: 1,
      groupTotal: totalSlides,
    },
  });

  // Slides de tiempos (lider + congregacion)
  tiempos.forEach((tiempo, index) => {
    slides.push({
      id: generateId(),
      type: 'prayer-full',
      content: {
        primary: tiempo.lider,
        secondary: tiempo.congregacion,
      },
      style: {
        primaryColor: themedStyles.prayerFull.primaryColor,
        secondaryColor: themedStyles.prayerFull.secondaryColor,
        backgroundColor: themedStyles.prayerFull.backgroundColor,
        primaryFont: themedStyles.prayerFull.primaryFont,
        secondaryFont: themedStyles.prayerFull.secondaryFont,
      },
      metadata: {
        sourceComponent: 'custom-element',
        sourceId,
        order: index + 2,
        groupTotal: totalSlides,
      },
    });
  });

  return {
    id: generateId(),
    type: 'custom',
    title: config.label,
    slides,
    metadata: {
      sourceComponent: 'custom-element',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte un elemento personalizado de tipo text-slide a SlideGroup
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup con el slide de texto
 */
export function customTextSlideToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);
  const sourceId = `custom-${generateId()}`;

  const slides: Slide[] = [
    {
      id: generateId(),
      type: 'custom-text',
      content: {
        primary: config.bodyText || '',
        subtitle: config.title,
      },
      style: {
        primaryColor: themedStyles.announcement.primaryColor,
        backgroundColor: themedStyles.announcement.backgroundColor,
        primaryFont: themedStyles.announcement.primaryFont,
      },
      metadata: {
        sourceComponent: 'custom-element',
        sourceId,
        order: 1,
        groupTotal: 1,
      },
    },
  ];

  return {
    id: generateId(),
    type: 'custom',
    title: config.label,
    slides,
    metadata: {
      sourceComponent: 'custom-element',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte un elemento personalizado de tipo blank-slide a SlideGroup
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup con el slide en blanco
 */
export function customBlankSlideToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);
  const sourceId = `custom-${generateId()}`;

  const slides: Slide[] = [
    {
      id: generateId(),
      type: 'blank',
      content: {
        primary: '',
      },
      style: {
        backgroundColor: config.backgroundColor || themedStyles.title.backgroundColor,
      },
      metadata: {
        sourceComponent: 'custom-element',
        sourceId,
        order: 1,
        groupTotal: 1,
      },
    },
  ];

  return {
    id: generateId(),
    type: 'custom',
    title: config.label,
    slides,
    metadata: {
      sourceComponent: 'custom-element',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte cualquier elemento personalizado a SlideGroup, despachando segun customType
 * @param config - Configuracion del elemento personalizado
 * @param options - Opciones de generacion (incluye tema)
 * @returns SlideGroup correspondiente al subtipo del elemento
 */
export function customElementToSlides(
  config: CustomElementConfig,
  options?: CustomElementToSlidesOptions
): SlideGroup {
  switch (config.customType) {
    case 'image-slide':
      return customImageSlideToSlides(config, options);
    case 'title-slide':
      return customTitleSlideToSlides(config, options);
    case 'call-response':
      return customCallResponseToSlides(config, options);
    case 'text-slide':
      return customTextSlideToSlides(config, options);
    case 'blank-slide':
      return customBlankSlideToSlides(config, options);
    default:
      // Subtipo desconocido: devolver slide en blanco como fallback
      return customBlankSlideToSlides(
        { ...config, customType: 'blank-slide' },
        options
      );
  }
}
