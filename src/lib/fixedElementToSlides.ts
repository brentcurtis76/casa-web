/**
 * Conversión de Elementos Fijos a SlideGroup
 * Convierte los elementos litúrgicos estáticos al formato compartido de slides
 */

import { Slide, SlideGroup, SlideType } from '@/types/shared/slide';
import { FixedElement, FixedSlide, FixedSlideType } from '@/types/shared/fixed-elements';
import { CASA_BRAND, SLIDE_STYLES } from '@/lib/brand-kit';

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
  total: number
): Slide {
  const baseSlide: Slide = {
    id: generateId(),
    type: mapFixedTypeToSlideType(fixedSlide.type),
    content: {
      primary: '',
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.body,
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
          ...baseSlide.style,
          primaryFont: CASA_BRAND.fonts.heading,
        },
      };

    case 'liturgy-leader':
      return {
        ...baseSlide,
        type: 'prayer-leader',
        content: { primary: fixedSlide.content || '' },
      };

    case 'liturgy-response':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.primary.amber,
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
          ...baseSlide.style,
          secondaryColor: CASA_BRAND.colors.primary.amber,
          secondaryFont: CASA_BRAND.fonts.body,
        },
      };

    case 'prayer-congregational':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.secondary.carbon,
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
      };

    case 'info':
      return {
        ...baseSlide,
        type: 'announcement',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.secondary.grayDark,
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
          ...baseSlide.style,
          primaryFont: CASA_BRAND.fonts.heading,
          primaryColor: CASA_BRAND.colors.secondary.grayMedium,
        },
      };

    case 'closing':
      return {
        ...baseSlide,
        type: 'blessing',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.primary.amber,
          primaryFont: CASA_BRAND.fonts.heading,
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
 * Convierte un FixedElement completo a SlideGroup
 */
export function fixedElementToSlides(element: FixedElement): SlideGroup {
  const slides = element.slides.map((slide, index) =>
    fixedSlideToSlide(slide, element.id, index + 1, element.slides.length)
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
export function fixedElementsToSlideGroups(elements: FixedElement[]): SlideGroup[] {
  return elements.map(fixedElementToSlides);
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
