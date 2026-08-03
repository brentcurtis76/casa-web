/**
 * A3a/Subtask 4 — Save-retry: revision race, counter scoping, provenance,
 * saving-counter integrity.
 *
 * Cubre las invariantes específicas del subtask 4:
 *
 *  - T-A3a.1 (registry survives new run): `runItems` con un task set NUEVO
 *    NO limpia entradas pendientes del registry para otros ítems.
 *
 *  - T-A3a.2 (N retry vs N+1 replacement): un save-retry de rev N cuya
 *    persistencia RESUELVE mientras rev N+1 ya reemplazó su entrada NO
 *    limpia, NO marca `done` y NO altera el estado publicado por la
 *    revisión nueva. Sólo la revisión vigente decide.
 *
 *  - T-A3a.3 (provenance mismatch rejects swap): el registry entry lleva
 *    un `contentHash` no-nulo y un `sourceRevision` que empatan con el
 *    snapshot retenido; una entrada cuyo hash divergiera (imposible en
 *    práctica porque el snapshot está deep-frozen — pero explícitamente
 *    guardado) es rechazada antes de persistir.
 *
 *  - Concurrent saves keep isSaving true until they all settle.
 *
 *  - Story A registry failure does not affect Story B count/gate cuando el
 *    conteo se scopea via `saveFailedCount({storyId, epoch})`.
 *
 *  - Save retries invoke persistence only — provider spy stays at zero
 *    across every retry.
 *
 *  - Saving counter integrity: cero decrementos extra en early returns.
 *    `isSaving()` nunca se pega en `true` post-drain, ni cae debajo del
 *    correcto conteo simultáneo.
 *
 * Todo con deferred promises — cero timers, cero fake sleeps.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';
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

// -----------------------------------------------------------------------------
// T-A3a.1 — new runAll preserves pending retry
// -----------------------------------------------------------------------------
describe('T-A3a.1 new runAll preserves pending retry', () => {
  it('failing persist survives a subsequent runItems({tasks:[differentItem]})', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    const failing: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [failing], identity });
    expect(runner.saveFailedCount()).toBe(1);
    const registry = runner.getSaveRetryRegistry();
    const pending = registry.getLatestForItem('story-A', 0, 'scene-1');
    expect(pending).toBeDefined();
    expect(pending!.provenance.contentHash).not.toBeNull();

    // Nuevo runItems con OTRO ítem — no debe tocar la entrada de scene-1.
    const other: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-2',
      kind: 'scene',
      label: 'S2',
      provider: async () => ({ url: 'v2' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {},
    };
    await runner.runItems({ tasks: [other], identity });

    // scene-1 sigue en el registry (misma entrada, misma provenance).
    expect(runner.saveFailedCount()).toBe(1);
    const stillPending = registry.getLatestForItem('story-A', 0, 'scene-1');
    expect(stillPending).toBe(pending);
    expect(stillPending!.provenance.contentHash).toBe(pending!.provenance.contentHash);
    // scene-2 no dejó entrada.
    expect(registry.getLatestForItem('story-A', 0, 'scene-2')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// T-A3a.2 — N retry vs N+1 replacement performs no stale clear/done
// -----------------------------------------------------------------------------
describe('T-A3a.2 N retry vs N+1 replacement: post-persist revalidation', () => {
  it('N retry whose persist RESOLVES while N+1 has already replaced its entry does NOT clear or mark done', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Rev 1: falla en persist → registrado.
    let call = 0;
    const persistN = vi.fn(async (snap: unknown, id: { generatedRevision: number }) => {
      call++;
      if (id.generatedRevision === 1 && call === 1) throw new Error('io down');
      // El retry save-only de rev 1 será interceptado por el gate abajo.
    });

    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v1' }),
      apply: (r) => ({ url: r.url }),
      persist: persistN,
    };
    await runner.runItems({ tasks: [task], identity });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const registry = runner.getSaveRetryRegistry();
    const revNEntry = registry.getLatestForItem('story-A', 0, 'scene-1')!;
    expect(revNEntry.identity.generatedRevision).toBe(1);

    // Inyectamos manualmente un rev N+1 en el registry para simular el
    // "reemplazo por N+1" — el runner haría lo mismo cuando el próximo
    // apply válido ocurra. Removemos revN antes (como haría
    // invalidateBelowRevision al aplicar rev 2).
    registry.clearExact(revNEntry.identity);
    const revNPlus1Persist = vi.fn(async () => {});
    const revNPlus1Entry = {
      identity: { storyId: 'story-A', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      snapshot: Object.freeze({ url: 'v2' }),
      provenance: { sourceRevision: 2, contentHash: hashSnapshot({ url: 'v2' }) },
      persist: revNPlus1Persist,
    };
    registry.register(revNPlus1Entry);

    // Marca el status como si el rev N+1 hubiese sido persistido ok — la
    // revisión nueva es dueña del estado publicado.
    // (En la vida real setStatus lo hace el runner; aquí forzamos el escenario
    // "la nueva revisión ya salvó, y ahora llega tarde un persist stale de N".)
    // No hay API pública para setStatus; usamos markResolved para colocar
    // scene-1 en done — la garantía a probar es que un persist stale POSTERIOR
    // no revierta ni limpie nada.
    runner.markResolved('scene-1');
    expect(runner.statusOf('scene-1')).toBe('done');

    // Ahora corremos retrySaves — el retry SIEMPRE mira la entrada más
    // nueva del registry (rev 2), NUNCA la vieja (rev 1). rev 1 no se
    // reintenta a ninguna vía pública.
    const persistCallsBefore = persistN.mock.calls.length;
    const revNPlus1CallsBefore = revNPlus1Persist.mock.calls.length;
    await runner.retrySaves(identity);
    // rev N no se llamó; rev N+1 sí.
    expect(persistN.mock.calls.length - persistCallsBefore).toBe(0);
    expect(revNPlus1Persist.mock.calls.length - revNPlus1CallsBefore).toBe(1);
    // rev 2 tuvo éxito → registry se limpió, ítem sigue `done`.
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
  });

  it('save-retry whose persist resolves stale (entry no longer current) does NOT overwrite the ítem status', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    // Gate el persist del rev 1 para poder inyectar rev 2 mientras está in-flight.
    const gate = makeDeferred<void>();
    let call = 0;
    const persist = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('io down'); // rev 1 initial fails
      // Retry save-only de rev 1: espera el gate y luego RESUELVE (simulamos
      // éxito pero para una entrada que ya fue reemplazada por N+1).
      await gate.promise;
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
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    const registry = runner.getSaveRetryRegistry();
    const revNEntry = registry.getLatestForItem('story-A', 0, 'scene-1')!;
    expect(revNEntry.identity.generatedRevision).toBe(1);

    // Kick off retry (persist será el 2º call → await gate).
    const retryPromise = runner.retrySaves(identity);
    // Esperamos a que el status pase a persisting antes de mutar registry.
    await vi.waitFor(
      () => expect(runner.statusOf('scene-1')).toBe('persisting'),
      { timeout: 2000, interval: 1 },
    );
    expect(runner.isSaving()).toBe(true);

    // Mientras rev 1 está in-flight, reemplazamos por rev 2 (como lo haría
    // un apply N+1). Removemos revN, insertamos revN+1.
    registry.clearExact(revNEntry.identity);
    const revNPlus1 = {
      identity: { storyId: 'story-A', epoch: 0, itemId: 'scene-1', generatedRevision: 2 },
      snapshot: Object.freeze({ url: 'v2' }),
      provenance: { sourceRevision: 2, contentHash: hashSnapshot({ url: 'v2' }) },
      persist: vi.fn(async () => {}),
    };
    registry.register(revNPlus1);
    // Simulamos que rev 2 publicó `done` en el ítem (la revisión nueva manda).
    runner.markResolved('scene-1');

    // Ahora resolvemos el persist stale de rev 1. La revalidación post-persist
    // debe detectar que la entrada ya NO es la vigente → NO limpia registry,
    // NO marca done. Status sigue `done` (impuesto por rev 2), registry
    // sigue con la entrada rev 2.
    gate.resolve();
    await retryPromise;

    expect(runner.statusOf('scene-1')).toBe('done');
    expect(registry.getLatestForItem('story-A', 0, 'scene-1')).toBe(revNPlus1);
    expect(runner.saveFailedCount()).toBe(1); // rev 2 entry still pending
    // isSaving vuelve a false — un solo begin/end, no leaks.
    expect(runner.isSaving()).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// T-A3a.3 — obsolete source hash/revision rejects swap
// -----------------------------------------------------------------------------
describe('T-A3a.3 obsolete source hash/revision rejects retry', () => {
  it('failed persist stores non-null contentHash matching the retained snapshot; tampered provenance rejects retry', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const persist = vi.fn(async () => {
      throw new Error('io down');
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
    const entry = registry.getLatestForItem('story-A', 0, 'scene-1')!;
    // Provenance es no-nula y coincide con el hash determinista del snapshot.
    expect(entry.provenance.contentHash).not.toBeNull();
    expect(entry.provenance.contentHash).toBe(hashSnapshot(entry.snapshot));
    expect(entry.provenance.sourceRevision).toBe(entry.identity.generatedRevision);

    // Sustituimos la entrada por una con provenance obsoleta (contentHash
    // divergente frente al snapshot retenido) — simula el caso T-A3a.3 donde
    // un swap se intenta con una source-revision/hash obsoletos.
    registry.clearExact(entry.identity);
    const tamperedEntry = {
      ...entry,
      provenance: { sourceRevision: entry.provenance.sourceRevision, contentHash: 'deadbeef' },
    };
    registry.register(tamperedEntry);

    const persistBefore = persist.mock.calls.length;
    await runner.retrySaves(identity);
    // El guard de provenance del runner rechaza la escritura.
    expect(persist.mock.calls.length - persistBefore).toBe(0);
    expect(runner.statusOf('scene-1')).toBe('save-failed');
  });
});

// -----------------------------------------------------------------------------
// Concurrent saves keep isSaving true until they all settle.
// -----------------------------------------------------------------------------
describe('isSaving concurrency', () => {
  it('two concurrent persists keep isSaving true until BOTH settle', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };

    const gateA = makeDeferred<void>();
    const gateB = makeDeferred<void>();

    const taskA: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-a',
      kind: 'scene',
      label: 'A',
      provider: async () => ({ url: 'a' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        await gateA.promise;
      },
    };
    const taskB: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-b',
      kind: 'scene',
      label: 'B',
      provider: async () => ({ url: 'b' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        await gateB.promise;
      },
    };

    const runPromise = runner.runItems({ tasks: [taskA, taskB], identity });
    await vi.waitFor(
      () => {
        expect(runner.statusOf('scene-a')).toBe('persisting');
        expect(runner.statusOf('scene-b')).toBe('persisting');
      },
      { timeout: 2000, interval: 1 },
    );
    expect(runner.isSaving()).toBe(true);

    // Resolvemos sólo A — isSaving debe seguir true por B.
    gateA.resolve();
    await vi.waitFor(
      () => expect(runner.statusOf('scene-a')).toBe('done'),
      { timeout: 2000, interval: 1 },
    );
    expect(runner.isSaving()).toBe(true);
    expect(runner.statusOf('scene-b')).toBe('persisting');

    gateB.resolve();
    await runPromise;
    expect(runner.isSaving()).toBe(false);
    expect(runner.statusOf('scene-b')).toBe('done');
  });

  it('early-return path of executeSaveRetry never decrements savingCount extra times', async () => {
    // Regresión directa del bug del doble endSaving: una entrada que se
    // invalida entre el beginSaving() y el check "!registry.has(entry.identity)"
    // dentro del try DEBE emitir exactamente UN endSaving.
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const persist = vi.fn(async () => {
      throw new Error('io down');
    });
    const task: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist,
    };
    await runner.runItems({ tasks: [task], identity });
    expect(runner.isSaving()).toBe(false);
    expect(runner.saveFailedCount()).toBe(1);

    // Corrida concurrente de un persist válido en flight para tener un
    // "piso" observable de savingCount>0.
    const gate = makeDeferred<void>();
    const okTask: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-ok',
      kind: 'scene',
      label: 'OK',
      provider: async () => ({ url: 'ok' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        await gate.promise;
      },
    };
    const okRun = runner.runItems({ tasks: [okTask], identity });
    await vi.waitFor(
      () => expect(runner.statusOf('scene-ok')).toBe('persisting'),
      { timeout: 2000, interval: 1 },
    );
    expect(runner.isSaving()).toBe(true);

    // Ahora corremos varios retrySaves con la entrada ya invalidada.
    runner.invalidateSaveRetries({ storyId: 'story-A', epoch: 0 });
    for (let i = 0; i < 5; i++) {
      await runner.retrySaves(identity);
      // isSaving se mantiene TRUE por la persist válida en flight; ningún
      // retry stale debe haberla flipeado a false.
      expect(runner.isSaving()).toBe(true);
    }

    gate.resolve();
    await okRun;
    expect(runner.isSaving()).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Story A registry failure does not affect Story B count/gate.
// -----------------------------------------------------------------------------
describe('cross-story isolation of saveFailedCount', () => {
  it('failure on Story A leaves Story B saveFailedCount({storyId,epoch}) at 0', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const failing: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {
        throw new Error('io down');
      },
    };
    await runner.runItems({ tasks: [failing], identity: { storyId: 'story-A', epoch: 0 } });
    expect(runner.saveFailedCount({ storyId: 'story-A', epoch: 0 })).toBe(1);
    expect(runner.saveFailedCount({ storyId: 'story-B', epoch: 0 })).toBe(0);
    // Sin arg → total global.
    expect(runner.saveFailedCount()).toBe(1);

    // Story B corre con éxito — Story A sigue con 1 pendiente, Story B con 0.
    const ok: PipelineItemTask<{ url: string }, { url: string }> = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => ({ url: 'v' }),
      apply: (r) => ({ url: r.url }),
      persist: async () => {},
    };
    await runner.runItems({ tasks: [ok], identity: { storyId: 'story-B', epoch: 0 } });
    expect(runner.saveFailedCount({ storyId: 'story-A', epoch: 0 })).toBe(1);
    expect(runner.saveFailedCount({ storyId: 'story-B', epoch: 0 })).toBe(0);
    // Invalidar SÓLO Story A no toca a Story B; y viceversa.
    runner.invalidateSaveRetries({ storyId: 'story-A', epoch: 0 });
    expect(runner.saveFailedCount({ storyId: 'story-A', epoch: 0 })).toBe(0);
    expect(runner.saveFailedCount({ storyId: 'story-B', epoch: 0 })).toBe(0);
    expect(runner.saveFailedCount()).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Save retries invoke persistence only — provider spy stays at zero.
// -----------------------------------------------------------------------------
describe('save retries are persistence-only', () => {
  it('every retrySaves / retryItem for a save-failed entry calls only persist, never provider or apply', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const identity: RunIdentity = { storyId: 'story-A', epoch: 0 };
    const providerSpy = vi.fn(async () => ({ url: 'v' }));
    const applySpy = vi.fn((r: { url: string }) => ({ url: r.url }));
    let persistCall = 0;
    const persistSpy = vi.fn(async () => {
      persistCall++;
      if (persistCall < 4) throw new Error('io down');
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
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(runner.statusOf('scene-1')).toBe('save-failed');

    // Retries — providerSpy y applySpy jamás vuelven a llamarse.
    for (let i = 0; i < 3; i++) {
      await runner.retrySaves(identity);
    }
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledTimes(4);
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
  });
});
