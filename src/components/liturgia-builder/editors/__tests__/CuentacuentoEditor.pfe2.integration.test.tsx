/**
 * PFE ronda 2 — B1 (el tope de peso ya no anula al reductor) y B2 (las imágenes
 * descartadas en el canal de `generate-scene-images` llegan al mismo aviso).
 *
 * Editor REAL, hooks REALES, aviso REAL: lo único simulado es el cliente de
 * Supabase. El sitio de subida crea su `<input type=file>` de forma imperativa
 * y lo dispara con `.click()`, así que el test intercepta ese click para quedarse
 * con el input recién creado y ejecuta el MISMO `onchange` que corre en
 * producción — no una copia del handler escrita a mano.
 *
 *   B1  — una foto de 6 MB (pasada del tope viejo de 5 MB, dentro del nuevo de
 *         30 MB) se acepta y llega al estado; una de 31 MB se sigue rechazando.
 *   B2a — `generate-scene-images` responde 200 CON `skippedImages` ⇒ el aviso
 *         aparece. Sin el plumbing en el wrapper, la respuesta se descarta.
 *   B2b — el mismo canal falla con cuerpo tipado ⇒ el aviso también aparece.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

/** Respuesta que devuelve el invoke de `generate-scene-images` en cada test. */
type InvokeOutcome =
  | { kind: 'success'; skippedImages?: unknown }
  | { kind: 'httpError'; status: number; body: unknown };

let sceneImagesOutcome: InvokeOutcome = { kind: 'success' };

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  /** El upsert devuelve `updated_at`, que el hook usa como testigo. */
  const upsertBuilder = () => {
    const rowResult = async () => {
      seq += 1;
      return {
        data: { updated_at: `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z` },
        error: null,
      };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  const deleteChain = () => {
    const chain = {
      eq: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null, data: [] }).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ error: null, data: [] }).then(res as never, rej as never),
      }),
    };
    return chain;
  };

  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation(() => upsertBuilder()),
    delete: vi.fn().mockImplementation(() => deleteChain()),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => ({ data: { path }, error: null })),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockImplementation(async (fn: string) => {
          if (fn !== 'generate-scene-images') {
            return { data: { success: true, images: [] }, error: null };
          }
          if (sceneImagesOutcome.kind === 'httpError') {
            const { status, body } = sceneImagesOutcome;
            // Forma real de FunctionsHttpError: mensaje fijo y el detalle en
            // `context` (una Response). `extractInvokeError` sólo exige
            // `status` y `clone()`.
            const fnError = Object.assign(
              new Error('Edge Function returned a non-2xx status code'),
              { context: { status, clone: () => ({ json: async () => body }) } },
            );
            return { data: null, error: fnError };
          }
          return {
            data: {
              success: true,
              images: ['data:image/png;base64,iVBORw0KGgoAAA='],
              skippedImages: sceneImagesOutcome.skippedImages,
            },
            error: null,
          };
        }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-pfe2' } } }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import CuentacuentoEditor from '../CuentacuentoEditor';

const baseContext: LiturgyContext = {
  id: 'lit-pfe2',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy PFE2',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/** Historia en `scenes-pending`: aprobar escenas deja el editor en el paso de portada. */
function makeScenesPendingStory(id: string): Story {
  return {
    id,
    title: `Cuento ${id}`,
    summary: 'Resumen breve',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char-1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'niña con vestido azul',
        characterSheetUrl: 'https://mock/char-1.png',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena de apertura',
        visualDescription: 'plaza soleada',
        selectedImageUrl: 'https://mock/scene-1.png',
      } as unknown as Story['scenes'][number],
    ],
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'scenes-pending' as Story['metadata']['status'],
    },
  } as unknown as Story;
}

let alertSpy: ReturnType<typeof vi.fn>;
/** Inputs de archivo que el editor creó y disparó imperativamente. */
let clickedInputs: HTMLInputElement[] = [];
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sceneImagesOutcome = { kind: 'success' };
  clickedInputs = [];
  alertSpy = vi.fn();
  vi.stubGlobal('alert', alertSpy);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: null }) } as unknown as Response),
  );
  clickSpy = vi
    .spyOn(HTMLInputElement.prototype, 'click')
    .mockImplementation(function (this: HTMLInputElement) {
      clickedInputs.push(this);
    });
  vi.useRealTimers();
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** El botón de generación de portada; dice "Regenerar" si ya hay opciones. */
function coverGenerateButton(): HTMLElement {
  return screen.getAllByRole('button', { name: /Generar portada|Regenerar/i })[0];
}

