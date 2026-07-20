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
 *
 * Contrato de retorno de `apply` (F3):
 *   - `APPLY_STALE`  → el chequeo interno de identidad (storyId/epoch) NO
 *     coincidió; se descarta y el ítem vuelve a `pending` (sin persistir), para
 *     que una nueva corrida pueda empujarlo hacia adelante.
 *   - `APPLY_EPHEMERAL` → apply se completó legítimamente pero no requiere
 *     persistencia (p.ej. hoja de referencia efímera de un prop). Ítem → `done`
 *     sin llamar a `persist`.
 *   - Un snapshot (cualquier valor no-sentinel) → se retiene y se persiste. La
 *     rechazo de `persist` publica `save-failed`; el éxito publica `done`.
 *   - `null`/`undefined` se mapean a `APPLY_STALE` por compatibilidad. Un nuevo
 *     caller NUNCA debe sobrecargar `null` para significar "efímero" — para eso
 *     existe `APPLY_EPHEMERAL`.
 */

import { retryWithBackoff } from '@/lib/cuentacuentos/concurrency';
import { hashSnapshot } from '@/lib/cuentacuentos/snapshotHash';
import {
  createSaveRetryRegistry,
  PERSIST_STALE_SYMBOL,
  type PersistOutcome,
  type SaveRetryEntry,
  type SaveRetryIdentity,
  type SaveRetryRegistry,
} from './saveRetryRegistry';

export type {
  PersistOutcome,
  SaveRetryEntry,
  SaveRetryIdentity,
  SaveRetryRegistry,
} from './saveRetryRegistry';

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
 * Sentinels de retorno de `apply`. Son símbolos comparables por referencia; el
 * runner los distingue explícitamente de un snapshot y de `null`/`undefined`
 * (que se tratan como stale por back-compat).
 *
 * - `APPLY_STALE`: identidad interna del caller cambió durante la generación
 *   → volver a `pending`, no persistir.
 * - `APPLY_EPHEMERAL`: apply se completó pero por diseño no persiste →
 *   `done`, no llamar a `persist`.
 */
export const APPLY_STALE: unique symbol = Symbol.for('a2.pipelineRunner.apply.stale');
export const APPLY_EPHEMERAL: unique symbol = Symbol.for(
  'a2.pipelineRunner.apply.ephemeral',
);
export type ApplyStale = typeof APPLY_STALE;
export type ApplyEphemeral = typeof APPLY_EPHEMERAL;

/**
 * Sentinel de retorno de `persist` (A3a/S3 subtask 3). Explícito y comparable
 * por referencia — el runner lo distingue de:
 *   - `undefined` (persistencia commiteada) → item → `done`.
 *   - promesa rechazada (`throw`) → item → `save-failed` + registry.
 *
 * `PERSIST_STALE` significa: la persistencia CORRIÓ sin excepción pero la
 * identidad viva en el downstream (draft hook) cambió durante o antes de la
 * I/O, así que NO hubo commit — el snapshot no se aplicó al estado React.
 * El runner debe:
 *   - NUNCA marcar el ítem como `done` (no hay commit real).
 *   - NUNCA registrarlo como `save-failed` (no fue error de I/O).
 *   - Dejar el item en un estado retryable/superseded según el modelo de
 *     estados existente: en persist inicial vuelve a `pending`; en retry
 *     save-only mantiene el `save-failed` para reintentos posteriores.
 */
export const PERSIST_STALE: typeof PERSIST_STALE_SYMBOL = PERSIST_STALE_SYMBOL;
export type PersistStale = typeof PERSIST_STALE_SYMBOL;

/**
 * Resultado explícito de `apply`. Callers nuevos DEBEN devolver uno de los
 * sentinels o un snapshot; `null`/`undefined` se aceptan sólo por back-compat y
 * se interpretan como `APPLY_STALE`.
 */
