/**
 * Convierte elementos fijos (JSON) a formato SlideGroup para presentación
 * Elementos Fijos: La Paz, Padre Nuestro, Santa Cena, Acción de Gracias, Ofrenda, Bendición
 */

import { v4 as uuidv4 } from 'uuid';
import type { Slide, SlideGroup, SlideType } from '@/types/shared/slide';
import type { FixedElement, FixedSlide, FixedSlideType } from '@/types/shared/fixed-elements';
import { CASA_BRAND } from '@/lib/brand-kit';

/**
 * Mapea tipos de slides de elementos fijos a tipos de slides estándar
 */
const mapFixedSlideType = (fixedType: FixedSlideType): SlideType => {
  const typeMap: Record<FixedSlideType, SlideType> = {
    'title': 'title',
    'liturgy-leader': 'prayer-leader',
    'liturgy-response': 'prayer-response',
    'liturgy-antiphonal': 'prayer-full',
    'prayer-congregational': 'prayer-full',
    'scripture': 'reading',
    'info': 'announcement',
    'instruction': 'announcement',
    'closing': 'blessing',
  };
  return typeMap[fixedType] || 'blank';
};

/**
 * Determina colores según el tipo de slide
 */
const getSlideColors = (fixedType: FixedSlideType): { primary: string; secondary?: string; background: string } => {
  switch (fixedType) {
    case 'title':
      return {
        primary: CASA_BRAND.colors.primary.amber,
        background: CASA_BRAND.colors.primary.black,
      };
    case 'liturgy-leader':
      return {
        primary: CASA_BRAND.colors.primary.black,
        background: CASA_BRAND.colors.primary.white,
      };
    case 'liturgy-response':
      return {
        primary: CASA_BRAND.colors.primary.amber,
        background: CASA_BRAND.colors.primary.black,
      };
    case 'liturgy-antiphonal':
      return {
        primary: CASA_BRAND.colors.primary.black,
        secondary: CASA_BRAND.colors.primary.amber,
        background: CASA_BRAND.colors.primary.white,
      };
    case 'prayer-congregational':
      return {
        primary: CASA_BRAND.colors.primary.black,
        background: CASA_BRAND.colors.primary.white,
      };
    case 'scripture':
      return {
        primary: CASA_BRAND.colors.primary.black,
        background: CASA_BRAND.colors.secondary.grayLight,
      };
    case 'info':
    case 'instruction':
      return {
        primary: CASA_BRAND.colors.secondary.grayDark,
        background: CASA_BRAND.colors.secondary.grayLight,
      };
    case 'closing':
      return {
        primary: CASA_BRAND.colors.primary.amber,
        background: CASA_BRAND.colors.primary.black,
      };
    default:
      return {
        primary: CASA_BRAND.colors.primary.black,
        background: CASA_BRAND.colors.primary.white,
      };
  }
};

/**
 * Convierte un FixedSlide individual a Slide estándar
 */
const convertFixedSlideToSlide = (
  fixedSlide: FixedSlide,
  elementId: string,
  index: number,
  total: number
): Slide => {
  const colors = getSlideColors(fixedSlide.type);

  return {
    id: uuidv4(),
    type: mapFixedSlideType(fixedSlide.type),
    content: {
      primary: fixedSlide.content || fixedSlide.leader || '',
      secondary: fixedSlide.response,
      subtitle: fixedSlide.note || fixedSlide.reference,
    },
    style: {
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      backgroundColor: colors.background,
      primaryFont: CASA_BRAND.fonts.heading,
      secondaryFont: CASA_BRAND.fonts.body,
    },
    metadata: {
      sourceComponent: 'elementos-fijos',
      sourceId: elementId,
      order: index + 1,
      groupTotal: total,
    },
  };
};

/**
 * Determina el tipo de grupo de slides según el tipo de elemento fijo
 */
const getSlideGroupType = (elementType: string): 'prayer' | 'blessing' | 'announcement' => {
  switch (elementType) {
    case 'bendicion':
      return 'blessing';
    case 'ofrenda':
      return 'announcement';
    default:
      return 'prayer';
  }
};

/**
 * Convierte un FixedElement completo a SlideGroup
 * @param element Elemento fijo con sus slides
 * @returns SlideGroup compatible con el sistema de presentación
 */
export const fixedElementToSlides = (element: FixedElement): SlideGroup => {
  const slides = element.slides.map((slide, index) =>
    convertFixedSlideToSlide(slide, element.id, index, element.slides.length)
  );

  return {
    id: uuidv4(),
    type: getSlideGroupType(element.type),
    title: element.title,
    slides,
    metadata: {
      sourceComponent: 'elementos-fijos',
      createdAt: new Date().toISOString(),
    },
  };
};

/**
 * Carga un elemento fijo por ID y lo convierte a SlideGroup
 * @param elementId ID del elemento fijo (ej: 'la-paz', 'padre-nuestro')
 * @returns Promise con el SlideGroup o null si no existe
 */
export const loadFixedElementAsSlides = async (elementId: string): Promise<SlideGroup | null> => {
  try {
    // Importación dinámica del JSON
    const module = await import(`@/data/elementos-fijos/${elementId}.json`);
    const element = module.default as FixedElement;
    return fixedElementToSlides(element);
  } catch (error) {
    console.error(`Error loading fixed element ${elementId}:`, error);
    return null;
  }
};

/**
 * Carga todos los elementos fijos disponibles
 * @returns Promise con array de FixedElement
 */
export const loadAllFixedElements = async (): Promise<FixedElement[]> => {
  try {
    const indexModule = await import('@/data/elementos-fijos/index.json');
    const index = indexModule.default as { elements: Array<{ id: string }> };

    const elements: FixedElement[] = [];
    for (const entry of index.elements) {
      try {
        const module = await import(`@/data/elementos-fijos/${entry.id}.json`);
        elements.push(module.default as FixedElement);
      } catch (error) {
        console.error(`Error loading element ${entry.id}:`, error);
      }
    }

    return elements;
  } catch (error) {
    console.error('Error loading fixed elements index:', error);
    return [];
  }
};

/**
 * Obtiene estadísticas de un elemento fijo
 */
export const getFixedElementStats = (element: FixedElement): {
  totalSlides: number;
  hasLeaderParts: boolean;
  hasResponses: boolean;
  hasScripture: boolean;
} => {
  return {
    totalSlides: element.slides.length,
    hasLeaderParts: element.slides.some(s => s.type === 'liturgy-leader'),
    hasResponses: element.slides.some(s => s.type === 'liturgy-response' || s.type === 'liturgy-antiphonal'),
    hasScripture: element.slides.some(s => s.type === 'scripture'),
  };
};

export default fixedElementToSlides;
