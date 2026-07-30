// PHASE PD [PD8] — corpus honesty and parity.
//
// PD upgrades the shared Anthropic stub in `_shared/corpusRunner.ts` from a
// text-fallback fixture (one scene, no role, no props) to a valid strict-tool
// response. That is a FIDELITY correction, not a product change: at 96cb2cc the
// stub returned a story the new validator rejects, so leaving it alone would
// have turned four story cases into 502s and "proved" a regression that does
// not exist.
//
// The load-bearing property is therefore: **PD changes no corpus outcome at
// all.** `corpus_pd_base.json` is that claim made checkable — the complete
// outcome of all 30 cases, CAPTURED by running the corpus against the PD base
// (`phase/pd-contract` at 96cb2cc, before any handler edit) with:
//
//     deno run --allow-all _shared/zz_snap.ts generate-story/corpus_pd_base.json
//
// (the throwaway capture script is reproduced in the phase report; it is the
// same `runCorpusCase` + `handlerFor` pairing `corpus_test.ts` uses). Per D5 the
// expectations are captured from a pre-change commit, never hand-written.
//
// WHY A SECOND FILE, and not `corpus_baseline.json`: the baseline is captured
// from `b241eaf` (cc-cleanup's behaviour) and is READ-ONLY for PD. Full-outcome
// equality with it does NOT hold at the PD base and never did — six cases
// diverge for reasons FASE F documented in writing (four `intentional`
// rejections, one `mayFetchMore`, one fetch-ORDER difference). That is reported
// as a FINDING against [PD8]'s literal wording; this file proves the property
// [PD8] was reaching for, which the baseline cannot express.
//
// `corpus_test.ts` still asserts the baseline contract for all 30 cases and is
// unchanged by PD. The two files are complementary: that one says "FASE F did
// not break cc-cleanup", this one says "PD did not break FASE F or PC".

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { CORPUS } from "../_shared/corpus.ts";
import { type CorpusOutcome, runCorpusCase } from "../_shared/corpusRunner.ts";
import { makeAuthzDeps } from "../_shared/testHelpers.ts";
import pdBase from "./corpus_pd_base.json" with { type: "json" };

import { createHandler as createSceneHandler } from "../generate-scene-images/handler.ts";
import { createHandler as createStoryHandler } from "./handler.ts";

const PD_BASE = pdBase as unknown as Record<string, CorpusOutcome>;

/**
 * The git blob SHA-1 of `_shared/corpus_baseline.json` at the PD base, pinned by
 * [PD8]. Recomputed here from the file's bytes, so a re-capture — the D5
 * violation this criterion exists to prevent — fails a test instead of passing
 * review unnoticed.
 *
 * A future phase with WRITTEN authorization to re-capture updates this constant
 * in the same commit as the new baseline; nothing else in the suite reads it.
 */
const BASELINE_BLOB = "91ec703355f3584701fe25da484370e4ba57b156";

/** `git hash-object` for a blob: sha1("blob " + byteLength + "\0" + bytes). */
async function gitBlobSha1(bytes: Uint8Array): Promise<string> {
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + bytes.byteLength);
  payload.set(header, 0);
  payload.set(bytes, header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares like-for-like against the captured file.
 *
 * `runCorpusCase` returns `code: undefined` on a 2xx, and `JSON.stringify`
 * DROPS undefined-valued keys — so the captured snapshot has no `code` key at
 * all where the live outcome has one holding `undefined`. Deno's `assertEquals`
 * calls that a difference. Round-tripping the live outcome through JSON applies
 * exactly the transform the capture applied, so the comparison sees the same
 * shape on both sides and a real change in `code` still fails.
 */
function canonical(outcome: CorpusOutcome): CorpusOutcome {
  return JSON.parse(JSON.stringify(outcome)) as CorpusOutcome;
}

function handlerFor(fn: string) {
  const authzDeps = makeAuthzDeps().deps;
  return fn === "story"
    ? createStoryHandler({
      anthropicApiKey: "test-anthropic-key",
      googleAiApiKey: "test-gemini-key",
      researchModel: "test-research-model",
      authzDeps,
      supabaseUrl: "https://proj.supabase.co",
    })
    : createSceneHandler({
      apiKey: "test-gemini-key",
      flashModel: "test-flash-model",
      proModel: "test-pro-model",
      authzDeps,
      supabaseUrl: "https://proj.supabase.co",
    });
}

Deno.test("PD8a corpus_baseline.json is byte-identical to the PD base", async () => {
  const bytes = await Deno.readFile(
    new URL("../_shared/corpus_baseline.json", import.meta.url),
  );
  assertStrictEquals(
    await gitBlobSha1(bytes),
    BASELINE_BLOB,
    "the captured baseline was modified — re-capturing to green a comparison is forbidden by D5",
  );
});

Deno.test("PD8b the PD snapshot covers exactly the corpus cases", () => {
  assertEquals(
    CORPUS.map((c) => c.name).sort(),
    Object.keys(PD_BASE).sort(),
    "re-capture corpus_pd_base.json from the PD base after changing CORPUS",
  );
});

for (const entry of CORPUS) {
  Deno.test(`PD8c parity: ${entry.name}`, async () => {
    const base = PD_BASE[entry.name];
    assert(base, `no PD-base capture for ${entry.name}`);

    const head = await runCorpusCase(handlerFor(entry.fn), entry);

    // The complete outcome — status, code, fetched (order included),
    // providerImages AND providerCalls. Not a subset: the stub upgrade could
    // in principle change provider-call counts, and a status-only assertion
    // would not see it.
    assertEquals(
      canonical(head),
      base,
      `PD changed this case's outcome. If that is deliberate it needs PM/reviewer ` +
        `approval and a written divergence — it is not something to re-capture away.`,
    );
  });
}

Deno.test("PD8d every story case still reaches its captured status", () => {
  const story = CORPUS.filter((c) => c.fn === "story");
  assertStrictEquals(
    story.length,
    6,
    "the corpus must still carry six story cases",
  );

  // Five are 200. The sixth is `story-builder-at-the-UI-size-limit`, which FASE
  // F documents as an INTENTIONAL 413 BODY_TOO_LARGE (a UI/backend mismatch
  // that predates it) — so "all six story cases remain 200" is false at the PD
  // base, and is reported as a finding. What must hold is that each case keeps
  // the status it had before PD.
  const statuses = story.map((c) => `${c.name}=${PD_BASE[c.name].status}`)
    .sort();
  assertEquals(statuses, [
    "story-builder-at-the-UI-size-limit=413",
    "story-builder-with-reference-photo=200",
    "story-minimal=200",
    "story-preview-prompt-only=200",
    "story-with-many-prop-photos=200",
    "story-with-prop-photos=200",
  ]);
});
