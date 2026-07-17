/**
 * Hook para auto-guardar y recuperar borradores de cuentos en progreso
 * Usa Supabase para persistir el estado (tabla + storage para imágenes)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Story } from '@/types/shared/story';
import { runWithConcurrency } from '@/lib/cuentacuentos/concurrency';

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
}

const BUCKET_NAME = 'cuentacuentos-drafts';

// URLs públicas correspondientes a las imágenes subidas/verificadas en un guardado,
// alineadas por key para que el editor pueda reemplazar base64 en memoria por URLs.
export interface DraftUploadedUrls {
  characterSheetUrls: Record<string, string[]>;
  sceneImageUrls: Record<number, string[]>;
  coverUrls: string[];
  endUrls: string[];
  /** URLs públicas de las referencias de props subidas (por propId). */
  propImageUrls: Record<string, string[]>;
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
}> {
  const characterSheetPaths: Record<string, string[]> = {};
  const sceneImagePaths: Record<number, string[]> = {};
  const coverPaths: string[] = [];
  const endPaths: string[] = [];
  const propImagePaths: Record<string, string[]> = {};

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

  await runWithConcurrency(jobs, 6);
  finalize.forEach((fn) => fn());

  return { characterSheetPaths, sceneImagePaths, coverPaths, endPaths, propImagePaths };
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
  }
): Promise<{
  characterSheetOptions: Record<string, string[]>;
  sceneImageOptions: Record<number, string[]>;
  coverOptions: string[];
  endOptions: string[];
  propReferenceImages: Record<string, string[]>;
}> {
  const characterSheetOptions: Record<string, string[]> = {};
  const sceneImageOptions: Record<number, string[]> = {};
  const coverOptions: string[] = [];
  const endOptions: string[] = [];
  const propReferenceImages: Record<string, string[]> = {};

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

  console.log(`[useCuentacuentosDraft] Generated public URLs for ${Object.keys(sceneImageOptions).length} scene sets`);

  return { characterSheetOptions, sceneImageOptions, coverOptions, endOptions, propReferenceImages };
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
    }) || {
      characterSheetPaths: {},
      sceneImagePaths: {},
      coverPaths: [],
      endPaths: [],
      propImagePaths: {},
      sceneReferenceModes: {},
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

    // Preparar story sin imágenes base64 (limpiar characterSheetUrl y selectedImageUrl)
    const cleanStory = draft.story ? {
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
      // restauran desde ahí al cargar: no inflar el JSON del story con base64.
      props: draft.story.props?.map(p => ({
        ...p,
        referenceImages: (p.referenceImages || []).filter(
          img => typeof img === 'string' && img.startsWith('http')
        ),
        selectedReferenceUrl: p.selectedReferenceUrl?.startsWith('http')
          ? p.selectedReferenceUrl
          : undefined,
      })),
      coverImageUrl: undefined,
      coverImageOptions: undefined,
      endImageUrl: undefined,
      endImageOptions: undefined,
    } : null;

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
  const snapshot = normalizeSnapshot(input.currentDraft, input.patch, input.liturgyId);
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
    } | undefined;

    let imageOptions = {
      characterSheetOptions: {} as Record<string, string[]>,
      sceneImageOptions: {} as Record<number, string[]>,
      coverOptions: [] as string[],
      endOptions: [] as string[],
      propReferenceImages: {} as Record<string, string[]>,
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

    const story = data.story as Story | null;
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

    const draft: CuentacuentosDraftFull = {
      liturgyId,
      currentStep: data.current_step as CuentacuentosDraft['currentStep'],
      config: data.config as CuentacuentosDraft['config'],
      story,
      selectedCharacterSheets: sanitizeSelections(
        (data.selected_character_sheets as Record<string, number>) || {},
        imageOptions.characterSheetOptions
      ),
      selectedSceneImages: sanitizeSelections(
        (data.selected_scene_images as Record<number, number>) || {},
        imageOptions.sceneImageOptions
      ),
      selectedCover: data.selected_cover as number | null,
      selectedEnd: data.selected_end as number | null,
      sceneReferenceModes,
      savedAt: data.updated_at as string,
      version: 1,
      ...imageOptions,
    };

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
}

