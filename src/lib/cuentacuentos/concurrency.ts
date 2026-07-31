/**
 * Utilidades de concurrencia para el módulo Cuentacuentos:
 * pool con límite de concurrencia y reintento con backoff exponencial.
 */

/**
 * PG/G2 — Error DEDICADO de cancelación de `retryWithBackoff`.
 *
 * La cancelación NO se representa con `shouldRetry=false`, ni con un error
 * arbitrario del proveedor, ni por coincidencia de mensaje: quien la observa
 * (el runner del pipeline) la distingue por identidad de clase. Un error de
 * proveedor que "parece" cancelado no lo es, y una cancelación real no depende
 * de que el proveedor produzca ningún error.
 */
export class RetryCancelledError extends Error {
  constructor(message = 'Reintento cancelado') {
    super(message);
    this.name = 'RetryCancelledError';
  }
}

export interface RetryOptions {
  /** Intentos totales (2 = un reintento). */
  attempts?: number;
  /** Delay base en ms; crece exponencialmente por intento. */
  baseDelayMs?: number;
  /** Decide si un error amerita reintento (default: siempre). */
  shouldRetry?: (error: unknown) => boolean;
  /**
   * PG/G2 — Entrada de cancelación OPCIONAL. Cuando se provee:
   *   - se consulta ANTES del intento 0 y antes de CADA despacho posterior;
   *   - la espera de backoff se resuelve de inmediato al abortar, sin dejar
   *     correr el timer residual;
   *   - se vuelve a consultar tras una espera completada normalmente, antes
   *     de despachar el siguiente intento;
   *   - el rechazo es siempre un `RetryCancelledError`.
   * Un caller que la OMITE conserva exactamente el comportamiento previo.
   */
  signal?: AbortSignal;
}

/**
 * Espera abortable. Resuelve al vencer el timer o rechaza con
 * `RetryCancelledError` al abortar; en AMBOS caminos (y en el de abort previo)
 * limpia timer y listener, para no dejar ni un timer residual capaz de
 * despertar un intento ya cancelado ni un listener colgado de la señal.
 */
function cancellableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new RetryCancelledError());
    };
    signal?.addEventListener('abort', onAbort);
  });
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    attempts = 2,
    baseDelayMs = 2000,
    shouldRetry = () => true,
    signal,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Chequeo de cancelación ANTES de cada despacho — incluido el intento 0, y
    // también el que sigue a una espera que venció normalmente: si la
    // cancelación se volvió observable justo al completarse el timer, el
    // intento N+1 no debe salir igual.
    if (signal?.aborted) throw new RetryCancelledError();
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1 || !shouldRetry(err)) break;
      const delayMs = baseDelayMs * Math.pow(4, attempt) + Math.random() * 1000;
      // Un `throw` desde el catch propaga fuera del bucle: una cancelación
      // durante el backoff rechaza con `RetryCancelledError`, sin consumir el
      // intento siguiente.
      await cancellableDelay(delayMs, signal);
    }
  }
  throw lastError;
}

/**
 * Ejecuta tareas con un máximo de `limit` en vuelo. Nunca rechaza: cada tarea
 * resuelve a un PromiseSettledResult en el mismo orden del array de entrada.
 * `staggerMs` escalona el arranque de los workers para no golpear rate limits.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit = 3,
  staggerMs = 0
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;

  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
    if (staggerMs > 0 && workerIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, workerIndex * staggerMs));
    }
    while (next < tasks.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
