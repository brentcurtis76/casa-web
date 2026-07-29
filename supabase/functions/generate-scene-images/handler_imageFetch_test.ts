// FASE F — T-F.* image-safety suite, exercised through the PRODUCTION handler.
//
// Every case below drives `createHandler(...)` with a real Request and a
// stubbed `globalThis.fetch`. Nothing here asserts on a mock of the subject:
// the assertions are on the handler's HTTP response, on how many times fetch
// was called, on what reached the provider, and on what reached the console.
//
// Base-red: each case was run against b241eaf (the refactor-only commit that
// extracted this handler without changing behaviour). The recorded failure for
// each is quoted in the comment above it and tabulated in FASE_F_WRITEUP.md §3.
//
// ## Fatal vs degraded
//
// The suite is split along the policy the module implements. Provenance and
// resource guarantees fail the whole request (T-F.1-4, T-F.9-12, T-F.14);
// anything else drops one entry and lets generation continue (T-F.5-8 and the
// D-* cases). The D-* cases were added after review found that rejecting the
// whole request for a 404, an unsupported format, or an ordinary five-character
// cover broke flows the editor produces during normal use. Those are marked
// base-red against the FIRST FASE F implementation rather than against
// b241eaf, and say so.
//
// Limits are injected rather than hard-coded so a size cap can be exercised
// without allocating megabytes. T-F.0 pins the production constants and the
// relationship that makes the aggregate budget reachable, which is what keeps
// the injected-limit cases honest.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  collectSceneImageRefs,
  DEFAULT_IMAGE_LIMITS,
  type ImageLimits,
  redirectErrorFixture,
} from "../_shared/imageFetch.ts";
import {
  AUTH_HEADER,
  BUCKET_PREFIX,
  dataUrl,
  GIF_B64,
  HEIC_B64,
  HTML_BYTES,
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
  maxImageSlots: 64,
  fetchTimeoutMs: 20_000,
  fetchConcurrency: 4,
};

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    apiKey: "test-gemini-key",
    flashModel: "test-flash-model",
    proModel: "test-pro-model",
    authzDeps: makeAuthzDeps().deps,
    supabaseUrl: TEST_SUPABASE_URL,
    imageLimits: TEST_LIMITS,
    ...overrides,
  };
}

function scenePayload(extra: Record<string, unknown> = {}) {
  return {
    type: "scene",
    styleId: "storybook",
    scene: { text: "Ana camina por el puerto.", visualDescription: "puerto" },
    location: { name: "Valparaíso", description: "puerto" },
    characters: [],
    count: 1,
    ...extra,
  };
}

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request("https://edge.test/generate-scene-images", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>;
}

/** A character carrying one reference image. */
function charWith(image: string, name = "Ana") {
  return { name, visualDescription: "niña de 8 años", referenceImage: image };
}

/** A Gemini response carrying one generated PNG. */
function geminiImageResponse(): Response {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG_B64(64) } }] },
      }],
    }),
    { status: 200 },
  );
}

/** The inline images the handler actually sent to the provider. */
function providerImages(init?: RequestInit): Array<{ mimeType: string; data: string }> {
  if (!init?.body) return [];
  const parsed = JSON.parse(String(init.body)) as {
    contents?: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
  };
  return (parsed.contents?.[0]?.parts ?? [])
    .map((p) => p.inlineData)
    .filter((d): d is { mimeType: string; data: string } => !!d);
}

/** Drives the handler and asserts a typed rejection with zero network traffic. */
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
// T-F.0 — production constants
// ---------------------------------------------------------------------------

// Not base-red (the constants did not exist at base). This is the guard that
// keeps the injected-limit cases from being vacuous: it pins the shipped
// values AND the inequality that makes the aggregate budget reachable by
// inline input at all. base64 inflates by 4/3, so a body of `maxBodyBytes`
// decodes to at most 3/4 of it; if `maxTotalImageBytes` sat above that, T-F.14
// could never fire in production no matter what the test limits say.
//
// The whole object is pinned by equality. An earlier version listed fields
// individually and omitted `maxImagesPerField` — precisely the limit that
// carried the per-field counting bug, so setting it to 1 would have broken
// every multi-photo landmark with no test failing.
Deno.test("T-F.0 production limits are the shipped values and are mutually reachable", () => {
  assertEquals(DEFAULT_IMAGE_LIMITS, {
    maxBodyBytes: 20_000_000,
    maxImageBytes: 6_000_000,
    maxTotalImageBytes: 14_000_000,
    maxImagesPerField: 4,
    maxImagesPerRequest: 64,
    maxImageSlots: 512,
    fetchTimeoutMs: 20_000,
    fetchConcurrency: 4,
  });

  assert(
    DEFAULT_IMAGE_LIMITS.maxTotalImageBytes < DEFAULT_IMAGE_LIMITS.maxBodyBytes * 3 / 4,
    "aggregate budget must be reachable by inline input within the body cap",
  );
  assert(
    DEFAULT_IMAGE_LIMITS.maxImageBytes < DEFAULT_IMAGE_LIMITS.maxTotalImageBytes,
    "per-image cap must be below the aggregate",
  );
  // The request ceiling is a DoS guard, not the semantic 12-reference cap —
  // it must leave the handlers' own trim logic reachable.
  assert(
    DEFAULT_IMAGE_LIMITS.maxImagesPerRequest > 12,
    "request ceiling must sit above the 12-reference cap the handlers trim to",
  );
});

