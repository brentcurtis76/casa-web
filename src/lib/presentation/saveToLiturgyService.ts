/**
 * Servicio para guardar cambios de presentación permanentemente en la liturgia
 * Phase 1.6: Presentation Persistence - Save to Liturgy
 *
 * Este servicio permite:
 * - Guardar estilos de presentación en la liturgia
 * - Convertir slides temporales a slides permanentes en elementos
 * - Verificar permisos de escritura
 *
 * FIXES APPLIED (PROMPT_015b):
 * - Transaction ordering: slides saved first (more likely to fail), then styles
 * - Deep equality for change detection instead of JSON.stringify
 * - Extensible slide type to element type mapping
 * - tempEdits applied when converting slides
 * - Reduced console.error logging
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide } from '@/types/shared/slide';
import type {
  StyleState,
  LogoState,
  TextOverlayState,
  TempSlideEdit,
} from './types';

// ============================================
// TYPES
// ============================================

/**
 * Datos de estilos de presentación guardados en la liturgia
 */
export interface LiturgyPresentationStyles {
  globalStyles: StyleState['globalStyles'];
  elementStyles: StyleState['elementStyles'];
  slideStyles: StyleState['slideStyles'];
  logoState: LogoState;
  textOverlayState: TextOverlayState;
}

/**
 * Resumen de cambios a guardar
 */
export interface SaveToLiturgyChangeSummary {
  tempSlides: {
    count: number;
    items: Array<{
      id: string;
      type: string;
      previewText: string;
    }>;
  };
  hasStyleChanges: boolean;
  hasLogoChanges: boolean;
  hasTextOverlayChanges: boolean;
}

/**
 * Resultado de guardar en la liturgia
 */
export interface SaveToLiturgyResult {
  success: boolean;
  error?: string;
  savedSlideIds?: Record<string, string>; // temp-id -> permanent-id mapping
}

// ============================================
// UTILITIES
// ============================================

/**
 * Deep equality check for objects
 * Handles nested objects and arrays properly
 * Used instead of JSON.stringify for reliable comparison
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key =>
    keysB.includes(key) &&
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}

/**
 * Maps slide types to liturgia_elementos types
 * Add new mappings here as slide types are added
 */
const SLIDE_TYPE_TO_ELEMENT_TYPE: Record<string, string> = {
  'reading': 'lectura-adicional',
  'scripture': 'lectura-adicional',
  'bible-verse': 'lectura-adicional',
  'announcement': 'anuncio-adicional',
  'announcement-image': 'anuncio-adicional',
  'quick-text': 'anuncio-adicional',
  'text': 'anuncio-adicional',
  'blank': 'transicion',
  'black': 'transicion',
  'title': 'titulo-adicional',
  'image': 'imagen-adicional',
  'song-title': 'cancion-adicional',
  'song-lyrics': 'cancion-adicional',
  'prayer-leader': 'oracion-adicional',
  'prayer-response': 'oracion-adicional',
  'prayer-full': 'oracion-adicional',
  'creed': 'credo-adicional',
  'blessing': 'bendicion-adicional',
  // Default fallback is 'contenido-adicional'
};

/**
 * Gets the element type for a given slide type
 * Uses configurable mapping with partial matching and fallback
 */
function getElementTypeForSlide(slideType: string): string {
  const normalizedType = slideType.toLowerCase().replace(/-/g, '_');

  // Check direct match
  if (SLIDE_TYPE_TO_ELEMENT_TYPE[slideType]) {
    return SLIDE_TYPE_TO_ELEMENT_TYPE[slideType];
  }

  // Check normalized match
  if (SLIDE_TYPE_TO_ELEMENT_TYPE[normalizedType]) {
    return SLIDE_TYPE_TO_ELEMENT_TYPE[normalizedType];
  }

  // Check partial matches
  for (const [key, value] of Object.entries(SLIDE_TYPE_TO_ELEMENT_TYPE)) {
    if (slideType.includes(key) || normalizedType.includes(key.replace(/-/g, '_'))) {
      return value;
    }
  }

  // Fallback
  return 'contenido-adicional';
}

// ============================================
// PERMISSION CHECK
// ============================================

