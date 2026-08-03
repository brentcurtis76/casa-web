/**
 * Reducción de imágenes de referencia en el navegador, antes de que entren al
 * estado del editor.
 *
 * Las fotos que sube el usuario son *referencias visuales* para un modelo de
 * imágenes, no arte final. Una foto de teléfono de 5 MB reducida a 1600 px de
 * lado mayor pesa ~400 KB y no pierde nada para ese propósito.
 *
 * Esto existe porque el techo real de la petición (~12 MB de fotos) se alcanza
 * con facilidad: la UI permite varias referencias de hasta 5 MB cada una, y una
 * vez codificadas en base64 dentro del JSON crecen ~33 %. Reducir acá hace que
 * el techo deje de importar, en vez de re-ajustar límites.
 */

/** Lado mayor por defecto, en píxeles. */
export const DEFAULT_MAX_EDGE = 1600;

/**
 * Tope de peso del archivo de ENTRADA, en MB.
 *
 * Ya no es un límite de transporte: lo que viaja es la versión reducida, no el
 * archivo. Queda sólo como guarda de seguridad del decode, para no intentar
 * rasterizar algo absurdo y colgar la pestaña. Por eso está alto: una foto de
 * teléfono moderna (10–25 MB) tiene que ENTRAR y salir reducida, que es
 * exactamente el caso para el que existe este módulo.
 */
export const MAX_REFERENCE_IMAGE_MB = 30;

/** El mismo tope en bytes, que es como llega `File.size`. */
export const MAX_REFERENCE_IMAGE_BYTES = MAX_REFERENCE_IMAGE_MB * 1024 * 1024;

/**
 * Copy del rechazo por peso, derivado del tope para que no se separen. Los tres
 * sitios de subida del editor lo comparten.
 */
export const REFERENCE_IMAGE_TOO_LARGE_MESSAGE = `La imagen es muy grande. Máximo ${MAX_REFERENCE_IMAGE_MB}MB`;

/** `true` si el archivo se pasa del tope y hay que rechazarlo sin leerlo. */
export function isReferenceImageTooLarge(file: File): boolean {
  return file.size > MAX_REFERENCE_IMAGE_BYTES;
}

/** Calidad por defecto para la recodificación con pérdida (JPEG/WebP). */
export const DEFAULT_QUALITY = 0.85;

export interface TargetSize {
  width: number;
  height: number;
}

/**
 * Calcula las dimensiones de destino conservando la relación de aspecto.
 *
 * Nunca amplía: si el lado mayor ya cabe en `maxEdge`, devuelve las
 * dimensiones originales sin tocar. El lado corto se redondea (no se trunca) y
 * nunca baja de 1 px, para que una relación de aspecto extrema no colapse a
 * una dimensión de cero — un canvas de ancho o alto 0 no se puede codificar.
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = DEFAULT_MAX_EDGE,
): TargetSize {
  // Dimensión degenerada: no hay nada que escalar y no queremos dividir por 0.
  if (!(width > 0) || !(height > 0)) return { width, height };

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Tiempo máximo de espera al decodificar antes de rendirse, en ms. */
export const DEFAULT_DECODE_TIMEOUT_MS = 15000;

export interface DownscaleOptions {
  /** Lado mayor de destino, en píxeles. */
  maxEdge?: number;
  /** Calidad de recodificación con pérdida, 0–1. */
  quality?: number;
  /** Corte de seguridad del decode. */
  decodeTimeoutMs?: number;
}

/**
 * Formato de salida.
 *
 * PNG y WebP se conservan porque pueden llevar canal alfa: recodificarlos a
 * JPEG aplastaría la transparencia sobre negro. Todo lo demás sale como JPEG,
 * que es donde está la ganancia de tamaño para fotos.
 *
 * Los tres formatos son los que aceptan las edge functions.
 */
function outputMimeType(inputType: string): string {
  if (inputType === 'image/png' || inputType === 'image/webp') return inputType;
  return 'image/jpeg';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Decodifica a un <img>, o devuelve null si no se puede.
 *
 * Se usa <img> a propósito, y no un rotado manual por EXIF: desde 2020 los
 * navegadores aplican la orientación EXIF al decodificar (`image-orientation:
 * from-image` es el valor inicial en CSS), de modo que `naturalWidth`/
 * `naturalHeight` y lo que dibuja `drawImage` ya vienen orientados. Rotar a
 * mano acá giraría la foto dos veces.
 */
function decodeImage(file: File, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    let settled = false;

    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    try {
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    } catch {
      finish(null);
    }
  });
}

/**
 * Reduce una imagen a `maxEdge` de lado mayor y devuelve un data URL.
 *
 * Degrada en vez de fallar: si la imagen no decodifica, si no hay canvas, o si
 * el resultado no sale más chico, devuelve el data URL original intacto. Sólo
 * rechaza si el archivo no se puede leer en absoluto.
 *
 * Una imagen que ya cabe en `maxEdge` se devuelve sin recodificar, para no
 * meter pérdida de generación donde no hace falta.
 */
export async function downscaleImage(file: File, options: DownscaleOptions = {}): Promise<string> {
  const {
    maxEdge = DEFAULT_MAX_EDGE,
    quality = DEFAULT_QUALITY,
    decodeTimeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
  } = options;

  const originalDataUrl = await readAsDataUrl(file);

  const img = await decodeImage(file, decodeTimeoutMs);
  if (!img) return originalDataUrl;

  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  const target = computeTargetSize(sourceWidth, sourceHeight, maxEdge);

  // Ya cabe: devolver los bytes originales sin recodificar.
  if (target.width === sourceWidth && target.height === sourceHeight) return originalDataUrl;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return originalDataUrl;

    ctx.drawImage(img, 0, 0, target.width, target.height);

    const encoded = canvas.toDataURL(outputMimeType(file.type), quality);
    if (!encoded || !encoded.startsWith('data:image/')) return originalDataUrl;

    // Nunca devolver algo más pesado que el original.
    return encoded.length < originalDataUrl.length ? encoded : originalDataUrl;
  } catch {
    return originalDataUrl;
  }
}

/**
 * Lo que consumen los sitios de subida del editor: reduce y devuelve base64
 * PELADO, sin el prefijo `data:...;base64,`.
 *
 * Ojo con la forma: estas referencias se guardan sin prefijo, y guardar el
 * data URL entero por error produce una imagen corrupta sin ningún error
 * visible. Por eso el recorte vive acá y no repetido en cada call site.
 */
export async function readReferenceImageBase64(
  file: File,
  options: DownscaleOptions = {},
): Promise<string> {
  const dataUrl = await downscaleImage(file, options);
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('No se pudo convertir la imagen a base64.');
  return base64;
}
