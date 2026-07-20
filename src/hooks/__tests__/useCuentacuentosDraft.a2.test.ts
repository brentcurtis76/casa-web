/**
 * A2 — `enqueueGeneratedSnapshot`: puente entre `AppliedIdentity` del pipeline
 * runner y la cola serializada A1. Tests focalizados en las invariantes de la
 * subtask A2/2:
 *
 *   - Toda persistencia fluye por `enqueueDraftWrite`; no hay ruta directa a
 *     Storage/DB desde el adaptador.
 *   - `saveDraftNow` sigue siendo pura y no tiene callers nuevos.
 *   - Pre-enqueue rechaza (no-op) storyId/epoch/itemId/generatedRevision
 *     mismatched.
 *   - Una revisión menor nunca sobreescribe una mayor para el mismo ítem.
 *   - La persistencia es independiente del `runToken` del runner: sólo depende
 *     de `{storyId, epoch, itemId, generatedRevision}`.
 *   - Fallo del upsert propaga al adaptador (=> runner marca `save-failed`).
 *   - Éxito del upsert se resuelve DESPUÉS del I/O (=> runner marca `done`
 *     recién entonces).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mock de Supabase con capture — mismo shape que a1.test.ts para reutilizar el
// patrón de deferreds y aserciones sobre upsertCalls.
// -----------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown> & { image_paths?: Record<string, unknown> };

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

const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const uploadCalls: Array<{ path: string }> = [];
let selectError: { message: string } | null = null;
let upsertError: { message: string } | null = null;
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let mockUserId: string | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (selectError) return { data: null, error: selectError };
      return { data: null, error: null };
    }),
    upsert: vi.fn().mockImplementation(async (payload: UpsertPayload) => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: upsertError };
    }),
    delete: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => {
      uploadCalls.push({ path });
      return { data: { path }, error: null };
    }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: mockUserId ? { id: mockUserId } : null },
        })),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

import { useCuentacuentosDraft, type DraftPatch } from '../useCuentacuentosDraft';

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  upsertDeferreds.length = 0;
  selectError = null;
  upsertError = null;
  mockUserId = null;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  );
});

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

async function mountReadyHook(liturgyId = 'lit-1') {
  mockUserId = 'u1';
  const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

// Snapshot mínimo para las escenas — el adaptador es agnóstico del contenido
// del patch; los tests sólo comprueban ruta y semántica de identidad.
const sampleScenePatch = (): DraftPatch => ({
  currentStep: 'scenes',
  sceneImageOptions: { 1: ['https://cdn/scene-1-a.png'] },
  selectedSceneImages: { 1: 0 },
});

// -----------------------------------------------------------------------------
// A2.1 — Ruta única: la persistencia fluye por `enqueueDraftWrite`.
// Verificamos que `saveDraftNow` no tiene un caller nuevo revisando el upsert
// que llega a Supabase: pasa por la cola (mismo shape que enqueueDraftWrite).
// -----------------------------------------------------------------------------
describe('A2.1 ruta única de persistencia (enqueueDraftWrite)', () => {
  it('el adaptador encola vía enqueueDraftWrite; upsert se llama exactamente una vez con el patch', async () => {
    const result = await mountReadyHook();

    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 1,
        },
      });
    });

    expect(upsertCalls).toHaveLength(1);
    // El upsert es el del `enqueueDraftWrite` (mismo shape con current_step).
    expect((upsertCalls[0].payload as { current_step: string }).current_step).toBe('scenes');
  });
});

// -----------------------------------------------------------------------------
// A2.2 — Pre-enqueue guards: storyId/epoch/generatedRevision mismatch = no-op.
// -----------------------------------------------------------------------------
describe('A2.2 pre-enqueue guards (identity/revision mismatch = no-op)', () => {
  it('storyId distinto al activo: no encola, no upsert, resuelve {stale:true}', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    const ret = await result.current.enqueueGeneratedSnapshot({
      patch: sampleScenePatch(),
      identity: {
        storyId: 'story-OTHER',
        epoch: 0,
        itemId: 'scene-1',
        generatedRevision: 1,
      },
    });

    // A3a/S3 subtask 3: contrato discriminado — stale devuelve
    // `{stale:true}` (el adaptador lo mapea a PERSIST_STALE para el runner).
    expect(ret).toEqual({ stale: true });
    expect(upsertCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
  });

  it('epoch distinto al vivo: no encola, no upsert', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    await result.current.enqueueGeneratedSnapshot({
      patch: sampleScenePatch(),
      identity: {
        storyId: 'story-1',
        epoch: 99,
        itemId: 'scene-1',
        generatedRevision: 1,
      },
    });

    expect(upsertCalls).toHaveLength(0);
  });

  it('generatedRevision <= reservada para el mismo itemId: no encola', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Primer write: rev 3 se reserva.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 3,
        },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Intento con rev = 3 (igual): stale, no-op.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 3,
        },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Intento con rev = 2 (menor): stale, no-op.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 2,
        },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Rev = 4 (mayor): pasa.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 4,
        },
      });
    });
    expect(upsertCalls).toHaveLength(2);
  });

  it('reservas por-ítem son independientes: rev N en item A no bloquea rev 1 en item B', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'A', generatedRevision: 5 },
      });
    });
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'B', generatedRevision: 1 },
      });
    });

    expect(upsertCalls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// A2.3 — Fuera de orden: una rev menor encolada DESPUÉS de una mayor queda
// no-op incluso si la mayor todavía no persistió (reserva síncrona).
// -----------------------------------------------------------------------------
describe('A2.3 reserva síncrona (rev menor encolada después queda no-op)', () => {
  it('rev 3 encolada primero (suspendida en cola); rev 2 encolada después queda no-op', async () => {
    const dfd3 = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd3);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let opHigh: Promise<void | { stale: true }>;
    let opLow: Promise<void | { stale: true }>;
    act(() => {
      opHigh = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 3 },
      });
      // rev 2 se encola DESPUÉS de la rev 3. Reserva síncrona la marca no-op.
      opLow = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      });
    });

    // La rev menor resuelve inmediato (no-op) con el contrato discriminado
    // A3a/S3 subtask 3: `{stale:true}`.
    await expect(opLow!).resolves.toEqual({ stale: true });
    // La rev mayor sigue esperando su deferred en la cola.
    await flushMicrotasks();
    expect(upsertCalls).toHaveLength(1);

    await act(async () => {
      dfd3.resolve({ error: null });
      await opHigh!;
    });

    // Sólo el upsert de la rev mayor llegó.
    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// A2.4 — Fallo de I/O: la promesa del adaptador rechaza con el error real, para
// que el runner marque `save-failed`.
// -----------------------------------------------------------------------------
describe('A2.4 fallo de I/O propagado al runner (save-failed)', () => {
  it('upsert rechaza: enqueueGeneratedSnapshot rechaza con el mismo error', async () => {
    upsertError = { message: 'db down' };
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    await expect(
      result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-1',
          generatedRevision: 1,
        },
      })
    ).rejects.toThrow(/db down/);
  });
});

// -----------------------------------------------------------------------------
// A2.5 — Éxito: resuelve DESPUÉS de que la escritura completó (upsert real).
// El runner marca `done` sólo cuando la persistencia resolvió, así que este
// orden es la garantía end-to-end que el runner necesita.
// -----------------------------------------------------------------------------
describe('A2.5 commit success observable antes de done', () => {
  it('la promesa del adaptador NO resuelve antes del upsert; resuelve tras el upsert', async () => {
    const dfd = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let resolved = false;
    let op: Promise<void>;
    act(() => {
      op = result.current
        .enqueueGeneratedSnapshot({
          patch: sampleScenePatch(),
          identity: {
            storyId: 'story-1',
            epoch: 0,
            itemId: 'scene-1',
            generatedRevision: 1,
          },
        })
        .then(() => {
          resolved = true;
        });
    });

    // Esperar a que el upsert arranque (pasa por select+upload antes). Sigue
    // suspendido en el deferred; el adaptador todavía no puede haber resuelto.
    await waitFor(() => expect(upsertCalls).toHaveLength(1));
    expect(resolved).toBe(false);

    await act(async () => {
      dfd.resolve({ error: null });
      await op!;
    });

    expect(resolved).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// A2.6 — Independiente del `runToken`: el adaptador no lo consulta ni depende
// de él. Verificamos que persiste igual antes/después de cualquier "corrida"
// de pipeline: el hook no tiene nada equivalente a runToken.
// -----------------------------------------------------------------------------
describe('A2.6 persistencia independiente del runToken', () => {
  it('persiste con el mismo {storyId,epoch,itemId,generatedRevision} independientemente del contexto', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // El adaptador NO recibe runToken en su firma. Con la misma identidad,
    // dos writes en revs distintas ambos persisten (rev 1 y rev 2).
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      });
    });

    expect(upsertCalls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// A2.7 — Reset de reservas en transición de lifecycle: reemplazar el storyId
// permite volver a usar la revisión 1 sobre el ítem "scene-1" del nuevo cuento.
// -----------------------------------------------------------------------------
describe('A2.7 reset de reservas en transición de lifecycle', () => {
  it('cambiar storyId resetea reservas por ítem: rev 1 sobre el nuevo story pasa', async () => {
    const result = await mountReadyHook();

    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 5 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Reemplazar story → epoch queda igual porque el hook no lo bumpea, pero
    // la reserva por ítem SÍ se resetea.
    act(() => {
      result.current.setActiveDraftStoryId('story-2');
    });

    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-2', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    // Se hizo un segundo upsert bajo el nuevo storyId + rev fresca.
    expect(upsertCalls).toHaveLength(2);
  });

  it('bumpDraftEpoch resetea reservas por ítem', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 5 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    act(() => {
      result.current.bumpDraftEpoch();
    });

    // Nuevo epoch = 1 (el bump). Rev 1 sobre el mismo item pasa porque la
    // reserva se limpió con el bump de lifecycle.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 1, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// F1 — `getDraftIdentity`: getter estable que devuelve la identidad viva del
// hook (leída desde refs). No captura valores del render en el que se creó.
// -----------------------------------------------------------------------------
describe('F1 getDraftIdentity (stable live-identity getter)', () => {
  it('devuelve el estado inicial (storyId=null, epoch=0)', async () => {
    const result = await mountReadyHook();
    expect(result.current.getDraftIdentity()).toEqual({ storyId: null, epoch: 0 });
  });

  it('refleja setActiveDraftStoryId y bumpDraftEpoch sin necesidad de re-render', async () => {
    const result = await mountReadyHook();

    // Capturar el getter EN ESTE render — luego mutamos identidad y el mismo
    // getter debe devolver los nuevos valores (nunca los del render de captura).
    const capturedGetter = result.current.getDraftIdentity;
    expect(capturedGetter()).toEqual({ storyId: null, epoch: 0 });

    act(() => {
      result.current.setActiveDraftStoryId('story-A');
    });
    expect(capturedGetter()).toEqual({ storyId: 'story-A', epoch: 0 });

    act(() => {
      result.current.bumpDraftEpoch();
    });
    expect(capturedGetter()).toEqual({ storyId: 'story-A', epoch: 1 });

    act(() => {
      result.current.setActiveDraftStoryId('story-B');
    });
    expect(capturedGetter()).toEqual({ storyId: 'story-B', epoch: 1 });
  });

  it('la referencia del getter es estable entre renders', async () => {
    const result = await mountReadyHook();
    const g1 = result.current.getDraftIdentity;
    // Forzar re-render vía mutación de estado.
    act(() => {
      result.current.setActiveDraftStoryId('story-x');
    });
    const g2 = result.current.getDraftIdentity;
    expect(g2).toBe(g1);
  });
});

// -----------------------------------------------------------------------------
// F2 — Estado por ítem `reserved | committed | failed` sobre `enqueueGeneratedSnapshot`.
// -----------------------------------------------------------------------------
describe('F2 estado por ítem (reserved | committed | failed)', () => {
  it('epoch 1 (tras bumpDraftEpoch) se acepta bajo la nueva identidad', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
      result.current.bumpDraftEpoch();
    });
    // La identidad viva ahora es {story-1, epoch=1}: writes con esa identidad pasan.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 1, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(1);
    // Uno con epoch=0 (viejo) es no-op.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      });
    });
    expect(upsertCalls).toHaveLength(1);
  });

  it('first failed write puede reintentarse con la MISMA revision y produce OTRO write real', async () => {
    // Primer upsert rechaza; segundo upsert resuelve.
    const dfd1 = makeDeferred<{ error: { message: string } }>();
    const dfd2 = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd1, dfd2);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Attempt #1: rev 1 → reserved → upsert en vuelo.
    let op1: Promise<void>;
    act(() => {
      op1 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Rechazar attempt #1: enqueueDraftWrite propaga error → estado pasa a 'failed'.
    await act(async () => {
      dfd1.resolve({ error: { message: 'db burned' } });
      await expect(op1!).rejects.toThrow(/db burned/);
    });

    // Attempt #2: MISMA revision (1). El estado 'failed' permite reintentar.
    let op2: Promise<void>;
    act(() => {
      op2 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });

    // Se disparó un SEGUNDO upsert real (no fue un no-op ni un short-circuit).
    await waitFor(() => expect(upsertCalls).toHaveLength(2));

    await act(async () => {
      dfd2.resolve({ error: null });
      await op2!;
    });
  });

  it('repeated failure: rechazos sucesivos mantienen `failed` y propagan el error cada vez', async () => {
    const dfd1 = makeDeferred<{ error: { message: string } }>();
    const dfd2 = makeDeferred<{ error: { message: string } }>();
    const dfd3 = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd1, dfd2, dfd3);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Intento #1 falla.
    let op1: Promise<void>;
    act(() => {
      op1 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));
    await act(async () => {
      dfd1.resolve({ error: { message: 'boom-1' } });
      await expect(op1!).rejects.toThrow(/boom-1/);
    });

    // Intento #2 con MISMA rev — permitido (estado 'failed') — vuelve a fallar.
    let op2: Promise<void>;
    act(() => {
      op2 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(2));
    await act(async () => {
      dfd2.resolve({ error: { message: 'boom-2' } });
      await expect(op2!).rejects.toThrow(/boom-2/);
    });

    // Intento #3 con MISMA rev — sigue siendo 'failed' → reintento permitido.
    // Esta vez resuelve: el estado pasa a 'committed'.
    let op3: Promise<void>;
    act(() => {
      op3 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(3));
    await act(async () => {
      dfd3.resolve({ error: null });
      await op3!;
    });

    // Post-committed: un nuevo intento con la MISMA rev = 1 es no-op (ya no está failed).
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(3);
  });

  it('post-success: mismo rev queda no-op (state=committed); rev mayor pasa', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Rev 1 commit exitoso.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Mismo rev = 1 tras committed → no-op.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Rev 2 (mayor) pasa.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      });
    });
    expect(upsertCalls).toHaveLength(2);
  });

  it('rev N NO puede sobreescribir rev N+1: tras committed en N+1, rev N es no-op', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Rev 3 committed.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 3 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Rev 2 (menor) llega después: no-op estricta.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      });
    });
    expect(upsertCalls).toHaveLength(1);
  });

  it('rev N NO puede sobreescribir rev N+1 tras fallo de N+1: rev N sigue siendo no-op', async () => {
    const dfd = makeDeferred<{ error: { message: string } }>();
    upsertDeferreds.push(dfd);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Rev 5 falla.
    let opHi: Promise<void>;
    act(() => {
      opHi = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 5 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));
    await act(async () => {
      dfd.resolve({ error: { message: 'nope' } });
      await expect(opHi!).rejects.toThrow(/nope/);
    });

    // Rev 4 (menor) intento — no-op: la regla es estrictamente por revisión,
    // no por estado. Sólo la MISMA rev fallada puede reintentar.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 4 },
      });
    });
    expect(upsertCalls).toHaveLength(1);
  });

  it('provider generation NUNCA se repite durante save-only retry: adapter no invoca provider ni upload', async () => {
    // El adaptador RECIBE `patch: DraftPatch` — no una task con `provider`.
    // Por construcción no puede regenerar. Verificamos concretamente que un
    // retry con la misma rev no incrementa uploads (upload = síntoma clásico
    // de nuevo procesamiento). El patch sólo contiene URLs (no base64), así
    // que el conteo esperado es 0 antes y después.
    const dfd1 = makeDeferred<{ error: { message: string } }>();
    const dfd2 = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd1, dfd2);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let op1: Promise<void>;
    act(() => {
      op1 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));
    await act(async () => {
      dfd1.resolve({ error: { message: 'transient' } });
      await expect(op1!).rejects.toThrow(/transient/);
    });

    // Registrar el conteo de "trabajo" acumulado antes del retry.
    const uploadsBefore = uploadCalls.length;

    // Save-only retry con la MISMA rev.
    let op2: Promise<void>;
    act(() => {
      op2 = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(2));
    await act(async () => {
      dfd2.resolve({ error: null });
      await op2!;
    });

    // El retry SÍ hizo otro upsert real (persistencia repetida — expected),
    // pero NO ejecutó nada equivalente a "provider generation": ni el
    // adaptador ni la cola llaman a un provider. Como proxy fuerte de eso,
    // no se materializaron uploads adicionales por el retry.
    expect(uploadCalls.length).toBe(uploadsBefore);
  });

  it('storyId/epoch mismatch tras un committed: sigue siendo no-op (no re-abre el estado)', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Rev 1 committed.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Cambio de identidad: bump epoch. La reserva por ítem se resetea (contract).
    act(() => {
      result.current.bumpDraftEpoch();
    });

    // Un write con la identidad VIEJA queda no-op (epoch mismatch),
    // NO revive el estado ni pisa la reserva post-reset.
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 5 },
      });
    });
    expect(upsertCalls).toHaveLength(1);

    // Rev 1 sobre la NUEVA identidad pasa (reset limpió la reserva).
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 1, itemId: 'scene-1', generatedRevision: 1 },
      });
    });
    expect(upsertCalls).toHaveLength(2);
  });
});
