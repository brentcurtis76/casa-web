// PB — T-B.10 — the D3 allowlist widening, through the PRODUCTION
// `generate-story` handler.
//
// The sibling `_shared/imageFetch_provenance_test.ts` proves the string
// contract at the validation seam. This suite proves the thing a validation
// test cannot: that a finalized `liturgia-images` photo is actually DOWNLOADED
// and actually reaches Gemini as bytes. A status-only assertion would pass
// against a handler that accepted the URL and then quietly dropped it, which is
// the exact regression PB exists to close.
//
// Every case drives `createHandler(...)` with a real `Request`. The only mocks
// are the boundaries: authz, `globalThis.fetch` (Storage and provider), and the
// injected limits. Nothing here asserts on a mock of the subject.
//
// D7: the acceptance cases are base-red at db42745 (422 FORBIDDEN_BUCKET before
// any fetch). The rejection cases are green at base — their evidence is the
// mutation set recorded in the PB executor report.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { corsHeaders, createHandler, type HandlerDeps } from "./handler.ts";
import { type ImageLimits } from "../_shared/imageFetch.ts";
import {
  AUTH_HEADER,
  makeAuthzDeps,
  PNG_BYTES,
  streamingResponse,
  TEST_SUPABASE_URL,
  toBase64,
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

// Written out in full, not derived from the module's constants: D3 is a string
// contract, and a URL built from `ACCEPTED_BUCKET_PATHS` would follow a typo
// into production and still pass.
const PUBLIC_LITURGIA =
  `${TEST_SUPABASE_URL}/storage/v1/object/public/liturgia-images`;
const PUBLIC_DRAFTS =
  `${TEST_SUPABASE_URL}/storage/v1/object/public/cuentacuentos-drafts`;

/** The path shape `liturgyService.uploadSingleImage` actually writes. */
const LANDMARK_URL =
  `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/scenes/scene_1a2b.png`;
const PROP_URL =
  `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/cover/cover_3c4d.png`;

// Distinct sizes so the generator produces distinct content: one site's bytes
// can never satisfy another site's assertion.
const LANDMARK_BYTES = PNG_BYTES(96);
const PROP_BYTES = PNG_BYTES(128);
const LANDMARK_B64 = toBase64(LANDMARK_BYTES);
const PROP_B64 = toBase64(PROP_BYTES);

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    anthropicApiKey: "test-anthropic-key",
    googleAiApiKey: "test-gemini-key",
    researchModel: "test-research-model",
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
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>;
}

function isProvider(url: string): boolean {
  return url.includes("generativelanguage.googleapis.com");
}

function geminiTextResponse(): Response {
  return new Response(
    JSON.stringify({
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: "descripción" }] },
      }],
    }),
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
      contents?: Array<
        { parts: Array<{ inlineData?: { mimeType: string; data: string } }> }
      >;
    };
    for (const part of parsed.contents?.[0]?.parts ?? []) {
      if (part.inlineData) out.push(part.inlineData);
    }
  }
  return out;
}

/**
 * Serves ONLY the URLs it was given. Any other Storage URL 404s loudly rather
 * than returning a generic PNG, so "one exact fetch" cannot be satisfied by a
 * handler that fetched something else and got a valid image anyway.
 */
function serveExact(map: Record<string, Uint8Array>) {
  return (url: string): Promise<Response> => {
    if (isProvider(url)) return Promise.resolve(geminiTextResponse());
    const bytes = map[url];
    if (!bytes) {
      return Promise.resolve(new Response("unexpected url", { status: 404 }));
    }
    return Promise.resolve(streamingResponse(bytes));
  };
}

async function expectRejection(
  payload: unknown,
  expected: { status: number; code: string; field: string },
): Promise<void> {
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(post(payload));
    const body = await readJson(res);

    // Fetch counts first: "nothing was downloaded and nothing was paid for" is
    // the property under test, and a status assertion ahead of it would mask a
    // handler that fetched and then failed.
    assertEquals(
      spy.calls.length,
      0,
      `no fetch (body=${JSON.stringify(body)})`,
    );
    assertEquals(spy.providerCalls.length, 0, "no provider call");
    assertStrictEquals(
      res.status,
      expected.status,
      `status (body=${JSON.stringify(body)})`,
    );
    assertStrictEquals(body.code, expected.code, "error code");
    assertStrictEquals(body.field, expected.field, "exact field");
    for (const [k, v] of Object.entries(corsHeaders)) {
      assertEquals(res.headers.get(k), v, `missing CORS header ${k}`);
    }
  });
}

// ---------------------------------------------------------------------------
// PB-S1 — the acceptance case, proved by provider bytes
// ---------------------------------------------------------------------------

