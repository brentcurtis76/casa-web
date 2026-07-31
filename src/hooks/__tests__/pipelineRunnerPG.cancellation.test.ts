/**
 * PG — Cancelación consistente a nivel de runner (T-G.3, T-G.4, T-G.6, T-G.7,
 * T-G.8, T-G.9).
 *
 * Todo corre contra el runner de PRODUCCIÓN (`createStoryImagePipelineRunner`).
 * Donde hace falta cubrir la superficie de persistencia se construyen las
 * tareas con la factory de producción (`makeSceneTask` → `buildSnapshotTask`),
 * inyectando sólo los dos bordes externos que esa factory ya recibe por
 * inyección: la invocación pagada y `enqueueGeneratedSnapshot`. Donde hace
 * falta coreografía fina de carreras (T-G.6/7/8) se usan tareas explícitas con
 * gates — el runner sigue siendo el de producción.
 *
 * Honestidad (G4): cancelar corta la espera del cliente y prohíbe despachos
 * futuros. NO revoca una petición ya despachada al edge ni recupera su gasto.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';
import { RetryCancelledError } from '@/lib/cuentacuentos/concurrency';
import { canApprove } from '@/lib/cuentacuentos/approvalGate';
import {
  makeSceneTask,
  type InvokeGenerateSceneImages,
  type ProviderResult,
} from '@/lib/cuentacuentos/taskFactories';
import type { EnqueueGeneratedSnapshotInput } from '@/hooks/useCuentacuentosDraft';
import type { EditorCreationStep } from '@/lib/cuentacuentos/recoverySnapshot';
import type { StoryScene } from '@/types/shared/story';

const IDENTITY: RunIdentity = { storyId: 'story-PG', epoch: 0 };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Evita "unhandled rejection" cuando el test rechaza el gate antes de que el
  // consumidor lo esté esperando.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

const SCENE: StoryScene = {
  number: 1,
  text: 'Ana entra a la cueva.',
  visualDescription: 'Ana con linterna',
} as StoryScene;

/**
 * Tarea de escena construida por la FACTORY DE PRODUCCIÓN. Sólo se inyectan
 * los bordes que la factory ya toma por inyección en producción: la invocación
 * pagada y la superficie de persistencia.
 */
function productionSceneTask(
  invoke: InvokeGenerateSceneImages,
  enqueue: (input: EnqueueGeneratedSnapshotInput) => Promise<undefined>,
) {
  return makeSceneTask({
    scene: SCENE,
    sceneData: { text: SCENE.text, visualDescription: SCENE.visualDescription },
    charactersWithReferences: [],
    location: undefined,
    sceneReferenceImage: undefined,
    propsForScene: [],
    illustrationStyle: 'ghibli',
    append: false,
    sceneImageOptionsRef: { current: {} },
    selectedSceneImagesRef: { current: {} },
    sceneReferenceModeRef: { current: {} },
    currentStepRef: { current: 'scenes' as EditorCreationStep },
    setSceneImageOptions: vi.fn(),
    setSelectedSceneImages: vi.fn(),
    invokeGenerateSceneImages: invoke,
    getLiveIdentity: () => IDENTITY,
    enqueueGeneratedSnapshot: enqueue,
  }) as unknown as PipelineItemTask;
}

const OK_RESULT: ProviderResult = { success: true, images: ['img-a', 'img-b'] };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// =============================================================================
// T-G.3 — Backoff del runner y paridad lote / ítem único
// =============================================================================