export type ApplyOutcome<TSnapshot> = ApplyStale | ApplyEphemeral | TSnapshot;

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
 * uno de tres resultados explícitos:
 *
 *   - `APPLY_STALE` (o `null`/`undefined` por back-compat): la identidad interna
 *     ya no coincide con la que se capturó al iniciar; el ítem vuelve a
 *     `pending` sin persistir.
 *   - `APPLY_EPHEMERAL`: apply se completó pero por diseño no hay nada que
 *     persistir; el ítem queda en `done` y `persist` NO se llama.
 *   - Un snapshot (cualquier valor distinto de los sentinels): el runner lo
 *     retiene como fuente de verdad para reintentos save-only y lo persiste.
 *
 * Un mismo `null` NO puede significar simultáneamente stale y efímero — cada
 * retorno tiene un significado inequívoco.
 */
export interface PipelineItemTask<TResult = unknown, TSnapshot = unknown> {
  id: string;
  kind: PipelineItemKind;
  label: string;
  provider: (ctx: ProviderContext) => Promise<TResult>;
  apply: (
    result: TResult,
    identity: AppliedIdentity,
  ) => ApplyOutcome<TSnapshot> | null | undefined;
  persist: (
    snapshot: Readonly<TSnapshot>,
    identity: AppliedIdentity,
  ) => Promise<PersistOutcome>;
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
  /**
   * Reintenta ÚNICAMENTE persistencias fallidas del registry para la identidad
   * `(storyId, epoch)` dada. Nunca invoca provider ni apply. Cada entrada se
   * revalida contra el registry justo antes de llamar `persist`; si la
   * identidad ya no está viva, no se hace ninguna escritura y la entrada
   * permanece como save-failed.
   */
  retrySaves: (identity: RunIdentity) => Promise<void>;
  /** Invalida el token vigente antes de abortar; corridas en vuelo no aplican ni persisten. */
  cancel: () => void;
  /** Lectura síncrona: ¿hay corrida activa? */
  isBusy: () => boolean;
  /**
   * Lectura síncrona: ¿hay al menos un `persist` (inicial o retry) en vuelo?
   * Cubre initial + retry persistence — es la fuente para el "image-saving
   * signal".
   */
  isSaving: () => boolean;
  /** Vista inmutable de ítems (para render). */
  getItems: () => ReadonlyArray<PipelineItemView>;
  /** Estado terminal/actual de un ítem. */
  statusOf: (id: string) => PipelineItemStatus | undefined;
  /** Suscripción a cambios de `items` / registry / saving. Devuelve un unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Marca un ítem como resuelto (compat: p.ej. el usuario lo regeneró manualmente). */
  markResolved: (id: string) => void;
  /** Token actualmente vigente (o null si no hay corrida activa). Diagnóstico/tests. */
  getRunToken: () => RunToken | null;
  /**
   * Conteo derivado del registry — número de saves fallidos pendientes.
   *
   * Sin argumento: total absoluto (todas las stories/epochs). Con `identity`:
   * scopeado al par `(storyId, epoch)` — una falla en Story A no incrementa
   * el conteo mientras la UI está en Story B. La versión scopeada es la que
   * el hook expone al UI (via `activeIdentity`).
   */
  saveFailedCount: (identity?: RunIdentity) => number;
  /** Acceso de sólo lectura al registry (para diagnósticos y tests). */
  getSaveRetryRegistry: () => SaveRetryRegistry;
  /**
   * Invalida entradas del registry por scope. La hook lo llama en cambios de
   * lifecycle (bump epoch, cambio de story).
   */
  invalidateSaveRetries: (
    scope: { storyId: string | null; epoch: number } | { storyId: string | null },
  ) => number;
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

  // Estado global del runner. Único source of truth para items/status.
  // El registry es una fuente de verdad independiente (no acoplada al task
  // map): re-arrancar un run no lo limpia.
  const items = new Map<string, InternalItemState>();
  const insertionOrder: string[] = [];
  const listeners = new Set<() => void>();
  const registry = createSaveRetryRegistry();

