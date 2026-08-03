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

export interface DraftSaveResult {
  success: boolean;
  uploadedUrls: DraftUploadedUrls | null;
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
  draft: CuentacuentosDraftFull
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

  for (const [charId, options] of Object.entries(draft.characterSheetOptions || {})) {
    queueGroup(
      options,
      (i, data) => uploadImage(userId, liturgyId, 'characters', charId, i, data),
      (paths) => { characterSheetPaths[charId] = paths; }
    );
  }

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

  queueGroup(
    draft.coverOptions || [],
    (i, data) => uploadImage(userId, liturgyId, 'cover', 'cover', i, data),
    (paths) => { coverPaths.push(...paths); }
  );

  queueGroup(
    draft.endOptions || [],
    (i, data) => uploadImage(userId, liturgyId, 'end', 'end', i, data),
    (paths) => { endPaths.push(...paths); }
  );

  // Subir imágenes de referencia de props
  // Fuente primaria: draft.story.props[].referenceImages — es el estado VIVO que
  // el editor actualiza al elegir hojas generadas o subir fotos nuevas.
  // Fuente secundaria: draft.propReferenceImages (poblado al cargar el draft);
  // si tuviera precedencia, taparía los cambios post-recarga y la referencia
  // de un prop quedaría congelada para siempre en su primer valor persistido.
  const propSources: Record<string, string[]> = {};
  if (draft.story?.props) {
    for (const prop of draft.story.props) {
      if (prop?.id && Array.isArray(prop.referenceImages) && prop.referenceImages.length > 0) {
        propSources[prop.id] = prop.referenceImages;
      }
    }
  }
  for (const [propId, images] of Object.entries(draft.propReferenceImages || {})) {
    if (!propSources[propId] && Array.isArray(images) && images.length > 0) {
      propSources[propId] = images;
    }
  }

