/**
 * Pipeline de generación de imágenes del Cuentacuentos.
 *
 * Este hook es una capa fina sobre `createStoryImagePipelineRunner` (módulo
 * puro, sin React). El runner es UN ÚNICO camino provider→apply→persist que
 * sirve tanto para un solo ítem como para lotes. Este hook:
 *   - se suscribe al runner via `useSyncExternalStore` para re-renderizar
 *     cuando cambian los ítems;
 *   - preserva el API legado (`runAll`, `retryFailed`, `markResolved`,
 *     `statusOf`) para no tocar `CuentacuentoEditor` en este subtask;
 *   - expone el API nuevo (`runItems`, `retryItem`, `getRunToken`) para que
 *     A2/subtasks siguientes lo consuman.
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  createStoryImagePipelineRunner,
  type LegacyPipelineTask,
  type PipelineItemKind,
  type PipelineItemStatus,
  type PipelineItemTask,
  type PipelineItemView,
  type RunIdentity,
  type RunToken,
  type StoryImagePipelineRunner,
} from './storyImagePipelineRunner';
export type { SaveRetryRegistry } from './saveRetryRegistry';

export type { PipelineItemKind, PipelineItemStatus } from './storyImagePipelineRunner';
// Sentinels de retorno explícito de `apply` (F3). Re-exportados para que los
// callers en React puedan importar todo desde el hook.
export {
  APPLY_STALE,
  APPLY_EPHEMERAL,
  type ApplyOutcome,
  type ApplyStale,
  type ApplyEphemeral,
} from './storyImagePipelineRunner';

/** Item legado expuesto al UI (mismo shape que la vista del runner). */
export type PipelineItem = PipelineItemView;

/** Task legado: mantiene el shape original con `.run()`. */
export type PipelineTask = LegacyPipelineTask;

export interface UseStoryImagePipelineReturn {
  /** Items de la corrida actual (o la última), en orden de encolado. */
  items: PipelineItem[];
  isRunning: boolean;
  /**
   * Señal reactiva de guardado: `true` mientras hay al menos una operación
   * `persist` en vuelo — inicial o retry. Cubre ambas para que el UI muestre
   * un indicador de "guardando…" consistente.
   */
  isSaving: boolean;
  /** Lectura síncrona del estado de ejecución (isRunning puede ir un render atrás). */
  isBusy: () => boolean;
  /** Conteos derivados de la corrida actual. */
  doneCount: number;
  errorCount: number;
  /** Conteo derivado del registry — persistencias fallidas pendientes de retry. */
  saveFailedCount: number;
  totalCount: number;
  /**
   * API legado: ejecuta las tareas con pool de 3 (se reduce a 1 si aparece un
   * 429). Devuelve `false` sin hacer nada si ya hay una corrida activa.
   */
  runAll: (tasks: PipelineTask[]) => Promise<boolean>;
  /**
   * API nuevo (A2): corre uno o varios ítems con el contrato provider/apply/
   * persist del runner. Acepta también tareas legadas (con `.run()`).
   */
  runItems: (
    tasks: Array<PipelineItemTask | LegacyPipelineTask>,
    identity: RunIdentity
  ) => Promise<RunToken>;
  /** Reintenta ítems `error` y `save-failed`. Los `save-failed` no llaman al provider. */
  retryFailed: (identity?: RunIdentity) => Promise<void>;
  /**
   * Reintenta ÚNICAMENTE persistencias fallidas del registry para la
   * identidad viva. Nunca invoca provider/generación. Cada entrada revalida
   * su identidad frente al registry antes de escribir; entradas stale no
   * producen ninguna escritura.
   */
  retrySaves: (identity: RunIdentity) => Promise<void>;
  /** Reintento por ítem específico (A2). */
  retryItem: (itemId: string, identity: RunIdentity) => Promise<void>;
  /**
   * Invalida el registry de save-retries por scope. La ha de llamar el hook
   * del draft en cambios de lifecycle (bump epoch, cambio de story activa).
   */
  invalidateSaveRetries: (
    scope: { storyId: string | null; epoch: number } | { storyId: string | null },
  ) => number;
  /** Deja de sacar tareas de la cola; invalida token antes de abortar. */
  cancel: () => void;
  /** Estado de un item por id (undefined si no está en la corrida). */
  statusOf: (id: string) => PipelineItemStatus | undefined;
  /** Mensaje de error live del item (undefined si no aplica). */
  errorOf: (id: string) => string | undefined;
  /**
   * Marca un item como resuelto desde fuera del pipeline (p.ej. el usuario
   * regeneró manualmente una escena que había fallado): limpia el badge de
   * error y lo excluye de retryFailed.
   */
  markResolved: (id: string) => void;
  /** Token opaco de la corrida activa (o null). Diagnóstico/tests. */
  getRunToken: () => RunToken | null;
}

