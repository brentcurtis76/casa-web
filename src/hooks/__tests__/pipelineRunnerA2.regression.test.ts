/**
 * A2 — Subtask 1 regression suite.
 *
 * Deterministic regression coverage that encodes the A2 runner + draft-adapter
 * contract described by the Subtask 1 spec. Provider timing is driven with
 * deferred promises; every Supabase surface (functions.invoke + storage +
 * table.upsert) is mocked. No real network, no live provider, no production
 * data, no member PII — payloads are synthetic.
 *
 * Failures on the pre-fix source tree (fork point `3ac35f7`) are intentional
 * and demonstrate contract violations — not fixture mistakes:
 *   - Stale-identity apply-return-null is treated the same as an ephemeral
 *     no-persist by the runner (both mark `done`); the contract requires
 *     stale-discard to land in `pending` with zero merge/upsert.
 *   - A save-only retry cannot re-attempt storage because the draft
 *     adapter's per-item revision reservation blocks the retry as a stale
 *     write (`identity.generatedRevision <= currentReserved`), yet the
 *     runner still ends up in `done` — the contract requires that `done` is
 *     only reached after an actual storage attempt succeeds, and
 *     `save-failed` must persist after a further failure.
 *
 * The separately-tracked F1-TEST-RACE deterministic
 * enqueue-before-lifecycle-change / start-after-change test is NOT resolved
 * here; it remains open and is out of scope for Subtask 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// -----------------------------------------------------------------------------
// Mock surface — mirrors the shared A2 contract/integration suites so this
// file is diff-friendly against them.
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
const upsertResponses: Array<{ error: { message: string } | null }> = [];
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
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (selectError) return { data: null, error: selectError };
      return { data: null, error: null };
    }),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) =>
      __upsertBuilder((async () => {
      upsertCalls.push({ payload });
      const queued = upsertResponses.shift();
      if (queued) return queued;
      return { error: upsertError };
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
  createStoryImagePipelineRunner,
  type AppliedIdentity,
  type PipelineItemStatus,
  type PipelineItemTask,
} from '../storyImagePipelineRunner';
import { supabase } from '@/integrations/supabase/client';
import { useCuentacuentosDraft, type DraftPatch } from '../useCuentacuentosDraft';

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  invokeCalls.length = 0;
  upsertResponses.length = 0;
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

const sceneSamplePatch = (): DraftPatch => ({
  currentStep: 'scenes',
  sceneImageOptions: { 1: ['https://cdn/scene-1-a.png'] },
  selectedSceneImages: { 1: 0 },
});

// -----------------------------------------------------------------------------
// Scenario 1 — Live hook @ epoch 1 successfully passes adapter identity.
//
// After bumpDraftEpoch(), the hook's live epoch is 1. A persist call with an
// identity of {storyId: live, epoch: 1, itemId, generatedRevision: 1} MUST
// pass the adapter guard, upsert, and land the item in `done`. This scenario
// documents the happy-path invariant against which every later contract
// failure is compared — it exists so that failures elsewhere cannot be
// attributed to a fixture mistake.
// -----------------------------------------------------------------------------
describe('regression 1 — live hook epoch 1 persists successfully', () => {
  it('bumpDraftEpoch(): identity.epoch=1 upserts and marks item done', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-live');
      hook.current.bumpDraftEpoch();
    });

    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
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
      apply: () => sceneSamplePatch(),
      persist: async (snap, identity) => {
        // Confirms identity.epoch is threaded through as 1.
        expect(identity.epoch).toBe(1);
        await hook.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };

    await act(async () => {
      await runner.runItems({
        tasks: [task],
        identity: { storyId: 'story-live', epoch: 1 },
      });
    });

    expect(runner.statusOf('scene-1')).toBe('done');
    expect(upsertCalls).toHaveLength(1);
    expect(invokeCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// Scenario 2 — Story/epoch change between generation and apply must yield
// `pending` with zero merge/upsert.
//
// The runner-facing contract: if the identity captured at `runItems` no longer
// matches the live hook identity by the time `apply` runs, the item must NOT
// terminate in `done` (which would signal "successfully processed and there is
// nothing left to do"). It must remain in `pending` so a subsequent
// generation can drive it forward. On `3ac35f7` the runner unconditionally
// transitions to `done` when apply returns null — regardless of *why* apply
// returned null. That's the contract violation.
// -----------------------------------------------------------------------------
describe('regression 2 — story/epoch change during generation → pending, zero upsert', () => {
  it('story switches between provider dispatch and apply: item stays pending, adapter never receives an upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-A');
    });
    const liveStoryIdRef = { current: 'story-A' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const providerGate = makeDeferred<{
      data: { success: true; images: string[] };
      error: null;
    }>();
    invokeImpl = async () => await providerGate.promise;

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
      apply: (_result, identity) => {
        // Every editor builder wraps its apply with this stale-identity guard.
        if (identity.storyId !== liveStoryIdRef.current) return null;
        return sceneSamplePatch();
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
      identity: { storyId: 'story-A', epoch: 0 },
    });
    await wait(0);

    // Story switch mid-flight — apply's guard will reject the stale identity.
    act(() => {
      hook.current.setActiveDraftStoryId('story-B');
    });
    liveStoryIdRef.current = 'story-B';

    providerGate.resolve({
      data: { success: true, images: ['https://cdn/late.png'] },
      error: null,
    });
    await run;
    await flushMicrotasks();

    expect(persistSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    // Contract: item stays `pending` so a fresh generation can drive it.
    // Current source marks `done` — this assertion demonstrates the violation.
    expect(runner.statusOf('scene-1')).toBe('pending');
  });

  it('epoch bumps between provider dispatch and apply: item stays pending, adapter never receives an upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-A');
    });
    const liveEpochRef = { current: 0 };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const providerGate = makeDeferred<{
      data: { success: true; images: string[] };
      error: null;
    }>();
    invokeImpl = async () => await providerGate.promise;

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
      apply: (_result, identity) => {
        // Editor-style epoch guard.
        if (identity.epoch !== liveEpochRef.current) return null;
        return sceneSamplePatch();
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
      identity: { storyId: 'story-A', epoch: 0 },
    });
    await wait(0);

    // Bump epoch mid-flight (draft lifecycle transition, e.g. accept recovery).
    act(() => {
      hook.current.bumpDraftEpoch();
    });
    liveEpochRef.current = 1;

    providerGate.resolve({
      data: { success: true, images: ['https://cdn/late.png'] },
      error: null,
    });
    await run;
    await flushMicrotasks();

    expect(persistSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    expect(runner.statusOf('scene-1')).toBe('pending');
  });
});

// -----------------------------------------------------------------------------
// Scenario 3 — Save-only retry reattempts storage with zero provider calls,
// reaches `done` only after actual storage success, and remains `save-failed`
// after a further storage failure.
//
// This exercises the runner + real draft adapter together. The current source
// reserves `identity.generatedRevision` synchronously in
// `enqueueGeneratedSnapshot` before the write is attempted. When persistence
// fails, the reservation stays in place at that revision — so the save-only
// retry (which reuses the same `retainedIdentity`) is blocked by the
// pre-enqueue guard `identity.generatedRevision <= currentReserved` and
// resolves without touching storage. The runner then flips the item to
// `done`, violating the contract twice: no storage retry, and `done` reached
// without an actual save.
// -----------------------------------------------------------------------------
describe('regression 3 — save-only retry reattempts storage', () => {
  it('first fail → save-failed; retry (fails) stays save-failed with additional upsert; retry (succeeds) upserts and reaches done', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-live');
    });

    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const providerFn = vi.fn(async () => ({
      success: true as const,
      images: ['https://cdn/x.png'],
    }));
    const applyFn = vi.fn(() => sceneSamplePatch());
    const task: PipelineItemTask<{ success: true; images: string[] }, DraftPatch> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerFn,
      apply: applyFn,
      persist: async (snap, identity) => {
        await hook.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };

    // First run: upsert fails → save-failed and upsertCalls=1.
    upsertError = { message: 'io down (initial)' };
    await act(async () => {
      await runner.runItems({
        tasks: [task],
        identity: { storyId: 'story-live', epoch: 0 },
      });
    });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(upsertCalls).toHaveLength(1);
    const providerCallsAfterInitial = providerFn.mock.calls.length;
    const applyCallsAfterInitial = applyFn.mock.calls.length;

    // First retry: storage still down → contract says stay `save-failed` and
    // trigger a fresh storage attempt (upsertCalls grows). Current adapter's
    // pre-enqueue revision reservation short-circuits the retry.
    upsertError = { message: 'io down (retry-1)' };
    await act(async () => {
      await runner.retryItem({
        itemId: 'scene-1',
        identity: { storyId: 'story-live', epoch: 0 },
      });
    });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(upsertCalls.length).toBe(2);
    // No new provider/apply calls on a save-only retry.
    expect(providerFn.mock.calls.length - providerCallsAfterInitial).toBe(0);
    expect(applyFn.mock.calls.length - applyCallsAfterInitial).toBe(0);

    // Second retry: storage recovers → item reaches `done` and a third upsert
    // is observed.
    upsertError = null;
    await act(async () => {
      await runner.retryItem({
        itemId: 'scene-1',
        identity: { storyId: 'story-live', epoch: 0 },
      });
    });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(upsertCalls.length).toBe(3);
    expect(providerFn.mock.calls.length - providerCallsAfterInitial).toBe(0);
    expect(applyFn.mock.calls.length - applyCallsAfterInitial).toBe(0);
    // Sanity: functions.invoke was called exactly once (initial run), never
    // during either retry.
    expect(invokeCalls).toHaveLength(0); // provider is a bare mock, not a supabase invoke
  });
});

// -----------------------------------------------------------------------------
// Scenario 4 — Status transitions are strictly ordered and only `done` after
// persistence resolves. On rejection: `pending → running → persisting →
// save-failed` with NO intermediate `done`.
//
// Uses the runner-level subscribe() to capture every emitted status snapshot
// via a listener + gated persist. The contract requires:
//   - `persisting` is observed BEFORE the persist promise settles.
//   - `done` never appears before `persisting` (or at all on rejection).
// This exists as a positive control: on `3ac35f7` the runner already emits
// this ordering. The scenario locks it against future regressions.
// -----------------------------------------------------------------------------
describe('regression 4 — status transitions', () => {
  it('happy path: sequence contains pending → running → persisting → done, in order', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistGate = makeDeferred<void>();
    const transitions: PipelineItemStatus[] = [];

    const unsub = runner.subscribe(() => {
      const s = runner.statusOf('scene-1');
      if (s && transitions[transitions.length - 1] !== s) transitions.push(s);
    });

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        await persistGate.promise;
      },
    };
    const run = runner.runItems({
      tasks: [task],
      identity: { storyId: 's', epoch: 0 },
    });
    await vi.waitFor(() => expect(runner.statusOf('scene-1')).toBe('persisting'), { timeout: 2000, interval: 1 });
    // At this point `persisting` MUST have already been observed and `done`
    // MUST NOT have been observed.
    expect(transitions).toContain('persisting');
    expect(transitions).not.toContain('done');
    persistGate.resolve();
    await run;
    unsub();

    const indexOf = (s: PipelineItemStatus) => transitions.indexOf(s);
    expect(indexOf('pending')).toBeGreaterThanOrEqual(0);
    expect(indexOf('running')).toBeGreaterThan(indexOf('pending'));
    expect(indexOf('persisting')).toBeGreaterThan(indexOf('running'));
    expect(indexOf('done')).toBeGreaterThan(indexOf('persisting'));
  });

  it('rejection path: sequence is pending → running → persisting → save-failed with no intermediate done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const transitions: PipelineItemStatus[] = [];

    const unsub = runner.subscribe(() => {
      const s = runner.statusOf('scene-1');
      if (s && transitions[transitions.length - 1] !== s) transitions.push(s);
    });

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };
    await runner.runItems({
      tasks: [task],
      identity: { storyId: 's', epoch: 0 },
    });
    unsub();

    expect(transitions).not.toContain('done');
    const indexOf = (s: PipelineItemStatus) => transitions.indexOf(s);
    expect(indexOf('pending')).toBeGreaterThanOrEqual(0);
    expect(indexOf('running')).toBeGreaterThan(indexOf('pending'));
    expect(indexOf('persisting')).toBeGreaterThan(indexOf('running'));
    expect(indexOf('save-failed')).toBeGreaterThan(indexOf('persisting'));
  });
});

// -----------------------------------------------------------------------------
// Scenario 5 — Stale-discard vs ephemeral distinction.
//   (a) Stale-discard (apply returns null BECAUSE identity is stale) → the
//       item must land in `pending` with zero persistence. The current source
//       terminates in `done`, conflating the two outcomes — that is the
//       contract violation this test exposes.
//   (b) Ephemeral (apply returns null BY DESIGN — prop sheets are ephemeral
//       and never persist) → the item MUST land in `done` with zero
//       persistence. This case is already satisfied by the current runner
//       and is included so the ephemeral path is locked against regressions.
// -----------------------------------------------------------------------------
describe('regression 5 — stale-discard vs ephemeral prop', () => {
  it('stale-discard: apply-returns-null due to identity mismatch → status pending, no upsert', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-A');
    });
    const liveStoryIdRef = { current: 'story-A' as string | null };
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const providerGate = makeDeferred<{
      data: { success: true; images: string[] };
      error: null;
    }>();
    invokeImpl = async () => await providerGate.promise;

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
      apply: (_r, identity) => {
        // Stale-identity guard: discards silently.
        if (identity.storyId !== liveStoryIdRef.current) return null;
        return sceneSamplePatch();
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
      identity: { storyId: 'story-A', epoch: 0 },
    });
    await wait(0);
    // Story-switch mid-flight.
    act(() => {
      hook.current.setActiveDraftStoryId('story-B');
    });
    liveStoryIdRef.current = 'story-B';
    providerGate.resolve({
      data: { success: true, images: ['https://cdn/late.png'] },
      error: null,
    });
    await run;
    await flushMicrotasks();

    expect(persistSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    // Contract: stale-discard yields `pending`, not `done`.
    expect(runner.statusOf('scene-1')).toBe('pending');
  });

  it('ephemeral prop: apply returns APPLY_EPHEMERAL by design → status done, no upsert, no adapter enqueue', async () => {
    const hook = await mountReadyHook();
    act(() => {
      hook.current.setActiveDraftStoryId('story-A');
    });
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const persistSpy = vi.fn();
    const enqueueSpy = vi.fn();
    const task: PipelineItemTask<{ success: true; images: string[] }, DraftPatch> = {
      id: 'prop-p-1',
      kind: 'prop',
      label: 'Prop',
      provider: async ({ signal }) => {
        const { data } = (await supabase.functions.invoke('generate-scene-images', {
          body: { type: 'prop' },
          signal,
        })) as { data: { success: true; images: string[] } };
        return data;
      },
      // Ephemeral prop sheet: apply signals ephemeral success via APPLY_EPHEMERAL
      // (F3 explicit-outcome contract). Runner marks the item `done` with zero
      // persist call.
      apply: () => APPLY_EPHEMERAL,
      persist: async (snap, identity) => {
        persistSpy();
        enqueueSpy();
        await hook.current.enqueueGeneratedSnapshot({
          patch: snap as DraftPatch,
          identity,
        });
      },
    };

    await act(async () => {
      await runner.runItems({
        tasks: [task],
        identity: { storyId: 'story-A', epoch: 0 },
      });
    });

    expect(persistSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    expect(runner.statusOf('prop-p-1')).toBe('done');
  });
});
