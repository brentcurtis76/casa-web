// FASE F — the behaviour corpus, asserted against captured `cc-cleanup` output.
//
// One property: **a request cc-cleanup answered 200 to still gets a 200**,
// unless `corpus.ts` documents the divergence in writing.
//
// This is the mechanism that both FASE F review rounds needed and did not
// have. Round 1 failed on four "the fix rejects too much" findings and round 2
// on five more; every one of them is a status that changed from 200 to 4xx for
// a payload the editor really sends, and every one of them would have failed
// here without anyone having to think of the specific case first.
//
// The expectations are captured, not written: `corpus_baseline.json` comes
// from running the same payloads through `b241eaf` (cc-cleanup's behaviour
// with an importable handler). Hand-written expectations are where an author's
// assumptions leak in, which is the failure being guarded against.
//
// If a case here fails, the question is not "how do I make it pass" — it is
// "did I mean to change this, and if so why is it not in `intentional`".

import { assert, assertEquals, assertStrictEquals } from "@std/assert";

import { CORPUS } from "../_shared/corpus.ts";
import { runCorpusCase, type CorpusOutcome } from "../_shared/corpusRunner.ts";
import { makeAuthzDeps } from "../_shared/testHelpers.ts";
import baseline from "../_shared/corpus_baseline.json" with { type: "json" };

import { createHandler as createSceneHandler } from "./handler.ts";
import { createHandler as createStoryHandler } from "../generate-story/handler.ts";

const BASELINE = baseline as unknown as Record<string, CorpusOutcome>;

function handlerFor(fn: string) {
  const authzDeps = makeAuthzDeps().deps;
  return fn === "story"
    ? createStoryHandler({
      anthropicApiKey: "test-anthropic-key",
      googleAiApiKey: "test-gemini-key",
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

// Every corpus case must have a captured baseline, and vice versa. A case
// added without re-capturing would otherwise silently assert nothing.
Deno.test("corpus and baseline cover exactly the same cases", () => {
  const cases = CORPUS.map((c) => c.name).sort();
  const captured = Object.keys(BASELINE).sort();
  assertEquals(
    cases,
    captured,
    "re-run _shared/corpusCapture.ts from a b241eaf worktree after changing CORPUS",
  );
});

for (const entry of CORPUS) {
  Deno.test(`corpus: ${entry.name}`, async () => {
    const base = BASELINE[entry.name];
    assert(base, `no captured baseline for ${entry.name}`);

    const head = await runCorpusCase(handlerFor(entry.fn), entry);

    if (entry.intentional) {
      // A deliberate divergence. Both halves are asserted: that the old code
      // really did serve it (otherwise the case proves nothing about what
      // FASE F changed), and that the new code rejects it precisely.
      assertStrictEquals(
        base.status,
        200,
        `${entry.name} is marked as a deliberate rejection, but cc-cleanup did not serve it`,
      );
      assertStrictEquals(head.status, entry.intentional.status, entry.intentional.why);
      assertStrictEquals(head.code, entry.intentional.code, entry.intentional.why);
      assertEquals(
        head.fetched,
        [],
        "a rejected payload must not have been fetched at all",
      );
      assertEquals(
        head.providerCalls,
        0,
        "a rejected payload must not have reached a paid provider",
      );
      return;
    }

    // The load-bearing assertion.
    assertStrictEquals(
      head.status,
      base.status,
      `cc-cleanup answered ${base.status} and this answers ${head.status}` +
        (head.code ? ` (${head.code})` : "") +
        ` — if that is deliberate, document it in corpus.ts as \`intentional\``,
    );

    // Silently losing every reference while still answering 200 is a
    // regression the status alone cannot see.
    if (base.providerImages > 0) {
      assert(
        head.providerImages > 0,
        `cc-cleanup sent ${base.providerImages} reference image(s) to the provider and this sent none`,
      );
    }

    // FASE F may fetch LESS than cc-cleanup (it stopped downloading entries no
    // handler reads) but never more, and never anything cc-cleanup did not —
    // unless the case documents why.
    if (!entry.mayFetchMore) {
      for (const url of head.fetched) {
        assert(
          base.fetched.includes(url),
          `fetched ${url}, which cc-cleanup never did` +
            ` — if that is deliberate, document it in corpus.ts as \`mayFetchMore\``,
        );
      }
    }
  });
}
