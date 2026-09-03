// boundedBody: the cap must be the read, not a verdict pronounced afterwards.
// Every case here uses a synthetic headerless stream with pull/cancel counters,
// because "did it stop early" is the only thing that distinguishes a real limit
// from the `.text()`-then-measure shape this module replaces.

import { assertEquals, assertStrictEquals } from "@std/assert";

import { type BoundedResult, readBoundedBytes, readBoundedJson } from "./boundedBody.ts";

interface StreamProbe {
  /** Times the source was asked for more. */
  pulls: number;
  /** Times the consumer cancelled. */
  cancels: number;
  /** Chunks actually handed over. */
  delivered: number;
}

const probe = (): StreamProbe => ({ pulls: 0, cancels: 0, delivered: 0 });

/**
 * A stream with no `content-length` of its own: `next(index)` supplies the next
 * chunk, or `null` to close. `failAt` errors the stream at that index instead,
 * standing in for a peer that hangs up mid-upload.
 */
function countingStream(
  p: StreamProbe,
  next: (index: number) => Uint8Array | null,
  opts: { failAt?: number } = {},
): ReadableStream<Uint8Array> {
  let index = 0;
  // `highWaterMark: 0` switches off the stream's own one-chunk read-ahead, so
  // `pulls` counts exactly what the consumer asked for. With the default
  // strategy a chunk is fetched eagerly on the first free microtask, and the
  // counts drift by one depending on how many awaits ran first — which would
  // measure the queueing strategy rather than the handler.
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      p.pulls++;
      if (opts.failAt !== undefined && index === opts.failAt) {
        controller.error(new Error("transporte interrumpido"));
        return;
      }
      const chunk = next(index);
      if (chunk === null) {
        controller.close();
        return;
      }
      index++;
      p.delivered++;
      controller.enqueue(chunk);
    },
    cancel() {
      p.cancels++;
    },
  }, { highWaterMark: 0 });
}

/** `count` chunks of `size` bytes, generated lazily so nothing is preallocated. */
const filler = (count: number, size: number) => (index: number) =>
  index < count ? new Uint8Array(size).fill(0x61) : null;

/** Splits `text` into `chunkSize`-byte pieces, so a small body still streams. */
function splitUtf8(text: string, chunkSize: number): (index: number) => Uint8Array | null {
  const bytes = new TextEncoder().encode(text);
  return (index) => {
    const offset = index * chunkSize;
    return offset >= bytes.length ? null : bytes.slice(offset, offset + chunkSize);
  };
}

function streamedRequest(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://edge.test/bounded", { method: "POST", headers, body: stream });
}

const reason = (result: BoundedResult<unknown>) => result.ok ? "ok" : result.reason;

Deno.test("boundedBody: an over-cap stream stops inside the chunk that crosses the cap", async () => {
  const p = probe();
  // Codex's reproduction: 100 × 1 KiB against a 4 KiB cap.
  const result = await readBoundedBytes(streamedRequest(countingStream(p, filler(100, 1024))), 4096);

  assertStrictEquals(result.ok, false);
  assertStrictEquals(reason(result), "too_large");
  assertStrictEquals(p.delivered, 5, "the 5th KiB is the first to cross 4096; the rest must not arrive");
  assertStrictEquals(p.pulls, 5, "the reader asks for exactly the chunks it charges, and no more");
  assertStrictEquals(p.cancels, 1, "the reader must cancel, not drain");
});

Deno.test("boundedBody: a declared over-cap length rejects before the first pull", async () => {
  const p = probe();
  const req = streamedRequest(countingStream(p, filler(100, 1024)), { "content-length": "102400" });
  const result = await readBoundedBytes(req, 4096);

  assertStrictEquals(reason(result), "too_large");
  assertStrictEquals(p.pulls, 0, "a declared oversize must cost nothing");
  assertStrictEquals(p.delivered, 0);
  assertStrictEquals(p.cancels, 1, "the abandoned stream is still cancelled");
});

Deno.test("boundedBody: an understated content-length cannot buy more than the cap", async () => {
  const p = probe();
  // Declares 10 bytes, sends 100 KiB. The declaration is an early exit, never
  // a licence: the stream is what actually decides.
  const req = streamedRequest(countingStream(p, filler(100, 1024)), { "content-length": "10" });
  const result = await readBoundedBytes(req, 4096);

  assertStrictEquals(reason(result), "too_large");
  assertStrictEquals(p.delivered, 5);
  assertStrictEquals(p.cancels, 1);
});