  let currentRunToken: RunToken | null = null;
  let currentAbortController: AbortController | null = null;
  let running = false;
  let concurrencyOverride = baseConcurrency;
  // Contador de persist en vuelo — cubre initial y retry persistence.
  let savingCount = 0;

  const notify = () => {
    for (const l of listeners) l();
  };
  // Cambios del registry también se propagan al mismo bus de subscripción,
  // para que saveFailedCount y la señal de guardado sean reactivos sin
  // suscripciones extra.
  registry.subscribe(notify);

  const beginSaving = () => {
    savingCount++;
    notify();
  };
  const endSaving = () => {
    if (savingCount > 0) savingCount--;
    notify();
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
        // Nueva corrida sobre un ítem existente: limpia SÓLO el estado
        // terminal visible (`error` / `save-failed`) en la vista de items.
        // Las entradas del save-retry registry NO se tocan aquí: son la
        // fuente de verdad de persistencias fallidas y sobreviven al reset
        // del task map (A3/S3). Un apply exitoso posterior (rev N+1) se
        // encargará de invalidar entradas viejas del mismo ítem.
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

    let outcome: unknown;
    try {
      outcome = task.apply(providerResult, appliedIdentity);
    } catch (err) {
      setStatus(
        itemState.id,
        'error',
        err instanceof Error ? err.message : 'Error aplicando resultado'
      );
      return;
    }

    // Desambiguación explícita del resultado de apply:
    //   - APPLY_STALE / null / undefined → identidad interna stale → `pending`.
    //     El ítem queda disponible para que una futura corrida lo empuje otra
    //     vez sin arrastrar `error`/`done` fantasmas.
    //   - APPLY_EPHEMERAL → apply legítimo, no requiere persistencia → `done`.
    //   - snapshot → persistir.
    if (outcome === APPLY_STALE || outcome === null || outcome === undefined) {
      setStatus(itemState.id, 'pending');
      return;
    }
    if (outcome === APPLY_EPHEMERAL) {
      setStatus(itemState.id, 'done');
      return;
    }

    // Snapshot desprendido + deep-frozen. Es el que se retiene para retry en
    // el registry y también el que se entrega a `persist` (frozen desde ya —
    // no hace falta un segundo detach porque el caller ya no puede mutarlo).
    const retained = deepFreeze(detachSnapshot(outcome));
    itemState.generatedRevision = nextRevision;

    // Regla "N+1 invalida N": una nueva revisión aplicada limpia entradas
    // fallidas viejas del mismo (story, epoch, item) con revisión ≤ N.
    // Esto es lo que garantiza que una vieja falla NO pueda sobrescribir la
    // nueva revisión aunque su persist se reintente después.
    registry.invalidateBelowRevision(
      appliedIdentity.storyId,
      appliedIdentity.epoch,
      appliedIdentity.itemId,
      appliedIdentity.generatedRevision - 1,
    );

    // --- Fase persist ---
    // Publica 'persisting' ANTES de invocar persist, y sólo emite 'done'
    // después de que la promesa se resuelva. Un rechazo publica 'save-failed'
    // (sin pasar por 'done') y registra la entrada en el registry para retry
    // save-only. `apply` NO persiste — la escritura ocurre acá.
    setStatus(itemState.id, 'persisting');
    beginSaving();
    try {
      const persistResult = await task.persist(retained, appliedIdentity);
      // A3a/S3 subtask 3: discriminated stale-persist result. Un downstream
      // (draft hook) puede reportar `PERSIST_STALE` cuando la I/O corrió
      // pero la identidad viva cambió antes/durante el await → no hubo
      // commit real. Distinto de éxito y distinto de error:
      //   - NO marca `done` (nunca hubo commit).
      //   - NO registra save-failed (no fue error de I/O; no es retryable
      //     bajo esta identidad — un lifecycle change ya la superseded).
      //   - Devuelve el ítem a `pending` para que la corrida nueva lo
      //     empuje otra vez. Análogo al tratamiento de APPLY_STALE.
      if (persistResult === PERSIST_STALE) {
        setStatus(itemState.id, 'pending');
        return;
      }
      // Éxito: no hace falta tocar el registry (no habíamos registrado nada
      // para esta revisión) y cualquier entrada más vieja ya se invalidó
      // arriba. `done`.
      setStatus(itemState.id, 'done');
    } catch (err) {
      // Falla: registrar entrada save-only cerrada sobre el task, para que
      // retrySaves / retryItem la reintenten sin invocar provider ni apply.
      // Provenance (A3a/S4): hash determinista del snapshot retenido +
      // sourceRevision = generatedRevision. Nunca null: los consumidores
      // (draft hook, validaciones pre-swap) requieren un hash comparable.
      const entry: SaveRetryEntry = {
        identity: appliedIdentity,
        snapshot: retained,
        provenance: {
          sourceRevision: appliedIdentity.generatedRevision,
          contentHash: hashSnapshot(retained),
        },
        persist: task.persist as SaveRetryEntry['persist'],
      };
      registry.register(entry);
      setStatus(
        itemState.id,
        'save-failed',
        err instanceof Error ? err.message : 'Error guardando imagen'
      );
    } finally {
      endSaving();
    }
  };

