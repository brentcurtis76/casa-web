/**
 * Servicio de presentación - Carga y procesa liturgias para el sistema de presentación
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import type { LiturgyElement, LiturgyElementType, PortadasConfig, IllustrationConfig } from '@/types/shared/liturgy';
import type { PresentationData, FlattenedElement } from './types';
import { migrateAllSlideImageUrls } from '@/lib/cuentacuentos/imageUtils';
import { CASA_BRAND } from '@/lib/brand-kit';

/**
 * Procesa los slides de cuentacuentos para migrar signed URLs a públicas
 * El bucket es público, por lo que las URLs públicas nunca expiran
 */
function migrateCuentacuentosSlides(slides: Slide[]): Slide[] {
  return migrateAllSlideImageUrls(slides);
}

/**
 * Migra slides de portadas para aplicar la configuración guardada a nivel de liturgia.
 * Si el slide no tiene illustrationConfig en metadata, aplica el config del liturgy.
 *
 * @param slides - Array de slides a migrar
 * @param portadasConfig - Configuración de portadas a nivel de liturgia
 */
function migratePortadasSlides(slides: Slide[], portadasConfig: PortadasConfig | null): Slide[] {
  if (!portadasConfig) return slides;

  return slides.map(slide => {
    // Only migrate portada slides (check by sourceComponent)
    const isPortada = slide.metadata?.sourceComponent === 'portadas-main' ||
                      slide.metadata?.sourceComponent === 'portadas-reflection';

    if (!isPortada) return slide;

    // Check if slide already has config in metadata
    const hasConfig = slide.metadata?.illustrationConfig != null;

    if (hasConfig) {
      // Slide already has config, keep it as-is
      return slide;
    }

    // Apply liturgy-level config to slide metadata
    return {
      ...slide,
      metadata: {
        ...slide.metadata,
        illustrationConfig: portadasConfig.illustrationConfig,
        textAlignment: portadasConfig.textAlignment,
        logoAlignment: portadasConfig.logoAlignment,
        titleBreakAfterWord: portadasConfig.titleBreakAfterWord,
      },
    };
  });
}

/**
 * Migra slides de elementos fijos para corregir colores de versiones antiguas.
 * Problema: prayer-congregational slides se guardaban con color 'carbon' (#333333)
 * pero el Constructor preview mostraba amber. Esto causa discrepancia Constructor/Presenter.
 *
 * Fix: prayer-response slides de elementos-fijos con color carbon → amber
 */
function migrateFixedElementSlideColors(slides: Slide[]): Slide[] {
  const CARBON_COLOR = '#333333';

  return slides.map(slide => {
    // Only fix slides from fixed elements
    if (slide.metadata?.sourceComponent !== 'elementos-fijos') {
      return slide;
    }

    // Fix prayer-response slides with old carbon color
    if (slide.type === 'prayer-response' && slide.style?.primaryColor === CARBON_COLOR) {
      return {
        ...slide,
        style: {
          ...slide.style,
          primaryColor: CASA_BRAND.colors.primary.amber,
        },
      };
    }

    return slide;
  });
}

/**
 * Migra slides de oraciones antifonales del formato antiguo al nuevo.
 * Formato antiguo: Slides separados de tipo 'prayer-leader' y 'prayer-response'
 * Formato nuevo: Un solo slide de tipo 'prayer-full' con primary (líder) y secondary (congregación)
 *
 * Esta función combina pares de prayer-leader + prayer-response en prayer-full slides.
 */