// Identidad "neutra" usada por los caminos legados (sin epoch/storyId externos).
const LEGACY_IDENTITY: RunIdentity = { storyId: null, epoch: 0 };

export function useStoryImagePipeline(): UseStoryImagePipelineReturn {
  // El runner vive durante toda la vida del hook. No se re-crea en re-renders.
  const runnerRef = useRef<StoryImagePipelineRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createStoryImagePipelineRunner();
  }
  const runner = runnerRef.current;

  // Snapshot combinado (items + isRunning + isSaving + saveFailedCount) para
  // que `useSyncExternalStore` dispare re-render por cambios de items, de
  // estado de ejecución, de guardado en vuelo, o del registry. Devolvemos
  // misma referencia cuando nada cambió.
  interface Snapshot {
    items: PipelineItem[];
    isRunning: boolean;
    isSaving: boolean;
    saveFailedCount: number;
  }
  const snapshotRef = useRef<Snapshot>({
    items: [],
    isRunning: false,
    isSaving: false,
    saveFailedCount: 0,
  });
  const subscribe = useCallback(
    (listener: () => void) => runner.subscribe(listener),
    [runner]
  );
  const getSnapshot = useCallback((): Snapshot => {
    const nextItems = runner.getItems();
    const nextIsRunning = runner.isBusy();
    const nextIsSaving = runner.isSaving();
    const nextSaveFailedCount = runner.saveFailedCount();
    const prev = snapshotRef.current;
    const itemsEqual =
      prev.items.length === nextItems.length &&
      prev.items.every((p, i) => {
        const n = nextItems[i];
        return (
          p.id === n.id &&
          p.status === n.status &&
          p.error === n.error &&
          p.kind === n.kind &&
          p.label === n.label
        );
      });
    if (
      itemsEqual &&
      prev.isRunning === nextIsRunning &&
      prev.isSaving === nextIsSaving &&
      prev.saveFailedCount === nextSaveFailedCount
    ) {
      return prev;
    }
    const copy: Snapshot = {
      items: itemsEqual ? prev.items : nextItems.map((v) => ({ ...v })),
      isRunning: nextIsRunning,
      isSaving: nextIsSaving,
      saveFailedCount: nextSaveFailedCount,
    };
    snapshotRef.current = copy;
    return copy;
  }, [runner]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { items, isRunning, isSaving, saveFailedCount } = snapshot;

  const runAll = useCallback(
    async (tasks: PipelineTask[]): Promise<boolean> => {
      if (tasks.length === 0 || runner.isBusy()) return false;
      await runner.runItems({ tasks, identity: LEGACY_IDENTITY });
      return true;
    },
    [runner]
  );

  const runItems = useCallback(
    (
      tasks: Array<PipelineItemTask | LegacyPipelineTask>,
      identity: RunIdentity
    ): Promise<RunToken> => runner.runItems({ tasks, identity }),
    [runner]
  );

  const retryFailed = useCallback(
    async (identity: RunIdentity = LEGACY_IDENTITY): Promise<void> => {
      if (runner.isBusy()) return;
      await runner.retryFailed(identity);
    },
    [runner]
  );

  const retryItem = useCallback(
    (itemId: string, identity: RunIdentity) => runner.retryItem({ itemId, identity }),
    [runner]
  );

  const retrySaves = useCallback(
    (identity: RunIdentity) => runner.retrySaves(identity),
    [runner]
  );

  const invalidateSaveRetries = useCallback(
    (
      scope:
        | { storyId: string | null; epoch: number }
        | { storyId: string | null },
    ) => runner.invalidateSaveRetries(scope),
    [runner]
  );

  const cancel = useCallback(() => runner.cancel(), [runner]);
  const isBusy = useCallback(() => runner.isBusy(), [runner]);
  const statusOf = useCallback((id: string) => runner.statusOf(id), [runner]);
  const errorOf = useCallback(
    (id: string) => runner.getItems().find((v) => v.id === id)?.error,
    [runner]
  );
  const markResolved = useCallback((id: string) => runner.markResolved(id), [runner]);
  const getRunToken = useCallback(() => runner.getRunToken(), [runner]);

  const counts = useMemo(() => {
    let done = 0;
    let error = 0;
    for (const i of items) {
      if (i.status === 'done') done++;
      else if (i.status === 'error' || i.status === 'save-failed') error++;
    }
    return { done, error };
  }, [items]);

  return {
    items,
    isRunning,
    isSaving,
    isBusy,
    doneCount: counts.done,
    errorCount: counts.error,
    saveFailedCount,
    totalCount: items.length,
    runAll,
    runItems,
    retryFailed,
    retrySaves,
    retryItem,
    cancel,
    statusOf,
    errorOf,
    markResolved,
    getRunToken,
    invalidateSaveRetries,
  };
}
