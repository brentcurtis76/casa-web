/**
 * Servicio de persistencia de liturgias en Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { Liturgy, LiturgyElement, PortadasConfig } from '@/types/shared/liturgy';
import { format } from 'date-fns';
import { createPreviewSlideGroup } from '@/lib/cuentacuentos/storyToSlides';

/**
 * Sube una imagen base64 a Supabase Storage y retorna la URL pública
 */
export async function uploadPortadaImage(
  liturgyId: string,
  base64Image: string
): Promise<string | null> {
  try {
    // Convert base64 to blob
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const binaryData = atob(base64Data);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // Create file path
    const filePath = `liturgias/${liturgyId}/portada.png`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('liturgia-images')
      .upload(filePath, blob, {
        upsert: true,
        contentType: 'image/png',
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    // Get public URL
    const { data } = supabase.storage
      .from('liturgia-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Error in uploadPortadaImage:', err);
    return null;
  }
}

/**
 * Descarga una imagen de Supabase Storage y la convierte a base64
 */
export async function downloadPortadaImage(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        resolve(base64Data);
      };
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error downloading image:', err);
    return null;
  }
}

/**
 * Interface for Cuentacuentos images to be uploaded
 */
export interface CuentacuentosImages {
  characterSheets: Record<string, string>;  // characterId -> base64 or URL
  sceneImages: Record<number, string>;       // sceneNumber -> base64 or URL
  coverImage?: string;
  endImage?: string;
}

/**
 * Interface for uploaded Cuentacuentos image URLs
 */
export interface CuentacuentosImageUrls {
  characterSheets: Record<string, string>;  // characterId -> URL
  sceneImages: Record<number, string>;       // sceneNumber -> URL
  coverImage?: string;
  endImage?: string;
}

/**
 * Helper to convert base64 to blob
 */
function base64ToBlob(base64Data: string): Blob {
  // Remove data URL prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const binaryData = atob(cleanBase64);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }
  // Detect if JPEG or PNG from magic bytes
  const isJpeg = cleanBase64.startsWith('/9j/');
  return new Blob([bytes], { type: isJpeg ? 'image/jpeg' : 'image/png' });
}

/**
 * Upload a single image and return its public URL
 */
