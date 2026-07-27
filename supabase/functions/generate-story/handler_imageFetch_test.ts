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
// b241eaf (the refactor-only commit). Cases marked "D" were added after the
// independent review and are base-red against the FIRST FASE F implementation.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import { DEFAULT_IMAGE_LIMITS, type ImageLimits } from "../_shared/imageFetch.ts";
import {
  AUTH_HEADER,
  BUCKET_PREFIX,
  dataUrl,
  GIF_B64,
  HEIC_B64,
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
  maxImagesPerRequest: 24,
  fetchTimeoutMs: 20_000,
  fetchConcurrency: 4,
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
    // Stops before Anthropic: the image phase is the subject here.
    previewPromptOnly: true,
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

function geminiTextResponse(): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: "descripción" }] } }] }),
    { status: 200 },
  );
}

/** Every inline image the handler sent to Gemini, across all analysis calls. */
function providerImages(
  calls: Array<{ init?: RequestInit }>,
): Array<{ mimeType: string; data: string }> {
  const out: Array<{ mimeType: string; data: string }> = [];
  for (const call of calls) {
    if (!call.init?.body) continue;
    const parsed = JSON.parse(String(call.init.body)) as {
      contents?: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
    };
    for (const part of parsed.contents?.[0]?.parts ?? []) {
      if (part.inlineData) out.push(part.inlineData);
    }
  }
  return out;
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
// T-F.0-story — production constants for the second consumer
// ---------------------------------------------------------------------------

// The sibling suite pins DEFAULT_IMAGE_LIMITS by value. This asserts the
// property that matters for THIS handler: it uses the same shared limits, so
// a change here cannot silently diverge between the two consumers.
Deno.test("T-F.0-story the shared production limits apply to this consumer too", () => {
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxImagesPerField, 4);
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxImagesPerRequest, 64);
  assert(
    DEFAULT_IMAGE_LIMITS.maxTotalImageBytes < DEFAULT_IMAGE_LIMITS.maxBodyBytes * 3 / 4,
    "aggregate budget must be reachable by inline input within the body cap",
  );
});

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
        props: [{ id: "p1", name: "Farol", referenceImages: [JPEG_B64()] }],
      }),
      { status: 422, code: "FORBIDDEN_ORIGIN" },
    );
    assertStrictEquals(body.field, "landmarks[0].referenceImages[1]");
  },
);

// `characters[].referenceImage` is never analysed by this function, so pass 2
// skips it — but pass 1 must still catch a forbidden URL parked there.
Deno.test("T-F.9b-story a forbidden URL in a never-analysed field still aborts", async () => {
  const body = await expectRejection(
    storyPayload({
      characters: [{ name: "Ana", referenceImage: "https://evil.example.com/x.png" }],
    }),
    { status: 422, code: "FORBIDDEN_ORIGIN" },
  );
  assertStrictEquals(body.field, "characters[0].referenceImage");
});

// ---------------------------------------------------------------------------
// FATAL — provenance, size, ceiling
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
    storyPayload({ props: [{ id: "p1", name: "Farol", referenceImages: [huge] }] }),
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
// Base had no ceiling; all images were sent for analysis.
//
// This is the DoS ceiling, not a per-story limit — see D1-story.
Deno.test("T-F.11-story more images than the absolute request ceiling is a 422", async () => {
  const landmarks = Array.from({ length: 9 }, (_, i) => ({
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
// DEGRADED — the review's cases, second consumer
// ---------------------------------------------------------------------------

// D1-story (review B1). Several landmarks each with photos is an ordinary
// payload. The per-field cap counted by field SHAPE, so the fifth photo across
// ALL landmarks tripped a four-per-field limit.
Deno.test("D1-story several landmarks with photos each are accepted", async () => {
  await withFetchSpy(async (spy) => {
    const landmarks = Array.from({ length: 5 }, (_, i) => ({
      name: `L${i}`,
      narrativeRole: "r",
      referenceImages: [PNG_B64()],
    }));
    const res = await createHandler(deps())(post(storyPayload({ landmarks })));

    assertStrictEquals(res.status, 200, "five landmarks with one photo each must be accepted");
    assertEquals(providerImages(spy.providerCalls).length, 5, "all five analysed");
  }, () => Promise.resolve(geminiTextResponse()));
});

// D2-story (review B3). A landmark photo deleted from the bucket must not
// block story generation.
Deno.test("D2-story a 404 on one photo drops it and the story still generates", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [`${BUCKET_PREFIX}/gone.png`, `${BUCKET_PREFIX}/here.png`],
        }],
      })),
    );
    assertStrictEquals(res.status, 200);
    assertEquals(providerImages(spy.providerCalls).length, 1, "the surviving photo is used");
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiTextResponse());
    if (url.includes("gone.png")) return Promise.resolve(new Response("nope", { status: 404 }));
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});