// ---------------------------------------------------------------------------
// FATAL — provenance
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5 fetches, 0
// expected. Base downloaded the foreign origin, then went on to Gemini.
Deno.test("T-F.1 a URL on another origin is rejected with zero fetches", async () => {
  const body = await expectRejection(
    scenePayload({ characters: [charWith("https://evil.example.com/x.png")] }),
    { status: 422, code: "FORBIDDEN_ORIGIN" },
  );
  assertStrictEquals(body.field, "characters[0].referenceImage");
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5, 0 expected.
Deno.test("T-F.2 a foreign bucket on the bucket host is rejected", async () => {
  await expectRejection(
    scenePayload({
      characters: [
        charWith(`${TEST_SUPABASE_URL}/storage/v1/object/public/other-bucket/x.png`),
      ],
    }),
    { status: 422, code: "FORBIDDEN_BUCKET" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5, 0 expected.
Deno.test("T-F.3 URL credentials and fragments are rejected", async () => {
  await expectRejection(
    scenePayload({
      characters: [
        charWith(
          `https://user:pass@proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/x.png`,
        ),
      ],
    }),
    { status: 422, code: "URL_CREDENTIALS" },
  );

  await expectRejection(
    scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/x.png#fragment`)] }),
    { status: 422, code: "URL_FRAGMENT" },
  );
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5, 0 expected.
// `isUrl()` accepted `http://` and base fetched it in the clear.
Deno.test("T-F.4 plain http is rejected", async () => {
  await expectRejection(
    scenePayload({
      characters: [
        charWith("http://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/x.png"),
      ],
    }),
    { status: 422, code: "INSECURE_SCHEME" },
  );
});

// Encoded path separators keep a literal `..` from being normalised away, so
// `..%2f` survived a `%2e%2e`-only test. Origin and prefix are still pinned,
// so this is defence in depth.
//
// BASE-RED against the FIRST FASE F implementation, not b241eaf (base fetched
// everything): `..%2fother-bucket/secret.png` passed pass 1 and reached fetch.
Deno.test("T-F.4b an encoded path separator is rejected", async () => {
  for (const suffix of ["..%2fother-bucket/secret.png", "..%5cother/secret.png"]) {
    await expectRejection(
      scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/${suffix}`)] }),
      { status: 422, code: "FORBIDDEN_BUCKET" },
    );
  }
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 7 fetches, 0
// expected. Base processed entries as it walked them, so both legitimate URLs
// were downloaded and Gemini was called before the forbidden entry mattered.
Deno.test(
  "T-F.9 one forbidden entry aborts everything: zero fetches AND zero provider calls",
  async () => {
    const payload = scenePayload({
      sceneReferenceImage: `${BUCKET_PREFIX}/ok.png`,
      characters: [
        charWith(`${BUCKET_PREFIX}/also-ok.png`),
        charWith("https://evil.example.com/steal.png", "Beto"),
      ],
      landmarks: [{ name: "Faro", referenceImages: [`${BUCKET_PREFIX}/faro.png`] }],
    });

    const body = await expectRejection(payload, { status: 422, code: "FORBIDDEN_ORIGIN" });
    assertStrictEquals(body.field, "characters[1].referenceImage");
  },
);

// Pass 2 is scoped to what the handler reads (D5), so this pins the other half
// of that split: pass 1 still validates EVERY entry, including ones that will
// never be downloaded. Otherwise scoping pass 2 would have opened a hole.
Deno.test("T-F.9b a forbidden URL in an unconsumed slot still aborts", async () => {
  const body = await expectRejection(
    scenePayload({
      landmarks: [{
        name: "Faro",
        // The handler reads only the first two of these.
        referenceImages: [PNG_B64(), PNG_B64(), "https://evil.example.com/deep.png"],
      }],
    }),
    { status: 422, code: "FORBIDDEN_ORIGIN" },
  );
  assertStrictEquals(body.field, "landmarks[0].referenceImages[2]");
});

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected, on the first variant. Base reached a forbidden URL parked in a
// nested props/landmarks entry only after fetching the earlier entries.
Deno.test(
  "T-F.rec pass 1 walks nested landmark/prop/refine fields for every image format",
  async () => {
    const nested: Array<[string, Record<string, unknown>, string]> = [
      [
        "landmarks[].referenceImages[] (PNG inline + forbidden sibling)",
        { landmarks: [{ name: "Faro", referenceImages: [PNG_B64(), "https://evil.example.com/a.png"] }] },
        "landmarks[0].referenceImages[1]",
      ],
      [
        "props[].referenceImages[] (JPEG inline + forbidden sibling)",
        { props: [{ name: "Farol", referenceImages: [JPEG_B64(), "https://evil.example.com/b.png"] }] },
        "props[0].referenceImages[1]",
      ],
      [
        "props[].referenceImages[] (WebP data-URL + forbidden sibling)",
        {
          props: [{
            name: "Bote",
            referenceImages: [dataUrl("image/webp", WEBP_B64()), "https://evil.example.com/c.png"],
          }],
        },
        "props[0].referenceImages[1]",
      ],
      [
        "refine.sourceImage",
        { refine: { sourceImage: "https://evil.example.com/d.png", feedback: "más luz" } },
        "refine.sourceImage",
      ],
    ];

    for (const [label, extra, expectedField] of nested) {
      const body = await expectRejection(scenePayload(extra), {
        status: 422,
        code: "FORBIDDEN_ORIGIN",
      });
      assertStrictEquals(body.field, expectedField, label);
    }
  },
);

// ---------------------------------------------------------------------------
// FATAL — size, body, and the absolute ceiling
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected. Base's only inline guard was a char-count throw inside the
// per-image path, which did not stop the rest of the request.
Deno.test(
  "T-F.10 an oversized inline image is rejected on encoded length, without decoding",
  async () => {
    const huge = "A".repeat(TEST_LIMITS.maxImageBytes * 4);

    const originalAtob = globalThis.atob;
    let atobCalls = 0;
    globalThis.atob = ((s: string) => {
      atobCalls++;
      return originalAtob(s);
    }) as typeof atob;

    try {
      const body = await expectRejection(
        scenePayload({ characters: [charWith(huge)] }),
        { status: 413, code: "IMAGE_TOO_LARGE" },
      );
      assertStrictEquals(body.field, "characters[0].referenceImage");
      assertStrictEquals(atobCalls, 0, "payload must not be decoded to reject it");
    } finally {
      globalThis.atob = originalAtob;
    }
  },
);

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected. Base had no per-request ceiling; every image was processed.
//
// This is the DoS ceiling, not the 12-reference cap — see D1/D1b for the
// ordinary payloads that must NOT hit it.
Deno.test("T-F.11 more images than the absolute request ceiling is a 422", async () => {
  const many = Array.from(
    { length: TEST_LIMITS.maxImagesPerRequest + 1 },
    (_, i) => charWith(PNG_B64(), `C${i}`),
  );
  const body = await expectRejection(scenePayload({ characters: many }), {
    status: 422,
    code: "TOO_MANY_IMAGES",
  });
  assertStrictEquals(body.field, "request");
});

// BASE-RED @ b241eaf: status 500, expected 413. Base only consulted the
// `content-length` header, so a body sent without one was parsed in full and
// the request proceeded to the provider.
Deno.test("T-F.12 an over-cap body is a 413 raised before JSON.parse", async () => {
  const filler = "x".repeat(TEST_LIMITS.maxBodyBytes * 2);
  const oversizedBody = JSON.stringify(scenePayload({ notes: filler }));

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
      const req = new Request("https://edge.test/generate-scene-images", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADER },
        body: stream,
        // @ts-expect-error: Deno requires this for a streaming request body.
        duplex: "half",
      });
      assertStrictEquals(
        req.headers.get("content-length"),
        null,
        "fixture must not declare a content-length",
      );

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

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5 fetches, 0
// expected. Base had no aggregate budget of any kind, only a per-image char
// cap, so the payload was accepted and the bucket URL was downloaded.
Deno.test(
  "T-F.14 inline images over the aggregate budget are a 413 before any fetch",
  async () => {
    const chunk = PNG_B64(TEST_LIMITS.maxImageBytes - 100);
    const payload = scenePayload({
      characters: [charWith(chunk, "A"), charWith(chunk, "B"), charWith(chunk, "C")],
      sceneReferenceImage: `${BUCKET_PREFIX}/never-fetched.png`,
    });

    const body = await expectRejection(payload, {
      status: 413,
      code: "IMAGE_BUDGET_EXCEEDED",
    });
    assertStrictEquals(body.field, "characters[2].referenceImage");
  },
);

// ---------------------------------------------------------------------------
// DEGRADED — the protection fires, the request survives
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: base passed no `redirect` option at all, so the runtime
// followed the redirect and used whatever it landed on. The refusal is the
// property; failing the whole request on top of it was the first FASE F
// implementation's over-reach, corrected here.
Deno.test("T-F.5 a redirecting bucket URL is refused and the image is dropped", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/x.png`)] })),
    );
    assertStrictEquals(res.status, 200);
    // The request must have asked the runtime to refuse redirects itself.
    assertStrictEquals(spy.calls[0].init?.redirect, "error");
    // ...and the redirected object never reached the provider.
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 0);
    // ...and it is reported as a REDIRECT, not as a generic download failure.
    // Status alone cannot show this: both codes are skippable, so a matcher
    // that never fires still yields a 200 with the image dropped.
    const body = await readJson(res);
    const skipped = body.skippedImages as Array<{ field: string; code: string }>;
    assertStrictEquals(
      skipped?.find((s) => s.field === "characters[0].referenceImage")?.code,
      "REDIRECT_REFUSED",
      "a refused redirect must be classified as one",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    // The VERBATIM message Deno raises, exported from the module so the stub
    // cannot drift from the runtime. The previous version invented
    // "redirect not allowed" — a string Deno never emits — which is why a
    // matcher that missed every real refused redirect passed this test.
    return Promise.reject(redirectErrorFixture());
  });
});

// BASE-RED @ b241eaf: base buffered the entire body via `arrayBuffer()` with
// no size check anywhere, so nothing was ever cut.
Deno.test("T-F.6 an oversized object is cut mid-stream, not buffered", async () => {
  const oversized = PNG_BYTES(TEST_LIMITS.maxImageBytes * 4);
  const pulls: number[] = [];

  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/big.png`)] })),
    );
    assertStrictEquals(res.status, 200);

    // The cut is what makes this different from a post-hoc size check: the
    // reader stopped well before the end of the stream.
    const pulledBytes = pulls.length * 256;
    assert(
      pulledBytes < oversized.byteLength / 2,
      `stream should be cut early, pulled ${pulledBytes} of ${oversized.byteLength}`,
    );
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 0, "oversized image dropped");
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(
      streamingResponse(oversized, { chunkSize: 256, onPull: (i) => pulls.push(i) }),
    );
  });
});

// BASE-RED @ b241eaf: base's download passed no `signal` at all — there was no
// timeout, so a hung Storage object hung the whole edge invocation.
Deno.test("T-F.7 a download timeout drops the image and the request survives", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/slow.png`)] })),
    );
    assertStrictEquals(res.status, 200);
    // Bounded by construction: the request carried an abort signal.
    assert(spy.calls[0].init?.signal instanceof AbortSignal, "download must carry an AbortSignal");
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 0);
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.reject(new DOMException("Signal timed out.", "TimeoutError"));
  });
});

