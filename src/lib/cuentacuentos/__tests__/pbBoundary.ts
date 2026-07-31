/**
 * PB — BORDE EXTERNO compartido por las suites de criterio de la fase.
 *
 * G7 fija el bar de integración: el editor, el hook y `liturgyService` son los
 * de PRODUCCIÓN; sólo pueden mockearse BORDES externos. Este módulo es ese
 * borde y nada más:
 *
 *   - cliente Supabase (auth / tablas / storage),
 *   - invocación de funciones pagas.
 *
 * [B2] — `use-toast` NO es un borde externo: es un hook de React interno de
 * producción y G7 no lo admite en la lista. La suite de cableado (G7/T-B.8)
 * corre el hook REAL. Las suites que todavía lo mockean lo hacen por su cuenta
 * y ninguna de ellas es la que sostiene la barra de integración de T-B.8.
 *
 * NO importa producción: si lo hiciera, el `vi.mock` de cada archivo lo
 * cargaría antes de instalar el doble y el aislamiento se rompería.
 *
 * Uso desde un archivo de test (la fábrica de `vi.mock` se iza, así que la
 * dependencia se resuelve con un `import()` dinámico DENTRO de la fábrica):
 *
 *     vi.mock('@/integrations/supabase/client', async () => {
 *       const { makeSupabaseMock } = await import('./pbBoundary');
 *       return { supabase: makeSupabaseMock() };
 *     });
 *
 * El doble es DERIVADO, no constante: el upsert de `cuentacuentos_drafts`
 * reescribe una fila simulada (nueva `story->>id`, nuevo `updated_at`) y el
 * DELETE evalúa sus filtros CONTRA esa fila. Así "borró 0 filas" en las pruebas
 * B1/G5 sale de la condición real del compare-and-delete y no de un valor
 * fijado a mano.
 */

// ---------------------------------------------------------------------------
// Tipos observables
// ---------------------------------------------------------------------------

/**
 * Secuencia monótona global sobre TODAS las observaciones. Es lo que permite
 * afirmar ORDEN entre operaciones de distinta clase — p.ej. que el borrado del
 * borrador ocurrió DESPUÉS del upsert de `liturgia_elementos` (G5 paso 4).
 */
let opSeq = 0;
function nextSeq(): number {
  opSeq += 1;
  return opSeq;
}

/** Una llamada al borde de Storage tal como la emite producción. */
export interface UploadCall {
  seq: number;
  bucket: string;
  path: string;
  contentType: string | undefined;
  upsert: boolean | undefined;
  /** Tamaño en bytes del blob subido — selector estable e independiente del nombre. */
  size: number;
}

/** Un upsert a una tabla, reducido a lo que la fase observa. */
export interface UpsertCall {
  seq: number;
  table: string;
  payload: unknown;
}

/** Un `storage.remove` — T-B.7 lo cuenta por bucket. */
export interface RemoveCall {
  seq: number;
  bucket: string;
  paths: string[];
}

/** Un DELETE de tabla con sus filtros evaluados y su resultado. */
export interface DeleteCall {
  seq: number;
  table: string;
  filters: Record<string, string>;
  deleted: number;
}

