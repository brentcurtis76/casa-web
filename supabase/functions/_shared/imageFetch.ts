/**
 * FASE F — one safe image normalizer/downloader for both paid cuentacuentos
 * edge functions (`generate-scene-images`, `generate-story`).
 *
 * Implements plan invariant 11 plus addendum A8a:
 *
 *   * A bounded body reader that runs BEFORE `JSON.parse`, so a giant payload
 *     cannot OOM the isolate.
 *   * Two-pass prevalidation. Pass 1 walks EVERY nested image field in the
 *     request and validates each entry — including sizing and sniffing inline
 *     base64/data-URLs (A8a). Only if pass 1 raises nothing fatal does pass 2
 *     fetch anything. A single untrusted entry means zero Storage fetches and
 *     zero provider calls for the whole request.
 *   * URL entries are pinned to the exact public bucket: HTTPS only, no
 *     credentials, no fragment, no encoded separators, exact
 *     `${SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts/` prefix.
 *   * Pass-2 fetches use `redirect: 'error'`, a 20s timeout, a streaming
 *     cut-off at the per-image cap (the reader is cancelled — there is no
 *     post-`arrayBuffer()` check to overshoot), and decide MIME from magic
 *     bytes, never from `Content-Type`.
 *
 * Nothing here logs a URL, a query string, or a base64 prefix.
 *
 * ## Fatal vs skippable — the degradation policy
 *
 * Rejecting a whole request is right for *provenance and resource* failures
 * and wrong for everything else. The pre-FASE-F code returned '' from a failed
 * image and carried on, and the editor depends on that: it sends bucket URLs
 * that may 404 after a draft is edited, photos in whatever format the phone
 * produced, and an unbounded number of references.
 *
 *   * **Fatal** (422/413, whole request): every provenance check, the body
 *     cap, the per-image inline cap, the inline aggregate budget, and the
 *     absolute request ceiling. These are the security and memory guarantees;
 *     degrading them would defeat the invariant.
 *   * **Skippable** (that one entry is dropped, the request proceeds): a
 *     format we cannot sniff, a malformed entry, and EVERY pass-2 outcome —
 *     404, timeout, refused redirect, oversized download. The protection has
 *     already happened by then; failing the whole generation on top of it just
 *     loses the user their work.
 *
 * Callers get the dropped entries back in `skipped` so they can report them.
 * `generate-scene-images` overrides this for `refine.sourceImage` only, where
 * invariant 11 requires fail-closed.
 *
 * ## On "decoding" inline inputs (A8a)
 *
 * A8a asks for inline inputs to be decoded and validated before the first URL
 * fetch. This module gets the same guarantee without ever materialising the
 * whole byte array: base64 decoded length is an exact function of the encoded
 * length and padding, and the magic-byte sniff only needs the first few bytes.
 * So an oversized inline input is rejected from its length alone (T-F.10) and
 * the aggregate budget is charged exact decoded byte counts (T-F.14) — with a
 * bounded amount of work per entry, which is the point of the invariant.
 */

export interface ImageLimits {
  /** Global request-body cap enforced before `JSON.parse`. Over => 413. */
  maxBodyBytes: number;
  /** Decoded-byte cap for a single image. Over => 413 inline, skip on fetch. */
  maxImageBytes: number;
  /**
   * Aggregate decoded-byte budget across every image in one request (A8a).
   * Inline over budget => 413; a fetch that would exceed it is skipped.
   */
  maxTotalImageBytes: number;
  /**
   * Entries accepted in one nested image field — that is, per array instance
   * (`landmarks[0].referenceImages`), not per field shape. Extra entries are
   * dropped, not rejected: the pre-FASE-F handlers sliced these arrays and the
   * editor still sends more than it consumes.
   */
  maxImagesPerField: number;
  /**
   * Ceiling on the images a request will actually MATERIALISE. A denial-of-
   * service guard, deliberately far above anything the editor produces — the
   * semantic 12-reference cap is enforced by the handlers' own trim logic,
   * which knows the priority order (style ref, then props, then landmarks,
   * then characters) that this module does not. Over => 422.
   *
   * Counted over consumed entries only. Counting raw slots rejected requests
   * whose surplus the handlers would have sliced off untouched — a draft that
   * accumulated prop photos over months has plenty of entries nothing reads.
   */
  maxImagesPerRequest: number;
  /**
   * Hard bound on how many entries pass 1 will walk at all, consumed or not.
   * Pass-1 work per entry is small but not free (a URL parse), so this keeps
   * a pathological payload from turning the body cap into CPU. Over => 422.
   */
  maxImageSlots: number;
  /** Pass-2 fetch timeout. */
  fetchTimeoutMs: number;
  /** Concurrent pass-2 downloads. */
  fetchConcurrency: number;
}

/**
 * Production limits.
 *
 * `maxTotalImageBytes` is deliberately below what `maxBodyBytes` permits in
 * inline form (base64 inflates by 4/3, so a 20 MB body decodes to at most
 * ~15 MB): if the aggregate sat above that ceiling it could never be reached
 * by inline input and A8a's rule would be dead code. 14 MB also tracks the
 * provider's own inline-data request ceiling — a larger payload would be
 * rejected by Gemini anyway, after we had already paid to assemble it.
 *
 * `maxImagesPerRequest` is a DoS ceiling, NOT the 12-reference cap. Setting it
 * to 12 made the handlers' trim logic unreachable and rejected ordinary
 * payloads (a cover for a five-character story), which is the opposite of what
 * the trim was written to do.
 */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = {
  maxBodyBytes: 20_000_000,
  maxImageBytes: 6_000_000,
  maxTotalImageBytes: 14_000_000,
  maxImagesPerField: 4,
  maxImagesPerRequest: 64,
  maxImageSlots: 512,
  fetchTimeoutMs: 20_000,
  fetchConcurrency: 4,
};

/** The one bucket these functions are allowed to read from. */
export const DRAFTS_BUCKET_PATH = "/storage/v1/object/public/cuentacuentos-drafts/";

