/**
 * FASE E / A9a — auto-kick atómico. Nivel runner + decisión pura.
 *
 * T-E.1  `shouldAutoKick` (puro): fire / clear / none, sin inferencia de pares.
 * T-E.5  `tryStart` (runner): aceptación ATÓMICA idle→running. Ocupado ⇒
 *        `accepted:false` SIN efectos secundarios (no aborta la corrida en
 *        vuelo, no mintea token, no encola ítems); al quedar idle, el reintento
 *        arranca EXACTAMENTE una vez.
 *
 * Estas pruebas usan el runner REAL (`createStoryImagePipelineRunner`) — no hay
 * mocks del sujeto bajo prueba. Sólo los `provider` de las tareas son deferreds
 * controlados por el test, que es la forma de fijar la ventana "ocupado".
 *
 * Base-red: `tryStart` no existe antes de este cambio (el editor infería el
 * kick de la transición `prevStep→currentStep`), así que el archivo entero
 * falla a compilar/ejecutar contra la fuente previa.
 */

import { describe, it, expect } from 'vitest';
import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type RunIdentity,
} from '../storyImagePipelineRunner';
import { shouldAutoKick } from '@/lib/cuentacuentos/autoKick';

const IDENTITY: RunIdentity = { storyId: 'story-e', epoch: 3 };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Tarea cuyo `provider` bloquea hasta que el test lo libera. `invokes` cuenta
 * las llamadas reales al provider: es la señal de "esto generó imágenes".
 */
function makeHeldTask(
  id: string,
  invokes: string[],
): { task: PipelineItemTask<{ url: string }, { url: string }>; release: () => void } {
  const gate = deferred<{ url: string }>();
  const task: PipelineItemTask<{ url: string }, { url: string }> = {
    id,
    kind: 'scene',
    label: `Scene ${id}`,
    provider: async () => {
      invokes.push(id);
      return gate.promise;
    },
    apply: (result) => ({ url: result.url }),
    persist: async () => {},
  };
  return { task, release: () => gate.resolve({ url: `https://cdn/${id}.png` }) };
}

describe('T-E.1 — shouldAutoKick (decisión pura)', () => {
  const live = { step: 'characters' as const, epoch: 3 };

  it('sin intent ⇒ none (nunca se infiere de una transición de pasos)', () => {
    expect(shouldAutoKick(null, live)).toBe('none');
    expect(shouldAutoKick(undefined, live)).toBe('none');
  });

  it('intent alineado (mismo paso y misma época) ⇒ fire', () => {
    expect(shouldAutoKick({ step: 'characters', epoch: 3 }, live)).toBe('fire');
  });

  it('época distinta (delete/regenerar/recovery entre medio) ⇒ clear, nunca fire', () => {
    expect(shouldAutoKick({ step: 'characters', epoch: 2 }, live)).toBe('clear');
    expect(shouldAutoKick({ step: 'characters', epoch: 4 }, live)).toBe('clear');
  });

  it('paso desalineado ⇒ clear sin disparar', () => {
    expect(shouldAutoKick({ step: 'scenes', epoch: 3 }, live)).toBe('clear');
    expect(shouldAutoKick({ step: 'cover', epoch: 3 }, live)).toBe('clear');
    // El caso que la inferencia legada trataba como avance válido: recuperar un
    // borrador un paso más adelante. Sin intent armado por una aprobación, no
    // hay disparo posible.
    expect(shouldAutoKick(null, { step: 'scenes', epoch: 3 })).toBe('none');
  });
});

