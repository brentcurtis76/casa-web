/**
 * fetch-bible-passage — request handler.
 *
 * Fetches a Bible passage from Bolls.life (free, Spanish translations) for the
 * three browser workflows that need one:
 *   - the presenter's Bible-verse slide creator      → presenter / read
 *   - the liturgy builder's readings panel           → liturgy_builder / write
 *   - the antiphonal-prayers generator's reading form → oraciones / write
 *
 * Auth model (Codex publishable-key review): the project's publishable key
 * authenticates the app at the gateway, never a user. This handler therefore
 * requires a genuine user JWT itself — authenticated exactly once — and then
 * authorizes a caller holding AT LEAST ONE of the three permissions above
 * (`requireAnyPermission`). Both run BEFORE the request body is read and before
 * Bolls.life is contacted. Missing, anon, service_role and publishable-key
 * bearers are refused with 401; a signed-in user with none of the permissions
 * gets 403; an undeterminable decision fails closed with 503.
 *
 * Request hygiene: POST only; reference/version validated and bounded; the
 * provider response shape-checked. Both the request body and the provider reply
 * are bounded by STREAMING caps (`_shared/boundedBody.ts`) that cancel the
 * stream at the chunk which crosses the cap — so neither an oversized upload
 * nor an oversized (or hostile) provider reply is ever materialised in full,
 * and neither is decoded or parsed. Logs never carry the submitted reference,
 * the returned text, provider bodies, or exception details.
 *
 * Extracted from `index.ts` so tests can import it without a Supabase client,
 * the environment, a server, or the network. `index.ts` wires production deps.
 */

import { readBoundedJson } from "../_shared/boundedBody.ts";
import {
  type PermissionAlternative,
  requireAnyPermission,
  type RequirePermissionDeps,
} from "../_shared/liturgyAuth.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Any ONE of these authorizes the call. Order matters only for short-circuiting.
 * Mirrors the route guards of the three callers (src/appRoutes.tsx).
 */
export const BIBLE_PASSAGE_PERMISSIONS: readonly PermissionAlternative[] = [
  { resource: "presenter", action: "read" }, // BibleVerseCreator (SlideCreatorModal, /presenter)
  { resource: "liturgy_builder", action: "write" }, // ContextoTransversal (/admin/liturgia/constructor)
  { resource: "oraciones", action: "write" }, // BiblePassageFetcher (LiturgiaForm, /admin/liturgia/oraciones)
];

export const MAX_BODY_BYTES = 2048;
export const MAX_REFERENCE_CHARS = 100;
export const MAX_VERSION_CHARS = 16;
/** Psalms has 150 chapters; Psalm 119 has 176 verses. */
export const MAX_CHAPTER = 150;
export const MAX_VERSE = 176;
export const PROVIDER_TIMEOUT_MS = 10_000;
/** A whole chapter is a few tens of KB; anything near this is not a chapter. */
export const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;
export const BOLLS_BASE_URL = "https://bolls.life/get-text";
export const DEFAULT_VERSION = "NVI";

// Versiones de la Biblia en español disponibles en Bolls.life
export const BIBLE_VERSIONS: Record<string, { id: string; name: string }> = {
  "NVI": { id: "NVI", name: "Nueva Versión Internacional" },
  "RV1960": { id: "RV1960", name: "Reina-Valera 1960" },
  "LBLA": { id: "LBLA", name: "La Biblia de las Américas" },
  "NTV": { id: "NTV", name: "Nueva Traducción Viviente" },
  "PDT": { id: "PDT", name: "Palabra de Dios para Todos" },
  "RVG": { id: "RV2004", name: "Reina Valera Gómez 2004" },
  "BTX": { id: "BTX3", name: "La Biblia Textual" },
};

