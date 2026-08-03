/**
 * PB — fixtures de bytes de imagen reales, compartidos por la captura de
 * comportamiento base (G6) y las suites de la fase.
 *
 * Los tres formatos son los que el bucket `cuentacuentos-drafts` admite en su
 * allowlist MIME (png/jpeg/webp, verificado por SQL de solo-lectura el
 * 2026-07-30). Cada constante es base64 CRUDO (sin prefijo data-URL): ésa es la
 * forma en que el editor entrega las imágenes generadas al hook — los data URL
 * se cubren aparte, con las variantes `*_DATA_URL`.
 *
 * Los bytes son imágenes válidas de 1x1, no cabeceras inventadas:
 *  - PNG  — firma 89 50 4E 47 0D 0A 1A 0A
 *  - JPEG — firma FF D8 FF
 *  - WebP — contenedor RIFF....WEBP + chunk `VP8 ` (verificado con file(1):
 *           "RIFF (little-endian) data, Web/P image, VP8 encoding, 1x1")
 */

/** PNG 1x1. */
export const PNG_A_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==';

/** PNG 1x1 con bytes DISTINTOS a `PNG_A_B64` (otro color) → otro hash. */
export const PNG_B_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+M/wHwAEAQH/rrVV9QAAAABJRU5ErkJggg==';

/** Tercer PNG 1x1 distinto — para sitios que exigen fixtures por-sitio. */
export const PNG_C_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYPj/HwADAgH/OSkZvgAAAABJRU5ErkJggg==';

/** Cuarto PNG 1x1 distinto. */
export const PNG_D_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4/5/hPwAH/QL+ecrXpAAAAABJRU5ErkJggg==';

/** Quinto PNG 1x1 distinto. */
export const PNG_E_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNg+P//PwAF/wL+gVApvQAAAABJRU5ErkJggg==';

/** JPEG 1x1 (firma FF D8 FF). */
export const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/** WebP 1x1 (RIFF/WEBP + chunk `VP8 `). */
export const WEBP_B64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

/**
 * Bytes que NO son ninguno de los tres formatos admitidos (GIF87a). Sirven
 * para T-B.11: sniff desconocido ⇒ rechazo, jamás un default a PNG.
 */
export const GIF_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Base64 sintácticamente inválido (carácter fuera del alfabeto). */
export const INVALID_B64 = 'not-base64!!!***';

/** El MISMO PNG que `PNG_A_B64`, envuelto en data URL con MIME correcto. */
export const PNG_A_DATA_URL = `data:image/png;base64,${PNG_A_B64}`;

/**
 * El MISMO PNG que `PNG_A_B64`, pero DECLARADO como jpeg en el prefijo data
 * URL. La verdad la dan los magic bytes, no la declaración: debe resolver a
 * `image/png` y AL MISMO hash que `PNG_A_B64` (el hash es sobre bytes
 * decodificados). Es el fixture central de T-B.3 y T-B.4.
 */
export const PNG_A_DATA_URL_LYING = `data:image/jpeg;base64,${PNG_A_B64}`;

/** URL pública existente (drafts) — nunca debe entrar a la primitiva. */
export const EXISTING_DRAFTS_URL =
  'https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/user-pb/lit-pb/characters/char1_0.png';

/** URL pública existente de `liturgia-images` (producto de finalización). */
export const EXISTING_LITURGIA_URL =
  'https://mock.supabase.co/storage/v1/object/public/liturgia-images/liturgias/lit-pb/cuentacuentos/cover/cover.png';
