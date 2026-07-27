// FASE F — T-F.* image-safety suite for generate-story, through the
// PRODUCTION handler.
//
// generate-story is the second consumer of `_shared/imageFetch.ts`. Its
// exposure is different from generate-scene-images': it never downloaded
// anything itself, but it passed client-supplied strings straight into Gemini
// as `inlineData` with a client-declared MIME type, and it ran an unmetered
// location-research call to Gemini alongside the image analysis.
//
// That makes T-F.9 sharper here: pass 1 has to abort BEFORE `researchLocation`
// fires, which is a paid Gemini call that has nothing to do with images.
//
// Base-red evidence per case is in FASE_F_WRITEUP.md §3, measured against
// b241eaf (the refactor-only commit).

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import type { ImageLimits } from "../_shared/imageFetch.ts";
import {
  AUTH_HEADER,
  BUCKET_PREFIX,
  dataUrl,
  JPEG_B64,
  makeAuthzDeps,
  PNG_B64,
  PNG_BYTES,
  streamingResponse,
  TEST_SUPABASE_URL,
  WEBP_B64,
  withCapturedLogs,
  withFetchSpy,
} from "../_shared/testHelpers.ts";

const TEST_LIMITS: ImageLimits = {
  maxBodyBytes: 20_000,
  maxImageBytes: 2_000,
  maxTotalImageBytes: 5_000,
  maxImagesPerField: 4,
  maxImagesPerRequest: 12,
  fetchTimeoutMs: 20_000,
};

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    googleAiApiKey: "test-gemini-key",
    authzDeps: makeAuthzDeps().deps,
    supabaseUrl: TEST_SUPABASE_URL,
    imageLimits: TEST_LIMITS,
    ...overrides,
  };
}

function storyPayload(extra: Record<string, unknown> = {}) {
  return {
    context: { title: "Adviento", summary: "Esperanza" },
    location: "Valparaíso",
    style: "reflexivo",
    characters: [],
    landmarks: [],
    props: [],
    ...extra,
  };
}

function post(body: unknown): Request {
  return new Request("https://edge.test/generate-story", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>;
}

async function expectRejection(
  payload: unknown,
  expected: { status: number; code: string },
): Promise<Record<string, unknown>> {
  return await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post(payload));
    const body = await readJson(res);

    // Fetch counts are asserted FIRST: "nothing was fetched" is the property
    // FASE F adds, and it is what fails against the pre-change handler. A
    // status assertion ahead of it would mask the real defect behind a 500.
    assertEquals(spy.calls.length, 0, "pass 1 must reject before any fetch");
    assertEquals(spy.providerCalls.length, 0, "no provider call");
    assertStrictEquals(res.status, expected.status, `status (body=${JSON.stringify(body)})`);
    assertStrictEquals(body.code, expected.code, "error code");
    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
    return body;
  });
}

// ---------------------------------------------------------------------------
// T-F.9-story — the load-bearing one
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 8 fetches, 0
// expected. Base ran `researchLocation` and both image analyses in one
// Promise.all with no prevalidation at all, so the forbidden entry stopped
// nothing; every one of those 8 calls went to Gemini.
Deno.test(
  "T-F.9-story a forbidden entry aborts before researchLocation and every Gemini analysis",
  async () => {
    const body = await expectRejection(
      storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [PNG_B64(), "https://evil.example.com/steal.png"],
        }],
        props: [{
          id: "p1",
          name: "Farol",
          referenceImages: [JPEG_B64()],
        }],
      }),
      { status: 422, code: "FORBIDDEN_ORIGIN" },
    );
    assertStrictEquals(body.field, "landmarks[0].referenceImages[1]");
  },
);