// Mapeo de nombres de libros en español a IDs de Bolls.life (1-39 AT, 40-66 NT)
const BOOK_IDS: Record<string, number> = {
  // Antiguo Testamento
  "genesis": 1, "génesis": 1, "gn": 1, "gen": 1,
  "exodo": 2, "éxodo": 2, "ex": 2,
  "levitico": 3, "levítico": 3, "lv": 3, "lev": 3,
  "numeros": 4, "números": 4, "nm": 4, "num": 4,
  "deuteronomio": 5, "dt": 5, "deu": 5,
  "josue": 6, "josué": 6, "jos": 6,
  "jueces": 7, "jue": 7,
  "rut": 8, "rt": 8,
  "1 samuel": 9, "1samuel": 9, "1 sam": 9, "1sam": 9,
  "2 samuel": 10, "2samuel": 10, "2 sam": 10, "2sam": 10,
  "1 reyes": 11, "1reyes": 11, "1 re": 11, "1re": 11,
  "2 reyes": 12, "2reyes": 12, "2 re": 12, "2re": 12,
  "1 cronicas": 13, "1crónicas": 13, "1 cr": 13, "1cr": 13,
  "2 cronicas": 14, "2crónicas": 14, "2 cr": 14, "2cr": 14,
  "esdras": 15, "esd": 15,
  "nehemias": 16, "nehemías": 16, "neh": 16,
  "ester": 17, "est": 17,
  "job": 18,
  "salmos": 19, "salmo": 19, "sal": 19, "sl": 19,
  "proverbios": 20, "pr": 20, "pro": 20,
  "eclesiastes": 21, "eclesiastés": 21, "ec": 21,
  "cantares": 22, "cantar de los cantares": 22, "cnt": 22,
  "isaias": 23, "isaías": 23, "is": 23,
  "jeremias": 24, "jeremías": 24, "jer": 24,
  "lamentaciones": 25, "lam": 25,
  "ezequiel": 26, "ez": 26,
  "daniel": 27, "dn": 27, "dan": 27,
  "oseas": 28, "os": 28,
  "joel": 29, "jl": 29,
  "amos": 30, "amós": 30, "am": 30,
  "abdias": 31, "abdías": 31, "abd": 31,
  "jonas": 32, "jonás": 32, "jon": 32,
  "miqueas": 33, "mi": 33,
  "nahum": 34, "nah": 34,
  "habacuc": 35, "hab": 35,
  "sofonias": 36, "sofonías": 36, "sof": 36,
  "hageo": 37, "hag": 37,
  "zacarias": 38, "zacarías": 38, "zac": 38,
  "malaquias": 39, "malaquías": 39, "mal": 39,

  // Nuevo Testamento
  "mateo": 40, "mt": 40, "mat": 40,
  "marcos": 41, "mc": 41, "mr": 41,
  "lucas": 42, "lc": 42, "luk": 42,
  "juan": 43, "jn": 43, "jhn": 43,
  "hechos": 44, "hch": 44, "hec": 44,
  "romanos": 45, "ro": 45, "rom": 45,
  "1 corintios": 46, "1corintios": 46, "1 cor": 46, "1cor": 46,
  "2 corintios": 47, "2corintios": 47, "2 cor": 47, "2cor": 47,
  "galatas": 48, "gálatas": 48, "ga": 48, "gal": 48,
  "efesios": 49, "ef": 49,
  "filipenses": 50, "fil": 50, "flp": 50,
  "colosenses": 51, "col": 51,
  "1 tesalonicenses": 52, "1tesalonicenses": 52, "1 ts": 52, "1ts": 52,
  "2 tesalonicenses": 53, "2tesalonicenses": 53, "2 ts": 53, "2ts": 53,
  "1 timoteo": 54, "1timoteo": 54, "1 tim": 54, "1tim": 54,
  "2 timoteo": 55, "2timoteo": 55, "2 tim": 55, "2tim": 55,
  "tito": 56, "tit": 56,
  "filemon": 57, "filemón": 57, "flm": 57,
  "hebreos": 58, "heb": 58, "he": 58,
  "santiago": 59, "stg": 59,
  "1 pedro": 60, "1pedro": 60, "1 pe": 60, "1pe": 60,
  "2 pedro": 61, "2pedro": 61, "2 pe": 61, "2pe": 61,
  "1 juan": 62, "1juan": 62, "1 jn": 62, "1jn": 62,
  "2 juan": 63, "2juan": 63, "2 jn": 63, "2jn": 63,
  "3 juan": 64, "3juan": 64, "3 jn": 64, "3jn": 64,
  "judas": 65, "jud": 65,
  "apocalipsis": 66, "ap": 66, "apoc": 66, "rev": 66,
};