/**
 * Verifica si el usuario puede guardar en la liturgia
 * Por ahora solo verifica que esté autenticado
 * En Phase 2, esto verificará roles específicos
 */
export async function canSaveToLiturgy(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // For now, allow all authenticated users
    // In Phase 2, this will check specific roles (liturgist, general_admin)
    return true;
  } catch {
    return false;
  }
}

// ============================================
// CHANGE DETECTION
// ============================================

/**
 * Calcula un resumen de los cambios que se guardarán
 * Uses deep equality for reliable comparison
 */
export function calculateChangeSummary(
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  defaultLogoState: LogoState,
  defaultTextOverlayState: TextOverlayState
): SaveToLiturgyChangeSummary {
  // Filter temp slides (those with 'temp-' or 'imported-' prefix)
  const tempSlides = slides.filter(
    s => s.id.startsWith('temp-') || s.id.startsWith('imported-')
  );

  // Check for style changes
  const hasStyleChanges =
    styleState.globalStyles !== null ||
    Object.keys(styleState.elementStyles).length > 0 ||
    Object.keys(styleState.slideStyles).length > 0;

  // Check for logo changes using deep equality
  const hasLogoChanges = !deepEqual(logoState, defaultLogoState);

  // Check for text overlay changes using deep equality
  const hasTextOverlayChanges =
    textOverlayState.overlays.length > 0 &&
    !deepEqual(textOverlayState, defaultTextOverlayState);

  return {
    tempSlides: {
      count: tempSlides.length,
      items: tempSlides.map(s => ({
        id: s.id,
        type: s.type,
        previewText: s.content.primary?.slice(0, 50) || '[Sin texto]',
      })),
    },
    hasStyleChanges,
    hasLogoChanges,
    hasTextOverlayChanges,
  };
}

// ============================================
// STYLE OPERATIONS
// ============================================

/**
 * Guarda los estilos de presentación en la tabla liturgias
 */