  /**
   * Ejecuta un retry save-only para una entrada específica del registry.
   *
   * Contrato (A3/S3 + A3a/S4):
   *  - Nunca invoca provider ni apply — sólo `entry.persist`.
   *  - Revalida contra el registry INMEDIATAMENTE antes de llamar persist:
   *    si la entrada ya no está (fue invalidada por epoch bump / story swap
   *    / apply N+1), no se hace ninguna escritura y el ítem queda como
   *    estaba.
   *  - Además revalida contra la identidad viva provista (`liveStoryId` /
   *    `liveEpoch`): si el snapshot es de otra story o epoch, no persiste.
   *  - Provenance guard (A3a/S4): antes de persistir valida que el hash del
   *    snapshot retenido siga coincidiendo con la provenance registrada.
   *  - **Post-persist revalidation (A3a)**: cuando persist RESUELVE, antes
   *    de tocar el registry o marcar `done`, revalida que el mismo objeto
   *    de entrada siga siendo la última (`getExact === entry`), que la
   *    identidad viva siga apuntando al mismo (storyId, epoch), y que no
   *    haya llegado una revisión N+1 durante el await. Si algo cambió, NO
   *    se limpia la entrada nueva ni se marca `done` — el estado del ítem
   *    queda al mando de la revisión más nueva.
   *  - Éxito válido → clearExact de esta identidad, ítem → `done`.
   *  - Rechazo → entrada permanece, ítem → `save-failed` (nunca `done`
   *    mientras esté sin salvar).
   *  - **Saving counter**: `beginSaving()` y exactamente UN `endSaving()`
   *    por invocación — el `finally` único cubre todos los caminos.
   */
  const executeSaveRetry = async (
    entry: SaveRetryEntry,
    liveStoryId: string | null,
    liveEpoch: number,
  ): Promise<void> => {
    const itemId = entry.identity.itemId;
    // Revalidación síncrona previa: registry vigente + identidad viva.
    if (!registry.has(entry.identity)) return;
    if (entry.identity.storyId !== liveStoryId || entry.identity.epoch !== liveEpoch) {
      return;
    }
    // Doble check: ¿sigue siendo la entrada más nueva? Un apply concurrente
    // podría haber inyectado una N+1 (que invalida esta) en el mismo tick.
    const latest = registry.getLatestForItem(
      entry.identity.storyId,
      entry.identity.epoch,
      itemId,
    );
    if (!latest || latest.identity.generatedRevision > entry.identity.generatedRevision) {
      return;
    }

    // Provenance guard: el snapshot está deep-frozen — cualquier divergencia
    // frente a la provenance registrada indica corrupción, y no debemos
    // persistir un snapshot cuya provenance no coincida.
    if (entry.provenance.contentHash !== null) {
      const currentHash = hashSnapshot(entry.snapshot);
      if (currentHash !== entry.provenance.contentHash) {
        setStatus(itemId, 'save-failed', 'Snapshot provenance mismatch');
        return;
      }
    }

    setStatus(itemId, 'persisting');
    beginSaving();
    try {
      // Revalidación final justo antes de la llamada — cubre el caso en el
      // que una invalidación ocurre entre la revalidación arriba y el await.
      if (!registry.has(entry.identity)) {
        return;
      }
      const persistResult = await entry.persist(entry.snapshot, entry.identity);
      // A3a/S3 subtask 3: discriminated stale-persist result — retry path.
      // Un `PERSIST_STALE` aquí significa que la I/O corrió sin excepción
      // pero el downstream no commiteó por identity drift. Debemos:
      //   - NUNCA limpiar la entrada del registry (no persistimos bajo la
      //     identidad viva) → sigue siendo retryable en futuros ticks.
      //   - NUNCA marcar `done` (no hay commit real).
      //   - Si la entrada sigue siendo la vigente Y aún corresponde a la
      //     identidad viva, dejar `save-failed` para que la UI y
      //     `saveFailedCount` reflejen que sigue pendiente. Si fue
      //     superseded por rev N+1 o por lifecycle change, no tocar el
      //     status — la revisión nueva es la fuente de verdad (idéntico
      //     al tratamiento del rechazo `throw` más abajo).
      if (persistResult === PERSIST_STALE) {
        const stillExactStale = registry.getExact(entry.identity);
        if (
          stillExactStale === entry &&
          entry.identity.storyId === liveStoryId &&
          entry.identity.epoch === liveEpoch
        ) {
          setStatus(itemId, 'save-failed', 'Persistencia stale — identidad cambió');
        }
        return;
      }
      // Post-persist revalidation (A3a): un N+1 (o epoch/story swap) podría
      // haber llegado durante el await. Si nuestra entrada ya no es la
      // vigente, NO limpiar (no hay nada nuestro que limpiar) y NO marcar
      // `done` — la revisión nueva es la fuente de verdad.
      const stillExact = registry.getExact(entry.identity);
      if (stillExact !== entry) return;
      if (entry.identity.storyId !== liveStoryId || entry.identity.epoch !== liveEpoch) {
        return;
      }
      const latestAfter = registry.getLatestForItem(
        entry.identity.storyId,
        entry.identity.epoch,
        itemId,
      );
      if (
        latestAfter &&
        latestAfter.identity.generatedRevision > entry.identity.generatedRevision
      ) {
        return;
      }
      // Sólo limpia esta entrada exacta; entradas de otros items no se tocan.
      registry.clearExact(entry.identity);
      setStatus(itemId, 'done');
    } catch (err) {
      // Entrada permanece — el ítem no puede llegar a `done` mientras siga
      // sin persistir. Sólo publicamos `save-failed` si nuestra entrada
      // sigue viva: si un N+1 la reemplazó durante el await, dejamos que
      // la revisión nueva mande el estado.
      const stillExact = registry.getExact(entry.identity);
      if (stillExact === entry) {
        setStatus(
          itemId,
          'save-failed',
          err instanceof Error ? err.message : 'Error guardando imagen'
        );
      }
    } finally {
      // Un único decremento — el `beginSaving()` de arriba está pareado
      // aquí para todos los caminos (early return, éxito, error).
      endSaving();
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
      // Save-only retry: mira SIEMPRE al registry (fuente de verdad para
      // fallas de persist). No usa runToken; no aborta corridas activas; no
      // llama provider ni apply.
      const entry = registry.getLatestForItem(identity.storyId, identity.epoch, itemId);
      if (!entry) return;
      await executeSaveRetry(entry, identity.storyId, identity.epoch);
      return;
    }
    if (s.status === 'error') {
      // Regenerar: nueva mini-corrida para este ítem — genera + apply +
      // persist. Es explícitamente el path de retry de GENERACIÓN, separado
      // del path de retry save-only.
      await runItems({ tasks: [s.task], identity });
      return;
    }
  };