// Nombres de libros para mostrar
const BOOK_NAMES: Record<number, string> = {
  1: "Génesis", 2: "Éxodo", 3: "Levítico", 4: "Números",
  5: "Deuteronomio", 6: "Josué", 7: "Jueces", 8: "Rut",
  9: "1 Samuel", 10: "2 Samuel", 11: "1 Reyes", 12: "2 Reyes",
  13: "1 Crónicas", 14: "2 Crónicas", 15: "Esdras", 16: "Nehemías",
  17: "Ester", 18: "Job", 19: "Salmos", 20: "Proverbios",
  21: "Eclesiastés", 22: "Cantares", 23: "Isaías", 24: "Jeremías",
  25: "Lamentaciones", 26: "Ezequiel", 27: "Daniel", 28: "Oseas",
  29: "Joel", 30: "Amós", 31: "Abdías", 32: "Jonás",
  33: "Miqueas", 34: "Nahúm", 35: "Habacuc", 36: "Sofonías",
  37: "Hageo", 38: "Zacarías", 39: "Malaquías",
  40: "Mateo", 41: "Marcos", 42: "Lucas", 43: "Juan",
  44: "Hechos", 45: "Romanos", 46: "1 Corintios", 47: "2 Corintios",
  48: "Gálatas", 49: "Efesios", 50: "Filipenses", 51: "Colosenses",
  52: "1 Tesalonicenses", 53: "2 Tesalonicenses", 54: "1 Timoteo",
  55: "2 Timoteo", 56: "Tito", 57: "Filemón", 58: "Hebreos",
  59: "Santiago", 60: "1 Pedro", 61: "2 Pedro", 62: "1 Juan",
  63: "2 Juan", 64: "3 Juan", 65: "Judas", 66: "Apocalipsis",
};

export interface ParsedReference {
  bookId: number;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}

/**
 * Parsea una referencia bíblica en español y la acota a rangos plausibles.
 * Ejemplos: "Juan 3:16", "Juan 3:16-21", "Salmo 23", "1 Corintios 13:1-13".
 * Devuelve `null` para cualquier cosa que no sea una referencia válida.
 */
export function parseReference(reference: string): ParsedReference | null {
  const normalized = reference.trim().toLowerCase();

  const patterns = [
    /^(.+?)\s+(\d{1,3}):(\d{1,3})-(\d{1,3})$/, // "Juan 3:16-21"
    /^(.+?)\s+(\d{1,3}):(\d{1,3})$/, // "Juan 3:16"
    /^(.+?)\s+(\d{1,3})$/, // "Salmo 23"
  ];

  const inRange = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max;

  for (let i = 0; i < patterns.length; i++) {
    const match = normalized.match(patterns[i]);
    if (!match) continue;

    const bookId = BOOK_IDS[match[1].trim()];
    if (!bookId) continue;

    const chapter = parseInt(match[2], 10);
    if (!inRange(chapter, MAX_CHAPTER)) return null;

    if (i === 2) {
      return { bookId, chapter };
    }

    const startVerse = parseInt(match[3], 10);
    const endVerse = i === 0 ? parseInt(match[4], 10) : startVerse;
    if (!inRange(startVerse, MAX_VERSE) || !inRange(endVerse, MAX_VERSE)) return null;
    if (endVerse < startVerse) return null;
    return { bookId, chapter, startVerse, endVerse };
  }

  return null;
}

export interface HandlerDeps {
  authzDeps: RequirePermissionDeps;
  /** Provider transport; defaults to the global fetch. Injected in tests. */
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
}

interface PassagePayload {
  reference?: unknown;
  version?: unknown;
}