// D3-story (review B4). HEIC and GIF reach this function too.
Deno.test("D3-story an unsupported format is dropped, not fatal", async () => {
  for (const [label, image] of [["HEIC", HEIC_B64()], ["GIF", GIF_B64()]] as const) {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(storyPayload({
          props: [{ id: "p1", name: "Farol", referenceImages: [image, PNG_B64()] }],
        })),
      );
      assertStrictEquals(res.status, 200, `${label} must not fail the request`);
      assertEquals(providerImages(spy.providerCalls).length, 1, `${label} dropped, PNG kept`);
    }, () => Promise.resolve(geminiTextResponse()));
  }
});

// D4-story (review B5). A rethrown non-ImageRefError used to escape into
// `serve`'s CORS-less plain-text 500.
Deno.test("D4-story a body-stream failure still answers JSON with CORS", async () => {
  await withFetchSpy(async (spy) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"context":'));
        controller.error(new TypeError("connection reset"));
      },
    });
    const req = new Request("https://edge.test/generate-story", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADER },
      body: stream,
      // @ts-expect-error: Deno requires this for a streaming request body.
      duplex: "half",
    });

    const res = await createHandler(deps())(req);

    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
    assertEquals(res.headers.get("Content-Type"), "application/json");
    assertStrictEquals((await readJson(res)).success, false);
    assertEquals(spy.calls.length, 0);
  });
});

// D5-story (review B6). This handler analyses at most 4 photos per entity, and
// never analyses character photos at all — neither should be downloaded.
Deno.test("D5-story photos the handler will not analyse are not downloaded", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [
            `${BUCKET_PREFIX}/a.png`,
            `${BUCKET_PREFIX}/b.png`,
            `${BUCKET_PREFIX}/c.png`,
            `${BUCKET_PREFIX}/d.png`,
          ],
        }],
        characters: [{ name: "Ana", referenceImage: `${BUCKET_PREFIX}/never.png` }],
      })),
    );
    assertStrictEquals(res.status, 200);

    const downloaded = spy.calls.filter((c) => !c.url.includes("generativelanguage"));
    assert(
      !downloaded.some((c) => c.url.includes("never.png")),
      "character photos are never analysed and must not be downloaded",
    );
    assertEquals(downloaded.length, 4, "only the four analysed landmark photos are fetched");
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiTextResponse());
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});

// ---------------------------------------------------------------------------
// Format handling
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "MIME must come from the content, not from a client
// claim" — base sent ["image/jpeg", "image/jpeg", "image/jpeg", "image/png"]:
// it hard-defaulted every raw base64 payload to JPEG regardless of content,
// and for the data URL it echoed back whatever the client declared.
Deno.test(
  "T-F.rec-story PNG/JPEG/WebP/data-URL are accepted and sent with the sniffed MIME",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(storyPayload({
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [
              PNG_B64(),
              JPEG_B64(),
              WEBP_B64(),
              dataUrl("image/png", PNG_B64()),
            ],
          }],
        })),
      );
      assertStrictEquals(res.status, 200);

      const sent = providerImages(spy.providerCalls);
      assertEquals(sent.length, 4, "all four formats should reach the provider");
      assertEquals(
        sent.map((p) => p.mimeType),
        ["image/png", "image/jpeg", "image/webp", "image/png"],
        "MIME must come from the content, not from a client claim",
      );
      for (const part of sent) {
        assert(!part.data.startsWith("data:"), "data-URL wrapper must be stripped");
      }
    }, () => Promise.resolve(geminiTextResponse()));
  },
);

