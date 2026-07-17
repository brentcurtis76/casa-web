/**
 * Pipeline runner del Cuentacuentos (A2). Módulo puro, sin dependencias de React.
 *
 * Un único runner ejecuta ítems de tres fases:
 *   provider → apply → persist
 * Se usa igual para un solo ítem que para lotes. Diseño clave:
 *
 * - Cada llamada a `runItems` crea un `RunToken` opaco. Un `runItems` nuevo o
 *   un `cancel()` invalidan el token previo *antes* de disparar el `abort()`,
 *   de modo que una resolución tardía del proveedor no pueda llegar a `apply`
 *   ni a `persist`.
 * - `apply` corre bajo un chequeo síncrono de identidad {runToken, storyId,
 *   epoch}. Si todo coincide, se crea un `generatedRevision` monótono por ítem,
 *   se retiene un snapshot inmutable interno para reintentos de persistencia,
 *   y se devuelve al ítem un snapshot desprendido (deep-frozen) que el llamador
 *   no puede mutar.
 * - `persist` recibe SOLO snapshot + identidad {storyId, epoch, itemId,
 *   generatedRevision}. NO inspecciona el token vigente: una vez que se aplicó,
 *   la persistencia debe completar aunque el token cambie después.
 * - Estados por ítem: `pending` → `running` → `persisting` → `done`, con
 *   `error` (falla de `provider`) y `save-failed` (falla de `persist`).
 * - Reintento tras `error` puede regenerar (provider→apply→persist).
 *   Reintento tras `save-failed` sólo re-invoca `persist` con el snapshot y la
 *   identidad retenidos; nunca vuelve a generar.
 * - El runner acepta también tareas "legacy" con una única función `run()`
 *   (sin apply/persist). Para ellas el flujo es pending → running → done/error,
 *   preservando el comportamiento previo del hook `useStoryImagePipeline`.
 */

import { retryWithBackoff } from '@/lib/cuentacuentos/concurrency';

export type PipelineItemKind = 'sheet' | 'scene' | 'cover' | 'end' | 'prop';

export type PipelineItemStatus =
  | 'pending'
  | 'running'
  | 'persisting'
  | 'done'
  | 'error'
  | 'save-failed';

/** Token opaco de corrida. Sólo el runner lo crea; los callers lo pasan como valor. */
declare const runTokenBrand: unique symbol;
export type RunToken = { readonly [runTokenBrand]: true };

/**
 * Identidad lógica capturada al aplicar. Se pasa a `apply` y `persist`.
 * `generatedRevision` es monótono creciente por `itemId` (independiente del token).
 */
export interface AppliedIdentity {
  storyId: string | null;
  epoch: number;
  itemId: string;
  generatedRevision: number;
}

/** Contexto de identidad que el runner captura AL INICIAR una corrida. */
export interface RunIdentity {
  storyId: string | null;
  epoch: number;
}

export interface ProviderContext {
  signal: AbortSignal;
  itemId: string;
}

/**
 * Tarea de 3 fases. `apply` corre síncrono bajo guardia de identidad y devuelve
 * el snapshot que se retendrá como fuente de verdad para reintentos de save-only.
 * Devolver `null` desde `apply` es equivalente a "descartar" (ítem queda en
 * estado terminal `done` sin persistir).
 */
export interface PipelineItemTask<TResult = unknown, TSnapshot = unknown> {
  id: string;
  kind: PipelineItemKind;
  label: string;
  provider: (ctx: ProviderContext) => Promise<TResult>;
  apply: (result: TResult, identity: AppliedIdentity) => TSnapshot | null;
  persist: (snapshot: Readonly<TSnapshot>, identity: AppliedIdentity) => Promise<void>;
}

/** Tarea "legacy": una única función `run()` que hace todo internamente. */
export interface LegacyPipelineTask {
  id: string;
  kind: PipelineItemKind;
  label: string;
  run: () => Promise<void>;
}

export interface PipelineItemView {
  id: string;
  kind: PipelineItemKind;
  label: string;
  status: PipelineItemStatus;
  error?: string;
}

/** Estado interno por ítem (no expuesto). */
interface InternalItemState {
  id: string;
  kind: PipelineItemKind;
  label: string;
  status: PipelineItemStatus;
  error?: string;
  /** Fase para reintento: si es 'error' → regenerar; si es 'save-failed' → solo persistir. */
  task?: PipelineItemTask | LegacyPipelineTask;
  /** Revisión monótona por ítem: sube en cada apply exitoso. */
  generatedRevision: number;
  /** Snapshot inmutable retenido para reintento de save-only. */
  retainedSnapshot?: unknown;
  /** Identidad capturada al aplicar. Se re-usa tal cual en el reintento de persist. */
  retainedIdentity?: AppliedIdentity;
}

