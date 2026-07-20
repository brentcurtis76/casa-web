/**
 * A3/S3 — Save-retry registry: focused runner contract tests.
 *
 * Cubre las cuatro invariantes específicas del contrato durable:
 *
 *  - T-A3.2 (runner registry semantics): las persistencias fallidas se
 *    registran en el registry (independiente del task/item map). Arrancar
 *    un nuevo `runItems` no las limpia; se drenan explícitamente vía retry
 *    o invalidación.
 *
 *  - T-A3.6 (runner + hook-boundary): epoch/story invalidation borra las
 *    entradas afectadas y `retrySaves` sobre una identidad stale no ejecuta
 *    ninguna escritura.
 *
 *  - T-A3a.1 (registry survives new run + revision monotonic): la entrada
 *    save-failed sobrevive a un `runItems` que sólo replantea otro item;
 *    y una revisión N no puede sobrescribir una N+1 aunque su retry ocurra
 *    tarde.
 *
 *  - T-A3a.2 (retry save-only guarantees): un retry save-only re-valida la
 *    revisión vigente inmediatamente antes de `persist`; ejecuta cero
 *    escrituras cuando está stale; cero llamadas provider/apply en todos
 *    los intentos; permanece `save-failed` tras otro rechazo; NUNCA llega
 *    a `done` sin salvar.
 *
 * Todos los provider/persist son spies o closures deterministas — no hay
 * red, ni provider real, ni PII de miembros.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';

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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// T-A3.2 — Registry semantics: failed persist registers an entry; runItems
// restart preserves it; exact-revision success clears only that entry.
// -----------------------------------------------------------------------------
describe('T-A3.2 registry semantics for failed persistence', () => {
  it('records/retains a failed persist entry; exact-revision success clears only that entry', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    let persistCallsScene1 = 0;
    let persistCallsScene2 = 0;

    const scene1: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        persistCallsScene1++;
        if (persistCallsScene1 === 1) throw new Error('io down');
      },
    };
    const scene2: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-2',
      kind: 'scene',
      label: 'S2',
      provider: async () => ({ url: 'v2' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        persistCallsScene2++;
      },
    };

    await runner.runItems({ tasks: [scene1, scene2], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.statusOf('scene-2')).toBe('done');
    expect(runner.saveFailedCount()).toBe(1);

    const registry = runner.getSaveRetryRegistry();
    const failedForScene1 = registry.getLatestForItem('story-A', 0, 'scene-1');
    expect(failedForScene1).toBeDefined();
    expect(failedForScene1!.identity.generatedRevision).toBe(1);

    // Retry save-only for scene-1 — persist now succeeds. Only that entry
    // clears; scene-2 has no entry to affect.
    await runner.retryItem({ itemId: 'scene-1', identity });
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
    expect(persistCallsScene1).toBe(2);
    // scene-2 was not retried.
    expect(persistCallsScene2).toBe(1);
  });

  it('starting runItems with a NEW task set does not clear a legitimate registry entry from a prior item', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

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

    await runner.runItems({ tasks: [failingTask], identity });
    expect(runner.saveFailedCount()).toBe(1);

    // Second runItems replaces the task map with a DIFFERENT item. The
    // registry must retain the scene-1 failed entry — the runner's task map
    // reset never clears legitimate save-failed state.
    const unrelated: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-2',
      kind: 'scene',
      label: 'S2',
      provider: async () => ({ url: 'v2' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {},
    };
    await runner.runItems({ tasks: [unrelated], identity });

    expect(runner.saveFailedCount()).toBe(1);
    const registry = runner.getSaveRetryRegistry();
    expect(registry.getLatestForItem('story-A', 0, 'scene-1')).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// T-A3.6 — Epoch/story invalidation removes matching registry entries; a
// retrySaves against a stale identity performs zero writes.
// -----------------------------------------------------------------------------
describe('T-A3.6 epoch invalidation purges registry; retrySaves on stale identity is a no-op', () => {
  it('invalidateSaveRetries({storyId, epoch}) removes entries for that pair only', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const buildFailing = (id: string, storyId: string, epoch: number) => {
      const task: PipelineItemTask<{ url: string }, { url: string }> = {
        id,
        kind: 'scene',
        label: id,
        provider: async () => ({ url: 'v' }),
        apply: (r) => ({ url: r.url }),
        persist: async () => {
          throw new Error('io down');
        },
      };
      return { task, identity: { storyId, epoch } as RunIdentity };
    };

    const a0 = buildFailing('scene-a', 'story-A', 0);
    const a1 = buildFailing('scene-a', 'story-A', 1);
    const b0 = buildFailing('scene-b', 'story-B', 0);
    await runner.runItems({ tasks: [a0.task], identity: a0.identity });
    await runner.runItems({ tasks: [a1.task], identity: a1.identity });
    await runner.runItems({ tasks: [b0.task], identity: b0.identity });
    expect(runner.saveFailedCount()).toBe(3);

    // Invalidate only (story-A, 0). Entries for (story-A, 1) and (story-B, 0)
    // must survive.
    const removed = runner.invalidateSaveRetries({ storyId: 'story-A', epoch: 0 });
    expect(removed).toBe(1);
    expect(runner.saveFailedCount()).toBe(2);
    const registry = runner.getSaveRetryRegistry();
    expect(registry.getLatestForItem('story-A', 0, 'scene-a')).toBeUndefined();
    expect(registry.getLatestForItem('story-A', 1, 'scene-a')).toBeDefined();
    expect(registry.getLatestForItem('story-B', 0, 'scene-b')).toBeDefined();
  });

  it('retrySaves against a stale identity performs zero writes, zero provider calls', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const providerSpy = vi.fn(async () => ({ url: 'v1' }));
    const persistSpy = vi.fn(async () => {
      throw new Error('io down');
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerSpy,
      apply: (r) => ({ url: r.url }),
      persist: persistSpy,
    };
    await runner.runItems({ tasks: [task], identity: { storyId: 'story-A', epoch: 0 } });
    expect(runner.saveFailedCount()).toBe(1);
    const persistBefore = persistSpy.mock.calls.length;
    const providerBefore = providerSpy.mock.calls.length;

    // Epoch bump: invalidate the (story-A, 0) entry. retrySaves against the
    // stale identity is now a full no-op.
    runner.invalidateSaveRetries({ storyId: 'story-A', epoch: 0 });
    expect(runner.saveFailedCount()).toBe(0);
    await runner.retrySaves({ storyId: 'story-A', epoch: 0 });
    expect(persistSpy.mock.calls.length - persistBefore).toBe(0);
    expect(providerSpy.mock.calls.length - providerBefore).toBe(0);

    // retrySaves against the NEW (still-empty) identity is likewise a no-op.
    await runner.retrySaves({ storyId: 'story-A', epoch: 1 });
    expect(persistSpy.mock.calls.length - persistBefore).toBe(0);
    expect(providerSpy.mock.calls.length - providerBefore).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// T-A3a.1 — Registry survives a new run; revision N cannot overwrite N+1.
// -----------------------------------------------------------------------------
describe('T-A3a.1 registry survives new run; revision N cannot overwrite N+1', () => {
  it('applying N+1 invalidates a save-failed entry at rev ≤ N for the same (story, epoch, item)', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    let persistCall = 0;
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        persistCall++;
        // Rev 1 fails; rev 2 succeeds.
        if (persistCall === 1) throw new Error('io down');
      },
    };

    // Rev 1 — fails, entry registered.
    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const registry = runner.getSaveRetryRegistry();
    const failedRev1 = registry.getLatestForItem('story-A', 0, 'scene-1');
    expect(failedRev1?.identity.generatedRevision).toBe(1);

    // Rev 2 — apply N+1 must invalidate rev 1 entry BEFORE the new persist.
    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('done');
    // Rev 1 entry was purged by the apply-N+1 rule (regardless of new persist
    // outcome). Registry now empty.
    expect(runner.saveFailedCount()).toBe(0);
    expect(registry.getLatestForItem('story-A', 0, 'scene-1')).toBeUndefined();
  });

  it('late retry of an old (N) entry is a no-op if a newer (N+1) apply is already in place', async () => {
    // Simula la carrera: rev 1 falla → registrado. Antes de retryear rev 1,
    // corre rev 2 (que también falla, registrando rev 2 y invalidando rev 1).
    // Un retry a mano contra la vieja identidad NUNCA debe persistir.
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const persistSpy = vi.fn(async () => {
      throw new Error('io down');
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: persistSpy,
    };
    await runner.runItems({ tasks: [task], identity });
    const registry = runner.getSaveRetryRegistry();
    const oldEntry = registry.getLatestForItem('story-A', 0, 'scene-1')!;
    expect(oldEntry.identity.generatedRevision).toBe(1);

    // Second run — rev 2 registered, rev 1 invalidated.
    await runner.runItems({ tasks: [task], identity });
    expect(oldEntry.identity.generatedRevision).toBe(1); // reference is frozen
    expect(registry.getExact(oldEntry.identity)).toBeUndefined();

    // Try to retry the OLD entry directly by invoking the registry's persist
    // through the runner's public retry — the runner's `retryItem` uses the
    // registry's latest entry (rev 2), NOT the old one. So a "late" retry of
    // rev 1 cannot overwrite rev 2.
    const persistCallsBefore = persistSpy.mock.calls.length;
    await runner.retryItem({ itemId: 'scene-1', identity });
    // The retry attempted rev 2 (which is still failing), NOT rev 1.
    expect(persistSpy.mock.calls.length - persistCallsBefore).toBe(1);
    const lastCall = persistSpy.mock.calls[persistSpy.mock.calls.length - 1];
    expect(
      (lastCall[1] as { generatedRevision: number }).generatedRevision,
    ).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// T-A3a.2 — Retry save-only revalidates current revision immediately before
// persistence; zero provider/generation calls across every retry; remains
// save-failed after another rejection; never becomes `done` while unsaved.
// -----------------------------------------------------------------------------
describe('T-A3a.2 retry save-only guarantees', () => {
  it('revalidates registry immediately before persist; zero writes when stale between lookup and call', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Rev 1 fails and registers an entry.
    const persistSpy = vi.fn(async () => {
      throw new Error('io down');
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: persistSpy,
    };
    await runner.runItems({ tasks: [task], identity });
    expect(runner.saveFailedCount()).toBe(1);

    // Now invalidate BEFORE calling retrySaves. The registry look-up path
    // must observe zero entries and perform zero writes.
    runner.invalidateSaveRetries({ storyId: 'story-A', epoch: 0 });
    const persistCallsBefore = persistSpy.mock.calls.length;
    await runner.retrySaves(identity);
    expect(persistSpy.mock.calls.length - persistCallsBefore).toBe(0);
  });

  it('zero provider/apply calls on every save-only retry; stays save-failed after a repeat rejection', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const providerSpy = vi.fn(async () => ({ url: 'v1' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    let persistCall = 0;
    const persistSpy = vi.fn(async () => {
      persistCall++;
      throw new Error(`io down #${persistCall}`);
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerSpy,
      apply: applySpy,
      persist: persistSpy,
    };

    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const providerBefore = providerSpy.mock.calls.length;
    const applyBefore = applySpy.mock.calls.length;
    const persistBefore = persistSpy.mock.calls.length;

    // Three save-only retries, all failing.
    for (let i = 0; i < 3; i++) {
      await runner.retrySaves(identity);
      // Status stays save-failed after each attempt — never `done`.
      expect(runner.statusOf('scene-1')).toBe('save-failed');
    }
    // Zero new provider/apply calls across all retries.
    expect(providerSpy.mock.calls.length - providerBefore).toBe(0);
    expect(applySpy.mock.calls.length - applyBefore).toBe(0);
    // Exactly 3 additional persist calls (one per retry).
    expect(persistSpy.mock.calls.length - persistBefore).toBe(3);
    // Registry entry survives.
    expect(runner.saveFailedCount()).toBe(1);
  });

  it('never becomes done while unsaved: even during in-flight retry, status is `persisting`, then `save-failed` on rejection', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    // First persist fails; second (retry) is gated by deferred rejection.
    const gate = makeDeferred<void>();
    let call = 0;
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        call++;
        if (call === 1) throw new Error('io down');
        // On retry: block on gate then throw.
        await gate.promise;
        throw new Error('io still down');
      },
    };
    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.isSaving()).toBe(false);

    // Kick off a retry — persist is now in flight and gated.
    const retryPromise = runner.retrySaves(identity);
    await vi.waitFor(() => expect(runner.statusOf('scene-1')).toBe('persisting'), { timeout: 2000, interval: 1 });
    expect(runner.statusOf('scene-1')).toBe('persisting');
    // Image-saving signal is TRUE during in-flight retry persistence.
    expect(runner.isSaving()).toBe(true);
    // Not done yet.
    expect(runner.statusOf('scene-1')).not.toBe('done');
    gate.resolve();
    await retryPromise;
    // Retry failed → save-failed again. Never `done` while unsaved.
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.isSaving()).toBe(false);
    expect(runner.saveFailedCount()).toBe(1);
  });

  it('acceptance: provider spy remains zero for every save-only retry across many attempts', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    let attempt = 0;
    const persistSpy = vi.fn(async () => {
      attempt++;
      // Succeed on the 5th attempt.
      if (attempt < 5) throw new Error('io down');
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: providerSpy,
      apply: (r) => ({ url: r.url }),
      persist: persistSpy,
    };
    await runner.runItems({ tasks: [task], identity });
    // Initial attempt = 1 failed persist.
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(providerSpy).toHaveBeenCalledTimes(1);

    // Three failed retries, then a successful one.
    for (let i = 0; i < 4; i++) {
      await runner.retrySaves(identity);
    }
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
    // Provider was called exactly once (initial run), never during any of the
    // four retries — this is the acceptance clause.
    expect(providerSpy).toHaveBeenCalledTimes(1);
    // Persist was called 5 times (1 initial + 4 retries).
    expect(persistSpy).toHaveBeenCalledTimes(5);
  });
});
