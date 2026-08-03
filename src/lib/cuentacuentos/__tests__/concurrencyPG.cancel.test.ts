/**
 * PG / T-G.1 + T-G.2 — Primitiva de cancelación de `retryWithBackoff`, probada
 * DIRECTAMENTE contra el helper de producción (sin runner de por medio) y con
 * timers falsos.
 *
 * T-G.1 (cambio de comportamiento, base-red en 5f7b6bd): cancelación antes del
 * intento 0, durante el backoff, y vuelta a chequear cuando la espera vence
 * normalmente; más limpieza de timer y listener en los cuatro caminos de
 * salida (éxito, falla del proveedor, espera vencida, cancelación).
 *
 * T-G.2 (control de compatibilidad, ya-verdadero + mutación nombrada): sin
 * entrada de cancelación, el comportamiento previo se conserva EXACTO —
 * mismos despachos, mismos delays, mismo jitter.
 *
 * Honestidad (G4): cancelar corta la espera del cliente y prohíbe despachos
 * futuros. No revoca una petición ya despachada ni recupera su gasto; este
 * archivo no prueba ni afirma nada sobre el servidor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RetryCancelledError, retryWithBackoff } from '../concurrency';

/**
 * AbortController REAL cuya señal lleva contadores de add/removeEventListener.
 * El balance neto es la prueba de que la espera abortable no deja listeners
 * colgando de una señal que vive más que ella.
 */
function trackedController() {
  const controller = new AbortController();
  const added = vi.spyOn(controller.signal, 'addEventListener');
  const removed = vi.spyOn(controller.signal, 'removeEventListener');
  return {
    controller,
    signal: controller.signal,
    added,
    removed,
    /** listeners instalados y no retirados */
    balance: () => added.mock.calls.length - removed.mock.calls.length,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('T-G.1 — primitiva de cancelación de retryWithBackoff', () => {
  it('T-G.1a — ya cancelada antes del intento 0: cero despachos y rechazo con RetryCancelledError', async () => {
    const t = trackedController();
    t.controller.abort();
    const fn = vi.fn(async () => 'nunca');

    const err = await retryWithBackoff(fn, { attempts: 3, baseDelayMs: 1000, signal: t.signal })
      .then(() => 'resolvió' as unknown, (e) => e);

    expect(err).toBeInstanceOf(RetryCancelledError);
    expect(fn).toHaveBeenCalledTimes(0);
    // Ni siquiera se armó una espera.
    expect(vi.getTimerCount()).toBe(0);
    expect(t.balance()).toBe(0);
  });

  it('T-G.1b — cancelación durante el backoff: resuelve sin correr el timer residual y NO despacha el intento 1', async () => {
    const t = trackedController();
    let calls = 0;
    const settled = retryWithBackoff(
      async () => {
        calls++;
        throw new Error('transient');
      },
      { attempts: 3, baseDelayMs: 1000, signal: t.signal },
    ).then(() => 'resolvió' as unknown, (e) => e);

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    // La espera de backoff está armada y escuchando la señal.
    expect(vi.getTimerCount()).toBe(1);
    expect(t.balance()).toBe(1);

    t.controller.abort();
    const err = await settled;

    expect(err).toBeInstanceOf(RetryCancelledError);
    expect(calls).toBe(1);
    // El timer residual fue LIMPIADO, no simplemente ignorado: no queda nada
    // agendado capaz de despertar un intento ya cancelado.
    expect(vi.getTimerCount()).toBe(0);
    expect(t.balance()).toBe(0);

    // Y correr el tiempo que le quedaba a la espera no despacha nada.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
  });

  it('T-G.1c — cancelación observable justo al vencer la espera: se re-chequea ANTES de despachar', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const t = trackedController();
    let calls = 0;
    const settled = retryWithBackoff(
      async () => {
        calls++;
        throw new Error('transient');
      },
      { attempts: 2, baseDelayMs: 100, signal: t.signal },
    ).then(() => 'resolvió' as unknown, (e) => e);

    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);

    // Este timer se registra DESPUÉS del de la espera y con el MISMO
    // vencimiento (jitter fijado en 0 ⇒ delay exacto = 100). El tick SÍNCRONO
    // corre ambos callbacks sin drenar microtareas en medio: la espera vence
    // NORMALMENTE (resolve, listener ya retirado) y sólo entonces la
    // cancelación se vuelve observable. Sin un re-chequeo posterior a la
    // espera, el intento 1 saldría igual.
    setTimeout(() => t.controller.abort(), 100);
    vi.advanceTimersByTime(100);

    const err = await settled;
    expect(err).toBeInstanceOf(RetryCancelledError);
    expect(calls).toBe(1);
    expect(t.balance()).toBe(0);
  });

  it('T-G.1d — limpieza de timer y listener en éxito, falla del proveedor, espera vencida y cancelación', async () => {
    // (1) Éxito al primer intento: nunca se arma espera.
    const okCtl = trackedController();
    await expect(
      retryWithBackoff(async () => 'ok', { attempts: 3, baseDelayMs: 1000, signal: okCtl.signal }),
    ).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
    expect(okCtl.balance()).toBe(0);

    // (2) Falla del proveedor sin reintento (`shouldRetry` false): tampoco.
    const failCtl = trackedController();
    const failed = await retryWithBackoff(
      async () => {
        throw new Error('permanent');
      },
      { attempts: 3, baseDelayMs: 1000, shouldRetry: () => false, signal: failCtl.signal },
    ).then(() => 'resolvió' as unknown, (e) => e);
    expect(failed).toBeInstanceOf(Error);
    expect(failed).not.toBeInstanceOf(RetryCancelledError);
    expect(vi.getTimerCount()).toBe(0);
    expect(failCtl.balance()).toBe(0);

    // (3) Espera vencida normalmente: el listener se retira al resolver.
    const waitCtl = trackedController();
    let calls = 0;
    const p = retryWithBackoff(
      async () => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return 'ok-2';
      },
      { attempts: 2, baseDelayMs: 500, signal: waitCtl.signal },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(waitCtl.balance()).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe('ok-2');
    expect(calls).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(waitCtl.balance()).toBe(0);

    // (4) Cancelación: timer limpiado y listener retirado.
    const cancelCtl = trackedController();
    const cancelled = retryWithBackoff(
      async () => {
        throw new Error('transient');
      },
      { attempts: 3, baseDelayMs: 1000, signal: cancelCtl.signal },
    ).then(() => 'resolvió' as unknown, (e) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(cancelCtl.balance()).toBe(1);
    cancelCtl.controller.abort();
    expect(await cancelled).toBeInstanceOf(RetryCancelledError);
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelCtl.balance()).toBe(0);
  });

  it('T-G.1e — la cancelación NO se representa con shouldRetry ni por mensaje: es una clase dedicada y exportada', async () => {
    const t = trackedController();
    t.controller.abort();
    const shouldRetry = vi.fn(() => true);
    const err = await retryWithBackoff(async () => 'x', {
      attempts: 2,
      baseDelayMs: 10,
      shouldRetry,
      signal: t.signal,
    }).then(() => 'resolvió' as unknown, (e) => e);

    expect(err).toBeInstanceOf(RetryCancelledError);
    expect((err as Error).name).toBe('RetryCancelledError');
    // `shouldRetry` jamás se consulta para decidir una cancelación.
    expect(shouldRetry).not.toHaveBeenCalled();
    // Y un error de proveedor cuyo MENSAJE habla de cancelación NO es una
    // cancelación: la clasificación es por identidad de clase.
    const impostor = await retryWithBackoff(
      async () => {
        throw new Error('Reintento cancelado');
      },
      { attempts: 1, baseDelayMs: 10 },
    ).then(() => 'resolvió' as unknown, (e) => e);
    expect(impostor).toBeInstanceOf(Error);
    expect(impostor).not.toBeInstanceOf(RetryCancelledError);
  });
});

