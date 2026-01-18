/**
 * Utilidades para manejo de imágenes de Cuentacuentos
 *
 * Este módulo centraliza el manejo de URLs de imágenes para el sistema de cuentacuentos.
 * El bucket 'cuentacuentos-drafts' es PÚBLICO, por lo tanto:
 * - Usamos getPublicUrl() en vez de createSignedUrl()
 * - Las URLs nunca expiran
 * - No requieren autenticación para acceder
 */

import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'cuentacuentos-drafts';

/**
 * Obtiene la URL pública de una imagen en el storage de cuentacuentos
 * @param path - Path relativo dentro del bucket (ej: "userId/liturgyId/scenes/scene1_0.png")
 * @returns URL pública que nunca expira
 */
export function getCuentacuentosPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Verifica si una URL ya es pública (no firmada)
 * @param url - URL a verificar
 * @returns true si es una URL pública
 */
export function isPublicUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('/object/public/');
}

/**
 * Verifica si una URL es una signed URL (que expira)
 * @param url - URL a verificar
 * @returns true si es una URL firmada
 */
export function isSignedUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('/object/sign/') || url.includes('?token=');
}

/**
 * Extrae el path del storage de una URL de Supabase
 * @param url - URL completa de Supabase Storage
 * @returns Path relativo o null si no se puede extraer
 */
export function extractStoragePath(url: string): string | null {
  if (!url) return null;

  // Patrón: .../cuentacuentos-drafts/userId/liturgyId/...
  const match = url.match(/cuentacuentos-drafts\/([^?]+)/);
  return match ? match[1] : null;
}

/**
 * Migra una URL firmada (signed) a una URL pública
 * Esta función es idempotente - si la URL ya es pública, la retorna sin cambios
 *
 * @param url - URL que puede ser firmada o pública
 * @returns URL pública equivalente
 */
export function migrateSignedUrlToPublic(url: string): string {
  if (!url) return url;

  // Si ya es pública, no hacer nada
  if (isPublicUrl(url)) return url;

  // Si es una data URL (base64), retornar sin cambios
  if (url.startsWith('data:')) return url;

  // Si no es una URL de Supabase, retornar sin cambios
  if (!url.includes('supabase') && !url.includes('/storage/v1/')) return url;

  // Convertir signed a public
  if (url.includes('/object/sign/')) {
    // Extraer path sin query params
    const cleanUrl = url.split('?')[0];
    return cleanUrl.replace('/object/sign/', '/object/public/');
  }

  // Si tiene query params de token, limpiarlos
  if (url.includes('?token=')) {
    return url.split('?')[0];
  }

  return url;
}

/**
 * Migra todas las URLs de imágenes en un slide de cuentacuento
 * @param slide - Slide con posible imageUrl
 * @returns Slide con URL migrada
 */
export function migrateSlideImageUrl<T extends { content?: { imageUrl?: string } }>(slide: T): T {
  if (!slide.content?.imageUrl) return slide;

  return {
    ...slide,
    content: {
      ...slide.content,
      imageUrl: migrateSignedUrlToPublic(slide.content.imageUrl),
    },
  };
}

/**
 * Migra todas las URLs de imágenes en un array de slides
 * @param slides - Array de slides
 * @returns Array con URLs migradas
 */
export function migrateAllSlideImageUrls<T extends { content?: { imageUrl?: string } }>(slides: T[]): T[] {
  return slides.map(migrateSlideImageUrl);
}

/**
 * Convierte un path de storage a URL pública si es necesario
 * Detecta automáticamente si es un path o una URL completa
 *
 * @param pathOrUrl - Path relativo o URL completa
 * @returns URL pública
 */
export function ensurePublicUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;

  // Si ya es una URL completa
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return migrateSignedUrlToPublic(pathOrUrl);
  }

  // Si es una data URL, retornar sin cambios
  if (pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }

  // Es un path relativo, convertir a URL pública
  return getCuentacuentosPublicUrl(pathOrUrl);
}
