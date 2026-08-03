/**
 * Utilidades de concurrencia para el módulo Cuentacuentos:
 * pool con límite de concurrencia y reintento con backoff exponencial.
 */

export interface RetryOptions {
  /** Intentos totales (2 = un reintento). */
  attempts?: number;
  /** Delay base en ms; crece exponencialmente por intento. */
  baseDelayMs?: number;
  /** Decide si un error amerita reintento (default: siempre). */
  shouldRetry?: (error: unknown) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 2, baseDelayMs = 2000, shouldRetry = () => true } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1 || !shouldRetry(err)) break;
      const delayMs = baseDelayMs * Math.pow(4, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
