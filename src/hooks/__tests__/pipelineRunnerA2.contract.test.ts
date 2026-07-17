/**
 * Deterministic A2 contract tests — labelled T-A2.1 through T-A2.6.
 *
 * These tests exercise the pipeline runner and the `enqueueGeneratedSnapshot`
 * adapter together. Every provider/save/db path is mocked; there are no network
 * calls or real Supabase requests. Provider timing is controlled with deferred
 * promises so we can prove ordering guarantees explicitly (e.g. "persist status
 * observed BEFORE persistence resolves").
 *
 * A compact table-driven suite ("parametrized refine parity") re-runs the same
 * behavioural contract across all four refine paths (character sheet, scene
 * image, cover, end) using synthetic tasks whose shape mirrors the four refine
 * builders in `CuentacuentoEditor.tsx`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Supabase mock shared with the existing A2 adapter tests. Storage upload,
// select+upsert, functions.invoke are ALL mocked. Deferreds allow tests to
// control resolution timing.
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

// Custom invoke implementation is swappable per test so we can drive provider
// timing, aborts-ignored, and different result shapes.
let invokeImpl: (body: unknown, opts: { signal?: AbortSignal }) => Promise<unknown> =
  async () => ({ data: { success: true, images: ['https://cdn/mock.png'] }, error: null });

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
        invoke: vi.fn().mockImplementation(async (fn: string, opts: { body: unknown } & { signal?: AbortSignal }) => {
          invokeCalls.push({ fn, body: opts.body });
          return invokeImpl(opts.body, opts);
        }),
      },
    },
  };
});

import {
  createStoryImagePipelineRunner,
  type PipelineItemKind,
  type PipelineItemTask,
} from '../storyImagePipelineRunner';
import { supabase } from '@/integrations/supabase/client';
import { useCuentacuentosDraft, type DraftPatch } from '../useCuentacuentosDraft';

// -----------------------------------------------------------------------------
// Test-scoped reset. Every test starts from a clean slate: no captured calls,
// no leftover deferreds, defaults for invoke/upsert.
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

const samplePatch = (): DraftPatch => ({
  currentStep: 'scenes',
  sceneImageOptions: { 1: ['https://cdn/scene-1-a.png'] },
  selectedSceneImages: { 1: 0 },
});

// -----------------------------------------------------------------------------
// T-A2.1 — Stale runToken: apply MUST be a no-op after cancel or a new run.
// -----------------------------------------------------------------------------
describe('T-A2.1 stale runToken → apply is a no-op', () => {
  it('cancel() before provider resolves: apply/persist never run for late resolution', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = makeDeferred<{ url: string }>();
    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => await gate.promise,
      apply: (r) => {
        applySpy(r);
        return { url: r.url };
      },
      persist: async () => {
        persistSpy();
      },
    };
    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-A', epoch: 1 },
    });
    await wait(0);
    runner.cancel();
    // Provider only resolves AFTER cancel — a late resolution must not apply.
    gate.resolve({ url: 'late' });
    await run;
    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
    expect(runner.getRunToken()).toBeNull();
  });

  it('a fresh runItems invalidates prior token: late resolution never applies', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = makeDeferred<{ url: string }>();
    const applyStale = vi.fn();
    const persistStale = vi.fn();
    const staleTask: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => await gate.promise,
      apply: (r) => {
        applyStale(r);
        return { url: r.url };
      },
      persist: async () => {
        persistStale();
      },
    };
    const firstRun = runner.runItems({
      tasks: [staleTask],
      identity: { storyId: 'story-A', epoch: 1 },
    });
    await wait(0);
    const secondRun = runner.runItems({
      tasks: [
        {
          id: 'scene-2',
          kind: 'scene',
          label: 'S2',
          provider: async () => ({ url: 'fresh' }),
          apply: (r) => ({ url: r.url }),
          persist: async () => {},
        } as PipelineItemTask,
      ],
      identity: { storyId: 'story-B', epoch: 2 },
    });
    await secondRun;
    gate.resolve({ url: 'stale' });
    await firstRun;
    expect(applyStale).not.toHaveBeenCalled();
    expect(persistStale).not.toHaveBeenCalled();
    expect(runner.statusOf('scene-2')).toBe('done');
  });
});

// -----------------------------------------------------------------------------
// T-A2.2 — apply returns { snapshot, generatedRevision }; mutation of the
// snapshot handed to persist CANNOT alter the retained internal state used by
// save-only retries.
// -----------------------------------------------------------------------------
describe('T-A2.2 apply returns immutable snapshot + revision', () => {
  it('generatedRevision is monotonic and exposed to persist via identity', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const seen: Array<number> = [];
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist: async (_snap, identity) => {
        seen.push(identity.generatedRevision);
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 0 } });
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 0 } });
    expect(seen).toEqual([1, 2]);
  });

  it('mutation of persist snapshot cannot corrupt retained snapshot used by save-only retry', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const persistedRefs: Array<{ list: number[] } | null> = [];
    const task: PipelineItemTask<{ list: number[] }, { list: number[] }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ list: [1, 2, 3] }),
      apply: (result) => ({ list: result.list }),
      persist: async (snapshot) => {
        persistCalls++;
        // Attempt to mutate; frozen snapshot throws in strict mode. Swallow so
        // the runner still observes a persist failure (first call) and success
        // on retry (second call — using the retained snapshot).
        try {
          (snapshot as { list: number[] }).list.push(999);
        } catch {
          // expected: frozen
        }
        persistedRefs.push({ list: [...snapshot.list] });
        if (persistCalls === 1) throw new Error('save fail once');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    // Both persist calls saw the same list — the retained snapshot was not
    // corrupted by the failed persist's attempted mutation.
    expect(persistedRefs[0]).toEqual({ list: [1, 2, 3] });
    expect(persistedRefs[1]).toEqual({ list: [1, 2, 3] });
  });
});

// -----------------------------------------------------------------------------
// T-A2.3 — persist validates {storyId, epoch, itemId, generatedRevision}. Stale
// identity/revision is rejected. Succeeds after runToken flip when identity
// remains current on the hook side.
// -----------------------------------------------------------------------------
describe('T-A2.3 persist identity validation', () => {
  it('mismatched storyId, epoch, or stale revision → no upsert', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });
    // storyId mismatch
    await result.current.enqueueGeneratedSnapshot({
      patch: samplePatch(),
      identity: { storyId: 'story-X', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
    });
    // epoch mismatch
    await result.current.enqueueGeneratedSnapshot({
      patch: samplePatch(),
      identity: { storyId: 'story-1', epoch: 99, itemId: 'scene-1', generatedRevision: 1 },
    });
    expect(upsertCalls).toHaveLength(0);
    // Reserve rev 3
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({
        patch: samplePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 3 },
      });
    });
    expect(upsertCalls).toHaveLength(1);
    // Stale rev 2
    await result.current.enqueueGeneratedSnapshot({
      patch: samplePatch(),
      identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
    });
    expect(upsertCalls).toHaveLength(1);
  });

  it('persist succeeds after runToken flip when identity is still live on the hook', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistGate = makeDeferred<void>();
    const task: PipelineItemTask<{ url: string }, DraftPatch> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v1' }),
      apply: () => samplePatch(),
      persist: async (snap, identity) => {
        // Wait until AFTER the runToken flips before writing.
        await persistGate.promise;
        await result.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };
    const first = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    while (runner.statusOf('scene-1') !== 'persisting') await wait(0);
    // Flip token via a fresh run for a different item; then release persist.
    const second = runner.runItems({
      tasks: [
        {
          id: 'scene-2',
          kind: 'scene',
          label: 'S2',
          provider: async () => ({ url: 'v' }),
          apply: () => samplePatch(),
          persist: async () => {},
        } as PipelineItemTask,
      ],
      identity: { storyId: 'story-1', epoch: 0 },
    });
    persistGate.resolve();
    await first;
    await second;
    expect(runner.statusOf('scene-1')).toBe('done');
    // Adapter DID commit despite token flip: identity still matched live hook state.
    expect(upsertCalls.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------------
// T-A2.4 — Persist status ordering: `persisting` observed BEFORE resolution;
// `done` only after success; `save-failed` on rejection.
// -----------------------------------------------------------------------------
describe('T-A2.4 persist status ordering', () => {
  it('status is persisting before resolution and done after success', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = makeDeferred<void>();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        await gate.promise;
      },
    };
    const run = runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    while (runner.statusOf('scene-1') !== 'persisting') await wait(0);
    expect(runner.statusOf('scene-1')).toBe('persisting');
    gate.resolve();
    await run;
    expect(runner.statusOf('scene-1')).toBe('done');
  });

  it('status transitions to save-failed on persist rejection', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
  });
});

// -----------------------------------------------------------------------------
// T-A2.5 — Save-only retry: invoke count recorded around retry proves the
// provider is NOT called again; persist IS called again.
// -----------------------------------------------------------------------------
describe('T-A2.5 save-only retry uses zero provider invokes', () => {
  it('retry from save-failed calls persist again with exactly zero new provider invokes', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const providerFn = vi.fn(async () => ({ url: 'v1' }));
    const applyFn = vi.fn((r: { url: string }) => ({ url: r.url }));
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: providerFn,
      apply: applyFn,
      persist: async () => {
        persistCalls++;
        if (persistCalls === 1) throw new Error('save fail');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    // Capture invoke count BEFORE retry, then re-record AFTER.
    const invokeCountBefore = providerFn.mock.calls.length;
    const applyCountBefore = applyFn.mock.calls.length;
    const invokeCallsBefore = invokeCalls.length;
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(providerFn.mock.calls.length - invokeCountBefore).toBe(0);
    expect(applyFn.mock.calls.length - applyCountBefore).toBe(0);
    // Also assert against the supabase-level invoke counter (unused here but
    // asserted for parity with paths that go through supabase.functions.invoke).
    expect(invokeCalls.length - invokeCallsBefore).toBe(0);
    expect(persistCalls).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// T-A2.6 — Cancellation with an invoke that IGNORES its abort signal and
// resolves late. No apply, no persist, no draft enqueue, no upsert.
// -----------------------------------------------------------------------------
describe('T-A2.6 cancellation + abort-ignoring invoke', () => {
  it('late invoke resolution after cancel: no apply/persist/enqueue/upsert', async () => {
    const invokeGate = makeDeferred<unknown>();
    invokeImpl = async (_body, opts) => {
      // Deliberately DO NOT observe opts.signal — resolve when gate opens.
      void opts;
      return await invokeGate.promise;
    };
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    const enqueueSpy = vi.fn();

    const task: PipelineItemTask<{ success: true; images: string[] }, DraftPatch> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async ({ signal }) => {
        const { data } = (await supabase.functions.invoke('generate-scene-images', {
          body: { type: 'scene' },
          signal,
        })) as { data: { success: true; images: string[] } };
        return data;
      },
      apply: (result) => {
        applySpy(result);
        return samplePatch();
      },
      persist: async (snap, identity) => {
        persistSpy();
        enqueueSpy();
        await result.current.enqueueGeneratedSnapshot({
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
    // Invoke has been dispatched and is waiting on the gate — cancel now.
    runner.cancel();
    // Now let the invoke resolve. Guardrails must prevent all downstream side effects.
    invokeGate.resolve({ data: { success: true, images: ['https://cdn/x.png'] }, error: null });
    await run;
    await flushMicrotasks();

    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
    expect(runner.getRunToken()).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Parametrized refine parity — the four refine paths (character sheet, scene
// image, cover, end) share a single provider/apply/persist shape via the A2
// runner. This suite proves the same contract holds regardless of `kind` /
// `itemId`:
//   (a) guarded apply — stale storyId identity discards without persisting
//   (b) persist-before-done — status = persisting BEFORE resolution
//   (c) save-failed → save retry with zero provider invokes
//   (d) late-result cancellation — no apply, no persist
// -----------------------------------------------------------------------------

interface RefineCase {
  name: string;
  kind: PipelineItemKind;
  itemId: string;
}

const REFINE_CASES: RefineCase[] = [
  { name: 'character sheet', kind: 'sheet', itemId: 'sheet-char-1' },
  { name: 'scene image', kind: 'scene', itemId: 'scene-1' },
  { name: 'cover', kind: 'cover', itemId: 'cover' },
  { name: 'end', kind: 'end', itemId: 'end' },
];

// Synthetic refine task builder: mirrors the four builders in
// CuentacuentoEditor.tsx (provider → invoke → apply replaces the source slot
// → persist enqueues a draft snapshot).
function buildSyntheticRefineTask(
  c: RefineCase,
  overrides: {
    provider?: PipelineItemTask['provider'];
    apply?: PipelineItemTask['apply'];
    persist?: PipelineItemTask['persist'];
  } = {}
): PipelineItemTask<{ success: true; images: string[] }, DraftPatch> {
  return {
    id: c.itemId,
    kind: c.kind,
    label: c.name,
    provider:
      overrides.provider ??
      (async ({ signal }) => {
        const { data } = (await supabase.functions.invoke('generate-scene-images', {
          body: { type: c.kind, refine: { sourceImage: 'old', feedback: 'fb' } },
          signal,
        })) as { data: { success: true; images: string[] } };
        return data;
      }),
    apply:
      (overrides.apply as PipelineItemTask<
        { success: true; images: string[] },
        DraftPatch
      >['apply']) ?? (() => samplePatch()),
    persist:
      overrides.persist ??
      (async () => {
        /* default: no-op success */
      }),
  };
}

