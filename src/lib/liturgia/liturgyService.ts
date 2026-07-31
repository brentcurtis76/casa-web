/**
 * Servicio de persistencia de liturgias en Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { Liturgy, LiturgyElement, PortadasConfig } from '@/types/shared/liturgy';
import { CUSTOM_TIPO_PREFIX } from '@/types/shared/liturgy';
import { format } from 'date-fns';
import { createPreviewSlideGroup } from '@/lib/cuentacuentos/storyToSlides';
import { unpublishReflexionForLiturgy } from '@/lib/publishedResourcesService';
import {
  uploadImmutableFinalImage,
  isHttpReference,
} from '@/lib/cuentacuentos/immutableImageUpload';

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
 * Sube el PDF de la reflexión a Supabase Storage y retorna la URL pública
 */
export async function uploadReflexionPdf(
  liturgyId: string,
  pdfFile: File
): Promise<string | null> {
  try {
    const filePath = `liturgias/${liturgyId}/reflexion.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('liturgy-published')
      .upload(filePath, pdfFile, {
        upsert: true,
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.error('Error uploading reflexion PDF:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('liturgy-published')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Error in uploadReflexionPdf:', err);
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
): Promise<string> {
  // If it's already a URL, return it as-is
  if (isHttpReference(base64Data)) {
    console.log(`[uploadSingleImage] Image is already URL: ${base64Data.slice(0, 80)}`);
    return base64Data;
  }

  // PB/G2 — subida inmutable por la primitiva compartida: nombre por
  // contenido, `upsert:false`, MIME por magic bytes.
  //
  // PB/G4 — el fallo ya NO se degrada a `null`. Antes, `null` hacía que
  // `updateStoryWithImageUrls` cayera al campo original — que puede ser
  // base64 crudo — y `saveLiturgy` lo persistía en `liturgia_elementos`
  // reportando ÉXITO. Ahora la excepción sube y aborta el guardado antes de
  // tocar `liturgia_elementos`.
  const uploaded = await uploadImmutableFinalImage({
    liturgyId,
    category,
    key: filename,
    data: base64Data,
  });

  console.log(
    `[uploadSingleImage] Uploaded successfully: ${uploaded.path} (deduplicated=${uploaded.deduplicated})`
  );
  return uploaded.publicUrl;
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
      result.characterSheets[charId] = await uploadSingleImage(
        liturgyId,
        'characters',
        charId,
        imageData
      );
    }
  }
  console.log(`[uploadCuentacuentosImages] Uploaded ${Object.keys(result.characterSheets).length} character sheets`);

  // Upload scene images
  for (const [sceneNum, imageData] of Object.entries(images.sceneImages)) {
    if (imageData) {
      result.sceneImages[Number(sceneNum)] = await uploadSingleImage(
        liturgyId,
        'scenes',
        `scene_${sceneNum}`,
        imageData
      );
    }
  }
  console.log(`[uploadCuentacuentosImages] Uploaded ${Object.keys(result.sceneImages).length} scene images`);

  // Upload cover image
  if (images.coverImage) {
    result.coverImage = await uploadSingleImage(liturgyId, 'cover', 'cover', images.coverImage);
  }

  // Upload end image
  if (images.endImage) {
    result.endImage = await uploadSingleImage(liturgyId, 'end', 'end', images.endImage);
  }

  console.log('[uploadCuentacuentosImages] Upload complete');
  return result;
}

/**
 * PB/G5 — [B1]: reescritura de un arreglo de OPCIONES de imagen para el payload
 * finalizado.
 *
 * El leak que cierra: la finalización del editor copia las opciones TAL CUAL
 * (`coverImageOptions`, `endImageOptions`, `characterSheetOptions`,
 * `imageOptions`), y hasta acá `updateStoryWithImageUrls` sólo reescribía el
 * campo SELECCIONADO. Una opción no seleccionada seguía siendo bytes inline y
 * viajaba cruda a `liturgia_elementos`, contra G5 paso 4 ("nada de base64") y
 * T-B.9 ("sólo la URL pública nueva").
 *
 * Regla, en este orden y preservando el orden original:
 *  - una opción HTTP(S) YA persistida pasa intacta (G2/G4: las referencias
 *    existentes nunca se re-suben ni se reescriben);
 *  - la opción inline que ES la seleccionada se REEMPLAZA por su URL final
 *    subida — así el elemento conserva la referencia H2 dentro del arreglo y
 *    el reopen no pierde la selección;
 *  - cualquier otra opción inline se DESCARTA: nunca se subió, no existe URL
 *    para ella, y persistir sus bytes es exactamente el leak.
 */
function rewriteFinalizedOptions(
  options: string[] | undefined,
  selectedBefore: string | undefined,
  selectedAfter: string | undefined
): string[] | undefined {
  if (!options) return options;
  const rewritten: string[] = [];
  for (const option of options) {
    if (isHttpReference(option)) {
      rewritten.push(option);
      continue;
    }
    if (
      selectedBefore !== undefined &&
      option === selectedBefore &&
      isHttpReference(selectedAfter)
    ) {
      rewritten.push(selectedAfter);
    }
  }
  return rewritten;
}

/** Deja SÓLO referencias HTTP(S) en un arreglo de imágenes. */
function httpOnly(images: string[] | undefined): string[] | undefined {
  return images ? images.filter(isHttpReference) : images;
}

/** Un escalar de referencia que quedó inline no puede persistirse. */
function httpOrUndefined(value: string | undefined): string | undefined {
  return value === undefined || isHttpReference(value) ? value : undefined;
}

/**
 * PB/G5 — [B1]: borde de persistencia del elemento cuentacuentos.
 *
 * `updateStoryWithImageUrls` cubre los cuatro slots que la finalización SÍ
 * sube. Este paso cierra el resto de la superficie de imagen del `Story` —
 * referencias de landmarks/props/personajes, que `saveLiturgy` nunca sube — de
 * modo que el `storyData` persistido no contenga NINGÚN byte inline, que es lo
 * que exige el recorrido completo de G5 paso 4.
 *
 * Es una lista EXPLÍCITA de campos tipados, no un barrido heurístico: un walk
 * genérico sobre strings largos podría descartar prosa del cuento.
 *
 * Los cuatro campos seleccionados (`characterSheetUrl`, `selectedImageUrl`,
 * `coverImageUrl`, `endImageUrl`) NO se tocan acá a propósito: en la rama de
 * subida ya son URLs porque la finalización subió todo inline seleccionado, y
 * en la rama de re-guardado la condición de entrada garantiza que ya eran
 * HTTP(S). Si alguna vez dejara de ser cierto, el recorrido completo del test
 * de G5 lo delata en vez de que un descarte silencioso lo esconda.
 */
export function stripInlineImageRefs(
  story: import('@/types/shared/story').Story
): import('@/types/shared/story').Story {
  return {
    ...story,
    characters: story.characters?.map(char => ({
      ...char,
      characterSheetOptions: httpOnly(char.characterSheetOptions),
    })) ?? story.characters,
    scenes: story.scenes?.map(scene => ({
      ...scene,
      imageOptions: httpOnly(scene.imageOptions),
    })) ?? story.scenes,
    landmarks: story.landmarks?.map(landmark => ({
      ...landmark,
      referenceImages: httpOnly(landmark.referenceImages) ?? [],
      selectedReferenceUrl: httpOrUndefined(landmark.selectedReferenceUrl),
    })),
    props: story.props?.map(prop => ({
      ...prop,
      referenceImages: httpOnly(prop.referenceImages) ?? [],
      selectedReferenceUrl: httpOrUndefined(prop.selectedReferenceUrl),
    })),
    coverImageOptions: httpOnly(story.coverImageOptions),
    endImageOptions: httpOnly(story.endImageOptions),
  };
}

/**
 * Update a Story object with uploaded image URLs
 */
export function updateStoryWithImageUrls(
  story: import('@/types/shared/story').Story,
  urls: CuentacuentosImageUrls
): import('@/types/shared/story').Story {
  const coverAfter = urls.coverImage || story.coverImageUrl;
  const endAfter = urls.endImage || story.endImageUrl;
  return {
    ...story,
    characters: story.characters.map(char => {
      const sheetAfter = urls.characterSheets[char.id] || char.characterSheetUrl;
      return {
        ...char,
        characterSheetUrl: sheetAfter,
        characterSheetOptions: rewriteFinalizedOptions(
          char.characterSheetOptions,
          char.characterSheetUrl,
          sheetAfter
        ),
      };
    }),
    scenes: story.scenes.map(scene => {
      const sceneAfter = urls.sceneImages[scene.number] || scene.selectedImageUrl;
      return {
        ...scene,
        selectedImageUrl: sceneAfter,
        imageOptions: rewriteFinalizedOptions(
          scene.imageOptions,
          scene.selectedImageUrl,
          sceneAfter
        ),
      };
    }),
    coverImageUrl: coverAfter,
    coverImageOptions: rewriteFinalizedOptions(
      story.coverImageOptions,
      story.coverImageUrl,
      coverAfter
    ),
    endImageUrl: endAfter,
    endImageOptions: rewriteFinalizedOptions(
      story.endImageOptions,
      story.endImageUrl,
      endAfter
    ),
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
  reflexion_pdf_url: string | null;
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
 * @param portadaImageBase64 - Imagen de portada en base64 (opcional, usada para thumbnail `portada_imagen_url`)
 *
 * Note: the former `portadasConfig` parameter (illustration alignment / scale /
 * position / title-break word) was removed after the baked-in-text cover
 * refactor — those fields are no longer user-controlled. The `portadas_config`
 * DB column is NOT written anymore. It is still READ by
 * `presentationService.migratePortadasSlides` for legacy liturgies saved
 * before the refactor, so the column and the `PortadasConfig` type remain.
 */
export async function saveLiturgy(
  liturgy: Liturgy,
  portadaImageBase64?: string | null
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

    // Solo actualizar la URL de imagen si se subió una nueva. Esta columna
    // hoy no se puede borrar; si se agrega un flujo de "eliminar portada",
    // usar el mismo esquema de tres estados de reflexion_pdf_url (abajo).
    if (imageUrl) {
      upsertData.portada_imagen_url = imageUrl;
    }

    // reflexion_pdf_url es de tres estados: un string escribe la nueva URL,
    // null (el usuario eliminó el PDF en el formulario) borra la columna, y
    // undefined la omite para que un guardado que no trae el valor no pierda
    // la URL almacenada.
    if (liturgy.context.reflexionPdfUrl !== undefined) {
      upsertData.reflexion_pdf_url = liturgy.context.reflexionPdfUrl;
    }

    // Note: `portadas_config` column is intentionally NOT written. Baked-in
    // covers don't use it. The column still exists for legacy liturgies and
    // is read by presentationService.migratePortadasSlides at render time.

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

    // Eliminación explícita del PDF: borrar el archivo del bucket (es público
    // y seguiría accesible por su URL) y despublicar la reflexión activa de
    // esta liturgia. Best-effort — la columna ya quedó en NULL con el upsert.
    if (liturgy.context.reflexionPdfUrl === null) {
      try {
        await supabase.storage
          .from('liturgy-published')
          .remove([`liturgias/${liturgy.id}/reflexion.pdf`]);
        await unpublishReflexionForLiturgy(liturgy.id);
      } catch (err) {
        console.error('[saveLiturgy] Error limpiando el PDF de reflexión eliminado:', err);
      }
    }

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
          //
          // PB/G4 — fail-closed. Cualquier fallo que NO sea un conflicto de
          // duplicado aborta el guardado ACÁ, antes del upsert de
          // `liturgia_elementos` (más abajo). Antes, una subida fallida
          // devolvía `null`, `updateStoryWithImageUrls` caía al campo original
          // —que puede ser base64 crudo— y la liturgia se guardaba con "éxito"
          // llevándose el base64 a la base. Los objetos hermanos que sí se
          // crearon quedan como huérfanos permitidos: PB nunca compensa con
          // borrados.
          let uploadedUrls: CuentacuentosImageUrls;
          try {
            uploadedUrls = await uploadCuentacuentosImages(liturgiaId, imagesToUpload);
          } catch (err) {
            const detail = err instanceof Error ? err.message : 'Error desconocido';
            console.error('[saveLiturgy] Cuentacuentos image upload failed; aborting save:', err);
            throw new Error(`No se pudieron guardar las imágenes del cuento: ${detail}`);
          }

          // Update story with uploaded URLs
          //
          // PB/G5 — [B1]: `updateStoryWithImageUrls` reescribe los cuatro slots
          // seleccionados Y sus arreglos de opciones; `stripInlineImageRefs`
          // cierra el resto de la superficie de imagen (referencias de
          // landmarks/props) que la finalización nunca sube. El `storyData` que
          // llega a `liturgia_elementos` queda sin un solo byte inline.
          const updatedStory = stripInlineImageRefs(
            updateStoryWithImageUrls(story, uploadedUrls)
          );

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
        // PB/G5 — [B1]: esta rama corre cuando NINGÚN campo seleccionado es
        // inline, pero los arreglos de opciones SÍ pueden traer bytes crudos
        // (p. ej. una portada seleccionada que ya era URL junto a opciones
        // generadas que nunca se subieron). Sin este saneo el leak sobrevivía
        // por el camino de re-guardado aunque la rama de subida quedara limpia.
        const cleanedStory = stripInlineImageRefs(story);
        // Regenerate slides to ensure they have the correct URLs from storyData
        const regeneratedSlides = createPreviewSlideGroup(cleanedStory);
        console.log('[saveLiturgy] Cuentacuentos resave, regenerating slides to sync with storyData:', {
          hasSceneUrls: cleanedStory.scenes.some(s => s.selectedImageUrl?.startsWith('http')),
          slideCount: regeneratedSlides.slides.length,
        });
        return {
          ...element,
          slides: regeneratedSlides,
          config: { ...element.config, storyData: cleanedStory },
        };
      }

      return element;
    }));

    // Guardar elementos
    if (processedElements.length > 0) {
      // Upsert all elements by (liturgia_id, tipo) to avoid transient empty liturgies
      // caused by delete+insert and to keep save resilient against partial failures.
      const elementos = processedElements.map((e) => ({
        liturgia_id: liturgiaId,
        tipo: e.type === 'custom' ? `${CUSTOM_TIPO_PREFIX}${e.id}` : e.type,
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

      console.log('[saveLiturgy] Upserting', elementos.length, 'elementos');
      const { error: elementosError } = await supabase
        .from('liturgia_elementos')
        .upsert(elementos, { onConflict: 'liturgia_id,tipo' });

      if (elementosError) {
        console.error('[saveLiturgy] Error saving elementos:', elementosError);
        return { success: false, error: `Error guardando elementos: ${elementosError.message}` };
      } else {
        console.log('[saveLiturgy] Elementos saved successfully');
      }

      // Cleanup orphaned element rows that are no longer part of this save payload.
      // Run after upsert so reads never observe an empty liturgy during save.
      const currentTipos = elementos.map((e) => e.tipo);
      if (currentTipos.length > 0) {
        const escapedTipos = currentTipos.map((tipo) => `"${tipo.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        const notInFilter = `(${escapedTipos.join(',')})`;

        const { error: cleanupError } = await supabase
          .from('liturgia_elementos')
          .delete()
          .eq('liturgia_id', liturgiaId)
          .not('tipo', 'in', notInFilter);

        if (cleanupError) {
          console.error('[saveLiturgy] Error cleaning orphaned elementos:', cleanupError);
          return { success: false, error: `Error limpiando elementos obsoletos: ${cleanupError.message}` };
        }
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
    const { data: elementosData, error: elementosError } = await supabase
      .from('liturgia_elementos')
      .select('*')
      .eq('liturgia_id', id)
      .order('orden');

    if (elementosError) {
      console.error('Error loading liturgia elementos:', elementosError);
      return null;
    }

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
        reflexionPdfUrl: liturgiaData.reflexion_pdf_url || undefined,
        createdAt: liturgiaData.created_at,
        updatedAt: liturgiaData.updated_at,
      },
      elements: (elementosData || []).map((e: DBLiturgiaElemento) => ({
        id: e.tipo.startsWith(CUSTOM_TIPO_PREFIX) ? e.tipo.slice(CUSTOM_TIPO_PREFIX.length) : e.id,
        type: (e.tipo.startsWith(CUSTOM_TIPO_PREFIX) ? 'custom' : e.tipo) as LiturgyElement['type'],
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
