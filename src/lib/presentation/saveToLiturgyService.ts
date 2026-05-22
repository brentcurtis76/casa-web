/**
 * Servicio para guardar cambios de presentación permanentemente en la liturgia
 *
 * Refactor (subtarea 3):
 * - Detecta cada run contiguo de slides `temp-`/`imported-` y crea UN row de
 *   liturgia_elementos por run, posicionando entre los elementos reales que ya
 *   existen.
 * - Persiste también cambios de membresía: si un slide guardado fue movido a
 *   otro elemento via reorder en memoria, el row destino lo recibe y el row
 *   origen lo pierde.
 * - Reempaqueta `orden` a enteros consecutivos en el mismo flujo.
 *
 * Mantiene:
 * - Aplicación de `tempEdits` al convertir slides.
 * - Guardado de estilos / logo / overlays en `liturgias.presentation_styles`.
 * - Filtro por prefijos `temp-` / `imported-`.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide } from '@/types/shared/slide';
import { CUSTOM_TIPO_PREFIX } from '@/types/shared/liturgy';
import type {
  StyleState,
  LogoState,
  TextOverlayState,
  TempSlideEdit,
  FlattenedElement,
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
 * Descripción en español de la posición donde quedará un run nuevo.
 * Ej. `3 imágenes después de Lectura Bíblica`, `4 imágenes al final`,
 * `2 diapositivas al inicio`.
 */
export interface SaveToLiturgyPositionSummary {
  count: number;
  isImages: boolean;
  label: string; // texto listo para mostrar en UI
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
    /** Resumen por posición (uno por cada run contiguo a persistir). */
    positions: SaveToLiturgyPositionSummary[];
  };
  /** Membresías de slides guardados que cambiaron de elemento en memoria. */
  movedSavedSlidesCount: number;
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
  /** Cantidad de slides temporales convertidos y guardados. */
  slidesSavedCount?: number;
  /** Cantidad de posiciones distintas en las que se distribuyeron esos slides. */
  positionsSavedCount?: number;
}

// ============================================
// UTILITIES
// ============================================

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

function isTempSlideId(id: string): boolean {
  return id.startsWith('temp-') || id.startsWith('imported-');
}

/**
 * Determina si un elemento es un run nuevo (sin row en DB) compuesto solo por
 * slides temporales/importados.
 */
function isNewTempRunElement(el: FlattenedElement, slides: Slide[]): boolean {
  if (!el.isSynthetic || el.dbElementId) return false;
  if (el.slideCount <= 0) return false;
  for (let i = el.startSlideIndex; i <= el.endSlideIndex; i++) {
    const s = slides[i];
    if (!s || !isTempSlideId(s.id)) return false;
  }
  return true;
}

// ============================================
// PERMISSION CHECK
// ============================================

export async function canSaveToLiturgy(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    return true;
  } catch {
    return false;
  }
}

// ============================================
// POSITION DESCRIPTION
// ============================================

/**
 * Calcula los resúmenes de posición en español para cada run de slides
 * temporales/importados, ej. `3 imágenes después de Lectura Bíblica`.
 */
export function describeTempRunPositions(
  slides: Slide[],
  elements: FlattenedElement[]
): SaveToLiturgyPositionSummary[] {
  const result: SaveToLiturgyPositionSummary[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!isNewTempRunElement(el, slides)) continue;

    const runSlides = slides.slice(el.startSlideIndex, el.endSlideIndex + 1);
    const isAllImages = runSlides.every((s) => s.type === 'announcement-image');

    let prevTitle: string | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (!isNewTempRunElement(elements[j], slides)) {
        prevTitle = elements[j].title;
        break;
      }
    }

    let hasRealAfter = false;
    for (let j = i + 1; j < elements.length; j++) {
      if (!isNewTempRunElement(elements[j], slides)) {
        hasRealAfter = true;
        break;
      }
    }

    const noun = isAllImages
      ? runSlides.length === 1 ? 'imagen' : 'imágenes'
      : runSlides.length === 1 ? 'diapositiva' : 'diapositivas';

    let where: string;
    if (!hasRealAfter && prevTitle) {
      where = 'al final';
    } else if (!hasRealAfter && !prevTitle) {
      where = 'al final';
    } else if (prevTitle) {
      where = `después de ${prevTitle}`;
    } else {
      where = 'al inicio';
    }

    result.push({
      count: runSlides.length,
      isImages: isAllImages,
      label: `${runSlides.length} ${noun} ${where}`,
    });
  }

  return result;
}

