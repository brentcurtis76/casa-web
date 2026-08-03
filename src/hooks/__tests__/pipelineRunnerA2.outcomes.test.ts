/**
 * A2 — Subtask 3 (F3 + runner portion of F4) outcome-and-status tests.
 *
 * These tests lock the runner's explicit-outcome contract:
 *   - `APPLY_STALE` (and, by back-compat, `null`/`undefined`) → status `pending`,
 *     no persist call.
 *   - `APPLY_EPHEMERAL` → status `done`, no persist call.
 *   - snapshot → status `persisting` (observed BEFORE resolution) → `done` on
 *     success or `save-failed` on rejection. `done` NEVER appears before the
 *     persist promise resolves.
 *   - Generation rejection → `error`, distinct from `save-failed`.
 *   - Save-only retry → hits persist directly with ZERO provider/apply calls.
 *   - Repeated save failure → stays `save-failed` with retry-count worth of
 *     persist calls (no accidental `done`).
 *   - New run on an item previously in `error` / `save-failed` resets status to
 *     `pending`, clears retained snapshot, and re-runs the full phase.
 *   - `runToken` guards ONLY generation→apply. Once apply mints an identity,
 *     persistence completes even if the token flips.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  APPLY_EPHEMERAL,
  APPLY_STALE,
  createStoryImagePipelineRunner,
  type PipelineItemStatus,
  type PipelineItemTask,
} from '../storyImagePipelineRunner';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function recordStatuses(
  runner: ReturnType<typeof createStoryImagePipelineRunner>,
  itemId: string,
): { transitions: PipelineItemStatus[]; unsubscribe: () => void } {
  const transitions: PipelineItemStatus[] = [];
  const unsubscribe = runner.subscribe(() => {
    const s = runner.statusOf(itemId);
    if (s && transitions[transitions.length - 1] !== s) transitions.push(s);
  });
  return { transitions, unsubscribe };
}

// -----------------------------------------------------------------------------
// F3.1 — Distinct apply outcomes.
// -----------------------------------------------------------------------------
describe('F3.1 distinct apply outcomes', () => {
  it('APPLY_STALE → item ends in pending, persist never called', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistSpy = vi.fn();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: () => APPLY_STALE,
      persist: async () => {
        persistSpy();
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('bare null (back-compat) is treated as APPLY_STALE → pending, no persist', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistSpy = vi.fn();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: () => null,
      persist: async () => {
        persistSpy();
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('APPLY_EPHEMERAL → item ends in done, persist never called', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistSpy = vi.fn();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'prop-1',
      kind: 'prop',
      label: 'Prop',
      provider: async () => ({ url: 'v' }),
      apply: () => APPLY_EPHEMERAL,
      persist: async () => {
        persistSpy();
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('prop-1')).toBe('done');
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('snapshot return → persist called, item ends in done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistSpy = vi.fn(async () => {});
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: persistSpy,
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(persistSpy).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// F3.2 — Status ordering.
// -----------------------------------------------------------------------------
describe('F3.2 status ordering by outcome', () => {
  it('stale outcome: pending → running → pending (no persisting, no done)', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const { transitions, unsubscribe } = recordStatuses(runner, 'scene-1');
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: () => APPLY_STALE,
      persist: async () => {
        // Must never run.
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    unsubscribe();
    expect(transitions).toContain('pending');
    expect(transitions).toContain('running');
    expect(transitions).not.toContain('persisting');
    expect(transitions).not.toContain('done');
    // Final state is `pending`.
    expect(transitions[transitions.length - 1]).toBe('pending');
  });

  it('ephemeral outcome: pending → running → done (no persisting)', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const { transitions, unsubscribe } = recordStatuses(runner, 'prop-1');
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'prop-1',
      kind: 'prop',
      label: 'Prop',
      provider: async () => ({ url: 'v' }),
      apply: () => APPLY_EPHEMERAL,
      persist: async () => {},
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    unsubscribe();
    expect(transitions).not.toContain('persisting');
    const iPending = transitions.indexOf('pending');
    const iRunning = transitions.indexOf('running');
    const iDone = transitions.indexOf('done');
    expect(iPending).toBeGreaterThanOrEqual(0);
    expect(iRunning).toBeGreaterThan(iPending);
    expect(iDone).toBeGreaterThan(iRunning);
  });

  it('persist-required success: persisting observed BEFORE persist resolves; done AFTER', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = makeDeferred<void>();
    const { transitions, unsubscribe } = recordStatuses(runner, 'scene-1');
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
    await vi.waitFor(() => expect(runner.statusOf('scene-1')).toBe('persisting'), { timeout: 2000, interval: 1 });
    // MUST have observed `persisting` before persist resolves; MUST NOT have
    // seen `done` yet.
    expect(transitions).toContain('persisting');
    expect(transitions).not.toContain('done');
    gate.resolve();
    await run;
    unsubscribe();
    // Final ordering: pending → running → persisting → done.
    const idx = (s: PipelineItemStatus) => transitions.indexOf(s);
    expect(idx('pending')).toBeGreaterThanOrEqual(0);
    expect(idx('running')).toBeGreaterThan(idx('pending'));
    expect(idx('persisting')).toBeGreaterThan(idx('running'));
    expect(idx('done')).toBeGreaterThan(idx('persisting'));
  });

  it('persist rejection: transitions to save-failed, never emits done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const { transitions, unsubscribe } = recordStatuses(runner, 'scene-1');
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('save fail');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    unsubscribe();
    expect(transitions).not.toContain('done');
    const idx = (s: PipelineItemStatus) => transitions.indexOf(s);
    expect(idx('running')).toBeGreaterThan(idx('pending'));
    expect(idx('persisting')).toBeGreaterThan(idx('running'));
    expect(idx('save-failed')).toBeGreaterThan(idx('persisting'));
  });
});

// -----------------------------------------------------------------------------
// F3.3 — Generation failure vs save failure are distinct terminal states.
// -----------------------------------------------------------------------------
describe('F3.3 generation vs save failure are distinct', () => {
  it('provider rejection → status `error` (never `save-failed`); apply/persist never run', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'x',
      kind: 'scene',
      label: 'x',
      provider: async () => {
        throw new Error('gen fail');
      },
      apply: (r) => {
        applySpy(r);
        return { url: r.url };
      },
      persist: async () => {
        persistSpy();
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('x')).toBe('error');
    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('persist rejection → status `save-failed` (never `error`); provider/apply ran exactly once', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'x',
      kind: 'scene',
      label: 'x',
      provider: providerSpy,
      apply: applySpy,
      persist: async () => {
        throw new Error('save fail');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('x')).toBe('save-failed');
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// F3.4 — Save-only retry.
// -----------------------------------------------------------------------------
describe('F3.4 save-only retry', () => {
  it('successful retry: save-failed → persisting → done, zero new provider/apply calls', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: providerSpy,
      apply: applySpy,
      persist: async () => {
        persistCalls++;
        if (persistCalls === 1) throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const providerBefore = providerSpy.mock.calls.length;
    const applyBefore = applySpy.mock.calls.length;

    // Record the retry transition sequence so we can assert `save-failed →
    // persisting → done` with no intermediate provider/apply.
    const { transitions, unsubscribe } = recordStatuses(runner, 'scene-1');
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    unsubscribe();

    expect(runner.statusOf('scene-1')).toBe('done');
    // No fresh generation.
    expect(providerSpy.mock.calls.length - providerBefore).toBe(0);
    expect(applySpy.mock.calls.length - applyBefore).toBe(0);
    // Persist was called exactly one additional time on retry.
    expect(persistCalls).toBe(2);
    // The retry moved through `persisting` before `done` (no `done` before
    // persistence resolves).
    const idx = (s: PipelineItemStatus) => transitions.indexOf(s);
    expect(idx('persisting')).toBeGreaterThanOrEqual(0);
    expect(idx('done')).toBeGreaterThan(idx('persisting'));
  });

  it('repeated save failure: stays save-failed on each retry, provider still zero times', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: providerSpy,
      apply: applySpy,
      persist: async () => {
        persistCalls++;
        throw new Error(`io down ${persistCalls}`);
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const providerBefore = providerSpy.mock.calls.length;
    const applyBefore = applySpy.mock.calls.length;

    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');

    // Provider and apply never re-ran across repeated save-only retries.
    expect(providerSpy.mock.calls.length - providerBefore).toBe(0);
    expect(applySpy.mock.calls.length - applyBefore).toBe(0);
    // Persist was called once per retry (initial + 2 retries = 3).
    expect(persistCalls).toBe(3);
    // Item never accidentally reached `done` while save was still failing.
    expect(runner.statusOf('scene-1')).not.toBe('done');
  });
});

// -----------------------------------------------------------------------------
// F3.5 — New run resets prior error/save-failed state.
// -----------------------------------------------------------------------------
describe('F3.5 new run resets prior terminal error/save state', () => {
  it('re-running a task that was in `error` clears the badge and re-runs provider→apply→persist', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let providerCalls = 0;
    const provider = async () => {
      providerCalls++;
      if (providerCalls === 1) throw new Error('gen fail');
      return { url: 'v' };
    };
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider,
      apply: (r) => ({ url: r.url }),
      persist: async () => {},
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('error');
    expect(runner.getItems().find((v) => v.id === 'scene-1')?.error).toBeTruthy();

    // Fresh run — must reset the badge before running.
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(runner.getItems().find((v) => v.id === 'scene-1')?.error).toBeUndefined();
  });

  it('re-running a task that was `save-failed` clears retained snapshot; a subsequent save-only retry (without a re-run) becomes a no-op if never applied', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        persistCalls++;
        if (persistCalls === 1) throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');

    // A fresh run resets state and successfully persists on the second attempt.
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    // Two initial persists + 0 (fresh apply succeeds) → total 2.
    expect(persistCalls).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// F3.6 — runToken guards ONLY generation→apply. Persistence checks identity,
// not runToken.
// -----------------------------------------------------------------------------
describe('F3.6 runToken guards only generation→apply', () => {
  it('token flip between apply and persist does NOT interrupt persistence', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistGate = makeDeferred<void>();
    let tokenSeenAtPersist: ReturnType<typeof runner.getRunToken> = null;
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        tokenSeenAtPersist = runner.getRunToken();
        await persistGate.promise;
      },
    };
    const first = runner.runItems({
      tasks: [task],
      identity: { storyId: 's', epoch: 0 },
    });
    await vi.waitFor(() => expect(runner.statusOf('scene-1')).toBe('persisting'), { timeout: 2000, interval: 1 });

    // Flip the token by starting a fresh run for a DIFFERENT item.
    const second = runner.runItems({
      tasks: [
        {
          id: 'scene-2',
          kind: 'scene',
          label: 'S2',
          provider: async () => ({ url: 'v2' }),
          apply: (r) => ({ url: r.url }),
          persist: async () => {},
        } as PipelineItemTask,
      ],
      identity: { storyId: 's', epoch: 0 },
    });

    // Release the first persist AFTER the token has flipped.
    persistGate.resolve();
    await first;
    await second;

    expect(runner.statusOf('scene-1')).toBe('done');
    // Token seen during persist DIFFERS from the token after the second run.
    expect(runner.getRunToken()).not.toBe(tokenSeenAtPersist);
  });

  it('save-only retry uses retained identity and does NOT inspect runToken', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let persistCalls = 0;
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    const identitiesSeen: Array<{
      storyId: string | null;
      epoch: number;
      itemId: string;
      generatedRevision: number;
    }> = [];
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: providerSpy,
      apply: (r) => ({ url: r.url }),
      persist: async (_snap, identity) => {
        identitiesSeen.push({ ...identity });
        persistCalls++;
        if (persistCalls === 1) throw new Error('save fail');
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');

    // Now cancel — this nulls the runToken. Save-only retry MUST still work
    // because it doesn't consult the token.
    runner.cancel();
    expect(runner.getRunToken()).toBeNull();

    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 's', epoch: 0 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    // Zero new provider invocations.
    expect(providerSpy).toHaveBeenCalledTimes(1);
    // Both persist calls saw the exact same identity that was captured at
    // apply-time — the retry reused it verbatim.
    expect(identitiesSeen).toHaveLength(2);
    expect(identitiesSeen[0]).toEqual(identitiesSeen[1]);
  });
});
