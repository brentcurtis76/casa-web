/**
 * B1 (A5 / A6a) — Handshake de finalización propiedad del PADRE, con
 * compare-and-delete.
 *
 * La fila tiene UNIQUE(liturgia_id, user_id): hay UNA sola fila de borrador por
 * (liturgia, usuario), compartida por CUALQUIER historia de esa liturgia. Un
 * borrado keyed sólo por ese par —lo que hacía la finalización— por tanto:
 *   (a) puede borrar el borrador de la historia B con un ack tardío de A, y
 *   (b) puede tirar una edición hecha DESPUÉS de finalizar.
 *
 * B1 lo sustituye por un cierre de un solo uso que el padre ejecuta después de
 * guardar la liturgia, y que borra SÓLO si la fila sigue siendo la finalizada:
 * misma `story->>id` y mismo `updated_at`.
 *
 *   B1(a) — finalizar A → desmontar → editar B → ack viejo ⇒ 0 filas, B vive.
 *   B1(b) — finalizar → editar la misma historia → ack viejo ⇒ 0 filas.
 *   B1(c) — camino feliz ⇒ 1 fila; segundo llamado ⇒ no-op.
 *   B1(d) — el cierre sobrevive al desmontaje del editor.
 *
 * Editor REAL + hooks REALES; el mock de Supabase EVALÚA los filtros del DELETE
 * contra una fila simulada, así que "0 filas" se deriva de la condición real y
 * no de una constante del test.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
/** Filtros de cada DELETE emitido, para inspección. */
const deleteAttempts: Array<{ filters: Record<string, string>; deleted: number }> = [];
let mockUserId: string | null = 'user-b1';
let mockDraftRow: Record<string, unknown> | null = null;

/**
 * Fila simulada del borrador. El upsert la reescribe (nuevo `updated_at`, nueva
 * `story.id`) y el DELETE se evalúa CONTRA ella. Así el resultado "0 filas" es
 * consecuencia de la condición, no de un valor fijado a mano.
 */
