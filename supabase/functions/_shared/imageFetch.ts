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
 *     base64/data-URLs (A8a). Only if all entries pass does pass 2 fetch
 *     anything. A single bad entry means zero Storage fetches and zero
 *     provider calls for the whole request.
 *   * URL entries are pinned to the exact public bucket: HTTPS only, no
 *     credentials, no fragment, exact `${SUPABASE_URL}/storage/v1/object/
 *     public/cuentacuentos-drafts/` origin+path prefix.
 *   * Pass-2 fetches use `redirect: 'error'`, a 20s timeout, a streaming
 *     cut-off at the per-image cap (the reader is cancelled — there is no
 *     post-`arrayBuffer()` check to overshoot), and decide MIME from magic
 *     bytes, never from `Content-Type`.
 *
 * Nothing here logs a URL, a query string, or a base64 prefix. Callers get a
 * redacted label via `describeRef`.
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
  /** Decoded-byte cap for a single image. Over => 413. */
  maxImageBytes: number;
  /**
   * Aggregate decoded-byte budget across every image in one request (A8a).
   * Over => 413.
   */
  maxTotalImageBytes: number;
  /** Maximum entries accepted in one nested image field. Over => 422. */
  maxImagesPerField: number;
  /** Maximum image entries accepted across the whole request. Over => 422. */
  maxImagesPerRequest: number;
  /** Pass-2 fetch timeout. */
  fetchTimeoutMs: number;
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
 * `maxImagesPerRequest` matches the 12-reference cap the handlers already
 * enforce when trimming.
 */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = {
  maxBodyBytes: 20_000_000,
  maxImageBytes: 6_000_000,
  maxTotalImageBytes: 14_000_000,
  maxImagesPerField: 4,
  maxImagesPerRequest: 12,
  fetchTimeoutMs: 20_000,
};

/** The one bucket these functions are allowed to read from. */
export const DRAFTS_BUCKET_PATH = "/storage/v1/object/public/cuentacuentos-drafts/";

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
  | "REFINE_SOURCE_UNAVAILABLE";

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
};

/**
 * A typed rejection. Handlers map these straight to a Response; they never
 * reach the top-level catch (which would turn them into a 500).
 */
export class ImageRefError extends Error {
  readonly code: ImageRefFailureCode;
  readonly status: number;
  /** Redacted field path, e.g. `characters[2].referenceImage`. Never a URL. */
  readonly path: string;

  constructor(code: ImageRefFailureCode, path: string, message?: string) {
    super(message ?? `${code} at ${path}`);
    this.name = "ImageRefError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.path = path;
  }
}

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

/** One image entry found in the request, before validation. */
export interface ImageRefSlot {
  /** Redacted field path used in errors and logs. */
  path: string;
  value: unknown;
}

export type ValidatedImageRef =
  | {
    kind: "inline";
    path: string;
    /** Raw base64 payload, data-URL prefix already stripped. */
    base64: string;
    mimeType: ImageMime;
    byteLength: number;
  }
  | {
    kind: "url";
    path: string;
    url: URL;
    /** Not known until pass 2; charged against the budget as 0 in pass 1. */
    byteLength: 0;
  };

export interface MaterializedImage {
  path: string;
  base64: string;
  mimeType: ImageMime;
  byteLength: number;
}

// ---------------------------------------------------------------------------
// Logging hygiene
// ---------------------------------------------------------------------------

/**
 * A safe label for an image entry. Never returns a URL, a query string, or a
 * base64 prefix — only the field path, the kind, and the size.
 */
export function describeRef(ref: ValidatedImageRef): string {
  return ref.kind === "inline"
    ? `${ref.path} (inline ${ref.mimeType}, ${ref.byteLength}B)`
    : `${ref.path} (bucket object)`;
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
 */
export async function readBoundedJson(
  req: Request,
  limits: ImageLimits = DEFAULT_IMAGE_LIMITS,
): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limits.maxBodyBytes) {
    throw new ImageRefError(
      "BODY_TOO_LARGE",
      "body",
      `Request body exceeds ${limits.maxBodyBytes} bytes`,
    );
  }

  const body = req.body;
  if (!body) {
    // No stream (e.g. a synthetic Request): fall back to text(), still capped.
    const text = await req.text();
    if (byteLengthOf(text) > limits.maxBodyBytes) {
      throw new ImageRefError(
        "BODY_TOO_LARGE",
        "body",
        `Request body exceeds ${limits.maxBodyBytes} bytes`,
      );
    }
    return parseJson(text);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limits.maxBodyBytes) {
        await reader.cancel().catch(() => {});
        throw new ImageRefError(
          "BODY_TOO_LARGE",
          "body",
          `Request body exceeds ${limits.maxBodyBytes} bytes`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(new TextDecoder().decode(joined));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ImageRefError("INVALID_IMAGE_REF", "body", "Body is not valid JSON");
  }
}

