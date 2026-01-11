/**
 * Conversión de Cuento a SlideGroup
 * Convierte un cuento ilustrado al formato compartido de slides para el compositor de liturgias
 */

import { v4 as uuidv4 } from 'uuid';
import type { Slide, SlideGroup, SlideType } from '@/types/shared/slide';
import type { Story } from '@/types/shared/story';
import { CASA_BRAND } from '@/lib/brand-kit';

/**
 * Genera un ID único
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Tipos extendidos para slides de cuentos
 */
type StorySlideType = SlideType | 'story-cover' | 'story-scene' | 'story-end';

/**
 * Slide extendido para cuentos con soporte para imágenes
 */
interface StorySlide extends Omit<Slide, 'type'> {
  type: StorySlideType;
  content: {
    primary: string;
    secondary?: string;
    subtitle?: string;
    imageUrl?: string;
    narratorText?: string;
  };
  notes?: string; // Notas del presentador (texto de la escena para el narrador)
}

/**
 * SlideGroup extendido para cuentos
 */
interface StorySlideGroup extends Omit<SlideGroup, 'type' | 'slides'> {
  type: 'story';
  slides: StorySlide[];
}

/**
 * Convierte un cuento completo a SlideGroup para el compositor
 * @param story - El cuento a convertir
 * @returns SlideGroup con todos los slides del cuento
 */
export function storyToSlides(story: Story): StorySlideGroup {
  const slides: StorySlide[] = [];

  // Calcular total de slides: portada + escenas + fin
  const totalSlides = 1 + story.scenes.length + 1;
  let order = 1;

  // Slide de portada - SOLO IMAGEN
  if (story.coverImageUrl) {
    slides.push({
      id: generateId(),
      type: 'story-cover',
      content: {
        primary: '', // Sin texto visible - la portada es solo imagen
        imageUrl: story.coverImageUrl,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.heading,
      },
      metadata: {
        sourceComponent: 'cuentacuentos',
        sourceId: story.id,
        order: order++,
        groupTotal: totalSlides,
      },
      notes: `📖 ${story.title}\n\nComienza el cuento...`,
    });
  }

  // Slides de escenas
  story.scenes.forEach((scene) => {
    if (scene.selectedImageUrl) {
      slides.push({
        id: generateId(),
        type: 'story-scene',
        content: {
          primary: '', // Las escenas son principalmente visuales
          imageUrl: scene.selectedImageUrl,
          narratorText: scene.text, // Texto para el narrador (no se muestra en el slide)
        },
        style: {
          primaryColor: CASA_BRAND.colors.primary.black,
          backgroundColor: CASA_BRAND.colors.primary.white,
          primaryFont: CASA_BRAND.fonts.body,
        },
        metadata: {
          sourceComponent: 'cuentacuentos',
          sourceId: story.id,
          order: order++,
          groupTotal: totalSlides,
        },
        notes: scene.text, // Texto de la escena como nota del presentador
      });
    }
  });

  // Slide final - SOLO IMAGEN (el "Fin" está en la imagen generada)
  if (story.endImageUrl) {
    slides.push({
      id: generateId(),
      type: 'story-end',
      content: {
        primary: '', // Sin texto visible - la imagen ya tiene "Fin"
        imageUrl: story.endImageUrl,
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.amber,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.heading,
      },
      metadata: {
        sourceComponent: 'cuentacuentos',
        sourceId: story.id,
        order: order++,
        groupTotal: totalSlides,
      },
      notes: '🎬 Fin del cuento',
    });
  }

  return {
    id: generateId(),
    type: 'story',
    title: story.title,
    slides,
    metadata: {
      sourceComponent: 'cuentacuentos',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Crea un SlideGroup vacío para un cuento en progreso
 * Útil para vista previa antes de que todas las imágenes estén listas
 */
export function createPreviewSlideGroup(story: Story): StorySlideGroup {
  const slides: StorySlide[] = [];
  const totalSlides = 1 + story.scenes.length + 1;
  let order = 1;

  // Slide de portada - SOLO IMAGEN (el título va en la imagen generada)
  slides.push({
    id: generateId(),
    type: 'story-cover',
    content: {
      primary: '', // Sin texto visible - la portada es solo imagen
      imageUrl: story.coverImageUrl || undefined,
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    metadata: {
      sourceComponent: 'cuentacuentos',
      sourceId: story.id,
      order: order++,
      groupTotal: totalSlides,
    },
    notes: `📖 ${story.title}\n\nComienza el cuento...`,
  });

  // Slides de escenas - SOLO IMAGEN (el texto va en narratorText para el narrador)
  story.scenes.forEach((scene) => {
    slides.push({
      id: generateId(),
      type: 'story-scene',
      content: {
        primary: '', // Sin texto visible - solo imagen
        imageUrl: scene.selectedImageUrl || undefined,
        narratorText: scene.text, // Texto para el narrador (no se muestra en el slide)
      },
      style: {
        primaryColor: CASA_BRAND.colors.primary.black,
        backgroundColor: CASA_BRAND.colors.primary.white,
        primaryFont: CASA_BRAND.fonts.body,
      },
      metadata: {
        sourceComponent: 'cuentacuentos',
        sourceId: story.id,
        order: order++,
        groupTotal: totalSlides,
      },
      notes: scene.text, // Texto de la escena como nota del presentador
    });
  });

  // Slide final - SOLO IMAGEN
  slides.push({
    id: generateId(),
    type: 'story-end',
    content: {
      primary: '', // Sin texto visible - la imagen ya tiene "Fin"
      imageUrl: story.endImageUrl || undefined,
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.amber,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
    },
    metadata: {
      sourceComponent: 'cuentacuentos',
      sourceId: story.id,
      order: order++,
      groupTotal: totalSlides,
    },
    notes: '🎬 Fin del cuento',
  });

  return {
    id: generateId(),
    type: 'story',
    title: story.title,
    slides,
    metadata: {
      sourceComponent: 'cuentacuentos',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Extrae el texto del narrador de todos los slides del cuento
 * Útil para generar el PDF del narrador
 */
export function extractNarratorText(slideGroup: StorySlideGroup): string[] {
  return slideGroup.slides
    .filter((slide) => slide.type === 'story-scene' && slide.content.narratorText)
    .map((slide) => slide.content.narratorText as string);
}

/**
 * Cuenta las escenas que tienen imagen seleccionada
 */
export function countCompletedScenes(story: Story): number {
  return story.scenes.filter((scene) => scene.selectedImageUrl).length;
}

/**
 * Verifica si el cuento está completo (todas las imágenes seleccionadas)
 */
export function isStoryComplete(story: Story): boolean {
  const hasAllSceneImages = story.scenes.every((scene) => scene.selectedImageUrl);
  const hasCover = !!story.coverImageUrl;
  const hasEnd = !!story.endImageUrl;

  return hasAllSceneImages && hasCover && hasEnd;
}

export type { StorySlide, StorySlideGroup };
