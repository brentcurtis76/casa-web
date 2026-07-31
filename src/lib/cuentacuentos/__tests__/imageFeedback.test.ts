import { describe, it, expect } from 'vitest';
import {
  describeField,
  describeSkippedImage,
  refineErrorMessage,
  buildInvokeError,
  parseWarnings,
} from '../imageFeedback';
import {
  researchWarning,
  storyWarning,
  serverWarningMessage,
  PROP_NOT_RECURRING_MESSAGE,
  typedErrorBody,
  genericErrorBody,
  CLIENT_INPUT_INVALID_400_DETAIL,
} from './pcuiWarningFixtures';

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

// ---------------------------------------------------------------------------
// PC-UI / T-U.1 — contrato del parser de `warnings`
//
// Las fuentes son un conjunto CERRADO (`location|landmark|prop|story`): una
// fuente nueva cambia el significado de la UI. Los códigos, en cambio, son
// deliberadamente compatibles hacia adelante — cualquier código no vacío de una
// fuente conocida se acepta, porque el `message` DEL SERVIDOR es la autoridad y
// el cliente no tiene tabla de códigos.
// ---------------------------------------------------------------------------

describe('parseWarnings', () => {
  it('acepta las dos formas del borde: ResponseWarning y StoryWarning', () => {
    const research = researchWarning('landmark', 'PROVIDER_HTTP_ERROR');
    const story = storyWarning();
    expect(parseWarnings([research, story])).toEqual([
      {
        source: 'landmark',
        code: 'PROVIDER_HTTP_ERROR',
        message: serverWarningMessage('landmark', 'PROVIDER_HTTP_ERROR'),
      },
      { source: 'story', code: 'PROP_NOT_RECURRING', message: PROP_NOT_RECURRING_MESSAGE },
    ]);
  });

  it('acepta las cuatro fuentes conocidas', () => {
    const entries = [
      researchWarning('location', 'NO_API_KEY'),
      researchWarning('landmark', 'EMPTY_RESPONSE'),
      researchWarning('prop', 'OUTPUT_TRUNCATED'),
      storyWarning(),
    ];
    expect(parseWarnings(entries).map((w) => w.source)).toEqual([
      'location',
      'landmark',
      'prop',
      'story',
    ]);
  });

  it('conserva los opcionales cuando vienen, y no los inventa cuando no', () => {
    const conHttp = researchWarning('prop', 'PROVIDER_HTTP_ERROR', {
      httpStatus: 503,
      finishReason: 'MAX_TOKENS',
    });
    const [conOpcionales] = parseWarnings([conHttp]);
    expect(conOpcionales.httpStatus).toBe(503);
    expect(conOpcionales.finishReason).toBe('MAX_TOKENS');

    const [sinOpcionales] = parseWarnings([researchWarning('prop', 'PROVIDER_HTTP_ERROR')]);
    expect('httpStatus' in sinOpcionales).toBe(false);
    expect('finishReason' in sinOpcionales).toBe(false);
  });

  it('acepta un código DESCONOCIDO de una fuente conocida: manda el message del servidor', () => {
    const futuro = {
      source: 'prop',
      code: 'CODIGO_QUE_AUN_NO_EXISTE',
      message: 'Un motivo nuevo que el servidor sabe redactar y el cliente no.',
    };
    expect(parseWarnings([futuro])).toEqual([futuro]);
  });

  it('descarta una fuente desconocida: una fuente nueva cambia el significado de la UI', () => {
    expect(
      parseWarnings([{ source: 'personaje', code: 'X', message: 'algo' }]),
    ).toEqual([]);
  });

  it('exige code y message no vacíos', () => {
    const malos = [
      { source: 'prop', code: '', message: 'algo' },
      { source: 'prop', code: '   ', message: 'algo' },
      { source: 'prop', code: 'X', message: '' },
      { source: 'prop', code: 'X', message: '   ' },
      { source: 'prop', code: 7, message: 'algo' },
      { source: 'prop', code: 'X', message: 7 },
      { source: 'prop', code: 'X' },
      { source: 'prop', message: 'algo' },
      { code: 'X', message: 'algo' },
    ];
    for (const m of malos) {
      expect(parseWarnings([m]), JSON.stringify(m)).toEqual([]);
    }
  });

  it('un opcional MAL FORMADO invalida la entrada entera, no sólo el campo', () => {
    const malos = [
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), httpStatus: '503' },
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), httpStatus: null },
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), httpStatus: Number.NaN },
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), httpStatus: Number.POSITIVE_INFINITY },
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), finishReason: 5 },
      { ...researchWarning('prop', 'PROVIDER_HTTP_ERROR'), finishReason: null },
    ];
    for (const m of malos) {
      expect(parseWarnings([m]), JSON.stringify(m)).toEqual([]);
    }
  });

  it('ignora propiedades desconocidas y NO las copia al objeto de salida', () => {
    const conBasura = {
      ...researchWarning('location', 'NO_API_KEY'),
      promptEnviado: 'texto-del-request-que-no-debe-viajar',
      proveedor: 'gemini-interno',
      requestId: 'req-secreto',
    };
    const [limpio] = parseWarnings([conBasura]);
    expect(limpio).toEqual({
      source: 'location',
      code: 'NO_API_KEY',
      message: serverWarningMessage('location', 'NO_API_KEY'),
    });
    expect(Object.keys(limpio).sort()).toEqual(['code', 'message', 'source']);
  });

  it('preserva ORDEN y MULTIPLICIDAD, incluidos source/code repetidos', () => {
    // El borde emite una entrada POR RESULTADO fallido: dos props o dos
    // landmarks producen el MISMO par source//code. Deduplicar borraría un
    // fallo real, así que ambas entradas sobreviven.
    const a = researchWarning('prop', 'PROVIDER_HTTP_ERROR', { httpStatus: 500 });
    const b = researchWarning('prop', 'PROVIDER_HTTP_ERROR', { httpStatus: 503 });
    const c = researchWarning('location', 'NO_API_KEY');
    const out = parseWarnings([a, b, c, b]);
    expect(out).toHaveLength(4);
    expect(out.map((w) => `${w.source}:${w.code}`)).toEqual([
      'prop:PROVIDER_HTTP_ERROR',
      'prop:PROVIDER_HTTP_ERROR',
      'location:NO_API_KEY',
      'prop:PROVIDER_HTTP_ERROR',
    ]);
    expect(out.map((w) => w.httpStatus)).toEqual([500, 503, undefined, 503]);
  });

  it('en un array mixto deja pasar sólo lo válido, sin lanzar', () => {
    const ok1 = researchWarning('location', 'NO_API_KEY');
    const ok2 = storyWarning();
    const mezcla = [
      null,
      ok1,
      'texto suelto',
      { source: 'prop' },
      42,
      ['array', 'anidado'],
      ok2,
      undefined,
      { source: 'desconocida', code: 'X', message: 'y' },
    ];
    expect(() => parseWarnings(mezcla)).not.toThrow();
    expect(parseWarnings(mezcla)).toEqual([ok1, ok2]);
  });

  it('un array anidado NO es una entrada: sólo objetos no-array sobreviven', () => {
    expect(parseWarnings([[researchWarning('prop', 'NO_API_KEY')]])).toEqual([]);
  });

  it('ausente, null o no-array devuelve [] sin lanzar', () => {
    for (const v of [undefined, null, 'nope', 7, {}, { warnings: [] }, true]) {
      expect(parseWarnings(v), String(v)).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// PC-UI / T-U.2 — la costura de InvokeError lleva los warnings SIN cambiar nada
// de lo que ya hacía. `extractInvokeError` (privado del editor) se prueba en la
// suite de componente contra `FunctionsHttpError` reales.
// ---------------------------------------------------------------------------

describe('buildInvokeError — warnings (PC-UI)', () => {
  it('parsea los warnings de un 502 tipado con el MISMO parser', () => {
    const w = researchWarning('landmark', 'PROVIDER_UNAVAILABLE');
    const e = buildInvokeError(
      502,
      typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'El modelo devolvió una estructura inválida.',
        warnings: [w],
      }),
    );
    expect(e.warnings).toEqual([w]);
    expect(parseWarnings([w])).toEqual(e.warnings);
  });

  it('los lleva también en el 400 CLIENT_INPUT_INVALID y en el 422', () => {
    const w = researchWarning('prop', 'OUTPUT_BLOCKED');
    const e400 = buildInvokeError(
      400,
      typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: CLIENT_INPUT_INVALID_400_DETAIL,
        warnings: [w],
      }),
    );
    expect(e400.warnings).toEqual([w]);
    expect(e400.code).toBe('CLIENT_INPUT_INVALID');

    const e422 = buildInvokeError(
      422,
      typedErrorBody({
        code: 'CLIENT_INPUT_INVALID',
        error: 'Se requiere contexto de la liturgia y ubicación',
        warnings: [w, storyWarning()],
      }),
    );
    expect(e422.warnings).toHaveLength(2);
  });

  it('los lleva en el envelope genérico 500, que no trae `code`', () => {
    const w = storyWarning();
    const e = buildInvokeError(500, genericErrorBody({ error: 'Error generando cuento', warnings: [w] }));
    expect(e.warnings).toEqual([w]);
    expect(e.code).toBeUndefined();
    expect(e.message).toBe('Error 500: Error generando cuento');
  });

  it('sin la clave `warnings` (el borde la omite vacía) el error trae []', () => {
    expect(buildInvokeError(502, typedErrorBody({
      code: 'PROVIDER_OUTPUT_INVALID',
      error: 'x',
    })).warnings).toEqual([]);
    expect(buildInvokeError(500, null).warnings).toEqual([]);
    expect(buildInvokeError(500, {}).warnings).toEqual([]);
  });

  it('un `warnings` basura no rompe ni fabrica avisos', () => {
    expect(buildInvokeError(500, { warnings: 'nope' }).warnings).toEqual([]);
    expect(buildInvokeError(500, { warnings: [{ source: 'x' }] }).warnings).toEqual([]);
    expect(buildInvokeError(500, { warnings: {} }).warnings).toEqual([]);
  });

  it('no cambia status/code/field/skippedImages/refine/message al agregar warnings', () => {
    // Mismo cuerpo con y sin la clave nueva: todo lo demás debe coincidir.
    const base = {
      code: 'REFINE_SOURCE_UNAVAILABLE',
      field: 'refine.sourceImage',
      error: 'La imagen a refinar no está disponible.',
      skippedImages: [{ field: 'props[0].referenceImages[1]', code: 'NOT_USED' }],
    };
    const sin = buildInvokeError(422, base);
    const con = buildInvokeError(422, { ...base, warnings: [storyWarning()] });

    expect(con.status).toBe(sin.status);
    expect(con.code).toBe(sin.code);
    expect(con.field).toBe(sin.field);
    expect(con.message).toBe(sin.message);
    expect(con.skippedImages).toEqual(sin.skippedImages);
    // …y sólo difieren en el canal nuevo.
    expect(sin.warnings).toEqual([]);
    expect(con.warnings).toHaveLength(1);
    expect(con.message).toMatch(/se conserva/i);
  });

  it('warnings y skippedImages son canales SEPARADOS en el mismo cuerpo', () => {
    const e = buildInvokeError(
      502,
      typedErrorBody({
        code: 'PROVIDER_OUTPUT_INVALID',
        error: 'x',
        skippedImages: [{ field: 'props[0].referenceImages[0]', code: 'NOT_IMAGE' }],
        warnings: [researchWarning('prop', 'EMPTY_RESPONSE')],
      }),
    );
    expect(e.skippedImages).toHaveLength(1);
    expect(e.warnings).toHaveLength(1);
    expect(e.warnings[0].message).not.toContain('el objeto 1');
  });
});