  const retryFailed: StoryImagePipelineRunner['retryFailed'] = async (identity) => {
    // Save-failed primero: sale del registry, no invalida token ni provider.
    // Orden por insertionOrder para reproducibilidad (los tests fijan orden
    // determinista).
    const entriesByItem = new Map<string, SaveRetryEntry>();
    for (const entry of registry.entriesForIdentity(identity.storyId, identity.epoch)) {
      const existing = entriesByItem.get(entry.identity.itemId);
      if (
        !existing ||
        entry.identity.generatedRevision > existing.identity.generatedRevision
      ) {
        entriesByItem.set(entry.identity.itemId, entry);
      }
    }
    for (const id of insertionOrder) {
      const entry = entriesByItem.get(id);
      if (entry) await executeSaveRetry(entry, identity.storyId, identity.epoch);
    }
    const erroredTasks = insertionOrder
      .map((id) => items.get(id))
      .filter((s): s is InternalItemState => !!s && s.status === 'error' && !!s.task)
      .map((s) => s.task as PipelineItemTask | LegacyPipelineTask);
    if (erroredTasks.length > 0) {
      await runItems({ tasks: erroredTasks, identity });
    }
  };

  const retrySaves: StoryImagePipelineRunner['retrySaves'] = async (identity) => {
    // Sólo entradas del registry para la identidad viva (storyId, epoch).
    // Nunca corre provider ni apply. Cada entrada se revalida contra el
    // registry justo antes de persistir.
    const entriesByItem = new Map<string, SaveRetryEntry>();
    for (const entry of registry.entriesForIdentity(identity.storyId, identity.epoch)) {
      const existing = entriesByItem.get(entry.identity.itemId);
      if (
        !existing ||
        entry.identity.generatedRevision > existing.identity.generatedRevision
      ) {
        entriesByItem.set(entry.identity.itemId, entry);
      }
    }
    // Orden determinista: primero por insertionOrder de items conocidos,
    // luego el resto por orden de aparición del registry.
    const seen = new Set<string>();
    for (const id of insertionOrder) {
      const entry = entriesByItem.get(id);
      if (entry) {
        seen.add(id);
        await executeSaveRetry(entry, identity.storyId, identity.epoch);
      }
    }
    for (const [id, entry] of entriesByItem) {
      if (seen.has(id)) continue;
      await executeSaveRetry(entry, identity.storyId, identity.epoch);
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

  const isSaving: StoryImagePipelineRunner['isSaving'] = () => savingCount > 0;

  const saveFailedCount: StoryImagePipelineRunner['saveFailedCount'] = (identity) => {
    if (identity) return registry.sizeForIdentity(identity.storyId, identity.epoch);
    return registry.size();
  };

  const getSaveRetryRegistry: StoryImagePipelineRunner['getSaveRetryRegistry'] = () =>
    registry;

  const invalidateSaveRetries: StoryImagePipelineRunner['invalidateSaveRetries'] = (
    scope,
  ) => {
    if ('epoch' in scope) {
      return registry.invalidateEpoch(scope.storyId, scope.epoch);
    }
    return registry.invalidateStory(scope.storyId);
  };

  return {
    runItems,
    retryItem,
    retryFailed,
    retrySaves,
    cancel,
    isBusy,
    isSaving,
    getItems,
    statusOf,
    subscribe,
    markResolved,
    getRunToken,
    saveFailedCount,
    getSaveRetryRegistry,
    invalidateSaveRetries,
  };
}
