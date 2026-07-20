/**
 * A3a/S2 — Unconditional operation-start identity guard.
 *
 * Invariante: TODA escritura encolada (sin importar si el caller aporta
 * `preStart`) revalida la identidad capturada al ENCOLAR contra las refs
 * vivas en el momento EXACTO en que el tail arranca la operación, ANTES de
 * cualquier efecto (upsert Supabase, upload Storage, URL swap, React
 * commit). Un mismatch resuelve la promesa con `{stale:true}` y cero
 * side-effects observables.
 *
 * Este test cubre la carrera de producción determinística que la subtask
 * exige: el debounced `saveDraft` NO tiene forma de pasar `preStart`, así
 * que sin el guard incondicional un patch encolado bajo identidad A
 * ejecutaría upsert bajo identidad B tras un cambio de lifecycle. El guard
 * incondicional garantiza que la persistencia se salta con `{stale:true}`
 * sin depender de que el caller supla el preStart.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mock Supabase — misma fixture usada por a3/subtask6, con deferred por upsert
// para bloquear el tail entre pasos.
// -----------------------------------------------------------------------------
type UpsertPayload = Record<string, unknown>;
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
const removedPaths: string[] = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let mockUserId: string | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
    upsert: vi.fn().mockImplementation(async (payload: UpsertPayload) => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: null };
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
    remove: vi.fn().mockImplementation(async (paths: string[]) => {
      removedPaths.push(...paths);
      return { error: null };
    }),
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

import {
  useCuentacuentosDraft,
  type EnqueueDraftWriteResult,
  type EnqueueDraftWriteStale,
} from '../useCuentacuentosDraft';

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  removedPaths.length = 0;
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

// -----------------------------------------------------------------------------
// F2 — Deterministic production race WITHOUT preStart. The queued write
// (enqueueDraftWrite sin opciones) captura la identidad al encolar; la
// identidad cambia mientras el tail está bloqueado; al arrancar la
// operación, el guard incondicional detecta el mismatch y corta cero-efectos.
// -----------------------------------------------------------------------------
describe('A3a/S2 unconditional operation-start guard (enqueueDraftWrite sin preStart)', () => {
  it('epoch bump entre enqueue y arranque: {stale:true}, cero upsert/upload/commit sin forzar preStart', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();

    // Blocker ocupa el tail (upsert diferido). Deja una ventana determinística
    // entre el momento en que encolamos el segundo write y el momento en que
    // el tail lo arranca.
    let opBlock: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Encolar bajo identidad A (epoch 0) SIN pasar preStart — este es el
    // caso que el guard incondicional debe cubrir. Un caller normal
    // (saveDraft debounced, o cualquier consumidor del enqueue crudo) no
    // aporta preStart; la protección no puede depender de él.
    let opStale: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opStale = result.current.enqueueDraftWrite({ currentStep: 'scenes' });
    });

    // Cambio de identidad ANTES de que el tail arranque el segundo write.
    // El guard incondicional debe comparar {storyId, epoch, revision}
    // capturados al encolar contra las refs vivas y devolver stale.
    act(() => {
      result.current.bumpDraftEpoch();
    });

    // Liberar el blocker: el tail avanza y arranca la operación stale.
    // Sin el guard incondicional, esto ejecutaría saveDraftNow bajo la
    // identidad nueva y produciría un upsert espurio.
    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    let staleResult: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      staleResult = await opStale;
    });

    // Shape explícito {stale:true} — el caller distingue esto de éxito o
    // fallo sin inspeccionar side-effects.
    expect(staleResult).toEqual({ stale: true });

    // Cero efectos post-arranque para el write stale:
    //  - Sólo el upsert del blocker (que estaba ya en vuelo antes del bump).
    //  - Cero uploads: el guard corta antes de saveDraftNow.
    //  - Cero remove sobre Storage.
    //  - Cero React commit: draft y lastSavedAt siguen null (el blocker
    //    también quedó stale por el bump post-await).
    expect(upsertCalls).toHaveLength(1);
    expect(uploadCalls).toHaveLength(0);
    expect(removedPaths).toHaveLength(0);
    expect(result.current.draft).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('storyId reset entre enqueue y arranque (sin preStart): {stale:true}, cero I/O', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-A'));

    let opBlock: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    let opStale: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opStale = result.current.enqueueDraftWrite({ currentStep: 'characters' });
    });

    // Cambiar storyId antes del arranque del write stale.
    act(() => {
      result.current.setActiveDraftStoryId('story-B');
    });

    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    let staleResult: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      staleResult = await opStale;
    });

    expect(staleResult).toEqual({ stale: true });
    // Sólo el blocker ejecutó upsert; el write stale se cortó en el guard.
    expect(upsertCalls).toHaveLength(1);
    expect(uploadCalls).toHaveLength(0);
  });

  it('revision bump entre enqueue y arranque (sin preStart): {stale:true}, cero I/O', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));

    let opBlock: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    let opStale: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opStale = result.current.enqueueDraftWrite({ currentStep: 'scenes' });
    });

    act(() => {
      result.current.bumpDraftStoryRevision();
    });

    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    let staleResult: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      staleResult = await opStale;
    });

    expect(staleResult).toEqual({ stale: true });
    expect(upsertCalls).toHaveLength(1);
    expect(uploadCalls).toHaveLength(0);
  });

  it('saveDraft debounced bajo identidad A + bump epoch ANTES del debounce: al disparar el timer, cero upsert', async () => {
    const result = await mountReadyHook();
    act(() => result.current.setActiveDraftStoryId('story-1'));

    // Usamos fake timers sólo para este caso para controlar el debounce de 2s
    // sin esperar tiempo real.
    vi.useFakeTimers();

    try {
      // saveDraft encola un patch pendiente con la identidad viva al llegar.
      // No hay preStart en esta ruta — es exactamente el escenario que la
      // subtask apunta a proteger.
      act(() => {
        result.current.saveDraft({ currentStep: 'story', editingTitle: 'edit A' });
      });
      expect(upsertCalls).toHaveLength(0);

      // Cambio de lifecycle ANTES de que el timer del debounce dispare.
      act(() => {
        result.current.bumpDraftEpoch();
      });

      // Disparar el debounce: performDraftWrite arranca con la identidad
      // capturada al encolar. El guard incondicional detecta el mismatch y
      // corta la operación — ningún upsert debe ocurrir.
      await act(async () => {
        vi.advanceTimersByTime(2100);
        // Dar oportunidad a las microtasks encoladas por el timer.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(upsertCalls).toHaveLength(0);
      expect(uploadCalls).toHaveLength(0);
      expect(result.current.draft).toBeNull();
      expect(result.current.lastSavedAt).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
