/**
 * Helpers puros para manipular `FlattenedElement[]` y la relación
 * (slide ↔ elemento) sin escribir a DB.
 *
 * El modelo: cada slide pertenece a UN elemento; los rangos de elementos son
 * contiguos. Para reorder/insert, representamos la pertenencia como un array
 * de owners por slide y luego reconstruimos los elementos consecutivamente.
 */

import type { FlattenedElement } from './types';
import type { LiturgyElementType } from '@/types/shared/liturgy';

/**
 * Construye un mapa `slideIndex → elementId` desde los rangos actuales.
 * Slides huérfanos (fuera de cualquier rango) reciben `null`.
 */
export function buildOwnershipMap(
  slideCount: number,
  elements: FlattenedElement[]
): (string | null)[] {
  const ownership: (string | null)[] = new Array(slideCount).fill(null);
  for (const el of elements) {
    for (let i = el.startSlideIndex; i <= el.endSlideIndex && i < slideCount; i++) {
      ownership[i] = el.id;
    }
  }
  return ownership;
}

/**
 * Reconstruye `FlattenedElement[]` agrupando runs CONSECUTIVOS con el mismo
 * ownerId. Templates aporta la metadata (type, title, dbElementId, etc.).
 *
 * Si un elemento quedó sin slides, se elimina. Si dos runs no contiguos comparten
 * el mismo id, ambos generan entradas — por eso los splits deben usar ids únicos.
 */
export function rebuildElementsFromOwnership(
  ownership: (string | null)[],
  templates: Record<string, FlattenedElement>
): FlattenedElement[] {
  const result: FlattenedElement[] = [];
  let i = 0;
  while (i < ownership.length) {
    const ownerId = ownership[i];
    if (!ownerId) {
      i++;
      continue;
    }
    let j = i;
    while (j < ownership.length && ownership[j] === ownerId) j++;
    const template = templates[ownerId];
    if (template) {
      result.push({
        ...template,
        startSlideIndex: i,
        endSlideIndex: j - 1,
        slideCount: j - i,
      });
    }
    i = j;
  }
  return result;
}

/**
 * Crea un elemento sintético (no persistido) para slides recién insertados.
 */
export function makeSyntheticElement(opts: {
  id: string;
  title: string;
  type?: LiturgyElementType;
  startSlideIndex: number;
  slideCount: number;
  dbElementId?: string;
  dbOrder?: number;
}): FlattenedElement {
  return {
    id: opts.id,
    type: opts.type ?? 'custom',
    title: opts.title,
    startSlideIndex: opts.startSlideIndex,
    endSlideIndex: opts.startSlideIndex + opts.slideCount - 1,
    slideCount: opts.slideCount,
    isSynthetic: true,
    dbElementId: opts.dbElementId,
    dbOrder: opts.dbOrder,
  };
}

/**
 * Resultado de insertar un nuevo run sintético dentro de una secuencia.
 */
export interface InsertSyntheticRunResult {
  ownership: (string | null)[];
  templates: Record<string, FlattenedElement>;
  /** True si se partió un elemento existente (insert estrictamente adentro). */
  didSplit: boolean;
  /** Id sintético usado para el run insertado. */
  insertedElementId: string;
  /** Id sintético usado para la segunda mitad del elemento partido, si hubo split. */
  splitSecondHalfId: string | null;
}

/**
 * Inserta un run sintético en la posición `insertIdx` de la ownership.
 * Si la posición cae estrictamente dentro de un elemento existente
 * (mismo owner a la izquierda y a la derecha), parte ese elemento en dos:
 * el segundo trozo recibe un id único nuevo (`<origId>-split-<ts>`) para
 * evitar que el reagrupador los una de nuevo.
 */
export function insertSyntheticRun(opts: {
  baseOwnership: (string | null)[];
  baseElements: FlattenedElement[];
  insertIdx: number;
  runLength: number;
  syntheticId: string;
  syntheticTemplate: FlattenedElement;
  splitIdSuffix: string;
}): InsertSyntheticRunResult {
  const { baseOwnership, baseElements, insertIdx, runLength, syntheticId, syntheticTemplate, splitIdSuffix } = opts;

  const leftOwner = insertIdx > 0 ? baseOwnership[insertIdx - 1] : null;
  const rightOwner = insertIdx < baseOwnership.length ? baseOwnership[insertIdx] : null;
  const didSplit = leftOwner !== null && leftOwner === rightOwner;

  const templates: Record<string, FlattenedElement> = {};
  for (const el of baseElements) templates[el.id] = el;
  templates[syntheticId] = syntheticTemplate;

  const leftPart = baseOwnership.slice(0, insertIdx);
  let rightPart = baseOwnership.slice(insertIdx);

  let splitSecondHalfId: string | null = null;
  if (didSplit && leftOwner) {
    splitSecondHalfId = `${leftOwner}-split-${splitIdSuffix}`;
    const original = templates[leftOwner];
    templates[splitSecondHalfId] = {
      ...original,
      id: splitSecondHalfId,
      isSynthetic: true,
      dbElementId: original.dbElementId ?? (original.isSynthetic ? undefined : leftOwner),
    };
    const renamed: (string | null)[] = [...rightPart];
    let k = 0;
    while (k < renamed.length && renamed[k] === leftOwner) {
      renamed[k] = splitSecondHalfId;
      k++;
    }
    rightPart = renamed;
  }

  const insertedOwnership: (string | null)[] = new Array(runLength).fill(syntheticId);
  const ownership = [...leftPart, ...insertedOwnership, ...rightPart];

  return { ownership, templates, didSplit, insertedElementId: syntheticId, splitSecondHalfId };
}

/**
 * Calcula el nuevo owner para un slide movido a `destIndex` mirando los vecinos
 * inmediatos en la ownership ya sin el slide origen.
 *
 * Regla:
 * - Si ambos vecinos comparten owner → ese owner.
 * - Si están en frontera entre elementos → owner del vecino izquierdo (estable;
 *   el slide se "asienta" después del slide previo).
 * - Si solo hay un vecino → ese owner.
 * - Si no hay vecinos → fallback al owner original.
 */
export function resolveMovedSlideOwner(
  neighborOwnershipAfterRemoval: (string | null)[],
  destIndex: number,
  fallbackOwner: string | null
): string | null {
  const leftOwner = destIndex > 0 ? neighborOwnershipAfterRemoval[destIndex - 1] : null;
  const rightOwner = destIndex < neighborOwnershipAfterRemoval.length
    ? neighborOwnershipAfterRemoval[destIndex]
    : null;

  if (leftOwner !== null && leftOwner === rightOwner) return leftOwner;
  if (leftOwner !== null) return leftOwner;
  if (rightOwner !== null) return rightOwner;
  return fallbackOwner;
}
