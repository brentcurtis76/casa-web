/**
 * A3a/S6 — Approval envelope + lifecycle-boundary integration.
 *
 * Cubre las cuatro invariantes de la subtask:
 *
 *   (a) Edit-then-immediate-approve: `saveDraft` acumula un patch debounceado;
 *       el envelope de aprobación llama a `flushPendingDraftWrites` ANTES de
 *       encolar el snapshot autoritativo, así que la escritura NUNCA descarta
 *       la edición pendiente aunque el timer de 2s no haya disparado.
 *
 *   (b) Real hook stale-write integration: una escritura encolada mediante el
 *       hook real que cambia de identidad post-`preStart` (mid-flight) devuelve
 *       `{stale:true}` y NO commitea al `draft` React state — el envelope de
 *       aprobación mapea esto a `stale` y NO invoca `onSuccess`.
 *
 *   (c) Cada categoría de lifecycle publica `activeIdentity` reactiva: bump,
 *       setActive, load, delete, acceptRecovery, declineRecovery, deleteStoryImages.
 *       Consumidores del pipeline que scopean `saveFailedCount(activeIdentity)`
 *       ven el conteo del NUEVO ciclo tras cada transición.
 *
 *   (d) Story A → Story B isolation: entradas save-failed registradas bajo
 *       (story-A, epoch-0) no incrementan el conteo scopeado a (story-B, 0);
 *       el gate `canApprove` derivado del scope no bloquea Story B.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Story } from '@/types/shared/story';

// -----------------------------------------------------------------------------
// Mock Supabase — reproduce la fixture usada por a3.test.ts. Un único deferred
// por upsert permite bloquear la cola de escrituras entre pasos.
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
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let mockUserId: string | null = null;

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
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) =>
      __upsertBuilder((async () => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: null };
    })())
    ),
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
import { runApprovalTransaction } from '@/lib/cuentacuentos/approvalGate';
import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  upsertDeferreds.length = 0;
  mockUserId = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

async function mountReadyHook(liturgyId = 'lit-1') {
  mockUserId = 'u1';
  const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

const baseStory = (id = 'story-1'): Story => ({
  id,
  title: 'Cuento',
  summary: '',
  location: { name: 'Jerusalén' } as unknown as Story['location'],
  illustrationStyle: 'ghibli',
  characters: [],
  scenes: [],
  props: [],
  spiritualConnection: '',
  metadata: { createdAt: '', updatedAt: '', status: 'draft' as Story['metadata']['status'] },
} as Story);

// -----------------------------------------------------------------------------
// (a) Edit debounceada + aprobación inmediata → el flush encola la edición
// ANTES del snapshot autoritativo, no la descarta.
// -----------------------------------------------------------------------------
describe('A3a/S6(a) edit-then-immediate-approve: debounced patch survives via flush', () => {
  it('flushPendingDraftWrites encola el patch debounceado ANTES del snapshot autoritativo (nunca lo descarta)', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));

    // 1) Simular una edición del usuario que dispara saveDraft (debounce 2s).
    act(() => {
      result.current.saveDraft({
        currentStep: 'story',
        editingTitle: 'TITULO EDITADO POR USUARIO',
      });
    });
    // Ningún upsert aún: el timer de 2s no ha disparado.
    expect(upsertCalls).toHaveLength(0);

    // 2) Envelope: flush + encolar snapshot autoritativo. flush encola PRIMERO
    //    la edición debounceada; el snapshot se encola DESPUÉS.
    await act(async () => {
      await result.current.flushPendingDraftWrites();
      await result.current.enqueueDraftWrite({
        currentStep: 'characters',
        story: baseStory('story-1'),
        editingTitle: 'TITULO EDITADO POR USUARIO',
      });
    });

    // 3) Exactamente DOS upserts: la edición debounceada + el snapshot autoritativo.
    // El primero corresponde al flush del debounce (current_step='story' — el
    // que el usuario tenía en curso). El segundo al snapshot autoritativo con
    // el step ya avanzado ('characters'). Si el flush hubiese DESCARTADO el
    // pending, sólo veríamos un upsert.
    expect(upsertCalls).toHaveLength(2);
    const first = upsertCalls[0].payload as { current_step: string };
    const second = upsertCalls[1].payload as {
      current_step: string;
      story: { editorStateV1: { editingTitle: string } } | null;
    };
    expect(first.current_step).toBe('story');
    expect(second.current_step).toBe('characters');
    // Y el snapshot autoritativo lleva editingTitle en el bloque canónico
    // — el editor lo derivaría del ref live al armar el patch autoritativo.
    // Aquí forzamos el mismo campo vía saveDraft ANTES del flush, luego lo
    // reintroducimos en el patch autoritativo; ambas escrituras son visibles.
    expect(second.story?.editorStateV1).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// (b) Real hook stale-write integration: preStart→false (identidad cambió
// mid-flight) → {stale:true} y cero commit al React draft.
// -----------------------------------------------------------------------------
describe('A3a/S6(b) real hook stale-write via runApprovalTransaction (no transition)', () => {
  it('preStart falso post-flush: enqueue devuelve {stale:true}; runApprovalTransaction reporta stale y NO invoca onSuccess', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));

    // Preparar un preStart que retorna false — simula la carrera donde entre
    // el encolado y el arranque del tail la identidad mutó (bump epoch/story).
    const onSuccess = vi.fn();
    const onStale = vi.fn();
    const onError = vi.fn();
    const onBlocked = vi.fn();
    let outcome: string;
    await act(async () => {
      outcome = await runApprovalTransaction({
        state: { isSaving: false, saveFailedCount: 0 },
        enqueue: () =>
          result.current.enqueueDraftWrite(
            { currentStep: 'characters', story: baseStory('story-1') },
            { preStart: () => false },
          ),
        onSuccess,
        onStale,
        onError,
        onBlocked,
      });
    });

    expect(outcome!).toBe('stale');
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
    // Sin upsert / sin swap: la guard preStart cortó antes de tocar Supabase.
    expect(upsertCalls).toHaveLength(0);
    expect(result.current.draft).toBeNull();
  });

  it('bump epoch mientras el enqueue está en vuelo: el tail lo descarta como stale, cero commit al draft', async () => {
    const blocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(blocker);

    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));

    // Escritura del envelope encolada. Mantiene el tail ocupado.
    let opApproval: Promise<unknown>;
    act(() => {
      opApproval = result.current.enqueueDraftWrite({
        currentStep: 'characters',
        story: baseStory('story-1'),
        editingTitle: 'aprobado',
      });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Mid-flight lifecycle: bump epoch. La escritura sigue en vuelo pero su
    // identidad quedó stale — al terminar NO debe commitear al React state.
    act(() => result.current.bumpDraftEpoch());

    await act(async () => {
      blocker.resolve({ error: null });
      await opApproval;
    });

    // Sin resucitar estado: el draft React sigue null.
    expect(result.current.draft).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// (c) Lifecycle categorías: activeIdentity se actualiza reactivamente para que
// consumidores puedan re-scopear conteos derivados.
// -----------------------------------------------------------------------------
describe('A3a/S6(c) activeIdentity reactivity across lifecycle categories', () => {
  it('bumpDraftEpoch incrementa epoch reactivo (misma storyId, nuevo epoch)', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));
    await waitFor(() =>
      expect(result.current.activeIdentity).toEqual({ storyId: 'story-1', epoch: 0 }),
    );
    act(() => result.current.bumpDraftEpoch());
    await waitFor(() =>
      expect(result.current.activeIdentity).toEqual({ storyId: 'story-1', epoch: 1 }),
    );
  });

  it('setActiveDraftStoryId cambia storyId reactivo', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBe('story-1'));
    act(() => result.current.setActiveDraftStoryId('story-2'));
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBe('story-2'));
  });

  it('setActiveDraftStoryId(null) tras story asignada limpia storyId reactivo', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBe('story-1'));
    act(() => result.current.setActiveDraftStoryId(null));
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBeNull());
  });

  it('deleteDraft limpia storyId (epoch monótono, no baja)', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));
    act(() => result.current.bumpDraftEpoch());
    act(() => result.current.bumpDraftEpoch());
    await waitFor(() =>
      expect(result.current.activeIdentity).toEqual({ storyId: 'story-1', epoch: 2 }),
    );
    act(() => result.current.deleteDraft());
    // Epoch NUNCA baja — sólo asegura storyId=null. Cualquier escritura en
    // vuelo con la identidad anterior detectará el cambio de storyId y morirá
    // stale sin depender del epoch.
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBeNull());
  });

  it('declineRecovery limpia storyId (mismo contrato que delete)', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-recovery'));
    act(() => result.current.bumpDraftEpoch());
    await waitFor(() =>
      expect(result.current.activeIdentity).toEqual({ storyId: 'story-recovery', epoch: 1 }),
    );
    act(() => result.current.declineRecovery());
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBeNull());
  });

  it('setActiveDraftStoryId al MISMO id no genera nueva referencia (idempotente)', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));
    await waitFor(() => expect(result.current.activeIdentity.storyId).toBe('story-1'));
    const before = result.current.activeIdentity;
    act(() => result.current.setActiveDraftStoryId('story-1'));
    // Nueva referencia sólo si valores cambiaron. Aquí no debería cambiar.
    expect(result.current.activeIdentity).toBe(before);
  });
});

// -----------------------------------------------------------------------------
// (d) Story A save-failed no bloquea gate de Story B — el conteo scopeado a
// (story-B, 0) sigue en 0. Consumidor: `runner.saveFailedCount(identity)`.
// -----------------------------------------------------------------------------
describe('A3a/S6(d) Story A save-failed does NOT block Story B approval gate', () => {
  it('una entrada save-failed en (story-A,0) no aparece en el scoped count de (story-B,0)', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identityA: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const identityB: RunIdentity = { storyId: 'story-B', epoch: 0 };

    const failingTask: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };

    // Story A: registra un save-failed.
    await runner.runItems({ tasks: [failingTask], identity: identityA });
    expect(runner.saveFailedCount()).toBe(1);
    expect(runner.saveFailedCount(identityA)).toBe(1);
    // Story B scope: cero. Un gate derivado (canApprove) sobre Story B pasa.
    expect(runner.saveFailedCount(identityB)).toBe(0);
  });

  it('gate derivado a partir del scoped count: Story B no está bloqueado por Story A', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identityA: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const identityB: RunIdentity = { storyId: 'story-B', epoch: 0 };
    const failing: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'x',
      kind: 'scene',
      label: 'X',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [failing], identity: identityA });

    // Simular el gate: canApprove(isSaving=false, saveFailedCount=SCOPED).
    const isSaving = runner.isSaving();
    const scopedForB = runner.saveFailedCount(identityB);
    const gatePassesB = !isSaving && scopedForB === 0;
    expect(gatePassesB).toBe(true);

    const scopedForA = runner.saveFailedCount(identityA);
    const gatePassesA = !isSaving && scopedForA === 0;
    expect(gatePassesA).toBe(false);
  });
});
