/**
 * Runs a corpus case against a handler under a fully deterministic stub, so
 * the only thing that can differ between two commits is handler logic.
 *
 * Shared by the capture script (which runs against `b241eaf`) and the corpus
 * test (which runs against HEAD). If these two ran the payload differently the
 * comparison would be meaningless, so they must both go through here.
 */

import type { CorpusCase } from "./corpus.ts";

export interface CorpusOutcome {
  status: number;
  /** Typed error code, when the response carries one. */
  code?: string;
  /** Bucket objects the handler downloaded, in order. */
  fetched: string[];
  /** How many inline images reached the provider. */
  providerImages: number;
  /** How many provider calls were made. */
  providerCalls: number;
}

const PROVIDER_HOSTS = ["generativelanguage.googleapis.com", "api.anthropic.com"];

function isProvider(url: string): boolean {
  return PROVIDER_HOSTS.some((h) => url.includes(h));
}

function pngBytes(size: number): Uint8Array {
  const out = new Uint8Array(size);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  for (let i = 8; i < size; i++) out[i] = i % 251;
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * The stub. Deterministic by construction:
 *   * any bucket object whose name contains "gone" 404s — that is how a draft
 *     citing a deleted object behaves;
 *   * any signed URL 400s, because those tokens are long expired;
 *   * every other bucket object returns a small PNG;
 *   * the provider returns one generated PNG (scene-images) or a short text
 *     (story), enough for either handler to report success.
 */
function stubFetch(url: string): Promise<Response> {
  if (isProvider(url)) {
    if (url.includes("anthropic")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{
              type: "text",
              text: JSON.stringify({
                title: "El faro de Ana",
                summary: "Un cuento sobre esperanza.",
                characters: [{ name: "Ana", description: "niña", visualDescription: "chaleco rojo" }],
                scenes: [{ number: 1, text: "Ana camina.", visualDescription: "muelle" }],
                spiritualConnection: "Jesús es luz.",
                moral: "La esperanza guía.",
              }),
            }],
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{
            // Stub fidelity, not an expectation change (PC r1 Q4). The real API
            // always reports a finish reason, and PC made `STOP` the condition
            // for consuming research text — so without this the story cases all
            // took the OUTPUT_BLOCKED path and the corpus never exercised
            // successful research at all. The captured outcome
            // (status/code/fetched/providerImages/providerCalls) does not
            // observe this field, and `corpus_baseline.json` is untouched.
            finishReason: "STOP",
            content: {
              parts: [
                { text: "descripción visual" },
                { inlineData: { mimeType: "image/png", data: toBase64(pngBytes(64)) } },
              ],
            },
          }],
        }),
        { status: 200 },
      ),
    );
  }

  if (url.includes("/object/sign/")) {
    return Promise.resolve(new Response("expired", { status: 400 }));
  }
  if (url.includes("gone")) {
    return Promise.resolve(new Response("not found", { status: 404 }));
  }
  const body = pngBytes(512);
  return Promise.resolve(
    new Response(body.buffer as ArrayBuffer, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    }),
  );
}

function countProviderImages(init?: RequestInit): number {
  if (!init?.body) return 0;
  try {
    const parsed = JSON.parse(String(init.body)) as {
      contents?: Array<{ parts: Array<{ inlineData?: unknown }> }>;
    };
    return (parsed.contents?.[0]?.parts ?? []).filter((p) => p.inlineData).length;
  } catch {
    return 0;
  }
}

/** Drives one case and reports what the handler did. */
export async function runCorpusCase(
  handler: (req: Request) => Promise<Response>,
  entry: CorpusCase,
): Promise<CorpusOutcome> {
  const fetched: string[] = [];
  let providerCalls = 0;
  let providerImages = 0;

  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    if (isProvider(url)) {
      providerCalls++;
      providerImages += countProviderImages(init);
    } else {
      // Recorded without the query string: a signed URL's token is a secret.
      fetched.push(url.split("?")[0]);
    }
    return stubFetch(url);
  }) as typeof fetch;

  try {
    const req = new Request(`https://edge.test/${entry.fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + "t".repeat(40),
      },
      body: JSON.stringify(entry.payload),
    });

    const res = await handler(req);
    let code: string | undefined;
    try {
      const body = await res.json() as { code?: string };
      code = body.code;
    } catch {
      // Non-JSON body: the outcome is the status alone.
    }

    return { status: res.status, code, fetched, providerImages, providerCalls };
  } finally {
    globalThis.fetch = original;
  }
}