function byteLengthOf(text: string): number {
  return new TextEncoder().encode(text).byteLength;
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
 * land here (T-F.8).
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

// ---------------------------------------------------------------------------
// Pass 1 — per-entry validation
// ---------------------------------------------------------------------------

export interface ValidateOptions {
  limits: ImageLimits;
  /** `SUPABASE_URL`, e.g. `https://abc.supabase.co`. */
  supabaseUrl: string;
}

const DATA_URL_HEAD = /^data:([a-zA-Z0-9/+.-]+);base64,/;

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
): ValidatedImageRef {
  if (typeof input !== "string" || input.length === 0) {
    throw new ImageRefError("INVALID_IMAGE_REF", path, "Entry is not a non-empty string");
  }

  // A URL-shaped entry: anything with a scheme. Checking the generic scheme
  // shape (not just `https://`) is what makes plain http a typed rejection
  // rather than a base64 parse failure (T-F.4).
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) && !input.startsWith("data:")) {
    return validateBucketUrl(input, path, opts);
  }

  return validateInline(input, path, opts);
}

function validateBucketUrl(
  input: string,
  path: string,
  opts: ValidateOptions,
): ValidatedImageRef {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ImageRefError("MALFORMED_URL", path, "Entry is not a parseable URL");
  }

  if (url.protocol !== "https:") {
    throw new ImageRefError("INSECURE_SCHEME", path, "Only https is accepted");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ImageRefError("URL_CREDENTIALS", path, "URL carries credentials");
  }
  // `new URL('...#x').hash` is '#x'; a bare trailing '#' yields ''. Check the
  // raw input too so `…#` cannot slip a fragment past a normalising parser.
  if (url.hash !== "" || input.includes("#")) {
    throw new ImageRefError("URL_FRAGMENT", path, "URL carries a fragment");
  }

  let base: URL;
  try {
    base = new URL(opts.supabaseUrl);
  } catch {
    // Misconfigured function: refuse rather than accept an unpinned origin.
    throw new ImageRefError("FORBIDDEN_ORIGIN", path, "Bucket origin is not configured");
  }
  if (url.origin !== base.origin) {
    throw new ImageRefError("FORBIDDEN_ORIGIN", path, "URL is not on the bucket origin");
  }
  if (!url.pathname.startsWith(DRAFTS_BUCKET_PATH)) {
    throw new ImageRefError("FORBIDDEN_BUCKET", path, "URL is not in the drafts bucket");
  }
  // `..` cannot survive URL normalisation, but an encoded one can.
  if (url.pathname.includes("%2e%2e") || url.pathname.includes("%2E%2E")) {
    throw new ImageRefError("FORBIDDEN_BUCKET", path, "URL path traversal");
  }

  return { kind: "url", path, url, byteLength: 0 };
}

function validateInline(
  input: string,
  path: string,
  opts: ValidateOptions,
): ValidatedImageRef {
  let payload = input;
  let declaredMime: string | null = null;

  const dataMatch = input.match(DATA_URL_HEAD);
  if (input.startsWith("data:")) {
    if (!dataMatch) {
      throw new ImageRefError("INVALID_IMAGE_REF", path, "Malformed data URL");
    }
    declaredMime = dataMatch[1];
    payload = input.slice(dataMatch[0].length);
  }

  // Encoded-length precheck FIRST: reject before touching the payload
  // (T-F.10). 4 base64 chars carry 3 bytes, so this is an exact bound.
  const maxEncoded = Math.ceil(opts.limits.maxImageBytes / 3) * 4 + 4;
  if (payload.length > maxEncoded) {
    throw new ImageRefError(
      "IMAGE_TOO_LARGE",
      path,
      `Inline image exceeds ${opts.limits.maxImageBytes} bytes`,
    );
  }

  if (payload.length === 0 || payload.length % 4 !== 0) {
    throw new ImageRefError("INVALID_IMAGE_REF", path, "Not valid base64");
  }
  if (!BASE64_CHARS.test(payload)) {
    throw new ImageRefError("INVALID_IMAGE_REF", path, "Not valid base64");
  }

  const byteLength = decodedByteLength(payload);
  if (byteLength > opts.limits.maxImageBytes) {
    throw new ImageRefError(
      "IMAGE_TOO_LARGE",
      path,
      `Inline image exceeds ${opts.limits.maxImageBytes} bytes`,
    );
  }

  // MIME from the content, never from the data-URL's own claim.
  const mimeType = sniffImageMime(decodeHeadBytes(payload));
  if (!mimeType) {
    throw new ImageRefError("NOT_IMAGE", path, "Content is not PNG, JPEG, or WebP");
  }
  if (declaredMime && declaredMime !== mimeType) {
    // Not fatal on its own — the sniffed type wins — but a mismatch means the
    // client mislabelled the payload, so treat it as untrusted input.
    throw new ImageRefError(
      "NOT_IMAGE",
      path,
      "data URL media type does not match its content",
    );
  }

  return { kind: "inline", path, base64: payload, mimeType, byteLength };
}

