/**
 * liturgyCover — lectura de la portada de reflexión de una liturgia y su
 * conversión a carátula cuadrada.
 *
 * La conversión corre de verdad (`base64ToSpotifyCover` sin mockear) para que
 * el recorte central quede probado sobre la implementación real. jsdom no
 * dibuja canvas ni decodifica imágenes, así que se mockean `canvas` e `Image`
 * con el patrón que ya usa `coverImageUtils.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLiturgyCover } from '../liturgyCover';

const LITURGY_ID = '11111111-2222-3333-4444-555555555555';

const RAW_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const DATA_URL = `data:image/png;base64,${RAW_BASE64}`;

// ── Mock del cliente Supabase ────────────────────────────────────────────────
// Sobreescribe el mock global de src/test/setup.ts, que no expone maybeSingle.

interface MaybeSingleResult {
  data: { slides: unknown } | null;
  error: { message: string } | null;
}

let elementoResult: MaybeSingleResult = { data: null, error: null };
let elementoThrows: Error | null = null;
const eqCalls: Array<[string, string]> = [];
const selectCalls: string[] = [];
const fromCalls: string[] = [];

vi.mock('@/integrations/supabase/client', () => {
  const filter = {
    eq: vi.fn((column: string, value: string) => {
      eqCalls.push([column, value]);
      return filter;
    }),
    maybeSingle: vi.fn(async () => {
      if (elementoThrows) throw elementoThrows;
      return elementoResult;
    }),
  };
  return {
    supabase: {
      from: vi.fn((table: string) => {
        fromCalls.push(table);
        return {
          select: vi.fn((columns: string) => {
            selectCalls.push(columns);
            return filter;
          }),
        };
      }),
    },
  };
});

// ── Mocks de canvas e Image ──────────────────────────────────────────────────

let lastImageSrc: string | null = null;
let drawImageCalls: unknown[][] = [];

function installCanvasMock() {
  const drawImage = vi.fn((...args: unknown[]) => {
    drawImageCalls.push(args);
  });
  const getContext = vi.fn(() => ({ drawImage, fillRect: vi.fn(), fillStyle: '' }));
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext,
        toBlob: (cb: (b: Blob | null) => void) =>
          cb(new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })),
      } as unknown as HTMLCanvasElement;
    }
    return original(tag);
  });
  return { drawImage };
}

/** `width`/`height` fijan el tamaño de la fuente; 1024×768 es el 4:3 real. */
function installImageMock(width = 1024, height = 768, fail = false) {
  const original = globalThis.Image;
  class MockImage {
    onload: (() => void) | null = null;
    onerror: ((e: Event | string) => void) | null = null;
    width = width;
    height = height;
    set src(value: string) {
      lastImageSrc = value;
      setTimeout(() => {
        if (fail) this.onerror?.('error');
        else this.onload?.();
      }, 0);
    }
  }
  (globalThis as unknown as { Image: typeof Image }).Image =
    MockImage as unknown as typeof Image;
  return () => {
    (globalThis as unknown as { Image: typeof Image }).Image = original;
  };
}

/** Fila con la forma que produce `Portadas.tsx` → `liturgia_elementos.slides`. */
function slideGroupWith(imageUrl: unknown) {
  return {
    id: 'grp-1',
    type: 'custom',
    title: 'Portada de Reflexión',
    slides: [
      {
        id: 'slide-1',
        type: 'image',
        content: { primary: '', imageUrl },
        style: { backgroundColor: '#000' },
        metadata: { sourceComponent: 'Portadas', sourceId: '', order: 0, groupTotal: 1 },
      },
    ],
    metadata: { sourceComponent: 'Portadas', createdAt: '2026-08-01T00:00:00.000Z' },
  };
}