/**
 * Cuenta cuántos slides guardados (no temp/imported) cambiaron de elemento
 * comparando la ownership actual con la del momento de la carga (`dbElementId`
 * del elemento que lo contiene vs. el que figura en `slide.metadata.sourceId`).
 *
 * Mantenemos una heurística simple: si un elemento NO sintético tiene un
 * `dbElementId` y contiene slides cuyo elemento original era otro, los
 * contamos como movidos. Se usa solo para el resumen del diálogo; la
 * persistencia real se hace por elemento completo.
 */
export function countMovedSavedSlides(
  slides: Slide[],
  elements: FlattenedElement[],
  originalOwnership: Record<string, string>
): number {
  let moved = 0;
  for (const el of elements) {
    if (!el.dbElementId) continue;
    for (let i = el.startSlideIndex; i <= el.endSlideIndex; i++) {
      const s = slides[i];
      if (!s || isTempSlideId(s.id)) continue;
      const originalOwner = originalOwnership[s.id];
      if (originalOwner && originalOwner !== el.dbElementId) {
        moved++;
      }
    }
  }
  return moved;
}

// ============================================
// CHANGE DETECTION
// ============================================

/**
 * Calcula un resumen de los cambios que se guardarán.
 * `elements` puede ser undefined para mantener compatibilidad con llamadas
 * antiguas (en ese caso no se calculan posiciones).
 */
export function calculateChangeSummary(
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  defaultLogoState: LogoState,
  defaultTextOverlayState: TextOverlayState,
  elements: FlattenedElement[] = [],
  originalOwnership: Record<string, string> = {}
): SaveToLiturgyChangeSummary {
  const tempSlides = slides.filter((s) => isTempSlideId(s.id));

  const hasStyleChanges =
    styleState.globalStyles !== null ||
    Object.keys(styleState.elementStyles).length > 0 ||
    Object.keys(styleState.slideStyles).length > 0;

  const hasLogoChanges = !deepEqual(logoState, defaultLogoState);

  const hasTextOverlayChanges =
    textOverlayState.overlays.length > 0 &&
    !deepEqual(textOverlayState, defaultTextOverlayState);

  const positions = describeTempRunPositions(slides, elements);
  const movedSavedSlidesCount = countMovedSavedSlides(slides, elements, originalOwnership);

  return {
    tempSlides: {
      count: tempSlides.length,
      items: tempSlides.map((s) => ({
        id: s.id,
        type: s.type,
        previewText: s.content.primary?.slice(0, 50) || '[Sin texto]',
      })),
      positions,
    },
    movedSavedSlidesCount,
    hasStyleChanges,
    hasLogoChanges,
    hasTextOverlayChanges,
  };
}

// ============================================
// STYLE OPERATIONS
// ============================================

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

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

export async function loadPresentationStyles(
  liturgyId: string
): Promise<LiturgyPresentationStyles | null> {
  try {
    const { data, error } = await supabase
      .from('liturgias')
      .select('presentation_styles')
      .eq('id', liturgyId)
      .single();

    if (error || !data?.presentation_styles) return null;
    return data.presentation_styles as unknown as LiturgyPresentationStyles;
  } catch {
    return null;
  }
}

// ============================================
// SLIDE CONVERSION
// ============================================

/**
 * Convierte un slide temporal a permanente, aplicando `tempEdits` si existen.
 */
