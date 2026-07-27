// FASE F — T-F.* image-safety suite, exercised through the PRODUCTION handler.
//
// Every case below drives `createHandler(...)` with a real Request and a
// stubbed `globalThis.fetch`. Nothing here asserts on a mock of the subject:
// the assertions are on the handler's HTTP response, on how many times fetch
// was called, and on what reached the console.
//
// Base-red: each case was run against b241eaf (the refactor-only commit that
// extracted this handler without changing behaviour). The recorded failure for
// each is in FASE_F_WRITEUP.md §3 and summarised in the comment above each
// test. The old path fetched any URL it was handed, so most of these fail at
// base by fetching — which is exactly the defect FASE F closes.
//
// Limits are injected rather than hard-coded so a size cap can be exercised
// without allocating megabytes. T-F.0 pins the production constants and the
// relationship that makes the aggregate budget reachable, which is what keeps
// the injected-limit cases honest.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import {
  DEFAULT_IMAGE_LIMITS,
  type ImageLimits,
} from "../_shared/imageFetch.ts";
import {
  AUTH_HEADER,
  BUCKET_PREFIX,
  dataUrl,
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
  maxImagesPerRequest: 12,
  fetchTimeoutMs: 20_000,
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
function charWith(image: string) {
  return { name: "Ana", visualDescription: "niña de 8 años", referenceImage: image };
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
Deno.test("T-F.0 production limits are the shipped values and are mutually reachable", () => {
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxBodyBytes, 20_000_000);
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxImageBytes, 6_000_000);
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxTotalImageBytes, 14_000_000);
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.maxImagesPerRequest, 12);
  assertStrictEquals(DEFAULT_IMAGE_LIMITS.fetchTimeoutMs, 20_000);

  assert(
    DEFAULT_IMAGE_LIMITS.maxTotalImageBytes < DEFAULT_IMAGE_LIMITS.maxBodyBytes * 3 / 4,
    "aggregate budget must be reachable by inline input within the body cap",
  );
  assert(
    DEFAULT_IMAGE_LIMITS.maxImageBytes < DEFAULT_IMAGE_LIMITS.maxTotalImageBytes,
    "per-image cap must be below the aggregate",
  );
});

// ---------------------------------------------------------------------------
// T-F.1 – T-F.4 — provenance
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
        charWith(
          `${TEST_SUPABASE_URL}/storage/v1/object/public/other-bucket/x.png`,
        ),
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
        charWith(
          "http://proj.supabase.co/storage/v1/object/public/cuentacuentos-drafts/x.png",
        ),
      ],
    }),
    { status: 422, code: "INSECURE_SCHEME" },
  );
});

// ---------------------------------------------------------------------------
// T-F.5 – T-F.8 — the download itself
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: status 500, expected 422. Base passed no `redirect`
// option at all, so there was no typed refusal — the download error fell
// through the silent `return ''` path and the request died at the provider
// instead. (The 500 rather than a 200 is an artefact of the stub answering
// every fetch, including Gemini's; the point is that no REDIRECT_REFUSED
// existed and the request was never stopped at the image.)
Deno.test("T-F.5 a redirecting bucket URL is refused", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/x.png`)] })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 422);
    assertStrictEquals(body.code, "REDIRECT_REFUSED");
    // The request must have asked the runtime to refuse redirects itself.
    assertStrictEquals(spy.calls[0].init?.redirect, "error");
    assertEquals(spy.providerCalls.length, 0, "no provider call after a refusal");
  }, () => {
    // What a runtime with `redirect: 'error'` does on a 3xx.
    return Promise.reject(new TypeError("redirect count exceeded / redirect not allowed"));
  });
});

// BASE-RED @ b241eaf: status 500, expected 413. Base buffered the entire body
// via `arrayBuffer()` with no size check anywhere, so nothing was ever cut.
Deno.test("T-F.6 an oversized object is cut mid-stream, not buffered", async () => {
  const oversized = PNG_BYTES(TEST_LIMITS.maxImageBytes * 4);
  const pulls: number[] = [];

  await withFetchSpy(async () => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/big.png`)] })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 413);
    assertStrictEquals(body.code, "IMAGE_TOO_LARGE");

    // The cut is what makes this different from a post-hoc size check: the
    // reader stopped well before the end of the stream.
    const pulledBytes = pulls.length * 256;
    assert(
      pulledBytes < oversized.byteLength / 2,
      `stream should be cut early, pulled ${pulledBytes} of ${oversized.byteLength}`,
    );
  }, () =>
    Promise.resolve(
      streamingResponse(oversized, {
        chunkSize: 256,
        onPull: (i) => pulls.push(i),
      }),
    ));
});

