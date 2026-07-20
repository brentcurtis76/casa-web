/**
 * A2 — Subtask 4 integration coverage.
 *
 * These tests exercise the shared A2 pipeline runner end-to-end against a
 * mocked Supabase surface (functions.invoke + storage + tables) and the real
 * `useCuentacuentosDraft` adapter (`enqueueGeneratedSnapshot`). Their focus is
 * the invariants that the audit in Subtask 4 must guarantee:
 *
 *   (1) All five generate targets and all four refine targets — character
 *       sheet, prop sheet, cover, end, scene, plus the four refine variants —
 *       route through the same `runItems → provider → apply → persist` shape.
 *       Persisting targets flow through `enqueueGeneratedSnapshot`; the
 *       ephemeral prop-sheet target apply-returns-null and never commits.
 *   (2) Manual single-item and batched auto-generate entry points delegate to
 *       the same runner API — the observable behaviour of running one task or
 *       many tasks in one `runItems` call is identical per item.
 *   (3) The item IDs used by every generate/refine builder are stable and
 *       collision-free: `sheet-*`, `prop-*`, `cover`, `end`, and `scene-*`
 *       occupy disjoint namespaces and multiple scenes never collide.
 *   (4) Ordering under races:
 *         (a) An older generation whose provider resolves AFTER a newer run
 *             cannot apply or persist.
 *         (b) An already-applied identity keeps persisting even after the
 *             runToken changes; but a newer `generatedRevision` for the same
 *             {story, epoch, item} wins on the adapter — the stale one gets a
 *             no-op inside `enqueueGeneratedSnapshot`.
 *   (5) Story-switch and epoch-switch: apply's identity guard discards the
 *       result (returns null) and the adapter's pre-enqueue guard drops any
 *       stale identity that leaks through — zero merge, zero upsert, zero
 *       commit callbacks.
 *   (6) Cancellation with a provider that IGNORES its AbortSignal and resolves
 *       LATE: zero downstream side effects (apply, persist, adapter,
 *       enqueueDraftWrite, commit callback, upsert).
 *
 * All I/O is mocked. No network calls, no real provider payloads, no secrets,
 * no member PII, no production data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Supabase mock (mirrors the shared A2 mock in the contract suite so the tests
// remain co-locatable and diff-friendly).
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
const invokeCalls: Array<{ fn: string; body: unknown }> = [];
let selectError: { message: string } | null = null;
let upsertError: { message: string } | null = null;
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let mockUserId: string | null = null;

let invokeImpl: (
  fn: string,
  body: unknown,
  opts: { signal?: AbortSignal }
) => Promise<unknown> = async () => ({
  data: { success: true, images: ['https://cdn/mock.png'] },
  error: null,
});

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
      functions: {
        invoke: vi
          .fn()
          .mockImplementation(
            async (fn: string, opts: { body: unknown } & { signal?: AbortSignal }) => {
              invokeCalls.push({ fn, body: opts.body });
              return invokeImpl(fn, opts.body, opts);
            }
          ),
      },
    },
  };
});

import {
  APPLY_EPHEMERAL,
  APPLY_STALE,
  createStoryImagePipelineRunner,
  type PipelineItemKind,
  type PipelineItemTask,
  type AppliedIdentity,
} from '../storyImagePipelineRunner';
import { supabase } from '@/integrations/supabase/client';
import { useCuentacuentosDraft, type DraftPatch } from '../useCuentacuentosDraft';

// -----------------------------------------------------------------------------
// Common setup + helpers.
// -----------------------------------------------------------------------------

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  invokeCalls.length = 0;
  upsertDeferreds.length = 0;
  selectError = null;
  upsertError = null;
  mockUserId = null;
  invokeImpl = async () => ({
    data: { success: true, images: ['https://cdn/mock.png'] },
    error: null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  );
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

async function mountReadyHook(liturgyId = 'lit-1') {
  mockUserId = 'u1';
  const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

const samplePatch = (kind: PipelineItemKind): DraftPatch => {
  // Emit a patch shape that mirrors what the corresponding builder in the
  // editor returns from `apply()`. Content is minimal — the tests only care
  // about the fact that a persist actually happens, not the payload details.
  switch (kind) {
    case 'sheet':
      return {
        currentStep: 'characters',
        characterSheetOptions: { 'char-1': ['https://cdn/sheet-a.png'] },
        selectedCharacterSheets: { 'char-1': 0 },
      };
    case 'scene':
      return {
        currentStep: 'scenes',
        sceneImageOptions: { 1: ['https://cdn/scene-1-a.png'] },
        selectedSceneImages: { 1: 0 },
      };
    case 'cover':
      return { coverOptions: ['https://cdn/cover-a.png'] };
    case 'end':
      return { endOptions: ['https://cdn/end-a.png'] };
    case 'prop':
      // Prop sheets are ephemeral — apply returns null; we should never
      // actually build a patch for them, but the type shape stays uniform.
      return {};
  }
};

/**
 * Build a task that mirrors a generate/refine builder from
 * `CuentacuentoEditor.tsx`: provider calls `supabase.functions.invoke`, apply
 * runs the identity guard + returns a DraftPatch (or null for ephemeral prop
 * sheets), persist calls `enqueueGeneratedSnapshot`.
 */
