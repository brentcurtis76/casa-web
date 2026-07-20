/**
 * A3a/S3 subtask 3 — F3 explicit stale-persist protocol through the runner.
 *
 * The persist boundary now has a discriminated stale outcome:
 *   - Promise resolves `undefined` → commit → runner marks item `done`.
 *   - Promise resolves `PERSIST_STALE` → the I/O ran (or was skipped by a
 *     pre-start guard) but the downstream identity drift kept the snapshot
 *     out of React state. Runner treats this as "no commit occurred":
 *     - Initial persist: item returns to `pending`. No `done`, no
 *       `save-failed`, no registry entry.
 *     - Retry save-only persist: item stays retryable. If the entry is
 *       still the exact latest and the live identity still matches, the
 *       item stays `save-failed` (so `saveFailedCount` still reflects it);
 *       otherwise the newer revision decides the status.
 *   - Promise throws → save-failed + registry entry (unchanged from before).
 *
 * These invariants are exercised against the REAL runner via
 * `createStoryImagePipelineRunner`, plus the REAL adapter
 * `buildSnapshotTask` for the wiring test.
 *
 * Two runner scenarios (per acceptance criteria):
 *
 *   1. Identity change BEFORE persistence begins — `enqueueGeneratedSnapshot`
 *      short-circuits at pre-enqueue guard (identity mismatch), returns
 *      `{stale:true}` immediately, adapter maps to `PERSIST_STALE`.
 *
 *   2. Identity change WHILE persistence is in-flight — persist starts under
 *      the captured identity, then a deferred resolves as PERSIST_STALE
 *      (simulating the downstream "persisted-but-no-commit" path).
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createStoryImagePipelineRunner,
  PERSIST_STALE,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';
import { buildSnapshotTask } from '@/lib/cuentacuentos/pipelineTaskAdapter';
import { hashSnapshot } from '@/lib/cuentacuentos/snapshotHash';

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

// =============================================================================
// Scenario 1 — identity change BEFORE persistence begins.
// =============================================================================
describe('A3a/S3 subtask 3 — identity change before persist begins', () => {
  it('persist returning PERSIST_STALE synchronously: item ends `pending`, no done, no save-failed, no registry entry', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    const persist = vi.fn(async () => PERSIST_STALE);
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist,
    };

    await runner.runItems({ tasks: [task], identity });

    // persist ran exactly once (initial), returned stale sentinel.
    expect(persist).toHaveBeenCalledTimes(1);
    // Truthful stale state — item reverts to `pending`, not `done` nor `save-failed`.
    expect(runner.statusOf('scene-1')).toBe('pending');
    // No save-failed entry registered (stale is distinguishable from I/O failure).
    expect(runner.saveFailedCount()).toBe(0);
    expect(runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'scene-1')).toBeUndefined();
    // Saving counter drained.
    expect(runner.isSaving()).toBe(false);
  });

  it('via real adapter: enqueueGeneratedSnapshot returns {stale:true} pre-enqueue → PERSIST_STALE reaches runner; item `pending`, no false done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Simulate the downstream draft hook: the live identity has already
    // drifted to a different storyId by the time persist runs — the
    // production `enqueueGeneratedSnapshot` short-circuits with
    // `{stale:true}` at the pre-enqueue identity guard.
    const enqueueGeneratedSnapshot = vi.fn(async () => ({ stale: true as const }));
    const getLiveIdentity = () => ({ storyId: 'story-A' as string | null, epoch: 0 });

    const task = buildSnapshotTask<{ url: string }, { url: string }>({
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      computePatch: (r) => ({ url: r.url }),
      getLiveIdentity,
      enqueueGeneratedSnapshot,
    });

    await runner.runItems({ tasks: [task], identity });

    // Adapter invoked enqueueGeneratedSnapshot exactly once, propagated
    // {stale:true} → PERSIST_STALE to the runner.
    expect(enqueueGeneratedSnapshot).toHaveBeenCalledTimes(1);
    // Runner distinguished stale from success/failure.
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.saveFailedCount()).toBe(0);
    expect(runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'scene-1')).toBeUndefined();
    expect(runner.isSaving()).toBe(false);
  });

  it('distinguishable from ordinary save failure: throw → save-failed + registry; PERSIST_STALE → pending, no registry', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Failing task → save-failed.
    const persistFail = vi.fn(async (): Promise<void> => {
      throw new Error('io down');
    });
    const failTask: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'fail-item',
      kind: 'scene',
      label: 'F',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: persistFail,
    };

    // Stale task → pending.
    const persistStale = vi.fn(async () => PERSIST_STALE);
    const staleTask: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'stale-item',
      kind: 'scene',
      label: 'S',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: persistStale,
    };

    await runner.runItems({ tasks: [failTask, staleTask], identity });

    expect(runner.statusOf('fail-item')).toBe('save-failed');
    expect(runner.statusOf('stale-item')).toBe('pending');
    // Only the failing item is in the registry.
    expect(runner.saveFailedCount()).toBe(1);
    expect(
      runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'fail-item'),
    ).toBeDefined();
    expect(
      runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'stale-item'),
    ).toBeUndefined();
  });
});

// =============================================================================
// Scenario 2 — identity change WHILE persistence is in-flight.
// =============================================================================
describe('A3a/S3 subtask 3 — identity change while persist in-flight', () => {
  it('persist starts, then resolves PERSIST_STALE mid-flight: item ends `pending`, no false done, no save-failed', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Gate the persist so we can observe `persisting` before it settles.
    const gate = makeDeferred<typeof PERSIST_STALE>();
    const persist = vi.fn(async () => gate.promise);
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist,
    };

    const runPromise = runner.runItems({ tasks: [task], identity });
    // Observe `persisting` mid-flight (I/O has settled from the caller's
    // perspective — persist call is in progress).
    await vi.waitFor(
      () => expect(runner.statusOf('scene-1')).toBe('persisting'),
      { timeout: 2000, interval: 1 },
    );
    expect(runner.isSaving()).toBe(true);

    // Now resolve as stale (simulates: downstream identity drifted during
    // the in-flight persist and no React commit happened).
    gate.resolve(PERSIST_STALE);
    await runPromise;

    // Truthful state model: pending (not done, not save-failed).
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.saveFailedCount()).toBe(0);
    expect(runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'scene-1')).toBeUndefined();
    // Saving counter drained.
    expect(runner.isSaving()).toBe(false);
    // Persist ran exactly once — the runner did NOT retry provider/apply.
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('retry save-only persist that resolves PERSIST_STALE mid-flight: item stays `save-failed`, entry stays in registry (retryable), no false done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    let call = 0;
    const providerSpy = vi.fn(async () => ({ url: 'v1' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    // 1st call: throw (initial persist fails → registers save-failed).
    // 2nd call: retry — resolves PERSIST_STALE.
    const gate = makeDeferred<typeof PERSIST_STALE>();
    const persist = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('io down');
      return gate.promise;
    });

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerSpy,
      apply: applySpy,
      persist,
    };

    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.saveFailedCount()).toBe(1);

    // Kick off retry — persist will await the gate.
    const retryPromise = runner.retrySaves(identity);
    await vi.waitFor(
      () => expect(runner.statusOf('scene-1')).toBe('persisting'),
      { timeout: 2000, interval: 1 },
    );

    // Resolve as stale.
    gate.resolve(PERSIST_STALE);
    await retryPromise;

    // Retryable outcome: entry stays in the registry, item stays save-failed.
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.saveFailedCount()).toBe(1);
    expect(
      runner.getSaveRetryRegistry().getLatestForItem('story-A', 0, 'scene-1'),
    ).toBeDefined();
    // Provider/apply never re-run on retry — persistence-only.
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
    // Saving counter drained cleanly (no leaks on stale retry path).
    expect(runner.isSaving()).toBe(false);
  });

  it('save-only retry that resolves PERSIST_STALE while the entry was already superseded by rev N+1: does NOT touch newer status', async () => {
    // Composes with the existing post-persist supersession logic — a
    // PERSIST_STALE mid-flight must NOT clear the newer entry nor overwrite
    // the newer status. This proves the stale branch preserves the runner's
    // existing state model.
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    let call = 0;
    const gate = makeDeferred<typeof PERSIST_STALE>();
    const persist = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('io down');
      return gate.promise;
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist,
    };
    await runner.runItems({ tasks: [task], identity });
    const registry = runner.getSaveRetryRegistry();
    const revNEntry = registry.getLatestForItem('story-A', 0, 'scene-1')!;
    expect(revNEntry.identity.generatedRevision).toBe(1);

    // Kick off retry (persist awaits gate).
    const retryPromise = runner.retrySaves(identity);
    await vi.waitFor(
      () => expect(runner.statusOf('scene-1')).toBe('persisting'),
      { timeout: 2000, interval: 1 },
    );

    // Meanwhile: rev N+1 replaces the entry (simulate the next apply).
    registry.clearExact(revNEntry.identity);
    const revNPlus1 = {
      identity: { storyId: 'story-A', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      snapshot: Object.freeze({ url: 'v2' }),
      provenance: { sourceRevision: 2, contentHash: hashSnapshot({ url: 'v2' }) },
      persist: vi.fn(async (): Promise<void> => {}),
    };
    registry.register(revNPlus1);
    runner.markResolved('scene-1'); // rev 2 already published `done`

    // Stale rev-1 retry resolves — must NOT overwrite rev-2's `done`, must
    // NOT touch the rev-2 registry entry.
    gate.resolve(PERSIST_STALE);
    await retryPromise;

    expect(runner.statusOf('scene-1')).toBe('done');
    expect(registry.getLatestForItem('story-A', 0, 'scene-1')).toBe(revNPlus1);
    expect(runner.isSaving()).toBe(false);
  });
});

// =============================================================================
// Adapter parity — initial persist and retry persist both propagate stale.
// =============================================================================
describe('A3a/S3 subtask 3 — adapter propagates stale identically on initial and retry', () => {
  it('buildSnapshotTask persist propagates {stale:true} → PERSIST_STALE on both initial and retry paths', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Sequence: initial persist fails (io down), retry persist returns
    // {stale:true}. The adapter must map both correctly.
    let call = 0;
    const enqueueGeneratedSnapshot = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('io down');
      return { stale: true as const };
    });
    const providerSpy = vi.fn(async () => ({ url: 'v1' }));
    const computePatchSpy = vi.fn((r: { url: string }) => ({ url: r.url }));

    const task = buildSnapshotTask<{ url: string }, { url: string }>({
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerSpy,
      computePatch: computePatchSpy,
      getLiveIdentity: () => ({ storyId: 'story-A' as string | null, epoch: 0 }),
      enqueueGeneratedSnapshot,
    });

    // Initial run: persist throws → save-failed + registry entry.
    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.saveFailedCount()).toBe(1);
    expect(enqueueGeneratedSnapshot).toHaveBeenCalledTimes(1);

    // Retry: enqueueGeneratedSnapshot returns {stale:true} → adapter maps
    // to PERSIST_STALE → runner leaves the entry as retryable, does NOT
    // mark done, does NOT clear registry.
    await runner.retrySaves(identity);
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.saveFailedCount()).toBe(1);
    expect(enqueueGeneratedSnapshot).toHaveBeenCalledTimes(2);
    // Provider/computePatch never re-run — persistence-only retry.
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(computePatchSpy).toHaveBeenCalledTimes(1);
  });
});