// BASE-RED @ b241eaf: status 500, expected 422. Base's download passed no
// `signal` at all — there was no timeout, and no FETCH_TIMEOUT to return.
Deno.test("T-F.7 a download timeout is a clean typed rejection", async () => {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/slow.png`)] })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 422);
    assertStrictEquals(body.code, "FETCH_TIMEOUT");
    // Bounded by construction: the request carried an abort signal.
    assert(
      spy.calls[0].init?.signal instanceof AbortSignal,
      "download must carry an AbortSignal",
    );
    assertEquals(spy.providerCalls.length, 0);
  }, () =>
    Promise.reject(
      new DOMException("Signal timed out.", "TimeoutError"),
    ));
});

// BASE-RED @ b241eaf: status 500, expected 422. Base trusted `Content-Type`,
// then silently returned '' when the base64 prefix did not match — the image
// was dropped with no code and no explanation.
Deno.test("T-F.8 image/* Content-Type over HTML bytes is NOT_IMAGE", async () => {
  await withFetchSpy(async () => {
    const res = await createHandler(deps())(
      post(scenePayload({ characters: [charWith(`${BUCKET_PREFIX}/fake.png`)] })),
    );
    const body = await readJson(res);

    assertStrictEquals(res.status, 422);
    assertStrictEquals(body.code, "NOT_IMAGE");
  }, () =>
    Promise.resolve(
      streamingResponse(HTML_BYTES(), {
        headers: { "Content-Type": "image/png" },
      }),
    ));
});

// ---------------------------------------------------------------------------
// T-F.9 — the load-bearing one
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 7 fetches, 0
// expected. Base processed entries as it walked them, so both legitimate URLs
// were downloaded and Gemini was called before the forbidden entry mattered.
Deno.test(
  "T-F.9 one forbidden entry aborts everything: zero fetches AND zero provider calls",
  async () => {
    const payload = scenePayload({
      // Valid bucket URL first — at base this one got fetched.
      sceneReferenceImage: `${BUCKET_PREFIX}/ok.png`,
      characters: [
        charWith(`${BUCKET_PREFIX}/also-ok.png`),
        charWith("https://evil.example.com/steal.png"),
      ],
      landmarks: [{
        name: "Faro",
        referenceImages: [`${BUCKET_PREFIX}/faro.png`],
      }],
    });

    const body = await expectRejection(payload, {
      status: 422,
      code: "FORBIDDEN_ORIGIN",
    });
    // The rejection names the offending entry, not the innocent ones.
    assertStrictEquals(body.field, "characters[1].referenceImage");
  },
);

// ---------------------------------------------------------------------------
// T-F.10 – T-F.11 — size and count
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected. Base's only inline guard was a char-count throw inside the
// per-image path, which did not stop the rest of the request.
Deno.test(
  "T-F.10 an oversized inline image is rejected on encoded length, without decoding",
  async () => {
    // Comfortably past the encoded-length bound for maxImageBytes.
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
      // The discriminator: rejection came from the length alone.
      assertStrictEquals(atobCalls, 0, "payload must not be decoded to reject it");
    } finally {
      globalThis.atob = originalAtob;
    }
  },
);

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected. Base trimmed silently to 12 and generated anyway, so an over-cap
// request quietly lost images instead of being told to send fewer.
Deno.test("T-F.11 more images than the per-request maximum is a 422", async () => {
  const many = Array.from(
    { length: TEST_LIMITS.maxImagesPerRequest + 1 },
    () => charWith(PNG_B64()),
  );
  const body = await expectRejection(scenePayload({ characters: many }), {
    status: 422,
    code: "TOO_MANY_IMAGES",
  });
  assertStrictEquals(body.field, "request");
});

// ---------------------------------------------------------------------------
// T-F.12 — the body reader
// ---------------------------------------------------------------------------

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
      // A stream body: Request computes no content-length, so the header
      // shortcut cannot be what rejects this.
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

// ---------------------------------------------------------------------------
// T-F.13 — log hygiene
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "log leaked a query-string token". Base logged the URL
// (`url.slice(0, 150)`), the fetch target, and a base64 prefix for every
// reference image and every generated image.
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
      // Whatever the provider does, the logs are the subject here.
      await res.body?.cancel();
    }, (url) => {
      if (url.includes("generativelanguage")) {
        return Promise.resolve(
          new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
        );
      }
      return Promise.resolve(streamingResponse(PNG_BYTES(48)));
    });

    const joined = lines.join("\n");
    assert(!joined.includes(token), "log leaked a query-string token");
    assert(!joined.includes("?token="), "log leaked a query string");
    assert(!joined.includes(BUCKET_PREFIX), "log leaked a bucket URL");
    assert(!joined.includes("https://"), "log leaked a URL");
    assert(
      !joined.includes(inline.slice(0, 24)),
      "log leaked a base64 prefix",
    );
    assert(!joined.includes("iVBORw0KGgo"), "log leaked a base64 PNG prefix");
  });
});

// ---------------------------------------------------------------------------
// T-F.14 (A8a) — aggregate inline budget
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 5 fetches, 0
// expected. Base had no aggregate budget of any kind, only a per-image char
// cap, so the payload was accepted and the bucket URL was downloaded.
Deno.test(
  "T-F.14 inline images over the aggregate budget are a 413 before any fetch",
  async () => {
    // Each is under the per-image cap; together they pass the aggregate.
    const chunk = PNG_B64(TEST_LIMITS.maxImageBytes - 100);
    const payload = scenePayload({
      characters: [charWith(chunk), charWith(chunk), charWith(chunk)],
      // A legitimate bucket URL that must NOT be fetched, because the inline
      // aggregate is settled in pass 1 — before the first fetch (A8a).
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
// Recursive coverage: PNG / JPEG / WebP / data-URL in nested fields
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: "pass 1 must reject before any fetch" — 4 fetches, 0
// expected, on the first variant. Base reached a forbidden URL parked in a
// nested props/landmarks entry only after fetching the earlier entries.
Deno.test(
  "T-F.rec pass 1 walks nested landmark/prop/refine fields for every image format",
  async () => {
    const nested: Array<[string, Record<string, unknown>, string]> = [
      [
        "landmarks[].referenceImages[] (PNG inline + forbidden sibling)",
        {
          landmarks: [{
            name: "Faro",
            referenceImages: [PNG_B64(), "https://evil.example.com/a.png"],
          }],
        },
        "landmarks[0].referenceImages[1]",
      ],
      [
        "props[].referenceImages[] (JPEG inline + forbidden sibling)",
        {
          props: [{
            name: "Farol",
            referenceImages: [JPEG_B64(), "https://evil.example.com/b.png"],
          }],
        },
        "props[0].referenceImages[1]",
      ],
      [
        "props[].referenceImages[] (WebP data-URL + forbidden sibling)",
        {
          props: [{
            name: "Bote",
            referenceImages: [
              dataUrl("image/webp", WEBP_B64()),
              "https://evil.example.com/c.png",
            ],
          }],
        },
        "props[0].referenceImages[1]",
      ],
      [
        "refine.sourceImage",
        {
          refine: {
            sourceImage: "https://evil.example.com/d.png",
            feedback: "más luz",
          },
        },
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
  ];

  for (const image of accepted) {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({ characters: [charWith(image)] })),
      );
      await res.body?.cancel();
      assertStrictEquals(res.status, 200, `format rejected: ${image.slice(0, 8)}`);
      assert(
        spy.providerCalls.length > 0,
        "an accepted image must reach the provider",
      );
    }, (url) => {
      assert(url.includes("generativelanguage"), `unexpected fetch: ${url}`);
      return Promise.resolve(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Refine fail-closed
// ---------------------------------------------------------------------------

// BASE-RED @ b241eaf: status 500, expected 422. Base logged "no procesable"
// and carried on WITHOUT the source image — a silent regeneration from
// scratch, which is precisely the failure mode invariant 11 calls out.
Deno.test(
  "refine with an unmaterialisable source is 422 REFINE_SOURCE_UNAVAILABLE",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({
          refine: {
            sourceImage: `${BUCKET_PREFIX}/gone.png`,
            feedback: "más luz",
          },
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