/**
 * Storage path prefixes accepted on the pinned origin. Both address the SAME
 * bucket — origin and bucket stay pinned either way.
 *
 * `object/sign/` is here because drafts written before 2026-01-11 stored
 * signed `characterSheetUrl`s. Those tokens are long expired, so the object
 * 404s and the entry is skipped — but treating the URL shape itself as
 * forbidden made one stale character sheet a fatal 422 for every later
 * generation on that story, with no way for the user to clear it.
 */
const ACCEPTED_BUCKET_PATHS = [
  DRAFTS_BUCKET_PATH,
  "/storage/v1/object/sign/cuentacuentos-drafts/",
];

export type ImageRefFailureCode =
  // 413 — size
  | "BODY_TOO_LARGE"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_BUDGET_EXCEEDED"
  // 422 — shape / provenance (client input)
  | "TOO_MANY_IMAGES"
  | "MALFORMED_URL"
  | "INSECURE_SCHEME"
  | "URL_CREDENTIALS"
  | "URL_FRAGMENT"
  | "FORBIDDEN_ORIGIN"
  | "FORBIDDEN_BUCKET"
  | "INVALID_IMAGE_REF"
  | "NOT_IMAGE"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "REDIRECT_REFUSED"
  | "REFINE_SOURCE_UNAVAILABLE"
  /** Dropped because the handler had no slot for it, not because it was bad. */
  | "NOT_USED";

const STATUS_BY_CODE: Record<ImageRefFailureCode, number> = {
  BODY_TOO_LARGE: 413,
  IMAGE_TOO_LARGE: 413,
  IMAGE_BUDGET_EXCEEDED: 413,
  TOO_MANY_IMAGES: 422,
  MALFORMED_URL: 422,
  INSECURE_SCHEME: 422,
  URL_CREDENTIALS: 422,
  URL_FRAGMENT: 422,
  FORBIDDEN_ORIGIN: 422,
  FORBIDDEN_BUCKET: 422,
  INVALID_IMAGE_REF: 422,
  NOT_IMAGE: 422,
  FETCH_FAILED: 422,
  FETCH_TIMEOUT: 422,
  REDIRECT_REFUSED: 422,
  REFINE_SOURCE_UNAVAILABLE: 422,
  NOT_USED: 422,
};

/**
 * Pass-1 outcomes that drop a single entry instead of failing the request.
 * Everything else in pass 1 is a provenance or resource guarantee and is
 * fatal. Every pass-2 outcome is skippable regardless of code.
 */
const PASS1_SKIPPABLE: ReadonlySet<ImageRefFailureCode> = new Set<ImageRefFailureCode>([
  "NOT_IMAGE",
  "INVALID_IMAGE_REF",
]);

/**
 * Codes meaning "the object could not be produced". Only these are worth
 * restating as REFINE_SOURCE_UNAVAILABLE.
 *
 * `NOT_IMAGE` and `INVALID_IMAGE_REF` are deliberately NOT here: they say
 * something specific and actionable about the payload ("that HEIC is not a
 * format we can use"), and folding them into "unavailable" sent the user off
 * to check whether their image still existed.
 */
export const UNAVAILABLE_CODES: ReadonlySet<ImageRefFailureCode> = new Set<ImageRefFailureCode>([
  "FETCH_FAILED",
  "FETCH_TIMEOUT",
  "REDIRECT_REFUSED",
]);

/**
 * A typed rejection. Handlers map these straight to a Response; they never
 * reach the top-level catch (which would turn them into a 500).
 */
export class ImageRefError extends Error {
  readonly code: ImageRefFailureCode;
  readonly status: number;
  /** Redacted field path, e.g. `characters[2].referenceImage`. Never a URL. */
  readonly path: string;
  /**
   * Bytes already pulled off the wire when this failed. A cut-off download has
   * spent its reservation even though it produced nothing, so the aggregate
   * budget must be charged for them — refunding the whole reservation let a
   * stream of oversized objects consume several times the budget.
   */
  readonly bytesRead: number;

  constructor(
    code: ImageRefFailureCode,
    path: string,
    message?: string,
    bytesRead = 0,
  ) {
    super(message ?? `${code} at ${path}`);
    this.name = "ImageRefError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.path = path;
    this.bytesRead = bytesRead;
  }
}

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/** One image entry found in the request, before validation. */
export interface ImageRefSlot {
  /** Redacted field path used in errors and logs. */
  path: string;
  value: unknown;
  /**
   * Whether the handler will actually use this entry. Everything is validated
   * (a forbidden URL must be caught wherever it hides), but only consumed
   * entries are downloaded — the collectors mirror each handler's own slicing,
   * so we no longer fetch, base64-encode and budget-charge images that are
   * discarded moments later.
   */
  consumed: boolean;
}

export type ValidatedImageRef =
  | {
    kind: "inline";
    path: string;
    consumed: boolean;
    /** Raw base64 payload, data-URL prefix already stripped. */
    base64: string;
    mimeType: ImageMime;
    byteLength: number;
  }
  | {
    kind: "url";
    path: string;
    consumed: boolean;
    url: URL;
  };

export interface MaterializedImage {
  path: string;
  base64: string;
  mimeType: ImageMime;
  byteLength: number;
}

/** An entry that was dropped rather than failing the request. */
export interface SkippedImage {
  path: string;
  code: ImageRefFailureCode;
}

// ---------------------------------------------------------------------------
// Bounded body reader
// ---------------------------------------------------------------------------

/**
 * Streams the request body with a hard cap and only then parses it. Over the
 * cap the stream is cancelled and `BODY_TOO_LARGE` (413) is thrown — the
 * bytes past the cap are never buffered and `JSON.parse` never runs.
 *
 * The `content-length` header is honoured as a cheap early exit but is NOT
 * trusted as the only check: a chunked upload can omit or understate it.
 *
 * Transport-level failures (a client that disconnects mid-upload) are
 * converted to `ImageRefError` too, so the handler's typed-error path handles
 * them instead of a raw `TypeError` escaping into a CORS-less 500.
 */