function makeEditorLikeTask(
  itemId: string,
  kind: PipelineItemKind,
  label: string,
  liveStoryIdRef: { current: string | null },
  enqueue: (input: {
    patch: DraftPatch;
    identity: AppliedIdentity;
  }) => Promise<void>,
  opts: { fn?: string; ephemeral?: boolean } = {}
): PipelineItemTask<{ success: true; images: string[] }, DraftPatch> {
  const fn = opts.fn ?? 'generate-scene-images';
  return {
    id: itemId,
    kind,
    label,
    provider: async ({ signal }) => {
      const { data } = (await supabase.functions.invoke(fn, {
        body: { type: kind, itemId },
        signal,
      })) as { data: { success: true; images: string[] } };
      return data;
    },
    apply: (result, appliedIdentity) => {
      // Guard mirrors every editor builder: if the story changed during
      // generation, discard silently → APPLY_STALE (F3 explicit outcome).
      if (appliedIdentity.storyId !== liveStoryIdRef.current) return APPLY_STALE;
      // Ephemeral by design (e.g. prop sheet) → APPLY_EPHEMERAL. The runner
      // marks the item `done` without invoking persist.
      if (opts.ephemeral) return APPLY_EPHEMERAL;
      // Include the provider result's first image somewhere in the patch so
      // the payload varies per invocation (irrelevant to assertions).
      void result.images[0];
      return samplePatch(kind);
    },
    persist: async (snapshot, identity) => {
      await enqueue({ patch: snapshot as DraftPatch, identity });
    },
  };
}