function convertTempSlide(
  tempSlide: Slide,
  tempEdits: Record<string, TempSlideEdit>
): Slide {
  const typePrefix = tempSlide.type.toLowerCase().replace(/-/g, '_');
  const permanentId = `${typePrefix}_${crypto.randomUUID()}`;

  const edit = tempEdits[tempSlide.id];
  const content = edit?.content
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

// ============================================
// SAVE PLAN
// ============================================

interface ElementSavePlan {
  kind: 'new-temp-run' | 'split-second-half' | 'existing';
  element: FlattenedElement;
  newOrden: number;
  slides: Slide[];
  /** Sólo para new-temp-run: si todos los slides del run son imágenes. */
  isAllImages?: boolean;
  /** Sólo para new-temp-run: posición legible para mostrar al usuario. */
  positionLabel?: string;
}

/**
 * Construye el plan de operaciones de guardado a partir del estado en memoria.
 * Convierte slides temporales a permanentes y asigna nueva `orden` consecutiva.
 */
export function buildSavePlan(
  slides: Slide[],
  elements: FlattenedElement[],
  tempEdits: Record<string, TempSlideEdit>
): { plan: ElementSavePlan[]; savedSlideIds: Record<string, string> } {
  const savedSlideIds: Record<string, string> = {};
  const convertedSlides: Slide[] = slides.map((s) => {
    if (!isTempSlideId(s.id)) return s;
    const permanent = convertTempSlide(s, tempEdits);
    savedSlideIds[s.id] = permanent.id;
    return permanent;
  });

  const positions = describeTempRunPositions(slides, elements);
  let positionIdx = 0;

  const plan: ElementSavePlan[] = elements.map((el, i) => {
    const runSlides = convertedSlides.slice(el.startSlideIndex, el.endSlideIndex + 1);

    if (isNewTempRunElement(el, slides)) {
      const pos = positions[positionIdx++];
      const isAllImages = pos?.isImages ?? runSlides.every((s) => s.type === 'announcement-image');
      return {
        kind: 'new-temp-run',
        element: el,
        newOrden: i,
        slides: runSlides,
        isAllImages,
        positionLabel: pos?.label,
      };
    }

    if (el.isSynthetic && el.dbElementId) {
      return {
        kind: 'split-second-half',
        element: el,
        newOrden: i,
        slides: runSlides,
      };
    }

    return {
      kind: 'existing',
      element: el,
      newOrden: i,
      slides: runSlides,
    };
  });

  return { plan, savedSlideIds };
}

// ============================================
// PLAN EXECUTION
// ============================================

/**
 * Genera el payload `slides` JSONB para un row de `liturgia_elementos`.
 * Mantiene compatibilidad con el lector existente (`extractSlideArray`), que
 * acepta tanto `Slide[]` directo como `SlideGroup`.
 */
function buildSlidesPayload(slides: Slide[], title: string): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    type: 'saved-content',
    title,
    slides,
    metadata: {
      sourceComponent: 'presenter-save',
      createdAt: new Date().toISOString(),
    },
  };
}

