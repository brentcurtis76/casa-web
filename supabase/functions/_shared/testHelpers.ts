/**
 * Shared test scaffolding for edge-function handler suites.
 *
 * Not a test file itself (no `_test.ts` suffix), so `deno test` does not pick
 * it up as a suite. The existing per-function handler tests predate this and
 * still carry their own copies; new suites (FASE F) import from here instead
 * of duplicating the harness a sixth time.
 */

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
