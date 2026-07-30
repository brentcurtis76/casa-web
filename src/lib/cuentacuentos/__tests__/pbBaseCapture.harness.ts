/**
 * PB / G6 — infraestructura compartida de la CAPTURA de comportamiento base y
 * de su COMPARADOR.
 *
 * Contrato (D5 + G6):
 *  - La captura se produce con los archivos de producción BYTE-IDÉNTICOS a
 *    `cc-downscale-a`@185c370. El fixture resultante
 *    (`pb_fe_base_185c370.json`) es READ-ONLY desde su commit: NUNCA se
 *    regenera para poner en verde una comparación.
 *  - El comparador post-cambio exige igualdad en TODO campo salvo las
 *    divergencias declaradas explícitamente en `divergences.ts`, cada una
 *    case-local y con {viejo, nuevo, razón}. Cualquier otra diferencia es un
 *    FINDING.
 *
 * Este módulo NO importa producción ni mocks: sólo normaliza y compara. El
 * archivo de test es quien monta los mocks de borde (vi.mock se iza por
 * archivo) y ejerce el código de producción.
 */

/** Una llamada al borde de Storage, tal como la emite producción. */
export interface UploadCall {
  bucket: string;
  path: string;
  contentType: string | undefined;
  upsert: boolean | undefined;
}

/** Un upsert a una tabla, reducido a lo que la fase observa. */
export interface UpsertCall {
  table: string;
  imagePaths?: unknown;
  /** true si el JSON persistido contiene base64 crudo o data URL. */
  persistedJsonHasInlineImage?: boolean;
  /** Sólo para `liturgia_elementos`: URLs del story del elemento. */
  elementStoryImageRefs?: unknown;
}

/** Registro determinista de un caso. */
export interface CaseRecord {
  id: string;
  /** 'resolved' | 'rejected' */
  outcome: string;
  /** Mensaje de error normalizado, o null. */
  error: string | null;
  uploads: UploadCall[];
  upserts: UpsertCall[];
  /** Salida observable adicional del caso (uploadedUrls, swap, UI, …). */
  observed: Record<string, unknown>;
}

export interface CaptureFixture {
  /** SHA de la base cuyo comportamiento se capturó. */
  base: string;
  /** Metadatos de runtime; informativos, EXCLUIDOS de la comparación. */
  runtime: Record<string, unknown>;
  cases: Record<string, CaseRecord>;
}

/**
 * Normaliza valores no deterministas para que la comparación sea estable:
 *  - timestamps ISO → '<ISO>'
 *  - cache-busting `?t=<epoch>` → '?t=<EPOCH>'
 *  - `updated_at` sintéticos del mock → '<UPDATED_AT>'
 *
 * NO toca paths, buckets, flags de upsert ni contentType: ésos son justamente
 * el objeto de la comparación.
 */
export function normalizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, '<ISO>')
      .replace(/\?t=\d+/g, '?t=<EPOCH>') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeValue(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = normalizeValue((value as Record<string, unknown>)[key]);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Detecta una referencia de imagen "inflable" (base64 crudo o data URL) dentro
 * de un árbol JSON. Es la invariante A3 que PB debe seguir preservando.
 */
export function treeHasInlineImage(node: unknown): boolean {
  if (typeof node === 'string') {
    if (node.startsWith('data:')) return true;
    // base64 crudo: largo y sin separadores de path/URL.
    if (node.length > 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(node)) return true;
    return false;
  }
  if (Array.isArray(node)) return node.some(treeHasInlineImage);
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).some(treeHasInlineImage);
  }
  return false;
}

/** Acceso por path con puntos: `observed.uploadedUrls.coverUrls`. */
export function getPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Borra por path con puntos; deja el resto intacto. */
export function deletePath(root: unknown, path: string): void {
  const segs = path.split('.');
  const last = segs.pop() as string;
  let cur: unknown = root;
  for (const seg of segs) {
    if (cur === null || cur === undefined) return;
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (cur && typeof cur === 'object') {
    delete (cur as Record<string, unknown>)[last];
  }
}