export async function readBoundedJson(
  req: Request,
  limits: ImageLimits = DEFAULT_IMAGE_LIMITS,
): Promise<unknown> {
  const tooLarge = () =>
    new ImageRefError(
      "BODY_TOO_LARGE",
      "body",
      `La petición es demasiado grande (máx ${mb(limits.maxBodyBytes)} MB). Reduce el tamaño o la cantidad de imágenes.`,
    );

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limits.maxBodyBytes) throw tooLarge();

  const body = req.body;
  if (!body) {
    // No stream (e.g. a synthetic Request): fall back to text(), still capped.
    let text: string;
    try {
      text = await req.text();
    } catch {
      throw new ImageRefError("INVALID_IMAGE_REF", "body", "No se pudo leer la petición.");
    }
    if (byteLengthOf(text) > limits.maxBodyBytes) throw tooLarge();
    return parseJson(text);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // Client hung up, or the transport failed. Typed, not a raw TypeError.
        throw new ImageRefError("INVALID_IMAGE_REF", "body", "La petición se interrumpió.");
      }
      if (chunk.done) break;
      const value = chunk.value;
      if (!value) continue;
      total += value.byteLength;
      if (total > limits.maxBodyBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already cancelled.
    }
  }

  return parseJson(new TextDecoder().decode(concatChunks(chunks, total)));
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ImageRefError("INVALID_IMAGE_REF", "body", "El cuerpo de la petición no es JSON válido.");
  }
}

function byteLengthOf(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function mb(bytes: number): string {
  return String(Math.round(bytes / 1_000_000));
}

// ---------------------------------------------------------------------------
// Magic-byte sniffing
// ---------------------------------------------------------------------------

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

function startsWithBytes(bytes: Uint8Array, magic: number[], offset = 0): boolean {
  if (bytes.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[offset + i] !== magic[i]) return false;
  }
  return true;
}

/**
 * Decides the MIME type from the content itself. Returns null for anything
 * that is not PNG / JPEG / WebP — HTML error pages served as `image/png`
 * land here (T-F.8), as do formats the provider path does not accept.
 */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (startsWithBytes(bytes, PNG_MAGIC)) return "image/png";
  if (startsWithBytes(bytes, JPEG_MAGIC)) return "image/jpeg";
  if (startsWithBytes(bytes, RIFF_MAGIC) && startsWithBytes(bytes, WEBP_MAGIC, 8)) {
    return "image/webp";
  }
  return null;
}

// ---------------------------------------------------------------------------
// base64 helpers (bounded work — never decodes the whole payload)
// ---------------------------------------------------------------------------

const BASE64_CHARS = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Exact decoded byte length of a base64 payload, computed from its encoded
 * length and padding. No allocation, so an oversized input is rejected on
 * length alone (T-F.10).
 */
export function decodedByteLength(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (base64.charCodeAt(len - 1) === 61) padding++;
  if (len > 1 && base64.charCodeAt(len - 2) === 61) padding++;
  return Math.floor(len / 4) * 3 - padding;
}

/** Decodes just the leading bytes, enough for a magic-byte sniff. */
function decodeHeadBytes(base64: string, wanted = 16): Uint8Array {
  // 4 base64 chars => 3 bytes; take a whole number of quartets.
  const quartets = Math.ceil(wanted / 3);
  const head = base64.slice(0, quartets * 4);
  // Only pad if we actually truncated; a short payload keeps its own padding.
  const padded = head.length < base64.length
    ? head + "=".repeat((4 - (head.length % 4)) % 4)
    : head;
  try {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

/** Chunked base64 encode — byte-at-a-time concatenation burns the CPU budget. */
export function encodeBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const pieces: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    pieces.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(pieces.join(""));
}

// ---------------------------------------------------------------------------
// Pass 1 — per-entry validation
// ---------------------------------------------------------------------------

export interface ValidateOptions {
  limits: ImageLimits;
  /** `SUPABASE_URL`, e.g. `https://abc.supabase.co`. */
  supabaseUrl: string;
}

const DATA_URL_HEAD = /^data:([a-zA-Z0-9/+.;=-]+);base64,/i;

/**
 * Validates one image entry: raw base64, data-URL, or bucket URL. Throws
 * `ImageRefError` on anything it does not recognise or does not trust.
 *
 * Nothing here performs I/O. A URL entry is only checked for provenance; the
 * fetch happens in pass 2, after every entry in the request has passed.
 */
export function validateImageRef(
  input: unknown,
  path: string,
  opts: ValidateOptions,
  consumed = true,
): ValidatedImageRef {
  if (typeof input !== "string" || input.length === 0) {
    throw new ImageRefError("INVALID_IMAGE_REF", path, "La referencia de imagen está vacía o no es texto.");
  }

  // A URL-shaped entry: anything with a scheme. Checking the generic scheme
  // shape (not just `https://`) is what makes plain http a typed rejection
  // rather than a base64 parse failure (T-F.4). `data:` is matched
  // case-insensitively so `DATA:` is not misrouted into the URL branch.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) && !/^data:/i.test(input)) {
    return validateBucketUrl(input, path, opts, consumed);
  }

  return validateInline(input, path, opts, consumed);
}