// The property is "MIME comes from the content, never from Content-Type", so
// it takes BOTH directions to pin it. Asserting only that HTML-as-image/png is
// dropped does not discriminate: base dropped it too, via its base64-prefix
// check. What base got wrong was trusting `Content-Type` as a GATE — it
// refused a perfectly good PNG whose header said `text/html`.
//
// BASE-RED @ b241eaf on the second direction: base's
// `if (!contentType?.includes('image'))` returned '' for the text/html PNG, so
// 0 images reached the provider where 1 should have.
Deno.test("T-F.8 MIME is decided by content, not by Content-Type", async () => {
  // (a) HTML bytes labelled image/png => dropped. Invariant: base did this too.
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/fake.png`)] })),
    );
    assertStrictEquals(res.status, 200);
    assertEquals(
      providerImages(spy.providerCalls[0]?.init).length,
      0,
      "HTML must not be sent as an image",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(
      streamingResponse(HTML_BYTES(), { headers: { "Content-Type": "image/png" } }),
    );
  });

  // (b) A real PNG labelled text/html => USED. This is the direction that
  // fails at base, where Content-Type was a gate rather than a hint.
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/mislabelled.png`)] })),
    );
    assertStrictEquals(res.status, 200);
    const sent = providerImages(spy.providerCalls[0]?.init);
    assertEquals(sent.length, 1, "a real PNG must be used whatever its Content-Type says");
    assertStrictEquals(sent[0].mimeType, "image/png");
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(
      streamingResponse(PNG_BYTES(48), { headers: { "Content-Type": "text/html" } }),
    );
  });
});

// ---------------------------------------------------------------------------
// DEGRADED — cases the independent review added
// ---------------------------------------------------------------------------

// D1 (review B1). Five characters each with one photo is an ordinary cover
// request. The per-field cap counted by field SHAPE — `replace(/\[\d+\]/g,
// "[]")` collapsed `characters[0..4].referenceImage` into ONE counter — so the
// fifth tripped a four-per-field limit.
//
// BASE-RED against the FIRST FASE F implementation, reproduced directly
// against the module: "TOO_MANY_IMAGES @ characters[].referenceImage".
// Passes at b241eaf (base had no cap at all), so this is a regression test for
// FASE F's own defect, not for base.
Deno.test("D1 five characters with one reference photo each are accepted", async () => {
  await withFetchSpy(async (spy) => {
    const characters = Array.from({ length: 5 }, (_, i) => charWith(PNG_B64(), `C${i}`));
    const res = await createHandler(deps())(
      post(scenePayload({ type: "cover", title: "T", protagonist: "P", characters })),
    );

    assertStrictEquals(res.status, 200, "an ordinary five-character cover must not be rejected");
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 5, "all five must be sent");
  }, () => Promise.resolve(geminiImageResponse()));
});

