/**
 * B3 — El camino ráster del reductor, ejecutado de verdad.
 *
 * Los tests unitarios de `downscaleImage` corren en jsdom, que no tiene canvas
 * y nunca dispara el `load` de un <img>: `decodeImage` devuelve null y la
 * función degrada al original. O sea que `drawImage → toDataURL` —el trabajo
 * real— nunca se había ejecutado en ningún test.
 *
 * Acá se ejecuta en chromium real. Vite sirve el módulo transformado, así que
 * se importa el MISMO archivo que usa la app (sin login, sin montar el editor)
 * y se le pasa un File construido en la página.
 *
 * La imagen grande se dibuja con ruido a propósito: una imagen plana comprime
 * a casi nada en PNG y el reductor —que nunca devuelve algo más pesado que el
 * original— entregaría legítimamente los bytes originales, midiendo el guard
 * en vez del reescalado.
 */

import { test, expect } from '@playwright/test';

const MODULE_PATH = '/src/lib/cuentacuentos/downscaleImage.ts';

/** Resultado de pasar una imagen sintética por el helper, medido en la página. */
interface RoundTrip {
  sourceWidth: number;
  sourceHeight: number;
  originalBytes: number;
  outputBytes: number;
  outputWidth: number;
  outputHeight: number;
  identical: boolean;
}

test.describe('downscaleImage — camino ráster en chromium real', () => {
  test.beforeEach(async ({ page }) => {
    // Cualquier documento del mismo origen sirve: sólo se necesita que Vite
    // pueda resolver el módulo. No se toca la app ni se inicia sesión.
    await page.goto('/');
  });

  /**
   * Genera una imagen de `width`×`height` en `mime`, la pasa por
   * `readReferenceImageBase64` y mide entrada y salida. Todo ocurre en la
   * página.
   */
  async function roundTrip(
    page: import('@playwright/test').Page,
    width: number,
    height: number,
    mime: 'image/png' | 'image/jpeg' = 'image/png',
  ): Promise<RoundTrip> {
    return page.evaluate(
      async ([w, h, modulePath, mimeType]) => {
        const { readReferenceImageBase64 } = await import(/* @vite-ignore */ modulePath as string);

        // --- PNG sintético con ruido determinista -------------------------
        const canvas = document.createElement('canvas');
        canvas.width = w as number;
        canvas.height = h as number;
        const ctx = canvas.getContext('2d')!;
        // PRNG propio: `Math.random` haría el tamaño del PNG irrepetible.
        let seed = 123456789;
        const rand = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
        const img = ctx.createImageData(w as number, h as number);
        const px = img.data;
        for (let i = 0; i < px.length; i += 4) {
          px[i] = (rand() * 256) | 0;
          px[i + 1] = (rand() * 256) | 0;
          px[i + 2] = (rand() * 256) | 0;
          px[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);

        const blob: Blob = await new Promise((resolve) =>
          // Calidad 0.9 en JPEG, distinta de la 0.85 con que recodifica el
          // helper: si recodificara, los bytes cambiarían.
          canvas.toBlob((b) => resolve(b!), mimeType as string, 0.9),
        );
        const file = new File([blob], 'referencia', { type: mimeType as string });

        // --- Bytes originales, tal como los vería el helper ---------------
        const originalBase64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        // --- El helper REAL -----------------------------------------------
        const outputBase64: string = await readReferenceImageBase64(file);

        // --- Dimensiones de lo que salió ----------------------------------
        const decoded = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve({ width: el.naturalWidth, height: el.naturalHeight });
            el.onerror = () => reject(new Error('la salida no decodifica'));
            // El helper devuelve base64 PELADO; hay que reponer el prefijo.
            el.src = `data:${mimeType};base64,${outputBase64}`;
          },
        );

        const bytesOf = (b64: string) => Math.floor((b64.length * 3) / 4);

        return {
          sourceWidth: w as number,
          sourceHeight: h as number,
          originalBytes: bytesOf(originalBase64),
          outputBytes: bytesOf(outputBase64),
          outputWidth: decoded.width,
          outputHeight: decoded.height,
          identical: outputBase64 === originalBase64,
        };
      },
      [width, height, MODULE_PATH, mime] as const,
    );
  }

  test('una foto grande sale reducida a 1600 px de lado mayor y pesa mucho menos', async ({
    page,
  }) => {
    const r = await roundTrip(page, 3200, 2000);

    // Se ejecutó el reescalado: la salida NO son los bytes de entrada.
    expect(r.identical).toBe(false);

    // (a) lado mayor dentro del tope
    expect(Math.max(r.outputWidth, r.outputHeight)).toBeLessThanOrEqual(1600);
    expect(Math.max(r.outputWidth, r.outputHeight)).toBe(1600);
    // Relación de aspecto conservada: 3200×2000 ⇒ 1600×1000.
    expect(r.outputHeight).toBe(1000);

    // (b) bastante más liviana que la original
    expect(r.outputBytes).toBeLessThan(r.originalBytes * 0.5);
  });

  test('una foto chica vuelve idéntica: ni se amplía ni se recodifica', async ({ page }) => {
    const r = await roundTrip(page, 320, 240);

    expect(r.identical).toBe(true);
    expect(r.outputWidth).toBe(320);
    expect(r.outputHeight).toBe(240);
    expect(r.outputBytes).toBe(r.originalBytes);
  });

  /**
   * El caso PNG de arriba prueba el CONTRATO (vuelven los mismos bytes) pero no
   * puede probar el mecanismo: el encoder PNG de chromium es determinista y sin
   * pérdida, así que recodificar da exactamente los mismos bytes. En JPEG no:
   * el helper recodificaría a calidad 0.85 y el resultado sería distinto del
   * original a 0.9. Que vuelva idéntico es lo que demuestra que la imagen que
   * ya cabe NO pasa por el canvas.
   */
  test('un JPEG chico no se recodifica: vuelve con los bytes exactos', async ({ page }) => {
    const r = await roundTrip(page, 320, 240, 'image/jpeg');

    expect(r.identical).toBe(true);
    expect(r.outputBytes).toBe(r.originalBytes);
    expect(r.outputWidth).toBe(320);
    expect(r.outputHeight).toBe(240);
  });
});