// ---------------------------------------------------------------------------
// Pass 1 — whole-request prevalidation
// ---------------------------------------------------------------------------

export interface PrevalidateResult {
  refs: ValidatedImageRef[];
  /** Decoded bytes already accounted for by inline entries. */
  inlineBytes: number;
}

/**
 * Pass 1. Validates every collected entry, enforces the count limits and the
 * aggregate inline budget, and returns the validated set. Throws on the first
 * failure — the caller must not fetch or call a provider if this throws.
 *
 * Order matters: counts first (cheap), then per-entry validation, then the
 * aggregate. The aggregate is charged from inline entries only, because URL
 * entries have no known size until pass 2; pass 2 keeps charging the same
 * budget as bytes arrive.
 */
export function prevalidateImageRefs(
  slots: ImageRefSlot[],
  opts: ValidateOptions,
): PrevalidateResult {
  if (slots.length > opts.limits.maxImagesPerRequest) {
    throw new ImageRefError(
      "TOO_MANY_IMAGES",
      "request",
      `Request carries ${slots.length} images, max ${opts.limits.maxImagesPerRequest}`,
    );
  }

  const perField = new Map<string, number>();
  for (const slot of slots) {
    const field = slot.path.replace(/\[\d+\]/g, "[]");
    const next = (perField.get(field) ?? 0) + 1;
    perField.set(field, next);
    if (next > opts.limits.maxImagesPerField) {
      throw new ImageRefError(
        "TOO_MANY_IMAGES",
        field,
        `Field carries more than ${opts.limits.maxImagesPerField} images`,
      );
    }
  }

  const refs: ValidatedImageRef[] = [];
  let inlineBytes = 0;
  for (const slot of slots) {
    const ref = validateImageRef(slot.value, slot.path, opts);
    if (ref.kind === "inline") {
      inlineBytes += ref.byteLength;
      // A8a: the aggregate is enforced during pass 1, so an over-budget set of
      // inline images is a 413 BEFORE the first URL fetch (T-F.14).
      if (inlineBytes > opts.limits.maxTotalImageBytes) {
        throw new ImageRefError(
          "IMAGE_BUDGET_EXCEEDED",
          slot.path,
          `Inline images exceed the ${opts.limits.maxTotalImageBytes} byte budget`,
        );
      }
    }
    refs.push(ref);
  }

  return { refs, inlineBytes };
}

// ---------------------------------------------------------------------------
// Pass 2 — the fetch
// ---------------------------------------------------------------------------

export interface FetchOptions {
  limits: ImageLimits;
  /** Injectable for tests; defaults to the ambient fetch at call time. */
  fetchImpl?: typeof fetch;
  /** Remaining aggregate budget; the stream is cut when it runs out. */
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
  const cap = Math.max(
    0,
    Math.min(opts.limits.maxImageBytes, opts.budgetBytes ?? opts.limits.maxImageBytes),
  );

  let response: Response;
  try {
    response = await doFetch(ref.url.toString(), {
      headers: { Accept: "image/*" },
      redirect: "error",
      signal: AbortSignal.timeout(opts.limits.fetchTimeoutMs),
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw new ImageRefError("FETCH_TIMEOUT", ref.path, "Image download timed out");
    }
    if (isRedirectError(err)) {
      throw new ImageRefError("REDIRECT_REFUSED", ref.path, "Image URL redirected");
    }
    throw new ImageRefError("FETCH_FAILED", ref.path, "Image download failed");
  }

  // Belt and braces: some runtimes surface a refused redirect as a response
  // rather than a throw.
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    await response.body?.cancel().catch(() => {});
    throw new ImageRefError("REDIRECT_REFUSED", ref.path, "Image URL redirected");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new ImageRefError("FETCH_FAILED", ref.path, `Image download returned ${response.status}`);
  }

  const bytes = await readCapped(response, cap, ref.path);