// D1b — the per-field cap still bounds ONE array instance, by dropping rather
// than rejecting. This is what keeps D1's fix from disabling the cap.
Deno.test("D1b entries past the per-field cap in one array are dropped, not rejected", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({
        landmarks: [{
          name: "Faro",
          visualDescription: "faro rojo",
          // Six in one array: over the 4-per-field cap AND over the 2 the
          // handler consumes.
          referenceImages: Array.from({ length: 6 }, () => PNG_B64()),
        }],
        scene: { text: "t", visualDescription: "v", landmarkVisible: true },
      })),
    );
    assertStrictEquals(res.status, 200, "extra entries are dropped, not fatal");
    assertEquals(
      providerImages(spy.providerCalls[0]?.init).length,
      2,
      "only the entries the handler consumes are sent",
    );
  }, () => Promise.resolve(geminiImageResponse()));
});

// D2 (review B3). A draft keeps bucket URLs after the object is deleted. Base
// returned '' and filtered; the first FASE F implementation 422'd the whole
// generation, permanently, with no UI path to clear the dead reference.
Deno.test("D2 a 404 on one reference drops that image and still generates", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({
        characters: [
          charWith(`${BUCKET_PREFIX}/gone.png`, "Ana"),
          charWith(`${BUCKET_PREFIX}/here.png`, "Beto"),
        ],
      })),
    );
    const body = await readJson(res);

    assertStrictEquals(
      res.status,
      200,
      `a dead reference must not fail generation: ${JSON.stringify(body)}`,
    );
    assertEquals(
      providerImages(spy.providerCalls[0]?.init).length,
      1,
      "the surviving reference is still used",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    if (url.includes("gone.png")) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});

// D3 (review B4). The upload paths gate on `image/*` only, so HEIC from an
// iPhone and GIF from a desktop both reach the function as raw base64.
Deno.test("D3 an unsupported format is dropped, not fatal", async () => {
  for (const [label, image] of [["HEIC", HEIC_B64()], ["GIF", GIF_B64()]] as const) {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({
          characters: [charWith(image, "Ana"), charWith(PNG_B64(), "Beto")],
        })),
      );
      assertStrictEquals(res.status, 200, `${label} must not fail the request`);
      assertEquals(
        providerImages(spy.providerCalls[0]?.init).length,
        1,
        `${label} dropped, the PNG kept`,
      );
    }, () => Promise.resolve(geminiImageResponse()));
  }
});

// D4 (review B5). A non-ImageRefError thrown in the image phase used to be
// rethrown from a catch that sat OUTSIDE the try producing the JSON+CORS 500,
// so it escaped the handler and `serve` answered plain text with no CORS
// header — the browser then reported a CORS failure instead of the real error.
Deno.test("D4 a body-stream failure still answers JSON with CORS", async () => {
  await withFetchSpy(async (spy) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"scene"'));
        controller.error(new TypeError("connection reset"));
      },
    });
    const req = new Request("https://edge.test/generate-scene-images", {
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
    const body = await readJson(res);
    assertStrictEquals(body.success, false);
    assertEquals(spy.calls.length, 0);
  });
});

// D5 (review B6). The collector emits every nested entry so pass 1 sees it,
// but pass 2 must only download what the handler will read — otherwise dead
// bytes are fetched, base64-encoded, and charged against the aggregate.
Deno.test("D5 references the handler will not read are validated but not downloaded", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({
        landmarks: [{
          name: "Faro",
          visualDescription: "faro rojo",
          // The handler reads 2; entries 2 and 3 must not be fetched.
          referenceImages: [
            `${BUCKET_PREFIX}/a.png`,
            `${BUCKET_PREFIX}/b.png`,
            `${BUCKET_PREFIX}/c.png`,
            `${BUCKET_PREFIX}/d.png`,
          ],
        }],
        scene: { text: "t", visualDescription: "v", landmarkVisible: true },
      })),
    );
    assertStrictEquals(res.status, 200);

    const downloaded = spy.calls.filter((c) => !c.url.includes("generativelanguage"));
    assertEquals(downloaded.length, 2, "only the consumed entries are downloaded");
    assert(!downloaded.some((c) => c.url.includes("c.png")), "c.png must not be fetched");
    assert(!downloaded.some((c) => c.url.includes("d.png")), "d.png must not be fetched");
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});

// D6 (review B8). When the aggregate budget is what is binding, the cut-off
// used to report IMAGE_TOO_LARGE quoting the *residual* budget — telling the
// user a 2 KB image exceeded 1 KB while the per-image cap was 6 KB.
Deno.test("D6 budget exhaustion is reported as IMAGE_BUDGET_EXCEEDED, not IMAGE_TOO_LARGE", async () => {
  const skipLines: string[] = [];
  await withCapturedLogs(async (lines) => {
    await withFetchSpy(async () => {
      // Two inline images, each comfortably UNDER the per-image cap, together
      // eat most of the aggregate. The remaining budget is then smaller than
      // the per-image cap, which is the condition that used to mislabel the
      // cut-off. The download itself is well within maxImageBytes.
      const inline = PNG_B64(TEST_LIMITS.maxImageBytes - 100);
      const res = await createHandler(deps())(
        post(scenePayload({
          characters: [
            charWith(inline, "Ana"),
            charWith(inline, "Beto"),
            charWith(`${BUCKET_PREFIX}/mid.png`, "Caro"),
          ],
        })),
      );
      assertStrictEquals(res.status, 200, "budget pressure drops an image, it does not fail");
    }, (url) => {
      if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
      // Under the per-image cap, but larger than the residual budget.
      return Promise.resolve(streamingResponse(PNG_BYTES(1_800), { chunkSize: 128 }));
    });
    skipLines.push(...lines.filter((l) => l.includes("skipped")));
  });

  assert(
    skipLines.some((l) => l.includes("IMAGE_BUDGET_EXCEEDED")),
    `budget exhaustion must be labelled as such, got: ${skipLines.join(" | ")}`,
  );
  assert(
    !skipLines.some((l) => l.includes("IMAGE_TOO_LARGE")),
    "must not blame the individual image's size",
  );
});

