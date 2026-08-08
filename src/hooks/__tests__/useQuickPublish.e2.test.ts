/**
 * useQuickPublish · E2 — la carátula sale de la portada de reflexión de la
 * liturgia vinculada, y cada fallo de lectura degrada a Gemini con aviso.
 *
 * Monta el hook de verdad (no sólo el helper) porque lo que E2 afirma es
 * cableado: que el camino corto ocurre ANTES de la validación de
 * título/predicador y de la carga del logo, y que la degradación emite el
 * toast. Eso no se ve desde el helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const LITURGY_ID = '11111111-2222-3333-4444-555555555555';
const LITURGY_IMAGE = 'data:image/png;base64,PORTADA-DE-LITURGIA';
const GEMINI_IMAGE = 'ILUSTRACION-DE-GEMINI';

// Blobs distinguibles por tamaño: así el test sabe de qué ruta salió la carátula.
const LITURGY_BLOB_SIZE = 111;
const GEMINI_BLOB_SIZE = 222;

// ── Estado configurable por test ─────────────────────────────────────────────

interface MaybeSingleResult {
  data: { slides: unknown } | null;
  error: { message: string } | null;
}

// `vi.mock` se iza por encima de los imports, así que el estado que sus
// factorías leen tiene que izarse también.
const h = vi.hoisted(() => ({
  elementoResult: { data: null, error: null } as MaybeSingleResult,
  conversionFails: false,
  fromCalls: [] as string[],
  invokeMock: vi.fn(),
  getCasaLogoAsBase64Mock: vi.fn(),
  buildSermonCoverPromptMock: vi.fn(),
  toastMock: vi.fn(),
}));

const {
  invokeMock,
  getCasaLogoAsBase64Mock,
  buildSermonCoverPromptMock,
  toastMock,
  fromCalls,
} = h;

vi.mock('@/integrations/supabase/client', () => {
  const filter = {
    eq: vi.fn(() => filter),
    maybeSingle: vi.fn(async () => h.elementoResult),
    order: vi.fn(() => filter),
    limit: vi.fn(async () => ({ data: [], error: null })),
  };
  return {
    supabase: {
      from: vi.fn((table: string) => {
        h.fromCalls.push(table);
        return { select: vi.fn(() => filter) };
      }),
      functions: { invoke: h.invokeMock },
    },
  };
});

vi.mock('@/lib/covers/coverPromptBuilder', () => ({
  getCasaLogoAsBase64: h.getCasaLogoAsBase64Mock,
  buildSermonCoverPrompt: h.buildSermonCoverPromptMock,
}));

vi.mock('@/lib/sermon-editor/coverImageUtils', () => ({
  base64ToSpotifyCover: vi.fn(async (source: string) => {
    const isLiturgyCover = source === 'data:image/png;base64,PORTADA-DE-LITURGIA';
    // A4(d) falla sólo la conversión de la portada de liturgia; la de Gemini
    // sigue funcionando, que es justamente lo que la degradación promete.
    if (isLiturgyCover && h.conversionFails) throw new Error('conversión fallida');
    const size = isLiturgyCover ? 111 : 222;
    return new Blob([new Uint8Array(size)], { type: 'image/jpeg' });
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: h.toastMock, dismiss: vi.fn(), toasts: [] }),
  toast: h.toastMock,
}));

import { useQuickPublish, type QuickLiturgy } from '../useQuickPublish';

const LITURGY: QuickLiturgy = {
  id: LITURGY_ID,
  titulo: 'La oveja perdida',
  fecha: '2026-08-02',
  resumen: 'Sobre la búsqueda',
  predicador: 'B. C.',
};

function slideGroupWith(imageUrl: unknown) {
  return {
    slides: [
      {
        id: 'slide-1',
        type: 'image',
        content: { primary: '', imageUrl },
        metadata: { sourceComponent: 'Portadas', order: 0, groupTotal: 1 },
      },
    ],
  };
}

const SAVED_COVER = { data: { slides: slideGroupWith(LITURGY_IMAGE) }, error: null };

beforeEach(() => {
  vi.clearAllMocks();
  h.fromCalls.length = 0;
  h.elementoResult = { data: null, error: null };
  h.conversionFails = false;

  getCasaLogoAsBase64Mock.mockResolvedValue('LOGO-BASE64');
  buildSermonCoverPromptMock.mockReturnValue({ prompt: 'x' });
  invokeMock.mockResolvedValue({
    data: { illustrations: [GEMINI_IMAGE] },
    error: null,
  });

  // jsdom no implementa las URLs de objeto.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('useQuickPublish · carátula desde la portada de la liturgia', () => {
  it('usa la portada de reflexión de la liturgia como carátula', async () => {
    h.elementoResult = SAVED_COVER;
    const { result } = renderHook(() => useQuickPublish());

    act(() => result.current.selectLiturgy(LITURGY));
    await act(async () => {
      await result.current.generateCover();
    });

    await waitFor(() => expect(result.current.state.cover.status).toBe('done'));
    expect(result.current.state.cover.blob?.size).toBe(LITURGY_BLOB_SIZE);
    expect(fromCalls).toContain('liturgia_elementos');
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('omite la carga del logo cuando hay portada de liturgia', async () => {
    h.elementoResult = SAVED_COVER;
    const { result } = renderHook(() => useQuickPublish());

    act(() => result.current.selectLiturgy(LITURGY));
    // Título y predicador vacíos: la ruta Gemini abortaría con error de
    // validación. El camino corto ocurre antes, así que no la toca.
    act(() => result.current.updateMetadata({ title: '', speaker: '' }));
    await act(async () => {
      await result.current.generateCover();
    });

    await waitFor(() => expect(result.current.state.cover.status).toBe('done'));
    expect(result.current.state.cover.blob?.size).toBe(LITURGY_BLOB_SIZE);
    expect(getCasaLogoAsBase64Mock).not.toHaveBeenCalled();
    expect(buildSermonCoverPromptMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.state.cover.error).toBeUndefined();
  });

  // A4 — los cuatro casos de fallo de lectura, cada uno hasta Gemini y toast.
  it.each([
    [
      '(a) la consulta devuelve error',
      () => {
        h.elementoResult = { data: null, error: { message: 'permission denied' } };
      },
      /no se pudo leer la portada/i,
    ],
    [
      '(b) slides tiene forma inesperada',
      () => {
        h.elementoResult = { data: { slides: { slides: 'no es un arreglo' } }, error: null };
      },
      /formato inesperado/i,
    ],
    [
      '(c) imageUrl está vacío',
      () => {
        h.elementoResult = { data: { slides: slideGroupWith('') }, error: null };
      },
      /formato inesperado/i,
    ],
    [
      '(d) la conversión falla',
      () => {
        h.elementoResult = SAVED_COVER;
        h.conversionFails = true;
      },
      /no se pudo convertir la portada/i,
    ],
  ])('degrada a Gemini y avisa en español — %s', async (_label, setup, reasonRe) => {
    setup();
    const { result } = renderHook(() => useQuickPublish());

    act(() => result.current.selectLiturgy(LITURGY));
    await act(async () => {
      await result.current.generateCover();
    });

    expect(toastMock).toHaveBeenCalledTimes(1);
    const toastArg = toastMock.mock.calls[0][0] as {
      title?: string;
      description?: string;
    };
    expect(`${toastArg.title} ${toastArg.description}`).toMatch(reasonRe);
    expect(`${toastArg.title} ${toastArg.description}`).toMatch(
      /se generará una ilustración/i,
    );
    // Llegó a Gemini: cargó el logo, construyó el prompt e invocó la función.
    expect(getCasaLogoAsBase64Mock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('ningún fallo de lectura bloquea la publicación', async () => {
    h.elementoResult = { data: null, error: { message: 'permission denied' } };
    const { result } = renderHook(() => useQuickPublish());

    act(() => result.current.selectLiturgy(LITURGY));
    await act(async () => {
      await result.current.generateCover();
    });

    // El flujo termina con carátula utilizable (la de Gemini) y sin error.
    await waitFor(() => expect(result.current.state.cover.status).toBe('done'));
    expect(result.current.state.cover.blob?.size).toBe(GEMINI_BLOB_SIZE);
    expect(result.current.state.cover.error).toBeUndefined();
    expect(result.current.state.publish.error).toBeUndefined();
  });

  it('sin liturgia vinculada va directo a Gemini, sin consultar ni avisar', async () => {
    const { result } = renderHook(() => useQuickPublish());

    act(() =>
      result.current.continueWithoutLiturgy({
        title: 'Reflexión suelta',
        speaker: 'B. C.',
        date: new Date(2026, 7, 2),
      }),
    );
    await act(async () => {
      await result.current.generateCover();
    });

    await waitFor(() => expect(result.current.state.cover.status).toBe('done'));
    expect(result.current.state.cover.blob?.size).toBe(GEMINI_BLOB_SIZE);
    expect(fromCalls).not.toContain('liturgia_elementos');
    expect(toastMock).not.toHaveBeenCalled();
    expect(getCasaLogoAsBase64Mock).toHaveBeenCalledTimes(1);
  });
});