  const mimeType = sniffImageMime(bytes);
  if (!mimeType) {
    throw new ImageRefError("NOT_IMAGE", ref.path, "Downloaded content is not PNG, JPEG, or WebP");
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
  path: string,
): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    throw new ImageRefError("FETCH_FAILED", path, "Image download returned no body");
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
        if (isAbortError(err)) {
          throw new ImageRefError("FETCH_TIMEOUT", path, "Image download timed out");
        }
        throw new ImageRefError("FETCH_FAILED", path, "Image download failed mid-stream");
      }
      if (chunk.done) break;
      const value = chunk.value;
      if (!value) continue;
      total += value.byteLength;
      if (total > cap) {
        // Cut the stream instead of buffering the rest.
        await reader.cancel().catch(() => {});
        throw new ImageRefError(
          "IMAGE_TOO_LARGE",
          path,
          `Image exceeds ${cap} bytes`,
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
    throw new ImageRefError("FETCH_FAILED", path, "Image download was empty");
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError" ||
    err instanceof DOMException && err.name === "AbortError" ||
    (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
}

function isRedirectError(err: unknown): boolean {
  return err instanceof Error && /redirect/i.test(err.message);
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
// Pass 2 — materialise everything
// ---------------------------------------------------------------------------

/**
 * Pass 2. Turns the pass-1 output into base64 payloads, fetching only the URL
 * entries and charging every downloaded byte against the aggregate budget.
 *
 * Must only be called with the result of a successful `prevalidateImageRefs`.
 */
export async function materializeImageRefs(
  prevalidated: PrevalidateResult,
  opts: FetchOptions & { concurrency?: number },
): Promise<Map<string, MaterializedImage>> {
  const out = new Map<string, MaterializedImage>();
  let remaining = opts.limits.maxTotalImageBytes - prevalidated.inlineBytes;

  for (const ref of prevalidated.refs) {
    if (ref.kind === "inline") {
      out.set(ref.path, {
        path: ref.path,
        base64: ref.base64,
        mimeType: ref.mimeType,
        byteLength: ref.byteLength,
      });
      continue;
    }

    if (remaining <= 0) {
      throw new ImageRefError(
        "IMAGE_BUDGET_EXCEEDED",
        ref.path,
        `Images exceed the ${opts.limits.maxTotalImageBytes} byte budget`,
      );
    }

    const image = await fetchImageSafely(ref, { ...opts, budgetBytes: remaining });
    remaining -= image.byteLength;
    out.set(ref.path, image);
  }

  return out;
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
 * but non-string field IS collected, so pass 1 rejects it rather than the
 * old code silently ignoring it.
 */
function push(slots: ImageRefSlot[], path: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  slots.push({ path, value });
}

/**
 * Every image entry `generate-scene-images` can be asked to materialise, for
 * every request `type`. Walking all of them unconditionally is the point: a
 * forbidden entry anywhere aborts the whole request before pass 2 (T-F.9).
 */
export function collectSceneImageRefs(payload: unknown): ImageRefSlot[] {
  const data = asRecord(payload);
  if (!data) return [];
  const slots: ImageRefSlot[] = [];

  const refine = asRecord(data.refine);
  if (refine) push(slots, "refine.sourceImage", refine.sourceImage);

  push(slots, "sceneReferenceImage", data.sceneReferenceImage);
  push(slots, "referenceImage", data.referenceImage);

  asArray(data.characters).forEach((raw, i) => {
    const c = asRecord(raw);
    if (c) push(slots, `characters[${i}].referenceImage`, c.referenceImage);
  });

  asArray(data.landmarks).forEach((raw, i) => {
    const lm = asRecord(raw);
    if (!lm) return;
    asArray(lm.referenceImages).forEach((img, j) => {
      push(slots, `landmarks[${i}].referenceImages[${j}]`, img);
    });
  });

  asArray(data.props).forEach((raw, i) => {
    const p = asRecord(raw);
    if (!p) return;
    asArray(p.referenceImages).forEach((img, j) => {
      push(slots, `props[${i}].referenceImages[${j}]`, img);
    });
  });

  // `type: 'prop'` sends a single prop object rather than an array.
  const prop = asRecord(data.prop);
  if (prop) {
    asArray(prop.referenceImages).forEach((img, j) => {
      push(slots, `prop.referenceImages[${j}]`, img);
    });
  }

  const character = asRecord(data.character);
  if (character) push(slots, "character.referenceImage", character.referenceImage);

  return slots;
}

/** Every image entry `generate-story` can be asked to analyse. */
export function collectStoryImageRefs(payload: unknown): ImageRefSlot[] {
  const data = asRecord(payload);
  if (!data) return [];
  const slots: ImageRefSlot[] = [];

  asArray(data.landmarks).forEach((raw, i) => {
    const lm = asRecord(raw);
    if (!lm) return;
    asArray(lm.referenceImages).forEach((img, j) => {
      push(slots, `landmarks[${i}].referenceImages[${j}]`, img);
    });
  });

  asArray(data.props).forEach((raw, i) => {
    const p = asRecord(raw);
    if (!p) return;
    asArray(p.referenceImages).forEach((img, j) => {
      push(slots, `props[${i}].referenceImages[${j}]`, img);
    });
  });

  asArray(data.characters).forEach((raw, i) => {
    const c = asRecord(raw);
    if (c) push(slots, `characters[${i}].referenceImage`, c.referenceImage);
  });

  return slots;
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