// D6b — the aggregate budget must hold even though pass 2 runs concurrently.
// Reservations are taken synchronously before each await, so total bytes in
// flight can never exceed the budget; a starved worker waits for a peer's
// refund rather than dropping an image that would have fitted.
Deno.test("D6b concurrent downloads never exceed the aggregate budget", async () => {
  const perObject = 1_500;
  let downloadedBytes = 0;

  await withFetchSpy(async (spy) => {
    // Eight bucket-hosted references, 1.5 KB each = 12 KB of demand against a
    // 5 KB budget, fetched with 4 lanes.
    const characters = Array.from(
      { length: 8 },
      (_, i) => charWith(`${BUCKET_PREFIX}/o${i}.png`, `C${i}`),
    );
    const res = await createHandler(deps())(post(scenePayload({ characters })));
    assertStrictEquals(res.status, 200);

    // The memory guarantee: what the request RETAINS never exceeds the
    // budget. (Bytes pulled off the wire can exceed it by at most the chunk
    // that trips each cut-off — streaming cannot cut mid-chunk — but those
    // are charged to the budget and never buffered.)
    const retained = providerImages(spy.providerCalls[0]?.init)
      .reduce((sum, p) => sum + p.data.length * 3 / 4, 0);
    assert(
      retained <= TEST_LIMITS.maxTotalImageBytes,
      `retained ${retained} B, budget is ${TEST_LIMITS.maxTotalImageBytes} B`,
    );
    assert(
      downloadedBytes <= TEST_LIMITS.maxTotalImageBytes + 8 * 128,
      `wire bytes ${downloadedBytes} B exceed the budget plus one chunk per cut-off`,
    );
    // ...and the budget was actually put to use rather than starved away by
    // over-eager reservations: at least two objects made it through.
    assert(
      providerImages(spy.providerCalls[0]?.init).length >= 2,
      "reservations must not starve downloads that fit",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(
      streamingResponse(PNG_BYTES(perObject), {
        chunkSize: 128,
        onPull: () => {
          downloadedBytes += 128;
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Refine — fail-closed, with the reason preserved
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: status 500, expected 422. Base logged "no procesable"
// and carried on WITHOUT the source image — a silent regeneration from
// scratch, which is precisely the failure mode invariant 11 calls out.
//
// Refine is the one path that stays fail-closed under the degradation policy.
Deno.test(
  "refine with an unavailable source is 422 REFINE_SOURCE_UNAVAILABLE",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({
          refine: { sourceImage: `${BUCKET_PREFIX}/gone.png`, feedback: "más luz" },
        })),
      );
      const body = await readJson(res);

      assertStrictEquals(res.status, 422);
      assertStrictEquals(body.code, "REFINE_SOURCE_UNAVAILABLE");
      assertStrictEquals(body.field, "refine.sourceImage");
      assertEquals(
        spy.providerCalls.length,
        0,
        "must not regenerate from scratch when the source is gone",
      );
    }, () => Promise.resolve(new Response("not found", { status: 404 })));
  },
);

// D7 (review B7). An oversized refine source is a size problem the user can
// act on. Collapsing it into REFINE_SOURCE_UNAVAILABLE told someone with a
// 4K pro-tier cover to go check whether their image existed.
Deno.test("D7 an oversized refine source reports its size, not unavailability", async () => {
  await withFetchSpy(async () => {
    const res = await createHandler(deps())(
      post(scenePayload({
        refine: { sourceImage: `${BUCKET_PREFIX}/huge.png`, feedback: "más luz" },
      })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 413);
    assertStrictEquals(body.code, "IMAGE_TOO_LARGE");
    assertStrictEquals(body.field, "refine.sourceImage");
  }, () =>
    Promise.resolve(
      streamingResponse(PNG_BYTES(TEST_LIMITS.maxImageBytes * 3), { chunkSize: 256 }),
    ));
});

// L5 (review, pre-existing at base): user feedback was passed to
// String.replace as a REPLACEMENT STRING, so `$&`, `$'` and `` $` `` were
// interpreted as substitution patterns and silently garbled the instruction.
Deno.test("refine feedback containing $-patterns reaches the prompt verbatim", async () => {
  await withFetchSpy(async (spy) => {
    const feedback = "usa $& y $' y $` y $$ tal cual";
    const res = await createHandler(deps())(
      post(scenePayload({
        refine: { sourceImage: PNG_B64(), feedback },
      })),
    );
    assertStrictEquals(res.status, 200);

    const sent = JSON.parse(String(spy.providerCalls[0]?.init?.body)) as {
      contents: Array<{ parts: Array<{ text?: string }> }>;
    };
    const text = sent.contents[0].parts.map((p) => p.text ?? "").join("\n");
    assert(text.includes(feedback), "feedback must survive verbatim");
    assert(!text.includes("{feedback}"), "the template token must be substituted");
  }, () => Promise.resolve(geminiImageResponse()));
});

// ---------------------------------------------------------------------------
// Accepted formats
// ---------------------------------------------------------------------------

// Each accepted format survives pass 1 and reaches the provider — the mirror
// image of the rejection cases, so they cannot pass by rejecting everything.
// NOT base-red: this is an invariant that held before and after.
Deno.test("T-F.rec2 PNG, JPEG, WebP and data-URL inline images are accepted", async () => {
  const accepted = [
    PNG_B64(),
    JPEG_B64(),
    WEBP_B64(),
    dataUrl("image/png", PNG_B64()),
    dataUrl("image/jpeg", JPEG_B64()),
    // A JPEG the browser labelled image/png because the file was named `.png`
    // — `File.type` comes from the extension. The sniffed type wins and the
    // claim is discarded rather than rejected (review L1).
    dataUrl("image/png", JPEG_B64()),
  ];

  for (const image of accepted) {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({ characters: [charWith(image)] })),
      );
      assertStrictEquals(res.status, 200, `format rejected: ${image.slice(0, 12)}`);
      const sent = providerImages(spy.providerCalls[0]?.init);
      assertEquals(sent.length, 1);
    }, () => Promise.resolve(geminiImageResponse()));
  }
});

// ---------------------------------------------------------------------------
// T-F.13 — log hygiene
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "log leaked a query-string token". Base logged the URL
// (`url.slice(0, 150)`), the fetch target, and a base64 prefix for every
// reference image and every generated image.
//
// The provider stub REJECTS here. An earlier version always resolved, so the
// catch that logs the provider error never ran — and that catch was the one
// leaking the API key, which used to travel in the query string.
Deno.test("T-F.13 logs carry no URL, query string, or base64 payload", async () => {
  const token = "SIGNEDTOKEN123";
  const inline = PNG_B64(48);

  await withCapturedLogs(async (lines) => {
    await withFetchSpy(async () => {
      const res = await createHandler(deps())(
        post(scenePayload({
          sceneReferenceImage: `${BUCKET_PREFIX}/ref.png?token=${token}`,
          characters: [charWith(inline)],
        })),
      );
      await res.body?.cancel();
    }, (url) => {
      if (url.includes("generativelanguage")) {
        // A realistic runtime network error: Deno embeds the request URL in
        // the message, which is how a key in the query string reached the log.
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

// T-F.13b (review B10). The key must not be in the URL at all — that is what
// put it in the logs, since runtime network errors quote the request URL.
Deno.test("T-F.13b the provider key is sent as a header, never in the URL", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post(scenePayload()));
    await res.body?.cancel();

    const call = spy.providerCalls[0];
    assert(call, "provider should have been called");
    assert(!call.url.includes("test-gemini-key"), "key must not be in the URL");
    assert(!call.url.includes("key="), "key must not be a query parameter");
    const headers = new Headers(call.init?.headers);
    assertStrictEquals(headers.get("x-goog-api-key"), "test-gemini-key");
  }, () => Promise.resolve(geminiImageResponse()));
});

// ---------------------------------------------------------------------------
// R-* — review round 2. Base-red against 5e60e1c.
// ---------------------------------------------------------------------------

// R1 (round-2 dominant root cause). Pass 1 applied FATAL size checks to entries
// the handler never reads. A landmark whose first two photos are the only ones
// used could be killed by a 7 MB photo sitting at index 2 — a slot the old
// `slice(0, 2)` never looked at.
Deno.test("R1 an oversized photo in a slot the handler never reads is not fatal", async () => {
  await withFetchSpy(async (spy) => {
    const oversized = "A".repeat(TEST_LIMITS.maxImageBytes * 4);
    const res = await createHandler(deps())(
      post(scenePayload({
        landmarks: [{
          name: "Faro",
          visualDescription: "faro rojo",
          // Indices 0-1 are consumed; the oversized entry sits at index 2.
          referenceImages: [PNG_B64(), PNG_B64(), oversized],
        }],
        scene: { text: "t", visualDescription: "v", landmarkVisible: true },
      })),
    );
    assertStrictEquals(res.status, 200, "an unused slot must not fail the request");
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 2);
  }, () => Promise.resolve(geminiImageResponse()));
});

// R1b — the aggregate budget was charged for unconsumed inline entries too, so
// photos nothing reads could 413 a request whose real images fit easily.
Deno.test("R1b unread inline photos are not charged to the aggregate budget", async () => {
  await withFetchSpy(async (spy) => {
    const big = PNG_B64(TEST_LIMITS.maxImageBytes - 100);
    // Two landmarks x (2 consumed + 2 unread). The four unread entries total
    // ~7.6 KB against a 5 KB budget; the four consumed ones total ~256 B.
    const landmark = (name: string) => ({
      name,
      visualDescription: "referencia",
      referenceImages: [PNG_B64(), PNG_B64(), big, big],
    });
    const res = await createHandler(deps())(
      post(scenePayload({
        landmarks: [landmark("Faro"), landmark("Muelle")],
        scene: { text: "t", visualDescription: "v", landmarkVisible: true },
      })),
    );
    assertStrictEquals(res.status, 200, "unread bytes must not exhaust the budget");
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 4);
  }, () => Promise.resolve(geminiImageResponse()));
});

// R1c — the request ceiling counted RAW slots, so a long-lived draft that had
// accumulated prop photos (the editor appends with no per-photo delete) was
// rejected even though the handler would have sliced almost all of them off.
Deno.test("R1c the request ceiling counts images actually used, not raw slots", async () => {
  await withFetchSpy(async (spy) => {
    // 10 props x 4 photos = 40 raw slots, well past maxImagesPerRequest (24),
    // but only the first 2 of each are consumed (20) — and the handler's own
    // trim then takes it to 12. Counting raw slots rejected this outright.
    const props = Array.from({ length: 10 }, (_, i) => ({
      name: `P${i}`,
      visualDescription: "objeto",
      referenceImages: [PNG_B64(), PNG_B64(), PNG_B64(), PNG_B64()],
    }));
    const res = await createHandler(deps())(post(scenePayload({ props })));
    assertStrictEquals(res.status, 200, "surplus the handler slices off must not reject");
    assert(
      providerImages(spy.providerCalls[0]?.init).length <= 12,
      "the handler's own 12-reference trim still applies",
    );
  }, () => Promise.resolve(geminiImageResponse()));
});

// R2 — entries past the per-field cap were dropped BEFORE validation, so a
// forbidden URL parked at index 5 of a landmark was never even looked at.
// Provenance became position-dependent, which is exactly what T-F.9 forbids.
Deno.test("R2 a forbidden URL past the per-field cap is still caught", async () => {
  const body = await expectRejection(
    scenePayload({
      landmarks: [{
        name: "Faro",
        referenceImages: [
          PNG_B64(),
          PNG_B64(),
          PNG_B64(),
          PNG_B64(),
          // Index 4: past maxImagesPerField (4). Previously dropped unchecked.
          "https://evil.example.com/hidden.png",
        ],
      }],
    }),
    { status: 422, code: "FORBIDDEN_ORIGIN" },
  );
  assertStrictEquals(body.field, "landmarks[0].referenceImages[4]");
});

// R4 — a download that completed but failed the magic-byte sniff refunded its
// whole reservation, so a run of unsniffable objects could pull several times
// the aggregate budget off the wire. Same class as the D6b cut-off bug.
Deno.test("R4 bytes spent on an unsniffable download are charged to the budget", async () => {
  let wireBytes = 0;
  await withFetchSpy(async () => {
    // Eight objects, each just under the per-image cap, all HTML. If their
    // bytes are refunded, all eight download; if charged, the budget stops it.
    const characters = Array.from(
      { length: 8 },
      (_, i) => charWith(`${BUCKET_PREFIX}/junk${i}.png`, `C${i}`),
    );
    const res = await createHandler(deps())(post(scenePayload({ characters })));
    assertStrictEquals(res.status, 200);
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    const junk = new TextEncoder().encode("<html>".repeat(300));
    return Promise.resolve(
      streamingResponse(junk, {
        chunkSize: 128,
        onPull: () => {
          wireBytes += 128;
        },
      }),
    );
  });

  assert(
    wireBytes <= TEST_LIMITS.maxTotalImageBytes + 8 * 128,
    `unsniffable downloads pulled ${wireBytes} B against a ${TEST_LIMITS.maxTotalImageBytes} B budget`,
  );
});

// R5 — the starvation wait only triggered at EXACTLY zero remaining. A 1-byte
// sliver passed `reserved > 0`, so the download was capped at one byte and cut
// off, reporting a budget failure for an image that would have fitted the
// moment a peer refunded.
Deno.test("R5 a sliver of remaining budget does not cut off an image that fits", async () => {
  await withFetchSpy(async (spy) => {
    // Three 1500 B downloads against a 5000 B budget with a 2000 B per-image
    // cap. The first two reserve 2000 each, leaving a 1000 B sliver: enough to
    // pass "reserved > 0" and cut the third off at 1000 B, even though once
    // the peers refund their unused 500 each there is room for it.
    const res = await createHandler(deps())(
      post(scenePayload({
        characters: [
          charWith(`${BUCKET_PREFIX}/a.png`, "Ana"),
          charWith(`${BUCKET_PREFIX}/b.png`, "Beto"),
          charWith(`${BUCKET_PREFIX}/c.png`, "Caro"),
        ],
      })),
    );
    assertStrictEquals(res.status, 200);
    assertEquals(
      providerImages(spy.providerCalls[0]?.init).length,
      3,
      "a download that fits once peers refund must not be cut off by a sliver",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(streamingResponse(PNG_BYTES(1_500), { chunkSize: 128 }));
  });
});

// R6 — a refine whose sourceImage is not a string fell through with
// `refine === undefined`, turning the request into a full regeneration and
// silently discarding the image the user asked to refine.
Deno.test("R6 a refine with a non-string source fails closed", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ refine: { sourceImage: 12345, feedback: "más luz" } })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 422);
    assertStrictEquals(body.code, "REFINE_SOURCE_UNAVAILABLE");
    assertEquals(
      spy.providerCalls.length,
      0,
      "must not regenerate from scratch behind the user's back",
    );
  });
});