function validateBucketUrl(
  input: string,
  path: string,
  opts: ValidateOptions,
  consumed: boolean,
): ValidatedImageRef {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ImageRefError("MALFORMED_URL", path, "La URL de la imagen no es válida.");
  }

  if (url.protocol !== "https:") {
    throw new ImageRefError("INSECURE_SCHEME", path, "Solo se aceptan URLs https.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ImageRefError("URL_CREDENTIALS", path, "La URL de la imagen incluye credenciales.");
  }
  // `new URL('...#x').hash` is '#x'; a bare trailing '#' yields ''. Check the
  // raw input too so `…#` cannot slip a fragment past a normalising parser.
  if (url.hash !== "" || input.includes("#")) {
    throw new ImageRefError("URL_FRAGMENT", path, "La URL de la imagen incluye un fragmento.");
  }

  let base: URL;
  try {
    base = new URL(opts.supabaseUrl);
  } catch {
    // Misconfigured function: refuse rather than accept an unpinned origin.
    throw new ImageRefError("FORBIDDEN_ORIGIN", path, "El origen del bucket no está configurado.");
  }
  if (url.origin !== base.origin) {
    throw new ImageRefError("FORBIDDEN_ORIGIN", path, "La imagen no está en el origen permitido.");
  }
  // Encoded separators keep a literal `..` from being normalised away, so
  // `..%2fother-bucket/x.png` would survive a plain `%2e%2e` test and still
  // read as a traversal to anything downstream that decodes once more. Origin
  // and path prefix are both still pinned, so this is defence in depth — but
  // it is nearly free, and it does not false-positive on a filename that
  // merely contains `%2e%2e`.
  if (/%2f|%5c/i.test(url.pathname)) {
    throw new ImageRefError("FORBIDDEN_BUCKET", path, "La ruta de la imagen no es válida.");
  }
  if (!ACCEPTED_BUCKET_PATHS.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new ImageRefError("FORBIDDEN_BUCKET", path, "La imagen no está en el bucket permitido.");
  }

  return { kind: "url", path, consumed, url };
}

/**
 * Provenance checks alone, for an entry the handler will not consume.
 *
 * A URL still has to clear every origin/bucket/scheme test — a forbidden URL
 * must be caught wherever it hides, including in a slot nothing reads. Inline
 * data does not: it is never fetched, never sent to a provider, and never
 * held, so its size and its format are simply not this request's problem. The
 * body cap already bounds it.
 */
function validateProvenanceOnly(
  input: unknown,
  path: string,
  opts: ValidateOptions,
): void {
  if (typeof input !== "string" || input.length === 0) return;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) && !/^data:/i.test(input)) {
    validateBucketUrl(input, path, opts, false);
  }
}

function validateInline(
  input: string,
  path: string,
  opts: ValidateOptions,
  consumed: boolean,
): ValidatedImageRef {
  let payload = input;

  const dataMatch = input.match(DATA_URL_HEAD);
  if (/^data:/i.test(input)) {
    if (!dataMatch) {
      throw new ImageRefError("INVALID_IMAGE_REF", path, "El data URL de la imagen está mal formado.");
    }
    payload = input.slice(dataMatch[0].length);
  }

  // Encoded-length precheck FIRST: reject before touching the payload
  // (T-F.10). 4 base64 chars carry 3 bytes, so this is an exact bound.
  const maxEncoded = Math.ceil(opts.limits.maxImageBytes / 3) * 4 + 4;
  if (payload.length > maxEncoded) {
    throw new ImageRefError(
      "IMAGE_TOO_LARGE",
      path,
      `La imagen es demasiado grande (máx ${mb(opts.limits.maxImageBytes)} MB). Reduce la resolución de la foto.`,
    );
  }

  if (payload.length === 0 || payload.length % 4 !== 0 || !BASE64_CHARS.test(payload)) {
    throw new ImageRefError("INVALID_IMAGE_REF", path, "La imagen no está en base64 válido.");
  }

  const byteLength = decodedByteLength(payload);
  if (byteLength > opts.limits.maxImageBytes) {
    throw new ImageRefError(
      "IMAGE_TOO_LARGE",
      path,
      `La imagen es demasiado grande (máx ${mb(opts.limits.maxImageBytes)} MB). Reduce la resolución de la foto.`,
    );
  }

  // MIME from the content, never from the data-URL's own claim. A mismatch is
  // NOT an error: browsers derive `File.type` from the extension, so a JPEG
  // saved as `.png` is routine. The sniffed type wins and the claim is
  // discarded. A format we cannot sniff is skippable, not fatal.
  const mimeType = sniffImageMime(decodeHeadBytes(payload));
  if (!mimeType) {
    throw new ImageRefError(
      "NOT_IMAGE",
      path,
      "El formato de la imagen no es compatible (usa PNG, JPEG o WebP).",
    );
  }

  return { kind: "inline", path, consumed, base64: payload, mimeType, byteLength };
}

// ---------------------------------------------------------------------------
// Pass 1 — whole-request prevalidation
// ---------------------------------------------------------------------------

export interface PrevalidateResult {
  refs: ValidatedImageRef[];
  /** Decoded bytes already accounted for by inline entries. */
  inlineBytes: number;
  /** Entries dropped by a skippable failure. */
  skipped: SkippedImage[];
}

/**
 * The field instance an entry belongs to: `landmarks[0].referenceImages[3]`
 * counts against `landmarks[0].referenceImages`, NOT against every
 * `landmarks[].referenceImages` in the request.
 *
 * Stripping every index instead of the trailing one collapsed each field
 * *shape* into a single counter, so five characters with one photo apiece
 * tripped a four-per-field cap. That rejected an ordinary cover request.
 */
function fieldInstanceOf(path: string): string {
  return path.replace(/\[\d+\]$/, "");
}

/**
 * Pass 1. Validates every collected entry and enforces the absolute request
 * ceiling and the aggregate inline budget. Provenance and resource failures
 * throw; a single unusable entry is recorded in `skipped` and the rest of the
 * request proceeds.
 *
 * The caller must not fetch or call a provider if this throws.
 */
