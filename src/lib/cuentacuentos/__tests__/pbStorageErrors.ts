/**
 * PB / G3 — formas de error de Storage CAPTURADAS de un runtime real.
 *
 * Procedencia (no inventadas — D7):
 *   runtime : supabase/storage-api v1.66.4, stack local DESECHABLE levantado
 *             con `supabase start` en 127.0.0.1:54821 (jamás el proyecto de
 *             producción: la captura aborta si el origen no es loopback)
 *   cliente : @supabase/storage-js 2.90.1 (= la versión fijada del repo)
 *   node    : v22.22.0
 *   fecha   : 2026-07-30
 *
 * Serialización literal del objeto devuelto por una segunda subida al MISMO
 * path con `upsert:false`:
 *
 *   {
 *     "name": "StorageApiError",
 *     "message": "The resource already exists",
 *     "status": 400,
 *     "statusCode": "409"
 *   }
 *   constructor: StorageApiError
 *   cadena de prototipos: StorageApiError → StorageError → Error → Object
 *   propiedades propias: message, __isStorageError, name, status, statusCode
 *   typeof statusCode === 'string'
 *
 * Control capturado en la misma corrida (bucket inexistente):
 *   { "name":"StorageApiError","message":"Bucket not found",
 *     "status":400,"statusCode":"404" }
 *
 * DOS HECHOS QUE ESTA CAPTURA FIJA Y QUE NINGUNA SUPOSICIÓN HABRÍA DADO:
 *  1. `status` vale 400 en AMBOS casos: no discrimina nada. Un clasificador
 *     que mirara `status === 409` no dispararía JAMÁS.
 *  2. `statusCode` es un STRING, no un número.
 */

export interface CapturedStorageError extends Error {
  __isStorageError: true;
  status: number;
  statusCode: string;
}

/** Reconstruye un error con la forma capturada, sin depender de la librería. */
export function makeCapturedStorageError(message: string, statusCode: string): CapturedStorageError {
  const err = new Error(message) as CapturedStorageError;
  err.name = 'StorageApiError';
  (err as { __isStorageError: boolean }).__isStorageError = true;
  err.status = 400;
  err.statusCode = statusCode;
  return err;
}

/** El conflicto de duplicado, exactamente como lo emitió el runtime. */
export const DUPLICATE_CONFLICT_ERROR = () =>
  makeCapturedStorageError('The resource already exists', '409');

/** Control: mismo texto, statusCode distinto ⇒ NO es conflicto. */
export const DUPLICATE_LIKE_MESSAGE_BUT_NOT_409 = () =>
  makeCapturedStorageError('The resource already exists', '500');

/** Control: statusCode 409 con texto opaco/otro idioma ⇒ SIGUE siendo conflicto. */
export const OPAQUE_409 = () => makeCapturedStorageError('Conflicto', '409');

/** Control capturado: bucket inexistente. */
export const BUCKET_NOT_FOUND_ERROR = () => makeCapturedStorageError('Bucket not found', '404');
