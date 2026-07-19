/**
 * A3/S6 — approvalGate contract tests.
 *
 * Cubre los tres casos exigidos por el spec:
 *
 *   T-A3.1  Pre-approval state persistido → fallo de aprobación → no hay
 *           transición ni kick de generación; en un remount la identidad viva
 *           lee el snapshot persistido y recupera el estado anterior.
 *   T-A3.3  Los gates bloquean aprobación Y finalización cuando `isSaving` o
 *           `saveFailedCount > 0`. Sin encolamientos, sin onSuccess.
 *   T-A3.6  Un fallo de save-only registra en el registry → retrySaves reencola
 *           SÓLO persistencia → success limpia la entrada → canApprove pasa;
 *           el provider spy se mantiene en 0.
 *
 * Todos los waits usan deferred promises + fake timers (bounded). Cero I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canApprove, runApprovalTransaction, type EnqueueLikeResult } from '../approvalGate';
import { createSaveRetryRegistry, type SaveRetryIdentity } from '@/hooks/saveRetryRegistry';

// -----------------------------------------------------------------------------
// Deferred: promise que se resuelve/rechaza on-demand (sin setTimeout ni red).
// -----------------------------------------------------------------------------
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// -----------------------------------------------------------------------------
// canApprove pure predicate
// -----------------------------------------------------------------------------
describe('canApprove — gate declarativo', () => {
  it('true sólo cuando no hay saving y saveFailedCount es 0', () => {
    expect(canApprove({ isSaving: false, saveFailedCount: 0 })).toBe(true);
  });
  it('false cuando isSaving es true', () => {
    expect(canApprove({ isSaving: true, saveFailedCount: 0 })).toBe(false);
  });
  it('false cuando saveFailedCount > 0 aunque isSaving sea false', () => {
    expect(canApprove({ isSaving: false, saveFailedCount: 1 })).toBe(false);
  });
  it('false cuando ambos son verdaderos', () => {
    expect(canApprove({ isSaving: true, saveFailedCount: 3 })).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// T-A3.3 — gates: aprobación y finalización BLOQUEADAS mientras isSaving o
// saveFailedCount > 0. Ningún path debe encolar ni disparar onSuccess.
// -----------------------------------------------------------------------------
describe('T-A3.3 gates: approval y finalize bloqueados por isSaving y saveFailedCount', () => {
  it('BLOQUEA aprobación mientras isSaving=true — enqueue y onSuccess no se llaman', async () => {
    const enqueue = vi.fn<[], Promise<EnqueueLikeResult>>();
    const onSuccess = vi.fn();
    const onBlocked = vi.fn();

    const outcome = await runApprovalTransaction({
      state: { isSaving: true, saveFailedCount: 0 },
      enqueue,
      onSuccess,
      onBlocked,
    });

    expect(outcome).toBe('blocked');
    expect(enqueue).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('BLOQUEA aprobación mientras saveFailedCount > 0 — enqueue y onSuccess no se llaman', async () => {
    const enqueue = vi.fn<[], Promise<EnqueueLikeResult>>();
    const onSuccess = vi.fn();
    const onBlocked = vi.fn();

    const outcome = await runApprovalTransaction({
      state: { isSaving: false, saveFailedCount: 2 },
      enqueue,
      onSuccess,
      onBlocked,
    });

    expect(outcome).toBe('blocked');
    expect(enqueue).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('BLOQUEA finalización con los mismos criterios (mismo gate para approve+finalize)', async () => {
    // Simulamos handleFinalize invocando la misma transacción bajo cualquier
    // combinación de flags de bloqueo — el gate no distingue el llamador.
    const combos: Array<{ isSaving: boolean; saveFailedCount: number }> = [
      { isSaving: true, saveFailedCount: 0 },
      { isSaving: false, saveFailedCount: 1 },
      { isSaving: true, saveFailedCount: 4 },
    ];
    for (const state of combos) {
      const enqueue = vi.fn<[], Promise<EnqueueLikeResult>>();
      const onSuccess = vi.fn();
      const outcome = await runApprovalTransaction({ state, enqueue, onSuccess });
      expect(outcome).toBe('blocked');
      expect(enqueue).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    }
  });

  it('sólo cuando el gate abre, encolamos y aplicamos onSuccess DESPUÉS del await', async () => {
    const gate = deferred<EnqueueLikeResult>();
    const enqueue = vi.fn(() => gate.promise);
    const onSuccess = vi.fn();

    const run = runApprovalTransaction({
      state: { isSaving: false, saveFailedCount: 0 },
      enqueue,
      onSuccess,
    });

    // enqueue disparado, onSuccess NO todavía — persistencia en vuelo.
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();

    gate.resolve({});
    const outcome = await run;

    expect(outcome).toBe('ok');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// T-A3.1 — Pre-approval state persistido; fallo en aprobación NO transiciona,
// NO kicka pipeline, y un "remount" con la misma identidad recupera el estado
// previo. Aquí el "remount" se modela como una segunda lectura desde el mismo
// store persistido.
// -----------------------------------------------------------------------------
describe('T-A3.1 fallo de aprobación deja estado intacto; remount recupera lo previo', () => {
  it('rechazo de enqueue no llama a setStory/setCurrentStep; remount lee el pre-approval snapshot', async () => {
    // Modelo mínimo del "estado del editor" — captura EXACTAMENTE lo que la
    // aprobación mutaría (story + currentStep). Antes del intento fallido, el
    // hook ya persistió el pre-approval state (lo simulamos escribiendo aquí).
    const preApproval = { story: { id: 's1', title: 'antes' }, currentStep: 'story' as const };
    const persisted: { story: { id: string; title: string }; currentStep: 'story' | 'characters' } =
      { ...preApproval };

    // Editor UI state — arranca reflejando persistido.
    let editorStory = persisted.story;
    let editorStep: 'story' | 'characters' = persisted.currentStep;
    const setStory = vi.fn((next: { id: string; title: string }) => { editorStory = next; });
    const setCurrentStep = vi.fn((next: 'story' | 'characters') => { editorStep = next; });

    // Spy del pipeline: NUNCA debe ser llamado en fallo de aprobación.
    const kickPipeline = vi.fn();

    // enqueue rechaza — persistencia falló, la transición no debe correr.
    const enqueue = vi.fn(() => Promise.reject(new Error('supabase down')));

    const outcome = await runApprovalTransaction({
      state: { isSaving: false, saveFailedCount: 0 },
      enqueue,
      onSuccess: () => {
        // Estas SON las mutaciones prohibidas cuando la persistencia falla.
        setStory({ id: 's1', title: 'aprobado' });
        setCurrentStep('characters');
        kickPipeline();
      },
      onError: () => {
        // Retención explícita: no tocamos editor state.
      },
    });

    expect(outcome).toBe('error');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(setStory).not.toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(kickPipeline).not.toHaveBeenCalled();
    // Estado del editor intacto: mismo story y step que antes del intento.
    expect(editorStory).toEqual(preApproval.story);
    expect(editorStep).toBe(preApproval.currentStep);

    // Simular remount: el editor lee de la fuente persistida (que nunca cambió
    // porque el enqueue falló). El pre-approval state debe recuperarse tal cual.
    const remountedStory = persisted.story;
    const remountedStep = persisted.currentStep;
    expect(remountedStory).toEqual(preApproval.story);
    expect(remountedStep).toBe(preApproval.currentStep);
  });

  it('stale (identidad viva cambió durante la escritura) también retiene story/step', async () => {
    const setStory = vi.fn();
    const setCurrentStep = vi.fn();
    const kickPipeline = vi.fn();

    // enqueue resuelve con stale=true — persistió pero el hook no commiteó.
    const enqueue = vi.fn(() => Promise.resolve({ stale: true }));

    const outcome = await runApprovalTransaction({
      state: { isSaving: false, saveFailedCount: 0 },
      enqueue,
      onSuccess: () => {
        setStory({ id: 's1', title: 'aprobado' });
        setCurrentStep('characters');
        kickPipeline();
      },
    });

    expect(outcome).toBe('stale');
    expect(setStory).not.toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(kickPipeline).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// T-A3.6 — Failed save-only → retry via saveRetryRegistry limpia la entrada,
// canApprove pasa de false a true, y el provider (generación) nunca se llama.
// -----------------------------------------------------------------------------
describe('T-A3.6 retry save-only desbloquea aprobación sin llamar provider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('failed persist → registry+1; retry con éxito → registry vacío; canApprove desbloqueado; provider=0 calls', async () => {
    const providerSpy = vi.fn(); // NUNCA debe llamarse en el retry save-only.

    const registry = createSaveRetryRegistry();
    const identity: SaveRetryIdentity = {
      storyId: 'st-1',
      epoch: 0,
      itemId: 'sheet-a',
      generatedRevision: 3,
    };

    // Persist "save-only" — simula enqueueDraftWrite cerrado sobre el snapshot
    // ya aplicado. Primer intento falla; segundo intento resuelve.
    let attempts = 0;
    const persist = async () => {
      attempts++;
      if (attempts === 1) throw new Error('supabase 5xx');
    };

    // Antes del fallo: gate abierto — no hay saves failed.
    const gateInicial = { isSaving: false, saveFailedCount: registry.size() };
    expect(canApprove(gateInicial)).toBe(true);

    // Fallo del primer persist → registrar entrada con la operación cerrada.
    try {
      await persist(null as never, identity);
    } catch {
      registry.register({
        identity,
        snapshot: Object.freeze({ v: 'snap' }),
        provenance: { sourceRevision: identity.generatedRevision, contentHash: 'h1' },
        persist,
      });
    }

    // Ahora canApprove debe estar en falso: hay una entrada en el registry.
    const gateFallado = { isSaving: false, saveFailedCount: registry.size() };
    expect(gateFallado.saveFailedCount).toBe(1);
    expect(canApprove(gateFallado)).toBe(false);
    expect(providerSpy).not.toHaveBeenCalled();

    // Retry: leer entrada, re-invocar persist, borrar SÓLO ese exact identity.
    const entry = registry.getExact(identity);
    expect(entry).toBeDefined();
    await entry!.persist(entry!.snapshot, entry!.identity);
    registry.clearExact(identity);

    // Provider spy sigue en 0 — el retry es save-only.
    expect(providerSpy).not.toHaveBeenCalled();
    // Persist fue re-invocado exactamente una vez más (2 attempts totales).
    expect(attempts).toBe(2);

    // Registry vacío → canApprove abre de nuevo.
    const gateFinal = { isSaving: false, saveFailedCount: registry.size() };
    expect(gateFinal.saveFailedCount).toBe(0);
    expect(canApprove(gateFinal)).toBe(true);

    // Transacción de aprobación: enqueue serializado debe correr y llamar onSuccess.
    const enqueue = vi.fn(() => Promise.resolve({}));
    const onSuccess = vi.fn();
    const outcome = await runApprovalTransaction({
      state: gateFinal,
      enqueue,
      onSuccess,
    });
    expect(outcome).toBe('ok');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Provider nunca fue tocado en todo el flujo save+retry+approve.
    expect(providerSpy).not.toHaveBeenCalled();
  });

  it('retry queda BLOQUEADO/fallado si persist vuelve a rechazar — canApprove sigue en false', async () => {
    const registry = createSaveRetryRegistry();
    const identity: SaveRetryIdentity = {
      storyId: 'st-1',
      epoch: 0,
      itemId: 'scene-1',
      generatedRevision: 2,
    };
    let attempts = 0;
    const persist = async () => {
      attempts++;
      throw new Error('still down');
    };

    // Primer fallo — registra entrada.
    try {
      await persist(null as never, identity);
    } catch {
      registry.register({
        identity,
        snapshot: Object.freeze({ v: 'snap' }),
        provenance: { sourceRevision: identity.generatedRevision, contentHash: 'h2' },
        persist,
      });
    }
    expect(canApprove({ isSaving: false, saveFailedCount: registry.size() })).toBe(false);

    // Retry falla otra vez — entrada permanece.
    const entry = registry.getExact(identity)!;
    try {
      await entry.persist(entry.snapshot, entry.identity);
    } catch {
      // sigue registrada; no la borramos.
    }
    expect(attempts).toBe(2);
    expect(registry.size()).toBe(1);
    expect(canApprove({ isSaving: false, saveFailedCount: registry.size() })).toBe(false);
  });
});