// R7 — drafts written before 2026-01-11 stored signed characterSheetUrls.
// Treating that URL SHAPE as forbidden made one stale sheet a fatal 422 for
// every later generation on the story. The token is expired, so the object
// 404s and the entry is skipped — degrade, not brick.
Deno.test("R7 a legacy signed bucket URL degrades instead of bricking the story", async () => {
  await withFetchSpy(async (spy) => {
    const signed =
      `${TEST_SUPABASE_URL}/storage/v1/object/sign/cuentacuentos-drafts/old.png?token=expired`;
    const res = await createHandler(deps())(
      post(scenePayload({
        characters: [charWith(signed, "Ana"), charWith(PNG_B64(), "Beto")],
      })),
    );
    assertStrictEquals(res.status, 200, "a stale signed URL must not fail generation");
    assertEquals(
      providerImages(spy.providerCalls[0]?.init).length,
      1,
      "the good reference is still used",
    );
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(new Response("expired", { status: 400 }));
  });
});

// R8 — dropped entries were only ever console.warn'd, so no client could tell
// a silently-missing reference from one that was used.
Deno.test("R8 dropped entries are reported to the client, not just logged", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({
        characters: [charWith(HEIC_B64(), "Ana"), charWith(PNG_B64(), "Beto")],
      })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 200);
    const skipped = body.skippedImages as Array<{ field: string; code: string }>;
    assert(Array.isArray(skipped), "response must carry skippedImages");
    const heic = skipped.find((s) => s.field === "characters[0].referenceImage");
    assert(heic, `the dropped HEIC must be reported, got ${JSON.stringify(skipped)}`);
    assertStrictEquals(heic.code, "NOT_IMAGE");
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 1);
  }, () => Promise.resolve(geminiImageResponse()));
});

