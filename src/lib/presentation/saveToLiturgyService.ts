/**
 * Servicio para guardar cambios de presentación permanentemente en la liturgia
 *
 * Este servicio permite:
 * - Guardar estilos de presentación en la liturgia
 * - Convertir slides temporales a slides permanentes en elementos
 * - Preservar la posición relativa de los slides importados/temporales
 *   respecto a los elementos existentes (no se agrupan al final)
 * - Persistir reordenamiento de slides existentes dentro de cada elemento
 * - Verificar permisos de escritura
 */

import { supabase } from '@/integrations/supabase/client';
import type { Slide, SlideGroup } from '@/types/shared/slide';
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

export interface LiturgyPresentationStyles {
  globalStyles: StyleState['globalStyles'];
  elementStyles: StyleState['elementStyles'];
  slideStyles: StyleState['slideStyles'];
  logoState: LogoState;
  textOverlayState: TextOverlayState;
}

/** Info sobre una posición donde se insertaron nuevas diapositivas */
export interface SavedPositionInfo {
  afterTitle: string | null; // Título del elemento previo, o null si va al inicio
  count: number;
  isAllImage: boolean;
}

export interface SaveToLiturgyChangeSummary {
  tempSlides: {
    count: number;
    items: Array<{
      id: string;
      type: string;
      previewText: string;
    }>;
  };
  /** Información de posiciones donde caerán los slides temp/importados */
  positions: SavedPositionInfo[];
  /** Cantidad de elementos existentes cuyo orden de slides cambió */
  reorderedElementCount: number;
  hasStyleChanges: boolean;
  hasLogoChanges: boolean;
  hasTextOverlayChanges: boolean;
}

export interface SaveToLiturgyResult {
  success: boolean;
  error?: string;
  savedSlideIds?: Record<string, string>;
  positions?: SavedPositionInfo[];
  reorderedElementCount?: number;
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

function isSlideLike(raw: unknown): raw is Slide {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as { type?: unknown; content?: unknown; id?: unknown };
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.id === 'string' &&
    typeof candidate.content === 'object'
  );
}

function extractSlideArrayFromJsonb(raw: unknown): Slide[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(isSlideLike);
  if (typeof raw === 'object' && raw !== null && 'slides' in raw) {
    const groupSlides = (raw as { slides?: unknown }).slides;
    if (Array.isArray(groupSlides)) return groupSlides.filter(isSlideLike);
  }
  return [];
}

function isTempSlideId(id: string): boolean {
  return id.startsWith('temp-') || id.startsWith('imported-');
}

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
};

// liturgia_elementos.tipo is varchar(50). 'custom-' (7) + UUID (36) = 43 — fits.
// We dropped the human-readable middle segment (imagenes-/contenido-) because
// the same info is already on titulo, and the older `${prefix}-${uuid}` form
// (52-53 chars) overflowed the column.
function generateUniqueTipo(): string {
  return `${CUSTOM_TIPO_PREFIX}${crypto.randomUUID()}`;
}

// ============================================
// PERMISSION CHECK
// ============================================