  for (const [propId, images] of Object.entries(propSources)) {
    queueGroup(
      images,
      (i, data) => uploadImage(userId, liturgyId, 'props', propId, i, data),
      (paths) => { propImagePaths[propId] = paths; }
    );
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

/**
 * Guarda un borrador en Supabase
 */
async function saveDraftToSupabase(
  userId: string,
  liturgyId: string,
  draft: CuentacuentosDraftFull
): Promise<DraftSaveResult> {
  try {
    console.log(`[useCuentacuentosDraft] Saving draft to Supabase, step: ${draft.currentStep}`);
    console.log(`[useCuentacuentosDraft] Draft has ${Object.keys(draft.sceneImageOptions || {}).length} scene image sets`);
    console.log(`[useCuentacuentosDraft] Draft has ${Object.keys(draft.characterSheetOptions || {}).length} character sheet sets`);

    // Primero obtener los paths existentes para no sobrescribirlos
    const { data: existingDraft } = await supabase
      .from('cuentacuentos_drafts')
      .select('image_paths')
      .eq('liturgia_id', liturgyId)
      .eq('user_id', userId)
      .maybeSingle();

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

    // Subir SOLO las imágenes nuevas (las que están en memoria)
    const newImagePaths = await saveImagesToStorage(userId, liturgyId, draft);

    // CRITICAL FIX: Safer merge logic that NEVER loses existing valid paths
    // Only overwrite if we have valid new paths (non-null, non-empty strings)
    const mergedPaths: {
      characterSheetPaths: Record<string, string[]>;
      sceneImagePaths: Record<string | number, string[]>;
      coverPaths: string[];
      endPaths: string[];
      propImagePaths: Record<string, string[]>;
      sceneReferenceModes: Record<number, 'style' | 'pov'>;
    } = {
      characterSheetPaths: { ...existingPaths.characterSheetPaths },
      sceneImagePaths: { ...existingPaths.sceneImagePaths },
      coverPaths: existingPaths.coverPaths || [],
      endPaths: existingPaths.endPaths || [],
      propImagePaths: { ...(existingPaths.propImagePaths || {}) } as Record<string, string[]>,
      // Los modos (style/pov) se persisten aquí; el draft en memoria es la fuente de verdad
      sceneReferenceModes: { ...(draft.sceneReferenceModes || {}) },
    };

    // Merge character paths - only overwrite if we have valid new paths
    for (const [key, paths] of Object.entries(newImagePaths.characterSheetPaths)) {
      const validPaths = (paths || []).filter(p => p != null && p !== '');
      if (validPaths.length > 0) {
        mergedPaths.characterSheetPaths[key] = validPaths;
        console.log(`[useCuentacuentosDraft] Updating character ${key} with ${validPaths.length} valid paths`);
      }
      // If no valid paths, KEEP existing (don't overwrite with empty)
    }

    // Merge scene paths - only overwrite if we have valid new paths
    for (const [key, paths] of Object.entries(newImagePaths.sceneImagePaths)) {
      const validPaths = (paths || []).filter(p => p != null && p !== '');
      if (validPaths.length > 0) {
        (mergedPaths.sceneImagePaths as Record<string, string[]>)[key] = validPaths;
        console.log(`[useCuentacuentosDraft] Updating scene ${key} with ${validPaths.length} valid paths`);
      }
      // If no valid paths, KEEP existing (don't overwrite with empty)
    }

    // Cover and end paths - only replace if we have valid new ones
    const validCoverPaths = (newImagePaths.coverPaths || []).filter(p => p != null && p !== '');
    if (validCoverPaths.length > 0) {
      mergedPaths.coverPaths = validCoverPaths;
      console.log(`[useCuentacuentosDraft] Updating cover with ${validCoverPaths.length} valid paths`);
    }

    const validEndPaths = (newImagePaths.endPaths || []).filter(p => p != null && p !== '');
    if (validEndPaths.length > 0) {
      mergedPaths.endPaths = validEndPaths;
      console.log(`[useCuentacuentosDraft] Updating end with ${validEndPaths.length} valid paths`);
    }

    // Merge prop image paths - only overwrite if we have valid new paths
    for (const [key, paths] of Object.entries(newImagePaths.propImagePaths || {})) {
      const validPaths = (paths || []).filter(p => p != null && p !== '');
      if (validPaths.length > 0) {
        mergedPaths.propImagePaths[key] = validPaths;
        console.log(`[useCuentacuentosDraft] Updating prop ${key} with ${validPaths.length} valid paths`);
      }
      // If no valid paths, KEEP existing (don't overwrite with empty)
    }

    // Purge stale propImagePaths: any key not present in the current draft.story.props
    // is an orphan (prop was removed). Strip the key and best-effort delete its files.
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
          // Only plain storage paths are removable; skip full URLs and __FULLURL__ markers.
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
          // Invalidar el cache de existencia: estos paths ya no existen
          orphanedPropStoragePaths.forEach((p) => verifiedPaths.delete(p));
          console.log(
            `[useCuentacuentosDraft] Deleted ${orphanedPropStoragePaths.length} orphaned prop file(s) from storage`
          );
        }
      } catch (err) {
        console.warn('[useCuentacuentosDraft] Best-effort orphan prop storage delete threw:', err);
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
      return { success: false, uploadedUrls: null };
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

    return { success: true, uploadedUrls };
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error saving draft:', err);
    return { success: false, uploadedUrls: null };
  }
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

export interface UseCuentacuentosDraftReturn {
  hasDraft: boolean;
  draft: CuentacuentosDraftFull | null;
  lastSavedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  saveDraft: (data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>) => void;
  saveDraftNow: (data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>) => Promise<DraftSaveResult>;
  loadDraft: () => Promise<CuentacuentosDraftFull | null>;
  deleteDraft: () => void;
  deleteStoryImages: () => Promise<boolean>;
  showRecoveryPrompt: boolean;
  acceptRecovery: () => CuentacuentosDraftFull | null;
  declineRecovery: () => void;
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
  const pendingDataRef = useRef<Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>> | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Refs para evitar ciclos de dependencia - mantienen valores actuales sin causar re-renders
  const draftRef = useRef<CuentacuentosDraftFull | null>(null);
  const userIdRef = useRef<string | null>(null);
  const liturgyIdRef = useRef(liturgyId);

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

  // Guardar borrador con debounce - usa refs para evitar ciclos de dependencia
  // IMPORTANTE: Esta función tiene identidad estable (no cambia entre renders)
  const saveDraft = useCallback((data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>) => {
    // Usar refs para acceder a valores actuales sin crear dependencias
    const currentUserId = userIdRef.current;
    const currentLiturgyId = liturgyIdRef.current;

    console.log(`[useCuentacuentosDraft] saveDraft called, userId: ${currentUserId}, liturgyId: ${currentLiturgyId}, step: ${data.currentStep}`);

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] saveDraft: No userId available, skipping save');
      return;
    }

    // Acumular datos pendientes
    pendingDataRef.current = { ...pendingDataRef.current, ...data };

    // Cancelar timeout anterior
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Guardar después de un breve delay (debounce)
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (pendingDataRef.current && !isSavingRef.current) {
        isSavingRef.current = true;
        setIsSaving(true);

        // Usar draftRef.current para obtener el draft actual sin crear dependencia
        const currentDraft = draftRef.current;

        const fullDraft: CuentacuentosDraftFull = {
          liturgyId: currentLiturgyId,
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
          ...currentDraft,
          ...pendingDataRef.current,
          savedAt: new Date().toISOString(),
          version: 1,
        };

        try {
          console.log(`[useCuentacuentosDraft] Starting saveDraftToSupabase...`);
          const { success, uploadedUrls } = await saveDraftToSupabase(currentUserId, currentLiturgyId, fullDraft);
          console.log(`[useCuentacuentosDraft] saveDraftToSupabase returned: ${success}`);
          if (success) {
            setDraft(applyUploadedUrlsToDraft(fullDraft, uploadedUrls));
            setLastSavedAt(fullDraft.savedAt);
          }
        } catch (err) {
          console.error('[useCuentacuentosDraft] Failed to save draft:', err);
        } finally {
          isSavingRef.current = false;
          setIsSaving(false);
          pendingDataRef.current = null;
        }
      }
    }, 2000); // Debounce de 2 segundos (más largo porque sube imágenes)
  }, []); // Sin dependencias - usa refs para valores actuales

  // Guardar borrador INMEDIATAMENTE sin debounce - usar cuando sea crítico guardar (ej: después de generar imágenes)
  const saveDraftNow = useCallback(async (data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>): Promise<DraftSaveResult> => {
    const currentUserId = userIdRef.current;
    const currentLiturgyId = liturgyIdRef.current;
    const currentDraft = draftRef.current;

    console.log(`[useCuentacuentosDraft] saveDraftNow called, userId: ${currentUserId}, liturgyId: ${currentLiturgyId}`);

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] saveDraftNow: No userId available, skipping save');
      return { success: false, uploadedUrls: null };
    }

    // Cancelar cualquier debounce pendiente
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    if (isSavingRef.current) {
      console.log('[useCuentacuentosDraft] saveDraftNow: Already saving, waiting...');
      // Esperar a que termine el guardado actual
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    isSavingRef.current = true;
    setIsSaving(true);

    const fullDraft: CuentacuentosDraftFull = {
      liturgyId: currentLiturgyId,
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
      ...currentDraft,
      ...data,
      savedAt: new Date().toISOString(),
      version: 1,
    };

    try {
      console.log(`[useCuentacuentosDraft] saveDraftNow: Starting immediate save...`);
      const result = await saveDraftToSupabase(currentUserId, currentLiturgyId, fullDraft);
      console.log(`[useCuentacuentosDraft] saveDraftNow: Save completed, success: ${result.success}`);

      if (result.success) {
        setDraft(applyUploadedUrlsToDraft(fullDraft, result.uploadedUrls));
        setLastSavedAt(fullDraft.savedAt);
      }
      return result;
    } catch (err) {
      console.error('[useCuentacuentosDraft] saveDraftNow: Failed to save draft:', err);
      return { success: false, uploadedUrls: null };
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      pendingDataRef.current = null;
    }
  }, []);

  // Cargar borrador manualmente
  const loadDraftAsync = useCallback(async () => {
    if (!userId) return null;
    const loaded = await loadDraftFromSupabase(userId, liturgyId);
    setDraft(loaded);
    return loaded;
  }, [liturgyId, userId]);

  // Eliminar borrador
  const deleteDraft = useCallback(() => {
    if (!userId) return;
    deleteDraftFromSupabase(userId, liturgyId);
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

      // 3. Limpiar estado local
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

  // Aceptar recuperación
  const acceptRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    return draft;
  }, [draft]);

  // Rechazar recuperación
  const declineRecovery = useCallback(() => {
    if (userId) {
      deleteDraftFromSupabase(userId, liturgyId);
    }
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
    saveDraftNow,
    loadDraft: loadDraftAsync,
    deleteDraft,
    deleteStoryImages,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
  };
}