// ---------------------------------------------------------------------------
// Provenance, size, and count — same contract, second consumer
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 6 fetches, 0
// expected. Base passed the raw string to Gemini as inlineData, unvalidated.
Deno.test("T-F.1-story a URL on another origin is rejected with zero fetches", async () => {
  await expectRejection(
    storyPayload({
      props: [{ id: "p1", name: "Farol", referenceImages: ["https://evil.example.com/x.png"] }],
    }),
    { status: 422, code: "FORBIDDEN_ORIGIN" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 6, 0 expected.
// Base had no scheme check.
Deno.test("T-F.4-story plain http is rejected", async () => {
  await expectRejection(
    storyPayload({
      landmarks: [{
        name: "Faro",
        narrativeRole: "guía",
        referenceImages: [
          "http://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/x.png",
        ],
      }],
    }),
    { status: 422, code: "INSECURE_SCHEME" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 6, 0 expected.
// Base had NO size guard here at all (the char cap existed only in
// generate-scene-images), so an arbitrarily large string went to Gemini.
Deno.test("T-F.10-story an oversized inline image is rejected on encoded length", async () => {
  const huge = "A".repeat(TEST_LIMITS.maxImageBytes * 4);
  await expectRejection(
    storyPayload({
      props: [{ id: "p1", name: "Farol", referenceImages: [huge] }],
    }),
    { status: 413, code: "IMAGE_TOO_LARGE" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 8, 0 expected.
// Base had no aggregate budget; the payload was accepted in full.
Deno.test("T-F.14-story inline images over the aggregate budget are a 413", async () => {
  const chunk = PNG_B64(TEST_LIMITS.maxImageBytes - 100);
  await expectRejection(
    storyPayload({
      landmarks: [
        { name: "A", narrativeRole: "r", referenceImages: [chunk, chunk] },
        { name: "B", narrativeRole: "r", referenceImages: [chunk] },
      ],
    }),
    { status: 413, code: "IMAGE_BUDGET_EXCEEDED" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 14, 0 expected.
// Base had no per-request count limit; all 15 images were sent for analysis.
Deno.test("T-F.11-story more images than the per-request maximum is a 422", async () => {
  const landmarks = Array.from({ length: 5 }, (_, i) => ({
    name: `L${i}`,
    narrativeRole: "r",
    referenceImages: [PNG_B64(), PNG_B64(), PNG_B64()],
  }));
  await expectRejection(storyPayload({ landmarks }), {
    status: 422,
    code: "TOO_MANY_IMAGES",
  });
});

// ---------------------------------------------------------------------------
// T-F.12-story — the body reader
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: status 500, expected 413. generate-story had NO body cap
// whatsoever — not even the content-length check generate-scene-images had —
// so JSON.parse ran on the whole body and the handler went on to Gemini.
Deno.test("T-F.12-story an over-cap body is a 413 raised before JSON.parse", async () => {
  const filler = "x".repeat(TEST_LIMITS.maxBodyBytes * 2);
  const oversizedBody = JSON.stringify(storyPayload({ additionalNotes: filler }));

  const originalParse = JSON.parse;
  let parseCalls = 0;
  JSON.parse = ((...args: Parameters<typeof JSON.parse>) => {
    parseCalls++;
    return originalParse(...args);
  }) as typeof JSON.parse;

  try {
    await withFetchSpy(async (spy) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(oversizedBody));
          controller.close();
        },
      });
      const req = new Request("https://edge.test/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADER },
        body: stream,
        // @ts-expect-error: Deno requires this for a streaming request body.
        duplex: "half",
      });
      assertStrictEquals(req.headers.get("content-length"), null);

      const res = await createHandler(deps())(req);
      const body = await readJson(res);

      assertStrictEquals(res.status, 413);
      assertStrictEquals(body.code, "BODY_TOO_LARGE");
      assertStrictEquals(parseCalls, 0, "JSON.parse must not run on an over-cap body");
      assertEquals(spy.calls.length, 0);
    });
  } finally {
    JSON.parse = originalParse;
  }
});

// ---------------------------------------------------------------------------
// T-F.13-story — log hygiene
// ---------------------------------------------------------------------------

// NOT base-red. Unlike generate-scene-images, generate-story never logged a
// URL or a base64 prefix in the first place, so this case passes before and
// after. It is here to keep the property enforced for the second consumer as
// FASE C/D change these code paths — labelled honestly rather than presented
// as proof of a fix.
Deno.test("T-F.13-story logs carry no URL, query string, or base64 payload", async () => {
  const token = "SIGNEDTOKEN123";
  const inline = PNG_B64(48);

  await withCapturedLogs(async (lines) => {
    await withFetchSpy(async () => {
      const res = await createHandler(deps())(
        post(storyPayload({
          previewPromptOnly: true,
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [
              `${BUCKET_PREFIX}/faro.png?token=${token}`,
              inline,
            ],
          }],
        })),
      );
      await res.body?.cancel();
    }, (url) => {
      if (url.includes("generativelanguage")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "descripción" }] } }],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(streamingResponse(PNG_BYTES(48)));
    });

    const joined = lines.join("\n");
    assert(!joined.includes(token), "log leaked a query-string token");
    assert(!joined.includes("?token="), "log leaked a query string");
    assert(!joined.includes(BUCKET_PREFIX), "log leaked a bucket URL");
    assert(!joined.includes(inline.slice(0, 24)), "log leaked a base64 prefix");
    assert(!joined.includes("iVBORw0KGgo"), "log leaked a base64 PNG prefix");
  });
});

// ---------------------------------------------------------------------------
// Recursive format coverage
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "MIME must come from the content, not from a client
// claim" — base sent ["image/jpeg", "image/jpeg", "image/jpeg", "image/png"]:
// it hard-defaulted every raw base64 payload to JPEG regardless of content,
// and for the data URL it echoed back whatever the client declared. This case
// also guards against the rejection tests passing by rejecting everything.
Deno.test(
  "T-F.rec-story PNG/JPEG/WebP/data-URL are accepted and sent with the sniffed MIME",
  async () => {
    const sent: Array<{ mimeType: string; data: string }> = [];

    await withFetchSpy(async () => {
      const res = await createHandler(deps())(
        post(storyPayload({
          previewPromptOnly: true,
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [
              PNG_B64(),
              JPEG_B64(),
              WEBP_B64(),
              // A data URL whose declared type matches its bytes.
              dataUrl("image/png", PNG_B64()),
            ],
          }],
        })),
      );
      assertStrictEquals(res.status, 200);
      await res.body?.cancel();
    }, (url, init) => {
      if (url.includes("generativelanguage") && init?.body) {
        const parsed = JSON.parse(String(init.body)) as {
          contents?: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
        };
        for (const part of parsed.contents?.[0]?.parts ?? []) {
          if (part.inlineData) sent.push(part.inlineData);
        }
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "descripción" }] } }],
          }),
          { status: 200 },
        ),
      );
    });

    // The analysis path caps at 4 images; all four formats survived pass 1.
    assertEquals(sent.length, 4, "all four formats should reach the provider");
    assertEquals(
      sent.map((p) => p.mimeType),
      ["image/png", "image/jpeg", "image/webp", "image/png"],
      "MIME must come from the content, not from a client claim",
    );
    // The data-URL wrapper is stripped before it reaches the provider.
    for (const part of sent) {
      assert(!part.data.startsWith("data:"), "data-URL wrapper must be stripped");
    }
  },
);

// A data URL whose declared media type contradicts its bytes is untrusted
// input, not a MIME to be trusted.
// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 6 fetches, 0
// expected. Base read the declared type out of the data URL with a regex and
// forwarded it verbatim to Gemini over PNG bytes.
Deno.test("T-F.8-story a data URL that misdeclares its media type is NOT_IMAGE", async () => {
  await expectRejection(
    storyPayload({
      props: [{
        id: "p1",
        name: "Farol",
        referenceImages: [dataUrl("image/gif", PNG_B64())],
      }],
    }),
    { status: 422, code: "NOT_IMAGE" },
  );
});
