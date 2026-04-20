/**
 * Persistencia IndexedDB para segmentos del grabador.
 *
 * Guarda chunks de audio a disco mientras la grabación avanza para que una
 * caída del popup o del navegador no pierda la sesión. Cada segmento se
 * guarda bajo la clave compuesta `[sessionId, segmentIndex]` en un único
 * object store.
 */

import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'casa-recorder';
const DB_VERSION = 1;
const STORE_NAME = 'segments';

export interface RecorderSegmentMeta {
  mimeType?: string;
  durationMs?: number;
  createdAt?: number;
}

export interface RecorderSegmentRecord {
  sessionId: string;
  segmentIndex: number;
  blob: Blob;
  meta: RecorderSegmentMeta;
}

function ensureIndexedDB(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB no está disponible en este entorno');
  }
  return indexedDB;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request falló'));
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'));
    tx.onerror = () => reject(tx.error ?? new Error('Transacción falló'));
  });
}

export async function openRecorderDB(): Promise<IDBDatabase> {
  const factory = ensureIndexedDB();
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ['sessionId', 'segmentIndex'],
        });
        store.createIndex('by_session', 'sessionId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
    request.onblocked = () =>
      reject(new Error('Apertura de IndexedDB bloqueada por otra conexión'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openRecorderDB();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await fn(store);
    await promisifyTransaction(tx);
    return result;
  } finally {
    db.close();
  }
}

export async function saveSegment(
  sessionId: string,
  segmentIndex: number,
  blob: Blob,
  meta: RecorderSegmentMeta = {},
): Promise<void> {
  const record: RecorderSegmentRecord = {
    sessionId,
    segmentIndex,
    blob,
    meta: {
      mimeType: meta.mimeType ?? blob.type,
      durationMs: meta.durationMs,
      createdAt: meta.createdAt ?? Date.now(),
    },
  };
  await withStore('readwrite', (store) => {
    store.put(record);
  });
}

export async function getSegment(
  sessionId: string,
  segmentIndex: number,
): Promise<Blob | null> {
  return withStore('readonly', async (store) => {
    const record = await promisifyRequest<RecorderSegmentRecord | undefined>(
      store.get([sessionId, segmentIndex]) as IDBRequest<RecorderSegmentRecord | undefined>,
    );
    return record ? record.blob : null;
  });
}

export async function listSegments(sessionId: string): Promise<RecorderSegmentRecord[]> {
  return withStore('readonly', async (store) => {
    const index = store.index('by_session');
    const records = await promisifyRequest<RecorderSegmentRecord[]>(
      index.getAll(IDBKeyRange.only(sessionId)) as IDBRequest<RecorderSegmentRecord[]>,
    );
    return records.sort((a, b) => a.segmentIndex - b.segmentIndex);
  });
}

export async function deleteSegment(
  sessionId: string,
  segmentIndex: number,
): Promise<void> {
  await withStore('readwrite', (store) => {
    store.delete([sessionId, segmentIndex]);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    const index = store.index('by_session');
    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openCursor(IDBKeyRange.only(sessionId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () =>
        reject(cursorRequest.error ?? new Error('No se pudo iterar segmentos'));
    });
  });
}

export async function listSessions(meetingId?: string): Promise<string[]> {
  const all = await withStore('readonly', async (store) => {
    const index = store.index('by_session');
    const keys = await promisifyRequest<IDBValidKey[]>(index.getAllKeys());
    const unique = new Set<string>();
    for (const key of keys) {
      if (typeof key === 'string') {
        unique.add(key);
      }
    }
    return Array.from(unique);
  });

  if (!meetingId || all.length === 0) return all;

  const { data, error } = await supabase
    .from('church_leadership_recording_sessions')
    .select('id')
    .eq('meeting_id', meetingId)
    .in('id', all);

  if (error) {
    throw new Error(`Error al filtrar sesiones por reunión: ${error.message}`);
  }

  const matching = new Set((data ?? []).map((row) => row.id as string));
  return all.filter((id) => matching.has(id));
}