describe('fetchLiturgyCover', () => {
  let restoreImage: () => void;

  beforeEach(() => {
    elementoResult = { data: null, error: null };
    elementoThrows = null;
    eqCalls.length = 0;
    selectCalls.length = 0;
    fromCalls.length = 0;
    drawImageCalls = [];
    lastImageSrc = null;
    restoreImage = installImageMock();
  });

  afterEach(() => {
    restoreImage();
    vi.restoreAllMocks();
  });

  it('recupera la portada de reflexión de la liturgia', async () => {
    installCanvasMock();
    elementoResult = { data: { slides: slideGroupWith(DATA_URL) }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.blob.type).toBe('image/jpeg');
    // Consultó el elemento correcto de la liturgia correcta.
    expect(fromCalls).toEqual(['liturgia_elementos']);
    expect(selectCalls).toEqual(['slides']);
    expect(eqCalls).toEqual([
      ['liturgia_id', LITURGY_ID],
      ['tipo', 'portada-reflexion'],
    ]);
    expect(lastImageSrc).toBe(DATA_URL);
  });

  it('acepta base64 crudo sin prefijo data:', async () => {
    installCanvasMock();
    elementoResult = { data: { slides: slideGroupWith(RAW_BASE64) }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('ok');
    // `loadImage` le antepone el prefijo por diseño (coverImageUtils.ts:63).
    expect(lastImageSrc).toBe(DATA_URL);
  });

  it('usa el recorte central al convertir 4:3 en cuadrada', async () => {
    const { drawImage } = installCanvasMock();
    elementoResult = { data: { slides: slideGroupWith(DATA_URL) }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);
    expect(result.status).toBe('ok');

    // Fuente 1024×768 sobre lienzo 1400×1400: escala = max(1400/1024, 1400/768)
    // = 1.8229…, así que el ancho se desborda y se centra con dx negativo.
    // Un recorte NO central (o un "contain") daría dx = 0 o dy ≠ 0.
    expect(drawImage).toHaveBeenCalledTimes(1);
    const [, dx, dy, drawW, drawH] = drawImage.mock.calls[0] as number[];
    expect(drawW).toBeCloseTo(1866.67, 1);
    expect(drawH).toBeCloseTo(1400, 5);
    expect(dx).toBeCloseTo(-233.33, 1);
    expect(dy).toBeCloseTo(0, 5);
  });

  it('cae a Gemini cuando no hay portada guardada', async () => {
    installCanvasMock();
    elementoResult = { data: null, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /no tiene portada de reflexión guardada/i,
    );
  });

  it('cae a Gemini cuando la liturgia no existe', async () => {
    installCanvasMock();
    // Una liturgia inexistente —o ajena, por la RLS de propietario de
    // `liturgia_elementos`— devuelve 0 filas, no un error.
    elementoResult = { data: null, error: null };

    const result = await fetchLiturgyCover('00000000-0000-0000-0000-000000000000');

    expect(result.status).toBe('unavailable');
    expect(eqCalls[0]).toEqual(['liturgia_id', '00000000-0000-0000-0000-000000000000']);
  });

  it('cae a Gemini cuando la consulta devuelve error', async () => {
    installCanvasMock();
    elementoResult = { data: null, error: { message: 'permission denied' } };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /no se pudo leer la portada/i,
    );
  });

  it('cae a Gemini cuando la consulta lanza', async () => {
    installCanvasMock();
    elementoThrows = new Error('network down');

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /no se pudo leer la portada/i,
    );
  });

  it.each([
    ['slides ausente', { slides: null }],
    ['slides no es SlideGroup', { slides: 'una cadena' }],
    ['slides.slides no es arreglo', { slides: { slides: {} } }],
    ['slides.slides vacío', { slides: { slides: [] } }],
    ['el primer slide no tiene content', { slides: { slides: [{ id: 'a' }] } }],
  ])('cae a Gemini cuando slides tiene forma inesperada (%s)', async (_label, row) => {
    installCanvasMock();
    elementoResult = { data: row as { slides: unknown }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /formato inesperado/i,
    );
  });

  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['sólo espacios', '   '],
    ['no es cadena', 42],
  ])('cae a Gemini cuando imageUrl está %s', async (_label, imageUrl) => {
    installCanvasMock();
    elementoResult = { data: { slides: slideGroupWith(imageUrl) }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /formato inesperado/i,
    );
  });

  it('cae a Gemini cuando la conversión falla', async () => {
    installCanvasMock();
    // La imagen no decodifica → `base64ToSpotifyCover` lanza.
    restoreImage();
    restoreImage = installImageMock(1024, 768, true);
    elementoResult = { data: { slides: slideGroupWith(DATA_URL) }, error: null };

    const result = await fetchLiturgyCover(LITURGY_ID);

    expect(result.status).toBe('unavailable');
    expect(result.status === 'unavailable' && result.reason).toMatch(
      /no se pudo convertir la portada/i,
    );
  });

  it('nunca lanza: todos los fallos vuelven como unavailable', async () => {
    installCanvasMock();
    elementoThrows = new Error('boom');

    await expect(fetchLiturgyCover(LITURGY_ID)).resolves.toMatchObject({
      status: 'unavailable',
    });
  });
});