async function executeSavePlan(
  liturgyId: string,
  plan: ElementSavePlan[]
): Promise<{ success: boolean; error?: string }> {
  // Fetch existing rows for split-second-half title lookup
  const splitNeeded = plan.some((p) => p.kind === 'split-second-half');
  const existingRows = splitNeeded
    ? (
        await supabase
          .from('liturgia_elementos')
          .select('id, tipo, titulo')
          .eq('liturgia_id', liturgyId)
      ).data ?? []
    : [];

  for (const item of plan) {
    if (item.slides.length === 0) continue;

    if (item.kind === 'existing' && item.element.dbElementId) {
      const title = item.element.title;
      const payload = buildSlidesPayload(item.slides, title);
      const { error } = await supabase
        .from('liturgia_elementos')
        .update({
          orden: item.newOrden,
          titulo: title,
          slides: payload,
          edited_slides: null,
        })
        .eq('id', item.element.dbElementId);
      if (error) return { success: false, error: error.message };
      continue;
    }

    if (item.kind === 'split-second-half') {
      const orig = existingRows.find((r) => r.id === item.element.dbElementId);
      const title = orig?.titulo || item.element.title || 'Contenido guardado';
      const tipo = `${CUSTOM_TIPO_PREFIX}${crypto.randomUUID()}`;
      const payload = buildSlidesPayload(item.slides, title);
      const { error } = await supabase
        .from('liturgia_elementos')
        .insert({
          liturgia_id: liturgyId,
          tipo,
          orden: item.newOrden,
          titulo: title,
          slides: payload,
          status: 'completed',
        });
      if (error) return { success: false, error: error.message };
      continue;
    }

    if (item.kind === 'new-temp-run') {
      const title = item.isAllImages ? 'Imágenes' : 'Contenido guardado';
      const tipo = `${CUSTOM_TIPO_PREFIX}${crypto.randomUUID()}`;
      const payload = buildSlidesPayload(item.slides, title);
      const { error } = await supabase
        .from('liturgia_elementos')
        .insert({
          liturgia_id: liturgyId,
          tipo,
          orden: item.newOrden,
          titulo: title,
          slides: payload,
          status: 'completed',
        });
      if (error) return { success: false, error: error.message };
      continue;
    }
  }

  return { success: true };
}

// ============================================
// MAIN SAVE FUNCTION
// ============================================

/**
 * Guarda todos los cambios de presentación en la liturgia.
 * Orden: primero los slides (más propenso a fallar), luego los estilos.
 */
export async function saveToLiturgy(
  liturgyId: string,
  slides: Slide[],
  elements: FlattenedElement[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  tempEdits: Record<string, TempSlideEdit>
): Promise<SaveToLiturgyResult> {
  const canSave = await canSaveToLiturgy();
  if (!canSave) {
    return {
      success: false,
      error: 'No tienes permisos para guardar en esta liturgia',
    };
  }

  const styles: LiturgyPresentationStyles = {
    globalStyles: styleState.globalStyles,
    elementStyles: styleState.elementStyles,
    slideStyles: styleState.slideStyles,
    logoState,
    textOverlayState,
  };

  let savedSlideIds: Record<string, string> = {};
  let slidesSavedCount = 0;
  let positionsSavedCount = 0;

  // STEP 1: plan + ejecutar inserts/updates de elementos
  if (elements.length > 0) {
    const { plan, savedSlideIds: ids } = buildSavePlan(slides, elements, tempEdits);
    savedSlideIds = ids;

    const newRuns = plan.filter((p) => p.kind === 'new-temp-run');
    positionsSavedCount = newRuns.length;
    slidesSavedCount = newRuns.reduce((acc, r) => acc + r.slides.length, 0);

    const planResult = await executeSavePlan(liturgyId, plan);
    if (!planResult.success) {
      return {
        success: false,
        error: `Error al guardar diapositivas: ${planResult.error}`,
      };
    }
  } else {
    // Sin elementos en memoria: comportamiento conservador — sólo estilos.
    const tempSlides = slides.filter((s) => isTempSlideId(s.id));
    if (tempSlides.length > 0) {
      return {
        success: false,
        error: 'No hay estructura de elementos cargada para ubicar las diapositivas nuevas',
      };
    }
  }

  // STEP 2: estilos
  const stylesResult = await savePresentationStyles(liturgyId, styles);
  if (!stylesResult.success) {
    console.warn('[saveToLiturgy] PARTIAL SAVE: slides ok, estilos fallaron. LiturgyId:', liturgyId);
    return {
      success: false,
      error: `Error al guardar estilos: ${stylesResult.error}. Las diapositivas se guardaron correctamente.`,
      savedSlideIds,
      slidesSavedCount,
      positionsSavedCount,
    };
  }

  return {
    success: true,
    savedSlideIds,
    slidesSavedCount,
    positionsSavedCount,
  };
}
