/**
 * boundedBody — a real streaming byte cap for the small JSON payloads the text
 * handlers exchange: request bodies, and provider responses.
 *
 * ## What this replaces, and why it was not a limit
 *
 * The previous shape was `await source.text()` followed by a byte-length check.
 * That is post-hoc validation, not a bound: a headerless or chunked body was
 * pulled to completion and materialised in full BEFORE the cap was consulted,
 * so the cap only chose the status code. A caller could hand a handler with a
 * 4 KiB "limit" a hundred 1 KiB chunks and the isolate would buffer all 102,400
 * bytes across 101 pulls, then answer 413. The memory was already spent.
 *
 * Here the cap IS the read:
 *
 *   - A *valid* `content-length` over the cap is an early exit taken before the
 *     first pull. It is never the only check: a chunked sender can omit it, a
 *     hostile one can understate it, and either can send garbage. An
 *     unparseable, negative or fractional value proves nothing and is ignored —
 *     the stream still decides.
 *   - Otherwise the stream is pulled chunk by chunk and the running total is
 *     charged BEFORE the chunk is buffered. The first chunk that crosses the
 *     cap cancels the reader, discards everything buffered so far, and returns.
 *     Nothing past that chunk is pulled, and the bytes are never decoded or
 *     parsed.
 *
 * ## Failures are values, not exceptions
 *
 * Every outcome — a missing stream, a transport error mid-read, invalid UTF-8,
 * invalid JSON, a cancelled stream — comes back as `{ ok: false, reason }`.
 * Callers map a reason to a status and a fixed Spanish message; there is no
 * exception object for a handler to accidentally echo, log, or stringify, which
 * is what keeps these responses value-suppressed by construction.
 *
 * ## Why not `_shared/imageFetch.ts`
 *
 * That module already streams correctly and was the model for this one, but it
 * carries the image pipeline's error taxonomy (`ImageRefError`, per-entry
 * failure codes), its multi-megabyte budgets, and user-facing copy about
 * images. Coupling a 2 KiB Bible request to any of that would mean an image
 * error code deciding a Bible status. These handlers get the discipline without
 * the vocabulary.
 */

/** Why a bounded read did not produce a value. */
export type BoundedFailure =
  /** Over the cap — declared up front, or proven by the stream itself. */
  | "too_large"
  /** No readable stream, or the read failed part-way (peer hung up, abort). */
  | "unreadable"
  /** The bytes are not valid UTF-8, or not valid JSON. */
  | "invalid_json";

export type BoundedResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: BoundedFailure };

/**
 * `Request` and `Response` expose the same `headers` / `body` / `text()`
 * surface, so one reader bounds an incoming request and a provider reply alike.
 */
export type BoundedSource = Request | Response;

/**
 * A declared length is honoured only when it is a plain non-negative integer.
 * Anything else (absent, empty, `"abc"`, `"-1"`, `"1.5"`) tells us nothing, and
 * pretending otherwise would let a hostile sender choose the verdict.
 */
function declaredOverCap(source: BoundedSource, maxBytes: number): boolean {
  const raw = source.headers.get("content-length");
  if (raw === null || raw.trim() === "") return false;
  const declared = Number(raw.trim());
  if (!Number.isInteger(declared) || declared < 0) return false;
  return declared > maxBytes;
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

/**
 * Reads at most `maxBytes` from `source`, cancelling the stream the moment the
 * cap is crossed. The returned array is never longer than `maxBytes`.
 */
export async function readBoundedBytes(
  source: BoundedSource,
  maxBytes: number,
): Promise<BoundedResult<Uint8Array>> {
  if (declaredOverCap(source, maxBytes)) {
    // Rejected before the first pull; the stream is abandoned, not drained.
    await source.body?.cancel().catch(() => {});
    return { ok: false, reason: "too_large" };
  }

  const body = source.body;
  if (body === null) {
    // No stream to bound — a bodyless request, or a synthetic source built
    // without one. `text()` is still measured, so the cap holds here too.
    let text: string;
    try {
      text = await source.text();
    } catch {
      return { ok: false, reason: "unreadable" };
    }
    const bytes = new TextEncoder().encode(text);
    if (bytes.byteLength > maxBytes) return { ok: false, reason: "too_large" };
    return { ok: true, value: bytes };
  }

  const reader = body.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        chunks = [];
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "unreadable" };
      }
      if (result.done) break;
      const value = result.value;
      if (!value) continue;
      // Charged BEFORE buffering: this is what makes the cap bound memory
      // rather than merely describe the answer.
      total += value.byteLength;
      if (total > maxBytes) {
        chunks = []; // nothing read so far will ever be decoded or parsed
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released by cancel(); nothing to unwind.
    }
  }

  return { ok: true, value: concatChunks(chunks, total) };
}

/**
 * `readBoundedBytes` plus a strict UTF-8 decode and `JSON.parse`.
 *
 * The decoder is `fatal` on purpose: a lenient decode turns invalid bytes into
 * U+FFFD, which can sit inside a quoted string and produce a "valid" document
 * the sender never wrote. Malformed bytes are a malformed body.
 *
 * The result is `unknown` — callers own their own shape check, because "is this
 * an object" and "is this an array of verses" are different questions.
 */
export async function readBoundedJson(
  source: BoundedSource,
  maxBytes: number,
): Promise<BoundedResult<unknown>> {
  const bytes = await readBoundedBytes(source, maxBytes);
  if (!bytes.ok) return bytes;

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.value);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