Deno.test("boundedBody: an unparseable content-length is ignored, not trusted either way", async () => {
  for (const declared of ["abc", "-1", "1.5", "", "  "]) {
    const under = probe();
    const ok = await readBoundedJson(
      streamedRequest(countingStream(under, splitUtf8('{"a":1}', 3)), { "content-length": declared }),
      4096,
    );
    assertEquals(ok, { ok: true, value: { a: 1 } }, `content-length=${JSON.stringify(declared)}`);

    const over = probe();
    const rejected = await readBoundedBytes(
      streamedRequest(countingStream(over, filler(100, 1024)), { "content-length": declared }),
      4096,
    );
    assertStrictEquals(reason(rejected), "too_large", `content-length=${JSON.stringify(declared)}`);
    assertStrictEquals(over.cancels, 1);
  }
});

Deno.test("boundedBody: under-limit chunked JSON is read whole and parsed", async () => {
  const p = probe();
  const payload = { reference: "Juan 3:16", version: "NVI", nested: { ok: true } };
  const result = await readBoundedJson(
    streamedRequest(countingStream(p, splitUtf8(JSON.stringify(payload), 7))),
    2048,
  );

  assertEquals(result, { ok: true, value: payload });
  assertStrictEquals(p.cancels, 0, "a body inside the cap is consumed, not cancelled");
  assertStrictEquals(p.delivered > 1, true, "the fixture must actually arrive in pieces");
});

Deno.test("boundedBody: the cap is inclusive — exactly maxBytes passes, one more does not", async () => {
  const exact = probe();
  const atCap = await readBoundedBytes(streamedRequest(countingStream(exact, filler(4, 1024))), 4096);
  assertStrictEquals(atCap.ok, true);
  assertStrictEquals(atCap.ok && atCap.value.byteLength, 4096);
  assertStrictEquals(exact.cancels, 0);

  const overBy1 = probe();
  const over = await readBoundedBytes(
    streamedRequest(countingStream(overBy1, (i) => i === 0 ? new Uint8Array(4097) : null)),
    4096,
  );
  assertStrictEquals(reason(over), "too_large");
  assertStrictEquals(overBy1.cancels, 1);
});

Deno.test("boundedBody: an interrupted read is `unreadable`, with nothing buffered kept", async () => {
  const p = probe();
  const result = await readBoundedJson(
    streamedRequest(countingStream(p, splitUtf8('{"a":1}', 2), { failAt: 2 })),
    4096,
  );

  assertStrictEquals(reason(result), "unreadable");
  assertStrictEquals(p.delivered, 2, "the chunks before the failure were delivered but are discarded");
});

Deno.test("boundedBody: invalid UTF-8 and invalid JSON are `invalid_json`, never a thrown error", async () => {
  const badUtf8 = await readBoundedJson(
    streamedRequest(countingStream(probe(), (i) => i === 0 ? new Uint8Array([0xff, 0xfe, 0xfd]) : null)),
    4096,
  );
  assertStrictEquals(reason(badUtf8), "invalid_json");

  for (const text of ["not json", "", "{", '{"a":']) {
    const result = await readBoundedJson(
      streamedRequest(countingStream(probe(), (i) => i === 0 ? new TextEncoder().encode(text) : null)),
      4096,
    );
    assertStrictEquals(reason(result), "invalid_json", `expected invalid_json for ${JSON.stringify(text)}`);
  }
});

Deno.test("boundedBody: a source with no stream falls back to text(), still capped", async () => {
  const bodyless = new Request("https://edge.test/bounded", { method: "POST" });
  assertStrictEquals(bodyless.body, null);
  assertStrictEquals(reason(await readBoundedJson(bodyless, 4096)), "invalid_json");

  // A synthetic Response built without a stream: under the cap it parses…
  const small = new Response(null, { status: 200 });
  assertStrictEquals(small.body, null);
  assertStrictEquals(reason(await readBoundedJson(small, 4096)), "invalid_json");

  // …and a text() that fails is `unreadable`, not an escaping exception.
  const broken = new Response(null, { status: 200 });
  Object.defineProperty(broken, "text", {
    value: () => Promise.reject(new Error("detalle interno del transporte")),
  });
  assertStrictEquals(reason(await readBoundedBytes(broken, 4096)), "unreadable");
});

Deno.test("boundedBody: a Response provider body obeys the same cap and cancels on overflow", async () => {
  const p = probe();
  // The Bible provider case: 2000 × 1 KiB against the 1 MB cap.
  const response = new Response(countingStream(p, filler(2000, 1024)));
  const result = await readBoundedJson(response, 1_000_000);

  assertStrictEquals(reason(result), "too_large");
  assertStrictEquals(p.delivered, 977, "977 KiB is the first chunk past 1_000_000 bytes");
  assertStrictEquals(p.pulls, 977, "977 of 2000 chunks pulled — the rest are never requested");
  assertStrictEquals(p.cancels, 1);
});
