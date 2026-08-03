/**
 * T-A4 — Lifecycle destructivo: el borrado del cuento es SOLO de base de datos.
 *
 * Invariante 7 / A4a: ninguna acción del editor —incluida la eliminación—
 * puede borrar bytes de Storage. Una liturgia ya guardada puede referenciar
 * esas imágenes; su recolección es un GC aparte consciente de referencias.
 *
 *   T-A4.1 — un write encolado no resucita la fila borrada.
 *   T-A4.3 — `handleDeleteStory` ⇒ CERO `storage.remove`.
 *   T-A4.5 — el borrado cancela los debounces pendientes SIN persistirlos.
 *
 * Editor REAL + hooks REALES; sólo bordes externos mockeados.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}
function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
/** Toda llamada a `storage.remove` — debe quedar VACÍO en el borrado. */
const storageRemoveCalls: Array<{ paths: string[] }> = [];
const deletedDraftRows: Array<{ filters: Record<string, unknown> }> = [];
let mockUserId: string | null = 'user-a4';
let mockDraftRow: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {

  // B1 — El `upsert` real de supabase-js devuelve un BUILDER encadenable
  // (thenable y con `.select()`), no una promesa. `saveDraftToSupabase` ahora
  // encadena `.select('updated_at').maybeSingle()` para obtener ATÓMICAMENTE el
  // instante de la escritura (testigo del compare-and-delete de la
  // finalización), así que el mock adopta esa forma — es más fiel al borde real
  // que el shape anterior. Cada escritura devuelve un `updated_at` distinto y
  // monótono: eso es lo que hace observable el ack obsoleto.
  let __updatedAtSeq = 0;
  const __nextUpdatedAt = () => {
    __updatedAtSeq += 1;
    return `2026-05-01T00:00:${String(__updatedAtSeq).padStart(2, '0')}.000Z`;
  };
  const __upsertBuilder = (result: Promise<{ error: { message: string } | null }>) => {
    const rowResult = async () => {
      const r = await result;
      if (r && r.error) return { data: null, error: r.error };
      return { data: { updated_at: __nextUpdatedAt() }, error: null };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        result.then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };
  const makeDeleteChain = (tableName: string) => {
    const filters: Record<string, unknown> = {};
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      if (tableName === 'cuentacuentos_drafts') deletedDraftRows.push({ filters });
    };
    const chain = {
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      then: (res: (v: { error: null; data: unknown[] }) => unknown) => {
        record();
        return Promise.resolve({ error: null, data: [] }).then(res);
      },
      select: () => ({
        then: (res: (v: { error: null; data: unknown[] }) => unknown) => {
          record();
          return Promise.resolve({ error: null, data: [] }).then(res);
        },
      }),
    };
    return chain;
  };

  const tableApi = (tableName: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: tableName === 'cuentacuentos_drafts' ? mockDraftRow : null,
      error: null,
    })),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) =>
      __upsertBuilder((async () => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: null };
    })())
    ),
    delete: vi.fn().mockImplementation(() => makeDeleteChain(tableName)),
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
    remove: vi.fn().mockImplementation(async (paths: string[]) => {
      storageRemoveCalls.push({ paths });
      return { error: null };
    }),
    // Devolver carpetas/archivos NO vacíos: si el código volviera a la
    // implementación vieja (listar + remove), este mock le daría material real
    // que borrar y la aserción de cero-removes fallaría de verdad.
    list: vi.fn().mockResolvedValue({
      data: [{ name: 'covers' }, { name: 'scenes' }],
      error: null,
    }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => tableApi(table)),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockImplementation(async () => ({
          data: { success: true, images: ['data:image/png;base64,iVBORw0KGgoAAA='] },
          error: null,
        })),
      },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: mockUserId ? { id: mockUserId } : null },
        })),
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
  id: 'lit-a4',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy A4',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function makeCharactersStepStory(id = 'story-a4'): Story {
  return {
    id,
    title: 'Cuento a borrar',
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
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      { number: 1, text: 'Escena de apertura', visualDescription: 'plaza soleada' } as unknown as Story['scenes'][number],
    ],
    props: [
      { id: 'prop-1', kind: 'object', name: 'El farol', narrativeRole: 'guía', visualDescription: 'farol de bronce', referenceImages: [], role: 'secondary' },
    ] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: 'characters-pending' as Story['metadata']['status'] },
  } as Story;
}

