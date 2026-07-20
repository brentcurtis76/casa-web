/**
 * A3/S6 — Approval / finalize gate + transactional runner.
 *
 * Puerta unificada que las acciones de aprobación y finalización del
 * Cuentacuentos consultan antes de mutar `story` o `currentStep`. La regla
 * dura es:
 *
 *   1) Está BLOQUEADA mientras haya alguna persistencia en vuelo (`isSaving`)
 *      o alguna entrada `save-failed` en el registry (`saveFailedCount > 0`).
 *      El editor muestra el warning "Hay imágenes sin guardar; reintenta antes
 *      de aprobar" y desactiva el botón hasta que el registro quede vacío.
 *
 *   2) Cuando la puerta permite pasar, el runner escribe primero el snapshot
 *      autoritativo (nextStory + EditorStateV1 completo) vía la cola serializada
 *      del hook. SÓLO cuando la escritura devuelve `{ stale: false }` (persistió
 *      Y su identidad sigue viva) se aplica la transición local (setStory,
 *      currentStep, kick post-transición).
 *
 *   3) Si `enqueueDraftWrite` rechaza o devuelve `{ stale: true }`, el runner
 *      NO llama `onSuccess`. El caller retiene el story/step actual y el
 *      registry queda listo para un retry — nunca "aprueba en falso".
 *
 * Este archivo es puro (no importa React) para permitir tests deterministas
 * con deferred promises y sin montar el editor.
 */

export interface ApprovalGateState {
  /** Hay ≥1 `persist` en vuelo (inicial o retry) reportado por el runner. */
  isSaving: boolean;
  /** Tamaño del `saveRetryRegistry`: entradas `save-failed` pendientes. */
  saveFailedCount: number;
}

/**
 * Puerta declarativa. `true` sólo cuando no hay guardado en vuelo y no
 * quedan retries pendientes. Toda la superficie de aprobación y finalización
 * la consulta en cada render — el disabled/gate es idempotente.
 */
export function canApprove(state: ApprovalGateState): boolean {
  return !state.isSaving && state.saveFailedCount === 0;
}

/** Resultado explícito de una transacción de aprobación. */
export type ApprovalOutcome = 'blocked' | 'stale' | 'error' | 'ok';

/** Shape reducido de lo que `enqueueDraftWrite` retorna, sin acoplar al hook. */
export interface EnqueueLikeResult {
  stale?: boolean;
}

export interface ApprovalTransactionInput<R extends EnqueueLikeResult = EnqueueLikeResult> {
  /** Snapshot del gate al momento de disparar; se re-evalúa en el gate check. */
  state: ApprovalGateState;
  /**
   * Persiste el snapshot autoritativo (nextStory + EditorStateV1 completo).
   * Debe encolar vía `enqueueDraftWrite` — NUNCA invocar provider/generación.
   * Puede rechazar (persistencia falló) o resolver con `{ stale: true }` (la
   * identidad viva cambió mientras la escritura estaba en vuelo).
   */
  enqueue: () => Promise<R | undefined>;
  /**
   * Aplica la transición local (setStory, currentStep, kick). Se llama SÓLO en
   * `ok`, y recibe el resultado del enqueue para que el caller consuma el
   * snapshot COMMITEADO por la persistencia (F4: nunca un closure pre-drain).
   * El caller debe verificar el discriminador de commit vivo de su resultado
   * (`committed` en `EnqueueDraftWriteResult`) antes de transicionar.
   */
  onSuccess: (result: R | undefined) => void;
  /** Notificación de bloqueo — típicamente un warning UI. */
  onBlocked?: () => void;
  /** Notificación de stale — retenemos story/step, no anunciamos éxito. */
  onStale?: () => void;
  /** Notificación de error de persistencia. */
  onError?: (err: unknown) => void;
}

/**
 * Ejecuta la transacción de aprobación / finalización. Contrato:
 *   - Consulta la puerta ANTES de encolar. Si está bloqueada → `blocked`
 *     (cero encolamientos, cero onSuccess).
 *   - Si el enqueue rechaza → `error` (cero onSuccess).
 *   - Si el enqueue resuelve con `{ stale: true }` → `stale` (cero onSuccess).
 *   - Sólo `ok` invoca `onSuccess`, pasándole el resultado del enqueue.
 */
export async function runApprovalTransaction<R extends EnqueueLikeResult = EnqueueLikeResult>(
  input: ApprovalTransactionInput<R>
): Promise<ApprovalOutcome> {
  if (!canApprove(input.state)) {
    input.onBlocked?.();
    return 'blocked';
  }
  let result: R | undefined;
  try {
    result = await input.enqueue();
  } catch (err) {
    input.onError?.(err);
    return 'error';
  }
  if (result && result.stale === true) {
    input.onStale?.();
    return 'stale';
  }
  input.onSuccess(result);
  return 'ok';
}