describe('T-G.3 — cancelar durante el backoff del runner', () => {
  it.each([
    { label: 'corrida de UN ítem', ids: ['scene-1'] },
    { label: 'corrida de LOTE (3 ítems)', ids: ['scene-1', 'scene-2', 'scene-3'] },
  ])('$label: 1 despacho por ítem, `pending` inmediato y final, cero apply/persist/enqueue', async ({ ids }) => {
    const enqueue = vi.fn(async (_i: EnqueueGeneratedSnapshotInput) => undefined);
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => {
      throw new Error('transient 500');
    });
    const runner = createStoryImagePipelineRunner({
      concurrency: 3,
      staggerMs: 0,
      providerAttempts: 2,
      providerBaseDelayMs: 1000,
    });
    // Un task de producción por id (mismo cuerpo, distinta identidad de ítem).
    const tasks = ids.map((id) => {
      const t = productionSceneTask(invoke, enqueue);
      return { ...t, id } as PipelineItemTask;
    });

    const run = runner.runItems({ tasks, identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);

    // Cada ítem gastó su intento 0 y está esperando el backoff.
    expect(invoke).toHaveBeenCalledTimes(ids.length);
    for (const id of ids) expect(runner.statusOf(id)).toBe('running');

    runner.cancel();

    // INMEDIATO: la normalización es síncrona con la invalidación.
    for (const id of ids) {
      expect(runner.statusOf(id)).toBe('pending');
      expect(runner.getItems().find((i) => i.id === id)?.error).toBeUndefined();
    }
    // La corrida cierra SIN correr el tiempo residual del backoff.
    await run;
    expect(runner.isBusy()).toBe(false);

    // FINAL: sigue `pending`; el intento N+1 nunca salió.
    for (const id of ids) expect(runner.statusOf(id)).toBe('pending');
    expect(invoke).toHaveBeenCalledTimes(ids.length);
    expect(enqueue).not.toHaveBeenCalled();

    // Y correr el tiempo que le quedaba al backoff tampoco despacha nada.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(invoke).toHaveBeenCalledTimes(ids.length);

    // El ítem cancelado se re-despacha normalmente en una corrida nueva.
    invoke.mockImplementation(async () => OK_RESULT);
    const retasks = ids.map((id) => {
      const t = productionSceneTask(invoke, enqueue);
      return { ...t, id } as PipelineItemTask;
    });
    await runner.runItems({ tasks: retasks, identity: IDENTITY });
    expect(invoke).toHaveBeenCalledTimes(ids.length * 2);
    for (const id of ids) expect(runner.statusOf(id)).toBe('done');
    expect(enqueue).toHaveBeenCalledTimes(ids.length);
  });
});

// =============================================================================
// T-G.4 — Stagger abortable
// =============================================================================

describe('T-G.4 — stagger abortable', () => {
  it('3 tareas / concurrencia 3 / stagger 400: los workers dormidos no despachan y la corrida cierra sin correr el stagger residual', async () => {
    const gate = deferred<{ url: string }>();
    const providerCalls: string[] = [];
    const runner = createStoryImagePipelineRunner({
      concurrency: 3,
      staggerMs: 400,
      providerAttempts: 1,
    });
    const mkTask = (id: string): PipelineItemTask => ({
      id,
      kind: 'scene',
      label: id,
      provider: async () => {
        providerCalls.push(id);
        return gate.promise;
      },
      apply: (r) => r as { url: string },
      persist: async () => undefined,
    });

    const run = runner.runItems({
      tasks: [mkTask('s-1'), mkTask('s-2'), mkTask('s-3')],
      identity: IDENTITY,
    });
    await vi.advanceTimersByTimeAsync(0);

    // Sólo el worker 0 (sin stagger) despachó; los workers 1 y 2 duermen.
    expect(providerCalls).toEqual(['s-1']);
    expect(runner.statusOf('s-2')).toBe('pending');
    expect(runner.statusOf('s-3')).toBe('pending');
    expect(vi.getTimerCount()).toBe(2);

    runner.cancel();

    // Las dos esperas de stagger se resolvieron de inmediato y quedaron
    // limpias: no hay timers residuales agendados.
    expect(vi.getTimerCount()).toBe(0);

    // La corrida cierra SIN avanzar ninguno de los dos staggers residuales.
    gate.resolve({ url: 'tarde' });
    await run;

    expect(providerCalls).toEqual(['s-1']);
    // Todos los ítems no aplicados quedan `pending` (el 1 fue barrido).
    expect(runner.statusOf('s-1')).toBe('pending');
    expect(runner.statusOf('s-2')).toBe('pending');
    expect(runner.statusOf('s-3')).toBe('pending');
    expect(runner.isBusy()).toBe(false);
  });
});