export interface RunnerOptions {
  concurrency?: number;
  staggerMs?: number;
  /** Reintento con backoff a nivel de provider (idéntico al comportamiento previo). */
  providerAttempts?: number;
  providerBaseDelayMs?: number;
}

export interface RunItemsInput {
  tasks: Array<PipelineItemTask | LegacyPipelineTask>;
  identity: RunIdentity;
}

export interface RetryItemInput {
  itemId: string;
  identity: RunIdentity;
}

export interface StoryImagePipelineRunner {
  /** Corre un conjunto de ítems (uno o muchos). Devuelve el token de la corrida. */
  runItems: (input: RunItemsInput) => Promise<RunToken>;
  /** Reintenta un ítem según su estado terminal. */
  retryItem: (input: RetryItemInput) => Promise<void>;
  /** Reintenta todos los ítems `error` y `save-failed` visibles. */
  retryFailed: (identity: RunIdentity) => Promise<void>;
  /** Invalida el token vigente antes de abortar; corridas en vuelo no aplican ni persisten. */
  cancel: () => void;
  /** Lectura síncrona: ¿hay corrida activa? */
  isBusy: () => boolean;
  /** Vista inmutable de ítems (para render). */
  getItems: () => ReadonlyArray<PipelineItemView>;
  /** Estado terminal/actual de un ítem. */
  statusOf: (id: string) => PipelineItemStatus | undefined;
  /** Suscripción a cambios de `items`. Devuelve un unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Marca un ítem como resuelto (compat: p.ej. el usuario lo regeneró manualmente). */
  markResolved: (id: string) => void;
  /** Token actualmente vigente (o null si no hay corrida activa). Diagnóstico/tests. */
  getRunToken: () => RunToken | null;
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_STAGGER_MS = 400;
const DEFAULT_PROVIDER_ATTEMPTS = 2;
const DEFAULT_PROVIDER_BASE_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('429') || /too many|rate.?limit/i.test(message);
}

function isLegacyTask(t: PipelineItemTask | LegacyPipelineTask): t is LegacyPipelineTask {
  return typeof (t as LegacyPipelineTask).run === 'function';
}

/**
 * Deep-freeze estructural. Devuelve la misma referencia congelada. Se aplica al
 * snapshot que el runner retiene y también al snapshot desprendido que se
 * comparte con `persist` (los callers no deben mutar el snapshot).
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value as Readonly<T>;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return value as Readonly<T>;
}

/**
 * Copia estructural profunda. Se usa para producir el snapshot "desprendido"
 * que el runner retiene aparte del que devuelve `apply` — así los callers no
 * pueden mutar el estado interno del runner y viceversa.
 */
export function detachSnapshot<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => detachSnapshot(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = detachSnapshot(v);
  }
  return out as T;
}