export async function savePresentationStyles(
  liturgyId: string,
  styles: LiturgyPresentationStyles
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('liturgias')
      .update({
        presentation_styles: styles as unknown as Record<string, unknown>,
      })
      .eq('id', liturgyId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/**
 * Carga los estilos de presentación guardados en una liturgia
 */
export async function loadPresentationStyles(
  liturgyId: string
): Promise<LiturgyPresentationStyles | null> {
  try {
    const { data, error } = await supabase
      .from('liturgias')
      .select('presentation_styles')
      .eq('id', liturgyId)
      .single();

    if (error || !data?.presentation_styles) {
      return null;
    }

    return data.presentation_styles as unknown as LiturgyPresentationStyles;
  } catch {
    return null;
  }
}

// ============================================
// SLIDE CONVERSION
// ============================================

/**
 * Converts a temp slide to permanent, applying any temp edits
 * Generates a new ID without the 'temp-' or 'imported-' prefix
 */
function convertTempSlide(
  tempSlide: Slide,
  tempEdits: Record<string, TempSlideEdit>
): Slide {
  // Generate permanent ID based on type
  const typePrefix = tempSlide.type.toLowerCase().replace(/-/g, '_');
  const permanentId = `${typePrefix}_${crypto.randomUUID()}`;

  // Check if there are edits for this slide
  const edit = tempEdits[tempSlide.id];

  // Apply edits to content if they exist
  const content = edit
    ? { ...tempSlide.content, ...edit.content }
    : tempSlide.content;

  return {
    ...tempSlide,
    id: permanentId,
    content,
    metadata: {
      ...tempSlide.metadata,
      sourceComponent: tempSlide.metadata.sourceComponent.replace('temp-', ''),
    },
  };
}

/**
 * Guarda slides temporales como permanentes en los elementos de la liturgia
 *
 * NOTA: Esta es una implementación simplificada.
 * Los slides temporales se agregan como nuevos elementos al final.
 * En una implementación más completa, se podrían insertar en posiciones específicas.
 */
export async function saveTempSlidesToLiturgy(
  liturgyId: string,
  tempSlides: Slide[],
  tempEdits: Record<string, TempSlideEdit> = {}
): Promise<{ success: boolean; error?: string; savedSlideIds?: Record<string, string> }> {
  if (tempSlides.length === 0) {
    return { success: true, savedSlideIds: {} };
  }

  try {
    // Convert temp slides to permanent, applying any edits
    const savedSlideIds: Record<string, string> = {};
    const permanentSlides = tempSlides.map(tempSlide => {
      const permanentSlide = convertTempSlide(tempSlide, tempEdits);
      savedSlideIds[tempSlide.id] = permanentSlide.id;
      return permanentSlide;
    });

    // Get the highest order number from existing elements
    const { data: existingElements, error: fetchError } = await supabase
      .from('liturgia_elementos')
      .select('orden')
      .eq('liturgia_id', liturgyId)
      .order('orden', { ascending: false })
      .limit(1);

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const nextOrder = (existingElements?.[0]?.orden ?? 0) + 1;

    // Group slides by type for better organization
    const slidesByType = permanentSlides.reduce((acc, slide) => {
      const type = slide.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(slide);
      return acc;
    }, {} as Record<string, Slide[]>);

    // Insert each group as a separate element
    let currentOrder = nextOrder;
    for (const [slideType, slides] of Object.entries(slidesByType)) {
      // Use extensible mapping function
      const elementType = getElementTypeForSlide(slideType);

      const { error: insertError } = await supabase
        .from('liturgia_elementos')
        .insert({
          liturgia_id: liturgyId,
          tipo: elementType,
          orden: currentOrder,
          titulo: `Contenido guardado (${slides.length} slides)`,
          slides: {
            id: crypto.randomUUID(),
            type: 'saved-content',
            title: 'Contenido guardado',
            slides: slides,
            metadata: {
              sourceComponent: 'presenter-save',
              createdAt: new Date().toISOString(),
            },
          },
          status: 'completed',
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      currentOrder++;
    }

    return { success: true, savedSlideIds };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

// ============================================
// MAIN SAVE FUNCTION
// ============================================

/**
 * Guarda todos los cambios de presentación en la liturgia
 * Esta es la función principal que combina estilos y slides
 *
 * TRANSACTION ORDER (PROMPT_015b fix):
 * 1. Slides saved FIRST (more complex operation, more likely to fail)
 * 2. Styles saved SECOND (simpler operation, less likely to fail)
 *
 * This minimizes the chance of partial saves where styles exist without slides.
 */
export async function saveToLiturgy(
  liturgyId: string,
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  tempEdits: Record<string, TempSlideEdit>
): Promise<SaveToLiturgyResult> {
  // Verify permissions first
  const canSave = await canSaveToLiturgy();
  if (!canSave) {
    return {
      success: false,
      error: 'No tienes permisos para guardar en esta liturgia',
    };
  }

  // Filter temp slides
  const tempSlides = slides.filter(
    s => s.id.startsWith('temp-') || s.id.startsWith('imported-')
  );

  // Prepare styles object
  const styles: LiturgyPresentationStyles = {
    globalStyles: styleState.globalStyles,
    elementStyles: styleState.elementStyles,
    slideStyles: styleState.slideStyles,
    logoState,
    textOverlayState,
  };

  // STEP 1: Save temp slides FIRST (more likely to fail due to complexity)
  let savedSlideIds: Record<string, string> = {};
  if (tempSlides.length > 0) {
    const slidesResult = await saveTempSlidesToLiturgy(liturgyId, tempSlides, tempEdits);
    if (!slidesResult.success) {
      return {
        success: false,
        error: `Error al guardar diapositivas: ${slidesResult.error}`,
      };
    }
    savedSlideIds = slidesResult.savedSlideIds || {};
  }

  // STEP 2: Save styles SECOND (simpler operation, less likely to fail)
  const stylesResult = await savePresentationStyles(liturgyId, styles);
  if (!stylesResult.success) {
    // Slides were already saved - this is a partial save scenario
    // Log a warning but still report partial success info in error
    console.warn('[saveToLiturgy] PARTIAL SAVE: Slides saved but styles failed. LiturgyId:', liturgyId);
    return {
      success: false,
      error: `Error al guardar estilos: ${stylesResult.error}. Las diapositivas se guardaron correctamente.`,
      savedSlideIds, // Return the IDs even on partial failure
    };
  }

  return { success: true, savedSlideIds };
}