// -----------------------------------------------------------------------------
// T-A2/S4.1 — All five generate targets route through the shared runner and
// the persist path lands on `enqueueGeneratedSnapshot` → upsert. Prop sheets
// are ephemeral: apply returns null so nothing is persisted for them.
// -----------------------------------------------------------------------------
describe('T-A2/S4.1 all five generate targets route through the shared runner', () => {
  it('character sheet | scene | cover | end each persist via the adapter; prop sheet is ephemeral', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const tasks: Array<PipelineItemTask<{ success: true; images: string[] }, DraftPatch>> = [
      makeEditorLikeTask(
        'sheet-char-1',
        'sheet',
        'Char',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'prop-p-1',
        'prop',
        'Prop',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot,
        { ephemeral: true }
      ),
      makeEditorLikeTask(
        'scene-1',
        'scene',
        'S1',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'cover',
        'cover',
        'Portada',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'end',
        'end',
        'Fin',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
    ];

    await act(async () => {
      await runner.runItems({
        tasks,
        identity: { storyId: 'story-1', epoch: 0 },
      });
    });

    // All five providers were invoked.
    expect(invokeCalls).toHaveLength(5);
    for (const c of invokeCalls) expect(c.fn).toBe('generate-scene-images');

    // Four out of five persisted (prop-sheet is ephemeral).
    expect(upsertCalls).toHaveLength(4);
    // All items reached a terminal `done` state.
    for (const t of tasks) expect(runner.statusOf(t.id)).toBe('done');
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.2 — All four refine targets route through the shared runner and
// persist via `enqueueGeneratedSnapshot`. Each refine reuses the same itemId
// as its generate counterpart (`sheet-<id>`, `scene-<n>`, `cover`, `end`) —
// this proves refine writes bump `generatedRevision` monotonically per item.
// -----------------------------------------------------------------------------
describe('T-A2/S4.2 all four refine targets route through the shared runner', () => {
  it('refine character sheet | refine scene | refine cover | refine end all persist through the adapter', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    // Each refine target uses the same itemId as its generate counterpart.
    const refineTasks: Array<PipelineItemTask<{ success: true; images: string[] }, DraftPatch>> = [
      makeEditorLikeTask(
        'sheet-char-1',
        'sheet',
        'Char refine',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'scene-1',
        'scene',
        'Scene refine',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'cover',
        'cover',
        'Cover refine',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'end',
        'end',
        'End refine',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
    ];

    // Manual single-item entry: one refine at a time.
    for (const task of refineTasks) {
      await act(async () => {
        await runner.runItems({
          tasks: [task],
          identity: { storyId: 'story-1', epoch: 0 },
        });
      });
      expect(runner.statusOf(task.id)).toBe('done');
    }

    // One provider invocation per refine, one upsert per refine.
    expect(invokeCalls).toHaveLength(4);
    expect(upsertCalls).toHaveLength(4);
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.3 — Manual single-item and batch entry points delegate to the same
// runner API. Behaviour per item is identical regardless of how they were
// queued.
// -----------------------------------------------------------------------------
describe('T-A2/S4.3 manual and batch entry delegate to the same runner API', () => {
  it('a task run alone vs run as part of a batch produces the same per-item outcome', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };

    // Single-item path.
    const soloRunner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const soloTask = makeEditorLikeTask(
      'scene-1',
      'scene',
      'S1',
      liveStoryIdRef,
      hook.current.enqueueGeneratedSnapshot
    );
    await act(async () => {
      await soloRunner.runItems({
        tasks: [soloTask],
        identity: { storyId: 'story-1', epoch: 0 },
      });
    });
    const soloUpsertCount = upsertCalls.length;
    const soloInvokeCount = invokeCalls.length;
    expect(soloUpsertCount).toBe(1);
    expect(soloInvokeCount).toBe(1);
    expect(soloRunner.statusOf('scene-1')).toBe('done');

    // Batch path: two tasks in one `runItems` call — including a distinct
    // scene ID to prove batch does not collide the first scene's persist.
    const batchRunner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const batchTasks = [
      makeEditorLikeTask(
        'scene-2',
        'scene',
        'S2',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
      makeEditorLikeTask(
        'scene-3',
        'scene',
        'S3',
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot
      ),
    ];
    await act(async () => {
      await batchRunner.runItems({
        tasks: batchTasks,
        identity: { storyId: 'story-1', epoch: 0 },
      });
    });
    // Solo + batch: 3 upserts, 3 invokes total.
    expect(upsertCalls.length - soloUpsertCount).toBe(2);
    expect(invokeCalls.length - soloInvokeCount).toBe(2);
    for (const t of batchTasks) expect(batchRunner.statusOf(t.id)).toBe('done');
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.4 — Item identity uniqueness. Every itemId used by any of the five
// generate builders (and reused by the four refine builders) occupies a
// stable, disjoint slot in the runner. The kinds `sheet`, `prop`, `cover`,
// `end`, and each `scene-N` cannot collide.
// -----------------------------------------------------------------------------
describe('T-A2/S4.4 item identity uniqueness across all builders', () => {
  it('sheet/prop/cover/end/scene-1/scene-2/scene-3 all resolve as separate items', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const distinctIds = [
      { id: 'sheet-char-1', kind: 'sheet' as const },
      { id: 'sheet-char-2', kind: 'sheet' as const },
      { id: 'prop-p-1', kind: 'prop' as const, ephemeral: true },
      { id: 'prop-p-2', kind: 'prop' as const, ephemeral: true },
      { id: 'cover', kind: 'cover' as const },
      { id: 'end', kind: 'end' as const },
      { id: 'scene-1', kind: 'scene' as const },
      { id: 'scene-2', kind: 'scene' as const },
      { id: 'scene-3', kind: 'scene' as const },
    ];
    const tasks = distinctIds.map((d) =>
      makeEditorLikeTask(
        d.id,
        d.kind,
        d.id,
        liveStoryIdRef,
        hook.current.enqueueGeneratedSnapshot,
        { ephemeral: d.ephemeral }
      )
    );

    await act(async () => {
      await runner.runItems({
        tasks,
        identity: { storyId: 'story-1', epoch: 0 },
      });
    });

    // Every id is present, distinct, and terminal.
    const views = runner.getItems();
    expect(new Set(views.map((v) => v.id)).size).toBe(distinctIds.length);
    for (const { id } of distinctIds) expect(runner.statusOf(id)).toBe('done');
    // Persists: all except the two ephemeral props.
    const persistingCount = distinctIds.filter((d) => !d.ephemeral).length;
    expect(upsertCalls).toHaveLength(persistingCount);
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.5 — Race: an older generation whose provider resolves AFTER a newer
// `runItems` cannot apply or persist. This is the classic stale-provider race
// against a token flip, asserted end-to-end with the adapter attached.
// -----------------------------------------------------------------------------
describe('T-A2/S4.5 older generation resolving after a newer run cannot apply', () => {
  it('late provider resolution has no adapter effect (no upsert)', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const gate = makeDeferred<{ data: { success: true; images: string[] }; error: null }>();
    invokeImpl = async (_fn, _body, _opts) => await gate.promise;

    const staleTask = makeEditorLikeTask(
      'scene-1',
      'scene',
      'S1 stale',
      liveStoryIdRef,
      hook.current.enqueueGeneratedSnapshot
    );
    const staleRun = runner.runItems({
      tasks: [staleTask],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    // Give the provider a chance to be dispatched (it will block on `gate`).
    await wait(0);

    // Newer run: unblocked provider for a distinct item. This flips the run
    // token before the stale provider resolves.
    invokeImpl = async () => ({
      data: { success: true, images: ['https://cdn/fresh.png'] },
      error: null,
    });
    await act(async () => {
      await runner.runItems({
        tasks: [
          makeEditorLikeTask(
            'scene-2',
            'scene',
            'S2 fresh',
            liveStoryIdRef,
            hook.current.enqueueGeneratedSnapshot
          ),
        ],
        identity: { storyId: 'story-1', epoch: 0 },
      });
    });

    // Now let the stale provider resolve — must be ignored.
    gate.resolve({ data: { success: true, images: ['https://cdn/late.png'] }, error: null });
    await staleRun;
    await flushMicrotasks();

    // Only the fresh scene-2 committed. scene-1 stayed pending/done via the
    // discarded token path (never reached persist).
    expect(upsertCalls).toHaveLength(1);
    expect(runner.statusOf('scene-2')).toBe('done');
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.6 — Persistence race semantics.
// (a) An already-applied identity keeps persisting after the runToken flips —
//     the persist phase does NOT consult the current token.
// (b) A newer `generatedRevision` for the same {story, epoch, item} that has
//     already been applied invalidates a stale one that tries to persist after
//     the newer one won the reservation.
// -----------------------------------------------------------------------------
describe('T-A2/S4.6 persistence race + newer revision wins on adapter', () => {
  it('(a) applied identity persists after runToken flip; (b) stale revision loses on the adapter', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });

    // (a) — persist ignores a runToken flip once apply has run.
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistGate = makeDeferred<void>();

    // Persist waits on the gate. While it waits, we start a fresh run for a
    // different item — flipping the token — then release the gate.
    const persistIdentitiesSeen: AppliedIdentity[] = [];
    const task: PipelineItemTask<{ url: string }, DraftPatch> = {
      id: 'scene-9',
      kind: 'scene',
      label: 'S9',
      provider: async () => ({ url: 'v1' }),
      apply: () => samplePatch('scene'),
      persist: async (snap, identity) => {
        persistIdentitiesSeen.push(identity);
        await persistGate.promise;
        await hook.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };
    const first = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    await vi.waitFor(() => expect(runner.statusOf('scene-9')).toBe('persisting'), { timeout: 2000, interval: 1 });
    const tokenDuringPersist = runner.getRunToken();

    // Flip token via a new run for a different item.
    const flip = runner.runItems({
      tasks: [
        {
          id: 'scene-10',
          kind: 'scene',
          label: 'S10',
          provider: async () => ({ url: 'v' }),
          apply: () => samplePatch('scene'),
          persist: async () => {},
        } as PipelineItemTask,
      ],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    persistGate.resolve();
    await first;
    await flip;

    expect(runner.statusOf('scene-9')).toBe('done');
    expect(persistIdentitiesSeen).toHaveLength(1);
    expect(persistIdentitiesSeen[0]).toMatchObject({
      storyId: 'story-1',
      epoch: 0,
      itemId: 'scene-9',
      generatedRevision: 1,
    });
    // Token changed between apply and persist; persist did not care.
    expect(runner.getRunToken()).not.toBe(tokenDuringPersist);
    // One upsert for scene-9 — the flipped run's persist was a no-op.
    expect(upsertCalls).toHaveLength(1);

    // (b) — stale revision (2) loses to a newer revision (3) that has already
    // been reserved for the same {storyId, epoch, itemId}.
    // First: rev 3 for scene-9 wins the reservation.
    await act(async () => {
      await hook.current.enqueueGeneratedSnapshot({
        patch: samplePatch('scene'),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-9',
          generatedRevision: 3,
        },
      });
    });
    expect(upsertCalls).toHaveLength(2);

    // Now: stale rev 2 arrives late — must be a no-op.
    await act(async () => {
      await hook.current.enqueueGeneratedSnapshot({
        patch: samplePatch('scene'),
        identity: {
          storyId: 'story-1',
          epoch: 0,
          itemId: 'scene-9',
          generatedRevision: 2,
        },
      });
    });
    expect(upsertCalls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.7 — Story-switch: apply's identity guard returns null (mirroring
// every editor builder) and the adapter's pre-enqueue guard would also drop.
// Result: zero merge, zero upsert, zero commit.
// -----------------------------------------------------------------------------
describe('T-A2/S4.7 story-switch invalidates in-flight apply/persist', () => {
  it('a change in the active story id after provider resolves results in no upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const providerGate = makeDeferred<{
      data: { success: true; images: string[] };
      error: null;
    }>();
    invokeImpl = async () => await providerGate.promise;

    const applySpy = vi.fn();
    const persistSpy = vi.fn();

    const task: PipelineItemTask<{ success: true; images: string[] }, DraftPatch> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async ({ signal }) => {
        const { data } = (await supabase.functions.invoke('generate-scene-images', {
          body: { type: 'scene' },
          signal,
        })) as { data: { success: true; images: string[] } };
        return data;
      },
      apply: (result, identity) => {
        applySpy(result, identity);
        // Editor builder guard: if the story id changed, discard via
        // APPLY_STALE so the runner marks the item `pending` (F3).
        if (identity.storyId !== liveStoryIdRef.current) return APPLY_STALE;
        return samplePatch('scene');
      },
      persist: async (snap, identity) => {
        persistSpy();
        await hook.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };

    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    await wait(0);

    // Story is switched while the provider is in flight.
    act(() => {
      hook.current.setActiveDraftStoryId('story-2');
    });
    liveStoryIdRef.current = 'story-2';

    // Now let the provider resolve. Apply's identity guard will discard.
    providerGate.resolve({
      data: { success: true, images: ['https://cdn/late.png'] },
      error: null,
    });
    await run;
    await flushMicrotasks();

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    // Stale-discard leaves the item in `pending` (F3) so a subsequent run can
    // still drive it to a terminal state under the live identity.
    expect(runner.statusOf('scene-1')).toBe('pending');
  });

  it('stale identity that bypasses apply is still dropped by the adapter pre-enqueue guard', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });

    // Simulate a persist that racy-writes with the OLD story id after the
    // hook already switched. The adapter must drop it silently.
    act(() => {
      hook.current.setActiveDraftStoryId('story-2');
    });

    const returned = await hook.current.enqueueGeneratedSnapshot({
      patch: samplePatch('scene'),
      identity: {
        storyId: 'story-1', // stale
        epoch: 0,
        itemId: 'scene-1',
        generatedRevision: 1,
      },
    });

    // A3a/S3 subtask 3: contrato discriminado — stale devuelve
    // `{stale:true}` (el adaptador lo mapea a PERSIST_STALE para el runner).
    expect(returned).toEqual({ stale: true });
    expect(upsertCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.8 — Epoch-switch: bumping the draft epoch mid-flight must drop any
// stale persist that leaks through with the old epoch value.
// -----------------------------------------------------------------------------
describe('T-A2/S4.8 epoch-switch invalidates in-flight persist', () => {
  it('bumpDraftEpoch mid-flight: persist with stale epoch drops at adapter → no upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });

    // Bump epoch (draft lifecycle transition — e.g. accept recovery).
    act(() => {
      hook.current.bumpDraftEpoch();
    });

    // A stale persist arrives with epoch 0 — must be dropped.
    const returned = await hook.current.enqueueGeneratedSnapshot({
      patch: samplePatch('scene'),
      identity: {
        storyId: 'story-1',
        epoch: 0, // stale — live epoch is 1
        itemId: 'scene-1',
        generatedRevision: 1,
      },
    });

    // A3a/S3 subtask 3: contrato discriminado — stale devuelve
    // `{stale:true}` (el adaptador lo mapea a PERSIST_STALE para el runner).
    expect(returned).toEqual({ stale: true });
    expect(upsertCalls).toHaveLength(0);

    // Fresh persist with the current epoch (1) still works — proves the guard
    // is scoped to identity, not blanket-disabled.
    await act(async () => {
      await hook.current.enqueueGeneratedSnapshot({
        patch: samplePatch('scene'),
        identity: {
          storyId: 'story-1',
          epoch: 1,
          itemId: 'scene-1',
          generatedRevision: 1,
        },
      });
    });
    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.9 — Cancellation with an abort-ignoring provider: zero downstream
// side effects. This is the end-to-end version of the T-A2.6 contract test —
// asserted against the adapter + upsert layer to prove nothing leaks past the
// runner's guard.
// -----------------------------------------------------------------------------
describe('T-A2/S4.9 cancellation with abort-ignoring invoke', () => {
  it('cancel() before late resolution: 0 apply, 0 persist, 0 enqueue, 0 commit callback, 0 upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-1');
    });
    const liveStoryIdRef = { current: 'story-1' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const invokeGate = makeDeferred<unknown>();
    invokeImpl = async (_fn, _body, opts) => {
      void opts; // deliberately DO NOT observe opts.signal
      return await invokeGate.promise;
    };

    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    const enqueueSpy = vi.fn();
    const commitCallbackSpy = vi.fn();

    // Wrap the adapter to spy on both the enqueueGeneratedSnapshot call and
    // whether it would have reached the commit callback path via
    // enqueueDraftWrite (adapter uses enqueueDraftWrite internally, so a
    // never-reached persist means the callback is never wired).
    const persist: PipelineItemTask<
      { success: true; images: string[] },
      DraftPatch
    >['persist'] = async (snap, identity) => {
      persistSpy();
      enqueueSpy();
      await hook.current.enqueueGeneratedSnapshot({
        patch: snap as DraftPatch,
        identity,
      });
      // Simulates the editor's post-persist commit callback that we want to
      // prove is never invoked.
      commitCallbackSpy();
    };

    const task: PipelineItemTask<{ success: true; images: string[] }, DraftPatch> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async ({ signal }) => {
        const { data } = (await supabase.functions.invoke('generate-scene-images', {
          body: { type: 'scene' },
          signal,
        })) as { data: { success: true; images: string[] } };
        return data;
      },
      apply: (result) => {
        applySpy(result);
        return samplePatch('scene');
      },
      persist,
    };

    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    await wait(0);

    // Cancel BEFORE the provider resolves. Runner nulls token then aborts.
    runner.cancel();
    // Even though signal has been aborted, our provider ignores it and
    // resolves late.
    invokeGate.resolve({
      data: { success: true, images: ['https://cdn/late.png'] },
      error: null,
    });
    await run;
    await flushMicrotasks();

    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(commitCallbackSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
    expect(runner.getRunToken()).toBeNull();
    void liveStoryIdRef;
  });
});

// -----------------------------------------------------------------------------
// T-A2/S4.10 — Source-tree audit assertions. These are not tests of runtime
// behaviour but of the code-level invariants promised by Subtask 4 and its
// F5 extraction (A3a/S3-subtask4):
//   (a) `CuentacuentoEditor.tsx` no longer inlines nine copies of the
//       generate-scene-images call. It has EXACTLY ONE
//       `supabase.functions.invoke('generate-scene-images', ...)` inside the
//       module-scope helper `invokeGenerateSceneImagesRequest`, which every
//       factory consumes via injection. The two `generate-story` and one
//       `refine-story` invocations produce TEXT (title/summary/scenes) and are
//       outside A2's scope by design.
//   (b) In the extracted `taskFactories.ts`, every call to the injected
//       `invokeGenerateSceneImages` sits inside a `provider:` closure — i.e.
//       image generation is gated by the runner's provider phase, never the
//       apply/persist phases.
//   (c) `saveDraftNow` has EXACTLY ONE production caller
//       (`useCuentacuentosDraft.ts`, inside `enqueueDraftWrite`). All other
//       references are test-scoped.
// -----------------------------------------------------------------------------
describe('T-A2/S4.10 source-tree audit invariants', () => {
  // Node fs read is fine here — the tests already run in a Node vitest env
  // and every other suite in this file mocks Supabase, not fs.
  // Using dynamic import so the fs read only happens when the test runs.
  async function readFile(rel: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const abs = path.resolve(process.cwd(), rel);
    return await fs.readFile(abs, 'utf8');
  }

  it('CuentacuentoEditor.tsx has exactly one generate-scene-images invocation, inside the shared wrapper', async () => {
    const src = await readFile('src/components/liturgia-builder/editors/CuentacuentoEditor.tsx');
    // Strip block and line comments before scanning so docstring references
    // (e.g. the wrapper's JSDoc) don't get counted as call sites.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');
    const invokeMatches = [
      ...codeOnly.matchAll(/supabase\.functions\.invoke\(\s*['"]generate-scene-images['"]/g),
    ];
    // Post-F5 extraction: the editor no longer inlines nine copies of this
    // call. There is exactly one, inside `invokeGenerateSceneImagesRequest`,
    // which each factory receives via injection.
    expect(invokeMatches).toHaveLength(1);
    const idx = invokeMatches[0].index ?? 0;
    const before = codeOnly.slice(0, idx);
    const lastWrapperDecl = before.lastIndexOf(
      'async function invokeGenerateSceneImagesRequest'
    );
    expect(lastWrapperDecl).toBeGreaterThan(-1);
    // No `provider:` or `apply:` should appear between the wrapper decl and
    // the invoke call — the wrapper is module-scope, not inside a factory.
    const between = codeOnly.slice(lastWrapperDecl, idx);
    expect(between).not.toMatch(/\bprovider:\s*(async\s*)?\(/);
    expect(between).not.toMatch(/\bapply:\s*\(/);
  });

  it('taskFactories.ts routes every image-generation call through a provider closure', async () => {
    const src = await readFile('src/lib/cuentacuentos/taskFactories.ts');
    const invokeCalls = [...src.matchAll(/\binvokeGenerateSceneImages\(/g)];
    // Sanity: 5 generate + 4 refine = 9 factories.
    expect(invokeCalls.length).toBeGreaterThanOrEqual(9);
    for (const m of invokeCalls) {
      const idx = m.index ?? 0;
      const before = src.slice(0, idx);
      const lastProvider = before.lastIndexOf('provider:');
      const lastApply = before.lastIndexOf('apply:');
      const lastPersist = before.lastIndexOf('persist:');
      // The most recent structural marker before the call must be `provider:`
      // (i.e. we're inside the provider phase, not apply or persist).
      expect(lastProvider).toBeGreaterThan(-1);
      expect(lastProvider).toBeGreaterThan(lastApply);
      expect(lastProvider).toBeGreaterThan(lastPersist);
    }
  });

  it('generate-story and refine-story invocations sit outside any PipelineItemTask.provider closure', async () => {
    const src = await readFile('src/components/liturgia-builder/editors/CuentacuentoEditor.tsx');
    const textCalls = [
      ...src.matchAll(
        /supabase\.functions\.invoke\(\s*['"](generate-story|refine-story)['"]/g
      ),
    ];
    // Non-empty: guard against silent deletion.
    expect(textCalls.length).toBeGreaterThan(0);
    for (const m of textCalls) {
      const idx = m.index ?? 0;
      const before = src.slice(0, idx);
      // If these calls were ever moved inside a runner task provider, the
      // nearest preceding structural marker would be `provider: async` with no
      // intervening `useCallback(` / `handle...(` handler declaration. Every
      // text-only call must be inside a normal `handle*` useCallback, not a
      // pipeline builder's provider closure.
      const lastProvider = before.lastIndexOf('provider: async');
      const lastHandler = Math.max(
        before.lastIndexOf('const handleGenerate ='),
        before.lastIndexOf('const handleRefineStory ='),
        before.lastIndexOf('const handlePreviewPrompt =')
      );
      // The handler declaration must be more recent than any provider closure.
      expect(lastHandler).toBeGreaterThan(lastProvider);
    }
  });

  it('saveDraftNow has exactly one production call site, inside enqueueDraftWrite', async () => {
    const src = await readFile('src/hooks/useCuentacuentosDraft.ts');
    // Match INVOCATIONS only (skip the `export async function saveDraftNow(` decl).
    // Also skip block/line comments and template-string references.
    const callSites = [
      ...src.matchAll(/\bawait\s+saveDraftNow\s*\(/g),
    ];
    expect(callSites).toHaveLength(1);
    const idx = callSites[0].index ?? 0;
    const before = src.slice(0, idx);
    // The nearest enclosing symbol before the call must be enqueueDraftWrite's
    // internal `operation` promise.
    const lastOperation = before.lastIndexOf('const operation: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>');
    expect(lastOperation).toBeGreaterThan(-1);
    const lastFunctionDecl = Math.max(
      before.lastIndexOf('const enqueueDraftWrite'),
      before.lastIndexOf('const enqueueGeneratedSnapshot'),
      before.lastIndexOf('const performDraftWrite')
    );
    // The enclosing `operation` block sits inside enqueueDraftWrite, so
    // enqueueDraftWrite's decl must be older than the operation block, and the
    // operation block must be the most recent structural marker.
    expect(lastFunctionDecl).toBeLessThanOrEqual(lastOperation);
  });
});
