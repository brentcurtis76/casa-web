/**
 * Hook para auto-guardar y recuperar borradores de cuentos en progreso
 * Usa Supabase para persistir el estado (tabla + storage para imágenes)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Story, TextOverlay } from '@/types/shared/story';
import { runWithConcurrency } from '@/lib/cuentacuentos/concurrency';
import {
  buildEditorStateV1,
  restoreEditorStateV1,
  isEditorStateV1Extended,
  scrubImageRefsDeep,
  isNonPathImageString,
  type EditorStateV1Extended,
  type EditorCreationStep,
} from '@/lib/cuentacuentos/recoverySnapshot';

// Estructura del borrador guardado
export interface CuentacuentosDraft {
  liturgyId: string;
  currentStep: 'config' | 'story' | 'characters' | 'scenes' | 'cover' | 'complete';
  config: {
    location: string;
    customLocation: string;
    characters: string;
    style: string;
    illustrationStyle: string;
    additionalNotes: string;
  };
  story: Story | null;
  selectedCharacterSheets: Record<string, number>;
  selectedSceneImages: Record<number, number>;
  selectedCover: number | null;
  selectedEnd: number | null;
  // Modo de la imagen de referencia por escena ('style' | 'pov')
  sceneReferenceModes: Record<number, 'style' | 'pov'>;
  savedAt: string;
  version: number;
}

// Estructura completa con opciones de imágenes
export interface CuentacuentosDraftFull extends CuentacuentosDraft {
  characterSheetOptions: Record<string, string[]>;
  sceneImageOptions: Record<number, string[]>;
  coverOptions: string[];
  endOptions: string[];
  // Imágenes de referencia de props (propId -> URLs públicas o base64)
  propReferenceImages: Record<string, string[]>;
  // ---------------------------------------------------------------------------
  // A3/S5 — editor buffer slots persistidas junto al draft.
  // Todos son opcionales para que un load legado los rellene con defaults en
  // vez de romper. La forma canónica del snapshot vive en `editorStateV1` (ver
  // recoverySnapshot.ts); estos slots son la superficie que consume el editor.
  // ---------------------------------------------------------------------------
  editingScenePrompt?: Record<number, string>;
  editingCharacterPrompt?: Record<string, string>;
  editingCoverPrompt?: string;
  editingEndPrompt?: string;
  editingSceneText?: Record<number, string>;
  editingTitle?: string | null;
  sceneIncludedCharacters?: Record<number, string[]>;
  coverIncludedCharacters?: string[];
  endIncludedCharacters?: string[];
  sceneExcludedCharacters?: Record<number, string[]>;
  coverExcludedCharacters?: string[];
  /** A3/S5: lado explícito que faltaba (cover ya tenía include/exclude, end no). */
  endExcludedCharacters?: string[];
  /** Imagen de referencia por escena — base64 en memoria, path Storage al persistir. */
  sceneReferenceImages?: Record<number, string>;
  /** Imagen de referencia para la portada. */
  coverReferenceImage?: string | null;
  /** Imagen de referencia para el fin. */
  endReferenceImage?: string | null;
  /** landmarkVisible por escena, redundante con story.scenes[].landmarkVisible pero
   * canónico dentro de EditorStateV1 para round-trip lossless. */
  landmarkVisible?: Record<number, boolean>;
  /** Contador que se incrementa en cada persistencia exitosa: sirve como
   * identidad de recuperación (útil para diffs, telemetry, y evitar carreras). */
  recoveryRevision?: number;
}

const BUCKET_NAME = 'cuentacuentos-drafts';

/**
 * Representación versionada del estado del editor persistida dentro del
 * payload de story (JSONB). No hay migración: drafts previos sin este campo
 * cargan con defaults seguros.
 *
 * Diseño:
 *  - `version` fija el schema (permite evolución sin migración).
 *  - `selections` refleja los índices seleccionados en el momento del guardado.
 *    Al cargar un draft legado (sin este campo) usamos defaults vacíos.
 *  - `provenance` opcional acompaña el snapshot para trazabilidad (revisión
 *    de origen y hash de contenido) — soporta hooks de validación antes de
 *    los URL swaps del hook.
 */
export interface EditorStateV1 {
  version: 1;
  selections: {
    selectedCharacterSheets: Record<string, number>;
    selectedSceneImages: Record<number, number>;
    selectedCover: number | null;
    selectedEnd: number | null;
  };
  provenance?: SnapshotProvenance;
}

/**
 * Metadata de provenance opcional para un snapshot de draft. Los adaptadores
 * (por ejemplo `enqueueGeneratedSnapshot`) pueden inyectar el par
 * `{sourceRevision, contentHash}` para permitir validación antes del URL swap.
 */
export interface SnapshotProvenance {
  sourceRevision?: number;
  contentHash?: string | null;
}

/**
 * Provenance requerida (A3/S4). Ambos campos son obligatorios para el adaptador
 * de `enqueueGeneratedSnapshot`. `sourceRevision` debe coincidir con
 * `identity.generatedRevision`; `contentHash` es el hash determinista del
 * snapshot aplicado en `apply`.
 */
export interface RequiredSnapshotProvenance {
  sourceRevision: number;
  contentHash: string;
}

export function defaultEditorStateV1(
  draft?: CuentacuentosDraftFull | null
): EditorStateV1 {
  return {
    version: 1,
    selections: {
      selectedCharacterSheets: draft?.selectedCharacterSheets ?? {},
      selectedSceneImages: draft?.selectedSceneImages ?? {},
      selectedCover: draft?.selectedCover ?? null,
      selectedEnd: draft?.selectedEnd ?? null,
    },
  };
}

/**
 * A3/S5 — snapshot canónico extendido del estado del editor. Cubre todos los
 * campos listados en el spec (edited prompts, includes/excludes, overlays,
 * currentStep, landmarkVisible, recoveryRevision) además de las selecciones
 * base. Es el que se embebe en `story.editorStateV1` al persistir. Legacy
 * drafts sin este bloque cargan con defaults seguros vía `restoreEditorStateV1`.
 */
export function buildEditorStateV1FromDraft(
  draft: CuentacuentosDraftFull | null,
  story: Story | null
): EditorStateV1Extended {
  return buildEditorStateV1({
    selectedCharacterSheets: draft?.selectedCharacterSheets,
    selectedSceneImages: draft?.selectedSceneImages,
    selectedCover: draft?.selectedCover,
    selectedEnd: draft?.selectedEnd,
    editingScenePrompt: draft?.editingScenePrompt,
    editingCharacterPrompt: draft?.editingCharacterPrompt,
    editingCoverPrompt: draft?.editingCoverPrompt,
    editingEndPrompt: draft?.editingEndPrompt,
    editingSceneText: draft?.editingSceneText,
    editingTitle: draft?.editingTitle,
    sceneIncludedCharacters: draft?.sceneIncludedCharacters,
    coverIncludedCharacters: draft?.coverIncludedCharacters,
    endIncludedCharacters: draft?.endIncludedCharacters,
    sceneExcludedCharacters: draft?.sceneExcludedCharacters,
    coverExcludedCharacters: draft?.coverExcludedCharacters,
    endExcludedCharacters: draft?.endExcludedCharacters,
    sceneReferenceModes: draft?.sceneReferenceModes,
    coverTextOverlay: story?.coverTextOverlay ?? null,
    endTextOverlay: story?.endTextOverlay ?? null,
    landmarkVisible: landmarkVisibleFromDraft(draft, story),
    currentStep: (draft?.currentStep ?? 'config') as EditorCreationStep,
    recoveryRevision: draft?.recoveryRevision,
  });
}

function landmarkVisibleFromDraft(
  draft: CuentacuentosDraftFull | null,
  story: Story | null
): Record<number, boolean> {
  if (draft?.landmarkVisible && Object.keys(draft.landmarkVisible).length > 0) {
    return draft.landmarkVisible;
  }
  // Fallback: derivar del story si el draft aún no persistió el bloque.
  const out: Record<number, boolean> = {};
  for (const s of story?.scenes ?? []) {
    if (typeof s.landmarkVisible === 'boolean') out[s.number] = s.landmarkVisible;
  }
  return out;
}

/**
 * Detecta base64 o data URLs en el payload persistido. Cualquier string que
 * empiece con `data:` o parezca base64 crudo (bloque grande sin scheme) NO es
 * un Storage path válido y debe filtrarse antes de escribir.
 */
function isNonPathImageRef(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:')) return true;
  // Bloque base64 crudo largo sin scheme HTTP: no es un path.
  if (!value.startsWith('http') && value.length > 512) return true;
  return false;
}

// URLs públicas correspondientes a las imágenes subidas/verificadas en un guardado,
// alineadas por key para que el editor pueda reemplazar base64 en memoria por URLs.
export interface DraftUploadedUrls {
  characterSheetUrls: Record<string, string[]>;
  sceneImageUrls: Record<number, string[]>;
  coverUrls: string[];
  endUrls: string[];
  /** URLs públicas de las referencias de props subidas (por propId). */
  propImageUrls: Record<string, string[]>;
  /** A3/S5: URL pública de referencias de escena por número. */
  sceneReferenceUrls: Record<number, string>;
  /** A3/S5: URL pública de la referencia de portada, si se subió una nueva. */
  coverReferenceUrl: string | null;
  /** A3/S5: URL pública de la referencia de fin, si se subió una nueva. */
  endReferenceUrl: string | null;
}

/**
 * Diferencia semántica ("patch") aplicable a un snapshot de draft.
 *
 * Semántica de own-key presence:
 * - Una clave AUSENTE preserva el valor del snapshot (no se toca).
 * - Una clave PRESENTE sobreescribe, incluso si su valor es `[]`, `{}`,
 *   `false` o `null`. Nunca se infiere intención de vaciado a partir de
 *   truthiness o `length`.
 *
 * Los campos de identidad (`liturgyId`) y metadatos autogenerados
 * (`savedAt`, `version`) no forman parte del patch: son inyectados al
 * normalizar el snapshot final.
 */
export type DraftPatch = Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>;

/**
 * Merge puro por presencia de clave propia. Nunca inspecciona el valor.
 * Ver docstring de `DraftPatch` para la semántica.
 */
export function mergePatch(
  snapshot: CuentacuentosDraftFull,
  patch: DraftPatch
): CuentacuentosDraftFull {
  const result: CuentacuentosDraftFull = { ...snapshot };
  for (const key of Object.keys(patch)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      (result as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
    }
  }
  return result;
}

/**
 * Categorías de imágenes cuya subida se dispara sólo si el patch las toca.
 * Para props, la fuente de derivación es explícita:
 *  - 'propRefs': el patch trae `propReferenceImages`; ese valor manda literalmente
 *    (incluso `{}` limpia los paths persistidos). `story.props` NO se consulta.
 *  - 'story': el patch trae `story` pero NO `propReferenceImages`; derivar de
 *    `story.props[].referenceImages`.
 *  - `false`: ninguna de las dos claves está presente; preservar paths existentes.
 */
type PropsSource = false | 'propRefs' | 'story';

interface UploadCategories {
  characterSheets: boolean;
  sceneImages: boolean;
  cover: boolean;
  end: boolean;
  props: PropsSource;
  /** A3/S5: imagen de referencia por escena. */
  sceneReferences: boolean;
  /** A3/S5: imagen de referencia para portada. */
  coverReference: boolean;
  /** A3/S5: imagen de referencia para fin. */
  endReference: boolean;
}

function categoriesFromPatch(patch: DraftPatch): UploadCategories {
  const has = (k: keyof DraftPatch) => Object.prototype.hasOwnProperty.call(patch, k);
  const props: PropsSource = has('propReferenceImages')
    ? 'propRefs'
    : has('story')
      ? 'story'
      : false;
  return {
    characterSheets: has('characterSheetOptions'),
    sceneImages: has('sceneImageOptions'),
    cover: has('coverOptions'),
    end: has('endOptions'),
    props,
    sceneReferences: has('sceneReferenceImages'),
    coverReference: has('coverReferenceImage'),
    endReference: has('endReferenceImage'),
  };
}

