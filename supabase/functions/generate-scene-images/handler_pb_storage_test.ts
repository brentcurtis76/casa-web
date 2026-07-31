// PB — T-B.10 — the D3 allowlist widening, through the PRODUCTION
// `generate-scene-images` handler.
//
// This is the handler the widening exists for. The chain, verified link by
// link: editor finalization hands the selected story to the parent → on the
// later parent liturgy save, `uploadCuentacuentosImages` uploads the still
// inline fields and `updateStoryWithImageUrls` rewrites them to public
// `liturgia-images` URLs → re-opening seeds the editor's image-option state
// from that config → each refine factory copies the selected URL verbatim into
// `refine.sourceImage`. Under PF's drafts-only pin that refine returned 422
// FORBIDDEN_BUCKET before any fetch, so every re-opened finalized cuento lost
// its refine.
//
// `refine.sourceImage` is the one field that overrides D4's degradation policy
// and fails closed, so proving it here proves the sharpest consumer. The
// assertions go all the way to slot 0 of the provider request: accepting the
// URL and then regenerating from scratch is the precise failure mode invariant
// 11 forbids, and it is invisible to a status-only test.
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
  PNG_B64,
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
const SOURCE_URL =
  `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/scenes/scene_7a8b.png`;

// Distinct from the PNG the provider stub returns, so "slot 0 is the
// materialized source" cannot be satisfied by the generated image.
const SOURCE_BYTES = PNG_BYTES(96);
const SOURCE_B64 = toBase64(SOURCE_BYTES);

const FEEDBACK = "más luz en el faro";

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

function post(body: unknown): Request {
  return new Request("https://edge.test/generate-scene-images", {
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

/** A Gemini response carrying one generated PNG, distinct from the source. */
function geminiImageResponse(): Response {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: "image/png", data: PNG_B64(64) } }],
        },
      }],
    }),
    { status: 200 },
  );
}

type ProviderPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

/** The full ordered parts array of one provider request — text parts included. */
function providerParts(init?: RequestInit): ProviderPart[] {
  if (!init?.body) return [];
  const parsed = JSON.parse(String(init.body)) as {
    contents?: Array<{ parts: ProviderPart[] }>;
  };
  return parsed.contents?.[0]?.parts ?? [];
}

function inlineParts(
  parts: ProviderPart[],
): Array<{ mimeType: string; data: string }> {
  return parts
    .map((p) => p.inlineData)
    .filter((d): d is { mimeType: string; data: string } => !!d);
}

