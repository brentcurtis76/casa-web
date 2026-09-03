// A provider 200 that carries no usable image must surface as an upstream
// failure, never as a silent image-less "success". No network: Gemini is
// answered by the fetch spy; the authz backend is the shared stub.

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { createHandler, type HandlerDeps, NO_IMAGE_ERROR } from "./handler.ts";
import { AUTH_HEADER, makeAuthzDeps, withFetchSpy } from "../_shared/testHelpers.ts";

const TEXT_ONLY_MARKER = "upstream-text-only-marker-7Q2";
const PNG_B64 = "iVBORw0KGgo" + "A".repeat(40);

function deps(): HandlerDeps {
  return {
    apiKey: "test-gemini-key",
    flashModel: "test-flash-model",
    proModel: "test-pro-model",
    authzDeps: makeAuthzDeps().deps,
    supabaseUrl: "https://proj.supabase.co",
  };
}

function characterRequest(count: number): Request {
  return new Request("https://edge.test/generate-scene-images", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADER },
    body: JSON.stringify({
      type: "character",
      styleId: "storybook",
      count,
      character: { name: "Ana", visualDescription: "niña de 7 años, pelo negro" },
    }),
  });
}

function geminiJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const textOnly = () => geminiJson({ candidates: [{ content: { parts: [{ text: TEXT_ONLY_MARKER }] }, finishReason: "STOP" }] });
const withImage = () => geminiJson({ candidates: [{ content: { parts: [{ text: "ok" }, { inlineData: { mimeType: "image/png", data: PNG_B64 } }] } }] });

Deno.test("every variation image-less => 500, success:false, one safe error per variation, nothing upstream echoed", async () => {
  const logs: string[] = [];
  const originalWarn = console.warn;
  const originalLog = console.log;
  console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  try {
    await withFetchSpy(async (spy) => {
      const res = await createHandler(deps())(characterRequest(2));
      assertStrictEquals(res.status, 500);
      const body = await res.json();
      assertStrictEquals(body.success, false);
      assertEquals(body.images, []);
      assertStrictEquals(body.error, NO_IMAGE_ERROR);
      assertEquals(body.errors, [NO_IMAGE_ERROR, NO_IMAGE_ERROR]);
      assertStrictEquals(spy.providerCalls.length, 2);
      assertStrictEquals(JSON.stringify(body).includes(TEXT_ONLY_MARKER), false);
    }, () => Promise.resolve(textOnly()));
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
  }
  assert(logs.some((l) => l.includes("returned no usable image")));
  assertStrictEquals(logs.some((l) => l.includes(TEXT_ONLY_MARKER)), false, "upstream text must not be logged");
});

Deno.test("empty candidates and an invalid inlineData are image-less too", async () => {
  for (const body of [{ candidates: [] }, { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "not-an-image" } }] } }] }]) {
    await withFetchSpy(async () => {
      const res = await createHandler(deps())(characterRequest(1));
      assertStrictEquals(res.status, 500);
      const json = await res.json();
      assertStrictEquals(json.success, false);
      assertEquals(json.errors, [NO_IMAGE_ERROR]);
    }, () => Promise.resolve(geminiJson(body)));
  }
});

Deno.test("partial: successful images are kept and image-less variations are listed as errors", async () => {
  let call = 0;
  await withFetchSpy(async () => {
    const res = await createHandler(deps())(characterRequest(3));
    assertStrictEquals(res.status, 200);
    const body = await res.json();
    assertStrictEquals(body.success, true);
    assertStrictEquals(body.images.length, 1);
    assert(body.images[0].startsWith("iVBORw0KGgo"));
    assertStrictEquals(body.validCount, 1);
    assertStrictEquals(body.requestedCount, 3);
    assertEquals(body.errors, [NO_IMAGE_ERROR, NO_IMAGE_ERROR]);
    assertStrictEquals(JSON.stringify(body).includes(TEXT_ONLY_MARKER), false);
  }, () => Promise.resolve(call++ === 1 ? withImage() : textOnly()));
});