function defaultDraft(liturgyId: string): CuentacuentosDraftFull {
  return {
    liturgyId,
    currentStep: 'config',
    config: {
      location: '',
      customLocation: '',
      characters: '',
      style: 'reflexivo',
      illustrationStyle: 'ghibli',
      additionalNotes: '',
    },
    story: null,
    characterSheetOptions: {},
    selectedCharacterSheets: {},
    sceneImageOptions: {},
    selectedSceneImages: {},
    coverOptions: [],
    selectedCover: null,
    endOptions: [],
    selectedEnd: null,
    sceneReferenceModes: {},
    propReferenceImages: {},
    editingScenePrompt: {},
    editingCharacterPrompt: {},
    editingCoverPrompt: '',
    editingEndPrompt: '',
    editingSceneText: {},
    editingTitle: null,
    sceneIncludedCharacters: {},
    coverIncludedCharacters: [],
    endIncludedCharacters: [],
    sceneExcludedCharacters: {},
    coverExcludedCharacters: [],
    endExcludedCharacters: [],
    sceneReferenceImages: {},
    coverReferenceImage: null,
    endReferenceImage: null,
    landmarkVisible: {},
    recoveryRevision: 0,
    savedAt: '',
    version: 1,
  };
}

/**
 * Normaliza un snapshot completo aplicando el patch sobre el borrador vivo
 * (o los defaults si no hay borrador). Inyecta identidad y metadatos.
 */
function normalizeSnapshot(
  currentDraft: CuentacuentosDraftFull | null,
  patch: DraftPatch,
  liturgyId: string
): CuentacuentosDraftFull {
  const baseline = currentDraft ?? defaultDraft(liturgyId);
  const merged = mergePatch(baseline, patch);
  return {
    ...merged,
    liturgyId,
    savedAt: new Date().toISOString(),
    version: 1,
  };
}

// Cache de paths ya verificados/subidos en esta sesión: evita repetir un HEAD
// request por archivo en cada guardado (era O(N²) al acumular escenas).
const verifiedPaths = new Set<string>();

/**
 * Reemplaza en el draft las opciones base64 por las URLs públicas subidas en el
 * último guardado (solo cuando la cantidad coincide, mismo orden por key).
 * Así el draft retenido en memoria deja de arrastrar base64 y los guardados de
 * OTRAS categorías no re-suben imágenes ya persistidas.
 */
function applyUploadedUrlsToDraft(
  draft: CuentacuentosDraftFull,
  uploaded: DraftUploadedUrls | null
): CuentacuentosDraftFull {
  if (!uploaded) return draft;

  const swapRecord = <K extends string | number>(
    current: Record<K, string[]>,
    urls: Record<K, string[]>
  ): Record<K, string[]> => {
    const next = { ...current };
    for (const [key, urlList] of Object.entries(urls) as Array<[K, string[]]>) {
      const options = next[key];
      if (Array.isArray(options) && Array.isArray(urlList) && urlList.length > 0 && urlList.length === options.length) {
        next[key] = urlList;
      }
    }
    return next;
  };

  // Referencias de props: viven dentro de story.props (por id), no en un
  // Record aparte. Mismo criterio: solo si la cantidad coincide.
  const swappedStory = draft.story && uploaded.propImageUrls
    ? {
        ...draft.story,
        props: draft.story.props?.map(p => {
          const urls = uploaded.propImageUrls[p.id];
          return Array.isArray(urls) && urls.length > 0 && urls.length === (p.referenceImages || []).length
            ? { ...p, referenceImages: urls }
            : p;
        }),
      }
    : draft.story;

  // A3/S5: swap de referencias por escena/portada/fin. Regla: sólo si la
  // subida devolvió una URL, reemplaza la base64 en memoria (la clave
  // ausente preserva el valor actual).
  const sceneReferenceImages: Record<number, string> = { ...(draft.sceneReferenceImages || {}) };
  for (const [key, url] of Object.entries(uploaded.sceneReferenceUrls || {})) {
    if (typeof url === 'string' && url.length > 0) {
      sceneReferenceImages[Number(key)] = url;
    }
  }
  const coverReferenceImage = uploaded.coverReferenceUrl ?? draft.coverReferenceImage ?? null;
  const endReferenceImage = uploaded.endReferenceUrl ?? draft.endReferenceImage ?? null;

  return {
    ...draft,
    story: swappedStory,
    characterSheetOptions: swapRecord(draft.characterSheetOptions || {}, uploaded.characterSheetUrls),
    sceneImageOptions: swapRecord(draft.sceneImageOptions || {}, uploaded.sceneImageUrls),
    coverOptions: uploaded.coverUrls.length > 0 && uploaded.coverUrls.length === (draft.coverOptions || []).length
      ? uploaded.coverUrls
      : draft.coverOptions,
    endOptions: uploaded.endUrls.length > 0 && uploaded.endUrls.length === (draft.endOptions || []).length
      ? uploaded.endUrls
      : draft.endOptions,
    sceneReferenceImages,
    coverReferenceImage,
    endReferenceImage,
  };
}

/**
 * Verifica si un archivo existe en Storage usando HEAD request a la URL pública
 * Nota: download() no funciona bien con buckets públicos, así que usamos fetch HEAD
 */
async function checkFileExists(path: string): Promise<boolean> {
  if (verifiedPaths.has(path)) {
    return true;
  }
  try {
    // Construir la URL pública
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      console.log(`[checkFileExists] No public URL for path: ${path}`);
      return false;
    }

    // Usar HEAD request para verificar si el archivo existe sin descargarlo
    const response = await fetch(data.publicUrl, { method: 'HEAD' });
    const exists = response.ok;
    console.log(`[checkFileExists] Path: ${path}, URL: ${data.publicUrl.slice(0, 80)}..., exists: ${exists}, status: ${response.status}`);
    if (exists) {
      verifiedPaths.add(path);
    }
    return exists;
  } catch (err) {
    console.error(`[checkFileExists] Error checking path ${path}:`, err);
    return false;
  }
}

/**
 * Sube una imagen base64 a Supabase Storage
 */
async function uploadImage(
  userId: string,
  liturgyId: string,
  category: string,
  key: string,
  index: number,
  base64Data: string
): Promise<string | null> {
  try {
    console.log(`[useCuentacuentosDraft] uploadImage called: ${category}/${key}_${index}, data length: ${base64Data?.length || 0}, isURL: ${base64Data?.startsWith('http')}`);

    // Si ya es una URL, verificar si el archivo REALMENTE existe en Storage
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      // Es una URL - verificar si es de nuestro bucket de Supabase
      if (base64Data.includes('cuentacuentos-drafts')) {
        // Extraer el path del storage de la URL
        const match = base64Data.match(/cuentacuentos-drafts\/([^?]+)/);
        if (match) {
          const extractedPath = match[1];
          // CRITICAL FIX: Verificar que el archivo REALMENTE existe
          const exists = await checkFileExists(extractedPath);
          if (exists) {
            console.log(`[useCuentacuentosDraft] File EXISTS at path: ${extractedPath}`);
            return extractedPath;
          } else {
            console.warn(`[useCuentacuentosDraft] File NOT FOUND at path: ${extractedPath}, cannot recover`);
            // El archivo no existe - retornar null porque no podemos recrearlo desde una URL
            return null;
          }
        }
      }
      // CRITICAL FIX: For any storage URL, try harder to extract path
      // Try different URL formats
      const altMatch = base64Data.match(/\/storage\/v1\/object\/public\/cuentacuentos-drafts\/([^?]+)/);
      if (altMatch) {
        const extractedPath = altMatch[1];
        // Verificar que el archivo existe
        const exists = await checkFileExists(extractedPath);
        if (exists) {
          console.log(`[useCuentacuentosDraft] File EXISTS at extracted path: ${extractedPath}`);
          return extractedPath;
        } else {
          console.warn(`[useCuentacuentosDraft] File NOT FOUND at extracted path: ${extractedPath}`);
          return null;
        }
      }

      // External URL - cannot process, return null
      console.warn('[useCuentacuentosDraft] External URL cannot be processed:', base64Data.slice(0, 100));
      return null;
    }

    // Si es un data URL, extraer el base64
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      if (parts.length > 1) {
        base64Data = parts[1];
      }
    }

    // Detectar tipo de imagen
    const mimeType = base64Data.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

    // Convertir base64 a blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Path: userId/liturgyId/category/key_index.png
    const path = `${userId}/${liturgyId}/${category}/${key}_${index}.${extension}`;

    console.log(`[useCuentacuentosDraft] Uploading to path: ${path}, blob size: ${blob.size}, mimeType: ${mimeType}`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('[useCuentacuentosDraft] Error uploading image:', error);
      console.error('[useCuentacuentosDraft] Error details:', JSON.stringify(error));
      return null;
    }

    console.log(`[useCuentacuentosDraft] Upload SUCCESS: ${path}, response:`, data);
    verifiedPaths.add(path);
    return path;
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error uploading image:', err);
    return null;
  }
}

/**
 * Obtiene una URL pública de una imagen en Supabase Storage
 * El bucket es público, así que las URLs no expiran
 */
function getPublicUrl(path: string): string {
  // Si el path ya es una URL completa, retornarla tal cual
  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log(`[useCuentacuentosDraft] getPublicUrl: path is already URL: ${path.slice(0, 80)}`);
    return path;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  console.log(`[useCuentacuentosDraft] getPublicUrl: path=${path} -> url=${data.publicUrl.slice(0, 100)}`);
  return data.publicUrl;
}

/**
 * Descarga una imagen de Supabase Storage y la convierte a base64
 * @deprecated Usar getPublicUrl en su lugar para mejor rendimiento
 */
async function downloadImage(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error || !data) {
      console.error('[useCuentacuentosDraft] Error downloading image:', error);
      return null;
    }

    // Convertir blob a base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(data);
    });
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error downloading image:', err);
    return null;
  }
}

/**
 * Guarda todas las imágenes de un draft a Storage
 */
async function saveImagesToStorage(
  userId: string,
  liturgyId: string,
  draft: CuentacuentosDraftFull,
  categories: UploadCategories
): Promise<{
  characterSheetPaths: Record<string, string[]>;
  sceneImagePaths: Record<number, string[]>;
  coverPaths: string[];
  endPaths: string[];
  propImagePaths: Record<string, string[]>;
  sceneReferencePaths: Record<number, string>;
  coverReferencePath: string | null;
  endReferencePath: string | null;
}> {
  const characterSheetPaths: Record<string, string[]> = {};
  const sceneImagePaths: Record<number, string[]> = {};
  const coverPaths: string[] = [];
  const endPaths: string[] = [];
  const propImagePaths: Record<string, string[]> = {};
  const sceneReferencePaths: Record<number, string> = {};
  let coverReferencePath: string | null = null;
  let endReferencePath: string | null = null;

  // Todas las subidas se acumulan como tareas y corren en paralelo (límite 6),
  // escribiendo en slots pre-asignados para preservar el orden por key.
  const jobs: Array<() => Promise<void>> = [];
  const finalize: Array<() => void> = [];

  const queueGroup = (
    options: string[],
    upload: (index: number, data: string) => Promise<string | null>,
    assign: (paths: string[]) => void
  ) => {
    const slots: (string | null)[] = new Array(options.length).fill(null);
    options.forEach((imageData, i) => {
      jobs.push(async () => {
        slots[i] = await upload(i, imageData);
      });
    });
    finalize.push(() => assign(slots.filter((p): p is string => !!p)));
  };

  if (categories.characterSheets) {
    for (const [charId, options] of Object.entries(draft.characterSheetOptions || {})) {
      queueGroup(
        options,
        (i, data) => uploadImage(userId, liturgyId, 'characters', charId, i, data),
        (paths) => { characterSheetPaths[charId] = paths; }
      );
    }
  }

  if (categories.sceneImages) {
    for (const [sceneNum, options] of Object.entries(draft.sceneImageOptions || {})) {
      const num = Number(sceneNum);
      queueGroup(
        options,
        (i, data) => uploadImage(userId, liturgyId, 'scenes', `scene${sceneNum}`, i, data),
        (paths) => {
          sceneImagePaths[num] = paths;
          console.log(`[useCuentacuentosDraft] Scene ${sceneNum}: ${paths.length} paths saved`);
        }
      );
    }
  }

  if (categories.cover) {
    queueGroup(
      draft.coverOptions || [],
      (i, data) => uploadImage(userId, liturgyId, 'cover', 'cover', i, data),
      (paths) => { coverPaths.push(...paths); }
    );
  }

  if (categories.end) {
    queueGroup(
      draft.endOptions || [],
      (i, data) => uploadImage(userId, liturgyId, 'end', 'end', i, data),
      (paths) => { endPaths.push(...paths); }
    );
  }

  // Subir imágenes de referencia de props: la fuente depende de qué clave del
  // patch la disparó. `propReferenceImages` presente manda literalmente (`{}`
  // limpia); si está ausente y `story` está presente, derivamos de `story.props`.
  if (categories.props) {
    const propSources: Record<string, string[]> = {};
    if (categories.props === 'propRefs') {
      for (const [propId, images] of Object.entries(draft.propReferenceImages || {})) {
        if (Array.isArray(images) && images.length > 0) {
          propSources[propId] = images;
        }
      }
    } else {
      for (const prop of draft.story?.props || []) {
        if (prop?.id && Array.isArray(prop.referenceImages) && prop.referenceImages.length > 0) {
          propSources[prop.id] = prop.referenceImages;
        }
      }
    }

    for (const [propId, images] of Object.entries(propSources)) {
      queueGroup(
        images,
        (i, data) => uploadImage(userId, liturgyId, 'props', propId, i, data),
        (paths) => { propImagePaths[propId] = paths; }
      );
    }
  }

  // A3/S5: single-image reference uploads. Each slot is a scalar (not an array
  // like options) so we use a small helper that assigns via a captured setter.
  const queueSingle = (
    imageData: string | null | undefined,
    upload: (data: string) => Promise<string | null>,
    assign: (path: string | null) => void
  ) => {
    if (typeof imageData !== 'string' || imageData.length === 0) {
      assign(null);
      return;
    }
    let slot: string | null = null;
    jobs.push(async () => {
      slot = await upload(imageData);
    });
    finalize.push(() => assign(slot));
  };

  if (categories.sceneReferences) {
    for (const [sceneNum, image] of Object.entries(draft.sceneReferenceImages || {})) {
      const num = Number(sceneNum);
      queueSingle(
        image,
        (data) => uploadImage(userId, liturgyId, 'sceneRefs', `scene${sceneNum}`, 0, data),
        (path) => { if (path) sceneReferencePaths[num] = path; }
      );
    }
  }

  if (categories.coverReference) {
    queueSingle(
      draft.coverReferenceImage ?? null,
      (data) => uploadImage(userId, liturgyId, 'coverRef', 'cover', 0, data),
      (path) => { coverReferencePath = path; }
    );
  }

  if (categories.endReference) {
    queueSingle(
      draft.endReferenceImage ?? null,
      (data) => uploadImage(userId, liturgyId, 'endRef', 'end', 0, data),
      (path) => { endReferencePath = path; }
    );
  }

  await runWithConcurrency(jobs, 6);
  finalize.forEach((fn) => fn());

  return {
    characterSheetPaths,
    sceneImagePaths,
    coverPaths,
    endPaths,
    propImagePaths,
    sceneReferencePaths,
    coverReferencePath,
    endReferencePath,
  };
}