// ACCEPTANCE — BASE-RED @ db42745: status 422, code FORBIDDEN_BUCKET, zero
// fetches, zero provider images. The finalized landmark photo was refused
// before pass 2.
Deno.test(
  "PB-S1 a finalized liturgia-images landmark photo is fetched once and analysed as bytes",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(storyPayload({
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [LANDMARK_URL],
          }],
        })),
      );

      assertStrictEquals(
        res.status,
        200,
        `status (body=${JSON.stringify(await readJson(res))})`,
      );

      const downloads = spy.calls.filter((c) => !isProvider(c.url));
      assertEquals(downloads.length, 1, "exactly one Storage fetch");
      assertStrictEquals(
        downloads[0].url,
        LANDMARK_URL,
        "the exact URL, unrewritten",
      );

      const sent = providerImages(spy.providerCalls);
      assertEquals(sent.length, 1, "exactly one image reached the provider");
      assertStrictEquals(
        sent[0].data,
        LANDMARK_B64,
        "the provider must receive the DOWNLOADED bytes, not the URL",
      );
      assertStrictEquals(
        sent[0].mimeType,
        "image/png",
        "MIME is sniffed from the bytes",
      );
    }, serveExact({ [LANDMARK_URL]: LANDMARK_BYTES }));
  },
);

// The same chain for a prop, and both together: `updateStoryWithImageUrls`
// rewrites every finalized category, so more than one field carries these URLs.
// Distinct byte fixtures per site mean a single fetch cannot satisfy both.
Deno.test(
  "PB-S1b landmark and prop liturgia-images photos are each fetched once and analysed",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(storyPayload({
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [LANDMARK_URL],
          }],
          props: [{ id: "p1", name: "Farol", referenceImages: [PROP_URL] }],
        })),
      );

      assertStrictEquals(
        res.status,
        200,
        `status (body=${JSON.stringify(await readJson(res))})`,
      );

      const downloads = spy.calls.filter((c) => !isProvider(c.url));
      assertEquals(downloads.length, 2, "exactly two Storage fetches");
      assertEquals(
        downloads.map((c) => c.url).sort(),
        [LANDMARK_URL, PROP_URL].sort(),
        "each exact URL fetched once",
      );

      const sent = providerImages(spy.providerCalls);
      assertEquals(sent.length, 2, "both images reached the provider");
      assertEquals(
        sent.map((p) => p.data).sort(),
        [LANDMARK_B64, PROP_B64].sort(),
        "each site's own downloaded bytes reached the provider",
      );
      for (const part of sent) {
        assertStrictEquals(part.mimeType, "image/png");
      }
    }, serveExact({ [LANDMARK_URL]: LANDMARK_BYTES, [PROP_URL]: PROP_BYTES }));
  },
);

// The widening is additive: a drafts URL and a liturgia-images URL in the same
// group both materialize, in order. This is the live shape after a re-open —
// finalized images alongside images still in the draft bucket.
Deno.test("PB-S1c drafts and liturgia-images URLs coexist in one group", async () => {
  const draftsUrl = `${PUBLIC_DRAFTS}/user-1/lit-1/scenes/scene_5e6f.png`;
  const draftsBytes = PNG_BYTES(160);
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [draftsUrl, LANDMARK_URL],
        }],
      })),
    );

    assertStrictEquals(res.status, 200);
    const sent = providerImages(spy.providerCalls);
    assertEquals(
      sent.map((p) => p.data),
      [toBase64(draftsBytes), LANDMARK_B64],
      "both buckets materialize, in payload order",
    );
  }, serveExact({ [draftsUrl]: draftsBytes, [LANDMARK_URL]: LANDMARK_BYTES }));
});

// ---------------------------------------------------------------------------
// PB-S2 — what the widening did not open, through the same handler
// ---------------------------------------------------------------------------

Deno.test("PB-S2 a third bucket in a recognized field is 422 with zero fetches", async () => {
  await expectRejection(
    storyPayload({
      landmarks: [{
        name: "Faro",
        narrativeRole: "guía",
        referenceImages: [
          `${TEST_SUPABASE_URL}/storage/v1/object/public/avatars/x.png`,
        ],
      }],
    }),
    {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      field: "landmarks[0].referenceImages[0]",
    },
  );
});

Deno.test("PB-S2b the sign form of liturgia-images is 422 with zero fetches", async () => {
  await expectRejection(
    storyPayload({
      props: [{
        id: "p1",
        name: "Farol",
        referenceImages: [
          `${TEST_SUPABASE_URL}/storage/v1/object/sign/liturgia-images/x.png?token=abc`,
        ],
      }],
    }),
    {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      field: "props[0].referenceImages[0]",
    },
  );
});