// =============================================================================
// T-G.6 — Aborto en vuelo y clasificación de la carrera
// =============================================================================

describe('T-G.6 — aborto en vuelo y clasificación', () => {
  it('T-G.6a — invocación que RESPETA la señal: cancelar produce `pending`, nunca `error`, sin apply/persist posterior', async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => undefined);
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 2, providerBaseDelayMs: 1000 });
    let sawSignal: AbortSignal | undefined;

    const task: PipelineItemTask = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: (ctx) =>
        new Promise((_res, rej) => {
          sawSignal = ctx.signal;
          ctx.signal.addEventListener('abort', () =>
            rej(new DOMException('The operation was aborted', 'AbortError')),
          );
        }),
      apply,
      persist,
    };

    const run = runner.runItems({ tasks: [task], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('scene-1')).toBe('running');
    expect(sawSignal?.aborted).toBe(false);

    runner.cancel();
    await run;

    expect(sawSignal?.aborted).toBe(true);
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBeUndefined();
    expect(apply).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('T-G.6b — falla genuina que corre la carrera contra la cancelación: gana la cancelación (`pending`, nunca `error`)', async () => {
    const apply = vi.fn();
    const persist = vi.fn(async () => undefined);
    const gate = deferred<never>();
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });

    const task: PipelineItemTask = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: () => gate.promise,
      apply,
      persist,
    };
    const run = runner.runItems({ tasks: [task], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);

    // La cancelación y una falla REAL del proveedor ocurren en la misma
    // ventana: el rechazo llega con la señal ya abortada.
    runner.cancel();
    gate.reject(new Error('cuota del proveedor agotada'));
    await run;

    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBeUndefined();
    expect(apply).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('T-G.6c — un RetryCancelledError con el token AÚN propio se clasifica como cancelación, no como error', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => {
        throw new RetryCancelledError();
      },
      apply: vi.fn(),
      persist: vi.fn(async () => undefined),
    };

    await runner.runItems({ tasks: [task], identity: IDENTITY });

    // El token sigue siendo el de esta corrida (nadie canceló ni desplazó):
    // la clasificación por CLASE es lo único que evita un `error` fantasma.
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBeUndefined();
  });

  it('T-G.6d — una falla genuina con señal VIVA y token propio sigue siendo `error`', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => {
        throw new Error('el modelo devolvió 500');
      },
      apply: vi.fn(),
      persist: vi.fn(async () => undefined),
    };

    await runner.runItems({ tasks: [task], identity: IDENTITY });

    expect(runner.statusOf('scene-1')).toBe('error');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBe(
      'el modelo devolvió 500',
    );
  });

  it('T-G.6e — un error genuino DISFRAZADO de cancelación (mismo `name`, otra clase) sigue siendo `error`', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const impostor = new Error('falla real disfrazada');
    impostor.name = 'RetryCancelledError';
    const task: PipelineItemTask = {
      id: 'scene-1',
      kind: 'scene',
      label: 'S1',
      provider: async () => {
        throw impostor;
      },
      apply: vi.fn(),
      persist: vi.fn(async () => undefined),
    };

    await runner.runItems({ tasks: [task], identity: IDENTITY });

    // Clasificar por nombre/mensaje convertiría esta falla real en `pending`.
    expect(runner.statusOf('scene-1')).toBe('error');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBe(
      'falla real disfrazada',
    );
  });
});

// =============================================================================
// T-G.7 — Terminación tardía de una invocación que IGNORA la señal
// =============================================================================