export function prevalidateImageRefs(
  slots: ImageRefSlot[],
  opts: ValidateOptions,
): PrevalidateResult {
  // Bounds pass-1 work itself. Distinct from `maxImagesPerRequest`, which
  // bounds what gets materialised.
  if (slots.length > opts.limits.maxImageSlots) {
    throw new ImageRefError(
      "TOO_MANY_IMAGES",
      "request",
      `La petición lleva ${slots.length} referencias de imagen; el máximo es ${opts.limits.maxImageSlots}.`,
    );
  }

  const refs: ValidatedImageRef[] = [];
  const skipped: SkippedImage[] = [];
  const perField = new Map<string, number>();
  let inlineBytes = 0;
  let consumedCount = 0;

  for (const slot of slots) {
    const field = fieldInstanceOf(slot.path);
    const seen = (perField.get(field) ?? 0) + 1;
    perField.set(field, seen);
    const overField = seen > opts.limits.maxImagesPerField;

    // An entry is "in play" only if the handler will read it AND it fits the
    // per-field allowance. Everything else gets provenance checks and nothing
    // more.
    //
    // Applying the size caps, the aggregate budget, or the request ceiling to
    // entries nothing reads is what rejected requests cc-cleanup served: a
    // 7 MB photo sitting at index 2 of a landmark whose first two are the only
    // ones used, or a story request carrying character photos this function
    // never analyses. Those bytes are never fetched, never sent, never held.
    if (!slot.consumed || overField) {
      try {
        validateProvenanceOnly(slot.value, slot.path, opts);
      } catch (err) {
        if (err instanceof ImageRefError && PASS1_SKIPPABLE.has(err.code)) {
          skipped.push({ path: slot.path, code: err.code });
          continue;
        }
        throw err;
      }
      skipped.push({ path: slot.path, code: "NOT_USED" });
      continue;
    }

    consumedCount++;
    if (consumedCount > opts.limits.maxImagesPerRequest) {
      throw new ImageRefError(
        "TOO_MANY_IMAGES",
        "request",
        `La petición usa más de ${opts.limits.maxImagesPerRequest} imágenes.`,
      );
    }

    let ref: ValidatedImageRef;
    try {
      ref = validateImageRef(slot.value, slot.path, opts, slot.consumed);
    } catch (err) {
      if (err instanceof ImageRefError && PASS1_SKIPPABLE.has(err.code)) {
        skipped.push({ path: slot.path, code: err.code });
        continue;
      }
      throw err;
    }

    if (ref.kind === "inline") {
      inlineBytes += ref.byteLength;
      // A8a: the aggregate is enforced during pass 1, so an over-budget set of
      // inline images is a 413 BEFORE the first URL fetch (T-F.14). Only
      // consumed entries reach here, so the budget reflects bytes the request
      // will actually hold.
      if (inlineBytes > opts.limits.maxTotalImageBytes) {
        throw new ImageRefError(
          "IMAGE_BUDGET_EXCEEDED",
          slot.path,
          `Las imágenes suman más de ${mb(opts.limits.maxTotalImageBytes)} MB. Envía menos imágenes o reduce su tamaño.`,
        );
      }
    }
    refs.push(ref);
  }

  return { refs, inlineBytes, skipped };
}

// ---------------------------------------------------------------------------
// Pass 2 — the fetch
// ---------------------------------------------------------------------------

export interface FetchOptions {
  limits: ImageLimits;
  /** Injectable for tests; defaults to the ambient fetch at call time. */
  fetchImpl?: typeof fetch;
  /**
   * Byte cap for this one download. Below `maxImageBytes` it means the
   * aggregate budget is the binding constraint, which changes the code the
   * cut-off reports.
   */
  budgetBytes?: number;
}

/**
 * Downloads one already-validated bucket URL.
 *
 * `redirect: 'error'` (a redirect is a provenance escape — T-F.5), a 20s
 * timeout, and a streaming cut-off: the body is read chunk by chunk and the
 * reader is cancelled the moment the cap is passed, so an oversized object is
 * never fully buffered (T-F.6). The MIME comes from the bytes (T-F.8).
 */
export async function fetchImageSafely(
  ref: Extract<ValidatedImageRef, { kind: "url" }>,
  opts: FetchOptions,
): Promise<MaterializedImage> {
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init));
  const perImage = opts.limits.maxImageBytes;
  const cap = Math.max(0, Math.min(perImage, opts.budgetBytes ?? perImage));
  // Below the per-image cap the aggregate is what is binding, so a cut-off
  // must not tell the user their image is too large (it may be well under the
  // per-image limit) — it must tell them the request total is.
  const capCode: ImageRefFailureCode = cap < perImage
    ? "IMAGE_BUDGET_EXCEEDED"
    : "IMAGE_TOO_LARGE";

  let response: Response;
  try {
    response = await doFetch(ref.url.toString(), {
      headers: { Accept: "image/*" },
      redirect: "error",
      signal: AbortSignal.timeout(opts.limits.fetchTimeoutMs),
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new ImageRefError("FETCH_TIMEOUT", ref.path, "La descarga de la imagen expiró.");
    }
    if (isRedirectError(err)) {
      throw new ImageRefError("REDIRECT_REFUSED", ref.path, "La URL de la imagen redirige.");
    }
    throw new ImageRefError("FETCH_FAILED", ref.path, "No se pudo descargar la imagen.");
  }

  // Belt and braces: some runtimes surface a refused redirect as a response
  // rather than a throw.
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    await response.body?.cancel().catch(() => {});
    throw new ImageRefError("REDIRECT_REFUSED", ref.path, "La URL de la imagen redirige.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new ImageRefError("FETCH_FAILED", ref.path, "No se pudo descargar la imagen.");
  }

  const bytes = await readCapped(response, cap, capCode, ref.path);

  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    // The download completed; the bytes were spent even though they produced
    // nothing usable. Refunding them let a run of unsniffable objects pull far
    // more than the aggregate budget off the wire.
    throw new ImageRefError(
      "NOT_IMAGE",
      ref.path,
      "El contenido descargado no es una imagen PNG, JPEG o WebP.",
      bytes.byteLength,
    );
  }

  return {
    path: ref.path,
    base64: encodeBase64(bytes),
    mimeType,
    byteLength: bytes.byteLength,
  };
}