function serveExact(map: Record<string, Uint8Array>) {
  return (url: string): Promise<Response> => {
    if (isProvider(url)) return Promise.resolve(geminiImageResponse());
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
// PB-I1 — the acceptance case: a re-opened finalized cuento can be refined
// ---------------------------------------------------------------------------

// ACCEPTANCE — BASE-RED @ db42745: status 422, code FORBIDDEN_BUCKET, zero
// fetches, zero provider calls. This is the user-visible refine regression the
// widening closes.
Deno.test(
  "PB-I1 a finalized liturgia-images refine source is fetched once and lands in slot 0",
  async () => {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(
        post(scenePayload({
          refine: { sourceImage: SOURCE_URL, feedback: FEEDBACK },
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
        SOURCE_URL,
        "the exact URL, unrewritten",
      );

      // A refine produces exactly one image, so exactly one provider call.
      assertEquals(spy.providerCalls.length, 1, "one generation call");
      const parts = providerParts(spy.providerCalls[0].init);
      const images = inlineParts(parts);

      assert(images.length > 0, "the provider request carried no image at all");
      assertStrictEquals(
        images[0].data,
        SOURCE_B64,
        "slot 0 must be the DOWNLOADED source bytes, not the URL and not a regeneration",
      );
      assertStrictEquals(images[0].mimeType, "image/png");

      // Still a REFINE, not a fallback regeneration. The handler emits the
      // refine instruction immediately before slot 0; the fallback branch
      // (`refine.sourceImage` unusable) omits both and silently regenerates
      // from scratch, which a status-only assertion would not catch.
      const slotIndex = parts.findIndex((p) =>
        p.inlineData?.data === SOURCE_B64
      );
      assert(
        slotIndex > 0,
        "the refine source must be preceded by its instruction part",
      );
      assert(
        (parts[slotIndex - 1].text ?? "").includes("REFINE SOURCE IMAGE"),
        `expected the refine instruction before slot 0, got: ${
          JSON.stringify(parts[slotIndex - 1].text ?? "")
        }`,
      );
      assert(
        parts.some((p) => (p.text ?? "").includes(FEEDBACK)),
        "the user feedback must reach the prompt",
      );
    }, serveExact({ [SOURCE_URL]: SOURCE_BYTES }));
  },
);

// The widening is additive: a drafts-bucket refine source still works.
Deno.test("PB-I1b a drafts refine source still lands in slot 0", async () => {
  const draftsUrl = `${PUBLIC_DRAFTS}/user-1/lit-1/scenes/scene_5e6f.png`;
  const draftsBytes = PNG_BYTES(128);
  await withFetchSpy(async (spy) => {
    const res = await createHandler(deps())(
      post(
        scenePayload({
          refine: { sourceImage: draftsUrl, feedback: FEEDBACK },
        }),
      ),
    );

    assertStrictEquals(res.status, 200);
    const downloads = spy.calls.filter((c) => !isProvider(c.url));
    assertEquals(downloads.length, 1);
    assertStrictEquals(downloads[0].url, draftsUrl);

    const images = inlineParts(providerParts(spy.providerCalls[0].init));
    assertStrictEquals(images[0].data, toBase64(draftsBytes));
  }, serveExact({ [draftsUrl]: draftsBytes }));
});

// ---------------------------------------------------------------------------
// PB-I2 — what the widening did not open, through the same handler
// ---------------------------------------------------------------------------

Deno.test("PB-I2 a third-bucket refine source is 422 with zero fetches", async () => {
  await expectRejection(
    scenePayload({
      refine: {
        sourceImage:
          `${TEST_SUPABASE_URL}/storage/v1/object/public/avatars/x.png`,
        feedback: FEEDBACK,
      },
    }),
    { status: 422, code: "FORBIDDEN_BUCKET", field: "refine.sourceImage" },
  );
});

Deno.test("PB-I2b the sign form of liturgia-images is 422 with zero fetches", async () => {
  await expectRejection(
    scenePayload({
      refine: {
        sourceImage:
          `${TEST_SUPABASE_URL}/storage/v1/object/sign/liturgia-images/x.png?token=abc`,
        feedback: FEEDBACK,
      },
    }),
    { status: 422, code: "FORBIDDEN_BUCKET", field: "refine.sourceImage" },
  );
});

Deno.test("PB-I2c a prefix collision is 422 with zero fetches", async () => {
  await expectRejection(
    scenePayload({
      refine: {
        sourceImage:
          `${TEST_SUPABASE_URL}/storage/v1/object/public/liturgia-images-evil/x.png`,
        feedback: FEEDBACK,
      },
    }),
    { status: 422, code: "FORBIDDEN_BUCKET", field: "refine.sourceImage" },
  );
});

Deno.test(
  "PB-I3 encoded-separator traversal between the allowed buckets is 422 with zero fetches",
  async () => {
    const traversals = [
      `${PUBLIC_DRAFTS}/..%2fliturgia-images/x.png`,
      `${PUBLIC_DRAFTS}/..%5cliturgia-images/x.png`,
      `${PUBLIC_LITURGIA}/..%2fcuentacuentos-drafts/x.png`,
      `${PUBLIC_LITURGIA}/..%5ccuentacuentos-drafts/x.png`,
    ];
    for (const url of traversals) {
      await expectRejection(
        scenePayload({ refine: { sourceImage: url, feedback: FEEDBACK } }),
        { status: 422, code: "FORBIDDEN_BUCKET", field: "refine.sourceImage" },
      );
    }
  },
);

// A forbidden URL in a character slot is fatal for the whole request even
// though the refine source itself is fine: provenance is checked wherever an
// entry hides, and the widening must not have made that consumption dependent.
Deno.test("PB-I3b a third bucket in a non-refine field still aborts the refine", async () => {
  await expectRejection(
    scenePayload({
      characters: [{
        name: "Ana",
        visualDescription: "niña de 8 años",
        referenceImage:
          `${TEST_SUPABASE_URL}/storage/v1/object/public/avatars/x.png`,
      }],
      refine: { sourceImage: SOURCE_URL, feedback: FEEDBACK },
    }),
    {
      status: 422,
      code: "FORBIDDEN_BUCKET",
      field: "characters[0].referenceImage",
    },
  );
});

// ---------------------------------------------------------------------------
// PB-I4 — D4 compatibility: the refine override is unchanged
// ---------------------------------------------------------------------------

// A finalized source deleted from `liturgia-images` must produce the EXISTING
// precise refine failure, not a skip and not a silent regeneration. Adding the
// bucket changes which URLs are admitted, never how an admitted URL degrades.
Deno.test("PB-I4 a 404 liturgia-images refine source is 422 REFINE_SOURCE_UNAVAILABLE", async () => {
  await withFetchSpy(async (spy) => {
    const goneUrl =
      `${PUBLIC_LITURGIA}/liturgias/lit-1/cuentacuentos/scenes/gone_0000.png`;
    const res = await createHandler(deps())(
      post(
        scenePayload({ refine: { sourceImage: goneUrl, feedback: FEEDBACK } }),
      ),
    );
    const body = await readJson(res);

    assertStrictEquals(
      res.status,
      422,
      `status (body=${JSON.stringify(body)})`,
    );
    assertStrictEquals(body.code, "REFINE_SOURCE_UNAVAILABLE");
    assertStrictEquals(body.field, "refine.sourceImage");
    assertEquals(
      spy.providerCalls.length,
      0,
      "must not regenerate from scratch when the finalized source is gone",
    );
    // It WAS attempted: a rejection before pass 2 would be the old
    // FORBIDDEN_BUCKET regression wearing a different code.
    const downloads = spy.calls.filter((c) => !isProvider(c.url));
    assertEquals(downloads.length, 1, "the source was admitted and fetched");
    assertStrictEquals(downloads[0].url, goneUrl);
  }, () => Promise.resolve(new Response("not found", { status: 404 })));
});

// An unsupported format from the new bucket keeps reporting the FORMAT, not
// availability — the D4 classification refinement is untouched.
Deno.test("PB-I4b an unsupported liturgia-images refine source reports the format", async () => {
  await withFetchSpy(async () => {
    const res = await createHandler(deps())(
      post(
        scenePayload({
          refine: { sourceImage: SOURCE_URL, feedback: FEEDBACK },
        }),
      ),
    );
    const body = await readJson(res);

    assertStrictEquals(
      res.status,
      422,
      `status (body=${JSON.stringify(body)})`,
    );
    assertStrictEquals(body.code, "NOT_IMAGE");
    assertStrictEquals(body.field, "refine.sourceImage");
  }, (url) => {
    if (isProvider(url)) return Promise.resolve(geminiImageResponse());
    // "ftypheic" — a real iPhone photo, admitted by the upload path and
    // unusable by the provider path.
    const heic = new Uint8Array(64);
    heic.set([0x00, 0x00, 0x00, 0x18], 0);
    heic.set([0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 4);
    return Promise.resolve(streamingResponse(heic));
  });
});