export function createStoryImagePipelineRunner(
  options: RunnerOptions = {}
): StoryImagePipelineRunner {
  const {
    concurrency: baseConcurrency = DEFAULT_CONCURRENCY,
    staggerMs = DEFAULT_STAGGER_MS,
    providerAttempts = DEFAULT_PROVIDER_ATTEMPTS,
    providerBaseDelayMs = DEFAULT_PROVIDER_BASE_DELAY_MS,
  } = options;

  // Estado global del runner. Único source of truth.
  const items = new Map<string, InternalItemState>();
  const insertionOrder: string[] = [];
  const listeners = new Set<() => void>();

  let currentRunToken: RunToken | null = null;
  let currentAbortController: AbortController | null = null;
  let running = false;
  let concurrencyOverride = baseConcurrency;

  const notify = () => {
    for (const l of listeners) l();
  };

  const upsertItem = (partial: {
    id: string;
    kind: PipelineItemKind;
    label: string;
    status?: PipelineItemStatus;
  }) => {
    const existing = items.get(partial.id);
    if (existing) {
      existing.kind = partial.kind;
      existing.label = partial.label;
      if (partial.status !== undefined) {
        existing.status = partial.status;
        existing.error = undefined;
      }
    } else {
      items.set(partial.id, {
        id: partial.id,
        kind: partial.kind,
        label: partial.label,
        status: partial.status ?? 'pending',
        generatedRevision: 0,
      });
      insertionOrder.push(partial.id);
    }
  };

  const setStatus = (id: string, status: PipelineItemStatus, error?: string) => {
    const s = items.get(id);
    if (!s) return;
    s.status = status;
    s.error = error;
    notify();
  };

  const mintRunToken = (): RunToken => ({}) as RunToken;

  /**
   * Ejecuta la fase provider→apply→persist para un ítem, bajo un `runToken` y
   * una `identity` externa capturada al iniciar la corrida. Devuelve cuando el
   * ítem alcanza un estado terminal (`done`, `error`, `save-failed`).
   */
  const executePhase = async (
    itemState: InternalItemState,
    runToken: RunToken,
    identity: RunIdentity,
    signal: AbortSignal,
    getActiveRunToken: () => RunToken | null
  ): Promise<void> => {
    const task = itemState.task;
    if (!task) return;

    setStatus(itemState.id, 'running');

    // --- Fase provider ---
    let providerResult: unknown;
    try {
      providerResult = await retryWithBackoff(
        () => {
          if (isLegacyTask(task)) return task.run() as Promise<unknown>;
          return task.provider({ signal, itemId: itemState.id });
        },
        {
          attempts: providerAttempts,
          baseDelayMs: providerBaseDelayMs,
          shouldRetry: (err) => {
            if (isRateLimitError(err)) concurrencyOverride = 1;
            return !signal.aborted;
          },
        }
      );
    } catch (err) {
      // Provider falla → 'error'. No hay snapshot retenido.
      setStatus(
        itemState.id,
        'error',
        err instanceof Error ? err.message : 'Error generando imagen'
      );
      return;
    }

    // --- Guardia de identidad ANTES de apply ---
    // Una resolución tardía tras cancel/runItems nuevo no puede llegar a apply.
    if (getActiveRunToken() !== runToken) return;
    if (isLegacyTask(task)) {
      // Ruta legacy: no hay apply/persist; el provider ya hizo todo internamente.
      setStatus(itemState.id, 'done');
      return;
    }

    // Nueva ruta: apply es síncrono, y su chequeo de identidad se completa antes
    // de mutar `generatedRevision` para que un token invalidado por otra corrida
    // en curso no afecte snapshots ni contadores.
    const nextRevision = itemState.generatedRevision + 1;
    const appliedIdentity: AppliedIdentity = {
      storyId: identity.storyId,
      epoch: identity.epoch,
      itemId: itemState.id,
      generatedRevision: nextRevision,
    };

    let snapshot: unknown;
    try {
      snapshot = task.apply(providerResult, appliedIdentity);
    } catch (err) {
      setStatus(
        itemState.id,
        'error',
        err instanceof Error ? err.message : 'Error aplicando resultado'
      );
      return;
    }

    if (snapshot === null || snapshot === undefined) {
      // apply desestimó (identidad interna cambió); no persistimos.
      setStatus(itemState.id, 'done');
      return;
    }

    // Retener snapshot inmutable interno y desprender uno para persist.
    const retained = deepFreeze(detachSnapshot(snapshot));
    itemState.retainedSnapshot = retained;
    itemState.retainedIdentity = appliedIdentity;
    itemState.generatedRevision = nextRevision;

    // --- Fase persist ---
    setStatus(itemState.id, 'persisting');
    try {
      const detached = deepFreeze(detachSnapshot(retained)) as Readonly<unknown>;
      await task.persist(detached, appliedIdentity);
      setStatus(itemState.id, 'done');
    } catch (err) {
      setStatus(
        itemState.id,
        'save-failed',
        err instanceof Error ? err.message : 'Error guardando imagen'
      );
    }
  };

  /** Sólo re-ejecuta persist con el snapshot/identidad retenidos. */
  const executePersistOnly = async (itemState: InternalItemState): Promise<void> => {
    const task = itemState.task;
    if (!task || isLegacyTask(task)) return;
    if (!itemState.retainedSnapshot || !itemState.retainedIdentity) return;

    setStatus(itemState.id, 'persisting');
    try {
      const detached = deepFreeze(
        detachSnapshot(itemState.retainedSnapshot)
      ) as Readonly<unknown>;
      await task.persist(detached, itemState.retainedIdentity);
      setStatus(itemState.id, 'done');
    } catch (err) {
      setStatus(
        itemState.id,
        'save-failed',
        err instanceof Error ? err.message : 'Error guardando imagen'
      );
    }
  };

  const runQueue = async (
    itemsToRun: InternalItemState[],
    runToken: RunToken,
    identity: RunIdentity,
    signal: AbortSignal
  ): Promise<void> => {
    concurrencyOverride = baseConcurrency;
    let next = 0;

    const worker = async (workerIndex: number) => {
      if (workerIndex > 0 && staggerMs > 0) await sleep(workerIndex * staggerMs);
      // Bucle: mientras no haya cancelación y aún queden ítems.
      while (!signal.aborted && currentRunToken === runToken) {
        if (workerIndex >= concurrencyOverride) return;
        const index = next++;
        if (index >= itemsToRun.length) return;
        await executePhase(itemsToRun[index], runToken, identity, signal, () => currentRunToken);
      }
    };

    const workerCount = Math.max(1, Math.min(baseConcurrency, itemsToRun.length));
    await Promise.all(Array.from({ length: workerCount }, (_, w) => worker(w)));
  };

  const runItems: StoryImagePipelineRunner['runItems'] = async ({ tasks, identity }) => {
    // Invalidar corrida previa antes de abortar (orden importa).
    const priorAbort = currentAbortController;
    const runToken = mintRunToken();
    currentRunToken = runToken;
    currentAbortController = new AbortController();
    if (priorAbort) priorAbort.abort();

    if (tasks.length === 0) {
      running = false;
      notify();
      return runToken;
    }

    // Encolar/actualizar ítems. Preserva orden de aparición histórico.
    for (const t of tasks) {
      upsertItem({
        id: t.id,
        kind: t.kind,
        label: t.label,
        status: 'pending',
      });
      const s = items.get(t.id);
      if (s) s.task = t;
    }
    notify();

    running = true;
    const itemsToRun = tasks
      .map((t) => items.get(t.id))
      .filter((s): s is InternalItemState => !!s);
    try {
      await runQueue(itemsToRun, runToken, identity, currentAbortController.signal);
    } finally {
      // Si nadie tomó el testigo, cerrar la corrida.
      if (currentRunToken === runToken) {
        running = false;
        notify();
      }
    }
    return runToken;
  };

  const retryItem: StoryImagePipelineRunner['retryItem'] = async ({ itemId, identity }) => {
    const s = items.get(itemId);
    if (!s || !s.task) return;
    if (s.status === 'save-failed') {
      // Solo re-persistir. No usa runToken; no aborta corridas activas.
      await executePersistOnly(s);
      return;
    }
    if (s.status === 'error') {
      // Regenerar: nueva mini-corrida para este ítem.
      await runItems({ tasks: [s.task], identity });
      return;
    }
  };

  const retryFailed: StoryImagePipelineRunner['retryFailed'] = async (identity) => {
    // Save-failed primero: no abren una nueva corrida, no invalidan token.
    const saveFailedItems = insertionOrder
      .map((id) => items.get(id))
      .filter((s): s is InternalItemState => !!s && s.status === 'save-failed');
    for (const s of saveFailedItems) {
      await executePersistOnly(s);
    }
    const erroredTasks = insertionOrder
      .map((id) => items.get(id))
      .filter((s): s is InternalItemState => !!s && s.status === 'error' && !!s.task)
      .map((s) => s.task as PipelineItemTask | LegacyPipelineTask);
    if (erroredTasks.length > 0) {
      await runItems({ tasks: erroredTasks, identity });
    }
  };

  const cancel: StoryImagePipelineRunner['cancel'] = () => {
    // Orden crítico: token PRIMERO, luego abort. Así, si el provider ya devolvió
    // pero aún no llegó a apply, el chequeo de token bloquea la aplicación.
    currentRunToken = null;
    running = false;
    if (currentAbortController) currentAbortController.abort();
    notify();
  };

  const isBusy: StoryImagePipelineRunner['isBusy'] = () => running;

  const getItems: StoryImagePipelineRunner['getItems'] = () => {
    return insertionOrder.map((id) => {
      const s = items.get(id)!;
      return {
        id: s.id,
        kind: s.kind,
        label: s.label,
        status: s.status,
        error: s.error,
      };
    });
  };

  const statusOf: StoryImagePipelineRunner['statusOf'] = (id) => items.get(id)?.status;

  const subscribe: StoryImagePipelineRunner['subscribe'] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const markResolved: StoryImagePipelineRunner['markResolved'] = (id) => {
    const s = items.get(id);
    if (!s) return;
    if (s.status === 'done') return;
    s.status = 'done';
    s.error = undefined;
    notify();
  };

  const getRunToken: StoryImagePipelineRunner['getRunToken'] = () => currentRunToken;

  return {
    runItems,
    retryItem,
    retryFailed,
    cancel,
    isBusy,
    getItems,
    statusOf,
    subscribe,
    markResolved,
    getRunToken,
  };
}
