/**
 * Pipeline de generación de imágenes del Cuentacuentos: ejecuta tareas
 * (hojas de personaje, escenas, portada/fin) en paralelo con límite de
 * concurrencia, reintento con backoff, cancelación y reintento de fallidas.
 *
 * El hook es genérico: cada tarea es un closure `run` que hace la generación,
 * actualiza estado y persiste. El pipeline solo orquesta y expone progreso.
 */

import { useState, useCallback, useRef } from 'react';
import { retryWithBackoff } from '@/lib/cuentacuentos/concurrency';

export type PipelineItemKind = 'sheet' | 'scene' | 'cover' | 'end' | 'prop';

export type PipelineItemStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineItem {
  id: string;
  kind: PipelineItemKind;
  label: string;
  status: PipelineItemStatus;
  error?: string;
}

export interface PipelineTask {
  id: string;
  kind: PipelineItemKind;
  label: string;
  run: () => Promise<void>;
}

export interface UseStoryImagePipelineReturn {
  /** Items de la corrida actual (o la última), en orden de encolado. */
  items: PipelineItem[];
  isRunning: boolean;
  /** Lectura síncrona del estado de ejecución (isRunning puede ir un render atrás). */
  isBusy: () => boolean;
  /** Conteos derivados de la corrida actual. */
  doneCount: number;
  errorCount: number;
  totalCount: number;
  /**
   * Ejecuta las tareas con pool de 3 (se reduce a 1 si aparece un 429).
   * Devuelve false sin hacer nada si ya hay una corrida activa.
   */
  runAll: (tasks: PipelineTask[]) => Promise<boolean>;
  /** Reintenta solo las tareas que fallaron, preservando los items completados. */
  retryFailed: () => Promise<void>;
  /** Deja de sacar tareas de la cola; las que están en vuelo terminan. */
  cancel: () => void;
  /** Estado de un item por id (undefined si no está en la corrida). */
  statusOf: (id: string) => PipelineItemStatus | undefined;
  /**
   * Marca un item como resuelto desde fuera del pipeline (p.ej. el usuario
   * regeneró manualmente una escena que había fallado): limpia el badge de
   * error y lo excluye de retryFailed.
   */
  markResolved: (id: string) => void;
}

const BASE_CONCURRENCY = 3;
const STAGGER_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('429') || /too many|rate.?limit/i.test(message);
}

export function useStoryImagePipeline(): UseStoryImagePipelineReturn {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const cancelRef = useRef(false);
  const concurrencyRef = useRef(BASE_CONCURRENCY);
  const tasksRef = useRef<Map<string, PipelineTask>>(new Map());
  const itemsRef = useRef<PipelineItem[]>([]);
  const runningRef = useRef(false);

  const setItemStatus = useCallback((id: string, status: PipelineItemStatus, error?: string) => {
    itemsRef.current = itemsRef.current.map((item) =>
      item.id === id ? { ...item, status, error } : item
    );
    setItems(itemsRef.current);
  }, []);

  // Corre las tareas dadas asumiendo que itemsRef ya contiene sus entradas
  // (en 'pending'). runAll y retryFailed preparan itemsRef de forma distinta.
  const executeTasks = useCallback(async (tasks: PipelineTask[]) => {
    runningRef.current = true;
    cancelRef.current = false;
    concurrencyRef.current = BASE_CONCURRENCY;
    setIsRunning(true);

    let next = 0;

    const worker = async (workerIndex: number) => {
      if (workerIndex > 0) await sleep(workerIndex * STAGGER_MS);

      while (!cancelRef.current) {
        // Si un 429 redujo la concurrencia, los workers sobrantes se retiran.
        if (workerIndex >= concurrencyRef.current) return;

        const index = next++;
        if (index >= tasks.length) return;

        const task = tasks[index];
        setItemStatus(task.id, 'running');

        try {
          await retryWithBackoff(task.run, {
            attempts: 2,
            baseDelayMs: 2000,
            shouldRetry: (err) => {
              if (isRateLimitError(err)) {
                concurrencyRef.current = 1;
              }
              return !cancelRef.current;
            },
          });
          setItemStatus(task.id, 'done');
        } catch (err) {
          setItemStatus(
            task.id,
            'error',
            err instanceof Error ? err.message : 'Error generando imagen'
          );
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(BASE_CONCURRENCY, tasks.length) }, (_, w) => worker(w))
      );
    } finally {
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [setItemStatus]);

  const runAll = useCallback(async (tasks: PipelineTask[]): Promise<boolean> => {
    if (tasks.length === 0 || runningRef.current) return false;

    tasksRef.current = new Map(tasks.map((t) => [t.id, t]));
    itemsRef.current = tasks.map((t) => ({
      id: t.id,
      kind: t.kind,
      label: t.label,
      status: 'pending' as PipelineItemStatus,
    }));
    setItems(itemsRef.current);

    await executeTasks(tasks);
    return true;
  }, [executeTasks]);

  const retryFailed = useCallback(async () => {
    if (runningRef.current) return;

    const failedIds = new Set(
      itemsRef.current.filter((i) => i.status === 'error').map((i) => i.id)
    );
    const failedTasks = [...failedIds]
      .map((id) => tasksRef.current.get(id))
      .filter((t): t is PipelineTask => !!t);
    if (failedTasks.length === 0) return;

    // Preservar los items completados: solo los fallidos vuelven a 'pending'.
    itemsRef.current = itemsRef.current.map((i) =>
      failedIds.has(i.id) ? { ...i, status: 'pending' as PipelineItemStatus, error: undefined } : i
    );
    setItems(itemsRef.current);

    await executeTasks(failedTasks);
  }, [executeTasks]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const isBusy = useCallback(() => runningRef.current, []);

  const statusOf = useCallback((id: string): PipelineItemStatus | undefined => {
    return itemsRef.current.find((i) => i.id === id)?.status;
  }, []);

  const markResolved = useCallback((id: string) => {
    if (itemsRef.current.some((i) => i.id === id && i.status !== 'done')) {
      setItemStatus(id, 'done');
    }
  }, [setItemStatus]);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  return {
    items,
    isRunning,
    isBusy,
    doneCount,
    errorCount,
    totalCount: items.length,
    runAll,
    retryFailed,
    cancel,
    statusOf,
    markResolved,
  };
}