async function readCapped(
  response: Response,
  cap: number,
  capCode: ImageRefFailureCode,
  path: string,
): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    throw new ImageRefError("FETCH_FAILED", path, "La descarga no devolvió contenido.");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        // `total` is charged either way: those bytes crossed the wire.
        if (isAbortError(err)) {
          throw new ImageRefError(
            "FETCH_TIMEOUT",
            path,
            "La descarga de la imagen expiró.",
            total,
          );
        }
        throw new ImageRefError(
          "FETCH_FAILED",
          path,
          "La descarga de la imagen se interrumpió.",
          total,
        );
      }
      if (chunk.done) break;
      const value = chunk.value;
      if (!value) continue;
      total += value.byteLength;
      if (total > cap) {
        // Cut the stream instead of buffering the rest. `total` (never more
        // than the cap plus the chunk that tripped it) is what the wire
        // actually delivered, and is charged to the budget.
        await reader.cancel().catch(() => {});
        throw new ImageRefError(
          capCode,
          path,
          capCode === "IMAGE_BUDGET_EXCEEDED"
            ? "Las imágenes de la petición superan el total permitido."
            : "La imagen descargada es demasiado grande.",
          total,
        );
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already cancelled.
    }
  }

  if (total === 0) {
    throw new ImageRefError("FETCH_FAILED", path, "La imagen descargada está vacía.");
  }

  return concatChunks(chunks, total);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError");
}

/**
 * Deno reports a refused redirect as a TypeError. The phrasing below was
 * CAPTURED FROM THE RUNTIME, not guessed — Deno 2.7.11 throws exactly:
 *
 *   TypeError: Fetch failed: Encountered redirect while redirect mode is set
 *   to 'error'
 *
 * An earlier version of this function matched a set of plausible-sounding
 * phrasings that the runtime never emits, so every real refused redirect was
 * classified FETCH_FAILED. It went unnoticed because the test stub fabricated
 * a message built to satisfy the regex. `redirectErrorFixture()` now exports
 * the real string so the suite cannot drift from the runtime again.
 *
 * The alternatives are kept for other runtimes/versions; the anchors avoid
 * matching an ordinary network error on an object whose own path contains
 * "redirect".
 */
function isRedirectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /encountered redirect|redirect mode is set|redirect (?:not allowed|count exceeded|is not allowed)|not allowed to follow|unexpected redirect/i
    .test(err.message);
}

/**
 * The verbatim message Deno raises for a refused redirect, captured by running
 * `fetch(..., { redirect: 'error' })` against a 302 on Deno 2.7.11. Tests must
 * use this rather than inventing a message that happens to match the matcher.
 */
export function redirectErrorFixture(): TypeError {
  return new TypeError(
    "Fetch failed: Encountered redirect while redirect mode is set to 'error'",
  );
}

// ---------------------------------------------------------------------------
// Pass 2 — materialise everything
// ---------------------------------------------------------------------------

export interface MaterializeResult {
  images: Map<string, MaterializedImage>;
  /** Pass-1 skips plus every entry pass 2 could not produce. */
  skipped: SkippedImage[];
}

/**
 * Pass 2. Turns the pass-1 output into base64 payloads, fetching only the URL
 * entries the handler will actually consume and charging every downloaded byte
 * against the aggregate budget.
 *
 * Downloads run concurrently. The budget stays exact despite the concurrency:
 * each task *reserves* its cap synchronously before awaiting — single-threaded,
 * so no interleaving is possible between the check and the reservation — and
 * refunds whatever it did not use. Total bytes in flight therefore never
 * exceed `maxTotalImageBytes`.
 *
 * A download that fails does not fail the request: the entry is recorded in
 * `skipped` and the caller decides. Must only be called with the result of a
 * successful `prevalidateImageRefs`.
 */
export async function materializeImageRefs(
  prevalidated: PrevalidateResult,
  opts: FetchOptions & { concurrency?: number },
): Promise<MaterializeResult> {
  const images = new Map<string, MaterializedImage>();
  const skipped: SkippedImage[] = [...prevalidated.skipped];

  let remaining = opts.limits.maxTotalImageBytes - prevalidated.inlineBytes;

  const urlRefs: Array<Extract<ValidatedImageRef, { kind: "url" }>> = [];
  for (const ref of prevalidated.refs) {
    if (ref.kind === "inline") {
      images.set(ref.path, {
        path: ref.path,
        base64: ref.base64,
        mimeType: ref.mimeType,
        byteLength: ref.byteLength,
      });
    } else if (ref.consumed) {
      urlRefs.push(ref);
    }
  }

  let cursor = 0;
  const inFlight = new Set<Promise<MaterializedImage>>();

  const worker = async (): Promise<void> => {
    while (cursor < urlRefs.length) {
      const ref = urlRefs[cursor++];

      // Reserve before awaiting: synchronous, so the budget cannot be
      // oversubscribed by concurrent workers.
      let reserved = Math.min(opts.limits.maxImageBytes, remaining);

      // A reservation is a worst case, not a measurement: a peer holding
      // `maxImageBytes` for a 48-byte object refunds nearly all of it the
      // moment it lands. Waiting for that refund is the difference between
      // "the budget is spent" and "the budget is spoken for" — treating the
      // second as the first starved later downloads and silently dropped
      // images that fitted comfortably.
      //
      // Waiting for a FULL reservation, not merely a non-zero one: a 1-byte
      // sliver is enough to pass `reserved > 0` and then cuts the download off
      // at one byte, reporting a budget failure for an image that would have
      // fitted once a peer refunded. Once nothing is in flight, whatever
      // remains is genuinely all there is, and a cut-off there is honest.
      while (reserved < opts.limits.maxImageBytes && inFlight.size > 0) {
        // Rejections are handled by the worker that owns them; swallow here
        // so racing on a peer cannot surface an unhandled rejection.
        await Promise.race([...inFlight].map((p) => p.catch(() => undefined)));
        reserved = Math.min(opts.limits.maxImageBytes, remaining);
      }

      if (reserved <= 0) {
        skipped.push({ path: ref.path, code: "IMAGE_BUDGET_EXCEEDED" });
        continue;
      }
      remaining -= reserved;

      const task = fetchImageSafely(ref, { ...opts, budgetBytes: reserved });
      inFlight.add(task);
      try {
        const image = await task;
        remaining += reserved - image.byteLength;
        images.set(ref.path, image);
      } catch (err) {
        // Refund only what was never spent. A download cut off at its cap
        // consumed the bytes regardless of producing no image.
        const spent = err instanceof ImageRefError ? err.bytesRead : 0;
        remaining += Math.max(0, reserved - spent);
        if (err instanceof ImageRefError) {
          skipped.push({ path: ref.path, code: err.code });
          continue;
        }
        throw err;
      } finally {
        inFlight.delete(task);
      }
    }
  };

  const lanes = Math.max(
    1,
    Math.min(opts.concurrency ?? opts.limits.fetchConcurrency, urlRefs.length),
  );
  await Promise.all(Array.from({ length: lanes }, () => worker()));

  return { images, skipped };
}