export async function canSaveToLiturgy(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

// ============================================
// CHANGE DETECTION
// ============================================

/**
 * Calcula resumen de cambios incluyendo info de posición.
 *
 * NOTA: Para el conteo `reorderedElementCount` y las posiciones precisas
 * se requiere comparar contra el estado de DB. En este resumen se calcula
 * sólo la información derivable del estado en memoria; el conteo final
 * se reporta tras `saveToLiturgy`.
 */
export function calculateChangeSummary(
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  defaultLogoState: LogoState,
  defaultTextOverlayState: TextOverlayState,
  elements: FlattenedElement[] = []
): SaveToLiturgyChangeSummary {
  const tempSlides = slides.filter(s => isTempSlideId(s.id));

  const hasStyleChanges =
    styleState.globalStyles !== null ||
    Object.keys(styleState.elementStyles).length > 0 ||
    Object.keys(styleState.slideStyles).length > 0;

  const hasLogoChanges = !deepEqual(logoState, defaultLogoState);
  const hasTextOverlayChanges =
    textOverlayState.overlays.length > 0 &&
    !deepEqual(textOverlayState, defaultTextOverlayState);

  // Build positions from in-memory slides + elements (best-effort)
  const positions = buildInMemoryPositions(slides, elements);

  return {
    tempSlides: {
      count: tempSlides.length,
      items: tempSlides.map(s => ({
        id: s.id,
        type: s.type,
        previewText: s.content.primary?.slice(0, 50) || '[Sin texto]',
      })),
    },
    positions,
    reorderedElementCount: 0,
    hasStyleChanges,
    hasLogoChanges,
    hasTextOverlayChanges,
  };
}

/**
 * Construye posiciones a partir del estado en memoria.
 * Walks slides[] in order; agrupa runs contiguos de temp slides y registra
 * el título del elemento previo (basado en elements[]).
 */
function buildInMemoryPositions(
  slides: Slide[],
  elements: FlattenedElement[]
): SavedPositionInfo[] {
  const positions: SavedPositionInfo[] = [];
  if (slides.length === 0) return positions;

  // Build slideIndex -> elementTitle via element ranges (may be stale, best-effort)
  function titleAt(idx: number): string | null {
    for (const el of elements) {
      if (idx >= el.startSlideIndex && idx <= el.endSlideIndex) {
        return el.title || null;
      }
    }
    return null;
  }

  let runStart = -1;
  let lastNonTempIdx = -1;
  for (let i = 0; i < slides.length; i++) {
    const isTemp = isTempSlideId(slides[i].id);
    if (isTemp) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const afterTitle = lastNonTempIdx >= 0 ? titleAt(lastNonTempIdx) : null;
        const runSlides = slides.slice(runStart, i);
        positions.push({
          afterTitle,
          count: runSlides.length,
          isAllImage: runSlides.every(s => s.type === 'announcement-image'),
        });
        runStart = -1;
      }
      lastNonTempIdx = i;
    }
  }
  if (runStart !== -1) {
    const afterTitle = lastNonTempIdx >= 0 ? titleAt(lastNonTempIdx) : null;
    const runSlides = slides.slice(runStart);
    positions.push({
      afterTitle,
      count: runSlides.length,
      isAllImage: runSlides.every(s => s.type === 'announcement-image'),
    });
  }
  return positions;
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
// SLIDE CONVERSION + POSITION PRESERVATION
// ============================================

function convertTempSlide(
  tempSlide: Slide,
  tempEdits: Record<string, TempSlideEdit>
): Slide {
  const typePrefix = tempSlide.type.toLowerCase().replace(/-/g, '_');
  const permanentId = `${typePrefix}_${crypto.randomUUID()}`;
  const edit = tempEdits[tempSlide.id];
  const content = edit ? { ...tempSlide.content, ...edit.content } : tempSlide.content;
  return {
    ...tempSlide,
    id: permanentId,
    content,
    metadata: {
      ...tempSlide.metadata,
      sourceComponent: (tempSlide.metadata?.sourceComponent || '').replace('temp-', ''),
    },
  };
}

interface DbElement {
  id: string;
  tipo: string;
  orden: number;
  titulo: string | null;
  slides: unknown;
  edited_slides: unknown;
}

interface ParsedDbElement extends DbElement {
  parsedSlides: Slide[];
  source: 'edited_slides' | 'slides';
}

interface TempGroup {
  afterDbElementId: string | null; // null if before first element
  afterOrden: number | null;
  afterTitle: string | null;
  slides: Slide[];
}

/**
 * Persiste slides temporales en posiciones correctas Y reordenamiento de slides
 * existentes dentro de elementos.
 *
 * Estrategia:
 * 1. Lee elementos actuales de DB con sus slides.
 * 2. Mapea slideId → {dbElementId, orden, titulo}.
 * 3. Recorre `allSlides[]` en orden; agrupa runs contiguos de temp slides según
 *    el último slide persistente visto.
 * 4. Detecta cambios de orden dentro de cada elemento existente (reorder).
 * 5. Asigna nuevos `orden` consecutivos a la mezcla de elementos existentes +
 *    grupos nuevos y aplica UPDATEs (orden y/o slides) + INSERTs.
 */