describe('T-G.7 — terminación tardía que ignora la señal', () => {
  it.each([
    { label: 'RESOLUCIÓN tardía', kind: 'resolve' as const },
    { label: 'RECHAZO tardío', kind: 'reject' as const },
  ])('$label tras cancelar: cero apply/persist/enqueue y el ítem queda `pending` inmediata y finalmente', async ({ kind }) => {
    const gate = deferred<ProviderResult>();
    const enqueue = vi.fn(async (_i: EnqueueGeneratedSnapshotInput) => undefined);
    // El proveedor IGNORA por completo `ctx.signal`.
    const invoke = vi.fn<InvokeGenerateSceneImages>(() => gate.promise);
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task = productionSceneTask(invoke, enqueue);

    const run = runner.runItems({ tasks: [task], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('scene-1')).toBe('running');

    runner.cancel();
    // INMEDIATO.
    expect(runner.statusOf('scene-1')).toBe('pending');

    if (kind === 'resolve') gate.resolve(OK_RESULT);
    else gate.reject(new Error('falla tardía'));
    await run;

    // FINAL: la continuación vieja perdió el token y quedó MUDA.
    expect(runner.statusOf('scene-1')).toBe('pending');
    expect(runner.getItems().find((i) => i.id === 'scene-1')?.error).toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// T-G.8 — Desplazamiento y propiedad del MISMO itemId  (prueba de peligro)
// =============================================================================

describe('T-G.8 — desplazamiento + propiedad por token del mismo itemId', () => {
  type NewState = 'pending' | 'running' | 'persisting' | 'done';
  type OldEnding = 'abort-reject' | 'late-success';

  /**
   * Coreografía: la corrida VIEJA deja X e Y en `running`; una corrida NUEVA
   * re-encola X (y dos rellenos que ocupan los workers) pero NO Y. Luego se
   * empuja a la X NUEVA hasta el estado pedido y recién ahí se hace terminar a
   * la X VIEJA. La X vieja no debe poder tocar nada.
   */
  async function scenario(newState: NewState, ending: OldEnding) {
    const runner = createStoryImagePipelineRunner({
      concurrency: 2,
      staggerMs: 0,
      providerAttempts: 1,
    });

    const oldX = deferred<{ v: string }>();
    const oldY = deferred<{ v: string }>();
    const applyOldX = vi.fn((r: unknown) => r as { v: string });
    const persistOldX = vi.fn(async () => undefined);

    const oldTaskX: PipelineItemTask = {
      id: 'X', kind: 'scene', label: 'X vieja',
      provider: () => oldX.promise, apply: applyOldX, persist: persistOldX,
    };
    const oldTaskY: PipelineItemTask = {
      id: 'Y', kind: 'scene', label: 'Y vieja',
      provider: () => oldY.promise, apply: vi.fn(), persist: vi.fn(async () => undefined),
    };

    const run1 = runner.runItems({ tasks: [oldTaskX, oldTaskY], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('X')).toBe('running');
    expect(runner.statusOf('Y')).toBe('running');

    // --- Desplazamiento: re-encola X, NO re-encola Y ---
    const fill1 = deferred<{ v: string }>();
    const fill2 = deferred<{ v: string }>();
    const newX = deferred<{ v: string }>();
    const newXPersist = deferred<undefined>();
    const applyNewX = vi.fn((r: unknown) => r as { v: string });
    const persistNewX = vi.fn(() => newXPersist.promise);

    const mkFill = (id: string, g: ReturnType<typeof deferred<{ v: string }>>): PipelineItemTask => ({
      id, kind: 'scene', label: id,
      provider: () => g.promise, apply: (r) => r as { v: string }, persist: async () => undefined,
    });
    const newTaskX: PipelineItemTask = {
      id: 'X', kind: 'scene', label: 'X nueva',
      provider: () => newX.promise, apply: applyNewX, persist: persistNewX,
    };

    // Los dos rellenos ocupan los 2 workers, así X NUEVA arranca en `pending`.
    const run2 = runner.runItems({
      tasks: [mkFill('F1', fill1), mkFill('F2', fill2), newTaskX],
      identity: IDENTITY,
    });

    // Y quedó normalizada SÍNCRONAMENTE por el barrido del desplazamiento.
    expect(runner.statusOf('Y')).toBe('pending');
    expect(runner.statusOf('X')).toBe('pending');

    // --- Empujar la X NUEVA hasta el estado bajo observación ---
    if (newState !== 'pending') {
      fill1.resolve({ v: 'f1' });
      await vi.advanceTimersByTimeAsync(0);
      expect(runner.statusOf('X')).toBe('running');
    }
    if (newState === 'persisting' || newState === 'done') {
      newX.resolve({ v: 'nuevo' });
      await vi.advanceTimersByTimeAsync(0);
      expect(runner.statusOf('X')).toBe('persisting');
    }
    if (newState === 'done') {
      newXPersist.resolve(undefined);
      await vi.advanceTimersByTimeAsync(0);
      expect(runner.statusOf('X')).toBe('done');
    }

    const applyNewCallsBefore = applyNewX.mock.calls.length;
    const persistNewCallsBefore = persistNewX.mock.calls.length;

    // --- Ahora termina la X VIEJA ---
    if (ending === 'abort-reject') {
      oldX.reject(new DOMException('The operation was aborted', 'AbortError'));
    } else {
      oldX.resolve({ v: 'viejo' });
    }
    await vi.advanceTimersByTimeAsync(0);

    // La continuación vieja NO escribió estado ni corrió su apply/persist.
    expect(runner.statusOf('X')).toBe(newState);
    expect(applyOldX).not.toHaveBeenCalled();
    expect(persistOldX).not.toHaveBeenCalled();
    // Ni tocó la tarea nueva.
    expect(applyNewX.mock.calls.length).toBe(applyNewCallsBefore);
    expect(persistNewX.mock.calls.length).toBe(persistNewCallsBefore);
    // Y quedó `pending`, intacta.
    expect(runner.statusOf('Y')).toBe('pending');

    // --- La persistencia aplicada de la X NUEVA completa igual ---
    if (newState !== 'done') {
      if (newState === 'pending') fill1.resolve({ v: 'f1' });
      newX.resolve({ v: 'nuevo' });
      await vi.advanceTimersByTimeAsync(0);
      newXPersist.resolve(undefined);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(runner.statusOf('X')).toBe('done');
    expect(applyNewX).toHaveBeenCalledTimes(1);
    expect(persistNewX).toHaveBeenCalledTimes(1);
    expect(applyOldX).not.toHaveBeenCalled();
    expect(persistOldX).not.toHaveBeenCalled();

    // Cierre limpio de ambas corridas.
    oldY.resolve({ v: 'y' });
    fill2.resolve({ v: 'f2' });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([run1, run2]);
  }

  const STATES: NewState[] = ['pending', 'running', 'persisting', 'done'];
  const ENDINGS: OldEnding[] = ['abort-reject', 'late-success'];

  for (const ending of ENDINGS) {
    for (const state of STATES) {
      it(`X vieja termina por ${ending} mientras la X nueva está en \`${state}\`: la vieja no altera nada`, async () => {
        await scenario(state, ending);
      });
    }
  }

  it('T-G.8-orden — el barrido del desplazamiento corre ANTES de que la corrida nueva instale y publique estado', async () => {
    const runner = createStoryImagePipelineRunner({ concurrency: 2, staggerMs: 0, providerAttempts: 1 });
    const oldA = deferred<{ v: string }>();
    const newA = deferred<{ v: string }>();

    const run1 = runner.runItems({
      tasks: [{ id: 'A', kind: 'scene', label: 'A vieja', provider: () => oldA.promise, apply: vi.fn(), persist: vi.fn(async () => undefined) }],
      identity: IDENTITY,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('A')).toBe('running');

    // Desplazamiento que RE-ENCOLA el mismo id. `reserveRun` es síncrono de
    // punta a punta, así que al retornar la corrida NUEVA ya tomó A y publicó
    // su `running`. Un barrido situado después de esa instalación devolvería A
    // a `pending` y le robaría el estado a la corrida que sí es su dueña.
    const run2 = runner.runItems({
      tasks: [{ id: 'A', kind: 'scene', label: 'A nueva', provider: () => newA.promise, apply: (r) => r as { v: string }, persist: async () => undefined }],
      identity: IDENTITY,
    });
    expect(runner.statusOf('A')).toBe('running');

    oldA.resolve({ v: 'viejo' });
    newA.resolve({ v: 'nuevo' });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all([run1, run2]);
    expect(runner.statusOf('A')).toBe('done');
  });
});

// =============================================================================
// T-G.9 — Persistencia y supervivencia del registry
// =============================================================================

describe('T-G.9 — persistencia y registry sobreviven al cancel de usuario', () => {
  it('T-G.9a — cancelar durante `persisting`: persist no recibe cancelación y completa a `done`', async () => {
    const persistGate = deferred<undefined>();
    const persistArgs: unknown[][] = [];
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1', kind: 'scene', label: 'S1',
      provider: async () => ({ v: 1 }),
      apply: (r) => r as { v: number },
      persist: (...args: unknown[]) => {
        persistArgs.push(args);
        return persistGate.promise;
      },
    };

    const run = runner.runItems({ tasks: [task], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('scene-1')).toBe('persisting');

    runner.cancel();
    // El barrido NO toca `persisting`.
    expect(runner.statusOf('scene-1')).toBe('persisting');
    expect(runner.isSaving()).toBe(true);

    persistGate.resolve(undefined);
    await run;

    expect(runner.statusOf('scene-1')).toBe('done');
    // `persist` recibe SÓLO snapshot + identidad: ninguna señal de cancelación.
    expect(persistArgs).toHaveLength(1);
    expect(persistArgs[0]).toHaveLength(2);
    expect(JSON.stringify(persistArgs[0])).not.toContain('signal');
  });

  it('T-G.9a-bis — cancelar durante `persisting` y luego fallar la persistencia deja el `save-failed` scopeado de siempre', async () => {
    const persistGate = deferred<undefined>();
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1', kind: 'scene', label: 'S1',
      provider: async () => ({ v: 1 }),
      apply: (r) => r as { v: number },
      persist: () => persistGate.promise,
    };

    const run = runner.runItems({ tasks: [task], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    runner.cancel();
    persistGate.reject(new Error('no se pudo guardar'));
    await run;

    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(runner.saveFailedCount(IDENTITY)).toBe(1);
    expect(runner.saveFailedCount({ storyId: 'otra-story', epoch: 0 })).toBe(0);
  });

  it('T-G.9b — con una entrada save-failed, el cancel de usuario preserva entrada exacta, conteo scopeado, gate de aprobación y retry save-only sin proveedor', async () => {
    let persistAttempt = 0;
    const providerCalls = vi.fn();
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1', kind: 'scene', label: 'S1',
      provider: async () => {
        providerCalls();
        return { v: 1 };
      },
      apply: (r) => r as { v: number },
      persist: async () => {
        persistAttempt++;
        if (persistAttempt === 1) throw new Error('no se pudo guardar');
        return undefined;
      },
    };

    await runner.runItems({ tasks: [task], identity: IDENTITY });
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(providerCalls).toHaveBeenCalledTimes(1);

    const registry = runner.getSaveRetryRegistry();
    const entryBefore = registry.getLatestForItem(IDENTITY.storyId, IDENTITY.epoch, 'scene-1');
    expect(entryBefore).toBeTruthy();
    const countBefore = runner.saveFailedCount(IDENTITY);
    expect(countBefore).toBe(1);
    expect(canApprove({ isSaving: runner.isSaving(), saveFailedCount: countBefore })).toBe(false);

    // --- CANCEL DE USUARIO ---
    runner.cancel();

    // Entrada EXACTA (misma referencia), conteo scopeado y gate: idénticos.
    expect(registry.getLatestForItem(IDENTITY.storyId, IDENTITY.epoch, 'scene-1')).toBe(
      entryBefore,
    );
    expect(runner.saveFailedCount(IDENTITY)).toBe(1);
    expect(runner.statusOf('scene-1')).toBe('save-failed');
    expect(
      canApprove({ isSaving: runner.isSaving(), saveFailedCount: runner.saveFailedCount(IDENTITY) }),
    ).toBe(false);

    // `retrySaves` sigue funcionando y NO invoca al proveedor.
    await runner.retrySaves(IDENTITY);
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(providerCalls).toHaveBeenCalledTimes(1);
    expect(runner.saveFailedCount(IDENTITY)).toBe(0);
    expect(
      canApprove({ isSaving: runner.isSaving(), saveFailedCount: runner.saveFailedCount(IDENTITY) }),
    ).toBe(true);
  });

  it('T-G.9b-bis — `retryItem` save-only tras el cancel también persiste sin proveedor', async () => {
    let persistAttempt = 0;
    const providerCalls = vi.fn();
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1', kind: 'scene', label: 'S1',
      provider: async () => {
        providerCalls();
        return { v: 1 };
      },
      apply: (r) => r as { v: number },
      persist: async () => {
        persistAttempt++;
        if (persistAttempt === 1) throw new Error('no se pudo guardar');
        return undefined;
      },
    };
    await runner.runItems({ tasks: [task], identity: IDENTITY });
    runner.cancel();

    await runner.retryItem({ itemId: 'scene-1', identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('scene-1')).toBe('done');
    expect(providerCalls).toHaveBeenCalledTimes(1);
  });

  it('T-G.9c — `error` y `done` previos al cancel sobreviven sin cambios; sólo `running` se normaliza', async () => {
    const gate = deferred<{ v: number }>();
    const runner = createStoryImagePipelineRunner({ concurrency: 3, staggerMs: 0, providerAttempts: 1 });

    const okTask: PipelineItemTask = {
      id: 'ok', kind: 'scene', label: 'ok',
      provider: async () => ({ v: 1 }), apply: (r) => r as { v: number }, persist: async () => undefined,
    };
    const errTask: PipelineItemTask = {
      id: 'err', kind: 'scene', label: 'err',
      provider: async () => {
        throw new Error('falla genuina');
      },
      apply: vi.fn(), persist: vi.fn(async () => undefined),
    };
    await runner.runItems({ tasks: [okTask, errTask], identity: IDENTITY });
    expect(runner.statusOf('ok')).toBe('done');
    expect(runner.statusOf('err')).toBe('error');

    // Una corrida nueva deja un tercer ítem en `running`…
    const liveTask: PipelineItemTask = {
      id: 'live', kind: 'scene', label: 'live',
      provider: () => gate.promise, apply: (r) => r as { v: number }, persist: async () => undefined,
    };
    const run = runner.runItems({ tasks: [liveTask], identity: IDENTITY });
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.statusOf('live')).toBe('running');

    runner.cancel();

    expect(runner.statusOf('live')).toBe('pending');
    expect(runner.statusOf('ok')).toBe('done');
    expect(runner.statusOf('err')).toBe('error');
    expect(runner.getItems().find((i) => i.id === 'err')?.error).toBe('falla genuina');

    gate.resolve({ v: 2 });
    await run;
    expect(runner.statusOf('live')).toBe('pending');
    expect(runner.statusOf('err')).toBe('error');
  });

  it('T-G.9d — el cancel de usuario NO invalida el registry de save-retries', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const task: PipelineItemTask = {
      id: 'scene-1', kind: 'scene', label: 'S1',
      provider: async () => ({ v: 1 }),
      apply: (r) => r as { v: number },
      persist: async () => {
        throw new Error('no se pudo guardar');
      },
    };
    await runner.runItems({ tasks: [task], identity: IDENTITY });
    expect(runner.saveFailedCount()).toBe(1);

    runner.cancel();
    runner.cancel();
    expect(runner.saveFailedCount()).toBe(1);
    expect(runner.saveFailedCount(IDENTITY)).toBe(1);
  });
});