// ---------------------------------------------------------------------------
// Collectors — every nested image field, per consumer
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Pushes a present (non-empty) entry. Absent fields are not errors; a present
 * but non-string field IS collected, so pass 1 sees it rather than the old
 * code silently ignoring it.
 *
 * `consumed` is derived here and nowhere else: the entry's field shape has to
 * be in `reads`, the request's read set. `withinIndex` lets an array field say
 * "this index is past what the handler slices" without opening a second way to
 * decide consumption.
 */
function push(
  slots: ImageRefSlot[],
  reads: ReadonlySet<string>,
  path: string,
  value: unknown,
  withinIndex = true,
): void {
  if (value === undefined || value === null || value === "") return;
  slots.push({ path, value, consumed: withinIndex && reads.has(imageFieldOf(path)) });
}

/**
 * Pushes an array field, marking entries past `consumedCount` as validated but
 * not downloaded — the handlers slice these arrays, and fetching what they
 * then discard wasted egress and charged the aggregate budget for bytes
 * nobody read.
 */
function pushArray(
  slots: ImageRefSlot[],
  reads: ReadonlySet<string>,
  prefix: string,
  value: unknown,
  consumedCount: number,
): void {
  asArray(value).forEach((img, j) => {
    push(slots, reads, `${prefix}[${j}]`, img, j < consumedCount);
  });
}

/** How many entries `generate-scene-images` reads from a landmark/prop array. */
const SCENE_REFS_CONSUMED = 2;
/** How many entries `generate-story` sends for analysis. */
const STORY_REFS_CONSUMED = 4;

// ---------------------------------------------------------------------------
// The consumption plan — ONE source for "will the handler read this entry?"
// ---------------------------------------------------------------------------

/**
 * A field *shape*: the path an entry occupies with its array indices removed.
 * `landmarks[3].referenceImages[1]` and `landmarks[0].referenceImages[0]` are
 * both `landmarks[].referenceImages`.
 */
export function imageFieldOf(path: string): string {
  return path.replace(/\[\d+\]/g, "[]").replace(/\[\]$/, "");
}

/** Field shapes `generate-scene-images` can be handed an image in. */
export type SceneImageField =
  | "refine.sourceImage"
  | "sceneReferenceImage"
  | "referenceImage"
  | "characters[].referenceImage"
  | "landmarks[].referenceImages"
  | "props[].referenceImages"
  | "prop.referenceImages"
  | "character.referenceImage";

/** Field shapes `generate-story` can be handed an image in. */
export type StoryImageField =
  | "landmarks[].referenceImages"
  | "props[].referenceImages"
  | "characters[].referenceImage";

/** The request types `generate-scene-images` dispatches on. */
export type SceneRequestType = "scene" | "character" | "prop" | "cover" | "end";

interface ReadRule<F extends string> {
  field: F;
  /** Extra condition the handler branch itself applies before reading. */
  when?: (payload: Record<string, unknown>) => boolean;
}

/**
 * What each `generate-scene-images` request type's handler branch ACTUALLY
 * reads, transcribed from the `switch (type)` in
 * `generate-scene-images/handler.ts`:
 *
 *   * `scene`   — characters (`:814`), landmarks (`:835`, only inside
 *                 `if (scene.landmarkVisible …)` at `:829`), props (`:855`),
 *                 `sceneReferenceImage` (`:963`).
 *   * `cover`   — characters (`:1057`), props (`:1075`),
 *                 `sceneReferenceImage` (`:1163`). Covers have no landmarks.
 *   * `end`     — characters (`:1219`), top-level `referenceImage` (`:1265`).
 *   * `prop`    — `prop.referenceImages` (`:1002`) and nothing else.
 *   * `character` — NOTHING. The branch builds a prompt from the character's
 *                 text description; `character.referenceImage` is never read
 *                 by any branch, which is why it appears in no read set.
 *
 * This is the single source. `collectSceneImageRefs` decides `consumed` from
 * it and the handler's `takeImage` resolves through it, so an edit here moves
 * both — there is no second list to keep in step. Severing one entry fails a
 * collector test AND that type's handler-path test; that is the wiring proof.
 *
 * It exists because marking every recognised field consumed regardless of
 * `type` made pass 2 download objects the branch never reads and made pass 1
 * fatally charge inline entries it never holds: a `type:"prop"` request with
 * an oversized photo parked in `characters[0]` answered 413 where cc-cleanup
 * answered 200.
 */
const SCENE_READ_RULES: Record<SceneRequestType, readonly ReadRule<SceneImageField>[]> = {
  scene: [
    { field: "characters[].referenceImage" },
    {
      field: "landmarks[].referenceImages",
      when: (p) => !!asRecord(p.scene)?.landmarkVisible,
    },
    { field: "props[].referenceImages" },
    { field: "sceneReferenceImage" },
  ],
  character: [],
  prop: [
    { field: "prop.referenceImages" },
  ],
  cover: [
    { field: "characters[].referenceImage" },
    { field: "props[].referenceImages" },
    { field: "sceneReferenceImage" },
  ],
  end: [
    { field: "characters[].referenceImage" },
    { field: "referenceImage" },
  ],
};