/**
 * Monta el editor y avanza hasta el paso de portada.
 *
 * Aprobar las escenas dispara por sí solo la generación de portada/fin, así que
 * el montaje se hace SIEMPRE con una respuesta limpia: lo que cada test observe
 * después viene de la llamada que ese test provoca, no del arranque.
 */
async function renderAtCoverStep() {
  sceneImagesOutcome = { kind: 'success' };
  const view = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeScenesPendingStory('story-pfe2')}
      onStoryCreated={vi.fn()}
    />,
  );
  const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i }, { timeout: 5000 });
  await act(async () => {
    fireEvent.click(approveScenes);
    await yields(40);
  });
  await waitFor(() => expect(coverGenerateButton()).toBeTruthy(), { timeout: 5000 });
  return view;
}

/**
 * Entrega `file` al sitio de subida de la referencia de portada ejecutando el
 * `onchange` REAL que el editor acaba de instalar en su input imperativo.
 */
async function uploadCoverReference(file: File) {
  // La zona de subida vive en el panel expandible "Editar prompt".
  const openPanel = screen.getAllByRole('button', { name: /Editar prompt/i })[0];
  await act(async () => {
    fireEvent.click(openPanel);
    await yields(5);
  });
  const dropzone = await screen.findByText('Subir', { exact: true }, { timeout: 5000 });
  await act(async () => {
    fireEvent.click(dropzone);
    await yields(2);
  });
  const input = clickedInputs[clickedInputs.length - 1];
  expect(input, 'el editor debió crear y disparar un <input type=file>').toBeTruthy();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    await input.onchange?.({ target: input } as unknown as Event);
    await yields(20);
  });
}

/** PNG mínimo real, repetido hasta `bytes` para simular una foto pesada. */
function makeImageFile(bytes: number, name = 'foto.png'): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

describe('B1 — el tope de peso deja pasar lo que el reductor sabe reducir', () => {
  it('una foto de 6 MB se acepta y llega al estado (antes se rechazaba a los 5 MB)', async () => {
    await renderAtCoverStep();

    await uploadCoverReference(makeImageFile(6 * 1024 * 1024));

    expect(alertSpy).not.toHaveBeenCalled();
    // El síntoma visible: la referencia quedó cargada y se ve su preview.
    await waitFor(
      () => expect(screen.getByAltText('Referencia de portada')).toBeTruthy(),
      { timeout: 5000 },
    );
  }, 30000);

  it('una foto de 31 MB se sigue rechazando, y el aviso nombra el tope nuevo', async () => {
    await renderAtCoverStep();

    await uploadCoverReference(makeImageFile(31 * 1024 * 1024));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(String(alertSpy.mock.calls[0][0])).toMatch(/30\s?MB/);
    expect(screen.queryByAltText('Referencia de portada')).toBeNull();
  }, 30000);
});

describe('B2 — las referencias descartadas por generate-scene-images se avisan', () => {
  it('B2a — respuesta 200 con skippedImages ⇒ aparece el aviso', async () => {
    await renderAtCoverStep();
    // Nada que avisar todavía: lo que siga viene de la llamada de este test.
    expect(screen.queryByText(/foto de referencia no se usó/i)).toBeNull();

    sceneImagesOutcome = {
      kind: 'success',
      skippedImages: [{ field: 'characters[0].referenceImage', code: 'NOT_IMAGE' }],
    };
    await act(async () => {
      fireEvent.click(coverGenerateButton());
      await yields(40);
    });

    await waitFor(
      () => expect(screen.getByText(/Una foto de referencia no se usó/i)).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(
      screen.getByText(/el personaje 1: su formato no es compatible/i),
    ).toBeTruthy();
  }, 30000);

  it('B2b — fallo con cuerpo tipado ⇒ el aviso también aparece', async () => {
    await renderAtCoverStep();
    expect(screen.queryByText(/foto de referencia no se usó/i)).toBeNull();

    sceneImagesOutcome = {
      kind: 'httpError',
      status: 400,
      body: {
        success: false,
        error: 'No se pudo generar',
        skippedImages: [{ field: 'characters[0].referenceImage', code: 'FETCH_FAILED' }],
      },
    };
    await act(async () => {
      fireEvent.click(coverGenerateButton());
      await yields(40);
    });

    await waitFor(
      () =>
        expect(
          screen.getByText(/el personaje 1: no se pudo recuperar; puede que se haya borrado/i),
        ).toBeTruthy(),
      { timeout: 5000 },
    );
  }, 30000);
});

