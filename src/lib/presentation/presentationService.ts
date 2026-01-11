/**
 * Servicio de presentación - Carga y procesa liturgias para el sistema de presentación
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { LiturgyElement, LiturgyElementType } from '@/types/shared/liturgy';
import type { PresentationData, FlattenedElement } from './types';

/**
 * Resumen de liturgia para el selector
 */
export interface LiturgySummary {
  id: string;
  fecha: string;
  titulo: string;
  estado: string;
  porcentaje: number;
}

/**
 * Lista todas las liturgias disponibles para presentar
 * Solo muestra las que tienen al menos algunos slides
 */
export async function listLiturgiesForPresentation(): Promise<LiturgySummary[]> {
  try {
    // Check auth state
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[presentationService] Auth state:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
    });

    console.log('[presentationService] Fetching liturgias...');
    const { data, error } = await supabase
      .from('liturgias')
      .select('id, fecha, titulo, estado, porcentaje_completado')
      .order('fecha', { ascending: false });

    console.log('[presentationService] Liturgias result:', {
      count: data?.length || 0,
      data,
      error
    });

    if (error) {
      console.error('Error listing liturgias:', error);
      return [];
    }

    return (data || []).map((l) => ({
      id: l.id,
      fecha: l.fecha,
      titulo: l.titulo,
      estado: l.estado,
      porcentaje: l.porcentaje_completado,
    }));
  } catch (err) {
    console.error('Error in listLiturgiesForPresentation:', err);
    return [];
  }
}

/**
 * Carga una liturgia y la procesa para presentación
 * Aplana todos los slides en un solo array y crea el mapa de elementos
 */
export async function loadLiturgyForPresentation(liturgyId: string): Promise<PresentationData | null> {
  try {
    // Cargar liturgia principal
    const { data: liturgiaData, error: liturgiaError } = await supabase
      .from('liturgias')
      .select('*')
      .eq('id', liturgyId)
      .single();

    if (liturgiaError || !liturgiaData) {
      console.error('Error loading liturgia:', liturgiaError);
      return null;
    }

    // Cargar elementos
    const { data: elementosData, error: elementosError } = await supabase
      .from('liturgia_elementos')
      .select('*')
      .eq('liturgia_id', liturgyId)
      .order('orden');

    if (elementosError) {
      console.error('Error loading elementos:', elementosError);
      return null;
    }

    // Aplanar slides y crear elementos
    const slides: Slide[] = [];
    const elements: FlattenedElement[] = [];

    console.log('[presentationService] Processing', elementosData?.length || 0, 'elementos');

    for (const elemento of elementosData || []) {
      const startIndex = slides.length;

      // Debug: ver estructura exacta de los datos
      console.log('[presentationService] Raw element data:', elemento.tipo, {
        slidesRaw: elemento.slides,
        editedSlidesRaw: elemento.edited_slides,
        slidesType: typeof elemento.slides,
        slidesIsArray: Array.isArray(elemento.slides),
        hasNestedSlides: elemento.slides && typeof elemento.slides === 'object' && 'slides' in (elemento.slides as object),
      });

      // Obtener slides del elemento (pueden estar en slides o editedSlides)
      // El formato puede ser SlideGroup { slides: Slide[] } o directamente Slide[]
      let slideArray: Slide[] = [];

      const rawSlides = elemento.edited_slides || elemento.slides;
      if (rawSlides) {
        if (Array.isArray(rawSlides)) {
          // Es directamente un array de Slides
          slideArray = rawSlides as Slide[];
        } else if (typeof rawSlides === 'object' && 'slides' in rawSlides) {
          // Es un SlideGroup con { slides: Slide[] }
          slideArray = (rawSlides as SlideGroup).slides || [];
        }
      }

      console.log('[presentationService] Element:', elemento.tipo, {
        hasSlides: !!elemento.slides,
        hasEditedSlides: !!elemento.edited_slides,
        slideCount: slideArray.length,
        firstSlideType: slideArray[0]?.type,
        firstSlideHasImage: !!slideArray[0]?.content?.imageUrl,
      });

      if (slideArray.length > 0) {
        // Agregar slides al array aplanado
        slides.push(...slideArray);

        // Crear elemento aplanado para navegación
        elements.push({
          id: elemento.id,
          type: elemento.tipo as LiturgyElementType,
          title: elemento.titulo || getElementLabel(elemento.tipo as LiturgyElementType),
          startSlideIndex: startIndex,
          endSlideIndex: slides.length - 1,
          slideCount: slideArray.length,
          notes: undefined, // TODO: agregar notas cuando se implementen
        });
      }
    }

    // Si no hay slides, agregar un slide en blanco
    if (slides.length === 0) {
      slides.push({
        id: 'blank-1',
        type: 'blank',
        content: { primary: '' },
        style: { backgroundColor: '#F7F7F7' },
        metadata: {
          sourceComponent: 'presentation',
          sourceId: liturgyId,
          order: 1,
          groupTotal: 1,
        },
      });
    }

    console.log('[presentationService] Final result:', {
      liturgyId: liturgiaData.id,
      totalSlides: slides.length,
      totalElements: elements.length,
      elementSummary: elements.map(e => `${e.type}: ${e.slideCount} slides`),
    });

    return {
      liturgyId: liturgiaData.id,
      liturgyTitle: liturgiaData.titulo,
      liturgyDate: new Date(liturgiaData.fecha + 'T12:00:00'),
      slides,
      elements,
    };
  } catch (err) {
    console.error('Error in loadLiturgyForPresentation:', err);
    return null;
  }
}

/**
 * Obtiene la etiqueta legible de un tipo de elemento
 */
function getElementLabel(type: LiturgyElementType): string {
  const labels: Record<LiturgyElementType, string> = {
    'portada-principal': 'Portada Principal',
    'oracion-invocacion': 'Invocacion',
    'cancion-invocacion': 'Cancion de Invocacion',
    'oracion-arrepentimiento': 'Arrepentimiento',
    'cancion-arrepentimiento': 'Cancion de Arrepentimiento',
    'oracion-gratitud': 'Gratitud',
    'cancion-gratitud': 'Cancion de Gratitud',
    'lectura-biblica': 'Lectura Biblica',
    'cuentacuentos': 'Cuentacuentos',
    'portada-reflexion': 'Reflexion',
    'padre-nuestro': 'Padre Nuestro',
    'paz': 'La Paz',
    'santa-cena': 'Santa Cena',
    'accion-gracias': 'Accion de Gracias',
    'cancion-santa-cena': 'Cancion de Santa Cena',
    'ofrenda': 'Ofrenda',
    'anuncios': 'Anuncios',
    'bendicion': 'Bendicion',
  };
  return labels[type] || type;
}

/**
 * Encuentra el indice del elemento que contiene un slide dado
 */
export function findElementForSlide(
  elements: FlattenedElement[],
  slideIndex: number
): number {
  for (let i = 0; i < elements.length; i++) {
    if (slideIndex >= elements[i].startSlideIndex && slideIndex <= elements[i].endSlideIndex) {
      return i;
    }
  }
  return 0;
}