async function saveSlidesWithPositions(
  liturgyId: string,
  allSlides: Slide[],
  tempEdits: Record<string, TempSlideEdit>
): Promise<SaveToLiturgyResult> {
  const tempSlideIdsInOrder = allSlides.filter(s => isTempSlideId(s.id));
  if (tempSlideIdsInOrder.length === 0 && allSlides.length === 0) {
    return { success: true, savedSlideIds: {}, positions: [], reorderedElementCount: 0 };
  }

  // Fetch existing elementos
  const { data: existingRaw, error: fetchError } = await supabase
    .from('liturgia_elementos')
    .select('id, tipo, orden, titulo, slides, edited_slides')
    .eq('liturgia_id', liturgyId)
    .order('orden', { ascending: true });

  if (fetchError) return { success: false, error: fetchError.message };

  const parsedElements: ParsedDbElement[] = (existingRaw ?? []).map((el) => {
    const editedArr = extractSlideArrayFromJsonb(el.edited_slides);
    const baseArr = extractSlideArrayFromJsonb(el.slides);
    const useEdited = editedArr.length > 0;
    return {
      ...el,
      parsedSlides: useEdited ? editedArr : baseArr,
      source: useEdited ? 'edited_slides' : 'slides',
    };
  });

  // Map persistent slideId → element info
  const slideIdToElement = new Map<string, { dbId: string; orden: number; titulo: string | null }>();
  for (const el of parsedElements) {
    for (const s of el.parsedSlides) {
      slideIdToElement.set(s.id, { dbId: el.id, orden: el.orden, titulo: el.titulo });
    }
  }

  // 1) Walk allSlides[] to build temp groups
  const tempGroups: TempGroup[] = [];
  let currentGroup: TempGroup | null = null;
  let lastSeenDbId: string | null = null;
  let lastSeenOrden: number | null = null;
  let lastSeenTitle: string | null = null;

  // Also track the order of persistent slide IDs (used for reorder detection)
  const persistentOrder: string[] = [];

  for (const slide of allSlides) {
    if (isTempSlideId(slide.id)) {
      if (!currentGroup) {
        currentGroup = {
          afterDbElementId: lastSeenDbId,
          afterOrden: lastSeenOrden,
          afterTitle: lastSeenTitle,
          slides: [],
        };
        tempGroups.push(currentGroup);
      }
      currentGroup.slides.push(slide);
    } else {
      currentGroup = null;
      persistentOrder.push(slide.id);
      const lookup = slideIdToElement.get(slide.id);
      if (lookup) {
        lastSeenDbId = lookup.dbId;
        lastSeenOrden = lookup.orden;
        lastSeenTitle = lookup.titulo;
      }
    }
  }

  // 2) Convert temp slides
  const savedSlideIds: Record<string, string> = {};
  const convertedGroups = tempGroups.map((g) => ({
    afterDbElementId: g.afterDbElementId,
    afterOrden: g.afterOrden,
    afterTitle: g.afterTitle,
    slides: g.slides.map((s) => {
      const permanent = convertTempSlide(s, tempEdits);
      savedSlideIds[s.id] = permanent.id;
      return permanent;
    }),
    original: g.slides,
  }));

  // 3) Detect reorder per existing element (persistent slides only)
  //    For each element, gather current in-memory slide ids that belong to it,
  //    and compare to its original order. If changed, set newSlides for that element.
  const reorderedSlidesByElement = new Map<string, Slide[]>();
  for (const el of parsedElements) {
    const originalIds = el.parsedSlides.map((s) => s.id);
    const inMemoryIds = persistentOrder.filter((id) => slideIdToElement.get(id)?.dbId === el.id);
    // Only consider as reorder if the same set of ids is present (no membership change)
    // — drag is restricted to within an element, so the set should match.
    const sameSet =
      inMemoryIds.length === originalIds.length &&
      inMemoryIds.every((id) => originalIds.includes(id));
    if (!sameSet) {
      // Membership changed unexpectedly (e.g. cross-element drag landed here).
      // Fall back to using new in-memory ids when they exist; otherwise skip.
      if (inMemoryIds.length > 0) {
        // Order is changed (or set), preserve the in-memory order using known slide content
        const slideMap = new Map<string, Slide>();
        for (const s of allSlides) slideMap.set(s.id, s);
        const newSlides = inMemoryIds
          .map((id) => slideMap.get(id))
          .filter((s): s is Slide => !!s);
        reorderedSlidesByElement.set(el.id, newSlides);
      }
      continue;
    }
    const orderChanged = originalIds.some((id, idx) => id !== inMemoryIds[idx]);
    if (orderChanged) {
      const slideMap = new Map<string, Slide>();
      for (const s of allSlides) slideMap.set(s.id, s);
      const newSlides = inMemoryIds
        .map((id) => slideMap.get(id))
        .filter((s): s is Slide => !!s);
      reorderedSlidesByElement.set(el.id, newSlides);
    }
  }

  // 4) Build slot list and assign new orden
  type Slot =
    | { kind: 'existing'; el: ParsedDbElement }
    | { kind: 'new'; group: (typeof convertedGroups)[number] };

  const slots: { item: Slot; sortKey: number }[] = [];
  for (const el of parsedElements) {
    slots.push({ item: { kind: 'existing', el }, sortKey: el.orden * 2 });
  }
  for (const g of convertedGroups) {
    const base = g.afterOrden === null ? -1 : g.afterOrden;
    slots.push({ item: { kind: 'new', group: g }, sortKey: base * 2 + 1 });
  }
  slots.sort((a, b) => a.sortKey - b.sortKey);

  // 5) Build UPDATE + INSERT payloads, then dispatch in ONE transactional RPC
  //    call (save_liturgy_slides_positions). Why: previously this was a
  //    for-loop with await per row — a mid-loop failure left earlier writes
  //    committed while returning failure. The RPC runs all writes inside a
  //    single PL/pgSQL function (implicit transaction), so either everything
  //    sticks or nothing does.
  type UpdateEntry = {
    id: string;
    orden?: number;
    slides?: unknown;
    edited_slides?: unknown;
  };
  type InsertEntry = {
    orden: number;
    tipo: string;
    titulo: string;
    slides: unknown;
    status?: string;
  };
  const updates: UpdateEntry[] = [];
  const inserts: InsertEntry[] = [];
  const positions: SavedPositionInfo[] = [];

  for (let idx = 0; idx < slots.length; idx++) {
    const slot = slots[idx].item;
    if (slot.kind === 'existing') {
      const el = slot.el;
      const ordenChanged = el.orden !== idx;
      const newSlidesArr = reorderedSlidesByElement.get(el.id);
      const slidesChanged = !!newSlidesArr;
      if (!ordenChanged && !slidesChanged) continue;

      const entry: UpdateEntry = { id: el.id };
      if (ordenChanged) entry.orden = idx;
      if (slidesChanged) {
        // Preserve original SlideGroup structure where applicable
        if (
          el.source === 'edited_slides' &&
          el.edited_slides &&
          typeof el.edited_slides === 'object' &&
          !Array.isArray(el.edited_slides) &&
          'slides' in (el.edited_slides as object)
        ) {
          const group = el.edited_slides as SlideGroup;
          entry.edited_slides = { ...group, slides: newSlidesArr };
        } else if (el.source === 'edited_slides' && Array.isArray(el.edited_slides)) {
          entry.edited_slides = newSlidesArr;
        } else if (
          el.slides &&
          typeof el.slides === 'object' &&
          !Array.isArray(el.slides) &&
          'slides' in (el.slides as object)
        ) {
          const group = el.slides as SlideGroup;
          entry.slides = { ...group, slides: newSlidesArr };
        } else {
          entry.slides = newSlidesArr;
        }
      }
      updates.push(entry);
    } else {
      const group = slot.group;
      if (group.slides.length === 0) continue;
      const slideTypes = new Set(group.slides.map((s) => s.type));
      const isAllImage = slideTypes.size === 1 && slideTypes.has('announcement-image');
      const titulo = isAllImage ? 'Imágenes' : 'Contenido guardado';
      const tipo = generateUniqueTipo();
      const slidesPayload = {
        id: crypto.randomUUID(),
        type: 'saved-content',
        title: titulo,
        slides: group.slides,
        metadata: {
          sourceComponent: 'presenter-save',
          createdAt: new Date().toISOString(),
        },
      };
      inserts.push({
        orden: idx,
        tipo,
        titulo,
        slides: slidesPayload,
        status: 'completed',
      });
      positions.push({
        afterTitle: group.afterTitle,
        count: group.slides.length,
        isAllImage,
      });
    }
  }

  // No writes needed? Skip the round-trip.
  if (updates.length === 0 && inserts.length === 0) {
    return {
      success: true,
      savedSlideIds,
      positions,
      reorderedElementCount: 0,
    };
  }

  const { error: rpcError } = await supabase.rpc(
    'save_liturgy_slides_positions',
    {
      p_liturgy_id: liturgyId,
      p_updates: updates as unknown as Record<string, unknown>[],
      p_inserts: inserts as unknown as Record<string, unknown>[],
    },
  );
  if (rpcError) return { success: false, error: rpcError.message };

  return {
    success: true,
    savedSlideIds,
    positions,
    reorderedElementCount: reorderedSlidesByElement.size,
  };
}

