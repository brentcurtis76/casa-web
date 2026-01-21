/**
 * Servicio para manejo de videos en el sistema de presentación CASA
 * Soporta upload de archivos y validación de URLs
 */

import { supabase } from '@/integrations/supabase/client';

// Tipos de video soportados
const VALID_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Tamaño máximo de archivo: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Bucket de Supabase Storage para medios de presentación
const STORAGE_BUCKET = 'presentation-media';

/**
 * Valida un archivo de video
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo de archivo
  if (!VALID_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de video no soportado. Use MP4, WebM o MOV.',
    };
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Video demasiado grande. Máximo 100MB.',
    };
  }

  return { valid: true };
}

/**
 * Sube un archivo de video a Supabase Storage
 * @param file - Archivo de video a subir
 * @returns URL pública del video subido
 */
export async function uploadVideo(file: File): Promise<string> {
  // Validar archivo
  const validation = validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generar nombre único
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `videos/${timestamp}-${sanitizedName}`;

  // Subir a Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading video:', error);
    throw new Error(`Error al subir video: ${error.message}`);
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Valida una URL de video (YouTube, Vimeo, o URL directa)
 * @param url - URL a validar
 * @returns true si es una URL de video válida
 */
export function validateVideoUrl(url: string): { valid: boolean; type: 'youtube' | 'vimeo' | 'direct' | null; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // YouTube
    if (
      parsedUrl.hostname === 'www.youtube.com' ||
      parsedUrl.hostname === 'youtube.com' ||
      parsedUrl.hostname === 'youtu.be'
    ) {
      // Verificar que tiene un video ID válido
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return { valid: true, type: 'youtube' };
      }
      return { valid: false, type: null, error: 'URL de YouTube inválida' };
    }

    // Vimeo
    if (
      parsedUrl.hostname === 'www.vimeo.com' ||
      parsedUrl.hostname === 'vimeo.com' ||
      parsedUrl.hostname === 'player.vimeo.com'
    ) {
      return { valid: true, type: 'vimeo' };
    }

    // URL directa (debe terminar en extensión de video)
    const videoExtensions = ['.mp4', '.webm', '.mov', '.ogg', '.m4v'];
    const pathname = parsedUrl.pathname.toLowerCase();
    if (videoExtensions.some(ext => pathname.endsWith(ext))) {
      return { valid: true, type: 'direct' };
    }

    // Asumir URL directa si tiene protocolo válido
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      return { valid: true, type: 'direct' };
    }

    return { valid: false, type: null, error: 'URL no válida' };
  } catch {
    return { valid: false, type: null, error: 'URL mal formada' };
  }
}

/**
 * Extrae el ID de video de una URL de YouTube
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    // Formato: youtube.com/watch?v=VIDEO_ID
    if (parsedUrl.hostname.includes('youtube.com')) {
      return parsedUrl.searchParams.get('v');
    }

    // Formato: youtu.be/VIDEO_ID
    if (parsedUrl.hostname === 'youtu.be') {
      return parsedUrl.pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extrae el ID de video de una URL de Vimeo
 */
export function extractVimeoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    // Formato: vimeo.com/VIDEO_ID
    if (parsedUrl.hostname.includes('vimeo.com')) {
      const match = parsedUrl.pathname.match(/\/(\d+)/);
      return match ? match[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convierte una URL de YouTube/Vimeo a URL embebible
 */
export function getEmbedUrl(url: string): string | null {
  const validation = validateVideoUrl(url);

  if (!validation.valid) return null;

  if (validation.type === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1`;
    }
  }

  if (validation.type === 'vimeo') {
    const videoId = extractVimeoId(url);
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId}?autoplay=1&controls=0`;
    }
  }

  // Para URLs directas, retornar la misma URL
  return url;
}

/**
 * Obtiene la URL de thumbnail para un video de YouTube
 */
export function getYouTubeThumbnail(url: string): string | null {
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return null;
}

/**
 * Formatea duración en segundos a formato MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parsea una cadena de tiempo (MM:SS o SS) a segundos
 */
export function parseTimeString(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 1) {
    return parts[0] || 0;
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}
