/**
 * Hook para auto-guardar y recuperar borradores de cuentos en progreso
 * Usa Supabase para persistir el estado (tabla + storage para imágenes)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Story } from '@/types/shared/story';

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
  savedAt: string;
  version: number;
}

// Estructura completa con opciones de imágenes
export interface CuentacuentosDraftFull extends CuentacuentosDraft {
  characterSheetOptions: Record<string, string[]>;
  sceneImageOptions: Record<number, string[]>;
  coverOptions: string[];
  endOptions: string[];
}

const BUCKET_NAME = 'cuentacuentos-drafts';

/**
 * Verifica si un archivo existe en Storage
 */
async function checkFileExists(path: string): Promise<boolean> {
  try {
    // Intentar obtener metadata del archivo
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error || !data) {
      return false;
    }
    return true;
  } catch {
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
}> {
  const characterSheetPaths: Record<string, string[]> = {};
  const sceneImagePaths: Record<number, string[]> = {};
  const coverPaths: string[] = [];
  const endPaths: string[] = [];

  // Subir character sheets
  for (const [charId, options] of Object.entries(draft.characterSheetOptions || {})) {
    characterSheetPaths[charId] = [];
    for (let i = 0; i < options.length; i++) {
      const path = await uploadImage(userId, liturgyId, 'characters', charId, i, options[i]);
      if (path) characterSheetPaths[charId].push(path);
    }
  }

  // Subir scene images
  for (const [sceneNum, options] of Object.entries(draft.sceneImageOptions || {})) {
    const num = Number(sceneNum);
    sceneImagePaths[num] = [];
    for (let i = 0; i < options.length; i++) {
      const path = await uploadImage(userId, liturgyId, 'scenes', `scene${sceneNum}`, i, options[i]);
      if (path) {
        sceneImagePaths[num].push(path);
      } else {
        console.log(`[useCuentacuentosDraft] Could not process scene ${sceneNum} image ${i}, URL: ${options[i]?.slice(0, 80)}...`);
      }
    }
    console.log(`[useCuentacuentosDraft] Scene ${sceneNum}: ${sceneImagePaths[num].length} paths saved`);
  }

  // Subir cover options
  for (let i = 0; i < (draft.coverOptions || []).length; i++) {
    const path = await uploadImage(userId, liturgyId, 'cover', 'cover', i, draft.coverOptions[i]);
    if (path) coverPaths.push(path);
  }

  // Subir end options
  for (let i = 0; i < (draft.endOptions || []).length; i++) {
    const path = await uploadImage(userId, liturgyId, 'end', 'end', i, draft.endOptions[i]);
    if (path) endPaths.push(path);
  }

  return { characterSheetPaths, sceneImagePaths, coverPaths, endPaths };
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
  }
): Promise<{
  characterSheetOptions: Record<string, string[]>;
  sceneImageOptions: Record<number, string[]>;
  coverOptions: string[];
  endOptions: string[];
}> {
  const characterSheetOptions: Record<string, string[]> = {};
  const sceneImageOptions: Record<number, string[]> = {};
  const coverOptions: string[] = [];
  const endOptions: string[] = [];

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

  console.log(`[useCuentacuentosDraft] Generated public URLs for ${Object.keys(sceneImageOptions).length} scene sets`);

  return { characterSheetOptions, sceneImageOptions, coverOptions, endOptions };
}

/**
 * Guarda un borrador en Supabase
 */