/** La fila simulada del borrador (UNIQUE(liturgia_id, user_id)). */
export interface SimDraftRow {
  liturgia_id: string;
  user_id: string;
  story_id: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------

export interface BoundaryControls {
  userId: string | null;
  /** Error del SELECT preliminar de `cuentacuentos_drafts`. */
  selectError: { message: string } | null;
  /** Error del upsert de `cuentacuentos_drafts`. */
  upsertError: { message: string } | null;
  /** Error del upsert de `liturgia_elementos`. */
  elementosUpsertError: { message: string } | null;
  /** `image_paths` que devuelve el SELECT preliminar. */
  existingImagePaths: Record<string, unknown> | null;
  /** Fila completa que devuelve `loadDraft` (prompt de recuperación incluido). */
  draftRow: Record<string, unknown> | null;
  /** Falla TODA subida. */
  failAllUploads: boolean;
  /** Falla la subida cuyo blob mide exactamente estos bytes. */
  failUploadWhenSize: number | null;
  /** Falla la subida cuyo path contiene este fragmento (selector por sitio). */
  failUploadWhenPathIncludes: string | null;
  /** Devuelve un conflicto de duplicado (409) para ese tamaño de blob. */
  duplicateWhenSize: number | null;
  /** Devuelve un conflicto de duplicado (409) para ese fragmento de path. */
  duplicateWhenPathIncludes: string | null;
  /**
   * Error NO-409 con un mensaje que SUENA a duplicado. T-B.2 exige que un
   * clasificador por texto quede descartado: esto debe RECHAZAR.
   */
  duplicateLikeMessageWhenSize: number | null;
  /**
   * Igual que el anterior pero seleccionando por PATH. Los fixtures comparten
   * tamaño, así que el selector por bytes no puede apuntar a un sitio concreto;
   * éste sí, y es el que necesita el control no-409 de T-B.9 sobre el MISMO
   * camino de producción.
   */
  duplicateLikeMessageWhenPathIncludes: string | null;
  /**
   * Semántica REAL de `upsert:false`: la PRIMERA subida a un path lo crea; toda
   * subida posterior al MISMO path devuelve el conflicto capturado (409).
   *
   * Es lo que hace fiel la prueba de grupo de T-B.2 sin plantar el error a
   * mano: dos entradas con bytes decodificados idénticos producen el MISMO
   * path, así que una llamada crea y la otra conflictúa por sí sola, igual que
   * contra Storage.
   */
  conflictOnRepeatPath: boolean;
  /**
   * Variante del anterior con un error NO-409 de texto duplicado-parecido: es
   * la mutación de T-B.2 que trata un no-409 como éxito.
   */
  repeatPathUsesNon409: boolean;
  /** `storage.list` encuentra el archivo buscado (verificación de existencia). */
  listFindsFile: boolean;
  /** Respuesta de `functions.invoke` para las funciones pagas. */
  invokeResponse: { data: unknown; error: unknown };
}

export const ctl: BoundaryControls = makeDefaultControls();

function makeDefaultControls(): BoundaryControls {
  return {
    userId: 'user-pb',
    selectError: null,
    upsertError: null,
    elementosUpsertError: null,
    existingImagePaths: null,
    draftRow: null,
    failAllUploads: false,
    failUploadWhenSize: null,
    failUploadWhenPathIncludes: null,
    duplicateWhenSize: null,
    duplicateWhenPathIncludes: null,
    duplicateLikeMessageWhenSize: null,
    duplicateLikeMessageWhenPathIncludes: null,
    conflictOnRepeatPath: false,
    repeatPathUsesNon409: false,
    listFindsFile: true,
    invokeResponse: { data: { success: true, images: [] }, error: null },
  };
}

// ---------------------------------------------------------------------------
// Observaciones
// ---------------------------------------------------------------------------

export const uploads: UploadCall[] = [];
export const upserts: UpsertCall[] = [];
export const removals: RemoveCall[] = [];
export const deletes: DeleteCall[] = [];

/** Estado de la fila simulada; `null` = no existe. */
export const sim: { row: SimDraftRow | null } = { row: null };

/**
 * Objetos que ya existen en el "Storage" simulado (`bucket/path`). Sólo lo
 * consulta `conflictOnRepeatPath`, para reproducir el 409 de `upsert:false`
 * cuando una segunda entrada del mismo grupo resuelve al mismo path.
 */
const createdPaths = new Set<string>();

/**
 * ¿La fila simulada llegó a existir en este caso? Distingue "nunca hubo fila"
 * de "la borró el compare-and-delete", que es lo que gobierna si `loadDraft`
 * puede volver a ofrecer el borrador.
 */
let simWasSeeded = false;

/** Contador monótono de `updated_at` — determinista entre corridas. */
let updatedAtSeq = 0;
export function nextUpdatedAt(): string {
  updatedAtSeq += 1;
  return `2026-05-01T00:00:${String(updatedAtSeq).padStart(2, '0')}.000Z`;
}

export function resetBoundary(): void {
  Object.assign(ctl, makeDefaultControls());
  uploads.length = 0;
  upserts.length = 0;
  removals.length = 0;
  deletes.length = 0;
  createdPaths.clear();
  sim.row = null;
  updatedAtSeq = 0;
  opSeq = 0;
  simWasSeeded = false;
}

/** Subidas al bucket de borradores, en orden de emisión. */
export function draftUploads(): UploadCall[] {
  return uploads.filter((u) => u.bucket === 'cuentacuentos-drafts');
}

/** Subidas al bucket de imágenes finalizadas. */
export function finalUploads(): UploadCall[] {
  return uploads.filter((u) => u.bucket === 'liturgia-images');
}

/** Upserts de una tabla concreta. */
export function upsertsTo(table: string): UpsertCall[] {
  return upserts.filter((u) => u.table === table);
}

/**
 * Remociones de objetos de cuentacuentos. T-B.7 exige CERO.
 *
 * La remoción PREEXISTENTE del PDF de reflexión vive en el bucket
 * `liturgy-published` y está explícitamente fuera de alcance: se excluye acá
 * por BUCKET, no por heurística de nombre, para no poder clasificarla mal.
 */
export function cuentacuentosRemovals(): RemoveCall[] {
  return removals.filter(
    (r) => r.bucket === 'cuentacuentos-drafts' || r.bucket === 'liturgia-images'
  );
}

// ---------------------------------------------------------------------------
// Errores de Storage con la FORMA REAL capturada (G3)
// ---------------------------------------------------------------------------

/**
 * `StorageApiError` tal como lo emite `@supabase/storage-js` 2.90.1 contra
 * storage-api v1.66.4: `status` vale 400 incluso para el duplicado, y el
 * discriminante es `statusCode` como STRING. Ver `pbStorageErrors.ts`.
 */
export function storageError(message: string, statusCode: string) {
  const err = new Error(message) as Error & {
    __isStorageError: boolean;
    status: number;
    statusCode: string;
  };
  err.name = 'StorageApiError';
  err.__isStorageError = true;
  err.status = 400;
  err.statusCode = statusCode;
  return err;
}

// ---------------------------------------------------------------------------
// El doble
// ---------------------------------------------------------------------------

type Thenable = {
  then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => unknown;
};

export function makeSupabaseMock() {
  const upsertBuilder = (table: string, payload: Record<string, unknown>) => {
    const run = async () => {
      upserts.push({ seq: nextSeq(), table, payload });
      if (table === 'cuentacuentos_drafts') {
        if (ctl.upsertError) return { error: ctl.upsertError, updatedAt: null };
        const story = payload['story'] as { id?: string } | null;
        const updatedAt = nextUpdatedAt();
        // El upsert (re)escribe la fila simulada: nueva identidad, nuevo instante.
        sim.row = {
          liturgia_id: String(payload['liturgia_id']),
          user_id: String(payload['user_id']),
          story_id: story?.id ?? null,
          updated_at: updatedAt,
        };
        return { error: null, updatedAt };
      }
      if (table === 'liturgia_elementos' && ctl.elementosUpsertError) {
        return { error: ctl.elementosUpsertError, updatedAt: null };
      }
      return { error: null, updatedAt: nextUpdatedAt() };
    };
    const promise = run();
    const rowResult = async () => {
      const r = await promise;
      if (r.error) return { data: null, error: r.error };
      return {
        data: {
          updated_at: r.updatedAt,
          // `saveLiturgy` lee `liturgiaData.id` del RETURNING del upsert de
          // `liturgias`; sin `id` el path final quedaría `liturgias/undefined/…`.
          id: (payload as Record<string, unknown>)['id'] ?? 'lit-pb',
        },
        error: null,
      };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        promise.then((r) => ({ error: r.error })).then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  /**
   * DELETE con filtros EVALUADOS contra la fila simulada. Es lo que convierte
   * "0 filas" en una consecuencia del compare-and-delete real.
   */
  const makeDeleteChain = (table: string) => {
    const filters: Record<string, string> = {};
    const run = () => {
      if (table !== 'cuentacuentos_drafts') {
        deletes.push({ seq: nextSeq(), table, filters: { ...filters }, deleted: 0 });
        return { error: null, data: [] as unknown[] };
      }
      const row = sim.row;
      let matches = row !== null;
      if (row) {
        for (const [col, val] of Object.entries(filters)) {
          if (col === 'liturgia_id' && row.liturgia_id !== val) matches = false;
          else if (col === 'user_id' && row.user_id !== val) matches = false;
          else if (col === 'story->>id' && row.story_id !== val) matches = false;
          else if (col === 'updated_at' && row.updated_at !== val) matches = false;
        }
      }
      const deleted = matches ? 1 : 0;
      if (matches) sim.row = null;
      deletes.push({ seq: nextSeq(), table, filters: { ...filters }, deleted });
      return { error: null, data: matches ? [{ id: 'row-1' }] : [] };
    };
    const chain = {
      eq: (col: string, val: unknown) => {
        filters[col] = String(val);
        return chain;
      },
      not: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(run()).then(res as never, rej as never),
      }),
    };
    return chain as unknown as Thenable & {
      eq: (c: string, v: unknown) => unknown;
      not: () => unknown;
      select: () => Thenable;
    };
  };

  const tableApi = (table: string) => ({
    select: (..._args: unknown[]) => tableApi(table) as unknown,
    eq: (..._args: unknown[]) => tableApi(table) as unknown,
    order: (..._args: unknown[]) => tableApi(table) as unknown,
    limit: (..._args: unknown[]) => tableApi(table) as unknown,
    insert: (..._args: unknown[]) => Promise.resolve({ error: null, data: null }),
    update: (..._args: unknown[]) => tableApi(table) as unknown,
    maybeSingle: async () => {
      if (table === 'cuentacuentos_drafts') {
        if (ctl.selectError) return { data: null, error: ctl.selectError };
        // Una fila borrada por el compare-and-delete deja de verse en la
        // recarga: sin esto, "el prompt no vuelve" sólo probaría la
        // contabilidad del propio test.
        if (ctl.draftRow) {
          return { data: sim.row === null && simWasSeeded ? null : ctl.draftRow, error: null };
        }
        return {
          data: ctl.existingImagePaths ? { image_paths: ctl.existingImagePaths } : null,
          error: null,
        };
      }
      if (table === 'liturgias') return { data: { id: 'lit-pb' }, error: null };
      return { data: null, error: null };
    },
    single: async () => {
      if (table === 'liturgias') return { data: { id: 'lit-pb' }, error: null };
      return { data: null, error: null };
    },
    upsert: (payload: Record<string, unknown>) => upsertBuilder(table, payload),
    delete: () => makeDeleteChain(table),
  });

  const storageApi = (bucket: string) => ({
    upload: async (p: string, blob: Blob, opts?: { contentType?: string; upsert?: boolean }) => {
      const size = blob?.size ?? 0;
      uploads.push({ seq: nextSeq(), bucket, path: p, contentType: opts?.contentType, upsert: opts?.upsert, size });
      if (ctl.failAllUploads) {
        return { data: null, error: storageError('Storage falló', '500') };
      }
      if (ctl.failUploadWhenPathIncludes && p.includes(ctl.failUploadWhenPathIncludes)) {
        return { data: null, error: storageError('Storage falló', '500') };
      }
      if (ctl.failUploadWhenSize !== null && size === ctl.failUploadWhenSize) {
        return { data: null, error: storageError('Storage falló', '500') };
      }
      if (
        ctl.duplicateLikeMessageWhenPathIncludes &&
        p.includes(ctl.duplicateLikeMessageWhenPathIncludes)
      ) {
        return { data: null, error: storageError('The resource already exists', '500') };
      }
      if (ctl.duplicateLikeMessageWhenSize !== null && size === ctl.duplicateLikeMessageWhenSize) {
        // Mensaje idéntico al del duplicado, pero statusCode 500: un
        // clasificador por TEXTO lo aceptaría; el estructural debe rechazarlo.
        return { data: null, error: storageError('The resource already exists', '500') };
      }
      if (ctl.conflictOnRepeatPath && createdPaths.has(`${bucket}/${p}`)) {
        // Semántica REAL de `upsert:false`: el objeto ya existe.
        return {
          data: null,
          error: storageError(
            'The resource already exists',
            ctl.repeatPathUsesNon409 ? '500' : '409'
          ),
        };
      }
      if (ctl.duplicateWhenPathIncludes && p.includes(ctl.duplicateWhenPathIncludes)) {
        return { data: null, error: storageError('The resource already exists', '409') };
      }
      if (ctl.duplicateWhenSize !== null && size === ctl.duplicateWhenSize) {
        return { data: null, error: storageError('The resource already exists', '409') };
      }
      createdPaths.add(`${bucket}/${p}`);
      return { data: { path: p }, error: null };
    },
    getPublicUrl: (p: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${p}` },
    }),
    remove: async (paths: string[]) => {
      removals.push({ seq: nextSeq(), bucket, paths: [...paths] });
      return { error: null };
    },
    list: async (_dir: string, opts?: { search?: string }) => ({
      data: ctl.listFindsFile && opts?.search ? [{ name: opts.search }] : [],
      error: null,
    }),
    download: async () => ({ data: null, error: null }),
  });

  return {
    from: (t: string) => tableApi(t),
    storage: { from: (b: string) => storageApi(b) },
    functions: {
      invoke: async () => ctl.invokeResponse,
    },
    auth: {
      getUser: async () => ({ data: { user: ctl.userId ? { id: ctl.userId } : null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: null, error: null }),
      signIn: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}

/** Siembra la fila simulada junto con la fila que devuelve la lectura. */
export function seedDraftRow(row: {
  liturgia_id: string;
  user_id: string;
  story_id: string | null;
  updated_at: string;
  full: Record<string, unknown>;
}): void {
  sim.row = {
    liturgia_id: row.liturgia_id,
    user_id: row.user_id,
    story_id: row.story_id,
    updated_at: row.updated_at,
  };
  ctl.draftRow = row.full;
  simWasSeeded = true;
}
