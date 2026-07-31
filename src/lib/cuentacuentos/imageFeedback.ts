/**
 * Copy en español para las imágenes que el backend descartó o rechazó.
 *
 * Las edge functions degradan en vez de fallar: un formato no soportado, una
 * referencia borrada del storage o una foto pasada del tope por campo se
 * omiten y la generación sigue. Sin decir nada, una referencia que faltó es
 * indistinguible de una que sí se usó — de ahí este módulo.
 *
 * Contrato (FASE F), en éxito y en fallo tipado:
 *   { success, code?, error?, field?, skippedImages: [{ field, code }] }
 */

export interface SkippedImage {
  field: string;
  code: string;
}

/** Índices que emiten los handlers son base 0; al usuario se le habla base 1. */
const FIELD_PATTERNS: ReadonlyArray<{ re: RegExp; label: (m: RegExpMatchArray) => string }> = [
  {
    re: /^characters\[(\d+)\]\.referenceImage$/,
    label: (m) => `el personaje ${Number(m[1]) + 1}`,
  },
  {
    re: /^landmarks\[(\d+)\]\.referenceImages\[(\d+)\]$/,
    label: (m) => `el lugar ${Number(m[1]) + 1}, foto ${Number(m[2]) + 1}`,
  },
  {
    re: /^props\[(\d+)\]\.referenceImages\[(\d+)\]$/,
    label: (m) => `el objeto ${Number(m[1]) + 1}, foto ${Number(m[2]) + 1}`,
  },
  { re: /^refine\.sourceImage$/, label: () => 'la imagen a refinar' },
];

/**
 * Nombre legible de un `field` del contrato. Si el campo no se reconoce se
 * devuelve tal cual: preferimos algo opaco pero cierto a una etiqueta
 * inventada que no corresponda a lo que el usuario ve en pantalla.
 */
export function describeField(field: string): string {
  for (const { re, label } of FIELD_PATTERNS) {
    const m = field.match(re);
    if (m) return label(m);
  }
  return field;
}

const REASONS: Readonly<Record<string, string>> = {
  NOT_USED: 'no se usó',
  NOT_IMAGE: 'su formato no es compatible (usa PNG, JPEG o WebP)',
  FETCH_FAILED: 'no se pudo recuperar; puede que se haya borrado',
  FETCH_TIMEOUT: 'no se pudo recuperar a tiempo',
  REDIRECT_REFUSED: 'no se pudo recuperar',
  IMAGE_TOO_LARGE: 'pesa más de lo permitido',
  IMAGE_BUDGET_EXCEEDED: 'entre todas las imágenes se pasan del peso permitido',
  INVALID_IMAGE_REF: 'la referencia no es válida',
};

/**
 * Frase para una imagen omitida: qué quedó fuera y por qué.
 *
 * `NOT_USED` es informativo — el handler no tenía ranura para esa foto — y se
 * redacta sin tono de error a propósito.
 */
export function describeSkippedImage(skipped: SkippedImage): string {
  const what = describeField(skipped.field);
  const why = REASONS[skipped.code] ?? 'no se pudo usar';
  return `${what}: ${why}.`;
}

const REFINE_FIELD = 'refine.sourceImage';

/**
 * Copy para un fallo de refine, o null si el error no es del refine.
 *
 * Devolver null deja pasar el mensaje que ya manda el backend, en vez de
 * taparlo con una redacción genérica.
 */
export function refineErrorMessage(
  code: string | undefined,
  field: string | undefined,
  _rawMessage: string,
): string | null {
  if (!code || field !== REFINE_FIELD) return null;

  switch (code) {
    case 'REFINE_SOURCE_UNAVAILABLE':
      return 'No pudimos recuperar la imagen que querías refinar. Tu selección se conserva: vuelve a elegirla o genera la imagen otra vez.';
    case 'NOT_IMAGE':
      return 'El formato de la imagen a refinar no es compatible. Usa PNG, JPEG o WebP.';
    case 'IMAGE_TOO_LARGE':
      return 'La imagen a refinar pesa más de lo permitido. Prueba con una versión más liviana.';
    case 'IMAGE_BUDGET_EXCEEDED':
      return 'La imagen a refinar se pasa del tamaño permitido para esta generación.';
    default:
      return null;
  }
}

/** Queda en pie sólo lo que tiene la forma del contrato. */
export function parseSkippedImages(value: unknown): SkippedImage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is SkippedImage =>
      !!s &&
      typeof s === 'object' &&
      typeof (s as SkippedImage).field === 'string' &&
      typeof (s as SkippedImage).code === 'string',
  );
}