// R9 — an unsupported refine source was reported as REFINE_SOURCE_UNAVAILABLE,
// sending the user to check whether an image they were looking at still
// existed. The format is the actionable fact.
Deno.test("R9 an unsupported refine source reports the format, not availability", async () => {
  await withFetchSpy(async () => {
    const res = await createHandler(deps())(
      post(scenePayload({ refine: { sourceImage: HEIC_B64(), feedback: "más luz" } })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 422);
    assertStrictEquals(body.code, "NOT_IMAGE");
    assertStrictEquals(body.field, "refine.sourceImage");
  });
});

// ---------------------------------------------------------------------------
// PF [B1] — the consumption plan
//
// `consumed` used to be request-type-blind: the collector marked every
// recognised field consumed no matter which branch the `switch (type)` would
// take, so pass 2 downloaded objects the branch never reads and pass 1 fatally
// charged inline entries it never holds. The plan in `imageFetch.ts` is now the
// single source both the collector and the handler's `takeImage` read through.
//
// PLAN-* cases are collector-level; PATH-* drive the production handler. The
// pairs matter: a wiring claim is only proven by a mutation that severs it and
// breaks BOTH halves (D7).
// ---------------------------------------------------------------------------

/**
 * Path -> field shape. Written out here rather than imported from the subject:
 * a test that computes its expectations with the module's own normalizer
 * cannot catch that normalizer being wrong, and keeping it local is also what
 * lets these cases run against 7d32182, where it does not exist.
 */
function fieldShapeOf(path: string): string {
  return path.replace(/\[\d+\]/g, "[]").replace(/\[\]$/, "");
}

/** Consumed field shapes for a payload, as the collector decides them. */
function consumedFields(payload: Record<string, unknown>): string[] {
  return [
    ...new Set(
      collectSceneImageRefs(payload)
        .filter((s) => s.consumed)
        .map((s) => fieldShapeOf(s.path)),
    ),
  ].sort();
}

/** Every field shape collected, consumed or not. */
function collectedFields(payload: Record<string, unknown>): string[] {
  return [...new Set(collectSceneImageRefs(payload).map((s) => fieldShapeOf(s.path)))].sort();
}

/** One image in every field shape the scene function recognises. */
function everyField(extra: Record<string, unknown> = {}) {
  return {
    styleId: "storybook",
    scene: { text: "t", visualDescription: "v" },
    location: { name: "Valparaíso", description: "puerto" },
    sceneReferenceImage: PNG_B64(),
    referenceImage: PNG_B64(),
    characters: [charWith(PNG_B64())],
    landmarks: [{ name: "Faro", referenceImages: [PNG_B64()] }],
    props: [{ name: "Farol", referenceImages: [PNG_B64()] }],
    prop: { name: "Farol", kind: "prop", visualDescription: "d", referenceImages: [PNG_B64()] },
    character: { name: "Ana", visualDescription: "d", referenceImage: PNG_B64() },
    count: 1,
    ...extra,
  };
}

// BASE-RED @ 7d32182: every row failed. The collector marked all eight field
// shapes consumed for all five types — e.g. for `type:"prop"` it reported
// [character.referenceImage, characters[].referenceImage,
// landmarks[].referenceImages, prop.referenceImages, props[].referenceImages,
// referenceImage, sceneReferenceImage] where the prop branch reads one field.
Deno.test("PLAN-1 each request type consumes exactly what its handler branch reads", () => {
  const expected: Array<[string, Record<string, unknown>, string[]]> = [
    ["scene (landmark not visible)", everyField({ type: "scene" }), [
      "characters[].referenceImage",
      "props[].referenceImages",
      "sceneReferenceImage",
    ]],
    [
      "scene (landmarkVisible)",
      everyField({ type: "scene", scene: { text: "t", visualDescription: "v", landmarkVisible: true } }),
      [
        "characters[].referenceImage",
        "landmarks[].referenceImages",
        "props[].referenceImages",
        "sceneReferenceImage",
      ],
    ],
    ["cover", everyField({ type: "cover" }), [
      "characters[].referenceImage",
      "props[].referenceImages",
      "sceneReferenceImage",
    ]],
    ["end", everyField({ type: "end" }), [
      "characters[].referenceImage",
      "referenceImage",
    ]],
    ["prop", everyField({ type: "prop" }), ["prop.referenceImages"]],
    ["character (reads no image at all)", everyField({ type: "character" }), []],
    ["an unknown type reads nothing", everyField({ type: "not-a-type" }), []],
  ];

  for (const [label, payload, fields] of expected) {
    assertEquals(consumedFields(payload), fields, label);
  }
});

// The invariant boundary. Narrowing consumption must NOT narrow provenance:
// every entry is still collected and still validated, whatever its type reads.
// Not base-red — at 7d32182 everything was consumed, so everything was
// collected too. MUTATION PROOF instead (D7): making `collectSceneImageRefs`
// skip fields outside the read set — the tempting form of the [B1] fix — makes
// this fail with 8 collected shapes expected, 1 received.
Deno.test("PLAN-2 every field is still COLLECTED whatever the type reads", () => {
  const all = [
    "character.referenceImage",
    "characters[].referenceImage",
    "landmarks[].referenceImages",
    "prop.referenceImages",
    "props[].referenceImages",
    "referenceImage",
    "sceneReferenceImage",
  ];
  for (const type of ["scene", "character", "prop", "cover", "end", "not-a-type"]) {
    assertEquals(collectedFields(everyField({ type })), all, `type=${type}`);
  }
});

// The refine source is resolved BEFORE the type switch, for every type, so it
// belongs to no type's rule list — but only when the refine actually
// activates. A `refine` without a string `feedback` never takes that path, so
// nothing reads its source.
Deno.test("PLAN-3 refine.sourceImage is consumed for any type, and only when refine activates", () => {
  for (const type of ["scene", "character", "prop", "cover", "end"]) {
    assertEquals(
      consumedFields({ type, refine: { sourceImage: PNG_B64(), feedback: "más luz" } }),
      ["refine.sourceImage"],
      `type=${type} with an active refine`,
    );
    assertEquals(
      consumedFields({ type, refine: { sourceImage: PNG_B64() } }),
      [],
      `type=${type} with no feedback — the handler never reads the source`,
    );
  }
});

// BASE-RED @ 7d32182: "an unread field must not be fetched" — 1 fetch, 0
// expected. This is the corpus case `prop-with-irrelevant-scene-ref` at the
// handler level, with the egress made explicit.
Deno.test("PATH-1 type:prop does not download a bucket URL parked in an unread field", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post({
      type: "prop",
      styleId: "storybook",
      prop: { name: "Farol", kind: "prop", visualDescription: "farol de bronce" },
      sceneReferenceImage: `${BUCKET_PREFIX}/irrelevante.png`,
      count: 1,
    }));
    const body = await readJson(res);

    const downloaded = spy.calls.filter((c) => !c.url.includes("generativelanguage"));
    assertEquals(downloaded.length, 0, "an unread field must not be fetched");
    assertStrictEquals(res.status, 200, `body=${JSON.stringify(body).slice(0, 200)}`);
    assertStrictEquals(body.referenceImagesCount, 0);
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});