async function saveDraftToSupabase(
  userId: string,
  liturgyId: string,
  draft: CuentacuentosDraftFull
): Promise<boolean> {
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
      .single();

    const existingPaths = (existingDraft?.image_paths as {
      characterSheetPaths?: Record<string, string[]>;
      sceneImagePaths?: Record<number, string[]>;
      coverPaths?: string[];
      endPaths?: string[];
    }) || {
      characterSheetPaths: {},
      sceneImagePaths: {},
      coverPaths: [],
      endPaths: [],
    };

    // Subir SOLO las imágenes nuevas (las que están en memoria)
    const newImagePaths = await saveImagesToStorage(userId, liturgyId, draft);

    // CRITICAL FIX: Safer merge logic that NEVER loses existing valid paths
    // Only overwrite if we have valid new paths (non-null, non-empty strings)
    const mergedPaths = {
      characterSheetPaths: { ...existingPaths.characterSheetPaths },
      sceneImagePaths: { ...existingPaths.sceneImagePaths },
      coverPaths: existingPaths.coverPaths || [],
      endPaths: existingPaths.endPaths || [],
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
      return false;
    }

    console.log(`[useCuentacuentosDraft] Draft saved successfully, total scene paths: ${Object.keys(mergedPaths.sceneImagePaths).length}`);
    return true;
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error saving draft:', err);
    return false;
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
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') { // No rows found
        console.error('[useCuentacuentosDraft] Error loading draft:', error);
      }
      return null;
    }

    // Cargar imágenes desde Storage
    const imagePaths = (data as Record<string, unknown>).image_paths as {
      characterSheetPaths: Record<string, string[]>;
      sceneImagePaths: Record<number, string[]>;
      coverPaths: string[];
      endPaths: string[];
    } | undefined;

    let imageOptions = {
      characterSheetOptions: {} as Record<string, string[]>,
      sceneImageOptions: {} as Record<number, string[]>,
      coverOptions: [] as string[],
      endOptions: [] as string[],
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

    const draft: CuentacuentosDraftFull = {
      liturgyId,
      currentStep: data.current_step as CuentacuentosDraft['currentStep'],
      config: data.config as CuentacuentosDraft['config'],
      story: data.story as Story | null,
      selectedCharacterSheets: (data.selected_character_sheets as Record<string, number>) || {},
      selectedSceneImages: (data.selected_scene_images as Record<number, number>) || {},
      selectedCover: data.selected_cover as number | null,
      selectedEnd: data.selected_end as number | null,
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
 */
async function deleteDraftFromSupabase(
  userId: string,
  liturgyId: string
): Promise<boolean> {
  try {
    // Eliminar imágenes del storage
    const { data: files } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userId}/${liturgyId}`);

    if (files && files.length > 0) {
      // Listar todos los archivos recursivamente
      const allPaths: string[] = [];
      for (const folder of files) {
        const { data: subFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list(`${userId}/${liturgyId}/${folder.name}`);

        if (subFiles) {
          for (const file of subFiles) {
            allPaths.push(`${userId}/${liturgyId}/${folder.name}/${file.name}`);
          }
        }
      }

      if (allPaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(allPaths);
      }
    }

    // Eliminar registro de la tabla
    const { error } = await supabase
      .from('cuentacuentos_drafts')
      .delete()
      .eq('liturgia_id', liturgyId)
      .eq('user_id', userId);

    if (error) {
      console.error('[useCuentacuentosDraft] Error deleting draft:', error);
      return false;
    }

    console.log(`[useCuentacuentosDraft] Draft deleted for liturgy ${liturgyId}`);
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
  saveDraftNow: (data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>) => Promise<boolean>;
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
          ...currentDraft,
          ...pendingDataRef.current,
          savedAt: new Date().toISOString(),
          version: 1,
        };

        try {
          console.log(`[useCuentacuentosDraft] Starting saveDraftToSupabase...`);
          const success = await saveDraftToSupabase(currentUserId, currentLiturgyId, fullDraft);
          console.log(`[useCuentacuentosDraft] saveDraftToSupabase returned: ${success}`);
          if (success) {
            setDraft(fullDraft);
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
  const saveDraftNow = useCallback(async (data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>): Promise<boolean> => {
    const currentUserId = userIdRef.current;
    const currentLiturgyId = liturgyIdRef.current;
    const currentDraft = draftRef.current;

    console.log(`[useCuentacuentosDraft] saveDraftNow called, userId: ${currentUserId}, liturgyId: ${currentLiturgyId}`);

    if (!currentUserId) {
      console.warn('[useCuentacuentosDraft] saveDraftNow: No userId available, skipping save');
      return false;
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
      ...currentDraft,
      ...data,
      savedAt: new Date().toISOString(),
      version: 1,
    };

    try {
      console.log(`[useCuentacuentosDraft] saveDraftNow: Starting immediate save...`);
      const success = await saveDraftToSupabase(currentUserId, currentLiturgyId, fullDraft);
      console.log(`[useCuentacuentosDraft] saveDraftNow: Save completed, success: ${success}`);

      if (success) {
        setDraft(fullDraft);
        setLastSavedAt(fullDraft.savedAt);
      }
      return success;
    } catch (err) {
      console.error('[useCuentacuentosDraft] saveDraftNow: Failed to save draft:', err);
      return false;
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
