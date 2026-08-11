/**
 * Captures the corpus baseline.
 *
 * Run this from a worktree at `b241eaf` — the pure-extraction commit, which is
 * `cc-cleanup`'s behaviour with an importable handler and nothing else changed:
 *
 *   deno run --config deno.json --allow-all _shared/corpusCapture.ts > /tmp/corpus_baseline.json
 *
 * Then copy the result to `_shared/corpus_baseline.json` on the working branch
 * and commit it. Re-capture only when a corpus CASE changes — never to make a
 * failing comparison pass, which would defeat the entire mechanism.
 */

import { CORPUS } from "./corpus.ts";
import { runCorpusCase, type CorpusOutcome } from "./corpusRunner.ts";

import { createHandler as createSceneHandler } from "../generate-scene-images/handler.ts";
import { createHandler as createStoryHandler } from "../generate-story/handler.ts";

// Inlined rather than imported from testHelpers: this script has to run at the
// baseline commit, where `_shared/imageFetch.ts` does not exist yet. Its only
// dependency must be the handler under capture.
const authzDeps = {
  getUser: () =>
    Promise.resolve({
      kind: "authenticated" as const,
      user: { id: "user-abc", email: "u@example.com" },
    }),
  checkPermission: () => Promise.resolve({ kind: "allowed" as const }),
};

// Deps shapes differ between the baseline commit and HEAD (the baseline has no
// supabaseUrl/imageLimits fields), so both are supplied and the cast absorbs
// the difference. Everything else about the run is identical.
const sceneDeps = {
  apiKey: "test-gemini-key",
  flashModel: "test-flash-model",
  proModel: "test-pro-model",
  authzDeps,
  supabaseUrl: "https://proj.supabase.co",
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Baseline and current handler dependency shapes intentionally differ.
} as any;

const storyDeps = {
  anthropicApiKey: "test-anthropic-key",
  googleAiApiKey: "test-gemini-key",
  authzDeps,
  supabaseUrl: "https://proj.supabase.co",
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Baseline and current handler dependency shapes intentionally differ.
} as any;

const scene = createSceneHandler(sceneDeps);
const story = createStoryHandler(storyDeps);

// The handlers log heavily. Silenced during capture so the only thing on
// stdout is the JSON — and so a stray log line cannot corrupt the baseline.
const realConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};
const silence = () => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
};
const restore = () => {
  console.log = realConsole.log;
  console.warn = realConsole.warn;
  console.error = realConsole.error;
  console.info = realConsole.info;
};

const baseline: Record<string, CorpusOutcome> = {};

silence();
for (const entry of CORPUS) {
  const handler = entry.fn === "story" ? story : scene;
  try {
    baseline[entry.name] = await runCorpusCase(handler, entry);
  } catch (err) {
    // A throw that escapes the handler is itself a fact worth recording.
    baseline[entry.name] = {
      status: -1,
      code: `ESCAPED: ${err instanceof Error ? err.name : "unknown"}`,
      fetched: [],
      providerImages: 0,
      providerCalls: 0,
    };
  }
}

restore();

const out = Deno.args[0];
const json = JSON.stringify(baseline, null, 2) + "\n";
if (out) {
  await Deno.writeTextFile(out, json);
  console.log(`wrote ${Object.keys(baseline).length} cases to ${out}`);
} else {
  console.log(json);
}
