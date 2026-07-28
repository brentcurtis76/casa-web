import { describe, it, expect } from 'vitest';
import { describeField, describeSkippedImage, refineErrorMessage, buildInvokeError } from '../imageFeedback';

/**
 * Los `field` reales que emiten las edge functions, tomados de los handlers
 * de FASE F (generate-story/handler.ts, generate-scene-images/handler.ts):
 *   characters[${i}].referenceImage
 *   landmarks[${i}].referenceImages[${j}]
 *   props[${i}].referenceImages[${j}]
 *   refine.sourceImage
 * Los índices son base 0; al usuario se le muestran base 1.
 */
describe('describeField', () => {
  it('nombra un personaje en base 1', () => {
    expect(describeField('characters[0].referenceImage')).toBe('el personaje 1');
  });

  it('nombra un lugar con el número de foto', () => {
    expect(describeField('landmarks[1].referenceImages[2]')).toBe('el lugar 2, foto 3');
  });

  it('nombra un objeto con el número de foto', () => {
    expect(describeField('props[0].referenceImages[1]')).toBe('el objeto 1, foto 2');
  });

  it('nombra la imagen a refinar', () => {
    expect(describeField('refine.sourceImage')).toBe('la imagen a refinar');
  });

  it('no inventa nada para un campo desconocido: lo devuelve tal cual', () => {
    expect(describeField('algoNuevo[3]')).toBe('algoNuevo[3]');
  });
});

describe('describeSkippedImage', () => {
  it('explica un formato no soportado y qué hacer', () => {
    const out = describeSkippedImage({ field: 'props[0].referenceImages[0]', code: 'NOT_IMAGE' });
    expect(out).toContain('el objeto 1, foto 1');
    expect(out).toMatch(/PNG, JPEG o WebP/);
  });

  it('trata NOT_USED como informativo, no como problema', () => {
    const out = describeSkippedImage({ field: 'props[0].referenceImages[3]', code: 'NOT_USED' });
    expect(out).toContain('no se usó');
    // No debe sonar a error ni pedirle nada al usuario.
    expect(out).not.toMatch(/error|falló|revisa/i);
  });

  it('atribuye los fallos de recuperación a una referencia borrada', () => {
    for (const code of ['FETCH_FAILED', 'FETCH_TIMEOUT', 'REDIRECT_REFUSED']) {
      const out = describeSkippedImage({ field: 'landmarks[0].referenceImages[0]', code });
      expect(out, code).toMatch(/no se pudo recuperar/);
    }
  });

  it('distingue una imagen muy pesada del conjunto muy pesado', () => {
    const one = describeSkippedImage({ field: 'props[0].referenceImages[0]', code: 'IMAGE_TOO_LARGE' });
    const all = describeSkippedImage({ field: 'props[0].referenceImages[0]', code: 'IMAGE_BUDGET_EXCEEDED' });
    expect(one).not.toBe(all);
    expect(all).toMatch(/en conjunto|todas/i);
  });

  it('degrada a una frase genérica ante un código que no conoce', () => {
    const out = describeSkippedImage({ field: 'props[0].referenceImages[0]', code: 'ALGO_NUEVO' });
    expect(out).toContain('el objeto 1, foto 1');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('refineErrorMessage', () => {
  it('para REFINE_SOURCE_UNAVAILABLE dice que la selección se conserva', () => {
    const out = refineErrorMessage('REFINE_SOURCE_UNAVAILABLE', 'refine.sourceImage', 'x');
    expect(out).toMatch(/se conserva|sigue seleccionada/i);
    expect(out).toMatch(/vuelve a|genera/i);
  });

  it('para NOT_IMAGE da un consejo distinto: es el formato', () => {
    const unavailable = refineErrorMessage('REFINE_SOURCE_UNAVAILABLE', 'refine.sourceImage', 'x');
    const notImage = refineErrorMessage('NOT_IMAGE', 'refine.sourceImage', 'x');
    expect(notImage).not.toBe(unavailable);
    expect(notImage).toMatch(/PNG, JPEG o WebP/);
  });

  it('para los códigos de tamaño habla de tamaño', () => {
    expect(refineErrorMessage('IMAGE_TOO_LARGE', 'refine.sourceImage', 'x')).toMatch(/pesa|tamaño/i);
    expect(refineErrorMessage('IMAGE_BUDGET_EXCEEDED', 'refine.sourceImage', 'x')).toMatch(/pesa|tamaño/i);
  });

  it('no secuestra un código que no es del refine', () => {
    expect(refineErrorMessage('NOT_IMAGE', 'props[0].referenceImages[0]', 'mensaje crudo')).toBeNull();
  });

  it('devuelve null cuando no hay código, para no tapar el mensaje del backend', () => {
    expect(refineErrorMessage(undefined, undefined, 'mensaje crudo')).toBeNull();
  });
});

/**
 * Envelope real de las edge functions (imageFetch.ts:1218 imageErrorResponse):
 *   { success:false, code, error, field, ...extra }  con status = err.status
 * 413 para tamaño, 422 para forma/procedencia.
 */
describe('buildInvokeError', () => {
  it('conserva el formato "Error <status>: <detalle>" para un error cualquiera', () => {
    const e = buildInvokeError(500, { error: 'Se cayó el proveedor' });
    expect(e.message).toBe('Error 500: Se cayó el proveedor');
  });

  it('usa solo el status cuando el cuerpo no trae detalle', () => {
    expect(buildInvokeError(502, {}).message).toBe('Error 502');
    expect(buildInvokeError(502, null).message).toBe('Error 502');
  });

  it('expone code y field para que la UI pueda ramificar', () => {
    const e = buildInvokeError(422, { code: 'NOT_IMAGE', field: 'props[0].referenceImages[0]', error: 'x' });
    expect(e.code).toBe('NOT_IMAGE');
    expect(e.field).toBe('props[0].referenceImages[0]');
    expect(e.status).toBe(422);
  });

  it('reemplaza el mensaje crudo por copy de refine cuando corresponde', () => {
    const e = buildInvokeError(422, {
      code: 'REFINE_SOURCE_UNAVAILABLE',
      field: 'refine.sourceImage',
      error: 'La imagen a refinar no está disponible.',
    });
    expect(e.message).toMatch(/se conserva/i);
    expect(e.message).not.toMatch(/^Error 422/);
  });

  it('no reemplaza el mensaje de un código que no es del refine', () => {
    const e = buildInvokeError(422, {
      code: 'NOT_IMAGE',
      field: 'props[0].referenceImages[0]',
      error: 'Formato no soportado.',
    });
    expect(e.message).toBe('Error 422: Formato no soportado.');
  });

  it('arrastra skippedImages incluso en una respuesta de error', () => {
    const e = buildInvokeError(413, {
      code: 'BODY_TOO_LARGE',
      error: 'x',
      skippedImages: [{ field: 'props[0].referenceImages[1]', code: 'NOT_USED' }],
    });
    expect(e.skippedImages).toEqual([{ field: 'props[0].referenceImages[1]', code: 'NOT_USED' }]);
  });

  it('ignora un skippedImages que no es un array de entradas válidas', () => {
    expect(buildInvokeError(500, { skippedImages: 'nope' }).skippedImages).toEqual([]);
    expect(buildInvokeError(500, { skippedImages: [{ field: 1 }] }).skippedImages).toEqual([]);
  });

  it('sigue siendo un Error de verdad, para que los catch existentes funcionen', () => {
    expect(buildInvokeError(500, {})).toBeInstanceOf(Error);
  });
});
