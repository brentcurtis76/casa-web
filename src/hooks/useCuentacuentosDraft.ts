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

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('[useCuentacuentosDraft] Error uploading image:', error);
      return null;
    }

    return path;
  } catch (err) {
    console.error('[useCuentacuentosDraft] Error uploading image:', err);
    return null;
  }
}

/**
 * Descarga una imagen de Supabase Storage y la convierte a base64
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
      if (path) sceneImagePaths[num].push(path);
    }
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
 * Carga todas las imágenes de Storage a base64
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

  // Cargar character sheets
  for (const [charId, pathList] of Object.entries(paths.characterSheetPaths || {})) {
    characterSheetOptions[charId] = [];
    for (const path of pathList) {
      const base64 = await downloadImage(path);
      if (base64) characterSheetOptions[charId].push(base64);
    }
  }

  // Cargar scene images
  for (const [sceneNum, pathList] of Object.entries(paths.sceneImagePaths || {})) {
    const num = Number(sceneNum);
    sceneImageOptions[num] = [];
    for (const path of pathList) {
      const base64 = await downloadImage(path);
      if (base64) sceneImageOptions[num].push(base64);
    }
  }

  // Cargar cover options
  for (const path of paths.coverPaths || []) {
    const base64 = await downloadImage(path);
    if (base64) coverOptions.push(base64);
  }

  // Cargar end options
  for (const path of paths.endPaths || []) {
    const base64 = await downloadImage(path);
    if (base64) endOptions.push(base64);
  }

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

    // Primero subir las imágenes a Storage
    const imagePaths = await saveImagesToStorage(userId, liturgyId, draft);

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
        // Guardar los paths de las imágenes en config para poder recuperarlas
        image_paths: imagePaths,
      } as Record<string, unknown>, {
        onConflict: 'liturgia_id,user_id',
      });

    if (error) {
      console.error('[useCuentacuentosDraft] Error saving draft:', error);
      return false;
    }

    console.log(`[useCuentacuentosDraft] Draft saved successfully, scenes: ${Object.keys(draft.sceneImageOptions || {}).length}`);
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
      imageOptions = await loadImagesFromStorage(imagePaths);
      console.log(`[useCuentacuentosDraft] Loaded ${Object.keys(imageOptions.sceneImageOptions).length} scene image sets`);
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
  loadDraft: () => Promise<CuentacuentosDraftFull | null>;
  deleteDraft: () => void;
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

  // Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
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

  // Guardar borrador con debounce
  const saveDraft = useCallback((data: Partial<Omit<CuentacuentosDraftFull, 'liturgyId' | 'savedAt' | 'version'>>) => {
    if (!userId) return;

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

        const fullDraft: CuentacuentosDraftFull = {
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
          ...draft,
          ...pendingDataRef.current,
          savedAt: new Date().toISOString(),
          version: 1,
        };

        try {
          const success = await saveDraftToSupabase(userId, liturgyId, fullDraft);
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
  }, [liturgyId, draft, userId]);

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
    loadDraft: loadDraftAsync,
    deleteDraft,
    showRecoveryPrompt,
    acceptRecovery,
    declineRecovery,
  };
}
