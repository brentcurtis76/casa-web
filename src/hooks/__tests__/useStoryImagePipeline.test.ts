import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStoryImagePipeline, type PipelineTask } from '../useStoryImagePipeline';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const makeTask = (
  id: string,
  run: () => Promise<void>
): PipelineTask => ({ id, kind: 'scene', label: id, run });

describe('useStoryImagePipeline', () => {
  it('ejecuta todas las tareas y marca done/error por item', async () => {
    const { result } = renderHook(() => useStoryImagePipeline());

    await act(async () => {
      await result.current.runAll([
        makeTask('a', async () => {}),
        makeTask('b', async () => {
          throw new Error('boom');
        }),
        makeTask('c', async () => {}),
      ]);
    });

    await waitFor(() => expect(result.current.isRunning).toBe(false));
    expect(result.current.doneCount).toBe(2);
    expect(result.current.errorCount).toBe(1);
    expect(result.current.statusOf('b')).toBe('error');
    expect(result.current.items.find((i) => i.id === 'b')?.error).toContain('boom');
  });

  it('cancel() deja de sacar tareas de la cola', async () => {
    const { result } = renderHook(() => useStoryImagePipeline());
    const executed: string[] = [];

    // 6 tareas lentas con pool de 3: cancelamos apenas arranca la primera ola.
    const tasks = Array.from({ length: 6 }, (_, i) =>
      makeTask(`t${i}`, async () => {
        executed.push(`t${i}`);
        await sleep(30);
      })
    );

    await act(async () => {
      const running = result.current.runAll(tasks);
      await sleep(5);
      result.current.cancel();
      await running;
    });

    expect(executed.length).toBeLessThan(6);
    expect(result.current.isRunning).toBe(false);
  });

  it('retryFailed() reintenta solo las fallidas y preserva los items completados', async () => {
    const { result } = renderHook(() => useStoryImagePipeline());

    // runAll ejecuta cada tarea con retryWithBackoff(attempts: 2), así que
    // 'flaky' debe fallar sus DOS primeras invocaciones para quedar en error.
    let flakyCalls = 0;
    await act(async () => {
      await result.current.runAll([
        makeTask('ok', async () => {}),
        makeTask('flaky', async () => {
          flakyCalls++;
          if (flakyCalls <= 2) throw new Error('fallo transitorio');
        }),
      ]);
    });

    expect(result.current.statusOf('ok')).toBe('done');
    expect(result.current.statusOf('flaky')).toBe('error');
    expect(result.current.errorCount).toBe(1);

    await act(async () => {
      await result.current.retryFailed();
    });

    // La tercera invocación resuelve; el item 'ok' sigue visible como done.
    expect(result.current.statusOf('flaky')).toBe('done');
    expect(result.current.statusOf('ok')).toBe('done');
    expect(result.current.items).toHaveLength(2);
    expect(result.current.errorCount).toBe(0);
    expect(flakyCalls).toBe(3);
  });

  it('markResolved() limpia un item fallido (arreglo manual fuera del pipeline)', async () => {
    const { result } = renderHook(() => useStoryImagePipeline());

    await act(async () => {
      await result.current.runAll([
        makeTask('malo', async () => {
          throw new Error('siempre falla');
        }),
      ]);
    });
    expect(result.current.statusOf('malo')).toBe('error');

    act(() => {
      result.current.markResolved('malo');
    });

    expect(result.current.statusOf('malo')).toBe('done');
    expect(result.current.errorCount).toBe(0);
  });
});
