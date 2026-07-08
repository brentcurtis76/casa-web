import { describe, it, expect } from 'vitest';
import { runWithConcurrency, retryWithBackoff } from '../concurrency';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runWithConcurrency', () => {
  it('nunca ejecuta más tareas simultáneas que el límite', async () => {
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active--;
      return true;
    });

    await runWithConcurrency(tasks, 3);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('preserva el orden de resultados y captura rechazos sin abortar el resto', async () => {
    const tasks = [
      async () => 'a',
      async () => {
        throw new Error('boom');
      },
      async () => 'c',
    ];

    const results = await runWithConcurrency(tasks, 2);

    expect(results[0]).toEqual({ status: 'fulfilled', value: 'a' });
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'c' });
  });

  it('funciona con lista vacía y con límite mayor que las tareas', async () => {
    expect(await runWithConcurrency([], 4)).toEqual([]);
    const results = await runWithConcurrency([async () => 1], 8);
    expect(results).toEqual([{ status: 'fulfilled', value: 1 }]);
  });
});

describe('retryWithBackoff', () => {
  it('reintenta una vez y devuelve el resultado del segundo intento', async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      async () => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return 'ok';
      },
      { attempts: 2, baseDelayMs: 1 }
    );

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('lanza el último error al agotar los intentos', async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error(`fail-${calls}`);
        },
        { attempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toThrow('fail-3');
    expect(calls).toBe(3);
  });

  it('no reintenta cuando shouldRetry devuelve false', async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error('permanent');
        },
        { attempts: 3, baseDelayMs: 1, shouldRetry: () => false }
      )
    ).rejects.toThrow('permanent');
    expect(calls).toBe(1);
  });
});
