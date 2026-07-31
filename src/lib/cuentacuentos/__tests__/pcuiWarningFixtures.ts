/**
 * PC-UI — copy y envelopes CAPTURADOS del contrato de borde, no redactados acá.
 *
 * D5: las expectativas se toman de la fuente de producción vigente, nunca se
 * escriben a mano. Todo lo de este módulo sale de
 * `phase/pb-storage-edge`@`10d1190321246595de14d55815804900670c1983` leído con
 * `git show`, con la referencia de línea al lado de cada valor:
 *
 *   - `WARNING_REASONS`            handler.ts :672-680
 *   - `WARNING_SOURCES`            handler.ts :682-686
 *   - `warningMessage()`           handler.ts :702-705
 *       `${WARNING_REASONS[code]} en ${WARNING_SOURCES[source]}. ` +
 *       'No se pudo incorporar esa información.'
 *   - `STORY_WARNING_MESSAGES`     handler.ts :147-150
 *   - `typedErrorResponse`         handler.ts :1385-1404  (400/422/502)
 *   - envelope genérico 500        handler.ts :1925-1941
 *   - detalle del 400              imageFetch.ts :395 vía handler.ts :1493
 *   - `imageErrorResponse`         imageFetch.ts :1480-1498 (422 top-level)
 *
 * El cliente NO re-deriva ninguna de estas frases: las renderiza verbatim. Por
 * eso viven acá una sola vez y las dos suites (parser y editor) comparten el
 * mismo texto — si el borde cambiara su copy, las dos caen juntas.
 */

/** `warningMessage(source, code)` del handler, reproducido por su fórmula. */
const WARNING_REASONS = {
  NO_API_KEY: 'Falta la configuración del servicio de investigación visual',
  MODEL_NOT_FOUND: 'El modelo de investigación visual no está disponible',
  PROVIDER_HTTP_ERROR: 'El servicio de investigación visual respondió con un error',
  PROVIDER_UNAVAILABLE: 'El servicio de investigación visual no respondió',
  EMPTY_RESPONSE: 'El servicio de investigación visual no devolvió texto',
  OUTPUT_TRUNCATED: 'La investigación visual quedó cortada por el límite de tokens',
  OUTPUT_BLOCKED: 'El servicio de investigación visual no completó la respuesta',
} as const;

const WARNING_SOURCES = {
  location: 'la investigación del lugar',
  landmark: 'el análisis de las fotos del lugar destacado',
  prop: 'el análisis de las fotos de un elemento recurrente',
} as const;

export type ResearchFailureCode = keyof typeof WARNING_REASONS;
export type ResearchSource = keyof typeof WARNING_SOURCES;

/** La MISMA fórmula del handler (:702-705). */
export function serverWarningMessage(
  source: ResearchSource,
  code: ResearchFailureCode,
): string {
  return `${WARNING_REASONS[code]} en ${WARNING_SOURCES[source]}. ` +
    'No se pudo incorporar esa información.';
}

/** Copy fija de la normalización (handler :147-150). */
export const PROP_NOT_RECURRING_MESSAGE =
  'Se omitió un elemento recurrente porque aparece en menos de dos escenas válidas.';

/** Un warning de investigación tal cual lo emite `toWarning` (handler :707-717). */
export function researchWarning(
  source: ResearchSource,
  code: ResearchFailureCode,
  extra: { httpStatus?: number; finishReason?: string } = {},
): Record<string, unknown> {
  return {
    source,
    code,
    message: serverWarningMessage(source, code),
    ...(extra.httpStatus !== undefined ? { httpStatus: extra.httpStatus } : {}),
    ...(extra.finishReason !== undefined ? { finishReason: extra.finishReason } : {}),
  };
}

/** El warning de normalización (handler :152-154). */
export function storyWarning(): Record<string, unknown> {
  return {
    source: 'story',
    code: 'PROP_NOT_RECURRING',
    message: PROP_NOT_RECURRING_MESSAGE,
  };
}

/**
 * Detalle español ÚNICO del 400 `CLIENT_INPUT_INVALID`: es el `err.message` de
 * la `ImageRefError` de cuerpo (`imageFetch.ts` :395) que `handler.ts` :1493
 * re-tipa a `ClientInputError(400, …)`.
 */
export const CLIENT_INPUT_INVALID_400_DETAIL =
  'El cuerpo de la petición no es JSON válido.';

/** Mensaje de una `ImageRefError` de referencia (imageFetch.ts :513). */
export const INVALID_IMAGE_REF_DETAIL =
  'La referencia de imagen está vacía o no es texto.';

/** Envelope tipado 400/422/502 (handler :1385-1404). Claves ausentes si vacías. */
export function typedErrorBody(params: {
  code: 'PROVIDER_OUTPUT_INVALID' | 'CLIENT_INPUT_INVALID';
  error: string;
  skippedImages?: Array<{ field: string; code: string }>;
  warnings?: unknown[];
}): Record<string, unknown> {
  const { code, error, skippedImages = [], warnings = [] } = params;
  return {
    success: false,
    code,
    error,
    ...(skippedImages.length > 0 ? { skippedImages } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/** Envelope genérico 500 (handler :1925-1941): sin `code`. */
export function genericErrorBody(params: {
  error: string;
  skippedImages?: Array<{ field: string; code: string }>;
  warnings?: unknown[];
}): Record<string, unknown> {
  const { error, skippedImages = [], warnings = [] } = params;
  return {
    success: false,
    error,
    ...(skippedImages.length > 0 ? { skippedImages } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/** Envelope de `imageErrorResponse` (imageFetch.ts :1480-1498): trae `field`. */
export function imageRefErrorBody(params: {
  code: string;
  error: string;
  field: string;
}): Record<string, unknown> {
  return { success: false, code: params.code, error: params.error, field: params.field };
}
