/**
 * Servicio para subir imágenes importadas al bucket público de Supabase Storage.
 *
 * Reemplaza el almacenamiento previo de data URLs base64 en la columna
 * `liturgia_elementos.slides` (JSONB) que inflaba enormemente las filas.
 */

import { supabase } from '@/integrations/supabase/client';

export const LITURGIA_IMAGES_BUCKET = 'liturgia-images';

export interface UploadedImage {
  publicUrl: string;
  storagePath: string;
  originalName: string;
}

export interface UploadFailure {
  originalName: string;
  error: string;
}

export interface UploadImagesResult {
  uploaded: UploadedImage[];
  failures: UploadFailure[];
}

function inferExtension(file: File): string {
  const fromName = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase()
    : '';
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) {
    return fromName;
  }
  const fromMime = file.type?.split('/')?.[1];
  if (fromMime && /^[a-z0-9+-]{2,10}$/i.test(fromMime)) {
    return fromMime === 'jpeg' ? 'jpg' : fromMime;
  }
  return 'bin';
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback unlikely to be reached in browsers we target
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Sube una imagen al bucket `liturgia-images` bajo la ruta
 *   `${liturgyId}/imported/${uuid}.${ext}`
 *
 * Retorna la URL pública o lanza un Error con el mensaje del fallo.
 */
export async function uploadImportedImage(
  file: File,
  liturgyId: string
): Promise<UploadedImage> {
  const ext = inferExtension(file);
  const storagePath = `${liturgyId}/imported/${generateId()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(LITURGIA_IMAGES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(LITURGIA_IMAGES_BUCKET)
    .getPublicUrl(storagePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error('No se obtuvo URL pública para la imagen');
  }

  return {
    publicUrl: publicUrlData.publicUrl,
    storagePath,
    originalName: file.name,
  };
}

/**
 * Sube múltiples imágenes en paralelo, devolviendo éxitos y fallas por separado.
 * Los fallos no abortan el proceso; cada archivo se reporta individualmente.
 */
export async function uploadImportedImages(
  files: File[],
  liturgyId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<UploadImagesResult> {
  const total = files.length;
  let completed = 0;
  const uploaded: UploadedImage[] = [];
  const failures: UploadFailure[] = [];

  const tasks = files.map(async (file) => {
    try {
      const result = await uploadImportedImage(file, liturgyId);
      uploaded.push(result);
    } catch (err) {
      failures.push({
        originalName: file.name,
        error: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      completed += 1;
      onProgress?.(completed, total);
    }
  });

  await Promise.all(tasks);
  return { uploaded, failures };
}
