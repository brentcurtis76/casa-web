/**
 * Shared test scaffolding for edge-function handler suites.
 *
 * Not a test file itself (no `_test.ts` suffix), so `deno test` does not pick
 * it up as a suite. The existing per-function handler tests predate this and
 * still carry their own copies; new suites (FASE F) import from here instead
 * of duplicating the harness a sixth time.
 */

import { DRAFTS_BUCKET_PATH, encodeBase64 } from "./imageFetch.ts";
import type {
  CheckPermissionOutcome,
  GetUserOutcome,
  RequirePermissionDeps,
} from "./liturgyAuth.ts";

export type AuthzCall =
  | { kind: "getUser"; token: string }
  | {
    kind: "checkPermission";
    userId: string;
    resource: string;
    action: string;
  };

/**
 * Builds an injectable authz backend that records every call. Defaults to
 * "authenticated + allowed" so suites that are not about auth can ignore it.
 */
export function makeAuthzDeps(overrides: {
  getUser?: (token: string) => Promise<GetUserOutcome>;
  checkPermission?: (
    userId: string,
    resource: string,
    action: string,
  ) => Promise<CheckPermissionOutcome>;
} = {}): { deps: RequirePermissionDeps; calls: AuthzCall[] } {
  const calls: AuthzCall[] = [];
  const deps: RequirePermissionDeps = {
    getUser: async (token) => {
      calls.push({ kind: "getUser", token });
      if (overrides.getUser) return await overrides.getUser(token);
      return {
        kind: "authenticated",
        user: { id: "user-abc", email: "u@example.com" },
      };
    },
    checkPermission: async (userId, resource, action) => {
      calls.push({ kind: "checkPermission", userId, resource, action });
      if (overrides.checkPermission) {
        return await overrides.checkPermission(userId, resource, action);
      }
      return { kind: "allowed" };
    },
  };
  return { deps, calls };
}

/** An `Authorization` header that satisfies the guard's shape checks. */
export const AUTH_HEADER = {
  Authorization: "Bearer " + "t".repeat(40),
};

export interface FetchCall {
  url: string;
  init?: RequestInit;
}

export interface FetchSpy {
  /** Every fetch the subject attempted, in order. */
  calls: FetchCall[];
  /** Requests whose URL points at a Gemini or Anthropic endpoint. */
  providerCalls: FetchCall[];
}

function isProviderUrl(url: string): boolean {
  return url.includes("generativelanguage.googleapis.com") ||
    url.includes("api.anthropic.com");
}

/**
 * Replaces `globalThis.fetch` for the duration of `fn`, recording every call
 * and routing it to `respond`. The default `respond` throws, so any suite that
 * expects zero network traffic fails loudly rather than silently passing.
 */
export async function withFetchSpy<T>(
  fn: (spy: FetchSpy) => Promise<T>,
  respond?: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<T> {
  const spy: FetchSpy = { calls: [], providerCalls: [] };
  const original = globalThis.fetch;
  globalThis.fetch = ((
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    const call: FetchCall = { url, init };
    spy.calls.push(call);
    if (isProviderUrl(url)) spy.providerCalls.push(call);
    if (!respond) {
      throw new Error(`fetch should not be called in this test (url=${url})`);
    }
    return respond(url, init);
  }) as typeof fetch;
  try {
    return await fn(spy);
  } finally {
    globalThis.fetch = original;
  }
}

/** Wraps a Request so `json()` / `text()` invocations can be counted. */
export function spyRequest(
  input: string,
  init: RequestInit,
): { req: Request; json: { calls: number }; text: { calls: number } } {
  const req = new Request(input, init);
  const json = { calls: 0 };
  const text = { calls: 0 };
  const originalJson = req.json.bind(req);
  const originalText = req.text.bind(req);
  Object.defineProperty(req, "json", {
    value: async () => {
      json.calls++;
      return await originalJson();
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(req, "text", {
    value: async () => {
      text.calls++;
      return await originalText();
    },
    writable: true,
    configurable: true,
  });
  return { req, json, text };
}

/** Captures console output for log-hygiene assertions (T-F.13). */
export async function withCapturedLogs<T>(
  fn: (lines: string[]) => Promise<T>,
): Promise<T> {
  const lines: string[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };
  const record = (...args: unknown[]) => {
    lines.push(
      args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "),
    );
  };
  console.log = record;
  console.warn = record;
  console.error = record;
  console.info = record;
  try {
    return await fn(lines);
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
    console.info = original.info;
  }
}

// ---------------------------------------------------------------------------
// Image fixtures (FASE F)
// ---------------------------------------------------------------------------

/**
 * Synthetic images. `sniffImageMime` only reads the leading magic bytes, so a
 * short buffer with the right header is a faithful fixture and keeps the suite
 * fast — no multi-megabyte allocations to exercise a size cap.
 */
function withMagic(magic: number[], size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(magic, 0);
  for (let i = magic.length; i < size; i++) bytes[i] = i % 251;
  return bytes;
}

export const PNG_BYTES = (size = 64) =>
  withMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], size);
export const JPEG_BYTES = (size = 64) => withMagic([0xff, 0xd8, 0xff, 0xe0], size);

export const WEBP_BYTES = (size = 64) => {
  const bytes = withMagic([0x52, 0x49, 0x46, 0x46], size); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  return bytes;
};

/**
 * Formats the upload paths accept (`image/*`) but the provider path does not
 * sniff. An iPhone photo arrives as HEIC; a desktop drag-drop can be GIF.
 */
export const HEIC_BYTES = (size = 64) => {
  const bytes = withMagic([0x00, 0x00, 0x00, 0x18], size);
  bytes.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4); // "ftypheic"
  return bytes;
};
export const GIF_BYTES = (size = 64) =>
  withMagic([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], size); // "GIF89a"

/** An HTML error page — the payload T-F.8 serves as `Content-Type: image/png`. */
export const HTML_BYTES = () =>
  new TextEncoder().encode("<!doctype html><html><body>404</body></html>");

/** Re-exported so fixtures use the same encoder the module ships. */
export const toBase64 = encodeBase64;

export const PNG_B64 = (size = 64) => toBase64(PNG_BYTES(size));
export const JPEG_B64 = (size = 64) => toBase64(JPEG_BYTES(size));
export const WEBP_B64 = (size = 64) => toBase64(WEBP_BYTES(size));
export const HEIC_B64 = (size = 64) => toBase64(HEIC_BYTES(size));
export const GIF_B64 = (size = 64) => toBase64(GIF_BYTES(size));

export function dataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}

/** A response whose body is delivered in chunks, so cut-off can be observed. */
export function streamingResponse(
  bytes: Uint8Array,
  init: ResponseInit & { chunkSize?: number; onPull?: (index: number) => void } = {},
): Response {
  const chunkSize = init.chunkSize ?? 16;
  let offset = 0;
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      init.onPull?.(index++);
      controller.enqueue(bytes.subarray(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
  return new Response(stream, {
    status: init.status ?? 200,
    headers: init.headers ?? { "Content-Type": "image/png" },
  });
}

/** The bucket prefix these functions are pinned to. */
export const TEST_SUPABASE_URL = "https://proj.supabase.co";
export const BUCKET_PREFIX =
  `${TEST_SUPABASE_URL}${DRAFTS_BUCKET_PATH}`.replace(/\/$/, "");