// A data URL whose declared media type contradicts its bytes is NOT an error:
// browsers derive `File.type` from the extension, so a JPEG saved as `.png` is
// routine (review L1). The sniffed type wins and the claim is discarded.
//
// BASE-RED @ b241eaf for the MIME value: base forwarded the client's claim
// ("image/gif") over PNG bytes. Base-red against the FIRST FASE F
// implementation for the status: it returned 422 NOT_IMAGE and failed the
// whole request.
Deno.test("T-F.8-story a data URL that misdeclares its type is accepted with the sniffed MIME", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(storyPayload({
        props: [{
          id: "p1",
          name: "Farol",
          referenceImages: [dataUrl("image/gif", PNG_B64())],
        }],
      })),
    );
    assertStrictEquals(res.status, 200);

    const sent = providerImages(spy.providerCalls);
    assertEquals(sent.length, 1);
    assertStrictEquals(sent[0].mimeType, "image/png", "the sniffed type wins over the claim");
  }, () => Promise.resolve(geminiTextResponse()));
});

// ---------------------------------------------------------------------------
// T-F.13-story — log hygiene
// ---------------------------------------------------------------------------

// NOT base-red at b241eaf: unlike generate-scene-images, generate-story never
// logged a URL or a base64 prefix to begin with, so the original version of
// this case passed before and after.
//
// It IS base-red against the FIRST FASE F implementation for the API-key
// assertion: the key travelled in the query string, and the provider-error
// catch logged the raw message including that URL. The stub therefore REJECTS
// here — an always-resolving stub never runs that catch.
Deno.test("T-F.13-story logs carry no URL, query string, base64, or API key", async () => {
  const token = "SIGNEDTOKEN123";
  const inline = PNG_B64(48);

  await withCapturedLogs(async (lines) => {
    await withFetchSpy(async () => {
      const res = await createHandler(deps())(
        post(storyPayload({
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [`${BUCKET_PREFIX}/faro.png?token=${token}`, inline],
          }],
        })),
      );
      await res.body?.cancel();
    }, (url) => {
      if (url.includes("generativelanguage")) {
        return Promise.reject(new TypeError(`error sending request for url (${url}): dns error`));
      }
      return Promise.resolve(streamingResponse(PNG_BYTES(48)));
    });

    const joined = lines.join("\n");
    assert(!joined.includes(token), "log leaked a query-string token");
    assert(!joined.includes("?token="), "log leaked a query string");
    assert(!joined.includes(BUCKET_PREFIX), "log leaked a bucket URL");
    assert(!joined.includes("https://"), "log leaked a URL");
    assert(!joined.includes("test-gemini-key"), "log leaked the provider API key");
    assert(!joined.includes(inline.slice(0, 24)), "log leaked a base64 prefix");
    assert(!joined.includes("iVBORw0KGgo"), "log leaked a base64 PNG prefix");
  });
});

// T-F.13b-story (review B10). The key must not be in the URL at all.
Deno.test("T-F.13b-story the provider key is sent as a header, never in the URL", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{ name: "Faro", narrativeRole: "guía", referenceImages: [PNG_B64()] }],
      })),
    );
    await res.body?.cancel();

    assert(spy.providerCalls.length > 0, "provider should have been called");
    for (const call of spy.providerCalls) {
      assert(!call.url.includes("test-gemini-key"), "key must not be in the URL");
      assert(!call.url.includes("key="), "key must not be a query parameter");
      assertStrictEquals(
        new Headers(call.init?.headers).get("x-goog-api-key"),
        "test-gemini-key",
      );
    }
  }, () => Promise.resolve(geminiTextResponse()));
});
