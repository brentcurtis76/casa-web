/**
 * Save-retry registry (A3/S3).
 *
 * Registro durable de snapshots aplicados cuya persistencia falló. Vive
 * INDEPENDIENTEMENTE del task/item map del runner: comenzar un nuevo
 * `runItems` (o reemplazar tareas) NO limpia entradas legítimas.
 *
 * Contrato:
 *  - Cada entrada está indexada por identidad exacta:
 *      `${storyId}:${epoch}:${itemId}:${generatedRevision}`
 *  - La entrada retiene: snapshot desprendido + deep-frozen, hash/provenance,
 *    identidad, y la operación `persist` "save-only" cerrada sobre el task.
 *  - Un persist fallido registra/retiene la entrada.
 *  - Un persist exitoso (para la MISMA identidad exacta) borra ÚNICAMENTE
 *    esa entrada.
 *  - Identidad stale (mismatch de storyId/epoch respecto al identity vivo) o
 *    una invalidación de epoch/story remueve la entrada.
 *  - Aplicar N+1 invalida entradas fallidas para el mismo (story,epoch,item)
 *    con revisiones `<= N`. Esto es la fuente de la garantía "N no puede
 *    sobrescribir a N+1".
 *  - `runToken` NO se consulta aquí: tras un apply válido, la persistencia
 *    (y su retry) depende SÓLO de la identidad del snapshot. El token guarda
 *    únicamente la ventana provider→apply del runner.
 */

export interface SaveRetryIdentity {
  storyId: string | null;
  epoch: number;
  itemId: string;
  generatedRevision: number;
}

export interface SaveRetryProvenance {
  sourceRevision: number;
  contentHash: string | null;
}

export interface SaveRetryEntry<TSnapshot = unknown> {
  identity: SaveRetryIdentity;
  snapshot: Readonly<TSnapshot>;
  provenance: SaveRetryProvenance;
  /**
   * Operación "save-only": persistir sin generar. Cerrada sobre el task
   * original; no toca provider ni apply. El registry la re-invoca tal cual en
   * cada reintento.
   */
  persist: (
    snapshot: Readonly<TSnapshot>,
    identity: SaveRetryIdentity,
  ) => Promise<void>;
}

export interface SaveRetryRegistry {
  /** Registra o reemplaza una entrada por identidad exacta. */
  register(entry: SaveRetryEntry): void;
  /** Elimina la entrada para esta identidad exacta. Devuelve `true` si existía. */
  clearExact(identity: SaveRetryIdentity): boolean;
  /**
   * Invalida (elimina) las entradas fallidas para `(storyId, epoch, itemId)`
   * cuya `generatedRevision <= revision`. Se llama al aplicar una nueva
   * revisión: la del nuevo apply es `revision + 1`, así que todas las viejas
   * fallas quedan huérfanas.
   */
  invalidateBelowRevision(
    storyId: string | null,
    epoch: number,
    itemId: string,
    revision: number,
  ): number;
  /** Invalida todo lo del par `(storyId, epoch)`. Se usa en epoch bump. */
  invalidateEpoch(storyId: string | null, epoch: number): number;
  /** Invalida todo lo de `storyId`. Se usa al cambiar la story activa. */
  invalidateStory(storyId: string | null): number;
  /** Lookup por identidad exacta. */
  getExact(identity: SaveRetryIdentity): SaveRetryEntry | undefined;
  /**
   * Última entrada (mayor `generatedRevision`) para `(storyId, epoch, itemId)`.
   * Es la que un retry save-only debe reintentar.
   */
  getLatestForItem(
    storyId: string | null,
    epoch: number,
    itemId: string,
  ): SaveRetryEntry | undefined;
  /** Todas las entradas actuales, en orden de inserción. */
  entries(): ReadonlyArray<SaveRetryEntry>;
  /** Entradas restringidas al par `(storyId, epoch)`. */
  entriesForIdentity(
    storyId: string | null,
    epoch: number,
  ): ReadonlyArray<SaveRetryEntry>;
  /** Tamaño total del registro (fuente de `saveFailedCount`). */
  size(): number;
  /** Presencia por identidad exacta. */
  has(identity: SaveRetryIdentity): boolean;
  /** Suscripción a cambios (register/clear/invalidate). */
  subscribe(listener: () => void): () => void;
}

function makeKey(identity: SaveRetryIdentity): string {
  return `${identity.storyId ?? ''}\u0000${identity.epoch}\u0000${identity.itemId}\u0000${identity.generatedRevision}`;
}

export function createSaveRetryRegistry(): SaveRetryRegistry {
  const entries = new Map<string, SaveRetryEntry>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };

  const registry: SaveRetryRegistry = {
    register(entry) {
      entries.set(makeKey(entry.identity), entry);
      notify();
    },
    clearExact(identity) {
      const key = makeKey(identity);
      const deleted = entries.delete(key);
      if (deleted) notify();
      return deleted;
    },
    invalidateBelowRevision(storyId, epoch, itemId, revision) {
      let count = 0;
      for (const [key, entry] of entries) {
        if (
          entry.identity.storyId === storyId &&
          entry.identity.epoch === epoch &&
          entry.identity.itemId === itemId &&
          entry.identity.generatedRevision <= revision
        ) {
          entries.delete(key);
          count++;
        }
      }
      if (count > 0) notify();
      return count;
    },
    invalidateEpoch(storyId, epoch) {
      let count = 0;
      for (const [key, entry] of entries) {
        if (entry.identity.storyId === storyId && entry.identity.epoch === epoch) {
          entries.delete(key);
          count++;
        }
      }
      if (count > 0) notify();
      return count;
    },
    invalidateStory(storyId) {
      let count = 0;
      for (const [key, entry] of entries) {
        if (entry.identity.storyId === storyId) {
          entries.delete(key);
          count++;
        }
      }
      if (count > 0) notify();
      return count;
    },
    getExact(identity) {
      return entries.get(makeKey(identity));
    },
    getLatestForItem(storyId, epoch, itemId) {
      let best: SaveRetryEntry | undefined;
      for (const entry of entries.values()) {
        if (
          entry.identity.storyId === storyId &&
          entry.identity.epoch === epoch &&
          entry.identity.itemId === itemId
        ) {
          if (
            !best ||
            entry.identity.generatedRevision > best.identity.generatedRevision
          ) {
            best = entry;
          }
        }
      }
      return best;
    },
    entries() {
      return Array.from(entries.values());
    },
    entriesForIdentity(storyId, epoch) {
      const out: SaveRetryEntry[] = [];
      for (const entry of entries.values()) {
        if (entry.identity.storyId === storyId && entry.identity.epoch === epoch) {
          out.push(entry);
        }
      }
      return out;
    },
    size() {
      return entries.size;
    },
    has(identity) {
      return entries.has(makeKey(identity));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return registry;
}