// BASE-RED @ 7d32182: "an unread inline entry must not be charged" — status
// 413 (IMAGE_TOO_LARGE), 200 expected. The corpus case
// `prop-with-oversized-irrelevant-character-image` at the handler level.
Deno.test("PATH-2 type:prop is not charged for an oversized photo in an unread field", async () => {
  await withFetchSpy(async () => {
    const oversized = "A".repeat(TEST_LIMITS.maxImageBytes * 4);
    const res = await createHandler(deps())(post({
      type: "prop",
      styleId: "storybook",
      prop: { name: "Farol", kind: "prop", visualDescription: "farol de bronce" },
      characters: [charWith(oversized)],
      count: 1,
    }));
    const body = await readJson(res);

    assertStrictEquals(res.status, 200, "an unread inline entry must not be charged");
    assertStrictEquals(body.referenceImagesCount, 0);
  }, () => Promise.resolve(geminiImageResponse()));
});

// A3 — THE BOUNDARY. Narrowing what is CHARGED and FETCHED must not narrow
// what is CHECKED: a forbidden origin parked in a field this type ignores
// still fails the whole request, with zero fetches (the T-F.9 property, on the
// request-type dimension).
//
// Not base-red — at 7d32182 the entry was consumed, so it was validated for a
// different reason. MUTATION PROOF (D7): making `collectSceneImageRefs` collect
// only fields in the read set makes this fail with status 200 / expected 422.
Deno.test("PATH-3 a forbidden URL in a field this type ignores still aborts the request", async () => {
  const body = await expectRejection({
    type: "prop",
    styleId: "storybook",
    prop: { name: "Farol", kind: "prop", visualDescription: "farol de bronce" },
    characters: [charWith("https://evil.example.com/x.png")],
    count: 1,
  }, { status: 422, code: "FORBIDDEN_ORIGIN" });
  assertStrictEquals(body.field, "characters[0].referenceImage");
});

// A2 — THE WIRING PROOF. `SCENE_READ_RULES.cover` lists `sceneReferenceImage`;
// this pair is what fails if that entry is severed. Collector half.
//
// MUTATION (recorded in the report): delete `{ field: "sceneReferenceImage" }`
// from the `cover` rules in `_shared/imageFetch.ts`.
Deno.test("WIRE-collector cover consumes sceneReferenceImage", () => {
  assert(
    consumedFields(everyField({ type: "cover" })).includes("sceneReferenceImage"),
    "cover must consume sceneReferenceImage",
  );
});

// A2 — the handler half of the same claim, through the production path: the
// cover branch takes the style reference and hands it to the provider.
Deno.test("WIRE-path cover downloads sceneReferenceImage and sends it to the provider", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post({
      type: "cover",
      styleId: "storybook",
      title: "El faro de Ana",
      protagonist: { visualDescription: "niña de 8 años" },
      location: { name: "Valparaíso", description: "puerto" },
      characters: [],
      sceneReferenceImage: `${BUCKET_PREFIX}/cover-ref.png`,
      count: 1,
    }));
    const body = await readJson(res);

    const downloaded = spy.calls.filter((c) => !c.url.includes("generativelanguage"));
    assertEquals(downloaded.length, 1, "the cover style reference must be downloaded");
    assertStrictEquals(res.status, 200);
    assertStrictEquals(body.referenceImagesCount, 1);
    assertEquals(providerImages(spy.providerCalls[0]?.init).length, 1);
  }, (url) => {
    if (url.includes("generativelanguage")) return Promise.resolve(geminiImageResponse());
    return Promise.resolve(streamingResponse(PNG_BYTES(48)));
  });
});