describe('T-E.5 — tryStart: aceptación atómica idle→running', () => {
  it('runner idle ⇒ accepted:true y la corrida efectivamente arranca', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const invokes: string[] = [];
    const { task, release } = makeHeldTask('scene-1', invokes);

    const result = runner.tryStart({ tasks: [task], identity: IDENTITY });

    expect(result.accepted).toBe(true);
    // `running` quedó observable de forma SÍNCRONA: ésta es la garantía que
    // permite al caller consumir su intent en la sentencia siguiente.
    expect(runner.isBusy()).toBe(true);

    release();
    await result.completion;
    expect(invokes).toEqual(['scene-1']);
  });

  it('runner ocupado ⇒ accepted:false, CERO invokes nuevos y la corrida en vuelo sobrevive', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const invokes: string[] = [];
    const first = makeHeldTask('scene-first', invokes);
    const second = makeHeldTask('scene-second', invokes);

    const firstRun = runner.tryStart({ tasks: [first.task], identity: IDENTITY });
    expect(firstRun.accepted).toBe(true);
    // Esperar a que el provider de la primera corrida esté realmente en vuelo.
    await Promise.resolve();
    await Promise.resolve();
    const tokenDuringFirst = runner.getRunToken();

    const refused = runner.tryStart({ tasks: [second.task], identity: IDENTITY });

    expect(refused.accepted).toBe(false);
    // Rechazo SIN efectos secundarios: mismo token (no se minteó ni se
    // invalidó nada) y la segunda tarea nunca llamó a su provider.
    expect(runner.getRunToken()).toBe(tokenDuringFirst);
    expect(invokes).toEqual(['scene-first']);
    expect(runner.statusOf('scene-second')).toBeUndefined();

    // La corrida en vuelo NO fue abortada por el rechazo: completa normalmente.
    first.release();
    await firstRun.completion;
    expect(runner.statusOf('scene-first')).toBe('done');
  });

  it('ocupado → rechazado → idle → reintento ⇒ arranca EXACTAMENTE una vez', async () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const invokes: string[] = [];
    const first = makeHeldTask('scene-first', invokes);
    const pending = makeHeldTask('scene-pending', invokes);

    const firstRun = runner.tryStart({ tasks: [first.task], identity: IDENTITY });
    expect(firstRun.accepted).toBe(true);
    await Promise.resolve();

    // Intento durante la ventana ocupada: rechazado. El caller CONSERVA el intent.
    expect(runner.tryStart({ tasks: [pending.task], identity: IDENTITY }).accepted).toBe(false);

    // La primera corrida termina y el runner queda idle.
    first.release();
    await firstRun.completion;
    expect(runner.isBusy()).toBe(false);

    // Reintento del intent conservado: ahora sí se acepta.
    const retry = runner.tryStart({ tasks: [pending.task], identity: IDENTITY });
    expect(retry.accepted).toBe(true);

    pending.release();
    await retry.completion;

    // Exactamente un arranque para la tarea diferida: ni perdido ni duplicado.
    expect(invokes.filter((id) => id === 'scene-pending')).toEqual(['scene-pending']);
  });

  it('sin tareas ⇒ accepted:false y no se toca la corrida vigente', () => {
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const tokenBefore = runner.getRunToken();

    const result = runner.tryStart({ tasks: [], identity: IDENTITY });

    expect(result.accepted).toBe(false);
    expect(runner.getRunToken()).toBe(tokenBefore);
    expect(runner.isBusy()).toBe(false);
  });

  it('runItems (a diferencia de tryStart) SÍ desplaza la corrida previa', async () => {
    // Contraste explícito: documenta por qué el auto-kick no puede usar
    // `runItems` — desplazar la corrida en vuelo es justo lo que hay que evitar.
    const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
    const invokes: string[] = [];
    const first = makeHeldTask('scene-first', invokes);
    const second = makeHeldTask('scene-second', invokes);

    const firstRun = runner.tryStart({ tasks: [first.task], identity: IDENTITY });
    await Promise.resolve();
    const tokenDuringFirst = runner.getRunToken();

    const secondRun = runner.runItems({ tasks: [second.task], identity: IDENTITY });
    expect(runner.getRunToken()).not.toBe(tokenDuringFirst);

    first.release();
    second.release();
    await Promise.all([firstRun.completion, secondRun]);
    expect(invokes).toContain('scene-second');
  });
});
