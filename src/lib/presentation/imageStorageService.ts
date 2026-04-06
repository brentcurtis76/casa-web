/**
 * Servicio de almacenamiento de imágenes para sesiones de presentación
 * Sube imágenes base64 a Supabase Storage para reducir el tamaño del JSONB en DB
 *
 * Feature: Prepared Presentation Handoff (CASA-PREP-HANDOFF)
 */

import { supabase } from '@/integrations/supabase/client';
import type { PresentationSessionState } from './types';

// Mismo bucket que usa videoService.ts
const STORAGE_BUCKET = 'presentation-media';

/**
 * Genera un hash de 8 caracteres a partir de una cadena (para nombres de archivo únicos)
 */
async function shortHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data.slice(0, 1000)); // Solo primeros 1000 chars para velocidad
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

/**
 * Sube una imagen base64 a Supabase Storage
 * Si el input ya es una URL, la devuelve sin cambios
 *
 * @param dataUrl - data URL (data:image/...) o URL HTTP existente
 * @returns URL pública del archivo en Storage, o el input original si ya es URL
 */
export async function uploadPresentationImage(dataUrl: string): Promise<string> {
  // Si ya es una URL HTTP, devolver tal cual
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // Extraer MIME type y datos base64
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!matches) {
    return dataUrl;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Convertir a Blob
  const byteCharacters = atob(base64Data);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  const blob = new Blob(byteArrays, { type: mimeType });

  // Extensión del archivo
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extMap[mimeType] ?? 'jpg';

  // Nombre único: timestamp + hash8
  const timestamp = Date.now();
  const hash = await shortHash(base64Data);
  const fileName = `images/${timestamp}-${hash}.${ext}`;

  // Subir a Supabase Storage
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, blob, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Recorre el estado de la sesión buscando data URLs base64 en:
 * - tempSlides[].content.imageUrl (slides de tipo imagen/anuncio-imagen)
 * - imageOverlayState.overlays[].imageUrl (overlays de imagen)
 *
 * Sube cada una a Storage y reemplaza con la URL pública.
 * Errores individuales se registran con console.warn — no detienen el guardado.
 *
 * @param state - Estado de sesión a procesar
 * @returns Nuevo estado con data URLs reemplazadas por URLs de Storage
 */
export async function extractAndUploadSessionImages(
  state: PresentationSessionState
): Promise<PresentationSessionState> {
  // Clonar el estado para no mutar el original
  const optimizedState: PresentationSessionState = {
    ...state,
    tempSlides: state.tempSlides ? [...state.tempSlides] : [],
    imageOverlayState: state.imageOverlayState
      ? {
          ...state.imageOverlayState,
          overlays: state.imageOverlayState.overlays
            ? [...state.imageOverlayState.overlays]
            : [],
        }
      : state.imageOverlayState,
  };

  // Procesar tempSlides
  if (optimizedState.tempSlides && optimizedState.tempSlides.length > 0) {
    const processedSlides = await Promise.all(
      optimizedState.tempSlides.map(async (slide) => {
        if (!slide.content) return slide;

        const updatedContent = { ...slide.content };

        // content.imageUrl (imagen de slides tipo imagen/anuncio-imagen)
        if (
          typeof updatedContent.imageUrl === 'string' &&
          updatedContent.imageUrl.startsWith('data:image/')
        ) {
          try {
            updatedContent.imageUrl = await uploadPresentationImage(updatedContent.imageUrl);
          } catch (err) {
            console.warn('[imageStorageService] Error al subir content.imageUrl de slide:', err);
          }
        }

        return { ...slide, content: updatedContent };
      })
    );
    optimizedState.tempSlides = processedSlides;
  }

  // Procesar imageOverlayState.overlays
  if (
    optimizedState.imageOverlayState?.overlays &&
    optimizedState.imageOverlayState.overlays.length > 0
  ) {
    const processedOverlays = await Promise.all(
      optimizedState.imageOverlayState.overlays.map(async (overlay) => {
        if (
          typeof overlay.imageUrl === 'string' &&
          overlay.imageUrl.startsWith('data:image/')
        ) {
          try {
            const uploadedUrl = await uploadPresentationImage(overlay.imageUrl);
            return { ...overlay, imageUrl: uploadedUrl };
          } catch (err) {
            console.warn('[imageStorageService] Error al subir imageUrl de overlay:', err);
          }
        }
        return overlay;
      })
    );
    optimizedState.imageOverlayState = {
      ...optimizedState.imageOverlayState,
      overlays: processedOverlays,
    };
  }

  return optimizedState;
}