/**
 * What `generate-story` reads. It has no request type: one code path analyses
 * landmark and prop photos (`generate-story/handler.ts:706` and `:727`) and
 * nothing reads `characters[].referenceImage` — the story function does not
 * analyse character photos, so that field is validated and never consumed.
 */
const STORY_READ_RULES: readonly ReadRule<StoryImageField>[] = [
  { field: "landmarks[].referenceImages" },
  { field: "props[].referenceImages" },
];

/**
 * Whether the handler will take the refine path. Exported because the scene
 * handler must decide it the same way the collector does — the refine source
 * is resolved before the type switch, for EVERY type, so it is not part of any
 * type's rule list.
 *
 * Deliberately the handler's own historical test, `typeof rawRefine ===
 * 'object'` and all: a refine without a string `feedback` never activates, so
 * an image parked under `refine.sourceImage` in that case is read by nothing.
 */
export function isRefineRequested(payload: unknown): boolean {
  const data = asRecord(payload);
  if (!data) return false;
  const raw = data.refine;
  return !!raw && typeof raw === "object" &&
    typeof (raw as Record<string, unknown>).feedback === "string";
}

/** The field shapes this `generate-scene-images` request will actually read. */
export function sceneImageReadSet(payload: unknown): ReadonlySet<string> {
  const data = asRecord(payload) ?? {};
  const type = typeof data.type === "string" ? data.type : "";
  const rules = SCENE_READ_RULES[type as SceneRequestType] ?? [];
  const set = new Set<string>();
  for (const rule of rules) {
    if (!rule.when || rule.when(data)) set.add(rule.field);
  }
  if (isRefineRequested(data)) set.add("refine.sourceImage");
  return set;
}

/** The field shapes this `generate-story` request will actually read. */
export function storyImageReadSet(payload: unknown): ReadonlySet<string> {
  const data = asRecord(payload) ?? {};
  const set = new Set<string>();
  for (const rule of STORY_READ_RULES) {
    if (!rule.when || rule.when(data)) set.add(rule.field);
  }
  return set;
}

/**
 * Every image entry `generate-scene-images` can be handed, for every request
 * `type`. Walking all of them regardless of type is the point: a forbidden
 * entry anywhere aborts the whole request before pass 2 (T-F.9), including one
 * parked in a field this type ignores (T-F.9c). What the read set decides is
 * only whether an entry is CHARGED and FETCHED.
 */
export function collectSceneImageRefs(payload: unknown): ImageRefSlot[] {
  const data = asRecord(payload);
  if (!data) return [];
  const reads = sceneImageReadSet(data);
  const slots: ImageRefSlot[] = [];

  const refine = asRecord(data.refine);
  if (refine) push(slots, reads, "refine.sourceImage", refine.sourceImage);

  push(slots, reads, "sceneReferenceImage", data.sceneReferenceImage);
  push(slots, reads, "referenceImage", data.referenceImage);

  asArray(data.characters).forEach((raw, i) => {
    const c = asRecord(raw);
    if (c) push(slots, reads, `characters[${i}].referenceImage`, c.referenceImage);
  });

  asArray(data.landmarks).forEach((raw, i) => {
    const lm = asRecord(raw);
    if (!lm) return;
    pushArray(slots, reads, `landmarks[${i}].referenceImages`, lm.referenceImages, SCENE_REFS_CONSUMED);
  });

  asArray(data.props).forEach((raw, i) => {
    const p = asRecord(raw);
    if (!p) return;
    pushArray(slots, reads, `props[${i}].referenceImages`, p.referenceImages, SCENE_REFS_CONSUMED);
  });

  // `type: 'prop'` sends a single prop object rather than an array.
  const prop = asRecord(data.prop);
  if (prop) {
    pushArray(slots, reads, "prop.referenceImages", prop.referenceImages, SCENE_REFS_CONSUMED);
  }

  const character = asRecord(data.character);
  if (character) push(slots, reads, "character.referenceImage", character.referenceImage);

  return slots;
}

/**
 * Every image entry `generate-story` can be handed.
 *
 * `characters[].referenceImage` is validated but never consumed: the story
 * function does not analyse character photos, and a forbidden URL parked there
 * must still be caught.
 */
export function collectStoryImageRefs(payload: unknown): ImageRefSlot[] {
  const data = asRecord(payload);
  if (!data) return [];
  const reads = storyImageReadSet(data);
  const slots: ImageRefSlot[] = [];

  asArray(data.landmarks).forEach((raw, i) => {
    const lm = asRecord(raw);
    if (!lm) return;
    pushArray(slots, reads, `landmarks[${i}].referenceImages`, lm.referenceImages, STORY_REFS_CONSUMED);
  });

  asArray(data.props).forEach((raw, i) => {
    const p = asRecord(raw);
    if (!p) return;
    pushArray(slots, reads, `props[${i}].referenceImages`, p.referenceImages, STORY_REFS_CONSUMED);
  });

  asArray(data.characters).forEach((raw, i) => {
    const c = asRecord(raw);
    if (c) push(slots, reads, `characters[${i}].referenceImage`, c.referenceImage);
  });

  return slots;
}

/**
 * Strips URLs out of arbitrary text before it is logged. Runtime network
 * errors embed the request URL in their message, which is how a provider key
 * carried as a query parameter ends up in the logs.
 */
export function redactUrls(text: string): string {
  return text.replace(/[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s)'"]+/g, "[url redactada]");
}

/** A log-safe one-line description of an unknown thrown value. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${redactUrls(err.message)}`;
  return redactUrls(String(err));
}

/** Maps a typed rejection onto the JSON error contract both handlers use. */
export function imageErrorResponse(
  err: ImageRefError,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      code: err.code,
      error: err.message,
      field: err.path,
      ...extra,
    }),
    {
      status: err.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