/**
 * Degradación de la INVESTIGACIÓN, no de las imágenes de referencia.
 *
 * `skippedImages` dice "esta foto quedó fuera"; `warnings` dice "esta llamada de
 * investigación falló" o "la normalización descartó un elemento". Son canales
 * distintos con remedios distintos, y por eso no comparten estado ni aviso.
 *
 * Las fuentes son un conjunto CERRADO: una fuente nueva cambia el significado de
 * lo que se muestra, así que llegar a ella es un cambio de contrato, no un
 * detalle de implementación. Los códigos son lo contrario — deliberadamente
 * compatibles hacia adelante — porque la autoridad del texto es el `message` que
 * manda el servidor, no una tabla de códigos del cliente.
 */
export type WarningSource = 'location' | 'landmark' | 'prop' | 'story';

export interface EnvelopeWarning {
  source: WarningSource;
  code: string;
  message: string;
  httpStatus?: number;
  finishReason?: string;
}

const WARNING_SOURCES: ReadonlySet<string> = new Set<WarningSource>([
  'location',
  'landmark',
  'prop',
  'story',
]);

const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Único parser de `warnings` del cliente: lo llaman tanto `buildInvokeError`
 * (cuerpos de error) como los handlers de éxito y de vista previa.
 *
 * Queda en pie sólo lo que tiene la forma del contrato. Un opcional presente
 * pero mal formado invalida la ENTRADA entera en vez de descartarse solo: si el
 * borde mandó `httpStatus` y no es un número, lo que llegó no es el envelope que
 * creemos y renderizar la mitad sería peor que omitirla. Las propiedades que no
 * están en el contrato se ignoran y NO se copian — el aviso muestra texto del
 * servidor, y nada del request o del proveedor debe poder viajar de polizón.
 *
 * Se preservan ORDEN y MULTIPLICIDAD: el borde emite una entrada por resultado
 * fallido, así que dos props pueden producir el mismo `source`+`code` y ninguna
 * de las dos es un duplicado que se pueda borrar.
 */
export function parseWarnings(value: unknown): EnvelopeWarning[] {
  if (!Array.isArray(value)) return [];

  const out: EnvelopeWarning[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const w = raw as Record<string, unknown>;

    if (typeof w.source !== 'string' || !WARNING_SOURCES.has(w.source)) continue;
    if (!isNonBlankString(w.code) || !isNonBlankString(w.message)) continue;

    const { httpStatus, finishReason } = w;
    if (httpStatus !== undefined && !(typeof httpStatus === 'number' && Number.isFinite(httpStatus))) {
      continue;
    }
    if (finishReason !== undefined && typeof finishReason !== 'string') continue;

    out.push({
      source: w.source as WarningSource,
      code: w.code,
      message: w.message,
      ...(httpStatus !== undefined ? { httpStatus: httpStatus as number } : {}),
      ...(finishReason !== undefined ? { finishReason: finishReason as string } : {}),
    });
  }
  return out;
}

/** Error de invoke con los campos tipados del contrato a mano. */
export class InvokeError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;
  readonly skippedImages: SkippedImage[];
  readonly warnings: EnvelopeWarning[];

  constructor(
    message: string,
    status: number,
    code: string | undefined,
    field: string | undefined,
    skippedImages: SkippedImage[],
    warnings: EnvelopeWarning[],
  ) {
    super(message);
    this.name = 'InvokeError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.skippedImages = skippedImages;
    this.warnings = warnings;
  }
}

/**
 * Construye el Error a partir del status y el cuerpo ya parseado.
 *
 * El formato `Error <status>: <detalle>` se mantiene para todo lo que no sea
 * un fallo de refine: es lo que se venía mostrando y no hay motivo para
 * cambiarlo. Sólo el refine estrena copy propio, que es lo que pedía el ítem C.
 */
export function buildInvokeError(status: number, body: unknown): InvokeError {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === 'string' ? b.code : undefined;
  const field = typeof b.field === 'string' ? b.field : undefined;
  const detail = typeof b.error === 'string' ? b.error : '';
  const skippedImages = parseSkippedImages(b.skippedImages);
  // La degradación de investigación viaja en TODOS los envelopes de error
  // (400/422/502 tipados y el 500 genérico), así que se lee acá, en la única
  // costura por la que pasan los cuatro sitios de invoke.
  const warnings = parseWarnings(b.warnings);

  const friendly = refineErrorMessage(code, field, detail);
  const message = friendly ?? `Error ${status}${detail ? `: ${detail}` : ''}`;

  return new InvokeError(message, status, code, field, skippedImages, warnings);
}