// ============================================
// MAIN SAVE FUNCTION
// ============================================

/**
 * Guarda todos los cambios de presentación en la liturgia.
 * 1. Slides primero (más complejo).
 * 2. Estilos después.
 */
export async function saveToLiturgy(
  liturgyId: string,
  slides: Slide[],
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  tempEdits: Record<string, TempSlideEdit>
): Promise<SaveToLiturgyResult> {
  const canSave = await canSaveToLiturgy();
  if (!canSave) {
    return { success: false, error: 'No tienes permisos para guardar en esta liturgia' };
  }

  const styles: LiturgyPresentationStyles = {
    globalStyles: styleState.globalStyles,
    elementStyles: styleState.elementStyles,
    slideStyles: styleState.slideStyles,
    logoState,
    textOverlayState,
  };

  // STEP 1: Save slides with position preservation + reorder persistence
  const slidesResult = await saveSlidesWithPositions(liturgyId, slides, tempEdits);
  if (!slidesResult.success) {
    return { success: false, error: `Error al guardar diapositivas: ${slidesResult.error}` };
  }

  // STEP 2: Save styles
  const stylesResult = await savePresentationStyles(liturgyId, styles);
  if (!stylesResult.success) {
    console.warn('[saveToLiturgy] PARTIAL SAVE: slides saved but styles failed.', liturgyId);
    return {
      success: false,
      error: `Error al guardar estilos: ${stylesResult.error}. Las diapositivas se guardaron correctamente.`,
      savedSlideIds: slidesResult.savedSlideIds,
      positions: slidesResult.positions,
      reorderedElementCount: slidesResult.reorderedElementCount,
    };
  }

  return {
    success: true,
    savedSlideIds: slidesResult.savedSlideIds,
    positions: slidesResult.positions,
    reorderedElementCount: slidesResult.reorderedElementCount,
  };
}

// Backwards-compat re-export: previous external callers used saveTempSlidesToLiturgy.
// Keep a thin wrapper so callers in tests or external code continue to work.
export async function saveTempSlidesToLiturgy(
  liturgyId: string,
  tempSlides: Slide[],
  tempEdits: Record<string, TempSlideEdit> = {}
): Promise<{ success: boolean; error?: string; savedSlideIds?: Record<string, string> }> {
  // Without the full slides[] context we can't preserve positions; treat as append.
  if (tempSlides.length === 0) return { success: true, savedSlideIds: {} };
  return saveSlidesWithPositions(liturgyId, tempSlides, tempEdits);
}
