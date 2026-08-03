CODEX PLAN REVIEW — PLAN.md @ 2026-07-29 post-PF-close
FREEZE RECOMMENDATION: FREEZE WITH AMENDMENTS BELOW

FINDINGS:

[P1] AMEND-REQUIRED — D3 conflicts with the inherited PB/A7a bucket contract

Target text:
> “Images come from the pinned drafts bucket or inline only. No external origins, ever.”
>
> “Detail lives in the prior plan §3 (+ A7a, B5).”

The frozen PF implementation allows only `cuentacuentos-drafts`, while inherited A7a requires
`cuentacuentos-drafts` plus `liturgia-images`. The non-goal “Web-URL image references” is also too
broad because PF intentionally accepts pinned first-party bucket URLs. The plan must either reject
A7a or define how PB may amend the allowlist; it cannot freeze both statements as binding.

Proposed replacement text:
> | D3 | Image references are inline or exact-path URLs from an explicit first-party Supabase
> bucket allowlist; arbitrary/external web origins are never allowed. PF freezes the current
> allowlist to `cuentacuentos-drafts` (public and signed forms). PB may add `liturgia-images` only
> as an explicit contract change after re-verifying its RLS/path shape and adding provenance,
> cross-bucket rejection, and consumer tests; it may not widen to an origin-wide or user-supplied
> allowlist. | 2026-07-28, clarified 2026-07-29 | Brent; Codex Sol |

Replace the non-goal with:
> - Arbitrary/external web-URL image references — explicitly rejected (D3); exact allowlisted
> first-party Storage URLs are not “web URLs” for this non-goal.

[P2] AMEND-REQUIRED — D4 still states the pre-refinement fatality rule before contradicting it

Target text:
> “fatal = provenance, body cap, per-image + aggregate size, DoS ceiling. Everything else drops
> the one entry… Skippable pass-2 download failures are distinct from fatal inline size/budget
> failures.”

“Per-image + aggregate size” is too strong: PF deliberately makes every pass-2 outcome skippable,
including oversized downloads and download-side aggregate exhaustion. The appended refinement is
correct, but the row should state one rule rather than two.

Proposed replacement text:
> | D4 | Degradation is stage- and consumption-aware. Fatal for the whole request: body cap;
> provenance failure on any recognized entry (consumed or not); the all-slot traversal ceiling;
> and, for entries the selected request type consumes, inline per-image size, inline aggregate
> budget, and the consumed-image ceiling. Entries the selected type does not consume receive
> provenance validation only. Every pass-2 outcome—including 404, timeout, redirect refusal,
> unsupported bytes, oversized download, and download-side aggregate exhaustion—drops only that
> entry, is reported in `skippedImages`, and generation continues. `refine.sourceImage` overrides
> degradation and fails closed with the most precise available code. | 2026-07-27, refined
> 2026-07-29 | Brent; Codex Sol |

[P3] AMEND-REQUIRED — D6 does not freeze one reproducible lint identity method and mislabels the
Node baseline

Target text:
> “record `node --version` in every report… Known baselines: tsc app-config ~1041 lines…”
>
> “`deno lint`: 101→95.”
>
> “lint identities 84↔84 delta EMPTY… (methods per D6)”

The runtime split is sound, and I confirmed that `deno check .` and `deno check **/*.ts` produce
the same 47 identities at `2e9eeae` and the same 46 at `c496490`. The unresolved problem is lint
identity granularity: the PF records use 84 (rule+file), 89 (rule+file:line:column), and 95
(problem instances). D6 does not define which one binds. Also, PFE’s 1041 is a diagnostic count,
not “lines”; its captured output was 3987 lines.

Proposed replacement D6 row:
> | D6 | Gates are delta-based: zero new diagnostic/lint identities versus a captured baseline,
> compared like-for-like under the identical relevant runtime. Record `node --version` for Node
> gates, `deno --version` for Deno gates, and both when both stacks are touched. Node reference:
> v22.22.0; Node 26 adds 8 base-identical localStorage Vitest failures. PFE baselines:
> `npx tsc -p tsconfig.app.json --noEmit` = 1041 diagnostics (not output lines);
> ESLint = 159 problems (116 errors/43 warnings); Vitest = the 6 named pre-existing
> `MesaAbiertaDashboard` failures. Deno reference: 2.7.11, from `supabase/functions/`, with
> canonical commands `deno test --allow-all .`, `deno lint .`, and `deno check .`.
> `deno check` identities pair each `TS#### [ERROR]` with its following `file://` location,
> strip ANSI, normalize through `supabase/functions/`, then `sort -u` and `comm`.
> `deno lint` identities are the multiset of `error[rule] + message + normalized relative file`
> (line/column excluded so harmless line shifts do not manufacture deltas; multiplicity retained
> so duplicate new problems still count). Reference: `2e9eeae`→`fase-f@7d32182` check
> 47→46 (one removed/zero added), lint 101→95, tests 131/0; `0066c0f`→`c496490` check
> 46↔46, lint 95↔95, tests 159→163 with zero failures. | FASE A + Codex PFE + PF,
> clarified 2026-07-29 | PM; Codex Sol |