function migrateAntiphonalPrayerSlides(slides: Slide[]): Slide[] {
  const result: Slide[] = [];
  let i = 0;

  while (i < slides.length) {
    const current = slides[i];

    // Check if this is a prayer-leader followed by prayer-response
    if (current.type === 'prayer-leader' && i + 1 < slides.length) {
      const next = slides[i + 1];
      if (next.type === 'prayer-response') {
        // Combine into a prayer-full slide
        result.push({
          id: current.id,
          type: 'prayer-full',
          content: {
            primary: current.content.primary,    // Leader text
            secondary: next.content.primary,      // Congregation response
          },
          style: {
            ...current.style,
            secondaryColor: next.style.primaryColor || '#D4A537', // Amber for congregation
          },
          metadata: current.metadata,
        });
        i += 2; // Skip both slides
        continue;
      }
    }

    // Keep the slide as-is (including prayer-full, titles, and other types)
    result.push(current);
    i++;
  }

  return result;
}

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
    const { data, error } = await supabase
      .from('liturgias')
      .select('id, fecha, titulo, estado, porcentaje_completado')
      .order('fecha', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map((l) => ({
      id: l.id,
      fecha: l.fecha,
      titulo: l.titulo,
      estado: l.estado,
      porcentaje: l.porcentaje_completado,
    }));
  } catch {
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
      return null;
    }

    // Extract portadas config from liturgy (used to migrate old portada slides)
    const portadasConfig: PortadasConfig | null = liturgiaData.portadas_config as PortadasConfig | null;

    // Cargar elementos
    const { data: elementosData, error: elementosError } = await supabase
      .from('liturgia_elementos')
      .select('*')
      .eq('liturgia_id', liturgyId)
      .order('orden');

    if (elementosError) {
      return null;
    }

    // Aplanar slides y crear elementos
    const slides: Slide[] = [];
    const elements: FlattenedElement[] = [];

    console.log(`[Presenter] Loading ${(elementosData || []).length} elements from DB for liturgy ${liturgyId}`);
    console.log('[Presenter] Elements from DB:', (elementosData || []).map(e => ({
      tipo: e.tipo,
      orden: e.orden,
      status: e.status,
      hasSlides: !!e.slides,
      hasEditedSlides: !!e.edited_slides,
      slidesType: e.slides ? (Array.isArray(e.slides) ? 'array' : typeof e.slides) : 'null',
      slidesKeys: e.slides && typeof e.slides === 'object' ? Object.keys(e.slides) : [],
    })));

    for (const elemento of elementosData || []) {
      const startIndex = slides.length;

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

      console.log(`[Presenter] Element ${elemento.tipo} (order ${elemento.orden}): status=${elemento.status}, slides=${slideArray.length}, rawType=${rawSlides ? (Array.isArray(rawSlides) ? 'array' : typeof rawSlides) : 'null'}`);

      if (slideArray.length > 0) {
        // Para cuentacuentos, migrar signed URLs a públicas (el bucket es público)
        if (elemento.tipo === 'cuentacuentos') {
          slideArray = migrateCuentacuentosSlides(slideArray);
        }

        // Para oraciones antifonales, migrar del formato antiguo (prayer-leader/prayer-response)
        // al formato nuevo (prayer-full)
        if (elemento.tipo?.startsWith('oracion-')) {
          slideArray = migrateAntiphonalPrayerSlides(slideArray);
        }

        // Para portadas, migrar config del nivel de liturgia a metadata de slides
        if (elemento.tipo === 'portada-principal' || elemento.tipo === 'portada-reflexion') {
          slideArray = migratePortadasSlides(slideArray, portadasConfig);
        }

        // Para elementos fijos, migrar colores de versiones antiguas
        // (prayer-congregational se guardaba con carbon en vez de amber)
        const fixedElementTypes = ['padre-nuestro', 'paz', 'santa-cena', 'accion-gracias', 'ofrenda', 'bendicion'];
        if (fixedElementTypes.includes(elemento.tipo)) {
          slideArray = migrateFixedElementSlideColors(slideArray);
        }

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

    return {
      liturgyId: liturgiaData.id,
      liturgyTitle: liturgiaData.titulo,
      liturgyDate: new Date(liturgiaData.fecha + 'T12:00:00'),
      slides,
      elements,
    };
  } catch {
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