describe('T-G.2 — control de compatibilidad: sin entrada de cancelación nada cambia', () => {
  it('T-G.2a — la misma falla reintentable despacha exactamente dos veces y completa normalmente', async () => {
    let calls = 0;
    const p = retryWithBackoff(
      async () => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return 'ok';
      },
      { attempts: 2, baseDelayMs: 2000 },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toBe('ok');
    expect(calls).toBe(2);
  });

  it('T-G.2b — shouldRetry=false sigue despachando una sola vez y propaga el error del proveedor', async () => {
    let calls = 0;
    const err = await retryWithBackoff(
      async () => {
        calls++;
        throw new Error('permanent');
      },
      { attempts: 3, baseDelayMs: 1, shouldRetry: () => false },
    ).then(() => 'resolvió' as unknown, (e) => e);

    expect(calls).toBe(1);
    expect((err as Error).message).toBe('permanent');
    expect(err).not.toBeInstanceOf(RetryCancelledError);
  });

  it('T-G.2c — intentos, delay exponencial y jitter quedan idénticos (base 2000 × 4^intento + jitter <1000)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    let calls = 0;
    const p = retryWithBackoff(
      async () => {
        calls++;
        throw new Error(`fail-${calls}`);
      },
      { attempts: 3, baseDelayMs: 2000 },
    ).then(() => 'resolvió' as unknown, (e) => e);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100_000);
    const err = await p;

    expect(calls).toBe(3);
    expect((err as Error).message).toBe('fail-3');
    const delays = timeoutSpy.mock.calls.map((c) => c[1]);
    // 2000 × 4^0 + 500 y 2000 × 4^1 + 500.
    expect(delays).toEqual([2500, 8500]);
    expect(randomSpy).toHaveBeenCalledTimes(2);
  });

  it('T-G.2d — un caller sin entrada de cancelación nunca ve un RetryCancelledError', async () => {
    const err = await retryWithBackoff(
      async () => {
        throw new Error('boom');
      },
      { attempts: 1, baseDelayMs: 1 },
    ).then(() => 'resolvió' as unknown, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(RetryCancelledError);
  });
});
