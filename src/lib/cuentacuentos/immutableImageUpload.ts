/**
 * PB / G2 — LA ÚNICA primitiva de subida inmutable de imágenes de
 * cuentacuentos.
 *
 * Problema que resuelve: hasta 185c370 los seis puntos de subida de
 * cuentacuentos escribían nombres POSICIONALES (`${key}_${index}.${ext}`) con
 * `upsert: true`. Dos fotos distintas que caen en el mismo índice se pisan, y
 * los bytes viejos se pierden para siempre — incluso si una liturgia ya
 * guardada los referencia.
 *
 * PB los vuelve DIRECCIONADOS POR CONTENIDO e INMUTABLES:
 *   - el nombre incluye los primeros 32 hex de SHA-256 sobre los bytes
 *     DECODIFICADOS ⇒ bytes distintos ⇒ objeto distinto, nunca un overwrite;
 *   - `upsert: false` ⇒ el borde rechaza el overwrite en vez de ejecutarlo;
 *   - un conflicto de duplicado es ÉXITO IDEMPOTENTE: mismo path significa
 *     los mismos bytes, así que el objeto que ya está ahí es exactamente el
 *     que íbamos a escribir.
 *
 * Toda la lógica vive acá: no puede haber una segunda implementación de
 * hashing/sniffing/subida en el código de producción (T-B.8).
 */

import { supabase } from '@/integrations/supabase/client';

export const CUENTACUENTOS_DRAFTS_BUCKET = 'cuentacuentos-drafts';
export const LITURGIA_IMAGES_BUCKET = 'liturgia-images';

export type ImmutableBucket =
  | typeof CUENTACUENTOS_DRAFTS_BUCKET
  | typeof LITURGIA_IMAGES_BUCKET;

/** Tipos admitidos por la allowlist MIME del bucket de drafts. */
export type SniffedImageType = 'image/png' | 'image/jpeg' | 'image/webp';

export type ImmutableUploadFailureCode =
  /** Entrada vacía o no-string. */
  | 'EMPTY_INPUT'
  /** El payload no es base64 válido. */
  | 'INVALID_BASE64'
  /** Los bytes no son PNG/JPEG/WebP (jamás se asume PNG por defecto). */
  | 'UNSUPPORTED_IMAGE'
  /** Storage devolvió un error que NO es un conflicto de duplicado. */
  | 'STORAGE_ERROR';

/**
 * Fallo de la primitiva. Es un ERROR, no un `null`: PB es fail-closed y el
 * llamador debe abortar su escritura lógica, no compactar y seguir.
 */
export class ImmutableUploadError extends Error {
  readonly code: ImmutableUploadFailureCode;
  readonly storageError?: unknown;

  constructor(code: ImmutableUploadFailureCode, message: string, storageError?: unknown) {
    super(message);
    this.name = 'ImmutableUploadError';
    this.code = code;
    this.storageError = storageError;
  }
}

export interface ImmutableUploadResult {
  /** Path determinista dentro del bucket. */
  path: string;
  /** URL pública resuelta por el propio SDK. */
  publicUrl: string;
  /** Primeros 32 hex (minúscula) de SHA-256 sobre los bytes decodificados. */
  hash32: string;
  contentType: SniffedImageType;
  extension: 'png' | 'jpg' | 'webp';
  /**
   * `true` cuando el objeto YA existía (conflicto 409). Es éxito idempotente,
   * NO prueba de que esta llamada haya creado el objeto.
   */
  deduplicated: boolean;
}

// ---------------------------------------------------------------------------
// Decodificación
// ---------------------------------------------------------------------------

/**
 * Quita el prefijo `data:<mime>;base64,` si está presente. La declaración de
 * MIME del prefijo se DESCARTA: la verdad la dan los magic bytes.
 */
export function stripDataUrlPrefix(input: string): string {
  if (!input.startsWith('data:')) return input;
  const comma = input.indexOf(',');
  return comma === -1 ? '' : input.slice(comma + 1);
}

/**
 * Decodifica base64 de forma ESTRICTA. `atob` por sí solo es tolerante con
 * basura; acá se valida el alfabeto y el largo antes de decodificar para que
 * una entrada corrupta falle en vez de producir bytes arbitrarios.
 */
export function decodeBase64Strict(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s/g, '');
  if (cleaned.length === 0) {
    throw new ImmutableUploadError('EMPTY_INPUT', 'La imagen no tiene contenido.');
  }
  if (cleaned.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    throw new ImmutableUploadError('INVALID_BASE64', 'La imagen no es base64 válido.');
  }
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new ImmutableUploadError('INVALID_BASE64', 'La imagen no es base64 válido.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// MIME por magic bytes
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Determina el tipo por MAGIC BYTES. Devuelve `null` para cualquier cosa que
 * no sea PNG/JPEG/WebP — nunca un default a PNG (ése era el bug de la base:
 * subía GIF y WebP etiquetados como `image/png`).
 */
export function sniffImageType(
  bytes: Uint8Array
): { contentType: SniffedImageType; extension: 'png' | 'jpg' | 'webp' } | null {
  if (startsWithBytes(bytes, PNG_SIGNATURE)) {
    return { contentType: 'image/png', extension: 'png' };
  }
  // JPEG: FF D8 FF
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }
  // WebP: contenedor RIFF con el tag WEBP en el offset 8.
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * SHA-256 sobre los bytes DECODIFICADOS, truncado a 32 hex en minúscula.
 *
 * Se hashean los bytes, NO la cadena base64 ni el Blob: así el mismo PNG
 * envuelto en data URLs con prefijos distintos produce el mismo nombre.
 *
 * Usa WebCrypto (`crypto.subtle`), verificado disponible en el runtime real de
 * Vitest/jsdom de este repo. `Blob.arrayBuffer()` NO existe en ese jsdom, por
 * eso se digiere el `Uint8Array` directamente.
 */
export async function sha256Hex32(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new ImmutableUploadError(
      'UNSUPPORTED_IMAGE',
      'WebCrypto SHA-256 no está disponible en este entorno.'
    );
  }
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
  return hex.slice(0, 32);
}