beforeEach(() => {
  upsertCalls.length = 0;
  upsertDeferreds.length = 0;
  storageRemoveCalls.length = 0;
  deletedDraftRows.length = 0;
  mockUserId = 'user-a4';
  mockDraftRow = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: null }) } as unknown as Response));
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Renderiza en el paso `characters` y ejecuta el borrado completo del cuento. */
async function renderAndDelete(storyId = 'story-a4') {
  const onStoryDeleted = vi.fn();
  render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeCharactersStepStory(storyId)}
      onStoryCreated={vi.fn()}
      onStoryDeleted={onStoryDeleted}
    />
  );
  await screen.findByRole('button', { name: /^Eliminar$/i });
  await act(async () => { await yields(6); });

  // Abrir el diálogo de confirmación y confirmar.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));
    await yields(4);
  });
  const confirm = await screen.findByRole('button', { name: /Sí, eliminar/i });
  await act(async () => {
    fireEvent.click(confirm);
    await yields(40);
  });
  return { onStoryDeleted };
}

describe('T-A4.3 — el borrado del cuento no toca Storage', () => {
  it('handleDeleteStory borra la fila del draft y hace CERO storage.remove', async () => {
    const { onStoryDeleted } = await renderAndDelete();

    await waitFor(() => expect(deletedDraftRows.length).toBeGreaterThan(0), { timeout: 5000 });

    // El corazón de la invariante 7: ni un solo byte de Storage borrado.
    expect(storageRemoveCalls).toEqual([]);

    // …y el borrado de la fila sí ocurrió, con su identidad correcta.
    expect(deletedDraftRows[0].filters['liturgia_id']).toBe('lit-a4');
    expect(deletedDraftRows[0].filters['user_id']).toBe('user-a4');

    await waitFor(() => expect(onStoryDeleted).toHaveBeenCalled(), { timeout: 5000 });
  });
});

describe('T-A4.5 — el borrado cancela los debounces pendientes sin persistirlos', () => {
  it('una edición debounceada no persiste tras el borrado y no resucita la fila', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeCharactersStepStory('story-a45')}
        onStoryCreated={vi.fn()}
        onStoryDeleted={vi.fn()}
      />
    );
    const descriptionBox = await screen.findByPlaceholderText(/Descripción visual canónica/i);
    await act(async () => { await yields(6); });

    vi.useFakeTimers({ shouldAdvanceTime: false });

    // 1) Armar un debounce real (blur con cambio ⇒ saveDraft, timer de 2s).
    act(() => {
      fireEvent.change(descriptionBox, { target: { value: 'farol de bronce pulido' } });
      fireEvent.blur(descriptionBox);
    });

    upsertCalls.length = 0;

    // 2) Borrar el cuento ANTES de que venza el debounce.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));
    });
    const confirm = screen.getByRole('button', { name: /Sí, eliminar/i });
    await act(async () => {
      fireEvent.click(confirm);
      await yields(40);
    });

    // 3) Dejar vencer con creces el timer del debounce.
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await yields(40);
    });
    vi.useRealTimers();
    await act(async () => { await yields(20); });

    // El callback del debounce NO debe haber persistido nada: cero upserts
    // después del borrado ⇒ la fila borrada no se resucita.
    expect(upsertCalls).toEqual([]);
    expect(storageRemoveCalls).toEqual([]);
  });
});

describe('T-A4.1 — un write ya encolado no resucita la fila borrada', () => {
  it('el DELETE sale después del upsert en vuelo y no queda fila re-creada', async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeCharactersStepStory('story-a41')}
        onStoryCreated={vi.fn()}
        onStoryDeleted={vi.fn()}
      />
    );
    const descriptionBox = await screen.findByPlaceholderText(/Descripción visual canónica/i);
    await act(async () => { await yields(6); });

    // Retener el upsert del guardado de la descripción: queda EN VUELO.
    const held = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(held);

    await act(async () => {
      fireEvent.change(descriptionBox, { target: { value: 'farol distinto' } });
      fireEvent.blur(descriptionBox);
      await yields(4);
    });
    // Forzar el flush del debounce sin fake timers: el borrado drena la cola.
    await act(async () => { await new Promise((r) => setTimeout(r, 2200)); await yields(10); });

    const upsertsBeforeDelete = upsertCalls.length;

    // Borrar mientras el upsert sigue retenido.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/i }));
    });
    const confirm = screen.getByRole('button', { name: /Sí, eliminar/i });
    const deleteClick = act(async () => {
      fireEvent.click(confirm);
      await yields(10);
    });

    // Liberar el upsert retenido: el DELETE está encadenado DETRÁS de él.
    held.resolve({ error: null });
    await deleteClick;
    await act(async () => { await yields(40); });

    await waitFor(() => expect(deletedDraftRows.length).toBeGreaterThan(0), { timeout: 5000 });

    // Ningún upsert NUEVO después del que estaba en vuelo: nada re-crea la fila.
    expect(upsertCalls.length).toBe(upsertsBeforeDelete);
    expect(storageRemoveCalls).toEqual([]);
  });
});
