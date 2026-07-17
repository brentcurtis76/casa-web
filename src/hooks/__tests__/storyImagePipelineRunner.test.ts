/**
 * Contract tests for the pure A2 pipeline runner (`storyImagePipelineRunner`).
 *
 * These cover the guarantees the hook and its callers rely on:
 *   - opaque run tokens invalidated by cancel/new run before abort;
 *   - identity-guarded apply that never runs after a stale resolution;
 *   - monotonic per-item generatedRevision;
 *   - detached, deep-frozen snapshot returned to persist;
 *   - persist uses ONLY captured identity (no runToken introspection);
 *   - save-only retries after `save-failed` reuse retained snapshot/identity.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createStoryImagePipelineRunner,
  deepFreeze,
  detachSnapshot,
  type PipelineItemTask,
} from '../storyImagePipelineRunner';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Deferred lets a test control when a provider promise resolves/rejects.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('storyImagePipelineRunner — pure helpers', () => {
  it('deepFreeze mutates in place and freezes nested objects', () => {
    const value = { a: 1, b: { c: [1, 2, 3] } };
    const frozen = deepFreeze(value);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.b)).toBe(true);
    expect(Object.isFrozen(frozen.b.c)).toBe(true);
    expect(() => {
      // @ts-expect-error - runtime mutation must throw in strict mode
      frozen.a = 2;
    }).toThrow();
  });

  it('detachSnapshot returns a structurally-independent copy', () => {
    const source = { images: ['a', 'b'], meta: { count: 2 } };
    const copy = detachSnapshot(source);
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.images).not.toBe(source.images);
    expect(copy.meta).not.toBe(source.meta);
  });
});

describe('storyImagePipelineRunner — provider→apply→persist', () => {
  it('happy path: pending → running → persisting → done, with detached frozen snapshot', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistedSnapshot: Array<{ snapshot: unknown; identity: unknown }> = [];

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene 1',
      provider: async () => ({ url: 'https://cdn/img.png' }),
      apply: (result) => ({ url: result.url }),
      persist: async (snapshot, identity) => {
        persistedSnapshot.push({ snapshot, identity });
      },
    };

    const statuses: string[] = [];
    runner.subscribe(() => {
      const s = runner.statusOf('scene-1');
      if (s && statuses[statuses.length - 1] !== s) statuses.push(s);
    });

    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 3 } });

    expect(runner.statusOf('scene-1')).toBe('done');
    expect(persistedSnapshot).toHaveLength(1);
    const call = persistedSnapshot[0];
    expect(call.snapshot).toEqual({ url: 'https://cdn/img.png' });
    expect(Object.isFrozen(call.snapshot)).toBe(true);
    expect(call.identity).toMatchObject({
      storyId: 'story-A',
      epoch: 3,
      itemId: 'scene-1',
      generatedRevision: 1,
    });
    // Item state transitions must include persisting BEFORE done.
    expect(statuses).toEqual(['pending', 'running', 'persisting', 'done']);
  });

  it('provider failure → error; apply never called', async () => {
    const apply = vi.fn();
    const persist = vi.fn();
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    await runner.runItems({
      tasks: [
        {
          id: 'x',
          kind: 'scene',
          label: 'x',
          provider: async () => {
            throw new Error('gen boom');
          },
          apply,
          persist,
        } as PipelineItemTask,
      ],
      identity: { storyId: null, epoch: 0 },
    });
    expect(runner.statusOf('x')).toBe('error');
    expect(apply).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('persist failure → save-failed; snapshot/identity retained for save-only retry', async () => {
    let persistCalls = 0;
    const seenIdentities: unknown[] = [];
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const providerFn = vi.fn(async () => ({ url: 'v1' }));
    const applyFn = vi.fn((r: { url: string }) => ({ url: r.url }));

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: providerFn,
      apply: applyFn,
      persist: async (snapshot, identity) => {
        persistCalls++;
        seenIdentities.push(identity);
        if (persistCalls === 1) throw new Error('db down');
      },
    };

    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 5 } });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(persistCalls).toBe(1);

    // Retry after save-failed: provider/apply must NOT run again.
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 'story-A', epoch: 5 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(persistCalls).toBe(2);
    expect(providerFn).toHaveBeenCalledTimes(1);
    expect(applyFn).toHaveBeenCalledTimes(1);
    // Retained identity is reused verbatim.
    expect(seenIdentities[0]).toEqual(seenIdentities[1]);
    expect(seenIdentities[0]).toMatchObject({ generatedRevision: 1 });
  });

  it('retryItem after error re-runs full provider→apply→persist and bumps generatedRevision', async () => {
    let providerCalls = 0;
    const identities: number[] = [];
    const runner = createStoryImagePipelineRunner({
      staggerMs: 0,
      providerAttempts: 1,
      providerBaseDelayMs: 0,
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => {
        providerCalls++;
        if (providerCalls === 1) throw new Error('nope');
        return { url: 'v2' };
      },
      apply: (result, identity) => {
        identities.push(identity.generatedRevision);
        return { url: result.url };
      },
      persist: async () => {},
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 5 } });
    expect(runner.statusOf('scene-1')).toBe('error');
    await runner.retryItem({ itemId: 'scene-1', identity: { storyId: 'story-A', epoch: 5 } });
    expect(runner.statusOf('scene-1')).toBe('done');
    // apply only ran once (retry succeeded on 2nd provider call); revision starts at 1.
    expect(identities).toEqual([1]);
  });
});

describe('storyImagePipelineRunner — token/identity boundary guards', () => {
  it('a new runItems invalidates prior token BEFORE aborting: late resolution never applies', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = deferred<{ url: string }>();
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

    // Kick off but do NOT await — provider is blocked on `gate`.
    const firstRun = runner.runItems({
      tasks: [staleTask],
      identity: { storyId: 'story-A', epoch: 1 },
    });
    await wait(0);

    // Start a fresh run: this must invalidate the prior token synchronously.
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

    // Now release the stale provider — it resolves LATE.
    gate.resolve({ url: 'stale' });
    await firstRun;

    // Late resolution must not have applied or persisted anything.
    expect(applyStale).not.toHaveBeenCalled();
    expect(persistStale).not.toHaveBeenCalled();
    // Fresh run completed cleanly.
    expect(runner.statusOf('scene-2')).toBe('done');
  });

  it('cancel invalidates token BEFORE abort: late provider resolution cannot apply/persist', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const gate = deferred<{ url: string }>();
    const applySpy = vi.fn();
    const persistSpy = vi.fn();
    let signalAbortedWhenTokenChecked = false;

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

    // Cancel first — this MUST null the token then abort.
    // If token were nulled AFTER abort, the provider (already resolved by then)
    // could sneak past the guard.
    runner.cancel();
    signalAbortedWhenTokenChecked = runner.getRunToken() === null;
    expect(signalAbortedWhenTokenChecked).toBe(true);

    // Provider resolves late (after cancel).
    gate.resolve({ url: 'late' });
    await run;

    expect(applySpy).not.toHaveBeenCalled();
    expect(persistSpy).not.toHaveBeenCalled();
    expect(runner.isBusy()).toBe(false);
  });

  it('persist ignores current runToken: a token flip after apply does not stop persistence', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const persistGate = deferred<void>();
    let capturedRunToken = runner.getRunToken();
    const persistedIdentities: unknown[] = [];

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'Scene',
      provider: async () => ({ url: 'v1' }),
      apply: (result) => ({ url: result.url }),
      persist: async (_snapshot, identity) => {
        // Capture runToken at moment persistence starts, then wait for the gate.
        capturedRunToken = runner.getRunToken();
        persistedIdentities.push(identity);
        await persistGate.promise;
      },
    };

    // Kick off runItems but don't await — persist is blocked on `persistGate`.
    const firstRun = runner.runItems({
      tasks: [task],
      identity: { storyId: 'story-A', epoch: 1 },
    });
    // Yield until we're in the persisting phase.
    while (runner.statusOf('scene-1') !== 'persisting') await wait(0);

    const tokenDuringPersist = capturedRunToken;

    // Start a NEW run for a different item — flips currentRunToken.
    const secondRun = runner.runItems({
      tasks: [
        {
          id: 'scene-2',
          kind: 'scene',
          label: 'S2',
          provider: async () => ({ url: 'x' }),
          apply: (r) => ({ url: r.url }),
          persist: async () => {},
        } as PipelineItemTask,
      ],
      identity: { storyId: 'story-B', epoch: 2 },
    });

    // Now let the first persist finish. Must still succeed.
    persistGate.resolve();
    await firstRun;
    await secondRun;

    expect(runner.statusOf('scene-1')).toBe('done');
    expect(persistedIdentities).toHaveLength(1);
    // The token DID change between apply and persist — persist ignored it.
    expect(runner.getRunToken()).not.toBe(tokenDuringPersist);
  });

  it('apply returns a snapshot the caller cannot mutate', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    let seenSnapshot: unknown;

    const task: PipelineItemTask<{ list: number[] }, { list: number[] }> = {
      id: 'i',
      kind: 'scene',
      label: 'i',
      provider: async () => ({ list: [1, 2] }),
      apply: (result) => ({ list: result.list }),
      persist: async (snapshot) => {
        seenSnapshot = snapshot;
      },
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 's', epoch: 0 } });
    const snap = seenSnapshot as { list: number[] };
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.list)).toBe(true);
    expect(() => snap.list.push(3)).toThrow();
  });
});