export interface UseCuentacuentosDraftReturn {
  hasDraft: boolean;
  draft: CuentacuentosDraftFull | null;
  lastSavedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: (data: DraftPatch) => void;
  /**
   * Encola una escritura al draft. Las escrituras se ejecutan estrictamente en
   * orden sobre una cola serializada; el promise devuelto rechaza con el error
   * de persistencia si Supabase falla (sin envenenar la cola). Si la identidad
   * lógica ({epoch, storyId, revision}) cambia mientras la escritura está en
   * vuelo, la persistencia igual ocurre pero el estado React NO se actualiza.
   */
  enqueueDraftWrite: (patch: DraftPatch) => Promise<EnqueueDraftWriteResult>;
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
  const pendingDataRef = useRef<DraftPatch | null>(null);
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
  const enqueueDraftWrite = useCallback((patch: DraftPatch): Promise<EnqueueDraftWriteResult> => {
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
    const operation: Promise<EnqueueDraftWriteResult> = writeTailRef.current.then(async () => {
      // Captura de identidad ANTES del I/O.
      const capturedEpoch = epochRef.current;
      const capturedStoryId = activeStoryIdRef.current;
      const capturedRevision = revisionRef.current;

      try {
        // saveDraftNow es el único camino de persistencia: normaliza el
        // snapshot y persiste. Nunca toca refs ni React state — esto es
        // responsabilidad de la cola tras chequear identidad.
        const { snapshot, uploadedUrls } = await saveDraftNow({
          userId: currentUserId,
          liturgyId: currentLiturgyId,
          currentDraft: draftRef.current,
          patch,
        });

        // Re-lectura de identidad DESPUÉS del I/O. Si algo cambió, la
        // persistencia ya ocurrió pero NO commiteamos al estado React.
        const identityStillMatches =
          capturedEpoch === epochRef.current &&
          capturedStoryId === activeStoryIdRef.current &&
          capturedRevision === revisionRef.current;

        if (identityStillMatches) {
          const swapped = applyUploadedUrlsToDraft(snapshot, uploadedUrls);
          draftRef.current = swapped;
          setDraft(swapped);
          setLastSavedAt(snapshot.savedAt);
        } else {
          console.log(
            '[useCuentacuentosDraft] Stale write: persisted but skipped React commit ' +
            `(epoch ${capturedEpoch}→${epochRef.current}, storyId ${capturedStoryId}→${activeStoryIdRef.current}, revision ${capturedRevision}→${revisionRef.current})`
          );
        }

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

  // Guardar borrador con debounce. Acumula patches por own-key merge y, al
  // vencer el debounce, encola una única escritura vía enqueueDraftWrite.
  // Traga la rechazo del promise para no dejar unhandled rejections del timer.
  const saveDraft = useCallback((data: DraftPatch) => {
    const currentUserId = userIdRef.current;

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] saveDraft: No userId available, skipping save');
      return;
    }

    // Acumular patches pendientes por own-key presence: si una clave aparece en
    // un patch posterior, sobreescribe. Claves no re-escritas se preservan.
    pendingDataRef.current = { ...(pendingDataRef.current || {}), ...data };

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      if (!pendingDataRef.current) return;
      const patch = pendingDataRef.current;
      pendingDataRef.current = null;
      // Ruteo por la cola: la rechazo se traga aquí para no dejar unhandled
      // rejections del setTimeout; enqueueDraftWrite ya logueó lo necesario.
      enqueueDraftWrite(patch).catch((err) => {
        console.error('[useCuentacuentosDraft] Failed to save draft (debounced):', err);
      });
    }, 2000); // Debounce de 2 segundos (más largo porque sube imágenes)
  }, [enqueueDraftWrite]);

  // ---------------------------------------------------------------------------
  // Identidad lógica del draft — mutadores expuestos al editor
  // ---------------------------------------------------------------------------
  const bumpDraftEpoch = useCallback(() => {
    epochRef.current += 1;
  }, []);

  const setActiveDraftStoryId = useCallback((storyId: string | null) => {
    if (activeStoryIdRef.current !== storyId) {
      activeStoryIdRef.current = storyId;
      revisionRef.current = 0;
    }
  }, []);

  const bumpDraftStoryRevision = useCallback(() => {
    revisionRef.current += 1;
  }, []);

  // Cargar borrador manualmente. Carga = lifecycle: cualquier escritura en
  // vuelo debe descartar su commit, y el story activo pasa a ser el cargado.
  const loadDraftAsync = useCallback(async () => {
    if (!userId) return null;
    const loaded = await loadDraftFromSupabase(userId, liturgyId);
    epochRef.current += 1;
    setActiveDraftStoryId(loaded?.story?.id ?? null);
    setDraft(loaded);
    return loaded;
  }, [liturgyId, userId, setActiveDraftStoryId]);

  // Eliminar borrador. Lifecycle destructivo: cualquier escritura en vuelo
  // debe descartar su commit para no resucitar estado que el usuario borró.
  const deleteDraft = useCallback(() => {
    if (!userId) return;
    deleteDraftFromSupabase(userId, liturgyId);
    epochRef.current += 1;
    activeStoryIdRef.current = null;
    revisionRef.current = 0;
    setDraft(null);
    setLastSavedAt(null);
    setShowRecoveryPrompt(false);
  }, [liturgyId, userId]);

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
      setDraft(null);
      setLastSavedAt(null);
      setShowRecoveryPrompt(false);

      console.log(`[useCuentacuentosDraft] Successfully deleted all story images for liturgy: ${currentLiturgyId}`);
      return true;
    } catch (err) {
      console.error('[useCuentacuentosDraft] Error deleting story images:', err);
      return false;
    }
  }, []);

  // Aceptar recuperación. El story cargado pasa a ser el activo — cualquier
  // escritura en vuelo desde antes de aceptar quedará stale.
  const acceptRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    epochRef.current += 1;
    setActiveDraftStoryId(draft?.story?.id ?? null);
    return draft;
  }, [draft, setActiveDraftStoryId]);

  // Rechazar recuperación. Igual que delete: invalidar identidad.
  const declineRecovery = useCallback(() => {
    if (userId) {
      deleteDraftFromSupabase(userId, liturgyId);
    }
    epochRef.current += 1;
    activeStoryIdRef.current = null;
    revisionRef.current = 0;
    setDraft(null);
    setShowRecoveryPrompt(false);
  }, [liturgyId, userId]);

  return {
    hasDraft: draft !== null && draft.currentStep !== 'config',
    draft,
    lastSavedAt,
    isLoading,
    isSaving,
    saveDraft,
    enqueueDraftWrite,
    loadDraft: loadDraftAsync,
    deleteDraft,
    deleteStoryImages,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
    bumpDraftEpoch,
    setActiveDraftStoryId,
    bumpDraftStoryRevision,
  };
}