describe.each(REFINE_CASES)('refine parity — $name ($kind)', (c) => {
  it('(a) guarded apply: stale identity check inside apply returns null → no persist', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistSpy = vi.fn();
    const task = buildSyntheticRefineTask(c, {
      apply: () => null, // simulate stale-identity guard inside the editor's apply
      persist: async () => {
        persistSpy();
      },
    });
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 0 } });
    expect(runner.statusOf(c.itemId)).toBe('done');
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('(b) persist-before-done: status = persisting BEFORE resolution, done AFTER', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = makeDeferred<void>();
    const task = buildSyntheticRefineTask(c, {
      persist: async () => {
        await gate.promise;
      },
    });
    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-A', epoch: 0 },
    });
    while (runner.statusOf(c.itemId) !== 'persisting') await wait(0);
    expect(runner.statusOf(c.itemId)).toBe('persisting');
    gate.resolve();
    await run;
    expect(runner.statusOf(c.itemId)).toBe('done');
  });

  it('(c) save-failed → save retry uses zero provider invokes', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const providerFn = vi.fn(async () => ({
      success: true as const,
      images: ['https://cdn/x.png'],
    }));
    const task = buildSyntheticRefineTask(c, {
      provider: providerFn,
      persist: async () => {
        persistCalls++;
        if (persistCalls === 1) throw new Error('save fail');
      },
    });
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 0 } });
    expect(runner.statusOf(c.itemId)).toBe('save-failed');
    const before = providerFn.mock.calls.length;
    await runner.retryItem({ itemId: c.itemId, identity: { storyId: 'story-A', epoch: 0 } });
    expect(runner.statusOf(c.itemId)).toBe('done');
    expect(providerFn.mock.calls.length - before).toBe(0);
    expect(persistCalls).toBe(2);
  });

  it('(d) late-result cancellation: no apply, no persist', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const invokeGate = makeDeferred<unknown>();
    invokeImpl = async () => await invokeGate.promise;
    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    const task = buildSyntheticRefineTask(c, {
      apply: (r) => {
        applySpy(r);
        return samplePatch();
      },
      persist: async () => {
        persistSpy();
      },
    });
    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-A', epoch: 0 },
    });
    await wait(0);
    runner.cancel();
    invokeGate.resolve({ data: { success: true, images: ['https://cdn/x.png'] }, error: null });
    await run;
    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });
});
