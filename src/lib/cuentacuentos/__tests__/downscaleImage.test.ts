import { describe, it, expect } from 'vitest';
import { computeTargetSize, downscaleImage, readReferenceImageBase64 } from '../downscaleImage';

describe('computeTargetSize', () => {
  it('does not upscale an image already under the cap', () => {
    expect(computeTargetSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('leaves an image exactly at the cap untouched', () => {
    expect(computeTargetSize(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a landscape image by its longest edge', () => {
    expect(computeTargetSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait image by its longest edge', () => {
    expect(computeTargetSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('rounds the short edge rather than truncating it', () => {
    // 4032x3024 (iPhone 12MP, 4:3) -> 1600x1200 exactly.
    expect(computeTargetSize(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    // 4000x2250 (16:9) -> short edge 900.
    expect(computeTargetSize(4000, 2250, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('never collapses an extreme aspect ratio to a zero-width edge', () => {
    const out = computeTargetSize(20000, 5, 1600);
    expect(out.width).toBe(1600);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it('returns integral dimensions', () => {
    const out = computeTargetSize(3333, 1777, 1600);
    expect(Number.isInteger(out.width)).toBe(true);
    expect(Number.isInteger(out.height)).toBe(true);
  });

  it('treats a degenerate zero dimension as nothing to scale', () => {
    expect(computeTargetSize(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

/**
 * Estos casos cubren SÓLO la degradación, y lo hacen de forma honesta: jsdom
 * no trae backend de canvas ni decodifica imágenes, así que acá se ejecuta el
 * camino real de fallo, no un mock.
 *
 * Capacidades reales de este entorno, medidas (no supuestas). Reproducir con
 * un test temporal que imprima estos valores bajo `npx vitest run`:
 *   document.createElement('canvas').getContext('2d')  => null
 *                    ("Not implemented: HTMLCanvasElement's getContext()
 *                      method: without installing the canvas npm package")
 *   typeof createImageBitmap                           => "undefined"
 *   typeof OffscreenCanvas                             => "undefined"
 *   new Image() con un data URL PNG válido             => no dispara load NI
 *                                                         error (se cuelga)
 *
 * Por eso el redimensionado real (decode + drawImage + toDataURL) NO está
 * cubierto por esta suite y no puede estarlo sin añadir el paquete nativo
 * `canvas`. Ver la nota en el write-up.
 */
describe('downscaleImage — degradación cuando no se puede decodificar', () => {
  const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  function makeFile(type = 'image/jpeg', name = 'foto.jpg') {
    return new File([JPEG_BYTES], name, { type });
  }

  it('devuelve el data URL original sin tocar cuando la imagen no decodifica', async () => {
    const file = makeFile();
    const out = await downscaleImage(file, { decodeTimeoutMs: 50 });

    const expected = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });

    expect(out).toBe(expected);
  });

  it('resuelve en vez de rechazar: una referencia que falla no rompe la subida', async () => {
    await expect(downscaleImage(makeFile(), { decodeTimeoutMs: 50 })).resolves.toBeTypeOf('string');
  });

  it('conserva la forma data URL, que es lo que los call sites recortan', async () => {
    const out = await downscaleImage(makeFile(), { decodeTimeoutMs: 50 });
    expect(out.startsWith('data:image/jpeg;base64,')).toBe(true);
    // Los call sites hacen result.split(',')[1] y guardan base64 pelado.
    expect(out.split(',')[1]).toBeTruthy();
  });

  it('no se queda colgado esperando un decode que nunca llega', async () => {
    // Sin timeout interno, img.onload/onerror jamás disparan en jsdom y esta
    // promesa nunca se resolvería.
    const started = Date.now();
    await downscaleImage(makeFile(), { decodeTimeoutMs: 50 });
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

/**
 * Los tres sitios de subida del editor guardan base64 PELADO, no un data URL:
 * hacían `reader.result.split(',')[1]` cada uno por su cuenta. Esa forma es
 * fácil de romper en silencio — guardar el data URL entero produce una imagen
 * corrupta sin error visible — así que vive en un solo lugar y se prueba acá.
 */
describe('readReferenceImageBase64', () => {
  const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const makeFile = () => new File([JPEG_BYTES], 'foto.jpg', { type: 'image/jpeg' });

  it('devuelve base64 pelado, sin el prefijo data:', async () => {
    const out = await readReferenceImageBase64(makeFile(), { decodeTimeoutMs: 50 });
    expect(out.startsWith('data:')).toBe(false);
    expect(out).not.toContain(',');
  });

  it('devuelve exactamente el segmento base64 del data URL', async () => {
    const file = makeFile();
    const dataUrl = await downscaleImage(file, { decodeTimeoutMs: 50 });
    const out = await readReferenceImageBase64(file, { decodeTimeoutMs: 50 });
    expect(out).toBe(dataUrl.split(',')[1]);
  });

  it('produce base64 decodificable a los bytes originales cuando no hubo reescalado', async () => {
    const out = await readReferenceImageBase64(makeFile(), { decodeTimeoutMs: 50 });
    const decoded = Uint8Array.from(atob(out), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(JPEG_BYTES));
  });
});