async function uploadSingleImage(
  liturgyId: string,
  category: string,
  filename: string,
  base64Data: string
): Promise<string | null> {
  try {
    // If it's already a URL, return it as-is
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      console.log(`[uploadSingleImage] Image is already URL: ${base64Data.slice(0, 80)}`);
      return base64Data;
    }

    const blob = base64ToBlob(base64Data);
    const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const filePath = `liturgias/${liturgyId}/cuentacuentos/${category}/${filename}.${extension}`;

    console.log(`[uploadSingleImage] Uploading to ${filePath}, size: ${blob.size}`);

    const { error: uploadError } = await supabase.storage
      .from('liturgia-images')
      .upload(filePath, blob, {
        upsert: true,
        contentType: blob.type,
      });

    if (uploadError) {
      console.error(`[uploadSingleImage] Error uploading ${filePath}:`, uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('liturgia-images')
      .getPublicUrl(filePath);

    console.log(`[uploadSingleImage] Uploaded successfully: ${data.publicUrl.slice(0, 80)}`);
    return data.publicUrl;
  } catch (err) {
    console.error(`[uploadSingleImage] Error:`, err);
    return null;
  }
}

/**
 * Upload all Cuentacuentos images to Supabase Storage
 * Returns the same structure but with storage URLs instead of base64
 */
export async function uploadCuentacuentosImages(
  liturgyId: string,
  images: CuentacuentosImages
): Promise<CuentacuentosImageUrls> {
  console.log('[uploadCuentacuentosImages] Starting upload for liturgy:', liturgyId);

  const result: CuentacuentosImageUrls = {
    characterSheets: {},
    sceneImages: {},
  };

  // Upload character sheets
  for (const [charId, imageData] of Object.entries(images.characterSheets)) {
    if (imageData) {
      const url = await uploadSingleImage(liturgyId, 'characters', charId, imageData);
      if (url) {
        result.characterSheets[charId] = url;
      }
    }
  }
  console.log(`[uploadCuentacuentosImages] Uploaded ${Object.keys(result.characterSheets).length} character sheets`);

  // Upload scene images
  for (const [sceneNum, imageData] of Object.entries(images.sceneImages)) {
    if (imageData) {
      const url = await uploadSingleImage(liturgyId, 'scenes', `scene_${sceneNum}`, imageData);
      if (url) {
        result.sceneImages[Number(sceneNum)] = url;
      }
    }
  }
  console.log(`[uploadCuentacuentosImages] Uploaded ${Object.keys(result.sceneImages).length} scene images`);

  // Upload cover image
  if (images.coverImage) {
    const url = await uploadSingleImage(liturgyId, 'cover', 'cover', images.coverImage);
    if (url) {
      result.coverImage = url;
    }
  }

  // Upload end image
  if (images.endImage) {
    const url = await uploadSingleImage(liturgyId, 'end', 'end', images.endImage);
    if (url) {
      result.endImage = url;
    }
  }

  console.log('[uploadCuentacuentosImages] Upload complete');
  return result;
}

/**
 * Update a Story object with uploaded image URLs
 */
export function updateStoryWithImageUrls(
  story: import('@/types/shared/story').Story,
  urls: CuentacuentosImageUrls
): import('@/types/shared/story').Story {
  return {
    ...story,
    characters: story.characters.map(char => ({
      ...char,
      characterSheetUrl: urls.characterSheets[char.id] || char.characterSheetUrl,
    })),
    scenes: story.scenes.map(scene => ({
      ...scene,
      selectedImageUrl: urls.sceneImages[scene.number] || scene.selectedImageUrl,
    })),
    coverImageUrl: urls.coverImage || story.coverImageUrl,
    endImageUrl: urls.endImage || story.endImageUrl,
  };
}

// Tipos para la base de datos
interface DBLiturgia {
  id: string;
  fecha: string;
  titulo: string;
  resumen: string | null;
  celebrante: string | null;
  predicador: string | null;
  reflexion_texto: string | null;
  estado: 'borrador' | 'en-progreso' | 'listo' | 'archivado';
  porcentaje_completado: number;
  portada_imagen_url: string | null;
  portadas_config: PortadasConfig | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DBLiturgiaElemento {
  id: string;
  liturgia_id: string;
  tipo: string;
  orden: number;
  titulo: string | null;
  slides: unknown;
  source_id: string | null;
  status: string | null;
  config: unknown;
  custom_content: string | null;
  edited_slides: unknown;
  created_at: string;
  updated_at: string;
}

interface DBLiturgiaLectura {
  id: string;
  liturgia_id: string;
  cita: string;
  texto: string;
  version: string;
  orden: number;
  created_at: string;
}

/**
 * Guarda una liturgia completa en Supabase
 * @param liturgy - La liturgia a guardar
 * @param portadaImageBase64 - Imagen de portada en base64 (opcional)
 * @param portadasConfig - Configuración de portadas (alineación, escala, posición)
 */
export async function saveLiturgy(
  liturgy: Liturgy,
  portadaImageBase64?: string | null,
  portadasConfig?: PortadasConfig
): Promise<{ success: boolean; error?: string; imageUrl?: string }> {
  console.log('[saveLiturgy] Starting save for liturgy:', liturgy.id);
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[saveLiturgy] Auth check:', { userId: user?.id, authError });
    if (!user) {
      console.error('[saveLiturgy] No authenticated user');
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Formatear fecha
    console.log('[saveLiturgy] liturgy.context.date BEFORE formatting:', {
      date: liturgy.context.date,
      dateType: typeof liturgy.context.date,
      dateISO: liturgy.context.date instanceof Date ? liturgy.context.date.toISOString() : liturgy.context.date
    });

    const fecha = typeof liturgy.context.date === 'string'
      ? liturgy.context.date
      : format(liturgy.context.date, 'yyyy-MM-dd');

    console.log('[saveLiturgy] fecha AFTER formatting:', fecha);

    // Calcular porcentaje de completado basado en completitud REAL
    // No solo slides, sino también sourceId para canciones, config para cuentacuentos/anuncios
    const isElementComplete = (e: LiturgyElement): boolean => {
      if (e.status === 'skipped') return true;
      // Canciones requieren sourceId (canción seleccionada)
      const cancionTypes = ['cancion-invocacion', 'cancion-arrepentimiento', 'cancion-gratitud', 'cancion-santa-cena'];
      if (cancionTypes.includes(e.type)) {
        return !!e.sourceId;
      }
      // Cuentacuentos requiere storyData en config
      if (e.type === 'cuentacuentos') {
        return !!(e.config as { storyData?: unknown })?.storyData;
      }
      // Anuncios requieren announcementConfigs con contenido
      if (e.type === 'anuncios') {
        const configs = (e.config as { announcementConfigs?: unknown[] })?.announcementConfigs;
        return Array.isArray(configs) && configs.length > 0;
      }
      // Otros elementos solo requieren slides
      return !!e.slides;
    };

    // Elementos opcionales: cuentacuentos y anuncios
    const optionalTypes = ['cuentacuentos', 'anuncios'];

    // Para el porcentaje, contar todos los elementos completados o skipped
    // Un elemento opcional skipped cuenta como "hecho" para el progreso
    const isElementDone = (e: LiturgyElement): boolean => {
      if (e.status === 'skipped') return true;
      return isElementComplete(e);
    };

    const completedCount = liturgy.elements.filter(isElementDone).length;
    const totalElements = 18;

    // Porcentaje basado en elementos completados o skipped / total
    const porcentaje = liturgy.status === 'ready' ? 100 :
      Math.round((completedCount / totalElements) * 100);

    // Subir imagen si se proporciona
    let imageUrl: string | null = null;
    if (portadaImageBase64) {
      imageUrl = await uploadPortadaImage(liturgy.id, portadaImageBase64);
    }

    // Upsert liturgia principal
    const upsertData: Record<string, unknown> = {
      id: liturgy.id,
      fecha,
      titulo: liturgy.context.title,
      resumen: liturgy.context.summary || null,
      celebrante: liturgy.context.celebrant || null,
      predicador: liturgy.context.preacher || null,
      reflexion_texto: liturgy.context.reflexionText || null,
      estado: liturgy.status === 'ready' ? 'listo' : 'en-progreso',
      porcentaje_completado: porcentaje,
      created_by: user.id,
    };

    console.log('[saveLiturgy] CRITICAL - fecha being saved to DB:', fecha);

    // Solo actualizar la URL de imagen si se subió una nueva
    if (imageUrl) {
      upsertData.portada_imagen_url = imageUrl;
    }

    // Guardar configuración de portadas si se proporciona
    if (portadasConfig) {
      upsertData.portadas_config = portadasConfig;
    }

    console.log('[saveLiturgy] Upserting liturgia with data:', upsertData);
    const { data: liturgiaData, error: liturgiaError } = await supabase
      .from('liturgias')
      .upsert(upsertData, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (liturgiaError) {
      console.error('[saveLiturgy] Error saving liturgia:', liturgiaError);
      return { success: false, error: liturgiaError.message };
    }

    console.log('[saveLiturgy] Liturgia saved successfully:', liturgiaData?.id);
    console.log('[saveLiturgy] VERIFY - fecha in DB after save:', liturgiaData?.fecha);
    const liturgiaId = liturgiaData.id;

    // Guardar lecturas bíblicas
    if (liturgy.context.readings && liturgy.context.readings.length > 0) {
      // Eliminar lecturas existentes
      await supabase
        .from('liturgia_lecturas')
        .delete()
        .eq('liturgia_id', liturgiaId);

      // Insertar nuevas lecturas
      const lecturas = liturgy.context.readings.map((r, index) => ({
        liturgia_id: liturgiaId,
        cita: r.reference,
        texto: r.text || '',
        version: r.version || 'NVI',
        orden: index,
      }));

      const { error: lecturasError } = await supabase
        .from('liturgia_lecturas')
        .insert(lecturas);

      if (lecturasError) {
        console.error('Error saving lecturas:', lecturasError);
      }
    }

    // Upload cuentacuentos images if present
    // This converts base64 images to storage URLs before saving
    const processedElements = await Promise.all(liturgy.elements.map(async (element) => {
      if (element.type === 'cuentacuentos' && element.config?.storyData) {
        const story = element.config.storyData as import('@/types/shared/story').Story;

        // Check if story has any base64 images that need uploading
        const hasBase64Images =
          story.characters?.some(c => c.characterSheetUrl && !c.characterSheetUrl.startsWith('http')) ||
          story.scenes?.some(s => s.selectedImageUrl && !s.selectedImageUrl.startsWith('http')) ||
          (story.coverImageUrl && !story.coverImageUrl.startsWith('http')) ||
          (story.endImageUrl && !story.endImageUrl.startsWith('http'));

        if (hasBase64Images) {
          console.log('[saveLiturgy] Found cuentacuentos with base64 images, uploading...');

          // Collect all images to upload
          const imagesToUpload: CuentacuentosImages = {
            characterSheets: {},
            sceneImages: {},
          };

          // Collect character sheet images
          story.characters?.forEach(char => {
            if (char.characterSheetUrl && !char.characterSheetUrl.startsWith('http')) {
              imagesToUpload.characterSheets[char.id] = char.characterSheetUrl;
            }
          });

          // Collect scene images
          story.scenes?.forEach(scene => {
            if (scene.selectedImageUrl && !scene.selectedImageUrl.startsWith('http')) {
              imagesToUpload.sceneImages[scene.number] = scene.selectedImageUrl;
            }
          });

          // Cover and end images
          if (story.coverImageUrl && !story.coverImageUrl.startsWith('http')) {
            imagesToUpload.coverImage = story.coverImageUrl;
          }
          if (story.endImageUrl && !story.endImageUrl.startsWith('http')) {
            imagesToUpload.endImage = story.endImageUrl;
          }

          // Upload images
          const uploadedUrls = await uploadCuentacuentosImages(liturgiaId, imagesToUpload);

          // Update story with uploaded URLs
          const updatedStory = updateStoryWithImageUrls(story, uploadedUrls);

          // CRITICAL: Regenerate slides from updated story with URLs
          // Without this, element.slides would still have base64 data instead of URLs
          const updatedSlides = createPreviewSlideGroup(updatedStory);

          console.log('[saveLiturgy] Cuentacuentos images uploaded, regenerating slides with URLs:', {
            sceneUrls: updatedStory.scenes.map(s => s.selectedImageUrl?.slice(0, 50)),
            slideCount: updatedSlides.slides.length,
          });

          return {
            ...element,
            slides: updatedSlides,
            config: { ...element.config, storyData: updatedStory },
          };
        }
      }

      // For cuentacuentos with existing URLs (resave), ensure slides are in sync with storyData
      if (element.type === 'cuentacuentos' && element.config?.storyData) {
        const story = element.config.storyData as import('@/types/shared/story').Story;
        // Regenerate slides to ensure they have the correct URLs from storyData
        const regeneratedSlides = createPreviewSlideGroup(story);
        console.log('[saveLiturgy] Cuentacuentos resave, regenerating slides to sync with storyData:', {
          hasSceneUrls: story.scenes.some(s => s.selectedImageUrl?.startsWith('http')),
          slideCount: regeneratedSlides.slides.length,
        });
        return {
          ...element,
          slides: regeneratedSlides,
        };
      }

      return element;
    }));

    // Guardar elementos
    if (processedElements.length > 0) {
      // Eliminar elementos existentes
      await supabase
        .from('liturgia_elementos')
        .delete()
        .eq('liturgia_id', liturgiaId);

      // Insertar nuevos elementos con todos los campos necesarios
      const elementos = processedElements.map((e) => ({
        liturgia_id: liturgiaId,
        tipo: e.type,
        orden: e.order,
        titulo: e.title || null,
        slides: e.slides || null,
        source_id: e.sourceId || null,
        status: e.status || 'pending',
        config: e.config || null,
        custom_content: e.customContent || null,
        edited_slides: e.editedSlides || null,
      }));

      // DEBUG: Log cuentacuentos element being saved
      const cuentacuentosToSave = elementos.find(e => e.tipo === 'cuentacuentos');
      if (cuentacuentosToSave) {
        const storyData = (cuentacuentosToSave.config as { storyData?: unknown } | null)?.storyData as { scenes?: Array<{ number: number; selectedImageUrl?: string }> } | undefined;
        console.log('[saveLiturgy] CUENTACUENTOS BEING SAVED:', {
          hasConfig: !!cuentacuentosToSave.config,
          hasStoryData: !!storyData,
          scenes: storyData?.scenes?.map((s: { number: number; selectedImageUrl?: string }) => ({
            number: s.number,
            hasImageUrl: !!s.selectedImageUrl,
            imageUrlPrefix: s.selectedImageUrl?.slice(0, 60),
          })),
        });
      }

      console.log('[saveLiturgy] Inserting', elementos.length, 'elementos');
      const { error: elementosError } = await supabase
        .from('liturgia_elementos')
        .insert(elementos);

      if (elementosError) {
        console.error('[saveLiturgy] Error saving elementos:', elementosError);
      } else {
        console.log('[saveLiturgy] Elementos saved successfully');
      }
    }

    console.log('[saveLiturgy] Save completed successfully');
    return { success: true, imageUrl: imageUrl || undefined };
  } catch (err) {
    console.error('Error in saveLiturgy:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/** Resultado de cargar una liturgia */
export interface LoadLiturgyResult {
  liturgy: Liturgy;
  portadaImageUrl?: string;
  portadasConfig?: PortadasConfig;
}

/**
 * Carga una liturgia por ID
 */
export async function loadLiturgy(id: string): Promise<LoadLiturgyResult | null> {
  try {
    // Cargar liturgia principal
    const { data: liturgiaData, error: liturgiaError } = await supabase
      .from('liturgias')
      .select('*')
      .eq('id', id)
      .single();

    if (liturgiaError || !liturgiaData) {
      console.error('Error loading liturgia:', liturgiaError);
      return null;
    }

    console.log('[loadLiturgy] CRITICAL - fecha from DB:', liturgiaData.fecha);

    // Cargar lecturas
    const { data: lecturasData } = await supabase
      .from('liturgia_lecturas')
      .select('*')
      .eq('liturgia_id', id)
      .order('orden');

    // Cargar elementos
    const { data: elementosData } = await supabase
      .from('liturgia_elementos')
      .select('*')
      .eq('liturgia_id', id)
      .order('orden');

    // DEBUG: Log cuentacuentos element from database
    const cuentacuentosElement = elementosData?.find((e: DBLiturgiaElemento) => e.tipo === 'cuentacuentos');
    if (cuentacuentosElement) {
      const storyData = (cuentacuentosElement.config as { storyData?: unknown })?.storyData as { scenes?: Array<{ number: number; selectedImageUrl?: string; imageOptions?: string[] }> } | undefined;
      console.log('[loadLiturgy] CUENTACUENTOS FROM DB - hasConfig:', !!cuentacuentosElement.config, 'hasStoryData:', !!storyData);
      console.log('[loadLiturgy] SCENE DATA FROM DB:');
      storyData?.scenes?.forEach((s: { number: number; selectedImageUrl?: string; imageOptions?: string[] }) => {
        const urlType = s.selectedImageUrl?.startsWith('http') ? 'URL' : (s.selectedImageUrl ? 'BASE64' : 'NONE');
        const optionsInfo = s.imageOptions ? `${s.imageOptions.length} options, first is ${s.imageOptions[0]?.startsWith('http') ? 'URL' : 'BASE64'}` : 'NO OPTIONS';
        console.log(`   Scene ${s.number}: selectedImageUrl=${urlType}, imageOptions=${optionsInfo}`);
      });
    }

    // Convertir a tipo Liturgy
    // IMPORTANTE: Agregar T12:00:00 para evitar problemas de timezone
    // Sin esto, "2026-01-11" se interpreta como UTC medianoche, que en Chile
    // es el día anterior (2026-01-10 a las 21:00)
    const liturgy: Liturgy = {
      id: liturgiaData.id,
      context: {
        id: liturgiaData.id,
        date: new Date(liturgiaData.fecha + 'T12:00:00'),
        title: liturgiaData.titulo,
        summary: liturgiaData.resumen || undefined,
        readings: (lecturasData || []).map((l: DBLiturgiaLectura) => ({
          reference: l.cita,
          text: l.texto,
          version: l.version,
          versionCode: l.version,
        })),
        celebrant: liturgiaData.celebrante || undefined,
        preacher: liturgiaData.predicador || undefined,
        reflexionText: liturgiaData.reflexion_texto || undefined,
        createdAt: liturgiaData.created_at,
        updatedAt: liturgiaData.updated_at,
      },
      elements: (elementosData || []).map((e: DBLiturgiaElemento) => ({
        id: e.id,
        type: e.tipo as LiturgyElement['type'],
        order: e.orden,
        title: e.titulo || undefined,
        slides: e.slides as LiturgyElement['slides'],
        sourceId: e.source_id || undefined,
        status: (e.status as LiturgyElement['status']) || 'pending',
        config: e.config as LiturgyElement['config'],
        customContent: e.custom_content || undefined,
        editedSlides: e.edited_slides as LiturgyElement['editedSlides'],
      })),
      status: liturgiaData.estado === 'listo' ? 'ready' : 'in-progress',
      metadata: {
        createdAt: liturgiaData.created_at,
        updatedAt: liturgiaData.updated_at,
      },
    };

    return {
      liturgy,
      portadaImageUrl: liturgiaData.portada_imagen_url || undefined,
      portadasConfig: liturgiaData.portadas_config || undefined,
    };
  } catch (err) {
    console.error('Error in loadLiturgy:', err);
    return null;
  }
}

/**
 * Carga la liturgia más reciente del usuario (borrador)
 */
export async function loadLatestDraft(): Promise<LoadLiturgyResult | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Buscar la liturgia más reciente en estado borrador o en-progreso
    const { data: liturgiaData, error } = await supabase
      .from('liturgias')
      .select('id')
      .eq('created_by', user.id)
      .in('estado', ['borrador', 'en-progreso'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !liturgiaData) {
      return null;
    }

    return await loadLiturgy(liturgiaData.id);
  } catch (err) {
    console.error('Error in loadLatestDraft:', err);
    return null;
  }
}

/**
 * Lista todas las liturgias del usuario
 */
export async function listLiturgies(): Promise<Array<{
  id: string;
  fecha: string;
  titulo: string;
  estado: string;
  porcentaje: number;
}>> {
  try {
    const { data, error } = await supabase
      .from('liturgias')
      .select('id, fecha, titulo, estado, porcentaje_completado')
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error listing liturgias:', error);
      return [];
    }

    return (data || []).map((l: { id: string; fecha: string; titulo: string; estado: string; porcentaje_completado: number }) => ({
      id: l.id,
      fecha: l.fecha,
      titulo: l.titulo,
      estado: l.estado,
      porcentaje: l.porcentaje_completado,
    }));
  } catch (err) {
    console.error('Error in listLiturgies:', err);
    return [];
  }
}

/**
 * Elimina una liturgia
 */
export async function deleteLiturgy(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('liturgias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting liturgia:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in deleteLiturgy:', err);
    return false;
  }
}
