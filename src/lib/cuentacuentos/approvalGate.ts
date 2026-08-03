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
 *      del hook. `onSuccess` se llama SÓLO cuando la escritura resolvió un
 *      resultado NO-stale y presente (el outcome `'ok'`). Un `{ stale: true }`,
 *      un rechazo, o un resultado ausente NO transicionan.
 *
 *   3) `'ok'` NO garantiza por sí solo un commit vivo a nivel de tipos: el
 *      resultado del enqueue puede ser "persistió pero identidad viva cambió"
 *      (sin `committed`). El caller DEBE verificar su discriminador de commit
 *      vivo (`committed` en `EnqueueDraftWriteResult`) dentro de `onSuccess`
 *      antes de transicionar — o, mejor, hacer que su thunk mapee un resultado
 *      sin `committed` a `{ stale: true }` para que `'ok'` implique commit vivo.
 *      Si el enqueue rechaza o resuelve stale/ausente, el runner NO llama
 *      `onSuccess`: el caller retiene story/step y el registry queda listo para
 *      un retry — nunca "aprueba en falso".
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
   * `ok`, y recibe el resultado NO-stale y PRESENTE del enqueue para que el
   * caller consuma el snapshot COMMITEADO por la persistencia (F4: nunca un
   * closure pre-drain). El runner garantiza que `result` no es `undefined` ni
   * `{ stale: true }`; el caller debe verificar el discriminador de commit vivo
   * (`committed`) antes de transicionar (o mapear no-committed→stale en su thunk).
   */
  onSuccess: (result: R) => void;
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
 *   - Si el enqueue resuelve con `{ stale: true }` o AUSENTE (`undefined`) →
 *     `stale` (cero onSuccess): no se persistió/commiteó nada que transicionar.
 *   - Sólo `ok` invoca `onSuccess`, pasándole el resultado presente y no-stale.
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
  // Un resultado ausente (undefined) o `{ stale: true }` = nada commiteado que
  // transicionar. Sólo un resultado PRESENTE y no-stale llega a onSuccess.
  if (!result || result.stale === true) {
    input.onStale?.();
    return 'stale';
  }
  input.onSuccess(result);
  return 'ok';
}
