/**
 * Conversión de Elementos Fijos a SlideGroup
 * Convierte los elementos litúrgicos estáticos al formato compartido de slides
 */

import { Slide, SlideGroup, SlideType } from '@/types/shared/slide';
import { FixedElement, FixedSlide, FixedSlideType } from '@/types/shared/fixed-elements';
import { getThemedSlideStyles, PresentationTheme, DEFAULT_THEME } from '@/lib/presentation/themes';

/**
 * Genera un ID único para slides
 */
function generateId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mapea tipos de FixedSlide a SlideType compartido
 */
function mapFixedTypeToSlideType(fixedType: FixedSlideType): SlideType {
  const typeMap: Record<FixedSlideType, SlideType> = {
    'title': 'title',
    'liturgy-leader': 'prayer-leader',
    'liturgy-response': 'prayer-response',
    'liturgy-antiphonal': 'prayer-full',
    'prayer-congregational': 'prayer-response',
    'scripture': 'reading',
    'info': 'announcement',
    'instruction': 'title',
    'closing': 'blessing',
  };
  return typeMap[fixedType] || 'blank';
}

/**
 * Convierte un FixedSlide individual a Slide
 */
function fixedSlideToSlide(
  fixedSlide: FixedSlide,
  elementId: string,
  order: number,
  total: number,
  theme: PresentationTheme = DEFAULT_THEME
): Slide {
  const themedStyles = getThemedSlideStyles(theme);

  const baseSlide: Slide = {
    id: generateId(),
    type: mapFixedTypeToSlideType(fixedSlide.type),
    content: {
      primary: '',
    },
    style: {
      primaryColor: themedStyles.prayerLeader.primaryColor,
      backgroundColor: themedStyles.prayerLeader.backgroundColor,
      primaryFont: themedStyles.prayerLeader.primaryFont,
    },
    metadata: {
      sourceComponent: 'elementos-fijos',
      sourceId: elementId,
      order,
      groupTotal: total,
    },
  };

  switch (fixedSlide.type) {
    case 'title':
      return {
        ...baseSlide,
        type: 'title',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.title.primaryColor,
          backgroundColor: themedStyles.title.backgroundColor,
          primaryFont: themedStyles.title.primaryFont,
        },
      };

    case 'liturgy-leader':
      return {
        ...baseSlide,
        type: 'prayer-leader',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.prayerLeader.primaryColor,
          backgroundColor: themedStyles.prayerLeader.backgroundColor,
          primaryFont: themedStyles.prayerLeader.primaryFont,
        },
      };

    case 'liturgy-response':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.prayerResponse.primaryColor,
          backgroundColor: themedStyles.prayerResponse.backgroundColor,
          primaryFont: themedStyles.prayerResponse.primaryFont,
        },
      };

    case 'liturgy-antiphonal':
      return {
        ...baseSlide,
        type: 'prayer-full',
        content: {
          primary: fixedSlide.leader || '',
          secondary: fixedSlide.response || '',
        },
        style: {
          primaryColor: themedStyles.prayerFull.primaryColor,
          secondaryColor: themedStyles.prayerFull.secondaryColor,
          backgroundColor: themedStyles.prayerFull.backgroundColor,
          primaryFont: themedStyles.prayerFull.primaryFont,
          secondaryFont: themedStyles.prayerFull.secondaryFont,
        },
      };

    case 'prayer-congregational':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.prayerResponse.primaryColor,
          backgroundColor: themedStyles.prayerResponse.backgroundColor,
          primaryFont: themedStyles.prayerResponse.primaryFont,
        },
      };

    case 'scripture':
      return {
        ...baseSlide,
        type: 'reading',
        content: {
          primary: fixedSlide.content || '',
          subtitle: fixedSlide.reference,
        },
        style: {
          primaryColor: themedStyles.reading.primaryColor,
          backgroundColor: themedStyles.reading.backgroundColor,
          primaryFont: themedStyles.reading.primaryFont,
        },
      };

    case 'info':
      return {
        ...baseSlide,
        type: 'announcement',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.announcement.primaryColor,
          backgroundColor: themedStyles.announcement.backgroundColor,
          primaryFont: themedStyles.announcement.primaryFont,
        },
      };

    case 'instruction':
      return {
        ...baseSlide,
        type: 'title',
        content: {
          primary: fixedSlide.content || '',
          subtitle: fixedSlide.note,
        },
        style: {
          primaryColor: themedStyles.instruction.primaryColor,
          backgroundColor: themedStyles.instruction.backgroundColor,
          primaryFont: themedStyles.instruction.primaryFont,
        },
      };

    case 'closing':
      return {
        ...baseSlide,
        type: 'blessing',
        content: { primary: fixedSlide.content || '' },
        style: {
          primaryColor: themedStyles.blessing.primaryColor,
          backgroundColor: themedStyles.blessing.backgroundColor,
          primaryFont: themedStyles.blessing.primaryFont,
        },
      };

    default:
      return {
        ...baseSlide,
        content: { primary: fixedSlide.content || '' },
      };
  }
}

/**
 * Options for fixed element slide generation
 */
export interface FixedElementToSlidesOptions {
  theme?: PresentationTheme;
}

/**
 * Convierte un FixedElement completo a SlideGroup
 */
export function fixedElementToSlides(
  element: FixedElement,
  options?: FixedElementToSlidesOptions
): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;

  const slides = element.slides.map((slide, index) =>
    fixedSlideToSlide(slide, element.id, index + 1, element.slides.length, theme)
  );

  return {
    id: generateId(),
    type: 'prayer', // Los elementos fijos son principalmente oraciones/liturgia
    title: element.title,
    slides,
    metadata: {
      sourceComponent: 'elementos-fijos',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Convierte múltiples elementos fijos a SlideGroups
 */
export function fixedElementsToSlideGroups(
  elements: FixedElement[],
  options?: FixedElementToSlidesOptions
): SlideGroup[] {
  return elements.map((element) => fixedElementToSlides(element, options));
}

/**
 * Obtiene el tipo de SlideGroup basado en el tipo de elemento fijo
 */
export function getSlideGroupTypeFromElement(element: FixedElement): SlideGroup['type'] {
  const typeMap: Record<string, SlideGroup['type']> = {
    'paz': 'prayer',
    'oracion-comunitaria': 'prayer',
    'comunion': 'prayer',
    'eucaristia': 'prayer',
    'ofrenda': 'announcement',
    'bendicion': 'blessing',
  };
  return typeMap[element.type] || 'prayer';
}