Replace the PF-close shorthand with:
> `deno lint` headline problems 95↔95 and canonical problem-instance multiset 95↔95, delta
> EMPTY; the PM’s historical rule+file projection was 84↔84 and is retained only as a record of
> that run. `deno check` identities 46↔46, delta EMPTY.

[P4] AMEND-REQUIRED — PC’s target is correct, but its scope and acceptance contract are not
executable as written

Target text:
> “Scope: `generate-story/handler.ts` … env-overridable `RESEARCH_MODEL` … `thinkingLevel`
> low/minimal, `maxOutputTokens` reviewed … degradation observable in the response.”
>
> “spec; finalize criteria at kickoff”

At `c496490`, `GEMINI_MODEL` is exactly `handler.ts:59`, but `index.ts:17-28` owns environment
reads and dependency construction. A handler-only env read would contradict D2. “low/minimal,”
“reviewed,” and “observable” leave the executor to choose provider configuration, result types,
warning placement, failure codes, and test boundaries. The model intent itself is current:
Google lists stable `gemini-3.5-flash`, and the REST API supports `thinkingConfig.thinkingLevel`;
the API exposes candidate `finishReason`, including `STOP` and `MAX_TOKENS`.
[Google model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
[GenerateContent API reference](https://ai.google.dev/api/generate-content)

Proposed replacement PC section:
> ## Phase PC — research model + API-observable degradation — SPEC READY
> **Base/branch:** create `phase/pc-research` from
> `pf-fix-7d32182`@`c496490`.
>
> **Scope:** `supabase/functions/generate-story/handler.ts`,
> `supabase/functions/generate-story/index.ts`, focused production-handler/config tests, and only
> the corpus expectation changes required by the explicitly additive warning contract.
> `src/**`, story validation (PD), and storage (PB) remain out of scope.
>
> **Configuration contract:** `index.ts` reads
> `GEMINI_RESEARCH_MODEL ?? 'gemini-3.5-flash'` and injects the resulting `researchModel` through
> `HandlerDeps`/`ProviderConfig`; `handler.ts` does not read `Deno.env`. Both
> `researchLocation` and `analyzeImagesForVisualDescription` use that injected model. Both send
> `generationConfig.thinkingConfig.thinkingLevel: 'LOW'` and
> `maxOutputTokens: 1024`. A different model, thinking level, or cap requires a PLAN decision
> backed by a recorded provider-doc/canary finding; the executor does not choose one silently.
>
> **Result contract:** research helpers return a discriminated result:
> `{status:'ok', text, finishReason:'STOP'}` only for trimmed non-empty text;
> `{status:'skipped', code:'NO_IMAGES'}` only when an image-analysis item has no photos; otherwise
> `{status:'failed', code, httpStatus?, finishReason?}`. Required failure codes are
> `NO_API_KEY`, `MODEL_NOT_FOUND` (HTTP 404), `PROVIDER_HTTP_ERROR`,
> `PROVIDER_UNAVAILABLE` (retry exhaustion/timeout), `EMPTY_RESPONSE`,
> `OUTPUT_TRUNCATED` (`MAX_TOKENS`), and `OUTPUT_BLOCKED` (other non-`STOP` finish reasons).
> Failed/skipped research contributes empty text to the Claude prompt so story generation can
> continue. Only `failed` results produce Spanish response warnings.
>
> **Response contract:** aggregate non-empty
> `warnings:[{source:'location'|'landmark'|'prop', code, message, httpStatus?, finishReason?}]`
> additively on every envelope written after research (prompt preview, success, and downstream
> error); omit the key when empty. Preserve PF’s `skippedImages` behavior on every envelope.
> Logs remain shape/count-only and never quote provider bodies, warning messages derived from
> provider text, URLs, names, or request prose.
>
> **Acceptance criteria/tests:**
> - [PC1] Default and override model wiring reach both Gemini URLs. A D7 mutation that ignores the
>   injected override or severs `index.ts`→handler configuration must fail.
> - [PC2] Request bodies for both research calls pin `thinkingLevel:'LOW'` and
>   `maxOutputTokens:1024`.
> - [PC3] Non-empty text + `finishReason:'STOP'` is `ok`; empty text, `MAX_TOKENS`, and another
>   non-STOP reason produce the exact failed codes above and no partial analysis text.
> - [PC4] HTTP 404, other HTTP error, timeout/retry exhaustion, no API key, and no-images paths
>   produce the exact status/code/warning behavior above; no-images is the only `skipped` case.
> - [PC5] A mix of successful and failed research still calls Anthropic and returns the story plus
>   warnings; all-research-failed does the same. Preview and post-research error envelopes retain
>   warnings.
> - [PC6] Existing PF log-hygiene tests stay green; new warning/error logs receive planted-token
>   tests. Corpus changes identify the additive warning field as the intended divergence and do
>   not re-capture unrelated behavior to green a failure.
> - [PC7] D6 gates and D7 base-red/mutation evidence are recorded. Before phase close, re-check
>   the model ID and raw REST knob spelling against official docs and run the separately
>   authorized authenticated minimal canary from the prior plan; drift is a FINDING, not an
>   unreviewed substitution.
>
> **Frontend follow-up:** this phase makes degradation API-observable only. Add a named
> `PC-UI` release prerequisite, based on the PFE lineage, to render the warnings as the prior plan
> specified (non-blocking Spanish notice; all-failed banner). PREL cannot declare the
> “observable degradation” product goal complete until `PC-UI` is closed or Brent explicitly
> accepts API-only observability.
>
> **Rollback:** revert the phase branch; no deploy in phase (D9).

[P5] AMEND-REQUIRED — PB/PG/PH are honestly unready, but the phase index hides known dependencies
and the outline does not name the mandatory spec-pass gaps

Target text:
> “PB … Depends on PF”
>
> “PG … Depends on PA”
>
> “PH | Costs (D3=B product decision + append cover/end) … Depends on PC, PD”
>
> “Detail lives in the prior plan §3 (+ A7a, B5).”

The boundary “DO NOT EXECUTE” is honest. The inherited text supplies useful intent and seed tests,
but not a current executable spec. PB’s prior dependencies are PA/A4 plus PF/A7a; PG must use the
latest PA-descendant frontend state (PFE); PH’s append/persist UI also depends on that frontend
lineage. “D3=B” now collides with this plan’s D3, which is the origin policy, not the old cost
option.

Proposed phase-index rows:
> | PB | Immutable storage | TODO — needs spec pass | — | PFE (contains PA); PF |
> | PG | Cancellation | TODO — needs spec pass | — | PFE (contains PA) |
> | PH | Costs (prior-plan cost option B: 2×pro cover/end + append) | TODO — needs spec pass |
> — | PFE; PC; PD |

Proposed replacement outline:
> ## Phases PB / PG / PH — outline only, DO NOT EXECUTE from this
> The prior plan §3 plus A7a/B5 is seed material, not an executor spec. Each phase requires its own
> Codex plan review and must resolve the following before an executor prompt:
>
> - **PB:** choose and record the cross-lineage base; reconcile D3 with A7a’s possible
>   `liturgia-images` addition; re-verify current bucket RLS/path rules; include or explicitly
>   exclude `liturgyService.uploadSingleImage`; define content-hash/idempotent-409 behavior,
>   partial-upload failure semantics, legacy-path handling, `editorStateV1` path-only persistence,
>   and no-delete/GC boundaries; rebase every file/line target and make all T-B criteria
>   mutation-sensitive.
> - **PG:** branch from `cc-downscale-a@185c370` or its latest reviewed descendant; rebase the
>   pipeline/retry targets; define cancellation at pre-attempt, stagger, backoff, in-flight
>   provider call, post-generate/pre-apply, saving, and persist-in-flight boundaries; state which
>   work returns to `pending`, prove save-retry entries survive, and pin manual/batch parity with
>   fake-timer plus ignored-AbortSignal tests.
> - **PH:** refer to “prior-plan cost option B,” never current D3; choose a cross-lineage base that
>   contains PFE and PC/PD; refresh model prices and exact first-attempt call counts; state what
>   costs exclude; pin default cover/end count=2, append-vs-replace selection semantics,
>   persistence/reload, concurrent-click disabling, and provider-call counts. Any hard total-cost
>   ceiling is a new Brent product decision, not an executor choice.

[P6] AMEND-REQUIRED — PREL’s merge premise is incomplete and partly misleading

Target text:
> “merge order proposal (PA → PFE; PF independent)”

Verified ancestry:
- PFE `185c370` contains PA `0e1d53b`.
- PF `c496490` contains `fase-f@7d32182` but does **not** contain PA.
- PF and PFE share merge-base `cc-cleanup@2e9eeae`; that base contains P0 `1343513`.
- Neither PF nor PFE contains the other.
- Their current unique diffs have zero overlapping file paths, but later PB/PC/PD/PG/PH work can
  create cross-lineage overlap.

Thus PA is not a separate merge input when PFE (or a PFE descendant) is merged, and “PF
independent” is true only of the current changed-path sets—not of ancestry, product contracts, or
future phase dependencies.

Proposed replacement PREL section:
> ## Phase PREL — integration + release
> Brent’s authority end to end (D9). PREL begins only after every required phase and `PC-UI`
> disposition is recorded.
>
> **Frozen ancestry fact (2026-07-29):** `cc-downscale-a@185c370` contains
> `fase-a-complete@0e1d53b`; `pf-fix-7d32182@c496490` does not. Both descend from
> `cc-cleanup@2e9eeae` (which contains live P0 `1343513`), neither contains the other, and their
> current unique diffs touch no common paths.
>
> **Required PREL inputs/acceptance:**
> 1. Record the final reviewed tip SHA and parentage for every surviving lineage. Merge only final
>    descendant tips—do not merge PA separately when a PFE descendant already contains it, and do
>    not merge frozen `fase-f@7d32182` when a PF descendant contains it.
> 2. Create an integration branch from then-current `origin/main`; preserve ancestry with explicit
>    merges unless Brent approves a documented alternative. Do not independently squash branches
>    with overlapping history. Prove current-main fixes after P0 remain present.
> 3. Integrate the final PFE/PA-side lineage with the final PF/PC/PD-side lineage and any
>    cross-lineage PB/PH branch according to the recorded DAG; re-check changed-path overlap and
>    resolve conflicts by contract, not “ours/theirs.”
> 4. Run combined Node and Deno D6 gates, PF corpus consistency, auth-before-body regressions,
>    persistence/reload/cancellation tests, and a supervised synthetic smoke on the integrated
>    tree before any push or deploy.
> 5. Sequence infrastructure before consumers: bucket/RLS changes before code that writes new
>    paths; required env/secrets (including `GEMINI_RESEARCH_MODEL`) before edge deployment;
>    separately authorized edge-function deploys before the frontend release that depends on
>    their response contract. Record deployed function names, commit SHAs, config, and canary
>    results.
> 6. Prepare forward-fix/rollback instructions that never restore the prohibited insecure v32;
>    get Brent’s explicit authorization separately for merges, each edge deploy, and the
>    `main` push. A `main` push is the production release.
> 7. Move or snapshot the currently unversioned PLAN/LEDGER/review record into the released
>    repository (or another versioned archive) as already promised in META.

[P7] AMEND-REQUIRED — the learned review rhythm is recorded as history, not yet enforced as an
operating gate

Target text:
> “every PM turn ends with ONE of three prompts…”
>
> “Rhythm restated: executor → PM verify → Sol.”

Those rules are correct but insufficiently operational. The PF misroute shows that “restated” does
not prevent a direct executor→reviewer handoff, and the PFE/PF capped rounds show that a remediation
needs mutation sensitivity and a class-wide sibling sweep before consuming the final review.

Proposed new section after the frozen decisions:
> ## Operating and review gates
> 1. Every PM turn ends with exactly one addressed next prompt: executor, reviewer, or fresh-PM
>    bootstrap. Each prompt header names the role, target branch+SHA, return-to actor, scope, and
>    reviewer round `n/N`.
> 2. Executor reports return to the PM only. The PM independently verifies the exact SHA/diff,
>    relevant gates, base-red or D7 mutation evidence, and every acceptance criterion before
>    issuing a reviewer prompt. For an invariant-class remediation, PM verification includes a
>    class-wide sibling-site sweep, not only the exhibited line.
> 3. Reviewer prompts include the PM verification record and frozen question set. A re-review
>    judges the remediation matrix and permitted related residue; it does not silently become a
>    fresh uncapped review round.
> 4. A misrouted report is returned to PM before review. If review already occurred, it is logged
>    and consumes the stated cap; there is no automatic replacement round.
> 5. After the final allowed FAIL, no executor or reviewer prompt is issued until Brent explicitly
>    chooses accept, re-plan, or backlog. Any micro-round states its single-item scope and separate
>    authorization in PLAN before work begins.
> 6. A PM session that authored the branch rotates before verifying or triaging its review.
>    Executor, PM verifier, and reviewer remain distinct. Phase close requires PM verification
>    plus reviewer PASS/CONFIRMED FIXED, or an explicit Brent exception recorded in the decision
>    log.

[P8] AMEND-REQUIRED — status is substantively true, but P0’s locator and the freeze marker need
precise wording

Target text:
> “P0 … DONE (live) | `main`@1343513”
>
> “PLAN FROZEN: not yet”

The repo confirms PA/PF/PFE tips exactly and confirms all three are unmerged into current main.
P0 `1343513` is an ancestor of current `main`/`origin/main`, but `main` now points at `d79d329`;
`main@1343513` reads as a stale branch-tip claim. Repository ancestry cannot independently prove
the remote deployment, so “live” remains supported by the reviewed project record.

Proposed phase-index replacements:
> | P0 | AuthN/AuthZ hotfix | DONE (live; deployment SHA `1343513`, contained in current main) |
> `main`/`origin/main`@`d79d329` as of 2026-07-29 | — |
> | PC | Research model + API-observable degradation | TODO — spec ready after this review | — |
> PF closed |

After applying all amendments in this review, replace the META freeze line with:
> - PLAN FROZEN: **yes — 2026-07-29 after applying
> `docs/plan/reviews/PLAN-review.md` [P1]–[P8]**. Future architectural, phase-boundary,
> acceptance, ancestry, or release changes require a dated Decision-log entry and a renewed
> freeze check before the affected executor prompt. Historical close blocks remain records and
> are not silently rewritten except to correct a clearly labeled factual typo.

ANSWERS:

1. COHERENCE — D1, D2, D5, D7, D8, and D9 are mutually consistent. D7’s mutation exception is
the right response to the PFE wiring failure. The conflicts are D3 versus inherited A7a, D4’s
pre-refinement shorthand versus its refined implementation, and D6’s unspecified lint identity
granularity. [P1]–[P3] resolve them without changing PF behavior.

2. STATUS TRUTH — PA is exactly `fase-a-complete@0e1d53b`, PF is exactly
`pf-fix-7d32182@c496490` and contains `fase-f@7d32182`, and PFE is exactly
`cc-downscale-a@185c370` and contains PA. All are unmerged into current main. P0 `1343513` is
contained in current `main@d79d329`; only the phase-index locator needs clarification.

3. PC READINESS — `generate-story/handler.ts:59` is correct and the `gemini-3.5-flash` intent is
currently valid. PC is not executable as written because env ownership belongs to `index.ts`,
the provider knobs are alternatives rather than decisions, and the observable degradation
contract/tests are undefined. [P4] supplies the missing scope, exact bindings, result/warning
contract, envelope behavior, D7 wiring proof, canary gate, and explicit UI follow-up.

4. PB/PG/PH GATING — marking them spec-incomplete is honest and should remain. Prior §3 plus
A7a/B5 contains enough intent and candidate tests to start each spec pass, but not enough current
line targets, branch topology, dependency truth, failure-boundary semantics, RLS verification, or
price/model evidence to issue an executor prompt. [P5] names those gaps now.

5. PREL — PF and PFE do not both contain FASE A. Only PFE contains PA. They share
`cc-cleanup@2e9eeae` (including P0), neither contains the other, and their present unique diffs
have no file overlap. The real constraint is to merge final descendant lineages from current
main while preserving shared ancestry, not “PA then PFE, PF independent.” PREL also needs the
phase-tip DAG, infra/env ordering, combined gates/canaries, deploy-SHA recording, and a safe
forward-fix plan; [P6] makes these explicit.

6. PROCESS RULES — the three-prompt turn-end rule, author rotation, and
executor→PM→reviewer sequence are the correct lessons. Missing were enforceable addressing,
review-round counters, a hard no-review-before-PM gate, mutation/class-wide verification before
a capped re-review, misroute accounting, and the explicit stop after a final FAIL. [P7] adds
them.

NOTES (non-verdict): no code findings. The repository cross-check was read-only; the temporary
detached worktree was used only for ancestry/file-scope inspection and for confirming that the two
recorded Deno check invocations produce identical identity sets at the reference base and PF tip.