interface SimRow {
  liturgia_id: string;
  user_id: string;
  story_id: string | null;
  updated_at: string;
}
let simRow: SimRow | null = null;

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  const nextUpdatedAt = () => {
    seq += 1;
    return `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z`;
  };

  const makeDeleteChain = (tableName: string) => {
    const filters: Record<string, string> = {};
    const run = () => {
      if (tableName !== 'cuentacuentos_drafts') return { error: null, data: [] };
      const row = simRow;
      let matches = row !== null;
      if (row) {
        for (const [col, val] of Object.entries(filters)) {
          if (col === 'liturgia_id' && row.liturgia_id !== val) matches = false;
          else if (col === 'user_id' && row.user_id !== val) matches = false;
          else if (col === 'story->>id' && row.story_id !== val) matches = false;
          else if (col === 'updated_at' && row.updated_at !== val) matches = false;
          else if (col === 'current_step') matches = false; // no simulado
        }
      }
      const deleted = matches ? 1 : 0;
      if (matches) simRow = null;
      deleteAttempts.push({ filters: { ...filters }, deleted });
      return { error: null, data: matches ? [{ id: 'row-1' }] : [] };
    };
    const chain = {
      eq: (col: string, val: unknown) => {
        filters[col] = String(val);
        return chain;
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(run()).then(res as never, rej as never),
      }),
    };
    return chain;
  };

  const upsertBuilder = (payload: UpsertPayload) => {
    const settle = async () => {
      upsertCalls.push({ payload });
      const storyObj = payload['story'] as { id?: string } | null;
      const updatedAt = nextUpdatedAt();
      // El upsert (re)escribe la fila simulada: nueva identidad, nuevo instante.
      simRow = {
        liturgia_id: String(payload['liturgia_id']),
        user_id: String(payload['user_id']),
        story_id: storyObj?.id ?? null,
        updated_at: updatedAt,
      };
      return { updatedAt };
    };
    const promise = settle();
    const rowResult = async () => {
      const { updatedAt } = await promise;
      return { data: { updated_at: updatedAt }, error: null };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        promise.then(() => ({ error: null })).then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  const tableApi = (tableName: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      // La lectura la gobierna la fila SIMULADA: si el compare-and-delete la
      // borró, un remonte no la ve. Sin esto, "el prompt no vuelve" sólo
      // probaría la contabilidad del propio test.
      data:
        tableName === 'cuentacuentos_drafts' && simRow !== null ? mockDraftRow : null,
      error: null,
    })),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) => upsertBuilder(payload)),
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
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => tableApi(table)),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockImplementation(async () => ({
          data: { success: true, images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg=='] },
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
  id: 'lit-b1',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy B1',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

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
      { number: 1, text: 'Escena de apertura', visualDescription: 'plaza soleada', selectedImageUrl: 'https://mock/scene-1.png' } as unknown as Story['scenes'][number],
    ],
    props: [] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    coverImageUrl: 'https://mock/cover.png',
    endImageUrl: 'https://mock/end.png',
    coverImageOptions: ['https://mock/cover-a.png', 'https://mock/cover-b.png'],
    endImageOptions: ['https://mock/end-a.png', 'https://mock/end-b.png'],
    metadata: { createdAt: '', updatedAt: '', status: 'scenes-pending' as Story['metadata']['status'] },
  } as unknown as Story;
}

beforeEach(() => {
  upsertCalls.length = 0;
  deleteAttempts.length = 0;
  mockUserId = 'user-b1';
  mockDraftRow = null;
  simRow = null;
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

/** Finaliza una historia y devuelve el cierre de confirmación entregado al padre. */
async function finalizeStory(storyId: string) {
  const onStoryCreated = vi.fn();
  const view = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeScenesPendingStory(storyId)}
      onStoryCreated={onStoryCreated}
    />
  );
  const approveScenes = await waitFor(() => {
    const button = screen.getByRole('button', { name: /Aprobar escenas/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    return button;
  });
  await act(async () => {
    fireEvent.click(approveScenes);
    await yields(25);
  });
  const finalize = await screen.findByRole('button', { name: /Finalizar cuento/i });
  await act(async () => {
    fireEvent.click(finalize);
    await yields(30);
  });
  await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 5000 });
  const [, , confirmFinalization] = onStoryCreated.mock.calls[0] as [
    Story,
    unknown,
    (() => Promise<void>) | undefined,
  ];
  return { view, confirmFinalization: confirmFinalization!, onStoryCreated };
}

describe('B1(c) — camino feliz: el padre confirma y se borra exactamente una fila', () => {
  it('finalizar NO borra; confirmar borra 1 fila; el segundo llamado es no-op', async () => {
    const { confirmFinalization } = await finalizeStory('story-b1c');

    // La finalización por sí sola no borra nada: el borrador sigue recuperable.
    expect(deleteAttempts).toEqual([]);
    expect(simRow).not.toBeNull();

    await act(async () => { await confirmFinalization(); await yields(10); });

    expect(deleteAttempts).toHaveLength(1);
    expect(deleteAttempts[0].deleted).toBe(1);
    // El DELETE llevó AMBAS condiciones del compare-and-delete.
    expect(deleteAttempts[0].filters['story->>id']).toBe('story-b1c');
    expect(typeof deleteAttempts[0].filters['updated_at']).toBe('string');
    expect(simRow).toBeNull();

    // Testigo consumido: no se emite un segundo DELETE.
    await act(async () => { await confirmFinalization(); await yields(10); });
    expect(deleteAttempts).toHaveLength(1);
  });
});

describe('B1(a) — un ack obsoleto de la historia A no borra el borrador de B', () => {
  it('finalizar A → desmontar → crear B → ack de A ⇒ 0 filas y B sobrevive', async () => {
    const { view, confirmFinalization } = await finalizeStory('story-A');
    const rowAfterA = simRow;
    expect(rowAfterA?.story_id).toBe('story-A');

    // El editor se desmonta (cambio de pestaña). El cierre vive en el padre.
    view.unmount();
    await act(async () => { await yields(5); });

    // Aparece la historia B y escribe SU borrador — misma fila (UNIQUE).
    await finalizeStory('story-B');
    expect(simRow?.story_id).toBe('story-B');
    const rowOfB = simRow;

    // Ahora llega el ack VIEJO de A (p.ej. el padre guarda la liturgia tarde).
    await act(async () => { await confirmFinalization(); await yields(10); });

    const ackOfA = deleteAttempts[deleteAttempts.length - 1];
    expect(ackOfA.filters['story->>id']).toBe('story-A');
    // Cero filas borradas: la condición de historia no matchea.
    expect(ackOfA.deleted).toBe(0);
    // El borrador de B sigue intacto — éste es el bug que B1 elimina.
    expect(simRow).toEqual(rowOfB);
    expect(simRow?.story_id).toBe('story-B');
  });
});

describe('B1(b) — una edición posterior a la finalización invalida el ack', () => {
  it('editar la MISMA historia tras finalizar ⇒ ack viejo borra 0 filas', async () => {
    const { confirmFinalization } = await finalizeStory('story-b1b');
    const updatedAtAtFinalize = simRow?.updated_at;
    expect(updatedAtAtFinalize).toBeTruthy();

    // Una escritura posterior sobre la MISMA historia mueve `updated_at`.
    // (Simula la edición que el usuario hace después de finalizar.)
    simRow = { ...simRow!, updated_at: '2026-05-01T09:99:99.000Z' };

    await act(async () => { await confirmFinalization(); await yields(10); });

    const ack = deleteAttempts[deleteAttempts.length - 1];
    expect(ack.filters['updated_at']).toBe(updatedAtAtFinalize);
    // El testigo ya no coincide ⇒ no se borra nada; el borrador (más nuevo
    // que lo entregado) permanece recuperable y hay que re-finalizar.
    expect(ack.deleted).toBe(0);
    expect(simRow).not.toBeNull();
  });
});

describe('B1(e) — recuperar una finalización pendiente la vuelve confirmable', () => {
  it('un borrador `complete` recuperado entrega un cierre que SÍ borra la fila', async () => {
    // Escenario: el usuario finalizó, cerró la pestaña sin guardar la liturgia,
    // y vuelve. La fila 'complete' se ofrece para recuperar (B1). Sin el
    // handshake re-armado, recuperar dejaba el borrador en un limbo permanente:
    // el prompt reaparecía en cada montaje porque nadie tenía con qué
    // confirmarlo.
    mockDraftRow = {
      liturgia_id: 'lit-b1',
      user_id: 'user-b1',
      current_step: 'complete',
      config: {
        location: 'Jerusalén', customLocation: '', characters: 'María',
        style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '',
      },
      story: {
        id: 'story-recovered',
        title: 'Cuento finalizado',
        summary: 'Resumen',
        characters: [],
        scenes: [],
        props: [],
        metadata: { createdAt: '', updatedAt: '', status: 'ready' },
      },
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-05-01T00:00:42.000Z',
    };
    // La fila simulada refleja lo que hay en la BD al recuperar.
    simRow = {
      liturgia_id: 'lit-b1',
      user_id: 'user-b1',
      story_id: 'story-recovered',
      updated_at: '2026-05-01T00:00:42.000Z',
    };

    const onStoryCreated = vi.fn();
    render(<CuentacuentoEditor context={baseContext} onStoryCreated={onStoryCreated} />);

    const recover = await screen.findByRole('button', { name: /Recuperar borrador/i }, { timeout: 5000 });
    await act(async () => {
      fireEvent.click(recover);
      await yields(20);
    });

    // El padre recibe la historia finalizada Y un cierre de confirmación.
    await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [recoveredStory, , confirmFinalization] = onStoryCreated.mock.calls[0] as [
      Story,
      unknown,
      (() => Promise<void>) | undefined,
    ];
    expect(recoveredStory.id).toBe('story-recovered');
    expect(typeof confirmFinalization).toBe('function');

    // Recuperar por sí solo no borra nada.
    expect(deleteAttempts).toEqual([]);

    // Al guardar la liturgia, el cierre confirma y la fila SE VA: el prompt no
    // puede volver a aparecer.
    await act(async () => { await confirmFinalization!(); await yields(10); });
    const ack = deleteAttempts[deleteAttempts.length - 1];
    expect(ack.filters['story->>id']).toBe('story-recovered');
    expect(ack.filters['updated_at']).toBe('2026-05-01T00:00:42.000Z');
    expect(ack.deleted).toBe(1);
    expect(simRow).toBeNull();
  });
});

describe('B1(d) — el cierre sobrevive al desmontaje del editor', () => {
  it('desmontar el editor y confirmar después sigue borrando la fila correcta', async () => {
    const { view, confirmFinalization } = await finalizeStory('story-b1d');

    view.unmount();
    await act(async () => { await yields(5); });

    // El padre dura más que el editor: el guardado de la liturgia ocurre
    // después de cerrar el elemento, y la confirmación debe seguir funcionando.
    await act(async () => { await confirmFinalization(); await yields(10); });

    const ack = deleteAttempts[deleteAttempts.length - 1];
    expect(ack.filters['story->>id']).toBe('story-b1d');
    expect(ack.deleted).toBe(1);
    expect(simRow).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B1(f) — El SÍNTOMA visible del finding 1: tras confirmar, el prompt de
// recuperación NO vuelve.
//
// B1(e) llega hasta `simRow === null`, que es el efecto en la base. Esto cierra
// el bucle en la UI: se recupera una finalización pendiente, se confirma (lo que
// el padre hace al guardar la liturgia), se desmonta y se vuelve a montar — y
// el usuario ya no ve nada que recuperar. Ése era exactamente el limbo: prompt
// en cada montaje, con "Empezar de nuevo" (que descarta) como única salida.
// ---------------------------------------------------------------------------
describe('B1(f) — tras confirmar, el prompt de recuperación no vuelve', () => {
  it('recuperar → confirmar → remontar ⇒ sin prompt', async () => {
    const dbUpdatedAt = '2026-05-01T00:00:42.000Z';
    mockDraftRow = {
      liturgia_id: 'lit-b1',
      user_id: 'user-b1',
      current_step: 'complete',
      config: {
        location: 'Jerusalén', customLocation: '', characters: 'María',
        style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '',
      },
      story: {
        id: 'story-loop',
        title: 'Cuento finalizado',
        summary: 'Resumen',
        characters: [],
        scenes: [],
        props: [],
        metadata: { createdAt: '', updatedAt: '', status: 'ready' },
      },
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: dbUpdatedAt,
    };
    simRow = {
      liturgia_id: 'lit-b1',
      user_id: 'user-b1',
      story_id: 'story-loop',
      updated_at: dbUpdatedAt,
    };

    const onStoryCreated = vi.fn();
    const first = render(
      <CuentacuentoEditor context={baseContext} onStoryCreated={onStoryCreated} />
    );

    // 1) El prompt aparece (la fila 'complete' es recuperable bajo B1).
    const recover = await screen.findByRole('button', { name: /Recuperar borrador/i }, { timeout: 5000 });
    await act(async () => {
      fireEvent.click(recover);
      await yields(20);
    });

    // 2) El padre guarda la liturgia y confirma.
    await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 5000 });
    const [, , confirmFinalization] = onStoryCreated.mock.calls[0] as [
      Story,
      unknown,
      (() => Promise<void>) | undefined,
    ];
    await act(async () => { await confirmFinalization!(); await yields(10); });
    expect(simRow).toBeNull();

    // 3) Remonte limpio: la fila ya no existe, así que no hay nada que ofrecer.
    first.unmount();
    await act(async () => { await yields(5); });

    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);
    await act(async () => { await yields(30); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); await yields(20); });

    expect(screen.queryByRole('button', { name: /Recuperar borrador/i })).toBeNull();
    expect(screen.queryByText(/Borrador encontrado/i)).toBeNull();
  });
});