Deno.test("PB-S2c a prefix collision is 422 with zero fetches", async () => {
  await expectRejection(
    storyPayload({
      landmarks: [{
        name: "Faro",
        narrativeRole: "guía",
        referenceImages: [
          `${TEST_SUPABASE_URL}/storage/v1/object/public/liturgia-images-evil/x.png`,
        ],
      }],
    }),
    {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      field: "landmarks[0].referenceImages[0]",
    },
  );
});

Deno.test(
  "PB-S3 encoded-separator traversal between the allowed buckets is 422 with zero fetches",
  async () => {
    const traversals = [
      `${PUBLIC_DRAFTS}/..%2fliturgia-images/x.png`,
      `${PUBLIC_DRAFTS}/..%5cliturgia-images/x.png`,
      `${PUBLIC_LITURGIA}/..%2fcuentacuentos-drafts/x.png`,
      `${PUBLIC_LITURGIA}/..%5ccuentacuentos-drafts/x.png`,
    ];
    for (const url of traversals) {
      await expectRejection(
        storyPayload({
          landmarks: [{
            name: "Faro",
            narrativeRole: "guía",
            referenceImages: [url],
          }],
        }),
        {
          status: 422,
          code: "FORBIDDEN_BUCKET",
          field: "landmarks[0].referenceImages[0]",
        },
      );
    }
  },
);

// A forbidden URL parked in a field this function never analyses must still
// abort the request — the widening must not have made provenance consumption
// dependent.
Deno.test("PB-S3b a third bucket in a never-analysed field still aborts", async () => {
  await expectRejection(
    storyPayload({
      characters: [{
        name: "Ana",
        referenceImage:
          `${TEST_SUPABASE_URL}/storage/v1/object/public/avatars/x.png`,
      }],
    }),
    {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      field: "characters[0].referenceImage",
    },
  );
});

// ---------------------------------------------------------------------------
// PB-S4 — D4 compatibility: the new bucket degrades exactly like the old one
// ---------------------------------------------------------------------------

// A finalized photo deleted from `liturgia-images` is a pass-2 outcome: it drops
// that entry, is reported in `skippedImages`, and the story still generates.
// Adding the bucket must not reclassify it as fatal.
Deno.test("PB-S4 a 404 liturgia-images landmark photo is skipped and generation continues", async () => {
  await withFetchSpy(async (spy) => {
    const goneUrl =
      `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/scenes/gone_0000.png`;
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [goneUrl, LANDMARK_URL],
        }],
      })),
    );
    const body = await readJson(res);

    assertStrictEquals(
      res.status,
      200,
      `status (body=${JSON.stringify(body)})`,
    );

    const skipped = body.skippedImages as Array<
      { field: string; code: string }
    >;
    assert(Array.isArray(skipped), "response must carry skippedImages");
    assertEquals(
      skipped.length,
      1,
      `exactly one drop (got ${JSON.stringify(skipped)})`,
    );
    assertStrictEquals(skipped[0].field, "landmarks[0].referenceImages[0]");
    assertStrictEquals(skipped[0].code, "FETCH_FAILED");

    const sent = providerImages(spy.providerCalls);
    assertEquals(sent.length, 1, "the surviving photo is still analysed");
    assertStrictEquals(sent[0].data, LANDMARK_B64);
  }, serveExact({ [LANDMARK_URL]: LANDMARK_BYTES }));
});

// The same for a prop entry: the degradation rule is per-entry, not per-field.
Deno.test("PB-S4b a 404 liturgia-images prop photo is skipped and generation continues", async () => {
  await withFetchSpy(async (spy) => {
    const goneUrl =
      `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/cover/gone_1111.png`;
    const res = await createHandler(deps())(
      post(storyPayload({
        landmarks: [{
          name: "Faro",
          narrativeRole: "guía",
          referenceImages: [LANDMARK_URL],
        }],
        props: [{ id: "p1", name: "Farol", referenceImages: [goneUrl] }],
      })),
    );
    const body = await readJson(res);

    assertStrictEquals(
      res.status,
      200,
      `status (body=${JSON.stringify(body)})`,
    );

    const skipped = body.skippedImages as Array<
      { field: string; code: string }
    >;
    assertEquals(
      skipped.length,
      1,
      `exactly one drop (got ${JSON.stringify(skipped)})`,
    );
    assertStrictEquals(skipped[0].field, "props[0].referenceImages[0]");
    assertStrictEquals(skipped[0].code, "FETCH_FAILED");

    const sent = providerImages(spy.providerCalls);
    assertEquals(sent.length, 1, "the landmark photo is still analysed");
    assertStrictEquals(sent[0].data, LANDMARK_B64);
  }, serveExact({ [LANDMARK_URL]: LANDMARK_BYTES }));
});