/**
 * Carga todas las imágenes de Storage como URLs firmadas (no base64)
 * Esto es mucho más rápido que descargar y convertir a base64
 * Las URLs firmadas funcionan con buckets privados
 */
async function loadImagesFromStorage(
  paths: {
    characterSheetPaths: Record<string, string[]>;
    sceneImagePaths: Record<number, string[]>;
    coverPaths: string[];
    endPaths: string[];
    propImagePaths?: Record<string, string[]>;
    sceneReferencePaths?: Record<number, string>;
    coverReferencePath?: string | null;
    endReferencePath?: string | null;
  }
): Promise<{
  characterSheetOptions: Record<string, string[]>;
  sceneImageOptions: Record<number, string[]>;
  coverOptions: string[];
  endOptions: string[];
  propReferenceImages: Record<string, string[]>;
  sceneReferenceImages: Record<number, string>;
  coverReferenceImage: string | null;
  endReferenceImage: string | null;
}> {
  const characterSheetOptions: Record<string, string[]> = {};
  const sceneImageOptions: Record<number, string[]> = {};
  const coverOptions: string[] = [];
  const endOptions: string[] = [];
  const propReferenceImages: Record<string, string[]> = {};
  const sceneReferenceImages: Record<number, string> = {};
  let coverReferenceImage: string | null = null;
  let endReferenceImage: string | null = null;

  // Helper function to handle __FULLURL__ marker
  const pathToUrl = (path: string): string => {
    if (path.startsWith('__FULLURL__')) {
      // It's already a full URL, return without the marker
      const url = path.replace('__FULLURL__', '');
      console.log(`[useCuentacuentosDraft] Restored full URL from marker: ${url.slice(0, 80)}`);
      return url;
    }
    return getPublicUrl(path);
  };

  // Generar URLs públicas para character sheets
  for (const [charId, pathList] of Object.entries(paths.characterSheetPaths || {})) {
    const urls = pathList.map(path => pathToUrl(path));
    characterSheetOptions[charId] = urls;
  }

  // Generar URLs públicas para scene images
  // IMPORTANTE: Las keys en JSON siempre son strings, pero el código las accede como números
  // Guardamos tanto la key numérica como string para asegurar compatibilidad
  for (const [sceneNum, pathList] of Object.entries(paths.sceneImagePaths || {})) {
    const num = Number(sceneNum);
    if (pathList && pathList.length > 0) {
      const urls = pathList.map(path => pathToUrl(path));
      // Guardar con ambas keys para asegurar que funcione sin importar cómo se acceda
      sceneImageOptions[num] = urls;
      // También como string por si el acceso es con string
      (sceneImageOptions as Record<string | number, string[]>)[sceneNum] = urls;
      console.log(`[useCuentacuentosDraft] Scene ${num}: loaded ${urls.length} URLs, first: ${urls[0]?.slice(0, 80)}`);
    }
  }

  // Generar URLs públicas para cover options
  const coverUrls = (paths.coverPaths || []).map(path => pathToUrl(path));
  coverOptions.push(...coverUrls);

  // Generar URLs públicas para end options
  const endUrls = (paths.endPaths || []).map(path => pathToUrl(path));
  endOptions.push(...endUrls);

  // Generar URLs públicas para prop reference images
  for (const [propId, pathList] of Object.entries(paths.propImagePaths || {})) {
    if (pathList && pathList.length > 0) {
      propReferenceImages[propId] = pathList.map(path => pathToUrl(path));
    }
  }

  // A3/S5: resolve single-image reference paths to display URLs.
  for (const [sceneNum, path] of Object.entries(paths.sceneReferencePaths || {})) {
    const num = Number(sceneNum);
    if (typeof path === 'string' && path.length > 0) {
      sceneReferenceImages[num] = pathToUrl(path);
    }
  }
  if (typeof paths.coverReferencePath === 'string' && paths.coverReferencePath.length > 0) {
    coverReferenceImage = pathToUrl(paths.coverReferencePath);
  }
  if (typeof paths.endReferencePath === 'string' && paths.endReferencePath.length > 0) {
    endReferenceImage = pathToUrl(paths.endReferencePath);
  }

  console.log(`[useCuentacuentosDraft] Generated public URLs for ${Object.keys(sceneImageOptions).length} scene sets`);

  return {
    characterSheetOptions,
    sceneImageOptions,
    coverOptions,
    endOptions,
    propReferenceImages,
    sceneReferenceImages,
    coverReferenceImage,
    endReferenceImage,
  };
}

export interface SaveDraftInput {
  userId: string;
  liturgyId: string;
  snapshot: CuentacuentosDraftFull;
  /** Patch original: sólo las claves aquí presentes son escritas en persistencia. */
  patch: DraftPatch;
}

export interface SaveDraftSuccess {
  uploadedUrls: DraftUploadedUrls;
}

/**
 * Guarda un borrador en Supabase.
 *
 * Semántica de escritura: cada categoría de imágenes (character sheets,
 * scenes, cover, end, props) y `sceneReferenceModes` se persisten sólo si
 * el `patch` tiene su clave presente. Colecciones vacías presentes limpian
 * la persistencia; claves ausentes preservan lo existente en DB.
 *
 * Lanza (`throw`) si la persistencia falla.
 */