// ---------------------------------------------------------------------------
// Clasificación del conflicto de duplicado (G3)
// ---------------------------------------------------------------------------

/**
 * ¿Es este error el conflicto de duplicado de Storage?
 *
 * La clasificación es ESTRUCTURAL y se apoya en una forma CAPTURADA de un
 * runtime real NO productivo (storage-api v1.66.4 en un stack local
 * desechable, `@supabase/storage-js` 2.90.1):
 *
 *   StorageApiError {
 *     name: 'StorageApiError', __isStorageError: true,
 *     message: 'The resource already exists',
 *     status: 400,          // ← OJO: 400, NO 409
 *     statusCode: '409'     // ← string, éste es el discriminante
 *   }
 *
 * Dos trampas que esta función evita a propósito:
 *  1. `status` vale 400 tanto para el duplicado como para "Bucket not found"
 *     (statusCode '404'), así que NO discrimina.
 *  2. El texto del mensaje está en inglés y no es contrato (D7): nunca se
 *     compara contra él.
 */
export function isDuplicateConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === '409' || statusCode === 409;
}

// ---------------------------------------------------------------------------
// Núcleo
// ---------------------------------------------------------------------------

/** ¿El valor es una referencia HTTP(S) ya persistida? Nunca entra a la primitiva. */
export function isHttpReference(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

interface CoreInput {
  bucket: ImmutableBucket;
  /** Prefijo INTERNO del path; jamás proviene del usuario. */
  prefix: string;
  /** Clave semántica del slot (characterId, `scene3`, `cover`, …). */
  key: string;
  /** base64 crudo o data URL. */
  data: string;
}

async function uploadImmutable(input: CoreInput): Promise<ImmutableUploadResult> {
  const { bucket, prefix, key, data } = input;

  if (typeof data !== 'string' || data.length === 0) {
    throw new ImmutableUploadError('EMPTY_INPUT', 'La imagen no tiene contenido.');
  }

  const bytes = decodeBase64Strict(stripDataUrlPrefix(data));

  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    throw new ImmutableUploadError(
      'UNSUPPORTED_IMAGE',
      'El formato de la imagen no es compatible (se admiten PNG, JPEG y WebP).'
    );
  }

  const hash32 = await sha256Hex32(bytes);
  const path = `${prefix}/${key}_${hash32}.${sniffed.extension}`;
  const blob = new Blob([bytes as unknown as BlobPart], { type: sniffed.contentType });

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: sniffed.contentType, upsert: false });

  let deduplicated = false;
  if (error) {
    if (!isDuplicateConflict(error)) {
      throw new ImmutableUploadError(
        'STORAGE_ERROR',
        'No se pudo guardar la imagen en el almacenamiento.',
        error
      );
    }
    // Direccionado por contenido: mismo path ⇒ mismos bytes. El objeto que ya
    // está ahí ES el que íbamos a escribir.
    deduplicated = true;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path,
    publicUrl: urlData.publicUrl,
    hash32,
    contentType: sniffed.contentType,
    extension: sniffed.extension,
    deduplicated,
  };
}

// ---------------------------------------------------------------------------
// Entradas públicas (el llamador NO elige bucket)
// ---------------------------------------------------------------------------

/**
 * Borrador de cuentacuentos. El path conserva `userId` como PRIMER segmento:
 * la policy RLS de `cuentacuentos-drafts` es own-first-folder, así que ésta es
 * la única forma compatible sin cambios de DDL.
 */
export function uploadImmutableDraftImage(input: {
  userId: string;
  liturgyId: string;
  category: string;
  key: string;
  data: string;
}): Promise<ImmutableUploadResult> {
  return uploadImmutable({
    bucket: CUENTACUENTOS_DRAFTS_BUCKET,
    prefix: `${input.userId}/${input.liturgyId}/${input.category}`,
    key: input.key,
    data: input.data,
  });
}

/** Imagen finalizada de una liturgia (`liturgia-images`, INSERT admin-only). */
export function uploadImmutableFinalImage(input: {
  liturgyId: string;
  category: string;
  key: string;
  data: string;
}): Promise<ImmutableUploadResult> {
  return uploadImmutable({
    bucket: LITURGIA_IMAGES_BUCKET,
    prefix: `liturgias/${input.liturgyId}/cuentacuentos/${input.category}`,
    key: input.key,
    data: input.data,
  });
}