interface ProviderVerse {
  verse: number;
  text: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isProviderVerse(value: unknown): value is ProviderVerse {
  return !!value && typeof value === "object" &&
    typeof (value as { verse?: unknown }).verse === "number" &&
    typeof (value as { text?: unknown }).text === "string";
}

/** Resolves the requested version, falling back to NVI as the original did. */
function resolveVersion(raw: unknown): { code: string; id: string; name: string } | null {
  if (raw === undefined || raw === null || raw === "") {
    return { code: DEFAULT_VERSION, ...BIBLE_VERSIONS[DEFAULT_VERSION] };
  }
  if (typeof raw !== "string" || raw.length > MAX_VERSION_CHARS) return null;
  const known = BIBLE_VERSIONS[raw];
  if (known) return { code: raw, ...known };
  return { code: DEFAULT_VERSION, ...BIBLE_VERSIONS[DEFAULT_VERSION] };
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? ((url: string, init: RequestInit) => fetch(url, init));

  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ success: false, error: "Método no permitido" }, 405);
    }

    // 1. Authentication (once) + any-of authorization — BEFORE the body and the provider.
    const authz = await requireAnyPermission(req, deps.authzDeps, {
      anyOf: BIBLE_PASSAGE_PERMISSIONS,
      corsHeaders,
    });
    if (!authz.ok) {
      return authz.response;
    }

    // 2. Bounded, validated request. MAX_BODY_BYTES is enforced by the read:
    // the stream is cancelled at the chunk that crosses it, and nothing past
    // that point is pulled, decoded or parsed — so no request can buy provider
    // work, or isolate memory, by arriving chunked or headerless.
    const requestBody = await readBoundedJson(req, MAX_BODY_BYTES);
    if (!requestBody.ok) {
      return requestBody.reason === "too_large"
        ? json({ success: false, error: "Solicitud demasiado grande" }, 413)
        : json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    const rawBody = requestBody.value;
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return json({ success: false, error: "Cuerpo de la solicitud inválido" }, 400);
    }
    const payload = rawBody as PassagePayload;

    const reference = typeof payload.reference === "string" ? payload.reference.trim() : "";
    if (!reference) {
      return json({ success: false, error: "Se requiere una referencia bíblica" }, 400);
    }
    if (reference.length > MAX_REFERENCE_CHARS) {
      return json({ success: false, error: "La referencia es demasiado larga" }, 400);
    }
    const version = resolveVersion(payload.version);
    if (!version) {
      return json({ success: false, error: "Versión de la Biblia inválida" }, 400);
    }
    const parsed = parseReference(reference);
    if (!parsed) {
      return json(
        { success: false, error: 'No se pudo interpretar la referencia. Usa formato como "Juan 3:16" o "Salmo 23"' },
        400,
      );
    }

    // Log hygiene: the reference itself is never logged.
    console.log("[fetch-bible-passage] solicitud autorizada");

    // 3. Provider call — bounded by a timeout and a response-size cap.
    const apiUrl = `${BOLLS_BASE_URL}/${version.id}/${parsed.bookId}/${parsed.chapter}/`;
    let response: Response;
    try {
      response = await fetchImpl(apiUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      console.error("[fetch-bible-passage] no se pudo contactar al proveedor");
      return json({ success: false, error: "No se pudo obtener el pasaje bíblico" }, 502);
    }

    if (!response.ok) {
      console.error(`[fetch-bible-passage] el proveedor respondió ${response.status}`);
      await response.body?.cancel().catch(() => {});
      if (response.status === 404) {
        return json({ success: false, error: "Capítulo no encontrado. Verifica que la cita sea correcta." }, 404);
      }
      return json({ success: false, error: "Error del proveedor de pasajes bíblicos" }, 502);
    }

    // The provider is untrusted: MAX_PROVIDER_RESPONSE_BYTES cuts the download
    // at the chunk that crosses it rather than after the fact, so a reply that
    // never ends (or lies about its length) costs a bounded amount of memory.
    // Over-limit, interrupted, malformed and wrongly-shaped replies collapse to
    // one value-suppressed 502 — the reason is never echoed or logged.
    const provider = await readBoundedJson(response, MAX_PROVIDER_RESPONSE_BYTES);
    if (
      !provider.ok || !Array.isArray(provider.value) || provider.value.length === 0 ||
      !provider.value.every(isProviderVerse)
    ) {
      console.error("[fetch-bible-passage] respuesta del proveedor inválida");
      return json({ success: false, error: "La API no retornó contenido válido para este capítulo" }, 502);
    }
    let verses = provider.value as ProviderVerse[];

    if (parsed.startVerse !== undefined && parsed.endVerse !== undefined) {
      const { startVerse, endVerse } = parsed;
      verses = verses.filter((v) => v.verse >= startVerse && v.verse <= endVerse);
    }
    if (verses.length === 0) {
      return json({ success: false, error: "No se encontraron versículos en el rango especificado" }, 400);
    }

    const text = verses.map((v) => `${v.verse} ${v.text.trim()}`).join(" ");

    const bookName = BOOK_NAMES[parsed.bookId] || `Libro ${parsed.bookId}`;
    let displayReference = `${bookName} ${parsed.chapter}`;
    if (parsed.startVerse !== undefined) {
      displayReference += `:${parsed.startVerse}`;
      if (parsed.endVerse !== undefined && parsed.endVerse !== parsed.startVerse) {
        displayReference += `-${parsed.endVerse}`;
      }
    }

    return json({
      success: true,
      text,
      reference: displayReference,
      version: version.name,
      versionCode: version.code,
    }, 200);
  };
}