async function saveDraftToSupabase(input: SaveDraftInput): Promise<SaveDraftSuccess> {
  const { userId, liturgyId, snapshot: draft, patch } = input;
  const has = (k: keyof DraftPatch) => Object.prototype.hasOwnProperty.call(patch, k);
  const categories = categoriesFromPatch(patch);
  const writeSceneModes = has('sceneReferenceModes');
  try {
    console.log(`[useCuentacuentosDraft] Saving draft to Supabase, step: ${draft.currentStep}`);
    console.log(`[useCuentacuentosDraft] Draft has ${Object.keys(draft.sceneImageOptions || {}).length} scene image sets`);
    console.log(`[useCuentacuentosDraft] Draft has ${Object.keys(draft.characterSheetOptions || {}).length} character sheet sets`);

    // Primero obtener los paths existentes para no sobrescribirlos. Un fallo
    // del SELECT no puede degradarse a "sin paths existentes": arriesgaría
    // borrar categorías que el patch no toca. Abortamos antes de subir o upsert.
    const { data: existingDraft, error: selectError } = await supabase
      .from('cuentacuentos_drafts')
      .select('image_paths')
      .eq('liturgia_id', liturgyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) {
      console.error('[useCuentacuentosDraft] Error reading existing image_paths:', selectError);
      throw new Error(`saveDraftToSupabase select failed: ${selectError.message ?? String(selectError)}`);
    }

    const existingPaths = (existingDraft?.image_paths as {
      characterSheetPaths?: Record<string, string[]>;
      sceneImagePaths?: Record<number, string[]>;
      coverPaths?: string[];
      endPaths?: string[];
      propImagePaths?: Record<string, string[]>;
      sceneReferenceModes?: Record<number, 'style' | 'pov'>;
      sceneReferencePaths?: Record<number, string>;
      coverReferencePath?: string | null;
      endReferencePath?: string | null;
    }) || {
      characterSheetPaths: {},
      sceneImagePaths: {},
      coverPaths: [],
      endPaths: [],
      propImagePaths: {},
      sceneReferenceModes: {},
      sceneReferencePaths: {},
      coverReferencePath: null,
      endReferencePath: null,
    };

    // Subir sólo las categorías que el patch tocó (patch presence).
    const newImagePaths = await saveImagesToStorage(userId, liturgyId, draft, categories);

    // Semántica de escritura por own-key presence del patch: si la clave está
    // presente, la escritura reemplaza (incluso a vacío); si está ausente, se
    // preserva lo existente en DB. Nunca se decide por truthiness ni length.
    const mergedPaths: {
      characterSheetPaths: Record<string, string[]>;
      sceneImagePaths: Record<string | number, string[]>;
      coverPaths: string[];
      endPaths: string[];
      propImagePaths: Record<string, string[]>;
      sceneReferenceModes: Record<number, 'style' | 'pov'>;
      sceneReferencePaths: Record<number, string>;
      coverReferencePath: string | null;
      endReferencePath: string | null;
    } = {
      characterSheetPaths: categories.characterSheets
        ? { ...newImagePaths.characterSheetPaths }
        : { ...(existingPaths.characterSheetPaths || {}) },
      sceneImagePaths: categories.sceneImages
        ? { ...newImagePaths.sceneImagePaths }
        : { ...(existingPaths.sceneImagePaths || {}) },
      coverPaths: categories.cover
        ? [...newImagePaths.coverPaths]
        : (existingPaths.coverPaths || []),
      endPaths: categories.end
        ? [...newImagePaths.endPaths]
        : (existingPaths.endPaths || []),
      propImagePaths: categories.props
        ? { ...newImagePaths.propImagePaths }
        : { ...(existingPaths.propImagePaths || {}) },
      // sceneReferenceModes se persiste sólo si el patch lo toca; en caso
      // contrario preservamos lo que ya hay en DB.
      sceneReferenceModes: writeSceneModes
        ? { ...(draft.sceneReferenceModes || {}) }
        : { ...(existingPaths.sceneReferenceModes || {}) },
      // A3/S5: reference paths persistidas sólo cuando el patch tocó la
      // categoría correspondiente. Ausencia preserva lo existente.
      sceneReferencePaths: categories.sceneReferences
        ? { ...newImagePaths.sceneReferencePaths }
        : { ...(existingPaths.sceneReferencePaths || {}) },
      coverReferencePath: categories.coverReference
        ? newImagePaths.coverReferencePath
        : (existingPaths.coverReferencePath ?? null),
      endReferencePath: categories.endReference
        ? newImagePaths.endReferencePath
        : (existingPaths.endReferencePath ?? null),
    };

    // Orphan purge: sólo cuando el patch tocó props (recalculó el conjunto
    // de propImagePaths). Si el patch no tocó props, no removemos huérfanos
    // porque no tenemos evidencia de que el usuario haya intentado limpiarlos.
    if (categories.props) {
      const currentPropIds = new Set<string>(
        (draft.story?.props || [])
          .map(p => p?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      );
      const orphanedPropStoragePaths: string[] = [];
      for (const key of Object.keys(mergedPaths.propImagePaths)) {
        if (!currentPropIds.has(key)) {
          const paths = mergedPaths.propImagePaths[key] || [];
          for (const p of paths) {
            if (typeof p === 'string' && p.length > 0 && !p.startsWith('http') && !p.startsWith('__FULLURL__')) {
              orphanedPropStoragePaths.push(p);
            }
          }
          delete mergedPaths.propImagePaths[key];
          console.log(`[useCuentacuentosDraft] Purging orphaned propImagePaths key: ${key}`);
        }
      }

      if (orphanedPropStoragePaths.length > 0) {
        try {
          const { error: removeError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(orphanedPropStoragePaths);
          if (removeError) {
            console.warn(
              `[useCuentacuentosDraft] Best-effort orphan prop storage delete failed (${orphanedPropStoragePaths.length} files):`,
              removeError
            );
          } else {
            orphanedPropStoragePaths.forEach((p) => verifiedPaths.delete(p));
            console.log(
              `[useCuentacuentosDraft] Deleted ${orphanedPropStoragePaths.length} orphaned prop file(s) from storage`
            );
          }
        } catch (err) {
          console.warn('[useCuentacuentosDraft] Best-effort orphan prop storage delete threw:', err);
        }
      }
    }

    console.log(`[useCuentacuentosDraft] MERGE RESULT - scenes before: ${Object.keys(existingPaths.sceneImagePaths || {}).length}, after: ${Object.keys(mergedPaths.sceneImagePaths).length}`);

    // Preparar story sin imágenes base64/data URLs. Invariante A3: las
    // referencias de imágenes en el JSON persistido son Storage paths (o URLs
    // públicas que las envuelven), NUNCA base64 ni data URLs. Los paths reales
    // viven en `image_paths` (arriba); el story JSON sólo lleva referencias no
    // inflables. Además, incrustamos `editorStateV1` versionado dentro del
    // payload de story para permitir evolución sin migración.
    const stripImageRef = (v: unknown): string | undefined => {
      if (typeof v !== 'string') return undefined;
      if (v.startsWith('data:')) return undefined;
      if (isNonPathImageRef(v)) return undefined;
      return v;
    };
    // A3/S5: snapshot canónico extendido embebido dentro del payload de story.
    // Cubre todos los campos de EditorStateV1Extended, no sólo selecciones.
    // `recoveryRevision` viene ya incrementado por `saveDraftNow` (fuente única
    // de bump para que el snapshot devuelto refleje el mismo valor).
    const editorStateV1Extended: EditorStateV1Extended = buildEditorStateV1FromDraft(
      draft,
      draft.story
    );
    const rawCleanStory = draft.story ? {
      ...draft.story,
      characters: draft.story.characters?.map(c => ({
        ...c,
        characterSheetUrl: undefined,
        characterSheetOptions: undefined,
      })),
      scenes: draft.story.scenes?.map(s => ({
        ...s,
        selectedImageUrl: undefined,
        imageOptions: undefined,
      })),
      // Las imágenes de props ya se subieron a Storage (propImagePaths) y se
      // restauran desde ahí al cargar: el JSON del story sólo puede llevar
      // referencias no inflables (paths o URLs públicas), nunca base64.
      props: draft.story.props?.map(p => ({
        ...p,
        referenceImages: (p.referenceImages || [])
          .map(stripImageRef)
          .filter((img): img is string => !!img),
        selectedReferenceUrl: stripImageRef(p.selectedReferenceUrl),
      })),
      coverImageUrl: undefined,
      coverImageOptions: undefined,
      endImageUrl: undefined,
      endImageOptions: undefined,
    } : null;
    // A3/S5: scrub recursivo de referencias no-path (base64/data URLs) en TODO
    // el árbol antes de embed. Nunca dejamos base64 en el JSON persistido.
    const cleanStory = rawCleanStory
      ? ({
          ...(scrubImageRefsDeep(rawCleanStory) as Record<string, unknown>),
          // Bloque versionado embebido (post-scrub, snapshot canónico).
          editorStateV1: editorStateV1Extended,
        } as unknown as Record<string, unknown>)
      : null;

    // Guardar en la tabla
    const { error } = await supabase
      .from('cuentacuentos_drafts')
      .upsert({
        liturgia_id: liturgyId,
        user_id: userId,
        current_step: draft.currentStep,
        config: draft.config,
        story: cleanStory,
        selected_character_sheets: draft.selectedCharacterSheets,
        selected_scene_images: draft.selectedSceneImages,
        selected_cover: draft.selectedCover,
        selected_end: draft.selectedEnd,
        // Guardar los paths MERGED para no perder los existentes
        image_paths: mergedPaths,
      } as Record<string, unknown>, {
        onConflict: 'liturgia_id,user_id',
      });

    if (error) {
      console.error('[useCuentacuentosDraft] Error saving draft:', error);
      throw new Error(`saveDraftToSupabase upsert failed: ${error.message ?? String(error)}`);
    }

    console.log(`[useCuentacuentosDraft] Draft saved successfully, total scene paths: ${Object.keys(mergedPaths.sceneImagePaths).length}`);

    // URLs públicas de lo subido/verificado en ESTE guardado, para que el editor
    // reemplace base64 en memoria por URLs y los próximos guardados no re-suban nada.
    const uploadedUrls: DraftUploadedUrls = {
      characterSheetUrls: Object.fromEntries(
        Object.entries(newImagePaths.characterSheetPaths).map(([key, paths]) => [key, paths.map(getPublicUrl)])
      ),
      sceneImageUrls: Object.fromEntries(
        Object.entries(newImagePaths.sceneImagePaths).map(([key, paths]) => [key, paths.map(getPublicUrl)])
      ) as Record<number, string[]>,
      coverUrls: newImagePaths.coverPaths.map(getPublicUrl),
      endUrls: newImagePaths.endPaths.map(getPublicUrl),
      propImageUrls: Object.fromEntries(
        Object.entries(newImagePaths.propImagePaths).map(([key, paths]) => [key, paths.map(getPublicUrl)])
      ),
      sceneReferenceUrls: Object.fromEntries(
        Object.entries(newImagePaths.sceneReferencePaths).map(([key, path]) => [Number(key), getPublicUrl(path)])
      ) as Record<number, string>,
      coverReferenceUrl: newImagePaths.coverReferencePath
        ? getPublicUrl(newImagePaths.coverReferencePath)
        : null,
      endReferenceUrl: newImagePaths.endReferencePath
        ? getPublicUrl(newImagePaths.endReferencePath)
        : null,
    };

    return { uploadedUrls };
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error saving draft:', err);
    throw err;
  }
}

/**
 * Primitivo de persistencia (sin React). Normaliza el snapshot final y lo
 * persiste vía `saveDraftToSupabase`. Rechaza (`throw`) si la persistencia
 * falla. Devuelve el snapshot normalizado y las URLs subidas.
 *
 * No toca `draftRef`, ni React draft state, ni `lastSavedAt`, ni expone
 * setters: es una función pura de I/O sobre Supabase/Storage, testable sin
 * renderizar el hook. Es el único camino de persistencia usado por
 * `enqueueDraftWrite`; no debe llamarse desde ningún otro sitio en producción.
 */
export async function saveDraftNow(input: {
  userId: string;
  liturgyId: string;
  currentDraft: CuentacuentosDraftFull | null;
  patch: DraftPatch;
}): Promise<{ snapshot: CuentacuentosDraftFull; uploadedUrls: DraftUploadedUrls }> {
  const baseSnapshot = normalizeSnapshot(input.currentDraft, input.patch, input.liturgyId);
  // A3/S5: recoveryRevision monotónico por intento de persistencia. Se refleja
  // en el snapshot embebido (`editorStateV1`) y en el snapshot devuelto para
  // que el React state hidrate con el mismo valor tras el commit.
  const snapshot: CuentacuentosDraftFull = {
    ...baseSnapshot,
    recoveryRevision: (baseSnapshot.recoveryRevision ?? 0) + 1,
  };
  const { uploadedUrls } = await saveDraftToSupabase({
    userId: input.userId,
    liturgyId: input.liturgyId,
    snapshot,
    patch: input.patch,
  });
  return { snapshot, uploadedUrls };
}

/**
 * Carga un borrador desde Supabase
 */
async function loadDraftFromSupabase(
  userId: string,
  liturgyId: string
): Promise<CuentacuentosDraftFull | null> {
  try {
    const { data, error } = await supabase
      .from('cuentacuentos_drafts')
      .select('*')
      .eq('liturgia_id', liturgyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[useCuentacuentosDraft] Error loading draft:', error);
      return null;
    }

    if (!data) {
      // No draft found - this is normal for new liturgies
      return null;
    }

    // Cargar imágenes desde Storage
    const imagePaths = (data as Record<string, unknown>).image_paths as {
      characterSheetPaths: Record<string, string[]>;
      sceneImagePaths: Record<number, string[]>;
      coverPaths: string[];
      endPaths: string[];
      propImagePaths?: Record<string, string[]>;
      sceneReferenceModes?: Record<number, 'style' | 'pov'>;
      sceneReferencePaths?: Record<number, string>;
      coverReferencePath?: string | null;
      endReferencePath?: string | null;
    } | undefined;

    let imageOptions = {
      characterSheetOptions: {} as Record<string, string[]>,
      sceneImageOptions: {} as Record<number, string[]>,
      coverOptions: [] as string[],
      endOptions: [] as string[],
      propReferenceImages: {} as Record<string, string[]>,
      sceneReferenceImages: {} as Record<number, string>,
      coverReferenceImage: null as string | null,
      endReferenceImage: null as string | null,
    };

    if (imagePaths) {
      console.log('[useCuentacuentosDraft] Loading images from storage...');
      console.log('[useCuentacuentosDraft] Raw imagePaths from DB:', JSON.stringify(imagePaths, null, 2));
      imageOptions = await loadImagesFromStorage(imagePaths);
      console.log(`[useCuentacuentosDraft] Loaded ${Object.keys(imageOptions.sceneImageOptions).length} scene image sets`);
      console.log('[useCuentacuentosDraft] Scene image options:', Object.entries(imageOptions.sceneImageOptions).map(([k, v]) => `${k}: ${v.length} images`));
    } else {
      console.log('[useCuentacuentosDraft] No imagePaths found in DB record');
    }

    // Restaurar los modos de referencia de escena (style/pov) desde image_paths.
    // Las keys de JSONB siempre son strings, así que normalizamos a number para match con scene.number.
    const rawModes = imagePaths?.sceneReferenceModes || {};
    const sceneReferenceModes: Record<number, 'style' | 'pov'> = {};
    for (const [key, value] of Object.entries(rawModes)) {
      if (value === 'style' || value === 'pov') {
        sceneReferenceModes[Number(key)] = value;
      }
    }

    // A3/S5: Extraer EditorStateV1 (extendido) embebido. Un draft legado (sin
    // `editorStateV1` o con `version` desconocida) hidrata con defaults seguros
    // vía `restoreEditorStateV1`. El shape antiguo (sólo selecciones) también
    // pasa por el mismo mapper: los campos ausentes quedan en su default.
    const rawStory = data.story as (Story & { editorStateV1?: unknown }) | null;
    const rawEditorState = rawStory && typeof rawStory === 'object'
      ? (rawStory as { editorStateV1?: unknown }).editorStateV1
      : undefined;
    // `restoreEditorStateV1` normaliza faltas a defaults; shape mínimo legacy
    // (sólo selecciones) también pasa, con el resto en defaults.
    const restored = restoreEditorStateV1(rawEditorState);
    // Stripping: el hook expone `Story`, no un Story + editorStateV1 mezclado.
    const story: Story | null = rawStory
      ? (() => {
          const { editorStateV1: _drop, ...rest } = rawStory as Story & {
            editorStateV1?: unknown;
          };
          void _drop;
          return rest as Story;
        })()
      : null;
    const { propReferenceImages } = imageOptions;

    if (story?.props && propReferenceImages) {
      story.props = story.props.map(p => ({
        ...p,
        referenceImages: propReferenceImages[p.id] ?? p.referenceImages ?? [],
      }));
    }

    // Sanitizar índices de selección: si una subida parcial dejó menos paths
    // que opciones, un índice persistido puede quedar fuera de rango y la
    // "selección" apuntaría a nada (escena/personaje sin imagen al finalizar).
    const sanitizeSelections = <K extends string | number>(
      selections: Record<K, number>,
      options: Record<K, string[]>
    ): Record<K, number> => {
      const next = {} as Record<K, number>;
      for (const [key, idx] of Object.entries(selections) as Array<[K, number]>) {
        const opts = options[key];
        if (typeof idx === 'number' && Array.isArray(opts) && idx >= 0 && idx < opts.length) {
          next[key] = idx;
        } else {
          console.warn(`[useCuentacuentosDraft] Selección fuera de rango descartada: key=${String(key)}, idx=${idx}, opciones=${opts?.length ?? 0}`);
        }
      }
      return next;
    };

    // A3/S5: preferimos `sceneReferenceModes` del snapshot v1 restaurado si
    // trae valores; si no, caemos al bloque `image_paths` (compat legacy).
    const modesFromV1 = restored.sceneReferenceModes;
    const effectiveSceneReferenceModes = Object.keys(modesFromV1).length > 0
      ? modesFromV1
      : sceneReferenceModes;

    // Extraer imageOptions sin sobreescribir sceneReferenceModes (que ya
    // computamos como effective arriba).
    const {
      characterSheetOptions,
      sceneImageOptions,
      coverOptions,
      endOptions,
      propReferenceImages: propRefs,
      sceneReferenceImages,
      coverReferenceImage,
      endReferenceImage,
    } = imageOptions;
    void propRefs; // ya inyectado en story.props arriba.

    // A3a/S2 (item 5): currentStep — solo confiamos en el snapshot embebido
    // si el raw EditorStateV1 contenía un step válido explícito
    // (`restored.currentStep` no null). Cualquier otro caso (missing/invalid/
    // defaulted) preserva la columna dedicada `data.current_step`; solo si
    // ambos faltan aplicamos el default 'config'.
    const rawColumnStep = (data.current_step as CuentacuentosDraft['currentStep'] | null | undefined) ?? null;
    const resolvedCurrentStep: CuentacuentosDraft['currentStep'] =
      restored.currentStep ?? rawColumnStep ?? 'config';

    // A3a/S2 (item 11): selections — la columna dedicada gana solo cuando
    // trae datos significativos. Un `{}` vacío (escritura parcial legada) cae
    // al snapshot v1 embebido; `null`/`undefined` también.
    const hasMeaningfulRecord = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length > 0;

    const dataCharSheets = data.selected_character_sheets as Record<string, number> | null | undefined;
    const dataSceneImages = data.selected_scene_images as Record<number, number> | null | undefined;

    const resolvedCharacterSheets: Record<string, number> = hasMeaningfulRecord(dataCharSheets)
      ? (dataCharSheets as Record<string, number>)
      : restored.selectedCharacterSheets;
    const resolvedSceneImages: Record<number, number> = hasMeaningfulRecord(dataSceneImages)
      ? (dataSceneImages as Record<number, number>)
      : restored.selectedSceneImages;

    const draft: CuentacuentosDraftFull = {
      liturgyId,
      currentStep: resolvedCurrentStep,
      config: data.config as CuentacuentosDraft['config'],
      story,
      // Selections: la columna dedicada de DB es la fuente autoritativa (el
      // editor la escribe directo). El snapshot v1 cubre los casos donde la
      // columna esté vacía por escritura parcial (`{}` cae al v1).
      selectedCharacterSheets: sanitizeSelections(
        resolvedCharacterSheets,
        characterSheetOptions
      ),
      selectedSceneImages: sanitizeSelections(
        resolvedSceneImages,
        sceneImageOptions
      ),
      selectedCover: (data.selected_cover as number | null) ?? restored.selectedCover,
      selectedEnd: (data.selected_end as number | null) ?? restored.selectedEnd,
      sceneReferenceModes: effectiveSceneReferenceModes,
      savedAt: data.updated_at as string,
      version: 1,
      characterSheetOptions,
      sceneImageOptions,
      coverOptions,
      endOptions,
      propReferenceImages: imageOptions.propReferenceImages,
      // A3/S5: buffers editor persistidos como parte del snapshot v1.
      editingScenePrompt: restored.editingScenePrompt,
      editingCharacterPrompt: restored.editingCharacterPrompt,
      editingCoverPrompt: restored.editingCoverPrompt,
      editingEndPrompt: restored.editingEndPrompt,
      editingSceneText: restored.editingSceneText,
      editingTitle: restored.editingTitle,
      sceneIncludedCharacters: restored.sceneIncludedCharacters,
      coverIncludedCharacters: restored.coverIncludedCharacters,
      endIncludedCharacters: restored.endIncludedCharacters,
      sceneExcludedCharacters: restored.sceneExcludedCharacters,
      coverExcludedCharacters: restored.coverExcludedCharacters,
      endExcludedCharacters: restored.endExcludedCharacters,
      sceneReferenceImages,
      coverReferenceImage,
      endReferenceImage,
      landmarkVisible: restored.landmarkVisible,
      recoveryRevision: restored.recoveryRevision,
    };

    // A3/S5: rehidratar campos story-tree desde v1 si el árbol perdió alguno
    // por una escritura previa parcial (title/overlays/scene.text/landmark).
    if (draft.story) {
      const s = draft.story as Story;
      const patched: Story = { ...s };
      if (restored.editingTitle && (!s.title || s.title.length === 0)) {
        patched.title = restored.editingTitle;
      }
      if (restored.coverTextOverlay && !s.coverTextOverlay) {
        patched.coverTextOverlay = restored.coverTextOverlay;
      }
      if (restored.endTextOverlay && !s.endTextOverlay) {
        patched.endTextOverlay = restored.endTextOverlay;
      }
      if (Array.isArray(s.scenes) && s.scenes.length > 0) {
        patched.scenes = s.scenes.map((scene) => {
          const editedText = restored.editingSceneText[scene.number];
          const lv = restored.landmarkVisible[scene.number];
          const next = { ...scene };
          if (typeof editedText === 'string' && (!scene.text || scene.text.length === 0)) {
            next.text = editedText;
          }
          if (typeof lv === 'boolean' && typeof scene.landmarkVisible !== 'boolean') {
            next.landmarkVisible = lv;
          }
          return next;
        });
      }
      draft.story = patched;
    }

    return draft;
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error loading draft:', err);
    return null;
  }
}

/**
 * Elimina un borrador de Supabase
 * IMPORTANTE: NO elimina las imágenes del storage porque pueden estar siendo
 * referenciadas por la liturgia guardada. Solo elimina el registro del draft.
 * Para eliminar las imágenes, usar deleteStoryImages() explícitamente.
 */
async function deleteDraftFromSupabase(
  userId: string,
  liturgyId: string
): Promise<boolean> {
  try {
    // Solo eliminar registro de la tabla - NO eliminar imágenes del storage
    // Las imágenes se mantienen porque la liturgia guardada las referencia
    const { error } = await supabase
      .from('cuentacuentos_drafts')
      .delete()
      .eq('liturgia_id', liturgyId)
      .eq('user_id', userId);

    if (error) {
      console.error('[useCuentacuentosDraft] Error deleting draft:', error);
      return false;
    }

    console.log(`[useCuentacuentosDraft] Draft record deleted for liturgy ${liturgyId} (images preserved)`);
    return true;
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error deleting draft:', err);
    return false;
  }
}

export interface UseCuentacuentosDraftOptions {
  liturgyId: string;
}

/**
 * Resultado devuelto por `enqueueDraftWrite`. Contiene el snapshot normalizado
 * que se intentó persistir y las URLs subidas en esta escritura. La operación
 * puede haber persistido en Supabase sin que se hayan commiteado los cambios
 * al estado React del hook — eso ocurre cuando la identidad cambia entre la
 * captura inicial y la re-lectura tras el await (stale write).
 */
export interface EnqueueDraftWriteResult {
  snapshot: CuentacuentosDraftFull;
  uploadedUrls: DraftUploadedUrls;
  stale?: false;
}

/**
 * Resultado explícito de una escritura descartada. Dos rutas producen este
 * shape:
 *
 * 1. Pre-start (preStart guard): la operación NO tocó Supabase ni Storage.
 *    Cero upsert, cero upload, cero URL swap, cero React commit, cero
 *    success reporting. La reserva por-ítem (si aplica) queda intacta.
 *
 * 2. Post-start identity mismatch: el upsert YA corrió (I/O contra Supabase
 *    completada) pero la identidad lógica cambió entre la captura inicial
 *    y la re-lectura tras el `await`. En ese caso NO hay URL swap, NO se
 *    muta `draftRef`, NO se llama `setDraft`/`setLastSavedAt`, NO se
 *    dispara `onCommit`. El caller distingue esto de un `EnqueueDraftWriteResult`
 *    exitoso por la ausencia del snapshot: no debe reportar success río
 *    arriba (por ejemplo, el runner del pipeline A2 no debe marcar `done`
 *    con este resultado).
 */
export interface EnqueueDraftWriteStale {
  stale: true;
}

/**
 * Opciones que el llamador puede pasar a `enqueueDraftWrite`.
 * - `onCommit`: callback opcional que se invoca EXACTAMENTE una vez, sólo si
 *   la escritura persistió y su identidad capturada aún coincide con la
 *   identidad actual del hook en el momento del commit. No se invoca en
 *   escrituras "stale" (persistidas pero descartadas para el estado React).
 */
export interface EnqueueDraftWriteOptions {
  onCommit?: (uploadedUrls: DraftUploadedUrls, snapshot: CuentacuentosDraftFull) => void;
  /**
   * Guard de operation-start (A3). Se invoca SÍNCRONAMENTE dentro del tail de
   * la cola, INMEDIATAMENTE antes del upsert. Si devuelve `false`, la
   * operación cortocircuita a `{ stale: true }` y NO realiza:
   *   - `saveDraftNow` (no upsert, no uploads, no SELECT)
   *   - URL swaps sobre el draft (no `applyUploadedUrlsToDraft`)
   *   - React commit (no `setDraft` / `setLastSavedAt`)
   *   - `onCommit` callback (no success reporting)
   *
   * Útil para el adaptador A2 de snapshots generados: revalida
   * `{storyId, epoch, itemId, generatedRevision}` en el boundary del tail y
   * evita que un write cuya identidad expiró mientras esperaba en cola
   * pise state ajeno.
   */
  preStart?: () => boolean;
  /**
   * Validación de provenance opcional que corre DESPUÉS del upsert y ANTES
   * de los URL swaps al React state. Si devuelve `false`, la persistencia
   * igual ocurrió (I/O ya completado) pero el hook NO commitea el swap ni
   * dispara `onCommit`. Diseñado para hooks del tipo "el snapshot que
   * persistí ya no corresponde con la revisión/hash de origen esperada".
   */
  validateProvenanceBeforeSwap?: (
    snapshot: CuentacuentosDraftFull,
    uploadedUrls: DraftUploadedUrls
  ) => boolean;
}

/** Identidad lógica del draft capturada en un punto en el tiempo. */
interface DraftIdentity {
  epoch: number;
  storyId: string | null;
  revision: number;
}

/**
 * Identidad de un snapshot generado por el A2 pipeline. Puente entre el
 * `AppliedIdentity` del runner (`{storyId, epoch, itemId, generatedRevision}`)
 * y la cola serializada del draft. Se re-declara localmente para no crear
 * dependencia cruzada con el runner (el hook es consumido por otros callers).
 */
export interface GeneratedSnapshotIdentity {
  storyId: string | null;
  epoch: number;
  itemId: string;
  generatedRevision: number;
}

/**
 * Input del adaptador de persistencia para snapshots del pipeline A2. El
 * `patch` es un `DraftPatch` armado por el caller a partir del snapshot
 * aplicado del ítem; el adaptador es un puente delgado que no conoce la
 * forma del snapshot ni la naturaleza del ítem.
 *
 * A3/S4: `provenance` es requerida cuando el caller soporta hash guards.
 * `sourceRevision` debe coincidir con `identity.generatedRevision`;
 * `contentHash` es el hash determinista del snapshot computado en `apply`
 * y cerrado sobre la función `persist`. Cuando está ausente, los guards de
 * hash se omiten (compatibilidad hacia atrás).
 */
export interface EnqueueGeneratedSnapshotInput {
  patch: DraftPatch;
  identity: GeneratedSnapshotIdentity;
  provenance?: RequiredSnapshotProvenance;
}

/**
 * Resultado de `enqueueGeneratedSnapshot` (A3a/S3 subtask 3).
 *
 * `undefined` (void): la escritura commiteó — el snapshot es la fuente de
 * verdad React actual y el runner puede marcar el ítem como `done`.
 *
 * `{ stale: true }`: la I/O corrió (o se saltó por preStart) pero la
 * identidad viva del hook cambió antes o durante la persistencia. El
 * snapshot NO se commiteó a `draftRef`/`setDraft`. El runner lo interpreta
 * como `PERSIST_STALE` — el ítem NO se marca `done` ni `save-failed`; el
 * estado retorna a `pending` (initial) o queda `save-failed` retryable
 * (retry save-only). Distinto de un throw (que sí es save-failed).
 */
export type EnqueueGeneratedSnapshotResult = void | { stale: true };

/**
 * Identidad viva del draft — sólo los campos que el pipeline A2 necesita para
 * armar `AppliedIdentity`. Se lee desde refs (no rerender-capturados), así el
 * caller siempre ve el valor actual, no una foto vieja de un render previo.
 */
export interface DraftIdentitySnapshot {
  storyId: string | null;
  epoch: number;
}

export interface UseCuentacuentosDraftReturn {
  hasDraft: boolean;
  draft: CuentacuentosDraftFull | null;
  lastSavedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: (data: DraftPatch) => void;
  /**
   * Getter estable que devuelve la identidad {storyId, epoch} LIVE del hook,
   * leída desde refs. No captura valores del render en el que se creó: cada
   * invocación devuelve el valor actual (útil para que el pipeline arme
   * `AppliedIdentity` en el momento exacto de aplicar el resultado).
   */
  getDraftIdentity: () => DraftIdentitySnapshot;
  /**
   * A3a/S6 — Espejo reactivo de `getDraftIdentity()`. Cambia cuando storyId
   * o epoch mutan (bump, delete, recovery, replace). Diseñado para pasarse
   * como `activeIdentity` al pipeline hook, scopeando `saveFailedCount`.
   */
  activeIdentity: DraftIdentitySnapshot;
  /**
   * Encola una escritura al draft. Las escrituras se ejecutan estrictamente en
   * orden sobre una cola serializada; el promise devuelto rechaza con el error
   * de persistencia si Supabase falla (sin envenenar la cola). Si la identidad
   * lógica ({epoch, storyId, revision}) cambia mientras la escritura está en
   * vuelo, la persistencia igual ocurre pero el estado React NO se actualiza.
   */
  enqueueDraftWrite: (
    patch: DraftPatch,
    options?: EnqueueDraftWriteOptions
  ) => Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
  /**
   * A3a/S6 — Ejecuta INMEDIATAMENTE cualquier patch debounced pendiente y
   * espera a que la cola serializada de escrituras drene. Uso obligatorio
   * antes de cada aprobación/finalización: garantiza que las ediciones
   * debounceadas se persistan (no se descarten) y que `isSaving` refleje el
   * estado real antes de re-chequear el gate.
   */
  flushPendingDraftWrites: () => Promise<void>;
  loadDraft: () => Promise<CuentacuentosDraftFull | null>;
  deleteDraft: () => void;
  deleteStoryImages: () => Promise<boolean>;
  showRecoveryPrompt: boolean;
  acceptRecovery: () => CuentacuentosDraftFull | null;
  declineRecovery: () => void;
  /**
   * Bump del epoch: invalida cualquier escritura en vuelo. Uso: acciones de
   * ciclo de vida que descartan la sesión actual (delete story, regenerar).
   */
  bumpDraftEpoch: () => void;
  /**
   * Registra la identidad del story activo. Si el id cambia (incluyendo a/desde
   * `null`), resetea el contador de revisión a 0. Uso: crear un cuento nuevo,
   * cargar un cuento desde recovery, reemplazar el cuento actual.
   */
  setActiveDraftStoryId: (storyId: string | null) => void;
  /**
   * Bump del contador de revisión del story activo. Uso: cambios granulares
   * dentro del mismo story que deben invalidar escrituras en vuelo (por
   * ejemplo, un reemplazo estructural de escenas sin cambiar el story id).
   */
  bumpDraftStoryRevision: () => void;
  /**
   * Adaptador de persistencia para snapshots generados por el pipeline A2.
   *
   * Semántica:
   *  - Ruta única de persistencia: encola vía `enqueueDraftWrite`. Nunca llama
   *    a `saveDraftNow` directamente.
   *  - Guardas pre-enqueue: rechaza (no-op) si `storyId`/`epoch` no coinciden
   *    con la identidad viva del hook, o si `generatedRevision` no es
   *    estrictamente mayor a la última revisión aplicada para el mismo `itemId`.
   *  - La revisión por ítem se reserva SÍNCRONAMENTE al encolar, así una
   *    revisión menor encolada después de una mayor queda no-op sin importar
   *    en qué orden se resuelva la cola.
   *  - Independiente del `runToken` del runner: no se lee ni se consulta.
   *  - Éxito: la promesa se resuelve DESPUÉS de que la escritura de Supabase
   *    completó (I/O real), no antes. El runner marcará `done` sólo entonces.
   *  - Fallo: propaga el rechazo del `enqueueDraftWrite` para que el runner
   *    lo observe como `save-failed`.
   *  - Stale (identidad ya no coincide, o preStart guard vetó, o mismatch
   *    post-await): resuelve `{ stale: true }` — un valor discriminado que
   *    el adaptador `buildSnapshotTask` traduce a `PERSIST_STALE` para el
   *    runner. El runner NO marca `done` (no hubo commit React) ni
   *    `save-failed` (no fue error de I/O). También libera la reserva por
   *    ítem si sigue siendo nuestra (`state === 'reserved'`) para no
   *    dejarla stranded.
   */
  enqueueGeneratedSnapshot: (
    input: EnqueueGeneratedSnapshotInput
  ) => Promise<EnqueueGeneratedSnapshotResult>;
}

/**
 * Hook para manejar borradores de cuentos usando Supabase
 */
export function useCuentacuentosDraft({
  liturgyId,
}: UseCuentacuentosDraftOptions): UseCuentacuentosDraftReturn {
  const [draft, setDraft] = useState<CuentacuentosDraftFull | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // El patch pendiente conserva la identidad capturada al recibirlo. Merges
  // sucesivos sólo se combinan si la identidad actual coincide con la del
  // patch pendiente; un cambio de identidad rompe el linaje (never combine
  // patches from different lifecycles).
  const pendingDataRef = useRef<{ patch: DraftPatch; identity: DraftIdentity } | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs para evitar ciclos de dependencia - mantienen valores actuales sin causar re-renders
  const draftRef = useRef<CuentacuentosDraftFull | null>(null);
  const userIdRef = useRef<string | null>(null);
  const liturgyIdRef = useRef(liturgyId);

  // Cola serializada de escrituras: cada op corre estrictamente después de la
  // anterior. El tail se guarda como `.catch(() => {})` para que una escritura
  // fallida rechace hacia su llamador sin envenenar las siguientes.
  const writeTailRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingWritesRef = useRef(0);

  // Identidad lógica que las escrituras encoladas capturan al iniciar y
  // re-verifican tras el await. Si algo cambió, la persistencia igual ocurrió
  // (no se aborta) pero NO se aplican los cambios al estado React del hook.
  const epochRef = useRef(0);
  const activeStoryIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  // A3a/S6 — Espejo reactivo de {storyId, epoch} para que consumidores (p.ej.
  // el pipeline hook) reciban una identidad estable-por-valor y puedan scopear
  // conteos derivados. La ref sigue siendo la source of truth para escrituras
  // sensibles al tiempo; el estado es sólo para wiring reactivo.
  const [activeIdentity, setActiveIdentity] = useState<DraftIdentitySnapshot>({
    storyId: null,
    epoch: 0,
  });
  const publishActiveIdentity = useCallback(() => {
    setActiveIdentity((prev) => {
      const next: DraftIdentitySnapshot = {
        storyId: activeStoryIdRef.current,
        epoch: epochRef.current,
      };
      if (prev.storyId === next.storyId && prev.epoch === next.epoch) return prev;
      return next;
    });
  }, []);

  // Estado por ítem para `enqueueGeneratedSnapshot`: la última `revision`
  // observada y su `state` (`reserved` mientras el write está en vuelo,
  // `committed` tras I/O exitosa, `failed` tras rechazo del `enqueueDraftWrite`).
  //
  // Reglas:
  //  - Una revisión ESTRICTAMENTE MAYOR reemplaza el estado (permanentemente
  //    invalida las menores). No hay downgrade posible.
  //  - Una revisión IGUAL sólo puede volver a encolarse si el estado es
  //    `failed` — soporta save-only retry con el mismo snapshot.
  //  - Una revisión MENOR queda no-op sin importar el estado.
  //  - Repetidas rechazos mantienen el estado como `failed` (no lo escalan a
  //    `committed`). Sólo un resolve exitoso lo mueve a `committed`.
  //
  // El mapa se resetea en toda transición de lifecycle (delete, replace story,
  // aceptar recovery, bump epoch) porque los ítems del pipeline se re-crean con
  // contadores frescos en cada corrida.
  type PerItemAttemptState = 'reserved' | 'committed' | 'failed';
  interface PerItemAttempt {
    revision: number;
    state: PerItemAttemptState;
  }
  const perItemGeneratedRevisionsRef = useRef<Map<string, PerItemAttempt>>(
    new Map()
  );

  // Tracker de contentHash por ítem (A3/S4): para cada ítem almacena la última
  // revisión + contentHash observados. Se actualiza SÍNCRONAMENTE al encolar vía
  // `enqueueGeneratedSnapshot`. Se resetea junto con `perItemGeneratedRevisionsRef`
  // en toda transición de lifecycle.
  interface PerItemContentHash {
    revision: number;
    contentHash: string;
  }
  const perItemContentHashRef = useRef<Map<string, PerItemContentHash>>(
    new Map()
  );

  // Mantener refs sincronizadas con el estado
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    liturgyIdRef.current = liturgyId;
  }, [liturgyId]);

  // Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log(`[useCuentacuentosDraft] Got user: ${user?.id}`);
      setUserId(user?.id || null);
      // Actualizar ref inmediatamente también
      userIdRef.current = user?.id || null;
    };
    getUser();
  }, []);

  // Verificar si hay un borrador al montar
  useEffect(() => {
    if (!userId) return;

    const checkForDraft = async () => {
      setIsLoading(true);
      try {
        const existingDraft = await loadDraftFromSupabase(userId, liturgyId);
        if (existingDraft && existingDraft.currentStep !== 'config' && existingDraft.currentStep !== 'complete') {
          setDraft(existingDraft);
          setShowRecoveryPrompt(true);
          console.log(`[useCuentacuentosDraft] Found existing draft at step: ${existingDraft.currentStep}`);
        }
      } catch (err) {
        console.error('[useCuentacuentosDraft] Error checking for draft:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkForDraft();

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [liturgyId, userId]);

  // Cola serializada de escrituras. Cada operación corre desde el tail de la
  // cola: captura identidad, arma snapshot con own-key merge, persiste, y
  // solo entonces re-lee identidad para decidir si commitea al estado React.
  //
  // Contrato:
  //   - Rechaza (throw) hacia el llamador si Supabase falla, pero el tail se
  //     asigna a `operation.catch(() => {})` para que una op fallida no
  //     envenene a las siguientes: la próxima seguirá saliendo del tail.
  //   - Si la identidad {epoch, storyId, revision} capturada al inicio no
  //     coincide con la re-lectura tras el await, la persistencia igual ocurre
  //     (no se aborta) pero NO se aplican los cambios a draftRef/setDraft/
  //     setLastSavedAt: el estado React sigue como estaba.
  //   - `isSaving` refleja si hay al menos una op en vuelo (independiente de
  //     si esa op terminará commiteando o no).
  // Variante interna que acepta una identidad ya capturada. La usamos desde
  // saveDraft (debounced) para que la identidad viaje CON el patch pendiente,
  // en lugar de recapturarse cuando dispara el timer.
  const performDraftWrite = useCallback((
    patch: DraftPatch,
    captured: DraftIdentity,
    onCommit?: EnqueueDraftWriteOptions['onCommit'],
    preStart?: EnqueueDraftWriteOptions['preStart'],
    validateProvenanceBeforeSwap?: EnqueueDraftWriteOptions['validateProvenanceBeforeSwap']
  ): Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale> => {
    const currentUserId = userIdRef.current;
    const currentLiturgyId = liturgyIdRef.current;

    if (!currentUserId) {
      return Promise.reject(new Error('enqueueDraftWrite: no hay usuario autenticado'));
    }

    pendingWritesRef.current += 1;
    setIsSaving(true);

    // La cola encadena sobre el tail (siempre resuelto — nunca rechaza).
    // Devolvemos la promesa cruda de la operación para que el llamador
    // reciba la excepción real si falla la persistencia.
    const operation: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale> = writeTailRef.current.then(async () => {
      try {
        // Guard adicional del caller (opcional): tras el chequeo incondicional,
        // el caller puede vetar por razones extra (ej. reserva por-ítem del
        // adaptador A2, hash guard de provenance). NUNCA es la fuente de
        // verdad para identidad — sólo un veto opt-in complementario. Se
        // evalúa antes del chequeo incondicional para preservar el contrato
        // del guard del caller cuando ambos coinciden en rechazar.
        if (preStart && !preStart()) {
          console.log(
            '[useCuentacuentosDraft] preStart guard rejected: skipping upsert, uploads, swaps'
          );
          return { stale: true } as EnqueueDraftWriteStale;
        }

        // A3a/S2 — Guard de operation-start INCONDICIONAL. Corre síncronamente
        // en el boundary del tail, ANTES de cualquier efecto (saveDraftNow,
        // upsert, upload, storage, URL swap, React commit). Compara la
        // identidad {storyId, epoch, revision} capturada al ENCOLAR contra las
        // refs vivas. Un mismatch ⇒ `{stale:true}` con cero efectos. No
        // depende del caller: aplica al saveDraft debounced, al
        // enqueueDraftWrite directo sin opciones, y a cualquier ruta futura
        // que use la cola serializada. `preStart` (arriba) es un veto opt-in
        // complementario, nunca la fuente de verdad para identidad.
        const identityLiveAtStart =
          captured.epoch === epochRef.current &&
          captured.storyId === activeStoryIdRef.current &&
          captured.revision === revisionRef.current;
        if (!identityLiveAtStart) {
          console.log(
            '[useCuentacuentosDraft] Operation-start identity mismatch: skipping I/O ' +
            `(epoch ${captured.epoch}→${epochRef.current}, storyId ${captured.storyId}→${activeStoryIdRef.current}, revision ${captured.revision}→${revisionRef.current})`
          );
          return { stale: true } as EnqueueDraftWriteStale;
        }

        // saveDraftNow es el único camino de persistencia: normaliza el
        // snapshot y persiste. Nunca toca refs ni React state — esto es
        // responsabilidad de la cola tras chequear identidad.
        const { snapshot, uploadedUrls } = await saveDraftNow({
          userId: currentUserId,
          liturgyId: currentLiturgyId,
          currentDraft: draftRef.current,
          patch,
        });

        // Re-lectura de identidad DESPUÉS del I/O contra la identidad que se
        // capturó SÍNCRONAMENTE al encolar (antes del chaining sobre el tail).
        // Si algo cambió, la persistencia ya ocurrió pero NO commiteamos al
        // estado React ni disparamos onCommit.
        const identityStillMatches =
          captured.epoch === epochRef.current &&
          captured.storyId === activeStoryIdRef.current &&
          captured.revision === revisionRef.current;

        // Provenance hook: aunque la identidad lógica coincida, el caller puede
        // vetar el URL swap si la revisión/hash de origen del snapshot ya no
        // representa el estado actual (ej. otro apply más nuevo del mismo item).
        const provenanceOk =
          !validateProvenanceBeforeSwap ||
          validateProvenanceBeforeSwap(snapshot, uploadedUrls);

        if (identityStillMatches && provenanceOk) {
          const swapped = applyUploadedUrlsToDraft(snapshot, uploadedUrls);
          draftRef.current = swapped;
          setDraft(swapped);
          setLastSavedAt(snapshot.savedAt);
          // onCommit es una notificación posterior al commit exitoso; sólo
          // corre en la rama de identidad emparejada, exactamente una vez.
          if (onCommit) {
            try {
              onCommit(uploadedUrls, snapshot);
            } catch (err) {
              console.error('[useCuentacuentosDraft] onCommit callback threw:', err);
            }
          }
          return { snapshot, uploadedUrls };
        }

        // Post-start identity mismatch: the DB operation was allowed to
        // settle (I/O already happened) but the write is stale for the
        // React state. Return explicit `{stale:true}` so callers can
        // distinguish this from a committed success without inspecting
        // side-effects. No URL swap, no draftRef mutation, no setDraft,
        // no setLastSavedAt, no onCommit — zero transition-facing success.
        if (!identityStillMatches) {
          console.log(
            '[useCuentacuentosDraft] Stale write: persisted but skipped React commit ' +
            `(epoch ${captured.epoch}→${epochRef.current}, storyId ${captured.storyId}→${activeStoryIdRef.current}, revision ${captured.revision}→${revisionRef.current})`
          );
          return { stale: true } as EnqueueDraftWriteStale;
        }

        // Provenance rejection post-upsert: identidad intacta pero el hook
        // vetó el swap. La persistencia sí ocurrió y el snapshot puede
        // seguir siendo útil para el caller (por ejemplo, para inspeccionar
        // el estado persistido); devolvemos la shape normal sin commit ni
        // onCommit. Semántica distinta de identity-stale para preservar el
        // canal informativo (snapshot + uploadedUrls).
        console.log(
          '[useCuentacuentosDraft] Provenance validation rejected swap: persisted but no React commit'
        );
        return { snapshot, uploadedUrls };
      } finally {
        pendingWritesRef.current -= 1;
        if (pendingWritesRef.current <= 0) {
          pendingWritesRef.current = 0;
          setIsSaving(false);
        }
      }
    });

    // El tail nunca puede rechazar: capturamos cualquier error aquí para que
    // la próxima escritura siga saliendo desde una promesa resuelta.
    writeTailRef.current = operation.catch(() => {});
    return operation;
  }, []);

  // API pública de encolado: captura identidad SÍNCRONAMENTE antes de
  // encadenar sobre writeTailRef. Esto garantiza que dos escrituras
  // consecutivas W1→W2 bajo identidad estable capturen la MISMA identidad,
  // y que un cambio de identidad entre encolado y ejecución invalide el
  // commit incluso si la operación arranca después del cambio.
  const enqueueDraftWrite = useCallback((
    patch: DraftPatch,
    options?: EnqueueDraftWriteOptions
  ): Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale> => {
    const captured: DraftIdentity = {
      epoch: epochRef.current,
      storyId: activeStoryIdRef.current,
      revision: revisionRef.current,
    };
    return performDraftWrite(
      patch,
      captured,
      options?.onCommit,
      options?.preStart,
      options?.validateProvenanceBeforeSwap
    );
  }, [performDraftWrite]);

  // Guardar borrador con debounce. Acumula patches por own-key merge y, al
  // vencer el debounce, encola una única escritura vía enqueueDraftWrite.
  // Traga la rechazo del promise para no dejar unhandled rejections del timer.
  const saveDraft = useCallback((data: DraftPatch) => {
    const currentUserId = userIdRef.current;

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] saveDraft: No userId available, skipping save');
      return;
    }

    // Identidad capturada al recibir ESTE patch. Viaja con el patch pendiente
    // hasta que dispare el timer; si el timer dispara bajo otra identidad, la
    // escritura persiste con la identidad vieja y el commit queda descartado
    // por la cola (stale write).
    const currentIdentity: DraftIdentity = {
      epoch: epochRef.current,
      storyId: activeStoryIdRef.current,
      revision: revisionRef.current,
    };

    const prev = pendingDataRef.current;
    const identityMatches =
      prev !== null &&
      prev.identity.epoch === currentIdentity.epoch &&
      prev.identity.storyId === currentIdentity.storyId &&
      prev.identity.revision === currentIdentity.revision;

    // Merge sólo si la identidad coincide (own-key presence: claves posteriores
    // sobreescriben). Si la identidad cambió, el patch previo pertenece a otro
    // ciclo de vida y se descarta — nunca se combinan patches de identidades
    // distintas.
    pendingDataRef.current = {
      patch: identityMatches ? { ...prev!.patch, ...data } : { ...data },
      identity: currentIdentity,
    };

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      const pending = pendingDataRef.current;
      if (!pending) return;
      pendingDataRef.current = null;
      // Enqueue usando la identidad capturada CUANDO llegó el patch, no la
      // actual. Así, un cambio de identidad durante el debounce no "reetiqueta"
      // el patch: quedará stale y no commiteará.
      performDraftWrite(pending.patch, pending.identity).catch((err) => {
        console.error('[useCuentacuentosDraft] Failed to save draft (debounced):', err);
      });
    }, 2000); // Debounce de 2 segundos (más largo porque sube imágenes)
  }, [performDraftWrite]);

  // Adaptador A2/A3: puente entre `AppliedIdentity` del runner y la cola
  // serializada del draft. Guarda pre-enqueue + reserva de revisión por ítem +
  // hash de provenance (A3/S4); no toca `saveDraftNow` directamente ni
  // consulta el `runToken`.
  const enqueueGeneratedSnapshot = useCallback(
    (input: EnqueueGeneratedSnapshotInput): Promise<EnqueueGeneratedSnapshotResult> => {
      const { patch, identity, provenance } = input;

      // Guardas pre-enqueue (síncronas):
      //  1) storyId + epoch deben coincidir con la identidad viva del hook.
      //  2) La revisión decide via el estado por ítem:
      //     - MAYOR estricta ⇒ reemplaza, invalida menores permanentemente.
      //     - IGUAL ⇒ sólo si el último estado es `failed` (save-only retry) Y
      //               el contentHash coincide con el registrado (mismo snapshot).
      //     - MENOR ⇒ stale.
      //  3) (A3/S4) contentHash: si hay un hash registrado para este ítem+rev y
      //     el caller presenta un hash diferente, rechazar — otro apply más
      //     nuevo ya tomó ownership.
      // Cualquier rechazo pre-enqueue resuelve `{stale:true}` (A3a/S3
      // subtask 3): el downstream traduce a PERSIST_STALE para el runner.
      if (identity.storyId !== activeStoryIdRef.current) {
        return Promise.resolve({ stale: true });
      }
      if (identity.epoch !== epochRef.current) {
        return Promise.resolve({ stale: true });
      }

      const current = perItemGeneratedRevisionsRef.current.get(identity.itemId);
      if (current) {
        if (identity.generatedRevision < current.revision) {
          return Promise.resolve({ stale: true });
        }
        if (identity.generatedRevision === current.revision) {
          // Sólo un save-only retry legítimo puede re-encolar al mismo rev:
          // eso requiere que el intento anterior haya quedado en `failed`.
          if (current.state !== 'failed') {
            return Promise.resolve({ stale: true });
          }
          // (A3/S4) Para el retry save-only con provenance: el contentHash debe
          // coincidir con el registrado para esta revisión (mismo snapshot).
          if (provenance) {
            const existingHash = perItemContentHashRef.current.get(identity.itemId);
            if (
              existingHash &&
              existingHash.revision === identity.generatedRevision &&
              existingHash.contentHash !== provenance.contentHash
            ) {
              // Hash diferente para la misma revisión → snapshot distinto, stale.
              return Promise.resolve({ stale: true });
            }
          }
        }
      }

      // Reservar la nueva revisión ANTES de encolar. Esto ordena estrictamente
      // las escrituras por ítem incluso si el caller reenqueue una rev menor
      // fuera de orden: la reserva ya está en la mayor y la menor será no-op.
      perItemGeneratedRevisionsRef.current.set(identity.itemId, {
        revision: identity.generatedRevision,
        state: 'reserved',
      });

      // (A3/S4) Registrar el contentHash SÍNCRONAMENTE para esta revisión.
      // Si un apply posterior (rev N+1) llega antes de que procesemos el
      // upsert, el tracker ya habrá avanzado y `validateProvenanceBeforeSwap`
      // rechazará el swap. Solo si el caller provee provenance.
      if (provenance) {
        perItemContentHashRef.current.set(identity.itemId, {
          revision: identity.generatedRevision,
          contentHash: provenance.contentHash,
        });
      }

      // Nunca se consulta `runToken` — la validación es {storyId, epoch, itemId,
      // generatedRevision[, contentHash]}. La cola serializada (`enqueueDraftWrite`)
      // re-chequea storyId/epoch en el commit boundary. Post-I/O actualizamos el
      // estado por ítem: `committed` si resolvió, `failed` si rechazó. Repetidos
      // rechazos MANTIENEN `failed` (sólo un resolve real lo pasa a `committed`).
      const settle = (nextState: PerItemAttemptState) => {
        const now = perItemGeneratedRevisionsRef.current.get(identity.itemId);
        // Sólo actualizamos si la entrada sigue siendo NUESTRA reserva. Un
        // higher-rev que llegó después ya tomó ownership y no debemos pisarlo.
        if (now && now.revision === identity.generatedRevision) {
          perItemGeneratedRevisionsRef.current.set(identity.itemId, {
            revision: identity.generatedRevision,
            state: nextState,
          });
        }
      };

      // Guard de operation-start (A3): revalida identidad justo antes del upsert.
      // (A3/S4) Si provenance presente, añade hash guard.
      const preStart = (): boolean => {
        if (identity.storyId !== activeStoryIdRef.current) return false;
        if (identity.epoch !== epochRef.current) return false;
        const still = perItemGeneratedRevisionsRef.current.get(identity.itemId);
        if (!still) return false;
        if (still.revision !== identity.generatedRevision) return false;
        // Debe seguir siendo NUESTRA reserva `reserved`. Un `committed`/`failed`
        // aquí implicaría que ya settle-amos por otra vía, algo imposible antes
        // del upsert — el guard mismo asegura no re-entrar.
        if (still.state !== 'reserved') return false;
        // (A3/S4) Hash guard: si el tracker fue actualizado por un apply
        // concurrente, el hash ya no coincide.
        if (provenance) {
          const trackedHash = perItemContentHashRef.current.get(identity.itemId);
          if (
            trackedHash &&
            trackedHash.revision === identity.generatedRevision &&
            trackedHash.contentHash !== provenance.contentHash
          ) {
            return false;
          }
        }
        return true;
      };

      // (A3/S4) validateProvenanceBeforeSwap: corre DESPUÉS del upsert y ANTES
      // de los URL swaps. Rechaza si identidad completa o contentHash ya no
      // coincide con el tracker. Sólo cuando el caller provee provenance.
      const validateProvenanceBeforeSwap = provenance
        ? (): boolean => {
            if (identity.storyId !== activeStoryIdRef.current) return false;
            if (identity.epoch !== epochRef.current) return false;
            const trackedHash = perItemContentHashRef.current.get(identity.itemId);
            if (!trackedHash) return false;
            if (trackedHash.revision !== identity.generatedRevision) return false;
            if (trackedHash.contentHash !== provenance.contentHash) return false;
            return true;
          }
        : undefined;

      // Libera la reserva por ítem si sigue siendo NUESTRA (`reserved`) —
      // sólo entonces esta ruta puede haberla creado y dejarla stranded.
      // Un `committed`/`failed` implicaría que ya settle-amos por otro
      // camino; un rev distinto significa que otra reserva tomó ownership
      // y no debemos tocarla. (A3a/S3 subtask 3: evita el strand de
      // reservación en el path stale del downstream.)
      const releaseReservationIfOurs = () => {
        const now = perItemGeneratedRevisionsRef.current.get(identity.itemId);
        if (
          now &&
          now.revision === identity.generatedRevision &&
          now.state === 'reserved'
        ) {
          perItemGeneratedRevisionsRef.current.delete(identity.itemId);
        }
      };
      return enqueueDraftWrite(patch, { preStart, validateProvenanceBeforeSwap }).then(
        (result): EnqueueGeneratedSnapshotResult => {
          if ((result as EnqueueDraftWriteStale).stale) {
            // A3a/S3 subtask 3: el downstream reportó stale (preStart guard,
            // operation-start guard incondicional, o post-await identity
            // mismatch). Devolvemos `{stale:true}` explícito — el runner lo
            // ve como PERSIST_STALE via el adaptador y NO marca `done`. La
            // reserva se libera para no strand.
            releaseReservationIfOurs();
            return { stale: true };
          }
          settle('committed');
          return undefined;
        },
        (err: unknown) => {
          settle('failed');
          throw err;
        }
      );
    },
    [enqueueDraftWrite]
  );

  // ---------------------------------------------------------------------------
  // Identidad lógica del draft — mutadores expuestos al editor
  // ---------------------------------------------------------------------------

  // Drop cualquier patch armado en `saveDraft` que aún no disparó y cancela el
  // timer del debounce. Debe llamarse SÍNCRONAMENTE en toda transición de
  // identidad (epoch/story/revision) y en lifecycle destructivos (delete,
  // recovery). Sin esto, un patch armado bajo la identidad vieja sobreviviría
  // al reemplazo y se encolaría después, mezclando estado entre ciclos de vida.
  const resetDebounce = useCallback(() => {
    pendingDataRef.current = null;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, []);

  // A3a/S6 — Flush del debounce + drain de la cola serializada. A diferencia
  // de `resetDebounce`, NO descarta el patch pendiente: lo encola inmediatamente
  // (con la identidad capturada cuando llegó) y espera al tail. Esto es lo que
  // usa la aprobación/finalización para no perder ediciones que aún no dispararon
  // el timer de 2s antes de armar el snapshot autoritativo.
  const flushPendingDraftWrites = useCallback(async (): Promise<void> => {
    const pending = pendingDataRef.current;
    if (pending) {
      pendingDataRef.current = null;
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      // Encolar la escritura debounceada YA — sin esperar al timer de 2s.
      // Usamos la identidad capturada al recibir el patch (misma semántica que
      // el path del timer): si la identidad cambió mientras el patch estaba en
      // el debounce, la escritura se ejecutará stale y no commiteará.
      performDraftWrite(pending.patch, pending.identity).catch((err) => {
        console.error('[useCuentacuentosDraft] flushPendingDraftWrites failed', err);
      });
    }
    // Drain: esperar a que TODAS las escrituras en la cola (incluida la que
    // acabamos de encolar) hayan resuelto sus `finally` (y por tanto hayan
    // actualizado `isSaving`). El tail nunca rechaza — `performDraftWrite`
    // captura errores para no envenenar la cola.
    await writeTailRef.current;
  }, [performDraftWrite]);

  // Limpia las reservas de generatedRevision por ítem y el tracker de
  // contentHash. Debe llamarse en toda transición de lifecycle (delete,
  // replace story, aceptar recovery) porque los ítems del pipeline se
  // re-crean con contadores frescos en cada corrida.
  const resetGeneratedRevisions = useCallback(() => {
    perItemGeneratedRevisionsRef.current = new Map();
    perItemContentHashRef.current = new Map();
  }, []);

  // Getter estable de identidad viva. Se implementa como referencia estable
  // (creada una vez) que SIEMPRE lee de refs — nunca captura valores del
  // render en el que se creó. Esto es lo que el pipeline necesita para armar
  // `AppliedIdentity` en el momento exacto de aplicar el resultado del
  // provider, no cuando se armó la task.
  const getDraftIdentityRef = useRef<() => DraftIdentitySnapshot>(() => ({
    storyId: activeStoryIdRef.current,
    epoch: epochRef.current,
  }));
  const getDraftIdentity = getDraftIdentityRef.current;

  const bumpDraftEpoch = useCallback(() => {
    epochRef.current += 1;
    resetDebounce();
    resetGeneratedRevisions();
    publishActiveIdentity();
  }, [resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  const setActiveDraftStoryId = useCallback((storyId: string | null) => {
    if (activeStoryIdRef.current !== storyId) {
      activeStoryIdRef.current = storyId;
      revisionRef.current = 0;
      resetDebounce();
      resetGeneratedRevisions();
      publishActiveIdentity();
    }
  }, [resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  const bumpDraftStoryRevision = useCallback(() => {
    revisionRef.current += 1;
    resetDebounce();
    resetGeneratedRevisions();
    // La identidad expuesta al pipeline sólo incluye (storyId, epoch), pero
    // publicamos para forzar re-cómputo del scope-count si otros consumidores
    // dependieran del cambio de revisión.
    publishActiveIdentity();
  }, [resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  // Cargar borrador manualmente. Carga = lifecycle: cualquier escritura en
  // vuelo debe descartar su commit, y el story activo pasa a ser el cargado.
  const loadDraftAsync = useCallback(async () => {
    if (!userId) return null;
    const loaded = await loadDraftFromSupabase(userId, liturgyId);
    epochRef.current += 1;
    resetDebounce();
    resetGeneratedRevisions();
    setActiveDraftStoryId(loaded?.story?.id ?? null);
    publishActiveIdentity();
    setDraft(loaded);
    return loaded;
  }, [liturgyId, userId, setActiveDraftStoryId, resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  // Eliminar borrador. Lifecycle destructivo: cualquier escritura en vuelo
  // debe descartar su commit para no resucitar estado que el usuario borró.
  const deleteDraft = useCallback(() => {
    if (!userId) return;
    deleteDraftFromSupabase(userId, liturgyId);
    epochRef.current += 1;
    activeStoryIdRef.current = null;
    revisionRef.current = 0;
    resetDebounce();
    resetGeneratedRevisions();
    publishActiveIdentity();
    setDraft(null);
    setLastSavedAt(null);
    setShowRecoveryPrompt(false);
  }, [liturgyId, userId, resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  // Eliminar todas las imágenes del cuento (Storage + DB draft)
  // Esto se usa cuando el usuario quiere eliminar completamente una historia
  const deleteStoryImages = useCallback(async (): Promise<boolean> => {
    const currentUserId = userIdRef.current;
    const currentLiturgyId = liturgyIdRef.current;

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] deleteStoryImages: No userId available');
      return false;
    }

    try {
      console.log(`[useCuentacuentosDraft] Deleting all story images for liturgy: ${currentLiturgyId}`);

      // 1. Eliminar todas las imágenes del Storage
      const { data: folders } = await supabase.storage
        .from(BUCKET_NAME)
        .list(`${currentUserId}/${currentLiturgyId}`);

      if (folders && folders.length > 0) {
        const allPaths: string[] = [];

        for (const folder of folders) {
          const { data: files } = await supabase.storage
            .from(BUCKET_NAME)
            .list(`${currentUserId}/${currentLiturgyId}/${folder.name}`);

          if (files) {
            for (const file of files) {
              allPaths.push(`${currentUserId}/${currentLiturgyId}/${folder.name}/${file.name}`);
            }
          }
        }

        if (allPaths.length > 0) {
          console.log(`[useCuentacuentosDraft] Deleting ${allPaths.length} files from Storage`);
          const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(allPaths);

          if (deleteError) {
            console.error('[useCuentacuentosDraft] Error deleting files:', deleteError);
          } else {
            // Invalidar el cache de existencia: estos paths ya no existen
            allPaths.forEach((p) => verifiedPaths.delete(p));
          }
        }
      }

      // 2. Eliminar el registro del draft de la base de datos
      const { error: dbError } = await supabase
        .from('cuentacuentos_drafts')
        .delete()
        .eq('liturgia_id', currentLiturgyId)
        .eq('user_id', currentUserId);

      if (dbError) {
        console.error('[useCuentacuentosDraft] Error deleting draft record:', dbError);
        return false;
      }

      // 3. Invalidar identidad + limpiar estado local. Toda escritura en
      // vuelo (por ejemplo del pipeline de generación) debe caer del lado
      // de "persistió pero no commiteó" para no resucitar el cuento borrado.
      epochRef.current += 1;
      activeStoryIdRef.current = null;
      revisionRef.current = 0;
      resetDebounce();
      resetGeneratedRevisions();
      publishActiveIdentity();
      setDraft(null);
      setLastSavedAt(null);
      setShowRecoveryPrompt(false);

      console.log(`[useCuentacuentosDraft] Successfully deleted all story images for liturgy: ${currentLiturgyId}`);
      return true;
    } catch (err) {
      console.error('[useCuentacuentosDraft] Error deleting story images:', err);
      return false;
    }
  }, [resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  // Aceptar recuperación. El story cargado pasa a ser el activo — cualquier
  // escritura en vuelo desde antes de aceptar quedará stale.
  const acceptRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    epochRef.current += 1;
    resetDebounce();
    resetGeneratedRevisions();
    setActiveDraftStoryId(draft?.story?.id ?? null);
    publishActiveIdentity();
    return draft;
  }, [draft, setActiveDraftStoryId, resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  // Rechazar recuperación. Igual que delete: invalidar identidad.
  const declineRecovery = useCallback(() => {
    if (userId) {
      deleteDraftFromSupabase(userId, liturgyId);
    }
    epochRef.current += 1;
    activeStoryIdRef.current = null;
    revisionRef.current = 0;
    resetDebounce();
    resetGeneratedRevisions();
    publishActiveIdentity();
    setDraft(null);
    setShowRecoveryPrompt(false);
  }, [liturgyId, userId, resetDebounce, resetGeneratedRevisions, publishActiveIdentity]);

  return {
    hasDraft: draft !== null && draft.currentStep !== 'config',
    draft,
    lastSavedAt,
    isLoading,
    isSaving,
    saveDraft,
    getDraftIdentity,
    activeIdentity,
    enqueueDraftWrite,
    flushPendingDraftWrites,
    loadDraft: loadDraftAsync,
    deleteDraft,
    deleteStoryImages,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
    bumpDraftEpoch,
    setActiveDraftStoryId,
    bumpDraftStoryRevision,
    enqueueGeneratedSnapshot,
  };
}
