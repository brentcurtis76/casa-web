/**
 * Servicio para subir imágenes importadas a Supabase Storage.
 * Las imágenes se almacenan en el bucket público `liturgia-images`
 * bajo la ruta `${liturgyId}/imported/${uuid}.${ext}`.
 */

import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'liturgia-images';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

function extensionFor(file: File): string {
  const fromMime = EXT_BY_MIME[file.type];
  if (fromMime) return fromMime;
  const match = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  return match ? match[1].toLowerCase() : 'bin';
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UploadedImage {
  file: File;
  publicUrl: string;
}

export interface FailedImage {
  file: File;
  error: string;
}

/**
 * Sube un único archivo de imagen al bucket `liturgia-images`.
 * Lanza error si la validación o el upload falla.
 */
export async function uploadImportedImage(
  file: File,
  liturgyId: string
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('La imagen supera el límite de 50 MB.');
  }

  const ext = extensionFor(file);
  const path = `${liturgyId}/imported/${uuid()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(error.message || 'Error al subir imagen');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Sube varias imágenes en paralelo. Devuelve los uploads exitosos y los fallidos.
 * No lanza si alguna imagen falla — el caller decide cómo reportar errores.
 */
export async function uploadImportedImages(
  files: File[],
  liturgyId: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ uploaded: UploadedImage[]; failed: FailedImage[] }> {
  const uploaded: UploadedImage[] = [];
  const failed: FailedImage[] = [];
  let done = 0;

  await Promise.all(
    files.map(async (file) => {
      try {
        const publicUrl = await uploadImportedImage(file, liturgyId);
        uploaded.push({ file, publicUrl });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error desconocido';
        failed.push({ file, error: message });
      } finally {
        done += 1;
        onProgress?.(done, files.length);
      }
    })
  );

  return { uploaded, failed };
}
