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
 * A story the `generate-story` contract accepts: 15 scenes numbered 1..15, one
 * protagonist, non-empty text everywhere, and an explicit empty `props`.
 *
 * Stub FIDELITY, not an expectation change (PD [PD8], and the same call PC r1 Q4
 * made for `finishReason`). Until PD this stub returned a text block holding a
 * ONE-scene story with no character role and no `props` — a shape the real API
 * does not produce under a forced strict tool, and one the new validator
 * rejects. Left alone it would have turned four story cases into 502s and
 * "proved" a regression that does not exist. None of the fields below is
 * observed by a captured outcome (status/code/fetched/providerImages/
 * providerCalls), and `corpus_baseline.json` is untouched.
 */
function storyToolInput(): Record<string, unknown> {
  return {
    title: "El faro de Ana",
    summary: "Un cuento sobre la esperanza.",
    characters: [{
      name: "Ana",
      role: "protagonist",
      description: "una niña del puerto",
      visualDescription: "chaleco rojo, pelo oscuro",
    }],
    scenes: Array.from({ length: 15 }, (_, i) => ({
      number: i + 1,
      text: `Ana camina por el muelle, escena ${i + 1}.`,
      visualDescription: `Muelle iluminado, plano ${i + 1}`,
    })),
    spiritualConnection: "Jesús es luz.",
    props: [],
  };
}

/**
 * The stub. Deterministic by construction:
 *   * any bucket object whose name contains "gone" 404s — that is how a draft
 *     citing a deleted object behaves;
 *   * any signed URL 400s, because those tokens are long expired;
 *   * every other bucket object returns a small PNG;
 *   * the provider returns one generated PNG (scene-images) or a valid
 *     strict-tool story (story), enough for either handler to report success.
 */
function stubFetch(url: string): Promise<Response> {
  if (isProvider(url)) {
    if (url.includes("anthropic")) {
      // The documented success protocol: `stop_reason: "tool_use"` plus exactly
      // one `tool_use` block named after the tool, carrying schema-valid input.
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "msg_01corpus",
            type: "message",
            role: "assistant",
            // Inert stub echo — nothing reads it and the read-only corpus
            // baseline captures no model string. Moved off the dated ID at
            // PREL integration to satisfy main's no-restricted-syntax guard.
            model: "claude-opus-5",
            stop_reason: "tool_use",
            content: [{
              type: "tool_use",
              id: "toolu_01corpus",
              name: "emit_story",
              input: storyToolInput(),
            }],
            usage: { input_tokens: 10, output_tokens: 20 },
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
