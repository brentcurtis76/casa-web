# PLAN — CASA cuentacuentos overhaul

META
- REPO / ROOT: `/Users/brentcurtis/Documents/CASA/casa-web` (shared working dir with live Bridge
  worktrees — executors work in their OWN worktree; `jb list` + `git worktree list` before any checkout)
- PLAN DOCS: **`docs/plan/` INSIDE the repo, on `main`, as of 2026-08-03 (PREL item 7 — done).**
  ~~`/Users/brentcurtis/Documents/CASA/docs/plan/` — deliberately OUTSIDE the repo: every
  active branch is unmerged and a push to `main` auto-deploys, so in-repo docs would ride a frozen
  branch. Cost: these files aren't version-controlled. Revisit at PREL.~~ **[RESOLVED at PREL: the
  reason expired the moment the overhaul shipped — there is no frozen branch left to ride, so the
  record now lives in the repo it describes and is version-controlled like everything else. The old
  external path holds a pointer only; treat any surviving copy there as stale.]**
- BRANCH CONVENTION: existing branches keep their names (`fase-f`, `cc-downscale-a`, …); new phases
  use `phase/<id>-<slug>`.
- PLAN FROZEN: **yes — 2026-07-29** after applying `docs/plan/reviews/PLAN-review.md`
  [P1]–[P8]. Future architectural, phase-boundary, acceptance, ancestry, or release changes
  require a dated Decision-log entry and a renewed freeze check before the affected executor
  prompt. Historical close blocks remain records and are not silently rewritten except to
  correct a clearly labeled factual typo. The prior plan
  (`~/.claude/plans/i-want-you-to-snuggly-comet.md` §3 + A7a/B5) is SEED MATERIAL for the
  PB/PG/PH spec passes, not an executor spec; its EXECUTION STATUS block is historical; this
  file is the status of record.

## Goal
Ship the cuentacuentos overhaul: fail-closed security on the paid edge functions (done, live), safe
image handling (F), reliable persistence (A), observable research model (C), strict output contract
(D), immutable storage (B), consistent cancellation (G), cost controls (H) — and land the
accumulated unmerged branches.

## Non-goals
- `generate-graphic` auth (A-graphic) — separate open item, tracked in backlog
- Arbitrary/external web-URL image references — explicitly rejected (D3); exact allowlisted
  first-party Storage URLs are not "web URLs" for this non-goal
- Bridge pipeline changes

## Frozen architectural decisions
| # | Decision | Since | Raised by |
|---|---|---|---|
| D1 | Paid fns: fail-closed authz guard runs before body read, any fetch, or provider call. Denied⇒403, backend error⇒503, OPTIONS before auth. | FASE 0 (live) | plan v3.1 |
| D2 | Handler split: thin `index.ts` entrypoint (env + deps + serve) + importable `handler.ts` with injected deps. | FASE F | executor |
| D3 | Image references are inline or exact-path URLs from an explicit first-party Supabase bucket allowlist; arbitrary/external web origins are never allowed. PF freezes the current allowlist to `cuentacuentos-drafts` (public and signed forms). PB may add `liturgia-images` only as an explicit contract change after re-verifying its RLS/path shape and adding provenance, cross-bucket rejection, and consumer tests; it may not widen to an origin-wide or user-supplied allowlist. | 2026-07-28, clarified 2026-07-29 | Brent; Codex Sol |
| D4 | Degradation is stage- and consumption-aware. Fatal for the whole request: body cap; provenance failure on any recognized entry (consumed or not); the all-slot traversal ceiling; and, for entries the selected request type consumes, inline per-image size, inline aggregate budget, and the consumed-image ceiling. Entries the selected type does not consume receive provenance validation only. Every pass-2 outcome — including 404, timeout, redirect refusal, unsupported bytes, oversized download, and download-side aggregate exhaustion — drops only that entry, is reported in `skippedImages`, and generation continues. `refine.sourceImage` overrides degradation and fails closed with the most precise available code. | 2026-07-27, refined 2026-07-29 | Brent; Codex Sol |
| D5 | Behaviour corpus: expectations CAPTURED from a pre-change commit, never hand-written; baseline never re-captured to green a failing comparison. Payloads derived from live call sites via `git show <branch>:`, not working-tree greps. | FASE F | PM |
| D6 | Gates are delta-based: zero new diagnostic/lint identities versus a captured baseline, compared like-for-like under the identical relevant runtime. Record `node --version` for Node gates, `deno --version` for Deno gates, and both when both stacks are touched. Node reference: v22.22.0; Node 26 adds 8 base-identical localStorage Vitest failures. PFE baselines: `npx tsc -p tsconfig.app.json --noEmit` = 1041 diagnostics (not output lines); ESLint = 159 problems (116 errors/43 warnings); Vitest = the 6 named pre-existing `MesaAbiertaDashboard` failures. **Vitest canonical command amended 2026-07-30 (PB-FE F1): `npx vitest run --no-file-parallelism` — default parallelism is CPU-contention-flaky on the reference machine (the base itself produced a 7th spurious failure under load; every affected suite passes serially and in isolation); serial is the like-for-like form, measured base AND head.** Deno reference: 2.7.11, from `supabase/functions/`, canonical commands `deno test --allow-all .`, `deno lint .`, `deno check .`. `deno check` identities pair each `TS#### [ERROR]` with its following `file://` location, strip ANSI, normalize through `supabase/functions/`, then `sort -u` and `comm`. `deno lint` identities are the multiset of `error[rule] + message + normalized relative file` (line/column excluded so harmless line shifts do not manufacture deltas; multiplicity retained so duplicate new problems still count). Reference: `2e9eeae`→`fase-f`@7d32182 check 47→46 (one removed/zero added), lint 101→95, tests 131/0; `0066c0f`→`c496490` check 46↔46, lint 95↔95, tests 159→163 with zero failures. | FASE A + Codex PFE + PF, clarified 2026-07-29 | PM; Codex Sol |
| D7 | Test honesty: every new test base-red proven per finding, before its fix, with the failure recorded; runtime strings captured from the runtime, never invented; an assertion that cannot fail is a defect. **Codified exception (Codex, PFE):** a coverage-only test of already-correct behaviour cannot be base-red — the accepted substitute is a recorded MUTATION proof: name the mutation, show the test failing under it. A wiring/integration claim (X is connected to Y) is only proven by a mutation that severs the wiring. **Hygiene-test rule (Codex, PC r1):** plant BOTH obviously malformed values AND fresh values that match the accepted lexical shape but lie outside the semantic domain — a shape-only classifier passes the first and leaks the second. | FASE F reviews + Codex PFE + PC r1 | reviews |
| D8 | User-facing copy is Spanish. | repo CLAUDE.md | — |
| D9 | Merge/push to `main` only on Brent's explicit instruction; a `main` push deploys. Edge-function deploys are a separate authorized step, never inside a phase. | global policy | Brent |

## Operating and review gates (PLAN-review [P7], 2026-07-29)
1. Every PM turn ends with exactly one addressed next prompt: executor, reviewer, or fresh-PM
   bootstrap. Each prompt header names the role, target branch+SHA, return-to actor, scope, and
   reviewer round `n/N`.
2. Executor reports return to the PM only. The PM independently verifies the exact SHA/diff,
   relevant gates, base-red or D7 mutation evidence, and every acceptance criterion before
   issuing a reviewer prompt. For an invariant-class remediation, PM verification includes a
   class-wide sibling-site sweep, not only the exhibited line.
3. Reviewer prompts include the PM verification record and frozen question set. A re-review
   judges the remediation matrix and permitted related residue; it does not silently become a
   fresh uncapped review round.
4. A misrouted report is returned to PM before review. If review already occurred, it is logged
   and consumes the stated cap; there is no automatic replacement round.
5. After the final allowed FAIL, no executor or reviewer prompt is issued until Brent explicitly
   chooses accept, re-plan, or backlog. Any micro-round states its single-item scope and
   separate authorization in PLAN before work begins.
6. A PM session that authored the branch rotates before verifying or triaging its review.
   Executor, PM verifier, and reviewer remain distinct. Phase close requires PM verification
   plus reviewer PASS/CONFIRMED FIXED, or an explicit Brent exception recorded in the decision
   log.
7. The PM scopes every remediation round from the SAVED REVIEW FILE OF RECORD, read in full —
   never from a chat verdict, summary, or code-comment alone. A remediation fix-list is only
   "closed" after the file's every required item is in it. (Added 2026-07-30 after the PD
   round-2 completeness FAIL: the round-1 file required a third test the PM's chat-scoped
   fix-list omitted.)

## Phase index
| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| P0 | AuthN/AuthZ hotfix | DONE (live; deployment SHA `1343513`, contained in current main) | `main`/`origin/main`@`d79d329` as of 2026-07-29 | — |
| PA | Persistence (FASE A) | DONE — unmerged, reviewed | `fase-a-complete`@0e1d53b | — |
| PF | Image safety (FASE F) | **DONE** — closed 2026-07-29; Codex CONFIRMED FIXED at `c496490` after 2 FAILs + Brent-authorized micro-round. Merge deferred to PREL. | `pf-fix-7d32182`@c496490 (contains `fase-f`@7d32182) | — |
| PFE | Frontend follow-ups (downscale / skipped notice / refine copy) | **DONE** — Codex PASS 2026-07-29 | `cc-downscale-a`@185c370 | PA; PF contract |
| PC | Research model + API-observable degradation | **DONE** — closed 2026-07-29: review PASS 2/2, canary run (F1 clean; F3 → cap 2048), cap change Codex-CONFIRMED. Merge deferred to PREL. | `phase/pc-research`@96cb2cc | PF closed ✓ |
| PD | Strict output contract (`strict:true`, typed 502) | **DONE** — closed 2026-07-30: r1 FAIL ([B1] parse seam) → remediated → r2 FAIL (completeness; PM scoping miss → gate 7) → Brent re-plan → test-only micro-round → Codex CONFIRMED. Merge deferred to PREL. | `phase/pd-contract`@db42745 | PC closed ✓ |
| PB | Immutable storage | **DONE** — closed 2026-07-31: r1 FAIL (5B, all FE) → consolidated remediation → r2/2 PASS/CONFIRMED. Merge deferred to PREL. | `phase/pb-storage-fe`@5f7b6bd (⊃185c370) + `phase/pb-storage-edge`@10d1190 (⊃db42745) | PFE (contains PA); PF |
| PG | Cancellation | **DONE** — closed 2026-07-31: r1 FAIL ([B1] evidentiary) → one-commit test-only remediation → r2/2 PASS/CONFIRMED. Merge deferred to PREL. | `pg-fix-d3fbd58`@1b0cfed (⊃ `phase/pg-cancellation`@d3fbd58 ⊃ 5f7b6bd) | PB-FE tip (contains PFE ⊃ PA) |
| PC-UI | Warnings UI + error-body parsing + T-D.13 (release prerequisite made buildable — Brent 2026-07-31: BUILD) | **DONE** — closed 2026-08-01: one executor round → r1/2 PASS/CONFIRMED, zero findings. Merge deferred to PREL. | `phase/pcui-warnings`@8ceec7c (⊃ `pg-fix-d3fbd58`@1b0cfed) | PC; PD; PG (FE tip) |
| PH | Costs (prior-plan cost option B: 2×pro cover/end + append) | **DONE** — closed 2026-08-03: r1 build (FINDINGS, §1.6) → r2 consolidated ([B1-PM] + ten frozen recoveries under the dated G1 amendment) → review r1 FAIL ([B1] selection persistence) → remediation → r2/2 **PASS/CONFIRMED FIXED**, G1–G10 + T-H.1–T-H.12 MET IN FULL. Merge deferred to PREL. | `phase/ph-costs`@ccb34f7 (⊃ 9d96c41 ⊃ 39e1736 ⊃ 8ceec7c) | PFE; PC; PD; PC-UI closed ✓ |
| PREL | Integration + release (merge order, deploy) | TODO — Brent's authority; **input record compiled 2026-07-31** (item 1 preparation, see section). PC-UI CLOSED 2026-08-01 → **PREL waits on PH only.** PD-REFINE deferred post-release (Brent); liturgia-images veto DECLINED (change ships as reviewed). | — | all above |

## Phase PFE — frontend follow-ups — CLOSED
**DONE 2026-07-29, Codex PASS at `185c370`.** Three executor rounds (r1 pre-adoption, r2 fix of
3 PM-blocking findings, r3 fix of Codex [B1] — the A2 wiring proof). Round-2 spec kept below as the
record; round 3 added one test file only. Deviations accepted during execution are in the Decision
log. Merge deferred to PREL per D9.

### Round-2 spec (historical)
**Scope:** `CuentacuentoEditor.tsx` (three upload sites + the `generate-scene-images` wrapper),
`src/lib/cuentacuentos/` tests. Branch `cc-downscale-a` (off `fase-a-complete`).
**Out of scope:** `supabase/functions/**`; any FASE A file other than the editor; refactors of
adjacent code; the round-1 helper's API (extend, don't redesign).
**Acceptance criteria:**
- [A1] The 5 MB pre-check no longer rejects files the downscaler could shrink: threshold raised to
  30 MB at all three sites, as a decode-safety guard only.
- [A2] An oversized-but-decodable photo (~8 MB synthetic PNG) reaches editor state downscaled, not
  refused — proven in a real browser (Playwright), not jsdom.
- [A3] `skippedImages` from `generate-scene-images` responses reaches the same notice UI the story
  path uses (plumbed through the wrapper; success and error paths both).
- [A4] The notice renders for a scene-images response carrying `skippedImages` (test).
- [A5] Gates per D6: tsc identity diff empty; lint identical; Vitest = 6 pre-existing failures only.
- [A6] Every new test base-red proven per D7, failures recorded in the report.
**Test plan:** one Playwright spec exercising `downscaleImage` in chromium (large PNG → dimensions
≤1600 and bytes ≪ original; small PNG → untouched); Vitest for wrapper plumbing + notice.
Commands verbatim in the executor prompt.
**Definition of done:** criteria green, no BLOCKING findings, branch mergeable onto `fase-a-complete`.
**Risks:** Playwright is configured but not used for unit-style tests here; if the harness fights
back, the executor reports FINDINGS rather than forcing it.
**Rollback:** revert round-2 commits; round-1 commits stand alone.

## Phase PF — FASE F final review — CLOSED
**DONE 2026-07-29 at `pf-fix-7d32182`@c496490** (Codex single-item confirmation
`reviews/PF-b3r-confirmation.md`, after her 2 FAILs and a Brent-authorized micro-round outside
the §1.5 cap). Review chain: final review FAIL (4B/2S) → consolidated remediation @0066c0f →
re-review FAIL (1B residue) → Brent chose narrow re-plan → micro-round @c496490 → PM full
verification → Codex CONFIRMED FIXED. Merge deferred to PREL (D9); the branch carries all of
FASE F plus the remediation.
**WHAT WAS BUILT (phase summary):** one safe image normalizer (`_shared/imageFetch.ts`) behind
both paid edge functions — provenance pinned to the drafts bucket (public + signed), magic-byte
MIME truth, two-pass validate-then-materialise with type-aware consumption (a single read-rules
table shared by collector and handlers), degradation per refined D4 with `skippedImages` on
every response including error envelopes, streaming budget accounting, slot-ceiling
short-circuit during collection, shape-and-count log hygiene on every user-text/provider/scalar
channel, and a captured behaviour corpus (30 cases + consistency test) pinning parity with
`cc-cleanup`.
**WHAT CHANGED VS THE ORIGINAL PLAN:** the phase spec's "final round" became final-plus-one —
the review found the `consumed` flag was request-type-blind (a third instance of the
"rejects too much" class the corpus was built for, on a dimension the corpus didn't yet vary),
and the log-hygiene rewrite itself missed enum-looking scalars, costing the capped re-review.
D4 gained its consumed-entries refinement and D6 its deno method as review by-products. The
PM-verification step was skipped once by a misrouted report — the round that consumed Sol's
cap; the rhythm (executor → PM verify → reviewer) is now a recorded decision.

### (spec as reviewed — historical)
A review phase, not construction. `fase-f`@7d32182: two adversarial rounds already (30 findings,
all fixed), behaviour corpus in place (27 captured cases + 1 corpus↔baseline consistency test —
"28 cases" in earlier entries counts test entries; baseline captured from `b241eaf`, re-capture
independently reproduced by PM 2026-07-29).
- **Reviewer focus:** the pass-1/pass-2 split (`consumed` flag semantics), stub honesty vs runtime
  behaviour, corpus coverage gaps. The corpus exists — do not re-derive what it already pins.
- **Cap:** the two pre-adoption rounds consume the §1.5 Codex-loop cap. This round is FINAL.
  BLOCKING findings → ONE consolidated remediation by a fresh executor. A second FAIL → Brent
  decides accept / re-plan / backlog. No round 4.
- **Runtime pin (PFE lesson, D6 applied to deno):** record `deno --version`; reference is
  Deno 2.7.11 — at least one FASE F fix (the redirect-error matcher) is anchored to strings that
  runtime emits, so a version drift can shift results.
- **Contract coupling:** PFE consumed the `fase-f` response contract (`skippedImages`, error codes)
  at `7d32182`. If this review's remediation changes that contract, open a PFE follow-up item —
  PFE is Done against the contract as of that SHA.
- Merge stays with PREL.

### Final review outcome (2026-07-29) — FAIL — and the remediation round
Codex Sol's final review: **FAIL, 4 BLOCKING / 2 SHOULD-FIX / 0 NIT** (review of record:
`docs/plan/reviews/PF-final-review.md`). PM independently reproduced [B1] both halves at tip AND
base before triage; [B2]/[B3]/[B4] code-verified at the cited lines; all four AGREED.
- **[B1]** `consumed` bookkeeping is request-type-blind: collector marks fields consumed that the
  type's handler branch never reads → pass 2 fetches unused bucket URLs (wasted egress) and pass 1
  fatally charges unused inline entries (`type:"prop"` + 6,000,001-byte irrelevant character image
  → 413; base answers 200). The round-1/round-2 "rejects too much" class on a third dimension.
- **[B2]** `maxImageSlots` (512) is enforced AFTER collectors fully traverse client arrays —
  500,000-entry payload does 500k slot allocations before TOO_MANY_IMAGES throws. The DoS guard
  runs after the work it claims to bound.
- **[B3]** prompt/provider log channels bypass the hygiene invariant: raw `prompt.slice(0,300)`,
  titles, locations, names — a signed-token URL planted in `prop.visualDescription` lands in logs.
  Lines pre-exist at `2e9eeae` (carried, not introduced) but defeat the branch's own claimed
  invariant, so they block. Corpus does not compare logs, so the fix cannot break parity.
- **[B4]** story outer catch returns `{success,error}` only — drops recorded `skippedImages` when
  a post-drop provider failure escalates. **Contract-coupled** (PFE consumes `skippedImages`);
  fix must be additive-only. Executor also verifies scene-side error-envelope symmetry (in-class).
- **[S1]/[S2]** corpus fidelity: residual non-live shapes (data URLs where live sites send raw
  base64; one origin citing an invocation the editor doesn't make) and no case at the 64-consumed
  / 512-slot production boundaries. **Folded into the consolidated round** — the corpus is the
  re-review's regression instrument, and the fixes ride the same corpus.ts edit + b241eaf
  re-capture the [B1]/[B2] proofs already require.
**Remediation:** ONE consolidated round, fresh executor, on new branch **`pf-fix-7d32182`** off
`fase-f`@7d32182 (`fase-f` ref frozen: it is the review-pinned SHA and the PFE contract anchor;
naming per the a3-f4-fix precedent). Architectural requirement per Sol's notes: a single-sourced
per-type consumption map shared by collector and handler control flow (no parallel bookkeeping),
and slot-ceiling short-circuit DURING collection. Then Sol re-verdicts — her round 2 of 2. A
second FAIL goes to Brent (accept / re-plan / backlog).

### Re-review outcome (2026-07-29) — SECOND FAIL — Brent's decision gate
Remediation landed as `pf-fix-7d32182`@0066c0f (6 commits; diff confined to
`supabase/functions/**`, 7 files). **Process note:** the executor report went to Sol directly,
skipping the PM-verification step (misroute, recorded without blame — independence
executor≠reviewer≠PM held; the cost was losing the chance to catch the residue before her final
round). Sol re-review: **FAIL — 1 BLOCKING [B3-R]**; all five other findings **FIXED** (her
remediation matrix). Review of record: `docs/plan/reviews/PF-remediation-rereview.md`.
- **[B3-R]** the [B3] rewrite closed prompt/entity/provider channels but missed enum-looking
  request scalars: `sceneReferenceMode` is logged verbatim (client JSON, no validation) — a
  signed URL/token in that field reaches logs on an HTTP-200 request. PM reproduced at 0066c0f
  (status 200, token verbatim in the REQUEST CHECK line).
- **PM post-verdict sweep (multiline-aware, both handlers + imageFetch + index):** the complete
  residue is **4 client scalars / 7 log sites / 1 file** (`generate-scene-images/handler.ts`):
  `sceneReferenceMode` :821/:934/:1010, `scene.landmarkVisible` :844, `count` :815/:1353,
  `modelTier` :815. Story handler and imageFetch are clean. Sol's cited sites and the PM sweep
  agree; no additional class was found.
- **PM also verified at 0066c0f:** gates (deno test 159/0; lint 95; check 46 — third independent
  measurement, all three parties agree), D5 baseline re-capture from b241eaf (30 entries,
  byte-identical — executor's claim true), branch hygiene (ancestry off 7d32182, protected refs
  untouched, diff confinement).
- **Contract:** [B4]'s additive `skippedImages` confirmed consumed by the PFE frontend on error
  paths (`cc-downscale-a`@185c370 `CuentacuentoEditor.tsx:653`) — PFE follow-up backlog item
  CLOSED.
**Gate (per §1.5, no round is authorized without Brent):** accept / re-plan / backlog.
PM recommendation: **re-plan, narrowly** — one surgical micro-round frozen to the enumerated
7-site list + hygiene tests planting tokens in each scalar + Sol verifying that single item;
rationale: residue is closed-form (two independent sweeps agree), the fix pattern
(validate-then-classify) already exists on the branch, and everything else has passed.

### Micro-round outcome (2026-07-29) — Brent chose re-plan; landed and PM-verified
`pf-fix-7d32182`@**c496490** (one commit on 0066c0f; 2 files: handler +27/−7, tests +122).
Sites fixed: `sceneReferenceMode` → `safeMode()` classifier (domain `'style'|'pov'`, else
`'desconocido'`; tolerance/semantics unchanged) at :821/:934/:1010; `scene.landmarkVisible` →
`Boolean()` at :844; `count` → `Number()` at :815/:1353 **and :1328** (`effectiveCount` — an
8th site the PM sweep missed, same raw `count` outside refine; executor caught it, base-red
proved it, correctly folded as the same closed scalar). `modelTier`: **no change needed** — the
logged local was already narrowed at :752 (PM sweep false positive); pinned by test + D7
mutation instead. Sweep correction owned: the true leak set was 7 sites with `:1328` in and
`modelTier:815` out.
**PM verification (all with own hands at c496490):** token plantings in all four scalars →
status 200, ZERO leaking lines, `mode=desconocido` classifier observed; full suite **163/0**;
base-red re-run at 0066c0f with c496490's test file → exactly 3 failed / 1 passed as reported;
own D7 mutation (`modelTier=${requestData.modelTier}`) → test red, reverted; `deno lint`
headline problems 95↔95 and canonical problem-instance multiset 95↔95, delta EMPTY (the PM's
historical rule+file projection was 84↔84, retained only as a record of that run); `deno check`
identities 46↔46, delta EMPTY; diff scope 2 files; protected refs pinned. Every executor claim
reproduced.

## Phase PC — research model + API-observable degradation — CLOSED
**DONE 2026-07-29 at `phase/pc-research`@96cb2cc.** Review chain: r1 FAIL ([B1] enum-shaped
finishReason leak, PM-reproduced) → consolidated remediation @04dd3d0 → r2/2 PASS, zero
findings → [PC7] canary (Brent): F1 clean (`'LOW'` accepted live), F3 bit (thoughts 768/1024
⇒ MAX_TOKENS) → canary-mandated cap micro-round @96cb2cc → Codex single-item CONFIRMED.
Merge deferred to PREL (D9).
**WHAT WAS BUILT:** env-injected research model (`GEMINI_RESEARCH_MODEL ?? 'gemini-3.5-flash'`
through `index.ts` → `HandlerDeps`, D2-clean); `thinkingLevel:'LOW'` + `maxOutputTokens:2048`
(canary-calibrated); discriminated research results with the frozen 7-code taxonomy; additive
Spanish `warnings` on preview/success/error envelopes (PF's `skippedImages` preserved);
provider-domain finishReason allowlist (21 values, discovery-doc rev 20260728, unknown →
`DESCONOCIDO` in log AND response); hygiene extended with the both-shapes rule; +32 tests
(163→195); corpus-runner fidelity fix (story cases now exercise the successful research path).
**WHAT CHANGED VS THE FROZEN SPEC, all by its own mechanisms:** PROVIDER_UNAVAILABLE
transport-only gloss (r1 NOTES); the D7 both-shapes hygiene rule (r1 [B1]'s lesson); cap
1024→2048 (the spec's canary clause, measured evidence). `PC-UI` stands as the named release
prerequisite for user-visible warnings.

### (spec as executed — historical)
**Base/branch:** create `phase/pc-research` from `pf-fix-7d32182`@`c496490`.
**Scope:** `supabase/functions/generate-story/handler.ts` (`GEMINI_MODEL` at `:59`),
`supabase/functions/generate-story/index.ts`, focused production-handler/config tests, and only
the corpus expectation changes required by the explicitly additive warning contract. `src/**`,
story validation (PD), and storage (PB) remain out of scope.
**Configuration contract:** `index.ts` reads `GEMINI_RESEARCH_MODEL ?? 'gemini-3.5-flash'` and
injects the resulting `researchModel` through `HandlerDeps`/`ProviderConfig`; `handler.ts` does
not read `Deno.env` (D2). Both `researchLocation` and `analyzeImagesForVisualDescription` use
that injected model. Both send `generationConfig.thinkingConfig.thinkingLevel: 'LOW'` and
`maxOutputTokens: 2048` (**amended from 1024 on 2026-07-29 via this spec's own canary
mechanism**: [PC7] canary measured `thoughtsTokenCount: 768` + truncation at 1024 on a
production-shaped ask — thinking shares the output cap). A different model, thinking level, or
cap requires a PLAN decision backed by a recorded provider-doc/canary finding; the executor
does not choose one silently.
**Result contract:** research helpers return a discriminated result: `{status:'ok', text,
finishReason:'STOP'}` only for trimmed non-empty text; `{status:'skipped', code:'NO_IMAGES'}`
only when an image-analysis item has no photos; otherwise `{status:'failed', code, httpStatus?,
finishReason?}`. Required failure codes: `NO_API_KEY`, `MODEL_NOT_FOUND` (HTTP 404),
`PROVIDER_HTTP_ERROR`, `PROVIDER_UNAVAILABLE` (TRANSPORT retry exhaustion/timeout — a terminal
HTTP response, even a retried 5xx, remains `PROVIDER_HTTP_ERROR`; clarified per PC r1 NOTES),
`EMPTY_RESPONSE`, `OUTPUT_TRUNCATED` (`MAX_TOKENS`), `OUTPUT_BLOCKED` (other non-`STOP` finish
reasons).
Failed/skipped research contributes empty text to the Claude prompt so story generation can
continue. Only `failed` results produce Spanish response warnings.
**Response contract:** aggregate non-empty `warnings:[{source:'location'|'landmark'|'prop',
code, message, httpStatus?, finishReason?}]` additively on every envelope written after research
(prompt preview, success, and downstream error); omit the key when empty. Preserve PF's
`skippedImages` behavior on every envelope. Logs remain shape/count-only and never quote
provider bodies, warning messages derived from provider text, URLs, names, or request prose.
**Acceptance criteria/tests:**
- [PC1] Default and override model wiring reach both Gemini URLs. A D7 mutation that ignores the
  injected override or severs `index.ts`→handler configuration must fail.
- [PC2] Request bodies for both research calls pin `thinkingLevel:'LOW'` and
  `maxOutputTokens:2048` (amended 2026-07-29, canary-backed).
- [PC3] Non-empty text + `finishReason:'STOP'` is `ok`; empty text, `MAX_TOKENS`, and another
  non-STOP reason produce the exact failed codes above and no partial analysis text.
- [PC4] HTTP 404, other HTTP error, timeout/retry exhaustion, no API key, and no-images paths
  produce the exact status/code/warning behavior above; no-images is the only `skipped` case.
- [PC5] A mix of successful and failed research still calls Anthropic and returns the story plus
  warnings; all-research-failed does the same. Preview and post-research error envelopes retain
  warnings.
- [PC6] Existing PF log-hygiene tests stay green; new warning/error logs receive planted-token
  tests. Corpus changes identify the additive warning field as the intended divergence and do
  not re-capture unrelated behavior to green a failure.
- [PC7] D6 gates and D7 base-red/mutation evidence are recorded. Before phase close, re-check
  the model ID and raw REST knob spelling against official docs and run the separately
  authorized authenticated minimal canary from the prior plan; drift is a FINDING, not an
  unreviewed substitution.
**Frontend follow-up (`PC-UI`):** this phase makes degradation API-observable only. `PC-UI` is a
named release prerequisite (PFE lineage) rendering the warnings as the prior plan specified
(non-blocking Spanish notice; all-failed banner). PREL cannot declare the "observable
degradation" product goal complete until `PC-UI` is closed or Brent explicitly accepts API-only
observability.
**Rollback:** revert the phase branch; no deploy in phase (D9).

### PC review round 1 (2026-07-29) — FAIL — consolidated remediation open
Codex r1: **FAIL, [B1] BLOCKING / [S1] / [N1]** (`reviews/PC-review-1.md`). PM reproduced [B1]
before triage: an enum-SHAPED token (`/^[A-Z_]{1,40}$/`-passing, semantically unknown) planted
as the provider's `finishReason` reaches the log line AND `warnings[].finishReason` verbatim on
a 200 — `safeFinishReason()`'s domain is lexical, not semantic. (PM sweep had passed the
channel by trusting the classifier — the classifier was the hole; the D7 both-shapes rule now
exists so this class is named.) Remediation scope, consolidated: [B1] explicit provider-domain
allowlist (unknown → `DESCONOCIDO` in log and response) + accepted-shape planted test; Q4's
sanctioned one-liner (corpusRunner stub gains `finishReason:'STOP'`, NO re-capture); [S1]
folded (envelope-neutral copy `No se pudo incorporar esa información.`); [N1] folded (focused
`extractResearchText` thought-exclusion test). **Binding and closed — not to be relitigated in
round 2:** Sol's ACCEPT on all seven interpretations (a)–(g) and deviations D-1..D-5. Her
re-review is round 2/2, FINAL; a second FAIL goes to Brent per §1.5.
**Out of scope:** story validation (PD), storage (PB), `src/**` warning UI (follow-up item).
**Risks:** provider model names/knobs drift — executor verifies against current provider docs, does
not trust the plan's constants.
**Rollback:** branch revert; no deploy in-phase (D9).

## Phase PD — strict output contract — CLOSED
**DONE 2026-07-30 at `phase/pd-contract`@db42745.** Chain: Codex spec review (EXECUTABLE; two
PM-draft premises struck) → executor @f3d25fc (+2544/−102; seven honest FINDINGS, R1–R7 all
ratified) → r1 FAIL ([B1] parse-seam leak, PM-reproduced: V8's SyntaxError echoing provider
bytes; null TypeError) → remediation @2bdec82 (unbound-catch guard + non-object guard) →
r2 FAIL (completeness: the round-1 FILE's third required assertion never entered the PM's
chat-scoped fix-list — operating gate 7 born) → Brent re-plan → test-only @db42745 → Codex
CONFIRMED. Merge deferred to PREL (D9).
**WHAT WAS BUILT:** strict `emit_story` tool (`strict:true`, `additionalProperties:false`
throughout, `props` required, integer schemas); stop_reason protocol as the ONLY success path
(text/JSON.parse fallback deleted); typed boundary — `ProviderOutputError` → 502
`PROVIDER_OUTPUT_INVALID` with three fixed Spanish messages, `ClientInputError` → 400/422
`CLIENT_INPUT_INVALID`, parse-seam guarded (malformed/null provider bodies can no longer reach
the generic 500 or echo provider bytes); `validateAndNormalizeStory` (12–16 window, set-exact
`1..N`, NFKC-unique names, exactly one protagonist, reference integrity, the one lossy prop
rule + `story:PROP_NOT_RECURRING`); corpus stub fidelity (valid 15-scene `tool_use`) with the
FASE F baseline byte-untouched plus a PD-base parity snapshot; +102 tests (195→297).
**WHAT CHANGED VS THE FROZEN SPEC, by its own mechanisms:** the five ratified execution
amendments (PD8 parity substitute — strictly stronger; G4 count corrections; the F3 400-remap
with its PFE follow-up; the measured fmt substitute; M16's documented redundancy) and gate 7.

### (spec as frozen — historical)
**The authoritative spec is this section PLUS the G1–G6 PASTE-READY texts and [PD1]–[PD10]
acceptance criteria in `docs/plan/reviews/PD-spec-review.md`, incorporated by reference.**
Two draft premises were struck by the review, both PM-verified false against the code: there
is NO caller scene-count (the handler's own prompt owns "EXACTAMENTE 15 escenas (mínimo 12,
máximo 16)" at `handler.ts:560`), and the corpus story stub is NOT valid (one scene, no role,
text-fallback shape — `corpusRunner.ts:60-71`).
**Essentials (details in the review file):**
- Branch `phase/pd-contract` off `phase/pc-research`@96cb2cc. Edge-only; in-scope files:
  `generate-story/handler.ts`, its contract tests, the fidelity-only Anthropic stub in
  `_shared/corpusRunner.ts` (+ the stale cap comment at `handler.ts:70-72` rides along).
  `corpus_baseline.json` READ-ONLY (blob `91ec703…`).
- `strict:true` top-level on `emit_story` + `additionalProperties:false` everywhere + `props`
  required + integer schemas; forced tool_choice; stop_reason protocol (`tool_use` + exactly
  one matching block = the ONLY success path; refusal / max_tokens / anything else → typed 502);
  the production text/JSON.parse fallback is REMOVED.
- `ProviderOutputError` (internal reasons REFUSAL | MAX_TOKENS | INVALID_STORY) → 502
  `PROVIDER_OUTPUT_INVALID` with three fixed Spanish messages, MAPPED inside the handler
  (never rethrown into the generic 500). `ClientInputError` → 400/422
  `CLIENT_INPUT_INVALID`. Envelope preserves non-empty `skippedImages` + pre-validation
  `warnings` (CONTRACT-COUPLED: PFE + PC-UI).
- `validateAndNormalizeStory` returns the discriminated result (G5 shape); scene window 12–16
  with set-exact `1..N` numbering; normalized-unique names (`NFKC → trim → collapse →
  toLocaleLowerCase("es-CL")`); exactly one protagonist; case-insensitive enum canonicalization;
  reference-array integrity (fatal corruption vs the ONE lossy rule: duplicate/out-of-range
  prop `sceneNumbers` dropped; <2 remaining ⇒ prop dropped + `story:PROP_NOT_RECURRING`
  warning, fixed Spanish copy, never the provider's prop name).
- Corpus rule: stub upgraded to a valid 15-scene `tool_use` response; every captured outcome
  unchanged; NO re-capture (a change ⇒ STOP + FINDING). [PD8] mutation proofs.
- Gates baselines at 96cb2cc: test 195/0, lint 95, check 46; deno 2.7.11; touched files pass
  `deno fmt --check`. No live provider calls.
- Named follow-ups: **`PC-UI` extended** (story warnings + `FunctionsHttpError.context`
  parsing + T-D.13 landmarkVisible end-to-end); **`PD-REFINE`** release prerequisite
  (refine-story validation deferred with its own D5/D7 pass).
**Handler-prompt coherence note (review NOTES):** the prompt's "exact structure" example omits
`props` while the prose describes them — PD makes them agree.

### (superseded draft — historical)
**Base/branch:** `phase/pd-contract` off `phase/pc-research`@96cb2cc (continues the hot
lineage; PH depends on PD).
**Intent (prior plan §3 FASE D, invariante 12, rebased):** the story the provider returns is
either valid or the client learns exactly why — never a silent 500, never a mangled story.
- `strict:true` on the Anthropic story tool + `additionalProperties:false` per object; `props`
  required (`[]` valid).
- Typed error classes: `ProviderOutputError` ⇒ **502 `PROVIDER_OUTPUT_INVALID`** (provider
  produced garbage — not the client's fault); `ClientInputError` ⇒ 400/422 (client input only).
  The outer catch re-throws typed instead of collapsing to 500. `stop_reason:'refusal'` and
  `max_tokens` get distinct Spanish messages.
- `validateAndNormalizeStory(data): {story, warnings[], errors[]}` — nested validation:
  non-empty `title/summary/spiritualConnection` and character fields; normalized-unique
  character names; integer, unique, in-range scene numbers (1..N sorted); exactly 1
  protagonist; `appearsInScenes`/reference arrays integers-unique-in-range; out-of-range
  `sceneNumbers` on props normalized/dropped with a warning.
- Current state at 96cb2cc: shallow structural type-check (`handler.ts:812-823`) +
  `JSON.parse(...) as StoryOutput` (`:1196`) — no strict tool, no typed 502, no normalizer.
- Seed tests: prior plan T-D.1–T-D.14, with its own two corrections (T-D.1 expects **502**,
  not 422 — omitted `props` is provider output, not client input; T-D.14 covers the
  reference-array validation).
**SPEC-PASS GAPS the Codex review must settle (named per [P5], not invented away):**
1. **The `scenes.length ∈ [12,16]` rule vs product reality.** The editor carries a scene-count
  config. A hard 12–16 gate is the exact "rejects too much" class that burned PF twice —
  the true rule must be derived from live call sites per D5 (likely "matches the requested
  count", not a constant range).
2. **The src/** split.** The prior plan's FASE D touched `src/types/shared/story.ts` and the
  editor (warnings display, `landmarkVisible` end-to-end, T-D.13). This lineage is
  edge-only; decide: PD-edge now + fold the UI half into `PC-UI` (which already owns
  warnings rendering), or a separate `PD-UI` prerequisite. T-D.13's end-to-end claim cannot
  be honestly asserted from the edge alone.
3. **Envelope interaction.** The new 502 must carry PC's `warnings` and PF's `skippedImages`
  (drops/degradation that happened before the provider failed are still true). Additive
  rules and PFE/PC-UI coupling to be stated explicitly.
4. **Corpus impact.** The corpus stub returns a valid story, so parity should hold — but the
  spec pass must verify no corpus case exercises a path whose status the 502 remap changes,
  and state the divergence-documentation plan if one does.
5. **`strict:true` reality check.** Verify against current Anthropic docs that the tool-use
  strict mode + `additionalProperties:false` behave as the prior plan assumed (it predates
  PC's model bumps); drift is a finding, not a silent substitution (PC7 pattern).
6. **Refine-story parity.** `refine-story` consumes the same story shape; decide whether PD
  validates it too or explicitly defers (scope statement either way).

## Phase PB — immutable storage — CLOSED
**DONE 2026-07-31 at `phase/pb-storage-fe`@5f7b6bd + `phase/pb-storage-edge`@10d1190.**
Chain: spec draft (4 premises struck by Codex spec review, all PM-verified true) → FE r1
honest-partial @9beccdb → FE continuation @c79ea87 → EDGE @10d1190 → Sol phase review r1
FAIL (5 BLOCKING, all FE; PB-F7 backlog call overturned) → consolidated remediation
@5f7b6bd → r2/2 **PASS/CONFIRMED** (`reviews/PB-review-2.md`; her own adversarial B1
probes; F3 ruled acceptable residue). Merge deferred to PREL (D9).
**WHAT WAS BUILT:** one shared content-addressed immutable-upload primitive
(`immutableImageUpload.ts`: magic-byte PNG/JPEG/WebP truth, SHA-256-of-decoded-bytes
32-hex names, `upsert:false` with the CAPTURED structural `statusCode:'409'` as
idempotent success) behind all six cuentacuentos upload entry points (hook + 4 editor
saves + finalization); fail-closed logical writes replacing the silent
filter-and-compact partial failures (G4; base could report success while persisting
base64 or shortened groups); finalized `liturgia_elementos` payloads carry ZERO inline
bytes with the selected reference upgraded in place (B1); B1 compare-and-delete witness
preserved (`story.id`+`updated_at` — content hashes never became finalization tokens,
G5 five-step proof); no-delete boundary re-proven by EXECUTION with planted-removal
mutations (A4); a 74-case captured base-behavior fixture (blob 70204600…) + 204
case-local declared divergences; the G7 five-path production wiring suite (per-site
reversion mutations); legacy positional paths reload without migration; and the D3
contract change on the edge — exactly the public `liturgia-images` prefix, both-handler
provider-byte consumer tests, sign form still forbidden, D4 classification unchanged.
FE 656→760 tests (+104), EDGE 297→325 (+28); gates delta-clean per D6 at both tips.
**WHAT CHANGED VS THE FROZEN SPEC, by its own mechanisms:** four spec-draft premises
struck at spec review (B5 lives in the combined `editorStateV1`+`image_paths` contract;
the liturgia-images rewrite happens in `saveLiturgy`; signed form evidence-rejected;
the partial-failure premise was false); D6 gained the FE serial-Vitest pin (r1 F1 —
serial reduces but does not eliminate contention flakes at load ≳40: 3-of-4 clean runs,
re-run before treating a flake as regression) and the fmt measured-substitute was
reapplied per the PD-F4 precedent; the r1 FAIL overturned the PM's PB-F7 backlog call
(leak fixed in-phase; surface wider than the review's own hint — character/scene option
arrays too); G7's boundary-list literalism enforced (internal `use-toast` is not a
boundary; residue in non-wiring suites ruled acceptable, with the G5 header's
"only external boundaries" phrase noted as inaccurate documentation, non-blocking).

### (spec as frozen — historical)
**The authoritative spec is this section PLUS the G1–G7 binding texts and the
T-B.1–T-B.14 acceptance criteria in `docs/plan/reviews/PB-spec-review.md`, incorporated by
reference (PD precedent). Codex verdict 2026-07-30: EXECUTABLE WITH THE TEXT BELOW.**
Four PM-draft premises were struck by the review, all four PM-verified true against
185c370 before applying: (1) **B5 location** — `editorStateV1` carries selections/buffers
only; image and reference paths live in `image_paths`; the preserved contract is the
COMBINED round trip. (2) **Finalization timing** — the `liturgia-images` rewrite happens
inside `saveLiturgy` (`uploadCuentacuentosImages` → `updateStoryWithImageUrls`), not at
the editor's finalization commit; the reopen/refine regression stands. (3) **Signed
`liturgia-images` struck** — no producer in either base, zero live rows (Sol's read-only
count: 29 elements, 23 drafts-URL, 5 public-liturgia, 0 signed); ONLY the exact public
prefix is added and `sign/liturgia-images` must stay FORBIDDEN_BUCKET. (4) **The
partial-failure premise was false** — array groups filter-and-compact nulls and replace
the touched category while the write resolves (A2 never fires; finalization can persist
base64 fallback); G4 captures the base behavior, then mandates fail-closed logical
writes as an intentional divergence.
**Review plan (recorded):** FE executor → PM verify → EDGE executor → PM verify → Sol
reviews the PHASE (both branches together) as round 1/2 of the §1.5 cap.

**Intent (prior plan §3 FASE B + A7a/B5, rebased):** stop losing photos to positional
`upsert:true` overwrites. Every cuentacuentos upload becomes content-addressed
(`…/${key}_${hash32}.${ext}`, `hash32` = 32 hex of SHA-256 over DECODED bytes) and
immutable (`upsert:false`, 409/already-exists ⇒ success); nothing deletes storage objects;
reload keeps working for legacy positional paths without migration.

**Verified current state (all per D5 — `git show` at 185c370 / db42745, live infra read
2026-07-30; the seed's line numbers were stale and are rebased here):**
- `useCuentacuentosDraft.ts` @185c370: `BUCKET_NAME='cuentacuentos-drafts'` (:103);
  `uploadImage()` (:495) writes `${userId}/${liturgyId}/${category}/${key}_${index}.${ext}`
  with `upsert:true` (:575-577) and a prefix-ternary MIME sniff (`/9j/`⇒jpeg else png,
  :556); per-category orchestration :694-790 (characters/scenes/cover/end/props/sceneRefs/
  coverRef/endRef); failed upload ⇒ `null` ⇒ previous value preserved in the merge
  (:439-440); `image_paths` JSONB keys enumerated at :982-999. ~~The seed's
  `saveImagesToStorage`/`queueGroup` names no longer exist (FASE A rewrite).~~
  **[CORRECTED 2026-07-30, PB-FE executor F2 — PM error owned:** both exist at 185c370
  (`saveImagesToStorage` :647, `queueGroup` :676); the original claim came from a
  truncated grep window. Non-load-bearing: the orchestration is where the spec locates
  it.]
- `CuentacuentoEditor.tsx` @185c370: FOUR inline save sites, all
  `.from('cuentacuentos-drafts').upload(…, {upsert:true})` with positional names —
  `handleSaveCharacterImage` :3086 (upload :3131, `…/characters/${characterId}_selected`),
  `handleSaveSceneImage` :3164 (:3226), cover :3336, end :3401. (Seed's
  :2736/:2814/:2948/:3011 are stale.)
- `liturgyService.ts` @185c370: `uploadSingleImage` (:154) uploads finalized images to
  `liturgia-images` with `upsert:true` (:174-176), path
  `liturgias/${liturgyId}/cuentacuentos/${category}/${filename}.${ext}`; finalization
  calls it for characters/scenes/cover/end (:215-244). Two further `upsert:true` sites
  (:34 generic liturgy image, :69 PDF) are NOT cuentacuentos finalization.
- **The combined B5 recovery contract is already built and PB preserves it** (review
  Strike 1 wording): `story.editorStateV1` v1 carries selections and editor
  buffers/mirrors (`recoverySnapshot.ts:40-75`); manual/generated image option paths and
  scene/cover/end/prop reference paths live separately in `image_paths`. `stripImageRef`
  + `scrubImageRefsDeep` keep base64/data URLs out of persisted story/editor JSON, and
  reload joins `editorStateV1` with `image_paths`, with safe defaults for legacy rows.
  PB changes only the write-time filename/upload semantics and re-proves this combined
  round trip; it does not redesign B5. A4 is live: DB-only draft delete (:1869);
  orphan-prop purge drops paths, preserves bytes (:1089).
- **Edge allowlist** @db42745 (`_shared/imageFetch.ts`): `ACCEPTED_BUCKET_PATHS` =
  public+sign prefixes of `cuentacuentos-drafts` only (:125, :137-139);
  FORBIDDEN_BUCKET⇒422 (:174); traversal-hardened (:546-555); origin pinned to
  `SUPABASE_URL` (:540); shared by both paid functions.
- **The D3/A7a flow is real, verified link by link (timing corrected per review Strike
  2):** editor finalization hands the selected story to the parent; on the later
  successful parent liturgy save, any selected fields still encoded inline are uploaded
  by `uploadCuentacuentosImages` and rewritten by `updateStoryWithImageUrls` to public
  `liturgia-images` URLs before the element config is persisted (`liturgyService`
  :201/:257 inside `saveLiturgy` :333) → reopening passes that config as `initialStory`
  → editor seeds its image-option states from it (editor :1011-1057) → refine tasks send
  `refine:{sourceImage}` verbatim (`taskFactories.ts` :552-865) → `generate-scene-images`.
  Live main fetches ANY url (no allowlist), so this flow works in production today; under
  PF's drafts-only pin it fails closed (FORBIDDEN_BUCKET, refine override per D4) — i.e.
  shipping drafts-only is a user-visible refine regression on re-opened finalized
  cuentos. Sol's live count (5 elements with public liturgia-images URLs) confirms the
  producer is not hypothetical.
- **Live infra (read-only SQL 2026-07-30):** both buckets public. `cuentacuentos-drafts`:
  50 MB limit, bucket MIME allowlist `[png,jpeg,webp]` (WebP already admitted).
  `liturgia-images`: no limits. RLS on `storage.objects`: drafts INSERT/UPDATE/DELETE
  own-folder (first path segment = `auth.uid()`) + public SELECT; liturgia-images
  INSERT/UPDATE `is_liturgia_admin(auth.uid())` only + public SELECT. Consequences, both
  verified: the hash path keeps segment 1 = `userId` ⇒ RLS-compatible with NO DDL/config
  prerequisite (A7a's warning against a bare `${category}/…` path confirmed against the
  live policy); immutability is APP-LEVEL only — the own-folder UPDATE policy still
  permits overwrite, and dropping it would break live main, which still uploads
  `upsert:true` at 5 sites (hook ×1, editor ×4).

**Draft decisions (PM positions for the review to confirm or strike):**
1. **Cross-lineage base = two coordinated branches; no pre-PREL cross-merge.**
   `phase/pb-storage-fe` off `cc-downscale-a`@185c370 (hook uploader, 4 editor sites,
   `uploadSingleImage`, tests) and `phase/pb-storage-edge` off `phase/pd-contract`@db42745
   (allowlist contract change + provenance/cross-bucket/consumer tests). Rationale: the
   halves touch disjoint paths (frozen PREL ancestry fact), each lands on its lineage's
   final tip, and a PB-private integration branch would pre-empt PREL's authority (D9).
   PREL then integrates the two new tips.
2. **D3/A7a reconciliation — CONFIRMED by the review, narrowed to public-only (Strike
   3):** add ONLY the exact prefix `/storage/v1/object/public/liturgia-images/` to the
   pinned-origin `ACCEPTED_BUCKET_PATHS`; retain both drafts prefixes; explicitly test
   that `sign/liturgia-images` remains FORBIDDEN_BUCKET (no producer, zero live rows —
   a future signed producer requires its own D3 contract change). Provenance,
   prefix-collision (`liturgia-images-evil`), third-bucket, and encoded-traversal
   rejections plus BOTH-handler production-consumer tests exactly per G1 (provider-byte
   assertions, not status-only; D4 404/refine classification unchanged). NOT widened:
   origin stays pinned, paths stay exact, no user-supplied buckets. **Product veto is
   Brent's:** the alternative (keep drafts-only) accepts the named refine regression and
   must be recorded as a product decision.
3. **`uploadSingleImage` IN scope** (A7a's default): hash names + `upsert:false` +
   409⇒success within `liturgias/${liturgyId}/cuentacuentos/…`; admin-only INSERT RLS
   verified compatible (finalization runs as the builder admin). The OTHER two
   `liturgyService` upsert sites (:34, :69) are explicitly OUT — named residual risk per
   A7a's own narrowing clause.
4. **Idempotency contract (G3, Strike 5 applied):** upload-first — always attempt
   `upsert:false`; treat ONLY the captured structural duplicate conflict as idempotent
   success (expected shape `StorageApiError.statusCode === "409"` on the pinned
   `@supabase/storage-js` 2.90.1); never match English message text; never pre-check
   existence (check/write race, extra network op, and it still can't make `upsert:true`
   safe). The duplicate error object is captured from an approved NON-PRODUCTION Storage
   runtime; if none can be exercised, the executor reports FINDINGS rather than inventing
   the shape (D7). Sound ONLY because names are content-addressed (same path ⇒ same
   bytes); a 409 is idempotent success, not proof this attempt created the object.
5. **MIME truth:** magic-byte sniff PNG/JPEG/WebP (bucket MIME allowlist already admits
   all three); data-URL prefixes stripped before decode; hash computed over DECODED bytes
   (same bytes under different data-URL prefixes ⇒ same hash); unsupported bytes ⇒ that
   image rejected, previous value preserved (A2 semantics).
6. **Partial failure (Strike 4 — the draft's premise was FALSE; G4 governs):** at
   185c370, groups filter-and-compact failed entries and REPLACE the touched category
   while the write resolves (A2 never fires); finalization can persist a base64 fallback
   and still report success. G4's base-behavior matrix is captured FIRST (G6 harness,
   production files byte-identical to 185c370), then intentionally replaced by
   fail-closed logical writes: any non-409 failure in a touched category aborts before
   the draft/element upsert — no React swap, no success callback, no silent
   shorten/clear; explicit `[]` stays a successful clear; sibling-created objects remain
   as allowed orphans (never compensating deletes); manual editor saves keep their
   existing user-facing failure surface; existing HTTP(S) values pass through untouched.
   DraftPatch `[]`-vs-absent (A1) unchanged.
7. **Legacy paths:** no migration; positional objects stay readable; mixed
   positional+hash `image_paths` valid; new writes never target positional names; the
   declared loss (photos already overwritten by the live bug) stands.
8. **No-delete/GC boundary:** PB adds ZERO `storage.remove` calls; hash orphans
   accumulate by design; reference-aware GC is a separate backlog ticket. RLS hardening
   (dropping the drafts own-folder UPDATE policy once no deployed client uses
   `upsert:true`) is a separate POST-release infra option, PREL-sequenced, NOT PB.
9. **editorStateV1:** preserved, not rebuilt. Acceptance = path-only persistence and
   legacy restore still hold under hash names (paths are stored verbatim in
   `image_paths`/state and resolved via `getPublicUrl`, so the mapping is name-agnostic).

**Acceptance criteria: T-B.1–T-B.14 in `docs/plan/reviews/PB-spec-review.md`, incorporated
by reference (Strike 6 — the draft's T-B.1–T-B.10 are STRUCK: they lacked
unsupported-bytes/non-conflict failure coverage, the complete per-category failure matrix,
the honest combined-recovery contract, the finalization/B1 five-step ordering proof, and an
external-boundary component bar strong enough to prove production wiring).** Load-bearing
additions the executor must not miss: T-B.11 (unsupported bytes + every non-409 error ⇒
fail-closed logical write), T-B.12 (full category × failure-mode matrix, sibling objects
left alone), T-B.13 (legacy positional + hash + mixed reload; combined
`editorStateV1`+`image_paths` round trip; no base64 in persisted JSON), T-B.14
(six-entry-point `upsert:false` inventory; the two named non-cuentacuentos uploaders stay
untouched as out-of-scope residuals). G7 is the non-negotiable T-B.8 bar: production
editor + production hook + production helper, only external boundaries mocked, five real
component paths, five per-site wiring mutations with recorded failures.

**Gates:** FE branch — Node D6 at the 185c370 base (tsc identity vs the 1041-diagnostic
baseline, ESLint 159, Vitest = the 6 pre-existing failures, node v22.22.0). EDGE branch —
Deno D6 at the db42745 baselines (test 297/0, lint 94, check 46, deno 2.7.11), canonical
commands. Playwright not expected (no raster/canvas surface in PB; hashing uses WebCrypto,
which the executor verifies in the vitest environment — else FINDINGS).

**All seven named spec-pass gaps are SETTLED by the review** (final answers Q1–Q7 in the
file): topology confirmed (edge stands alone at db42745; PREL owns integration and
sequences the edge deploy before the dependent frontend release); D3 change confirmed
public-only with the G1 test contract; editor unification via ONE new shared primitive
under `src/lib/cuentacuentos/` (G2 — the hook's private `uploadImage` is NOT the shared
dependency), G7 the integration bar; finalization/B1 resolved by G5 (content hashes never
become finalization tokens; witness stays `story.id`+`updated_at`; five-step proof);
409 choice resolved by G3 (upload-first, structural, captured); the current
abort/continue matrix recorded in G4 and captured via G6 before any rewrite.

### Review round 1 outcome (2026-07-30) — FAIL — consolidated remediation open
Sol's round 1/2 (`reviews/PB-review-1.md`): **FAIL — 5 BLOCKING, all FE-side**; the
implementation core (immutable uploads, fail-closed G4, B1 identity, public-only edge
widening) ruled substantively sound; EDGE branch clean (G1 MET; Q5: no contract coupling
tripped, D4 classification unchanged). PM reproduced [B1] (the G5 test positively pins
`['storyData.coverImageOptions[]']` as an accepted raw-base64 leak set in the persisted
element; editor copies live options verbatim at :3765), [B5] (`base64ToBlob` at
liturgyService:142, zero callers), [B3] (helper 409 cases are independent calls; the
criteria case is a one-entry write), and owns [B2] (the PM's own mock audit passed
`use-toast` as a boundary; G7's permitted list never included it). AGREED on all five.
- **[B1]** PB-F7's backlog disposition STRUCK: the leak contradicts frozen G5 step-4 /
  T-B.9 ("not base64"; "only the new public URL"). Fix in-phase: no inline bytes anywhere
  in persisted `storyData` (preserve HTTP(S) options + the selected H2 URL for reopen);
  G5 step-4 tightened to walk the COMPLETE payload; reopen assertion added.
- **[B2]** G7 missed by the internal `use-toast` mock — remove it, run the production
  hook, re-record the five surgical per-site mutations.
- **[B3]** T-B.2's two-entry created-plus-409 group proof absent — add through a
  production draft write, with the two named error mutations.
- **[B4]** T-B.9's captured-409-through-production-`saveLiturgy` proof absent — add,
  plus the same-message non-409 control.
- **[B5]** dead `base64ToBlob` = a second decode/MIME implementation vs G2 — remove,
  renew the unique-primitive inventory.
**BINDING (closed to relitigation in round 2):** ratifications of FE F3/F4/F5/F6,
PB-F8/PB-F9, EDGE F1 (fmt substitute — with her canonical 27-hunks-per-side count
superseding the executor's 46-hunk label), EDGE F2/F3, and the D6
`--no-file-parallelism` amendment. Comparator qualification recorded: the 204-entry
table + `assertNewValueInvariants` is an adequate G6 artifact, not a claim that
semantic rubber-stamping is impossible without review.
Remediation: ONE consolidated round, fresh executor, on `phase/pb-storage-fe` atop
c79ea87 (EDGE untouched). Then Sol round 2/2 — FINAL; a second FAIL goes to Brent
(gate 5).

### Remediation outcome (2026-07-30) — landed @5f7b6bd, PM-verified — Sol FINAL 2/2 open
Fresh executor delivered all five items in 5 commits (+546/−45; production =
`liturgyService.ts` only; EDGE + `supabase/**` untouched; fixture blob unchanged).
[B1] design: `rewriteFinalizedOptions` (order-preserving; HTTP(S) pass-through;
selected-inline upgraded to its uploaded URL so H2 survives in the array;
unselected-inline dropped) + `stripInlineImageRefs` (explicit typed field list, not a
heuristic sweep) applied in BOTH `saveLiturgy` cuentacuentos branches — the executor
found the leak surface wider than the review's hint (character/scene option arrays are
copied too, editor :520-544) and covered it; G5 step-4 now walks the COMPLETE persisted
`storyData`; new reopen case asserts no inline bytes at two depths. [B2] production
`use-toast` runs in the wiring suite; five per-site mutations re-recorded, each failing
its own case with the other four green. [B3] two-entry created-plus-409 group proof
through a production draft write with a REAL repeat-path conflict (not planted), plus
both named error mutations. [B4] captured-409 through production `saveLiturgy` →
success + deterministic URL + no inline fallback + zero removals; same-message non-409
control fails the save with no element upsert. [B5] `base64ToBlob` removed (historical
comment left in place); single-primitive inventory re-sworn; residual uploaders
byte-identical to 185c370. PM verified with own hands: [B1] base-red reproduced
verbatim; one 409-as-failure mutation felled exactly the three 409-success proofs;
gates tsc 1041↔1041 delta EMPTY both directions / eslint 159 / Vitest serial 760-6
(Mesa six; 3 clean runs, 1 known-class contention flake recorded honestly — machine
load ~40 during verification). Executor findings F1–F6 all accepted; **F3 goes to Sol
as a frozen question** (the `use-toast` mock persists in the G5/criteria suites — her
[B2] named only the wiring suite; the executor rightly followed the file per gate 7).

**Rollback:** revert the two phase branches; no deploy in-phase (D9); no infra change to
revert (verified none needed).

## Phase PG — consistent cancellation — CLOSED
**DONE 2026-07-31 at `pg-fix-d3fbd58`@1b0cfed** (one fast-forward commit containing the
r1-reviewed `phase/pg-cancellation`@d3fbd58, which is preserved; branch-name deviation
Codex-RATIFIED, pf-fix precedent). Chain: spec draft (five review strikes, three owned PM
errors) → Codex EXECUTABLE → executor @d3fbd58 (nine honest findings incl. one
self-caught vacuous test) → review r1 FAIL ([B1], evidentiary only — the T-G.11
real-editor persisting-sibling proof, PM-reproduced both halves) → one-commit TEST-ONLY
remediation @1b0cfed → r2/2 **PASS/CONFIRMED** (`reviews/PG-review-2.md`: her own
M-SOL-2 re-run and her own gate-neuter probe; G1–G8 + T-G.1–T-G.13 MET IN FULL). Merge
deferred to PREL (D9).
**WHAT WAS BUILT:** a cancellable retry primitive (exported `RetryCancelledError`;
cancellation checked before attempt 0 and re-checked after every completed wait;
abort-aware backoff wait with timer/listener cleanup on every settle path;
omitted-signal callers byte-equivalent); invalidation-owned status normalization —
`cancel()` AND `reserveRun` displacement sweep `running → pending` with error cleared,
`persisting`/`done`/`error`/`save-failed` untouched, and EVERY stale provider
catch/continuation token-owned and status-silent (closing a pre-existing same-id stomp
hazard: the base catch wrote `error` with no token check); the AbortSignal threaded
end-to-end (runner → all 9 factories → feedback wrapper →
`supabase.functions.invoke({body, signal})`; functions-js 2.90.1, zero dependency
change); abort-aware runner stagger (run settles without waiting residual staggers);
the cover/end step's missing `Cancelar` (run-keyed, Spanish, never cancels
persistence); the user-cancel vs destructive-lifecycle distinction pinned (no epoch
bump, no registry invalidation on user cancel; save-failed entries + scoped count +
approval gate survive); accepted-and-pinned notice residue (a late real
`skippedImages` report still accumulates+dedups while its image result is discarded).
Honesty rule throughout: a client abort settles the client and prevents future
dispatches; it cannot recall dispatched server-side spend. FE tests 760 → 824 (+64).
**WHAT CHANGED VS THE FROZEN SPEC, by its own mechanisms:** the ratified branch-name
deviation; F2's ratified reading of T-G.10 (the faltantes COUNT is base-green because
collectors are state-derived — the base-red half is card status); T-G.11's
persisting-sibling proof initially substituted at runner level — struck by r1 as [B1]
and remediated with a parked-persistence real-editor case over an additive
`ctl.upsertGate` boundary control (F7 model); the defensive owned-abort classifier
branch recorded (production cancel paths invalidate the token before aborting, so the
branch is pinned via provider-thrown `RetryCancelledError`).

### (spec as frozen — historical)
**The authoritative spec is this section PLUS the G1–G8 binding texts and the
T-G.1–T-G.13 acceptance criteria in `docs/plan/reviews/PG-spec-review.md`, incorporated by
reference (PD/PB precedent). Codex verdict 2026-07-31: EXECUTABLE WITH THE TEXT BELOW.**
Five review strikes, ALL FIVE PM-verified against the code before applying — two are owned
PM errors: (1) registry survival across `cancel()` and a post-cancel status assertion ARE
already pinned indirectly (`pipelineRunnerA2.outcomes.test.ts:474-512`: save-failed →
cancel → save-only retry → `done`, zero new provider calls) — the true gap is narrower:
synchronous/final `running → pending` normalization with error clear; (2) unmount (:982)
calls ONLY `cancelPipeline()` — the four-step sequence belongs to delete/regenerate alone,
and recovery accept/decline/repair invalidate the registry at :1425/:1477/:1489 without it;
(3) the draft's decision 4 was UNSAFE as written — an unconditional abort-catch `pending`
write could stomp a re-enqueued same-id item under a newer run; replaced by the review's G3
ownership rule (every catch/continuation is token-owned and status-silent after losing the
run token — and the PM verified the hazard is real TODAY: the provider catch :473-480
writes `error` with no token check). Review plan (recorded): ONE executor round on
`phase/pg-cancellation` → PM verify → Sol reviews the phase as round 1/2 of the §1.5 cap.
(This section supersedes the PG bullet in the outline block below. Every file:line cite is
D5-verified via `git show` at `phase/pb-storage-fe`@5f7b6bd (FE) or
`phase/pb-storage-edge`@10d1190 (EDGE); the seed's targets were stale and are rebased
here.)

**Intent (prior plan §3 FASE G, rebased):** one cancellation story for the image pipeline.
"Cancelar" stops spend and waiting as early as each boundary allows; cancelled and
never-started work returns to `pending` (no phantom `error`, no stuck spinner); resume is
the existing state-derived "Generar faltantes (N)" path; applied work still persists (A2's
frozen contract). No `cancelled` status is added to the item model or the UI.

**Base/branch decision (outline mandate, recorded):** create `phase/pg-cancellation` from
`phase/pb-storage-fe`@**5f7b6bd** — the outline's "latest reviewed descendant" of
`cc-downscale-a`@185c370. Rationale: it is the reviewed FE tip (PB r2/2 PASS); PG must edit
`CuentacuentoEditor.tsx`, which PB also edited — branching from 185c370 would fork the
editor into two divergent lineages and hand PREL an artificial conflict; gates at 5f7b6bd
re-verified by this PM 2026-07-31 with own hands (Vitest serial 760/6 = the Mesa six, at
machine load ~1.3; tsc 1041; eslint 159; node v22.22.0). **No EDGE branch** — PG is
frontend-only; `supabase/functions/**` untouched.

**Verified current state (all per D5 at 5f7b6bd unless noted):**
- `concurrency.ts` (:16-33): `retryWithBackoff` consults `shouldRetry` only at catch time
  (:27), BEFORE the backoff sleep (:29 — plain `setTimeout`, base 2000ms ×4^attempt +
  jitter ≤1s, default attempts 2); nothing re-checks after the sleep, so attempt N+1
  dispatches unconditionally. Seed premise CONFIRMED: no `cancellableSleep` /
  `isCancelled` / `RetryCancelledError` anywhere. `runWithConcurrency` (:40-65) is NOT the
  pipeline's pool — its only production caller is PB's upload orchestrator
  (`useCuentacuentosDraft.ts:802`, limit 6, stagger 0); the live pipeline stagger is
  runner-internal.
- `storyImagePipelineRunner.ts`: `cancel()` (:921-928) = token-null → `running=false` →
  `abort()` → notify; it touches NEITHER item statuses NOR the save-retry registry. Worker
  loop (:744-751): stagger `await sleep(workerIndex*staggerMs)` (:744, plain setTimeout
  :310, default 400ms) then `while (!signal.aborted && currentRunToken === runToken)`
  (:746) — cancel during stagger already yields 0 dispatches from that worker, but the
  sleep itself is un-interruptible. Provider phase (:460-471) runs under `retryWithBackoff`
  with `shouldRetry: () => !signal.aborted` (:468-470) — no retry decision AFTER abort,
  but the backoff-sleep gap above still fires the queued attempt. A provider rejection
  lands `setStatus(id,'error',…)` (:473-479) — an abort-caused rejection becomes a phantom
  `error`. The post-generate token guard (:486) returns WITHOUT a status write — a late
  resolution after cancel leaves the item stuck `running` forever; the same happens to
  prior-run items not re-enqueued when a new `runItems` displaces a run (reserveRun
  :765-800). Persist never inspects the live token once applied (frozen A2;
  `pipelineRunnerA2.outcomes.test.ts:428` pins the token-flip variant). `PERSIST_STALE` ⇒
  `pending`. ~~Registry survival across `cancel()` specifically is UNPINNED~~ **[struck at
  spec review (Strike 1): pinned indirectly at outcomes :474-512 — see the corrected
  existing-pins bullet below; PG adds the exact-entry/scoped-count/approval-gate proof.]**
- **The AbortSignal chain is severed at two links:** all 9 factory providers are zero-arg
  closures ignoring `ProviderContext.signal` (`taskFactories.ts`
  :215/:291/:378/:461/:517/:579/:680/:775/:847 — sheet/prop/scene/cover/end + 4 refines),
  and the editor wrapper `invokeGenerateSceneImagesRequest` (editor :493-508) passes no
  signal to `supabase.functions.invoke` (:497-500). The runner aborts a controller nobody
  downstream observes. `@supabase/functions-js` is lockfile-pinned at **2.90.1** and its
  `FunctionInvokeOptions` accepts `signal?: AbortSignal` (installed types.d.ts:110) — the
  wire-through needs no dependency change.
- **UI surface:** two batch banners expose "Cancelar" → `pipeline.cancel` (sheets
  :4466-4476, scenes :4827-4840). Resume is state-derived: `collectCharacterSheetTasks` /
  `collectSceneTasks` (:2584-2605) filter on MISSING OPTIONS, not pipeline status, and are
  shared by the buttons and the auto-kick (single-predicate design note :2621-2626) — so
  work cancelled before apply is automatically "faltante" ("Generar escenas faltantes (N)"
  :4860, `pendingSceneCount` :4798). EXCEPTION: `collectCoverEndTasks` (:2607-2617) skips
  items whose status is `running`/`persisting` (:2611) — a cover/end item stranded
  `running` by cancel is excluded from re-collection until remount. **The stuck-status gap
  is load-bearing, not cosmetic.** The cover step exposes NO cancel control — an existing
  Finding-5 comment says so verbatim (:6569).
- Auto-kick: intent armed only in approval's committed-success branch, consumed atomically
  at `tryStart` `accepted:true` (:2680-2712); after a cancel the intent is already null —
  no spontaneous restart (unpinned).
- Destructive lifecycle remains frozen **[corrected at spec review (Strike 3),
  PM-verified]:** delete (:1971-1977) and regenerate (:3833-3839) run invalidate →
  cancel → null story id → epoch bump. Unmount (:982) only calls `cancelPipeline()`.
  Recovery accept/decline/repair invalidate the registry at :1425/:1477/:1489; they do
  not run that four-step sequence. PG changes NONE of these lifecycle call sites. A USER
  cancel is a different operation: no epoch bump, no registry invalidation, identity
  stays live.
- **Existing pins (do not re-derive; ~~none assert post-cancel item STATUS~~ — struck at
  spec review, see the correction appended to this bullet):**
  `pipelineRunnerA2.contract.test.ts` :194 (cancel-before-resolve ⇒ no apply/persist),
  :226 (fresh runItems invalidates), :504 (late invoke after cancel ⇒ no
  apply/persist/enqueue/upsert), :701; `…integration.test.ts:883` (full chain, 0 commit,
  0 upsert); `storyImagePipelineRunner.test.ts` :242 (token-before-abort order), :285 +
  outcomes :428 (token flip never interrupts persist); `useStoryImagePipeline.test.ts:33`
  (cancel stops queue pickup). `concurrency.test.ts` has ZERO cancellation cases.
  **[CORRECTED at spec review (Strikes 1+2), PM-verified — errors owned:** the late-result
  cancellation tests do not assert immediate cancel-time normalization of a `running`
  item, but ONE existing outcome test DOES assert a post-cancel status — and pins registry
  survival across `cancel()` indirectly (`pipelineRunnerA2.outcomes.test.ts:474-512`:
  save-failed → cancel → save-only retry → `done`, zero new provider calls; the A3 suite
  itself still has zero `cancel()` calls). PG retains that pin; its missing, base-red
  status claim is specifically synchronous/final `running → pending` with error clear for
  unapplied cancelled work, plus the exact-entry/scoped-count/approval-gate/`retrySaves`
  proof.]
- **EDGE facts (10d1190, read-only):** `generate-scene-images` returns one JSON envelope
  (base64 `images[]` + `skippedImages`); it persists nothing server-side; the handler
  never observes `req.signal` (its only AbortSignal is its own provider-fetch timeout,
  handler :93). A client abort therefore CANNOT recall dispatched server-side spend —
  cancellation's money value is preventing FUTURE dispatches, not refunding in-flight
  ones. Cancelling orphans nothing on the edge.
- Wrapper side effect: `invokeSceneImagesWithFeedback` (editor :646-660) reports
  `skippedImages` into the notice UI BEFORE the runner's token guard sees the result — a
  late post-cancel resolution still adds notices (PFE's frozen accumulate+dedup).

**Draft decisions (PM positions for the review to confirm or strike):**
1. **Scope = frontend pipeline only.** In: `concurrency.ts` (`retryWithBackoff` only),
   `storyImagePipelineRunner.ts`, `taskFactories.ts` (provider signature threading),
   `CuentacuentoEditor.tsx` (wrapper signal pass-through + decision 7's control, nothing
   else), new/extended tests. OUT, each an explicit residual: `runWithConcurrency` and
   every Storage-upload path (PB G4's fail-closed logical writes are deliberately not
   cancellable mid-write); the four manual save callbacks; `generate-story`/`refine-story`
   direct invokes (editor :1702/:1734/:1865 — no cancel surface exists today; adding one
   is a separate product decision); `supabase/functions/**`; destructive-lifecycle
   semantics (A4/A5a frozen).
2. **Cancellation reaches the transport.** `InvokeGenerateSceneImages` gains a signal
   parameter (exact signature is executor design); all 9 factory providers consume
   `ctx.signal`; the wrapper forwards it to `supabase.functions.invoke(…, {signal})`.
   HONESTY RULE: no test name, comment, or copy may claim this stops server-side spend —
   it settles the client promptly and prevents future attempts (verified edge fact above).
3. **`retryWithBackoff` gains cancellation per the seed:** a dedicated cancellation input
   (`isCancelled` callback or signal — executor design) checked BEFORE every attempt
   (including the first) and AFTER every backoff sleep; cancelled ⇒ throw a dedicated
   `RetryCancelledError` (never overloading `shouldRetry`); the backoff sleep becomes
   abort-aware (settles early on cancel). The runner passes the run's signal. Existing
   callers without the new option keep exact current behavior.
4. **STRUCK at spec review (Strike 4) — REPLACED BY THE REVIEW'S G3 IN FULL** (status
   ownership + same-id safety). The invalidation-time sweep survives (`cancel()` AND
   `reserveRun` displacement sweep `running → pending`, error cleared, `persisting`
   untouched, sweep BEFORE new-task installation), but the draft's "abort-caught
   rejection also lands `pending`" lacked a run-token ownership condition — unsafe for a
   re-enqueued same-id item. G3's rule: every provider catch and continuation is
   token-owned; after losing the token it is status-SILENT (the invalidation sweep
   already normalized the old run); cancellation-wins classification
   (`RetryCancelledError` or caught while aborted ⇒ never `error`) applies only while the
   run still owns the item; a live-signal, token-owned genuine failure remains `error` —
   and that token check is required independently of classification (PM-verified: the
   catch at :473-480 writes `error` with no token check TODAY, so the same-id stomp
   hazard pre-exists PG; T-G.8 is its proof).
5. **Stagger abort-awareness lives in the runner** (:744): the stagger sleep settles early
   on abort; a worker waking into a cancelled run dispatches nothing (already true), and
   the run's completion promise no longer waits out residual staggers.
   `runWithConcurrency` is untouched.
6. **User-cancel vs destructive-cancel stay distinct.** User Cancelar: no epoch bump, no
   registry invalidation; save-failed entries, their scoped count, "Reintentar guardado",
   and the approval gate all survive a cancel. Destructive flows keep their exact A4/A5a
   sequence.
7. **The cover/end step gains the missing "Cancelar"** (same pattern and Spanish copy as
   the two existing banners), closing the documented Finding-5 asymmetry and making the
   `:2611` stranded-`running` fix observable end-to-end. (If struck: the asymmetry is
   recorded as a product decision instead.)
8. **Post-cancel notice residue accepted.** Late-resolution `skippedImages` reports stay
   (the drop was real, on a dispatched call; PFE's accumulate+dedup is frozen).
   Suppressing would couple the wrapper to run-liveness for cosmetic gain.
9. **No new status value.** `PipelineItemStatus` unchanged; the UI keeps deriving from
   `pending/running/persisting/done/error/save-failed` + `isRunning`/`isSaving`.

**Boundary matrix (the outline's seven boundaries — today ⇒ PG target):**
1. **Pre-attempt** (queued, not picked up): worker loop already refuses post-cancel
   (:746); stays `pending` ⇒ unchanged, NEWLY pinned with a status assertion.
2. **Stagger** (worker asleep pre-pickup): already 0 dispatches, sleep un-interruptible ⇒
   sleep settles early; 0 dispatches; items `pending` [T-G.3].
3. **Backoff** (between failed attempt N and N+1): attempt N+1 fires unconditionally ⇒
   `RetryCancelledError` before dispatch; provider ×1; item `pending` [T-G.1/T-G.2].
4. **In-flight provider call**: signal severed; abort-rejection → phantom `error`; ignored
   signal → stuck `running` ⇒ signal wired through factories+wrapper; abort-classified
   rejection → `pending`; ignored-signal late resolve → discarded by the (unchanged)
   token guard + status already normalized by the cancel-time sweep [T-G.4/5/6].
5. **Post-generate/pre-apply**: token guard discards (pinned), no status write ⇒ guard
   unchanged; sweep owns the status [T-G.6].
6. **Saving** (persist in flight): never interrupted (pinned for token-flip) ⇒ unchanged;
   re-pinned against `cancel()` specifically + registry survival [T-G.7].
7. **Persist-in-flight at destructive lifecycle**: epoch bump + `PERSIST_STALE` + drain
   (A4/A5a) ⇒ untouched; PG pins the user-vs-destructive distinction [T-G.9].
**Returns to `pending`:** pre-attempt, stagger-parked, backoff-cancelled,
in-flight-aborted, ignored-signal-late, post-generate-discarded. **Completes normally:**
`persisting` (→ `done`/`save-failed`). **Keeps status:** pre-cancel `error`, `done`.

**Acceptance criteria: T-G.1–T-G.13 in `docs/plan/reviews/PG-spec-review.md`, incorporated
by reference (Strike 5 — the draft's T-G.1–T-G.10 are STRUCK: they lacked the direct
pre-attempt/post-wait retry proof and timer/listener cleanup [now T-G.1], the retry
compatibility control [T-G.2], the `reserveRun` same-id ownership proof [T-G.8 — the
load-bearing one], late REJECTION coverage [T-G.7], exact sweep-preservation cases
[T-G.9c], real cover/end control-state coverage [T-G.11], and a mutation pin for the
accepted notice residue [T-G.13]; they also mislabeled registry survival as wholly
unpinned).** Load-bearing items the executor must not miss: T-G.8 (displacement +
same-id ownership — old continuations status-silent after losing the token, proven against
the new run's `pending`/`running`/`persisting`/terminal states), T-G.11 (cover/end
`Cancelar` available across stagger/backoff/in-flight states, `persisting` sibling
untouched, finalization gate no longer strands), T-G.12 (user-vs-destructive negative
spies; do NOT invent a false unmount four-step test), T-G.13 (notice residue pinned by
mutation, image result still discarded). G7's external-boundary literalism binds every
component case (`use-toast` runs real).

**Gates (D6 at the 5f7b6bd baselines, all re-measured by this PM 2026-07-31):** Vitest
`npx vitest run --no-file-parallelism` = 760 tests / 6 failed (the named Mesa six; flakes
possible at machine load ≳40 — 3-of-4 precedent, re-run before calling regression); tsc
1041 identity-delta empty both directions; eslint 159 (116e/43w); node v22.22.0. No
Playwright surface (no raster/canvas work). No EDGE gates — the executor proves
`supabase/**` diff EMPTY; FE fixture blob 70204600… untouched. D7 evidence recorded
verbatim per test.

**Contract coupling: NONE on wire contracts.** No envelope, edge, or storage change. The
`InvokeGenerateSceneImages` signature change is internal and moves atomically with its
only implementations (wrapper) and consumers (factories). PB's suites must stay green;
a PB-suite regression is a FINDING, not something to silently patch.

**All seven named spec-pass gaps are SETTLED by the review** (final answers Q1–Q7 in the
file): base/topology confirmed (one branch off 5f7b6bd, frontend-only, no edge branch;
G1 binding); the invalidation-time sweep confirmed WITH the tightening that `reserveRun`
displacement must also sweep BEFORE new-task installation and every old
catch/continuation is token-owned and silent — an unconditional late
`setStatus(id,'pending')` is FORBIDDEN (G3); cancellation-wins classification confirmed,
tightened to token-owned writes only, live-signal token-owned genuine failures remain
`error` (G3); every scope exclusion confirmed as a G8 recorded residual — nothing reopens
A2/A3/A4/A5a or PB; cover/end Cancelar is IN (G6: one enabled step-level control across
stagger/backoff/in-flight, never cancelling persistence); post-cancel notice residue
ACCEPTED (G6 + T-G.13: real late reports keep flowing through PFE's frozen
accumulate+dedup, the image result stays discarded, no run-liveness coupling); the T-G
set replaced by T-G.1–T-G.13 (Q7).

**Rollback:** revert the phase branch; no deploy, no merge, no infra (D9).

### Review round 1 outcome (2026-07-31) — FAIL — consolidated remediation open
Sol's round 1/2 (`reviews/PG-review-1.md`): **FAIL — 1 BLOCKING [B1], evidentiary only**;
production design ruled sound (G1–G6, G8 MET; T-G.1–T-G.10, T-G.12, T-G.13 MET; no
contrary production behavior found). G7/T-G.11 NOT MET IN FULL: the real-editor
persisting-sibling case (editor pg suite :432-472) waits until cover options are already
visible, so on the fast mock path persistence has ALREADY completed at click time — it
never parks a cover/end item in `persisting` and cannot prove cancel leaves one alone.
Her M-SOL-2 (sweep mutated to also reset `persisting`) leaves that editor case GREEN
while runner T-G.9a correctly fails — PM REPRODUCED BOTH HALVES with own hands at
d3fbd58 (editor case 1 passed under mutant; T-G.9a `Expected: "persisting" /
Received: "pending"`; reverted, tree clean). F8's runner-level substitution is STRUCK —
it becomes [B1]; G7's text ("unit suites do not replace this integration bar") governs.
- **[B1] required remediation (the FILE's five steps are the scope, gate 7):** (1) a
  deterministic opt-in defer/gate at the permitted external Supabase persistence
  boundary (pbBoundary extension allowed, purely additive, default byte-equivalent,
  reset clears, PB suites green); (2) park one cover/end item in REAL `persisting`
  while a sibling keeps the run active, click the single real `Cancelar`; (3) assert at
  UI/boundary level: the persisting item stays saving through cancel, is not aborted,
  completes normally, applied options remain; the unapplied sibling normalized/
  recollectable, no future dispatch; (4) re-run M-SOL-2 (or the equivalent named
  persisting-sweep mutation) — the NEW editor case must fail, normal case pass; (5)
  re-run the four PG suites, affected PB suites, D6 gates. NO production change unless
  the deterministic case reveals a real defect. CONTRACT-COUPLED: NO.
**BINDING (closed to relitigation in round 2):** F2/F5/F7 RATIFIED (T-G.10 count-half
reading; defensive owned-abort branch; additive pbBoundary extension — her wider PB run
135/135), F1/F3/F4/F6/F9 CONCURRED, gates CONCURRED (823/6 Mesa-six; tsc 1041/1041;
eslint 159/159), scope/coupling CONFIRMED (nothing reopens A2/A3/A4/A5a).
Remediation: ONE consolidated round, fresh executor, on `phase/pg-cancellation` atop
d3fbd58; permitted related residue = the additive boundary control + the new/adjusted
T-G.11 assertions and evidence, NOTHING else. Then Sol round 2/2 — FINAL; a second FAIL
goes to Brent (gate 5).

### Remediation outcome (2026-07-31) — landed @1b0cfed, PM-verified — Sol FINAL 2/2 open
Fresh executor delivered [B1] in ONE commit on branch **`pg-fix-d3fbd58`**@**1b0cfed**
(deviation flagged and accepted: `phase/pg-cancellation` is checked out at d3fbd58 in the
executor round's live worktree, so git refuses a second worktree on that branch; the fix
branch fast-forwards from d3fbd58 — `pf-fix`/`a3-f4-fix` naming precedent; ratification
is Sol's). Diff = 2 test files, +147/−2, ZERO production change: an additive
`ctl.upsertGate` on the shared boundary (consulted AFTER the call is recorded in
`upserts`, BEFORE the simulated row is touched; `null` default costs one `if`; reset
clears it — the F7 model) + the new T-G.11 case parking the cover write in REAL
`persisting` (park PROVEN pre-click: gated call captured, exactly one write since
arming, `Guardando...` ×1, sibling `Generando...` ×1) then clicking the single real
Cancelar and asserting: run signal aborted at the paid boundary; STILL `Guardando...`
post-cancel (the M-SOL-2-sensitive line); no new/reissued persistence call; sibling
normalized + `Generar "Fin"` enabled + control gone; zero dispatches over 1.2s; gate
release → `done`, no `Reintentar guardado`, applied options remain; parked payload
carried `coverPaths` ×4 (it was the cover's own write); sibling re-collected without
remount. The old case retitled to what it proves (persistence already completed at
click). **PM verified with own hands at 1b0cfed:** hygiene (1 commit FF from d3fbd58;
`phase/pg-cancellation` untouched at d3fbd58; supabase diff EMPTY; fixture blob
unchanged); M-SOL-2 re-applied → EXACTLY 2 failed / 34 passed (the NEW case at the
`Guardando...` assertion + runner T-G.9a `Expected: "persisting" / Received: "pending"`),
revert pristine; gate-neuter probe → park assertion fails (`expected null not to be
null` — the case cannot degrade to the fast path); four PG suites 64/64; PB family
135/135 (Sol's exact selection); full Vitest serial **824/6 = the Mesa six**; tsc
**1041↔1041** and eslint **159↔159**, identity deltas EMPTY both directions
(path-normalized). Executor findings: NONE (no production defect revealed — the design
behaves per G3/G5 under a genuinely parked persist).

## Phase PC-UI — warnings UI + error-body parsing + T-D.13 — CLOSED
**DONE 2026-08-01 at `phase/pcui-warnings`@8ceec7c** (Sol r1/2 **PASS/CONFIRMED**,
`reviews/PCUI-review-1.md` — zero findings, no remediation round; §3.8 gates satisfied:
PM verification + reviewer PASS both present, no gate-5 trigger, so no Brent close-word
required — PC/PB/PG precedent). Chain: Brent BUILD decision → spec draft → Codex spec
review (3 strikes, all PM-verified) → one executor round @8ceec7c → PM verification →
r1/2 PASS. Merge deferred to PREL (D9).
**WHAT WAS BUILT:** research degradation made user-visible end to end. One closed-shape
client parser (`parseWarnings`: sources closed to location|landmark|prop|story, codes
forward-compatible because the server's Spanish `message` is authoritative, order and
multiplicity preserved) wired at the single existing invoke-error seam
(`InvokeError.warnings` via `buildInvokeError`; `extractInvokeError` stays the sole
`FunctionsHttpError.context` reader). One amber `role="status"`/`aria-live="polite"`
notice — heading `Avisos de la generación`, verbatim server messages, occurrence-safe
keys (duplicates legal), dismiss `Ocultar avisos de la generación` — as a sibling of the
PFE skipped-notice in the shared container. Replace-per-completed-attempt semantics
across preview success/error and generation success/error, lifecycle clears on
reset/regenerate and successful delete, scene-channel independence, and notice/red-error
coexistence on typed 400/422/502 + generic 500. NO all-failed banner (G6 recorded
product deviation, Brent-flagged, standing). T-D.13 closed: the scenes mapper preserves
boolean `landmarkVisible` (base-red — the field was dropped at the first link), proven
in a real-editor chain (response → Story → production approval-path persistence → real
remount/recovery with no `initialStory` shortcut → per-scene Regenerar request bodies)
plus all five G8 severing mutations, with T-A3.5 byte-unchanged as supporting evidence.
PFE-F3 closed by positive consumer proof (unique 400 `CLIENT_INPUT_INVALID` detail
reaches the red surface as `Error 400: <detalle>`; top-level `INVALID_IMAGE_REF` never
branches; per-entry copy retained). FE tests 824→878 (+54); gates delta-clean per D6.
**WHAT CHANGED VS THE FROZEN SPEC, by its own mechanisms (all reviewer-RATIFIED):** D2 —
the T-D.13 chain persists via the REAL approval path because `handleGenerate` performs
no draft write (strictly more production behavior than G7's literal seam phrase); D3 —
real 2s debounce waits instead of mocked timers; the additive `persistDraftRow`
boundary control (F7 standard applied to round-trip fidelity); F1's two-channel record
CONFIRMED (the A3/S5 `editorStateV1.landmarkVisible` record heals a story-tree strip
placed inside reconciliation — expected-green there; the binding mutation placement is
post-reconciliation).

### (spec as frozen — historical)
**SPEC FROZEN 2026-07-31 per Codex spec review (EXECUTABLE WITH THE TEXT BELOW).**
**The authoritative spec is this section PLUS the G1–G10 binding texts and the
T-U.1–T-U.12 acceptance criteria in `docs/plan/reviews/PCUI-spec-review.md`, incorporated
by reference (PD/PB/PG precedent).** Brent chose BUILD (2026-07-31, decision log). Scope
accumulated from PLAN-review [P4] + PD spec review G2/G3 + T-D.13 + the PFE-F3 follow-up.
Three PM-draft strikes, ALL THREE PM-verified against the pinned code before applying —
two owned PM errors and one unsound PM design: [S1] the T-D.13 persistence cites pointed
at caller-side editor code (`:3441-3495` is `buildAuthoritativeDraftPatch`, patch
derivation with its own redundant landmarkVisible record; `:1318` is mid-comment) — the
real seam is `useCuentacuentosDraft.ts:1122-1160` (serialize), `:1345-1365`/`:1491-1519`
(load/reconcile), editor `:1244-1266` (consume); T-A3.5's premise unaffected. [S2]
`source:code` is NOT a unique warning identity (the edge emits one entry per landmark/prop
result — duplicates are legal); occurrence-safe keys, order and multiplicity preserved, no
dedup of distinct server entries (G2/G4). [S3] the request-derived all-failed denominator
is unsound (server-side materialization can turn a photo-bearing prop into
`NO_IMAGES`/skipped — no warning, no provider call — so failures-only warnings can never
reconstruct the denominator); replaced by **G6's recorded product deviation: NO all-failed
banner distinction in PC-UI** — mixed and all-failed degradation render the same
non-blocking notice. **Flagged for Brent's veto: a future stronger banner requires a
separately reviewed additive edge summary/denominator contract in its own phase — it does
not ride here.** Review plan (recorded): ONE executor round on `phase/pcui-warnings` → PM
verify → Sol phase review round 1/2 of the §1.5 cap (her spec review sits outside the
cap, stated in its FINAL CLOSE).

**Intent:** the degradation PC/PD made API-observable becomes USER-observable. When story
research fails (location/landmark/prop analysis) or normalization drops a prop, the editor
shows a non-blocking Spanish notice — on success, preview, AND error responses — rendering
the server's own fixed messages. Plus: the `landmarkVisible` response field actually
reaches scene-image requests end-to-end (T-D.13), and the PFE-F3 consumer question closes.

**Base/branch decision (PM position):** `phase/pcui-warnings` off `pg-fix-d3fbd58`@**1b0cfed**
(the FE lineage's reviewed tip — PG fork-avoidance precedent; PC-UI edits the editor).
Frontend-only; NO edge branch — the warnings contract is already emitted at
`phase/pb-storage-edge`@10d1190 (PC r1-remediated + PD), read-only reference. PH queues
behind PC-UI on this lineage (both edit the editor; Brent's PH answers recorded).

**Verified current state (all per D5, `git show` at 1b0cfed FE / 10d1190 edge, 2026-07-31):**
- **Edge emission (frozen contract, PC-UI is its named consumer — the typedErrorResponse
  comment says so verbatim):** `EnvelopeWarning = ResponseWarning | StoryWarning`
  (handler :88-160). `ResponseWarning {source:'location'|'landmark'|'prop', code:
  NO_API_KEY|MODEL_NOT_FOUND|PROVIDER_HTTP_ERROR|PROVIDER_UNAVAILABLE|EMPTY_RESPONSE|
  OUTPUT_TRUNCATED|OUTPUT_BLOCKED, message, httpStatus?, finishReason?}`;
  `StoryWarning {source:'story', code:'PROP_NOT_RECURRING', message}` with fixed copy
  (:151-153). Messages are SERVER-BUILT Spanish, envelope-neutral, from code+source only
  (:688-706) — the client renders `message` verbatim and never re-derives. Envelopes:
  preview 200 `{success:true, skippedImages, warnings?, promptPreview}` (:1666-1678);
  success 200 same-shaped additive (:1852-1860); typed 502/400/422
  `{success:false, code, error, skippedImages?, warnings?}` (:1389-1404); generic 500
  `{success:false, error, skippedImages?, warnings?}` (:1924-1941). `warnings` key
  OMITTED when empty on every envelope.
- **FE consumption today: ZERO.** No `warnings` read anywhere in the editor (grep 0 at
  1b0cfed).
- **The parse seam already exists and PC-UI extends it, not duplicates it:**
  `extractInvokeError` (editor :165-178) reads `FunctionsHttpError.context` (Response),
  `ctx.clone().json()` defensively (non-JSON/consumed ⇒ status-only), delegates to
  `buildInvokeError(status, body)` (imageFeedback.ts :142-153) → `InvokeError {status,
  code?, field?, skippedImages[]}` (:113-132) — NO warnings field yet. ALL FOUR invoke
  sites route through it: scene wrapper :502, story preview :1716, generate :1745,
  refine :1899.
- **Notice UI precedent (PFE):** the skipped-notice renders in the SHARED container
  outside the current step (:7080-7106; amber panel, per-item list keyed `field:code`,
  `describeSkippedImage`, manual dismiss). Scene path ACCUMULATES+dedups
  (`reportSkippedImages` :630-641); the STORY path REPLACES per attempt (:1753 success,
  :1855 error via `InvokeError.skippedImages`).
- **Preview handler ignores everything but `promptPreview`** (:1718-1721) — preview
  warnings currently invisible.
- **T-D.13 chain status:** response → `Story.scenes` **BROKEN TODAY** — the structured
  scenes mapping (:1785-1790) maps only `{number, text, visualDescription}` and DROPS
  `landmarkVisible`, while the edge's strict schema emits and the normalizer preserves it
  (edge :243/:424-436, prompt :1174/:1186). `Story.scenes` → persist/reload EXISTS and is
  PINNED (T-A3.5, `useCuentacuentosDraft.a3.test.ts:1126+`; ~~editorStateV1 write
  :3441-3495, restore :1318~~ **[STRUCK at spec review [S1], PM-verified — cite error
  owned: those are `buildAuthoritativeDraftPatch` and a comment; the actual seam is
  `useCuentacuentosDraft.ts:1122-1160` serialize / `:1345-1365`+`:1491-1519`
  load-reconcile / editor `:1244-1266` consume]**). persist → scene-image request EXISTS
  (payloads preserve `scene.landmarkVisible`, :2318/:2323 and :2818/:2823, "Preserve
  landmarkVisible (A3/S4)"). PC-UI adds the missing first link and proves the chain
  end-to-end per G7/G8 (real-editor bar + the five named mutations incl. the
  reload-precondition proof).
- **PFE-F3 facts:** `INVALID_IMAGE_REF` is consumed only per-`skippedImages`-entry
  (imageFeedback :56, `describeSkippedImage`); top-level codes flow through
  `buildInvokeError`'s message path (`Error <status>: <detalle>`). The PD 400-remap's
  consumer-side pin belongs here (backlog row: "close at PC-UI").

**Draft decisions (PM positions for the review to confirm or strike):**
1. **One shared warnings parser** (`parseWarnings(value: unknown): EnvelopeWarning[]`,
   shape-validated like `parseSkippedImages`: `source` ∈ the four known values, `message`
   required string, `code` any string — the server's copy is authoritative, so unknown
   codes still render their message; malformed entries dropped, never a crash). Wired at
   BOTH consumption points of the existing seam: `buildInvokeError` gains
   `warnings: EnvelopeWarning[]` (error bodies), and the story success/preview handlers
   parse `data.warnings`. No second parsing implementation (PB G2 single-source rule).
2. **Warnings notice = a sibling block in the same shared container** as the PFE
   skipped-notice (same visual pattern, distinct state), Spanish, non-blocking, renders
   the server `message` VERBATIM, ~~keyed `source:code`~~ **[STRUCK at spec review [S2],
   PM-verified: duplicates are legal — occurrence-safe keys, order+multiplicity
   preserved, never dedup distinct server entries; exact copy/roles per G4: heading
   `Avisos de la generación`, dismiss `Ocultar avisos de la generación`, `role="status"`
   + `aria-live="polite"`]**, manual dismiss. STORY-path semantics: REPLACE per completed
   attempt — success or error, generation or preview (G4 extends this to lifecycle:
   regenerate/reset and successful delete also clear; scene-image calls never touch it).
3. **Error-path rendering:** warnings from a failed generation (typed 502/400/422 AND
   generic 500 bodies) render alongside the existing error surface — the degradation
   happened before the failure and is still true (PD's design premise).
4. **Preview:** warnings on the preview envelope render too (position — shared container
   vs inside the preview dialog — is the review's call, Q2).
5. **STRUCK at spec review [S3] — REPLACED BY G6 IN FULL** (PM-verified: the PM's
   request-derived denominator was unsound — post-materialization `NO_IMAGES`/skipped
   analyses emit no warning and no provider call, so failures-only warnings cannot
   reconstruct attempts). PC-UI implements NO all-failed banner and NO denominator
   inference; mixed and all-failed degradation render the same non-blocking notice.
   Recorded product deviation from PLAN-review [P4], flagged for Brent; a future banner
   = a separately reviewed additive edge contract, never a PC-UI rider.
6. **T-D.13:** map `landmarkVisible` in the scenes mapping (response → `Story.scenes`),
   then prove the full chain (response → Story → editorStateV1 round-trip → scene-image
   request payload) with a severing mutation per link; T-A3.5 stays untouched.
7. **PFE-F3 closure:** pin by test that a top-level 400 `CLIENT_INPUT_INVALID` from
   `generate-story` surfaces its Spanish `error` body text via the InvokeError message
   path, and that NOTHING branches on top-level `INVALID_IMAGE_REF` (it remains a
   per-entry code only). Existing-true expected ⇒ D7 named mutations.
8. **Hygiene:** the notice renders only server-built strings; no client-side message
   re-derivation from codes; no request/provider text interpolation. Pinned by mutation.
9. **Scope OUT, each a recorded residual:** `refine-story` warnings (none exist —
   PD-REFINE deferred post-release by Brent 2026-07-31); every edge function (no edge
   change of any kind); the scene-path notice semantics (PFE frozen, incl. the [S2]
   stale-notice backlog item); PH's cost/count surfaces; storage/pipeline machinery
   (PB/PG frozen).

**Acceptance criteria: T-U.1–T-U.12 in `docs/plan/reviews/PCUI-spec-review.md`,
incorporated by reference (the draft's T-U.1–T-U.9 are STRUCK — they lacked duplicate
identity/multiplicity, lifecycle clearing, full 400/422/502/500 component coverage,
unknown-property sanitization, the load-bearing reload precondition, the
unit-vs-real-editor split, exact PFE-F3 mutations, accessibility, and head-vs-base D6
semantics).** Load-bearing items the executor must not miss: T-U.4 (replacement +
lifecycle clearing), T-U.7 (forward codes, duplicate entries both render, hygiene
plantings), T-U.9/T-U.10 (the T-D.13 real-editor chain with NO `initialStory` shortcut
on remount + base-red + all five G8 mutations, T-A3.5 byte-unchanged), T-U.11 (PFE-F3
positive consumer proof — a source grep does not count). G10's boundary literalism binds
every component claim (production editor/hook/parser/factories/toast; only external
boundaries mocked — the PB/PG bar).

**Gates (D6 at the 1b0cfed baselines, re-measured by this PM 2026-07-31):** Vitest serial
824/6 (the named Mesa six; load-flake guidance stands), tsc 1041 identity-delta empty,
eslint 159, node v22.22.0. `supabase/**` diff EMPTY; FE fixture blob 70204600… untouched.
No Playwright surface expected (notice is DOM-testable); no live provider calls.

**Contract coupling:** consumes the FROZEN warnings contract at 10d1190 (PC r1 + PD; the
edge comment names PC-UI as consumer — neither key may be renamed/dropped). No wire
change. PB/PG/PFE suites must stay green; a regression there is a FINDING, not a patch
target.

**All seven named spec-pass gaps are SETTLED by the review** (final answers Q1–Q7 in the
file): Q1 topology confirmed (one FE branch off 1b0cfed; no edge branch; PH continues
from PC-UI's reviewed closing tip); Q2 one sibling notice in the shared container,
replace-per-completed-attempt incl. preview and error, preview renders in the SAME shared
notice (never inside the prompt panel, no preview-only state), occurrence-safe keys,
clear on reset/delete; Q3 sources closed to the four values, codes forward-compatible
non-blank strings, exact G2 parser rules + G3 `InvokeError.warnings` extension, ONE
parser both consumers call; Q4 banner distinction DROPPED (G6 product deviation, Brent
veto flagged); Q5 the G7 real-editor chain is mandatory, T-A3.5 + factory tests are
supporting-only, mutations per G8; Q6 PFE-F3 closes only via G9/T-U.11's positive
consumer behavior + `M-F3-DETAIL`/`M-F3-TOPLEVEL`; Q7 T-U.1–T-U.12 replace the draft
set.

**Rollback:** revert the phase branch; no deploy, no merge (D9).

### Executor round outcome (2026-08-01) — landed @8ceec7c, PM-verified — Sol review r1/2 open
Executor delivered `phase/pcui-warnings`@**8ceec7c** (4 commits off 1b0cfed, pushed;
7 files +1820/−4; production = EXACTLY the two G1 files, 88+85 lines; +54 tests
824→878). PM re-verified with own hands (detached worktree, node v22.22.0, load ~9;
lockfile blob identical across 8ceec7c/1b0cfed/installed):
- Hygiene: tip=origin=8ceec7c; merge-base EXACTLY 1b0cfed; supabase/** diff 0; fixture
  blob 70204600… unchanged; T-A3.5 file byte-unchanged; all 11 protected refs pinned;
  `main` still 7f3600f.
- Production diff read IN FULL, G-compliant: G2 parser exact (closed sources, non-blank
  code/message, bad-optional invalidates the entry, unknown props not copied, order+
  multiplicity kept); G3 `InvokeError.warnings` via the single `parseWarnings` in
  `buildInvokeError`, existing behavior untouched; G4 notice exact (heading `Avisos de
  la generación`, dismiss `Ocultar avisos de la generación`, role=status,
  aria-live=polite, verbatim messages, index-suffixed keys) as a sibling block before
  `renderCurrentStep()`; six `setWarnings` sites = preview success (BEFORE the panel
  guard, so a panel-less response still replaces) / preview error / generate success /
  generate error / delete-clear / reset-clear; G5 coexistence (setError + setWarnings
  both set in catch); G6 clean (zero banner/severity/denominator logic); G7 spread
  verbatim. Boundary control `persistDraftRow` verified additive (default false ⇒
  byte-equivalent; JSON-cloned row = production's own payload; resetBoundary clears).
  Mock honesty: each new suite mocks ONLY `@/integrations/supabase/client`; use-toast
  and factories run real.
- Gates: Vitest serial **878/6 = the Mesa six** (one clean run); tsc **1041↔1041**
  identity delta EMPTY both directions — after eliminating a PM measurement artifact
  (a path-scoped `git checkout 1b0cfed -- src/` left head-only test files in place; the
  hybrid produced a phantom 1042nd identity; pure detached base = 1041 — method note
  recorded); eslint **159↔159** multiset delta EMPTY both directions.
- Base-red re-proof, own hands: both production files reverted to 1b0cfed under the
  committed suites → **47 failed / 30 passed** exactly as reported; restore pristine.
- Own mutations (all reverted, tree clean each time): **M-D13-ROUNDTRIP at the G8
  post-reconciliation placement → EXACTLY 2 red** (the real-editor chain + retained
  T-A3.5); **the naive inside-reconciliation placement → 32/32 GREEN** — executor
  finding F1 REPRODUCED: the A3/S5 redundant `editorStateV1.landmarkVisible` channel
  heals the story tree, so only the post-reconciliation strip proves the round trip
  (two independent persistence channels — a reviewer reproducing the naive placement
  will see green and must not read it as test insensitivity); **M-U4-REGEN → exactly
  1 red**; **M-F3-TOPLEVEL → exactly 1 red** (the named forbidden-branch case).
- D5 spot-check: fixture strings byte-match the edge copy at 10d1190
  (PROP_NOT_RECURRING + the envelope-neutral consequence clause); D2's premise
  confirmed (handleGenerate only `setStory`s — the drafts write is the approval path).
**Findings/deviations triage:** F1 (two-channel healing) VERIFIED + ACCEPTED — recorded
above for the reviewer. D2 (T-D.13 chain persists via the REAL approval path — strictly
more production code than G7's literal "production-hook draft write"; also the
post-recovery invocation is per-scene Regenerar = the normal request-builder branch
M-D13-REQUEST targets) ACCEPTED pending Sol ratification. D3 (real 2s debounce waits,
timers NOT faked — G10 permits but does not require mocking) ACCEPTED. D4 (use-toast
real) = compliance, not deviation. F5 (two self-caught silent-pass defects closed:
disabled-button click now asserts enablement ×2 sites; vacuous scene case hardened) —
exemplary D7 honesty, verified present. F6 (decodable PNG fixtures required by the
save gate) noted — production behaving correctly. F7 (G6 stands) verified in the diff.
No spec premise false; no frozen-phase file touched.
The prior plan §3 plus A7a/B5 is seed material, not an executor spec. Each phase requires its
own Codex plan review and must resolve the following before an executor prompt exists. A phase
without checkable criteria here is deliberately marked unready rather than dressed with
invented ones.
- **PB:** choose and record the cross-lineage base; reconcile D3 with A7a's possible
  `liturgia-images` addition; re-verify current bucket RLS/path rules; include or explicitly
  exclude `liturgyService.uploadSingleImage`; define content-hash/idempotent-409 behavior,
  partial-upload failure semantics, legacy-path handling, `editorStateV1` path-only
  persistence, and no-delete/GC boundaries; rebase every file/line target and make all T-B
  criteria mutation-sensitive.
- **PG:** branch from `cc-downscale-a`@185c370 or its latest reviewed descendant; rebase the
  pipeline/retry targets; define cancellation at pre-attempt, stagger, backoff, in-flight
  provider call, post-generate/pre-apply, saving, and persist-in-flight boundaries; state which
  work returns to `pending`, prove save-retry entries survive, and pin manual/batch parity with
  fake-timer plus ignored-AbortSignal tests.
- **PH:** refer to "prior-plan cost option B," never current D3; ~~choose a cross-lineage base
  that contains PFE and PC/PD~~ **[OBSOLETE 2026-08-01, labeled — no such base exists (the two
  lineages never merged; PREL owns integration); superseded by the reviewer-ratified PC-UI G1
  sequencing rule: PH branches from PC-UI's reviewed closing tip `phase/pcui-warnings`@8ceec7c
  and reads edge facts from 10d1190 read-only. See the PH section.]**; refresh model prices and
  exact first-attempt call counts; state
  what costs exclude; pin default cover/end count=2, append-vs-replace selection semantics,
  persistence/reload, concurrent-click disabling, and provider-call counts. Any hard total-cost
  ceiling is a new Brent product decision, not an executor choice. [Both product answers
  recorded 2026-07-31; ceiling: NONE.]

## Phase PH — costos (prior-plan cost option B: 2×pro cover/end + append) — CLOSED
**DONE 2026-08-03 at `phase/ph-costs`@ccb34f7** (Sol FINAL r2/2 **PASS / CONFIRMED FIXED**,
`reviews/PH-review-2.md`: [B1]'s five-item matrix FIXED IN FULL on her own evidence — her
independent base-red 11/12 and her own [M2-PM] reproduction felling exactly the 4 replace
cases; the third patch-shape divergence class RATIFIED; the r1 blob transcription
CONFIRMED corrected; the existing-contract/no-new-upload-category check CONFIRMED; residue
CLEAN; gates concurred; **G1–G10 and T-H.1–T-H.12 MET IN FULL**). §3.8 gates satisfied: PM
verification + reviewer PASS both present; no gate-5 trigger, so no Brent close-word
required (PC/PB/PG/PC-UI precedent). Merge deferred to PREL (D9). **This was the LAST
build phase — PREL's build dependencies are now clear.**
**WHAT WAS BUILT:** prior-plan cost option B, end to end. Cover and end generate
**2 pro-quality options per batch instead of 4** (`count: 2, modelTier: 'pro'` in both
generate factories; the edge needed NO change — 2 is already its default, within its
`min(effectiveCount, 4)` fan-out cap), cutting the first-attempt image-output floor by
4 pro images ≈ **US$0.54** (min US$2.28 / typical US$3.35 at the refreshed official
prices: flash US$0.067, pro US$0.134 per 1K image). **Regenerate now APPENDS** on all four
non-empty cover/end surfaces (Brent's recorded product default): the factories gained a
required `append: boolean` following the live sheet/scene pattern — append reads the LIVE
ref, extends right, preserves the selection; replace clears a stale selection (the
silent-rebinding hazard the base carried) — and the generated patch carries the live
selection alongside the full array, so **both survive real persistence and reload**. UI:
headers flip to `2 más` + Sparkles with the existing title copy; `ImageSelector` gained two
additive optional props (`regenerateLabel`, `regenerateDisabled`) leaving sheet/scene
callsites DOM-identical; no destructive cover/end batch-regenerate surface remains.
Concurrency: both handlers gained the LIVE global guard
`if (isApprovingRef.current || pipeline.isBusy()) return;` — closing a real spend hazard
the base had (a same-tick cover↔end double-click DISPLACED a dispatched pro batch, since
`reserveRun` displaces the global run) — with the four surfaces' visual state now
following that global guard. The PG-frozen runner was never touched. FE tests 878 → 931
(+53); gates delta-clean per D6 at the tip.
**WHAT CHANGED VS THE FROZEN SPEC, by its own mechanisms:** the three spec-review strikes
([S1] the 200-`success:false` zero-image shape; [S2] seven signature consumers, not one;
[S3] the guard must be global, not per-item); the **dated G1 scope amendment** admitting
five retained editor suites for exactly seven stale copy-handle widenings + a deterministic
pfe2 harness repair (reviewer-RATIFIED; the pfe2 legacy mock served invalid base64, so
PB's fail-closed path left the auto-kick's items `save-failed` and the old tests passed
only by exploiting the very displacement hazard [S3] named); [B1-PM], the PM finding that
the visual disabled state must follow the global guard; and [B1], the reviewer finding
that the append's generated snapshot omitted the preserved selection. Two PM errors are
recorded in place: the r1 "run never closes" over-claim (corrected by the executor, both
halves re-verified) and the r1 acceptance of a positional T-H.7 assertion that could not
fail under severed selection wiring — the PB-F7 softening class, fourth instance.

### (spec as frozen — historical)
**SPEC FROZEN 2026-08-02 per Codex spec review (EXECUTABLE WITH THE TEXT BELOW).**
**The authoritative spec is this section PLUS the G1–G10 binding texts and the T-H.1–T-H.12
acceptance criteria in `docs/plan/reviews/PH-spec-review.md`, incorporated by reference
(PD/PB/PG/PC-UI precedent).** Three PM-draft strikes, ALL THREE PM-verified against the pinned
code before applying (each labeled in place below): **[S1]** the "all-failed ⇒ 429/500"
premise was incomplete — with zero REJECTED variations the edge falls through to HTTP 200
`success: images.length > 0` ⇒ `success:false, images:[]`; the FE wrapper throws on
`!data?.success || !data.images?.length` either way. **[S2]** "the editor is the only
consumer of the factory signature" was false — the two suites construct cover/end generate
factories SEVEN times, so a required `append` + generate-only selection setters force
mechanical signature adaptations at the three non-count sites too (authorized by G1/G2; the
four count pins remain the only behavior divergences). **[S3]** the draft's per-item busy
guard leaves the cover↔end race open — `reserveRun` displaces the GLOBAL run, and the
imperative guarantee is the LIVE `pipeline.isBusy()`, never the render boolean or a
single-id `statusOf`. Product frame = Brent's two answers, recorded 2026-07-31: option B
CONFIRMED as specced — each cover/end batch generates **2 pro-quality options** and
**regenerate APPENDS** (product default; he may revise later) — and **NO hard total-cost
ceiling**. Review plan (recorded): ONE executor round on `phase/ph-costs` off 8ceec7c →
report to the PM ONLY (gate 2) → PM verification (incl. at least one T-H.5 same-tick race
re-run, one T-H.2 append/selection case, the D6 identity deltas both directions, and the
`supabase/**` empty-diff + fixture-blob checks) → Sol phase review round 1/2 of the §1.5
cap.

**Intent (prior plan §3 FASE H, rebased):** stop paying 4×pro for cover and end when 2 suffice,
and make "more options" additive instead of destructive. Cover/end drop to 2 pro images per
batch; regenerating appends 2 more (existing options and the selection survive); the cost story
is pinned by call-count tests, not a UI. The LAST build phase before PREL.

**Base/branch (PM position):** create `phase/ph-costs` from `phase/pcui-warnings`@**8ceec7c** —
BINDING per the reviewer-ratified PC-UI G1 sequencing rule (both phases edit the editor; PG
fork-avoidance precedent). Frontend-only; **NO edge branch** — the edge at
`phase/pb-storage-edge`@10d1190 is a read-only contract reference (count 2 is already its
default and within its cap, verified below). The outline's cross-lineage-base clause is
OBSOLETE (annotated there). If the executor finds a genuine edge-side need, that is a
STOP-and-FINDING, never a silent rider.

**Verified current state (all per D5 — `git show` at 8ceec7c FE / 10d1190 edge, 2026-08-01;
gates at 8ceec7c re-measured same day by this PM):**
- **Factories (`src/lib/cuentacuentos/taskFactories.ts`):** cover generate posts
  `count: 4, modelTier: 'pro'` (:482-483) and its apply REPLACES the whole array
  (`setCoverOptions(nextOptions)`; patch `{coverOptions: nextOptions}` :490-491) WITHOUT
  clearing `selectedCover` — the stale index silently rebinds onto a different image. End
  identical (:536-537, :544-545). **The append pattern PH needs already EXISTS** for sheets
  and scenes: `append: boolean` inputs (sheets :194-195, scenes :355-356), append ⇒ merge into
  the LIVE ref (`[...existing, ...result.images]` :239/:405), `!append` ⇒ replace + CLEAR
  selection (:248/:414). All four refines are `modelTier:'pro'` single-image with
  slot-replacement by VALUE + `APPLY_STALE` fallback (cover :799-816) — append-compatible,
  untouched by PH.
- **Editor (`CuentacuentoEditor.tsx`):** `handleGenerateCover` :2523-2537 /
  `handleGenerateEnd` :2609-2620 take only `customPrompt` and guard only `isApprovingRef`
  (Finding-3); builders :2484/:2577. The sheet/scene handlers already take
  `generateOptions?: {append?: boolean}` (:2120-2133, :2389-2435). "2 más" buttons already
  exist for sheets (:4585-4595) and scenes (:5001-5012): rendered only when options exist,
  `disabled={pipeline.isRunning || refining… !== null}`, title
  `Genera 2 opciones adicionales sin descartar las existentes`, label `2 más` (+Sparkles).
  Cover/end header buttons :5964-5980 / :6304-6320: `disabled={isItemBusy(id) || isRefining…}`,
  label flips `Generar portada`/`Generar "Fin"` ↔ `Regenerar`. `ImageSelector` is SHARED by
  all four categories (:4663 sheets, :5524 scenes, :6242 cover, :6586 end; def :222+): while
  `phase !== 'idle'` the whole panel is a spinner (its controls unreachable mid-run); its
  regenerate button carries the fixed replace-intent copy
  `No me gustan, generar otras opciones` and `disabled` covers only the approval envelope. The
  sheet/scene `onRegenerate` closures carry an INLINE same-tick guard
  (`if (refining… !== null || pipeline.isRunning) return;` :4669-4672/:5530-5533); the
  cover/end closures (:6248/:6592) do NOT — combined with the handler's missing busy guard, a
  fast double-click can displace a dispatched pro batch (`runItems` displaces; PG's reserveRun
  sweep). `collectCoverEndTasks` :2655-2665 collects ONLY when options are EMPTY and the item
  is not busy — the auto-kick can never regenerate or append.
- **Selection/persistence:** `selectedCover`/`selectedEnd` `number|null` (:704/:706, refs
  :809/:811), serialized into draft data and restored (:1310-1312), consumed at finalization
  (:1191-1193). Draft fields `coverOptions`/`endOptions` (hook :51-52) with per-category patch
  kinds (:317-318); the hook's URL swap is count-matched and length-agnostic (:451-456) —
  verified append-compatible (PB uploads the touched category in full, so counts match at any
  length). Reload paths :710/:718.
- **Edge (10d1190, read-only):** `count = 2` is the DEFAULT (handler :761); `modelTier`
  narrowed to `'pro'|'flash'` (:762); `effectiveCount = refine ? 1 : count` (:822); fan-out is
  ONE Gemini call per image, capped `Math.min(effectiveCount, 4)` (:1344-1345); partial
  success possible (invalid variations dropped :1350-1366); ~~all-failed ⇒ 429/500 error
  envelope~~ **[STRUCK at spec review [S1], PM-verified — premise incomplete, error owned:
  429/500 fires only when `images.length === 0` AND at least one variation REJECTED
  (`errors.length > 0`, :1374-1390); all-fulfilled-but-empty/invalid falls through to HTTP
  200 with `success: images.length > 0` ⇒ `success:false, images:[]` (:1392-1400). The FE
  wrapper turns BOTH shapes into the error surface — `!data?.success || !data.images?.length`
  throws (editor :503-505). G2/G7/T-H.6 pin the exact distinction.]**; response metadata
  `requestedCount`/`model`/`modelTier` (:1398-1400). Models are
  env-injected in `index.ts` :20-21 (D2-clean): `GEMINI_IMAGE_MODEL_FLASH ??
  'gemini-3.1-flash-image'` (Nano Banana 2), `GEMINI_IMAGE_MODEL_PRO ?? 'gemini-3-pro-image'`
  (Nano Banana Pro). Sending `count: 2` requires NO edge change.
- **Model prices REFRESHED 2026-08-01 from the live official Gemini pricing page (seed's
  numbers re-verified CURRENT, not stale):** flash-image output $60.00/1M tokens, 1120
  tokens/image ⇒ **US$0.067 per 1K image**; pro-image output $120.00/1M ⇒ **US$0.134 per
  1K/2K image** (input $2.00/1M ≈ US$0.0011/image). Option B's seed arithmetic
  (min US$2.28 / típico US$3.35) re-verified consistent; this phase removes 4 pro images per
  first attempt ≈ **−US$0.54**.
- **Exact first-attempt provider-call counts (LIVE code, not the seed):** per character
  2×flash (:231-232); per prop-with-description-and-no-photos 2×flash (:309-310); per scene
  2×flash (:397-398; 15 scenes typical, 12–16 window); cover 4×pro TODAY → **2×pro** (this
  phase); end identical. Each FE batch = ONE edge invocation; the edge fans out one provider
  call per image. Refines 1×pro each. Research (excluded, for the record): 1×location +
  1×landmark + 1×per-prop-with-photos on `GEMINI_RESEARCH_MODEL ?? 'gemini-3.5-flash'`
  (story handler :1572/:1576/:1597); story text 1× Anthropic `claude-opus-4-5-20251101`
  @16384 (:67/:1707-1708 — the bare-alias merge intent is PREL's recorded item, not PH's).
- **What the cost floor EXCLUDES (outline mandate):** input tokens (text + reference images),
  story-text generation (Anthropic), research/analysis calls, retries (client
  `retryWithBackoff` + the edge's single 429/5xx retry), ALL refines, every append batch
  beyond the first attempt, manual uploads, and abandoned/cancelled spend. It is an
  images-OUTPUT first-attempt floor only.

**Draft decisions (PM positions for the review to confirm or strike):**
1. **Scope = frontend-only, two production files.** IN: `taskFactories.ts` (cover/end
   generate factories ONLY), `CuentacuentoEditor.tsx` (cover/end handler `{append}` options,
   the same-tick guards, the two cover/end button surfaces, an ADDITIVE optional
   `ImageSelector` regenerate-label prop), focused tests. OUT, each a recorded residual:
   `supabase/functions/**` (no edge-side need identified); sheet/scene/prop semantics AND
   their pre-existing guard shapes (cheap flash tier — not this phase's hazard); all refine
   flows; manual save/upload paths; PB/PG/PC-UI machinery; destructive lifecycle;
   runner/concurrency; any count/tier knob beyond cover/end 4→2.
2. **count 4→2, tier stays `'pro'`, both factories.** Any different count or tier is a PLAN
   decision backed by a recorded finding, never an executor choice (PC precedent).
3. **Append per the LIVE sheet/scene pattern:** `makeCoverTask`/`makeEndTask` gain
   `append: boolean`; append ⇒ `[...liveRef.current, ...result.images]`, selection PRESERVED
   (append-only extension keeps every existing index valid); `!append` ⇒ replace + CLEAR
   selection (pattern conformity with :248/:414 — a change from today's
   replace-preserving-a-stale-index, which is the silent-rebinding hazard; post-PH the
   `!append` branch is reachable only from empty-options paths, so the clear is a
   latent-hazard fix, not an observable flow change — review confirms).
4. **Regenerate = APPEND (Brent's recorded default).** Both non-empty cover/end surfaces
   append: the header button's non-empty state becomes `2 más` (+Sparkles) with the existing
   title copy verbatim; `ImageSelector` gains an additive optional regenerate-label prop
   (default = the existing `No me gustan, generar otras opciones`, so the sheet/scene sites
   are byte-unchanged) and the cover/end sites pass append-honest Spanish copy. **NO cover/end
   replace surface remains** — a product consequence of Brent's answer, recorded here; sheets/
   scenes keep their replace+2-más pair (asymmetry recorded). Empty-state labels unchanged.
   All copy Spanish (D8).
5. **STRUCK at spec review [S3] — REPLACED BY G5 IN FULL** (PM-verified, design error owned:
   `reserveRun` displaces the GLOBAL run — new token → sweep → abort prior, runner :828-870,
   PG's own G3 comment in the code — so after starting cover, `statusOf('end')` is still
   idle and a per-item guard admits the cover↔end displacement race). G5: the non-empty
   closures keep a visual running/persisting/refining/approval pre-filter; the imperative
   guarantee in BOTH handlers is `if (isApprovingRef.current || pipeline.isBusy()) return;`
   — the LIVE runner query (hook :58-59: `isRunning` can lag a render), never the render
   boolean nor a single-id `statusOf`. Two clicks on one control AND same-tick
   cover→end/end→cover sequences yield ONE run, ONE invocation, zero
   abort/displacement/second dispatch. The PG-frozen runner (`runItems`/`reserveRun`/
   `tryStart`) is untouched.
6. **Persistence/reload ride the existing machinery:** patch kinds `coverOptions`/`endOptions`
   unchanged; appended arrays persist through the A2 queue + PB content-addressed uploads;
   reload restores the full array + preserved selection. Proven through the REAL hook with the
   `persistDraftRow` boundary control (F7 standard, PC-UI-ratified).
7. **Unbounded accumulation ACCEPTED** (no ceiling — Brent): each `2 más` click adds 2 pro
   images (≈US$0.27); the 2-column grid grows; no cap, no warning UI. Recorded residual.
8. **NO cost-display UI.** The seed's "conteo de costo" criterion is satisfied by call-count
   test pins (request bodies + invoke-log accounting), not a rendered estimate.
9. **Collector/auto-kick untouched** (empty-only, append flag irrelevant there). Cancel
   interplay: a cancelled append discards its result and leaves prior options + selection
   intact (PG's frozen semantics; re-append is a manual click — `collectCoverEndTasks` will
   not re-offer a non-empty category, verified :2662-2663).
10. **Partial batches append what arrived** (the edge may return 1..count valid images;
    zero valid images keeps the existing FE error surface — in BOTH edge shapes: 429/500
    with rejections AND the [S1]-corrected 200 `success:false, images:[]`; the wrapper
    rejects both, so zero images never reaches apply — G2/T-H.6). Existing behavior, pinned
    only where it intersects append.

**Acceptance criteria: T-H.1–T-H.12 in `docs/plan/reviews/PH-spec-review.md`, incorporated by
reference (the draft's T-H.1–T-H.10 below are STRUCK — the review's replacement set adds the
three signature-consumer adaptations, generate-only selection setters, the cover↔end global
race, the 200-empty vs 429/500 distinction, single-image partial batches, exact copy pins,
the cost formula/populations, the explicit image-model text/thinking-output exclusion, the
G9/G10 boundary literalism, and the parameterized cover/end cancel matrix).** Load-bearing
items the executor must not miss: T-H.5 (LIVE global guard + same-tick cover→end race,
base-red on today's displacement; item-only or render-snapshot-only guard mutations fail),
T-H.6 (BOTH zero-image error shapes), T-H.7 (real remount/reload chain, no `initialStory`
shortcut), T-H.9 (ONE parameterized cover/end cancel matrix at the late-resolve boundary —
do NOT re-derive T-G.1–T-G.13). **Draft criteria kept below as the record:**
- **T-H.1 Count pins.** Cover/end generate request bodies carry `count: 2, modelTier: 'pro'`
  through the production factories. The FOUR named `count: 4` pins are updated as DECLARED
  intended divergence (`taskFactories.test.ts` cover :469-529 / end :530-574;
  `taskFactoriesPG.signal.test.ts` :218/:241 — swept 2026-08-01, the complete set); the
  executor re-sweeps ALL suites before editing (PG sweep rule) and reports any additional
  count-coupled pin as a finding, never a silent edit.
- **T-H.2 Append merge.** Cover/end append: existing options preserved first, new images
  appended in order, nothing discarded, selection index AND selected image identical
  before/after. Base-red at 8ceec7c (the factories have no append input).
- **T-H.3 Replace branch.** Empty-options generate populates options; `!append` clears
  selection per the pattern; the collector path (`collectCoverEndTasks`) behavior is
  equivalent at both ends (empty options ⇒ append irrelevant).
- **T-H.4 UI semantics.** Non-empty cover/end: BOTH regenerate surfaces append with the
  pinned Spanish copy; sheet/scene `ImageSelector` sites render byte-identical output
  (default label); no cover/end replace surface exists — a D7 mutation re-introducing a
  non-append regenerate (either surface) fails.
- **T-H.5 Concurrent-click.** With the provider parked at the external boundary, a same-tick
  double-click on the append control yields EXACTLY ONE recorded dispatch and no run
  displacement; the disabled matrix (running / persisting / refining / approval envelope) is
  pinned for both surfaces. Base-red where today's second click displaces.
- **T-H.6 Persistence/reload.** A real-editor chain: append 2→4 through the production hook
  write (`persistDraftRow` control), reload restores all 4 options + the original selection;
  PB path-shape unchanged. Relevant frozen PFE/PB/PG/PC-UI suites and T-A3.5 stay green.
- **T-H.7 Provider-call accounting.** Per batch: exactly ONE edge invocation (boundary
  invoke-log multiset), body `count: 2` — the cost claim's test form (first-attempt cover+end
  = 4 pro images total, down from 8).
- **T-H.8 Cancel interplay.** Cancel mid-append: result discarded, prior options + selection
  intact, item normalized per PG (no stranding), zero post-cancel dispatches.
- **T-H.9 D7 evidence.** Every new test base-red proven or named-mutation proven, failures
  recorded verbatim; hygiene plantings on the new copy paths; Spanish-only client copy.
- **T-H.10 D6 gates** at the 8ceec7c baselines (re-measured by this PM 2026-08-01, load
  ~2.6): Vitest `npx vitest run --no-file-parallelism` **878 tests / 6 failed = the named
  Mesa six** (flake guidance stands: re-run before calling regression at load ≳40); tsc
  **1041** identity-delta empty both directions; eslint **159** (116e/43w) multiset delta
  empty; node **v22.22.0** (nvm binary — ambient Homebrew Node 26 exists on this machine and
  must not be used; the trap has bitten twice). Head may add tests; same six failures only.
  `supabase/**` diff EMPTY; fixture blob 70204600… and `useCuentacuentosDraft.a3.test.ts`
  untouched. No Playwright surface; no live provider calls.

**Contract coupling: NONE on wire contracts.** `count: 2` is the edge's own default and within
its cap at 10d1190; no envelope, key, storage, or edge change. ~~The factory signature change
is internal and moves atomically with its only consumers (the editor) — PG precedent. Frozen
suites are findings-not-patch-targets, EXCEPT the four T-H.1 declared count pins.~~ **[STRUCK
at spec review [S2], PM-verified — false only-consumer claim owned: the two suites construct
cover/end generate factories SEVEN times — `taskFactories.test.ts` :478/:539 (the
count-pinned blocks), :970/:991 (the parameterized per-kind builder table), :1247 (the
`PERSIST_STALE` cover representative), and `taskFactoriesPG.signal.test.ts` :221/:244
(count-pinned) — so the required `append` + generate-only selection setters force mechanical
signature adaptations at the three non-count sites too. G1/G2 authorize EXACTLY those
mechanical adaptations in those two suites, declared separately from the four count-behavior
divergences (T-H.1); every OTHER frozen suite remains a finding-not-patch-target.]**

**All seven named spec-pass gaps are SETTLED by the review** (final answers Q1–Q7 in the
file): Q1 topology confirmed with G1 (one FE branch off 8ceec7c; no edge branch; 10d1190
read-only; edge need ⇒ STOP+FINDING); Q2 the no-replace consequence confirmed with G3
(Brent's answer removes the destructive cover/end batch regenerate; sheets/scenes keep
their replace+append pair; refine slot-replacement is not a batch surface); Q3 the
`!append` clear confirmed with G2/G4 (production reaches `false` only from empty options;
the factory contract still proves the stale-selection clear on a non-empty case so the
clear is load-bearing); Q4 the additive `regenerateLabel?: string` prop confirmed with G3
(exact default `No me gustan, generar otras opciones`; sheet/scene callsites and output
byte/DOM-equivalent; cover/end pass `Generar 2 opciones adicionales`); Q5 handler-level
YES / runner-level NO, with the G5 correction (live global `pipeline.isBusy()`); Q6 ONE
parameterized cover/end cancel matrix at the strongest new boundary (abort-ignoring
provider, late resolve after cancel) suffices alongside frozen T-G.1–T-G.13 (G8/T-H.9);
Q7 T-H.1–T-H.12 replace the draft set. **(Draft gap list kept below as the record:)**
1. **Q1 Base/topology:** one FE branch `phase/ph-costs` off 8ceec7c; no edge branch; 10d1190
   read-only — confirm or strike.
2. **Q2 The no-replace consequence:** Brent's "regenerate APPENDS" leaves cover/end with no
   destructive regenerate while sheets/scenes keep replace+append. Confirm the asymmetry as
   the recorded product default, or require a preserved replace surface (which would need its
   own Brent word — the recorded answer says append).
3. **Q3 The `!append` clear-selection alignment** (decision 3): pattern conformity vs today's
   index-preserving replace; the reachable-only-from-empty claim — confirm or strike.
4. **Q4 The additive `ImageSelector` label prop** vs another mechanism for per-site copy on a
   shared component (sheet/scene sites must stay byte-stable).
5. **Q5 Concurrent-click guard design:** inline closure guard + handler busy guard — is
   displacement-prevention at the handler level sufficient, or must the runner refuse a
   same-item `runItems` while that item is busy (a runner change PG froze)?
6. **Q6 Cancel-interplay depth:** is T-H.8's single case enough given PG's frozen coverage,
   or does the append path need the full boundary matrix?
7. **Q7 Completeness:** replace/extend T-H.1–T-H.10; verify the four-pin divergence list and
   the cost model's exclusions statement.

**Rollback:** revert the phase branch; no deploy, no merge, no infra (D9).

### Executor round 1 outcome (2026-08-02) — STATUS: FINDINGS, PM-verified — continuation round open
Executor delivered `phase/ph-costs`@**39e1736** (5 commits off 8ceec7c, pushed; production =
EXACTLY the two G1 files, factories +49/−4 + editor +62/−19; 5 new PH suites + shared fixture
module, +1571 test lines; the seven declared construction sites adapted 4-count/3-signature)
and returned an honest **FINDINGS** report: the build meets T-H.1–T-H.9/T-H.11 but the full
serial Vitest is **924/16** — the Mesa six plus TEN failures in five FROZEN suites that G1
forbade it to touch (all five blob-verified byte-identical to 8ceec7c). §1.6 done right.
**PM verification (own hands, two detached worktrees + experiments in a third, node
v22.22.0):** hygiene exact (tip=origin=39e1736; merge-base exactly 8ceec7c; supabase/** 0;
fixture blob + T-A3.5 byte-unchanged; 12 protected refs pinned; `main` moved 7f3600f →
b7b27e9 = the M track merging M2+M3a — merge-base(main, FE/EDGE/PH tips) all STILL exactly
1343513, overlap ∅ vs all three surfaces). Production diff read IN FULL — G2/G3/G4 compliant
(required `append` + generate-only setters with refine rationale documented; live-ref-
before-setter; `!== null`-guarded clear; count 2 pro; four surfaces append:true; additive
`regenerateLabel` with exact default; collector explicit false; G5 guards verbatim in both
handlers; runner untouched). Gates: Vitest **924/16** reproduced with the exact composition;
tsc **1041↔1041** and eslint **159↔159 (116/43)** identity deltas EMPTY both directions
(two known artifacts normalized: embedded-worktree-path in one TS2322 message; root-file
prefix on tailwind.config.ts). Base-red re-run: factory **16/18 red**, concurrency **6/9
red** (both race orders = today's displacement). Mutations re-run: **[A] in its exact strong
form** (item-only guard INCLUDING 'pending') → EXACTLY the 2 cover↔end race cases fail —
[S3] proven live; **[C]** (pre-apply token guard :549 severed) → both cancel cases fail
`[4] vs [2]`, no-re-offer green; reverts pristine (one PM slip caught and redone: a
path-scoped base checkout left base files STAGED, making the first [A] attempt vacuous —
the dirty-state check caught it; full-state restore, re-run clean).
**[PH-F1] CONFIRMED — both mechanisms verified, ONE CORRECTED:**
- **(a) Eight failures = stale copy-HANDLES, verified at the cited lines and reproduced:**
  f4fix :496/:633 + f4fix3 :454/:472 (`/No me gustan, generar otras opciones/i`),
  pfe2 :219 + pfe3 :256 (`/Generar portada|Regenerar/i`), pg.cancel :539 (`/^Regenerar$/`)
  — the copy locates the control, it is never the assertion. PM widened exactly those
  SEVEN lines (the report said "six"; the effective set is seven) → **8 of 10 recover**,
  nothing else changes.
- **(b) pfe2 B2a/B2b — the executor's "settle" remedy did NOT reproduce and is
  SUPERSEDED by a PM-instrumented mechanism:** at click time the G5 guard refuses with
  `busy=true` while BOTH items are already `save-failed` — pfe2's LEGACY supabase mock
  manufactures a run that ~~never closes (its A2 draft-write path fails and leaves a
  worker unsettled), so no wait can fix it~~ **[CORRECTED at r2 (executor), PM-verified
  by experiment 2026-08-03 — the r1-triage over-claim is owned: the run DOES close once
  the failure window ends (both items' writes exhaust their retries); the r1 clicks
  simply landed INSIDE that still-live window. Executor r2's Experiment "(2) alone" —
  invalid payload kept, actionability wait added — runs pfe2 4/4 GREEN, PM-reproduced
  verbatim; "(1) alone" — valid bytes, no wait — leaves B2a/B2b RED, PM-reproduced. The
  wait-for-actionability is the green-maker; the valid-PNG fix removes the manufactured
  write failures (pfe2's old payload `iVBORw0KGgoAAA=` is length-15 base64, rejected at
  `decodeBase64Strict` :101 — PM-verified at source).]** At 8ceec7c the same live-window
  state existed but `runItems` DISPLACED it — B2a/B2b were unknowingly exploiting the
  exact [S3] hazard.
  **Production is CLEAN — proven by a PM probe under the modern pbBoundary harness:** a
  batch whose draft writes fail (both items save-failed, banner up) CLOSES the run;
  `isBusy()` goes false; the next `2 más` click dispatches (invokes 1→2). The remedy is a
  deterministic HARNESS fix in pfe2 (valid bytes + wait for actionability),
  never a bare settle — assertions untouched.
**[B1-PM] — NEW BLOCKING (G5/T-H.5 contract letter):** the four batch surfaces' VISUAL
disabled state is per-item (`isItemBusy(id) || isRefining*`) while the guard is global — so
during a SIBLING's run/persist/refine (reachable: auto-kick's end half still running while
cover is done; any cross-category refine) and during the approval envelope (header only,
pre-existing shape), the control looks enabled but silently no-ops. G5's letter ("quedan
deshabilitados o inaccesibles durante running, persisting, refine y approval") and the
sheets/scenes "2 más" pattern (global `pipeline.isRunning` disabled) both say the visual
state follows the guard. Spend-safety is CLOSED either way (guard verified). Fix in the
continuation; Sol ratifies the reading at r1/2 — if she reads G5 per-item, the stronger
disable is harmless and pattern-consistent.
**G1 SCOPE AMENDMENT (dated 2026-08-02, freeze check renewed, RATIFICATION = Sol's at
r1/2):** the authorized test-adaptation list gains the five frozen suite FILES
(`CuentacuentoEditor.f4fix/.f4fix3/.pfe2/.pfe3/.pg.cancel` tests) for EXACTLY: the seven
enumerated selector-handle widenings (old|new copy, assertions untouched) and the pfe2
harness fix that lets its auto-kick run close (assertions and user gestures untouched;
helper may await genuine idleness once the harness permits it). Any assertion change in a
frozen suite remains STOP+FINDING. Rationale: D6's Vitest gate ("same six failures only")
cannot close the phase over ten known reds, and re-baselining is forbidden by D5/D6.
**Executor assumptions ACCEPTED pending Sol:** (1) the `!== null`-guarded selection clear
(sheets/scenes pattern verbatim; postcondition identical; mutation [G] sensitivity); (2)
header `title` only in the non-empty state. **[PH-F2] → backlog** (pre-existing,
PM-code-verified at 8ceec7c: selecting alone never persists `selected_cover` — the A3/S5
auto-persist list omits selections; only the authoritative envelope/manual saves write it).
**Report-claim notes (recorded without blame):** the "settle → all 4 green" experiment did
not reproduce (superseded above); "six selector widenings" is seven lines; mutation [A]
reproduces exactly in its strong form (incl. 'pending').

### Continuation round outcome (2026-08-02/03) — COMPLETE, PM-verified — Sol phase review r1/2 open
Fresh executor delivered the consolidated round in 3 commits atop 39e1736, tip
**`phase/ph-costs`@9d96c41** (= origin; merge-base with 8ceec7c exact). Production of the
round = `CuentacuentoEditor.tsx` ONLY (+24/−4): **[B1-PM] closed** — both headers now
`isItemBusy(id) || isRefining* || isApproving || pipeline.isRunning`; ImageSelector gains
ONE additive `regenerateDisabled?: boolean` (default false) OR'd into the regenerate
button only (the shared `disabled` prop untouched — it also gates selection; sheet/scene
callsites pass nothing and stay DOM-identical); cover/end pass their pre-filter; the
imperative guards verbatim. Frozen-suite edits exactly the amendment's list: the SEVEN
widenings (old|new copy only) + pfe2's THREE hunks (valid 1×1 PNG replacing the
invalid-base64 payload; the widened handle; `renderAtCoverStep` waits for the control to
be ACTIONABLE, not merely present). Zero assertion/gesture changes in the five files
(PM-diffed hunk by hunk). +3 matrix tests (sibling-window ×2, parked-approval ×1) with
honest aggregate assertions and the declared base-green note (the selector buttons under
approval were already gated by F4's `disabled={isApproving}` — only the headers lied).
**PM verification (own hands, 2026-08-03, two detached worktrees, node v22.22.0, removed
after):** hygiene exact (12 protected refs pinned; main unmoved at b7b27e9 since the M2+M3a
merge, mb still 1343513; supabase/** 0; blobs byte-identical); full diff read; base-red of
the new matrix cases at 39e1736 → **3 failed / 9 passed** with the executor's exact
failure shapes; Experiments A/B (the 2b two-part pricing) reproduced verbatim (A: invalid
payload + wait ⇒ 4/4 green — the run-closure correction PROVEN; B: valid bytes, no wait ⇒
B2a/B2b red); the invalid-base64 diagnosis verified at source AND by strict decode
(len 15, mod 4 = 3). Gates: full serial Vitest **927 tests / 6 failed = the named Mesa
six ONLY**; tsc **1041↔1041** and eslint **159↔159 (116/43)** identity deltas EMPTY both
directions vs the 8ceec7c baselines (same normalization method as r1). r1's T-H evidence
unregressed (factories untouched this round). Executor deviation (neutral story ids after
a self-caught panel-regex collision) and assumption ([B1-PM] scope = the four BATCH
surfaces; retry-save/upload buttons keep their per-item shape — G5 does not name them)
both ACCEPTED pending Sol. **The phase is clean in the PM's judgment — Sol phase review
round 1/2 of the §1.5 cap opened** (gate 3; target 9d96c41; FAIL ⇒ ONE consolidated
remediation → her FINAL 2/2 ⇒ Brent per gate 5).

### Review round 1 outcome (2026-08-03) — FAIL — consolidated [B1] remediation open
Sol's round 1/2 (`reviews/PH-review-1.md`, read IN FULL per gate 7): **FAIL — 1 BLOCKING
[B1]**; everything else MET (G1–G5, G7–G8, G10; T-H.1–T-H.6, T-H.8–T-H.10, T-H.12) and
every referred item RATIFIED — the dated G1 scope amendment (held exactly), [B1-PM]'s
global G5 reading, both r1 assumptions, the r2 batch-surfaces scope, the [PH-F1] record
with its corrected mechanism (her own two-part pfe2 experiment + her own save-failed
boundary probe), and the cost model (token-exact arithmetic). Gates concurred (878/6 →
927/6 Mesa-six; tsc/eslint identity deltas empty both directions). ALL BINDING, closed to
relitigation.
- **[B1]** Append omits the preserved selection from the GENERATED persistence snapshot:
  both generate factories return `{coverOptions}`/`{endOptions}` only (:500-520/:578-591
  at 9d96c41), so the queue merges the selection from the pre-append snapshot — still
  `null` — and a real unmount/recovery restores all four options with NOTHING selected.
  Her probe: adding the missing post-recovery assertion to the committed T-H.7 fails
  `Expected: 1 / Received: -1`; carrying the live selection in each generate patch makes
  it pass. **PM REPRODUCED BOTH HALVES with own hands at 9d96c41** (strengthened
  `selectedIndex()` assertion → `expected -1 to be 1`; her fix direction on the two
  GENERATE returns only → same assertion GREEN; reverts pristine). G6/T-H.7's frozen
  wording ("options + la selección original válida"; "misma selección/imagen elegida")
  governs. AGREED.
- **The PH-F2 boundary ruling — a PM error owned:** she RATIFIES the fact (selecting
  alone still doesn't persist; stays backlog) but STRIKES its use as a waiver — the
  select→append→generated-snapshot sequence is in-phase, and the PM's r1 acceptance of
  T-H.7's re-scoped docstring let a frozen G6 requirement soften (the PB-F7 class:
  fourth overturned PM-softening call). The committed T-H.7's positional assertion could
  not fail when selection wiring was severed — the D7 "an assertion that cannot fail"
  rule, missed by PM verification too.
- **CONTRACT-COUPLED: NO** (PM-verified: `DraftPatch` is `Partial<CuentacuentosDraftFull>`
  and `mergePatch` merges by key presence — the selection keys already flow; no hook,
  runner, wire, or edge change).
**Remediation:** ONE consolidated round, fresh executor, atop 9d96c41 — the FILE's
five-item scope verbatim (patch carries live selection: append = existing valid value,
replace = null, ref-before-setter preserved; factory matrix asserts the FULL enqueued
patch both branches; T-H.7 strengthened to assert the same option SELECTED after real
recovery — never the positional substitute; a named selection-wiring severing mutation;
focused + retained suites + all D6 gates). Forbidden: hook, runner, edge, Storage, wire,
collector, refines, lifecycle, approval, manual flows, sheets/scenes, cost model, and the
ratified frozen-suite repairs. This is §1.5 executor round 3 of 3. Then PM verification →
**Sol round 2/2 — FINAL; a second FAIL goes to Brent (gate 5).**

### [B1] remediation outcome (2026-08-03) — landed @ccb34f7, PM-verified — Sol FINAL 2/2 open
Fresh executor delivered all five [B1] items in 3 commits atop 9d96c41, tip
**`phase/ph-costs`@ccb34f7** (= origin). Round diff 4 files +141/−23; **production =
`taskFactories.ts` ONLY (+11/−2)** — both GENERATE `computePatch` returns now carry
`selectedCover`/`selectedEnd` read from the live ref AFTER the guarded clear (append ⇒
the surviving valid selection; replace ⇒ `null`), ref-before-setter ordering untouched,
and the refine factories' identical-looking returns deliberately left bare (that boundary
is now itself pinned). Factory matrix 18 → 22 cases asserting the FULL patch with
`toEqual` on both branches plus a block that drives production `persist` and asserts what
the QUEUE receives. T-H.7 strengthened at both layers — the written row's `selected_cover`
AND `selectedIndex()` on the recovered screen — with a docstring that names the D7 defect
the positional-only assertion had.
**PM verification (own hands, detached worktree at ccb34f7, node v22.22.0, removed
after):** hygiene exact (tip=origin; merge-base 8ceec7c; round production = the one file;
supabase/** 0; fixture blob + a3 blob byte-identical; 12 protected refs pinned; `main`
moved b7b27e9 → **f5cfc7d** on the M track, merge-base(main, PH tip) STILL exactly
1343513 and its 9 new files overlap NEITHER lineage nor PH). Production diff read in full
and correct. **Base-red at 9d96c41 with the new tests: 11 failed** — the ten
selection-bearing matrix cases plus T-H.7 (`expected { coverOptions: […] } to deeply equal
{ …(2) }`; the persist chain red). **Own mutation [M2-PM] (refs captured BEFORE the
guarded clear) → EXACTLY the 4 replace cases fail, 18 pass** — the read ORDER is
load-bearing and pinned, not merely the key's presence. Gates: full serial Vitest
**931 tests / 6 failed = the named Mesa six ONLY**; tsc **1041↔1041** (458 distinct
identities each side) and eslint **159↔159 (116/43)** identity deltas EMPTY both
directions. **Own contract check Sol did not name:** `categoriesFromPatch` keys ONLY on
`coverOptions`/`endOptions` (hook :307-324), so the new key triggers no upload category,
and `selectedCover`/`selectedEnd` are first-class `CuentacuentosDraftFull` fields already
persisted to `selected_cover`/`selected_end` (:39-40, :1181-1182) — the fix rides the
existing contract with zero hook change, confirming CONTRACT-COUPLED: NO.
**Executor deviation, ACCEPTED and referred to Sol:** two `toEqual` patch pins in
`taskFactories.test.ts`'s two GENERATE blocks required `selectedCover/selectedEnd: null`
— mechanically forced by an authorized production change, minimal, and inside the two
blocks already declared divergent at T-H.1/[S2], but a THIRD divergence class in that
file (patch-shape, beyond count and signature). Raised rather than smuggled; Sol's own
remediation text authorizes "the minimal factory patch assertions", so the PM reads it as
in-scope — ratification is hers.
**Review-file correction (PM-verified, non-blocking):** `PH-review-1.md` quotes the a3
blob as `d458e413b62ea2f5fc21790879c6007ea7dbfdcb`; that string is NOT an object in this
repo. The real blob is `d458e4139eab89934c46ffd348963ae05dfc990a`, identical at 8ceec7c,
39e1736, 9d96c41 and ccb34f7. Transcription artifact in the review text; the substantive
invariant (byte-unchanged base↔head) is verified directly and holds.
**The [B1] remediation is complete in the PM's judgment — Sol FINAL round 2/2 opened**
(gate 3: judges the remediation matrix + permitted related residue, not a fresh uncapped
round). A FAIL goes to Brent per gate 5.

## Phase PREL — integration + release
Brent's authority end to end (D9). PREL begins only after every required phase and the `PC-UI`
disposition is recorded.
**Frozen ancestry fact (2026-07-29, PM-verified):** `cc-downscale-a`@185c370 contains
`fase-a-complete`@0e1d53b; `pf-fix-7d32182`@c496490 does not. Both descend from
`cc-cleanup`@2e9eeae (which contains live P0 `1343513`), neither contains the other, and their
current unique diffs touch no common paths.
**Lineage tips updated 2026-07-31 (PB close):** the two final reviewed tips are now
`phase/pb-storage-fe`@5f7b6bd (⊃ c79ea87 ⊃ 9beccdb ⊃ 185c370 ⊃ 0e1d53b) and
`phase/pb-storage-edge`@10d1190 (⊃ db42745 ⊃ 96cb2cc ⊃ c496490 ⊃ 7d32182). PREL
sequencing per gate 5 of this section: the edge deploy (allowlist) precedes the frontend
release that re-opens finalized cuentos against it.
**Lineage tips updated 2026-07-31 (PG close):** the frontend final reviewed tip advances
to **`pg-fix-d3fbd58`@1b0cfed** (⊃ `phase/pg-cancellation`@d3fbd58 ⊃ 5f7b6bd ⊃ the PB-FE
chain above). The edge tip is unchanged at 10d1190. Both `phase/pg-cancellation`@d3fbd58
and `pg-fix-d3fbd58`@1b0cfed join the protected working set until PREL.
**Lineage tips updated 2026-08-01 (PC-UI close):** the frontend final reviewed tip
advances to **`phase/pcui-warnings`@8ceec7c** (⊃ 1b0cfed ⊃ the PG/PB-FE chain above; also
at `origin/phase/pcui-warnings`). The edge tip is unchanged at 10d1190.
`phase/pcui-warnings`@8ceec7c joins the protected working set until PREL. FE gate
evidence at the new tip: Vitest serial 878/6 (the named Mesa six), tsc 1041
identity-delta empty, eslint 159, node v22.22.0 (PM + reviewer independently measured,
2026-08-01).

**Lineage tips updated 2026-08-03 (PH close — FINAL for the build program):** the frontend
final reviewed tip advances to **`phase/ph-costs`@ccb34f7** (⊃ 9d96c41 ⊃ 39e1736 ⊃
`phase/pcui-warnings`@8ceec7c ⊃ the PC-UI/PG/PB-FE chain above; also at
`origin/phase/ph-costs`). The edge tip is unchanged at **10d1190**.
`phase/ph-costs`@ccb34f7 joins the protected working set until PREL. FE gate evidence at
the new tip: Vitest serial **931/6** (the named Mesa six), tsc **1041** identity-delta
empty both directions, eslint **159** (116e/43w), node v22.22.0 (PM + reviewer
independently measured, 2026-08-03). **ALL BUILD PHASES ARE NOW CLOSED — PREL has no
remaining phase dependency and begins on Brent's word alone.**
**Integration surface re-verified 2026-08-03 (PM, own commands):** `main` = `origin/main`
= **f5cfc7d** (the M track has since merged M1+M2+M3a; M3b in flight on
`fix/child-race-mat`). merge-base(main, FE tip) = merge-base(main, EDGE tip) = **exactly
1343513**, unchanged through every M merge. Main's post-P0 surface is now 21 commits /
27 files; changed-path overlap with the FE lineage remains **ZERO** and with the EDGE
lineage remains **exactly one file** (`supabase/functions/generate-story/handler.ts` — the
semantic merge rule below is unchanged). `fix/story-trunc` is still **unmerged at dfdccf0**
(unchanged since 2026-07-31); its disposition remains Brent's at PREL.

**PREL INPUT RECORD — BOOTSTRAP RE-VERIFICATION 2026-08-03 (incoming PM, own commands, in
disposable detached worktrees removed after; shared checkout untouched on `feat/mat-wire`
with its ambient ` M .gitignore`; `jb list` shows no active casa-web Bridge work):**
- **CONFIRMED, nothing changed.** 16 refs at their pinned SHAs. Full FE chain ×10
  (ccb34f7 ⊃ 9d96c41 ⊃ 39e1736 ⊃ 8ceec7c ⊃ 1b0cfed ⊃ d3fbd58 ⊃ 5f7b6bd ⊃ c79ea87 ⊃
  9beccdb ⊃ 185c370 ⊃ 0e1d53b), full EDGE chain ×4 (10d1190 ⊃ db42745 ⊃ 96cb2cc ⊃
  c496490 ⊃ 7d32182), both ⊃ 2e9eeae ⊃ 1343513, and the three negatives (neither tip
  contains the other; 0e1d53b ∉ the edge tip). `main` = `origin/main` = **f5cfc7d**,
  UNMOVED since the PH close. merge-base(main, each tip) = **exactly 1343513**;
  merge-base(FE, EDGE) = 2e9eeae. Main's post-P0 surface = 21 commits / 27 files; overlap
  with the FE lineage **ZERO**, with the EDGE lineage **exactly**
  `supabase/functions/generate-story/handler.ts`. Blobs exact: 70204600… (FE fixture),
  91ec703… + b73fa3c… (edge corpora), d458e4139e… (a3 suite). Gates re-run at both tips
  (load ~5–7): FE @ccb34f7 — Vitest serial **931 tests / 6 failed = the named Mesa six**
  (one clean run, single failing FILE), tsc **1041**, eslint **159 (116e/43w)**, node
  **v22.22.0**; EDGE @10d1190 — deno test **325/0**, lint **94**, check **46**, deno
  **2.7.11**. `fix/story-trunc` still unmerged at dfdccf0.
- **[NEW — item 3, cross-lineage conflict surface PROVEN EMPTY]** FE-unique ∩ EDGE-unique
  (both diffed from 2e9eeae) = **∅**; the FE lineage touches **no `supabase/**` path at
  all** (80 files, zero under `supabase/`). The EDGE lineage is 22 files, all under
  `supabase/functions/`. Therefore the WHOLE integration has exactly ONE conflict file and
  it is **main × EDGE**, never FE × EDGE — the two tips merge into an integration branch
  without touching each other.
- **[NEW — integration RISK, needs Brent's decision] The EDGE lineage has no remote copy.**
  Tested against every `refs/remotes/origin/*`: `phase/pb-storage-edge`@10d1190 and every
  ancestor down to frozen `fase-f`@7d32182 (db42745, 96cb2cc, c496490) are **NOT REACHABLE
  from any origin ref**; only `cc-cleanup`@2e9eeae and below are pushed. By contrast the
  entire FE lineage is reachable from `origin/phase/ph-costs` (ccb34f7) — every FE SHA
  including 0e1d53b resolves through `origin/phase/pcui-warnings`. So **four closed,
  reviewed phases (PF + PC + PD + PB-EDGE) exist on exactly one disk.** Pushing
  `phase/pb-storage-edge` is a branch-ref push — it does not deploy and is not the `main`
  push D9 governs — but it is still a separately authorized act and therefore Brent's word,
  not the PM's. Recorded, not executed.
- **[NEW — sharpens the `fix/story-trunc` disposition, item 3]** Its tip dfdccf0 is TWO
  commits off d79d329 (91ae82e + dfdccf0), touching `generate-story/handler.ts` +
  `handler_test.ts`. Read in full, it makes three changes and the EDGE lineage already
  answers each: (a) `max_tokens` 8192 → **16000** — the EDGE tip already carries **16384**;
  (b) a `stop_reason === 'max_tokens'` throw with Spanish copy — PD already types exactly
  that as **502 `PROVIDER_OUTPUT_INVALID`** (edge tip :1792); (c) it adds
  **`await response.text()` verbatim into two research-error `console.error` calls** — the
  raw-provider-body-into-logs class PF **[B3]** closed; the EDGE tip routes provider error
  bodies through `bodyShape()` before logging (:1736-1737), and PC's rewrite means the two
  sites it patches no longer exist there at all. So all three changes are superseded and
  one is **actively contrary to a reviewed hygiene invariant**. The disposition stays
  Brent's; the record now names what the "carry it forward" option would cost.
- **[CORRECTION — stale line above, labeled]** "M3b in flight on `fix/child-race-mat`" is
  no longer true: `fix/child-race-mat`@318a75e ⊂ `main`@f5cfc7d with **zero** commits
  ahead. The M track is fully landed (M1+M2+M3a+M3b), `main` has not moved since the PH
  close, and no M work is known to be pending against it. The standing re-verify-at-PREL
  instruction still binds — main can move again at any time.

**PREL INPUT RECORD (compiled 2026-07-31 — item 1 PREPARATION, not execution; every fact
below re-verified that day by the compiling PM with own commands, in disposable detached
worktrees only; FE-tip facts REFRESHED 2026-08-01 at the PC-UI close, labeled):**
- **Final reviewed tips + parentage (item 1).** Merge ONLY these two tips:
  - FE: **`phase/ph-costs`@ccb34f7** [REFRESHED 2026-08-03 — PH close advances the tip;
    the FINAL FE tip of the build program] ⊃ `9d96c41` ⊃ `39e1736` ⊃
    `phase/pcui-warnings`@8ceec7c ⊃ `pg-fix-d3fbd58`@1b0cfed ⊃ `phase/pg-cancellation`@d3fbd58 ⊃
    `phase/pb-storage-fe`@5f7b6bd ⊃ c79ea87 ⊃ 9beccdb ⊃ `cc-downscale-a`@185c370 ⊃
    `fase-a-complete`@0e1d53b (PA + PFE + PB-FE + PG + PC-UI).
  - EDGE: `phase/pb-storage-edge`@**10d1190** ⊃ `phase/pd-contract`@db42745 ⊃
    `phase/pc-research`@96cb2cc ⊃ `pf-fix-7d32182`@c496490 ⊃ frozen `fase-f`@7d32182
    (PF + PC + PD + PB-EDGE).
  - Both ⊃ `cc-cleanup`@2e9eeae ⊃ live P0 `1343513`; neither tip contains the other;
    `main` = `origin/main` @ **7f3600f** [REFRESHED same day: the parallel M track merged
    M1 (d79d329 → 7f3600f, ref-only ff, pushed) and executed M-REL1 while this record was
    being compiled — see those ledger entries; merge-bases and overlap conclusions below
    re-verified at 7f3600f]. Main keeps moving on the M cadence (M2 opened off 7f3600f);
    item 2 takes THEN-CURRENT `origin/main` and re-verifies overlap at PREL start.
- **Gate evidence at the tips (re-measured 2026-07-31, machine load ~22):** FE @1b0cfed —
  Vitest serial (`--no-file-parallelism`) **824 tests / 6 failed = the named Mesa six**
  (one clean run), tsc **1041** (identity baseline), eslint **159** (116e/43w), node
  v22.22.0, fixture blob 70204600… intact. EDGE @10d1190 — deno test **325/0**, lint
  **94**, check **46**, deno 2.7.11, corpus blobs 91ec703… / b73fa3c… intact.
- **Integration surface vs current main (verified 2026-07-31, re-verified at 7f3600f
  after the M1 merge):** merge-base(main, FE tip) = merge-base(main, EDGE tip) =
  **exactly 1343513**. Main carries 10 post-P0 commits (18 files: 4 auth-hardening
  commits, model-alias pinning, PDF-reflexion model migration, docs/lint config, plus
  M1's 3 commits on children EFs). Changed-path overlap with the FE lineage: **ZERO**.
  With the EDGE lineage: **exactly ONE file —
  `supabase/functions/generate-story/handler.ts`**.
  Main d79d329 pinned `MODEL` to the bare alias `claude-opus-5` (its comment: a
  date-suffixed ID silently 404s the day it retires — the process-reflexion-pdf outage
  class) and added `thinking:{type:"disabled"}` + max_tokens 4096→8192 (Opus 5 thinks by
  default into the same cap). The EDGE tip still carries dated
  `claude-opus-4-5-20251101`, max_tokens 16384, and no thinking knob. **Semantic merge
  rule (item 3):** the integrated handler must carry main's fix INTENT — bare alias +
  a thinking-budget guard — into the PD-rewritten handler; PD's typed
  `max_tokens` → 502 `PROVIDER_OUTPUT_INVALID` (edge tip :1792) already covers
  truncation surfacing. The integrated model/knob choice (8192 vs 16384; disabled vs
  budgeted thinking) is a PREL decision to record, never a silent pick.
- **Ambient branch on the conflict file (disposition = Brent's at PREL):**
  `fix/story-trunc` (2026-07-31, off d79d329, unmerged; produced by an interactive
  session outside this plan — see the M1 ledger entries; first observed @91ae82e, already
  advanced to dfdccf0 the same day and STILL ACTIVE — re-read its tip at PREL) touches
  `generate-story/handler.ts` + `handler_test.ts`, surfacing max_tokens truncation as a
  typed error instead of a parse error — the symptom PD already types as 502 MAX_TOKENS.
  If it merges to main before PREL, item 2's "prove current-main fixes remain present"
  applies to it too; if it is abandoned in favor of PD's contract, record that
  disposition. **[REFRESHED 2026-08-03 by the bootstrap re-verification block above: tip
  still dfdccf0, unmerged, TWO commits; its three changes read in full — all superseded by
  the EDGE lineage, and one (`await response.text()` into research-error logs) actively
  contrary to PF [B3]'s hygiene invariant.]**
- **Ordered infra/deploy prerequisites (item 5, consolidated from PC/PB):** (1) NO
  bucket/RLS DDL prerequisite exists for either half (PB-verified: hash paths satisfy the
  live drafts own-folder INSERT policy; liturgia-images writes stay admin-only). (2)
  `GEMINI_RESEARCH_MODEL` env set — or the `gemini-3.5-flash` default explicitly
  accepted — before the edge deploy (PC). (3) Separately authorized edge-function deploys
  (both paid functions; they carry the D3 liturgia-images allowlist change — **Brent's
  veto DECLINED 2026-07-31, the change ships as reviewed**) precede the frontend release
  that re-opens finalized cuentos against the widened allowlist (PB). Edge deploys run from casa-web with
  Supabase CLI ≥2.110 (deno.lock v5). (4) The RLS-hardening option (drop the drafts
  own-folder UPDATE policy) is POST-frontend-release only — live main still has 5
  `upsert:true` sites (backlog; Brent's infra decision).
- **Open release prerequisites (origins) [RESOLVED by Brent 2026-07-31; updated
  2026-08-01; FINAL update 2026-08-03]:** `PC-UI` — disposition BUILD → **phase CLOSED
  2026-08-01 at 8ceec7c** (PFE-F3 closed with it). `PH` — **CLOSED 2026-08-03 at
  ccb34f7**; **PREL now waits on NOTHING but Brent's start word.**
- **NEW release-visible product changes PREL must carry into its release notes / canary
  (from PH, 2026-08-03):** cover and end now generate **2 options per batch, not 4**;
  their regenerate control **APPENDS** (`2 más`) and there is **no destructive cover/end
  batch-regenerate surface** any more; a cover/end batch is refused while any run, refine,
  or approval envelope is live (and the controls now look disabled accordingly). First
  attempt saves ≈US$0.54; each append costs ≈US$0.27. No cost UI, cap, or warning exists
  by design (Brent: no hard ceiling). `PD-REFINE` — **explicitly
  deferred post-release**; the release ships with strict-output on initial
  `generate-story` only (PD spec review G6; Brent's recorded decision). Standing
  product deviation, Brent-flagged: NO all-failed banner (PC-UI G6) — a future banner
  requires a separately reviewed additive edge contract.
- **Parallel M track:** M1 MERGED to main (7f3600f) and M-REL1 EXECUTED the same day
  (children EFs deployed v9/v12, verify_jwt true, smoke green — its ledger entries are
  the record); zero path overlap with both lineages re-verified at 7f3600f (M1's files
  intersect neither lineage's changed-file set). M2+ continue off main, so main keeps
  moving without adding conflict surface; re-verify overlap when PREL starts (standing
  instruction). **[REFRESHED 2026-08-03: the M track is FULLY LANDED — M1+M2+M3a+M3b all
  merged; `fix/child-race-mat`@318a75e ⊂ main@f5cfc7d with ZERO commits ahead; overlap
  re-verified at f5cfc7d (FE zero / EDGE one file). The standing instruction still binds —
  main can move again at any time.]**
- **Docs:** PLAN/LEDGER/reviews are still unversioned (META's recorded cost); item 7
  moves or snapshots them into the released repo. **[2026-08-03: this is now the ONLY copy
  of the record for a build program whose EDGE half also has no remote copy — see the
  EDGE-lineage reachability risk in the bootstrap re-verification block above. Item 7's
  cost is higher than "tidiness" until both are addressed.]**

### PREL EXECUTION — items 1–4 COMPLETE 2026-08-03 (Brent's start word given; branch NOT pushed)
Brent answered the four standing items in order: **(1) go on the release; (2) abandon
`fix/story-trunc`; (3) no all-failed banner needed yet — the G6 deviation stands accepted,
veto CLOSED; (4) back the edge lineage up to GitHub.**
- **Item 4 (his answer) EXECUTED FIRST:** `phase/pb-storage-edge`@10d1190 pushed to origin
  (branch ref only — no deploy, not the `main` push D9 governs). The 32 previously
  local-only commits (PF+PC+PD+PB-EDGE down to frozen `fase-f`@7d32182) are now reachable
  from `origin/phase/pb-storage-edge`; `git rev-list --count phase/pb-storage-edge
  --not --remotes=origin` = **0**. Local refs, `main`, and the shared checkout untouched.
- **Item 1 (tips/parentage):** recorded above and re-verified this session.
- **Item 2 (integration branch):** `prel/integration` created from then-current
  `origin/main`@**f5cfc7d**, in a disposable worktree. Explicit `--no-ff` merges, no squash.
  **LOCAL ONLY — never pushed.**
- **[NEW — item 3, MERGE ORDER IS LOAD-BEARING; not previously recorded]** Merging the FE
  tip FIRST produces a **modify/delete** conflict on
  `supabase/functions/generate-story/handler.ts`: `cc-cleanup`@2e9eeae deliberately removed
  F0's `handler.ts` for the two cuentacuentos functions and inlined the auth guard into a
  monolithic `index.ts` ("deferred to F/C/D" — its own merge message), FASE F later
  re-extracted it, and `main` meanwhile modified F0's copy. Accepting that deletion would
  silently drop the re-split handler that ALL of PF/PC/PD/PB-EDGE builds on. **Merging EDGE
  FIRST makes the FE merge's base 2e9eeae, where the FE lineage's `supabase/**` diff is
  empty — the FE merge is then CLEAN, zero conflicts.** The recorded "exactly one conflict
  file" holds only in that order. Confirmed by measurement:
  (1343513..2e9eeae) ∩ (1343513..main) = **exactly that one file**.
- **Item 3 (conflict resolved BY CONTRACT, not ours/theirs)** — merge `79b7c0a`, two hunks:
  - *Declarations:* kept the edge `HandlerDeps`; folded main's duplicate `const MODEL` onto
    this file's single live declaration; dropped `GEMINI_MODEL` as dead code (PC replaced it
    with the injected `researchModel`; zero references remain).
  - *~156-line hunk:* took the edge side (empty). git had parked main's legacy Anthropic
    call + text/`JSON.parse` fallback INSIDE the edge's `previewPromptOnly` branch by
    textual similarity; PD deletes that path by design (`stop_reason`/`tool_use` is the only
    success path). This also drops main's raw `jsonText.slice(0,500)` log lines, which PF
    **[B3]**'s hygiene invariant forbids.
  - **main's post-P0 fixes CARRIED IN FULL** (its complete diff to this file is ONE commit,
    d79d329, two hunks): the bare alias `claude-opus-5`, and
    `thinking: { type: 'disabled' }`. The resolved file is otherwise **byte-identical to the
    reviewed edge tip**.
  - **RECORDED PREL DECISION (Brent, 2026-08-03): `max_tokens` stays at the reviewed
    **16384**, not main's 8192.** A 15-scene story measures ~4.8k output tokens (≈3.4×
    headroom vs 1.7×); billing is per token generated, not per ceiling; and PD surfaces a
    `max_tokens` stop_reason as a typed 502 rather than a silent truncation. Thinking stays
    **disabled** per main's guard; enabling it would share this cap and is unmeasured.
- **[NEW — a current-main fix the record did not name] `main`@d79d329 also added an ESLint
  `no-restricted-syntax` rule banning date-suffixed Claude model IDs under
  `supabase/functions/**`.** The edge lineage predates it and carried two dated literals
  (`_shared/corpusRunner.ts`, `generate-story/handler_contract_test.ts`) that FAIL that rule
  once integrated — i.e. the naive integration ships a regression of main's own guard, which
  item 2 forbids. Both are inert stub echoes in a fake provider response; verified before
  touching that the read-only corpus baseline contains **no `claude-` string at all** (zero
  parity exposure), nothing reads `.model` from the stub, and the contract test's assertion
  reads production's own `MODEL`. Fixed in commit `98dfdf7`.
- **Declared divergence:** `handler_contract_test.ts`'s envelope case asserted the old dated
  constant, which the handler echoes as `r.body.model`. Value-only update; the envelope
  SHAPE it guards is unchanged. (The suite caught this itself — a PM claim that "nothing
  pins the sent model" was wrong and the gate corrected it.)
- **Item 4 (combined gates on the integrated tree, all re-run by the PM):**
  Node v22.22.0 — Vitest serial **1042 tests / 6 failed = the named Mesa six ONLY** (one
  failing FILE; 931 FE + main's M-track suites); tsc **1041**, identical to the FE baseline;
  ESLint **160**, with EVERY `supabase/` identity inherited from the edge tip when linted
  like-for-like under the integrated config — **zero genuinely new** (the ±delta vs the FE
  tip's 159 is the `index.ts`→`handler.ts` split relocation plus edge-only `corpusCapture.ts`).
  Deno 2.7.11 — test **409/0** (325 edge + main's M-track functions), lint **94**, check
  **46**. PF corpus consistency GREEN with `corpus_baseline.json` blob **91ec703… unchanged**;
  auth-before-body regressions (OPTIONS/401/403/503) green inside the 409.
  `handler.ts` remains fmt-dirty exactly as it is at base (PB-EDGE F1, ratified measured
  substitute); the added lines follow the file's single-quote idiom — a measured **+20**
  fmt-diff lines on an already 2056-line-dirty file, recorded rather than hidden.
- **STILL OPEN, each separately authorized (D9):** item 4's supervised synthetic smoke;
  item 5 (`GEMINI_RESEARCH_MODEL` env, then the two edge deploys, then the frontend
  release); item 6 (rollback instructions + explicit authorization per merge/deploy/push);
  item 7 (snapshot this record into the repo). **Nothing has been pushed or deployed.**
- **`fix/story-trunc` DISPOSITION RECORDED (Brent, 2026-08-03): ABANDONED** in favour of
  PD's contract. It stays unmerged at dfdccf0; the branch is not deleted. Rationale on
  file: all three of its changes are superseded by the edge lineage (16000 vs the tip's
  16384; a max_tokens throw PD types as 502; and `await response.text()` into two
  research-error logs, which regresses PF [B3]).

### PREL item 6 — ROLLBACK / FORWARD-FIX (written 2026-08-03, BEFORE any deploy or push)
Release order confirmed by Brent 2026-08-03: **edge functions first, then `main`.**
`GEMINI_RESEARCH_MODEL`: **default `gemini-3.5-flash` explicitly ACCEPTED** (Brent) — it is
the model PC was built, canary-measured ([PC7]) and reviewed against. Recorded as his
decision, so an unset variable is the tested path, not an oversight.
- **Frontend rollback** — a `main` push is the production release (Vercel). Rollback =
  redeploy the previous production deployment from the Vercel dashboard, or
  `git revert -m 1 <merge-sha>` and push. `main`'s pre-release SHA is **f5cfc7d** — recorded
  here so the rollback target survives this document.
- **Edge rollback** — each function is independently versioned and redeployable. Pre-release
  live versions, captured from the Supabase API 2026-08-03 **before** any deploy:
  `generate-story` = **v17**, `generate-scene-images` = **v33** (both `verify_jwt: true`).
  Rollback = redeploy those functions from a checkout of `main`@f5cfc7d, which is the exact
  source those versions were built from. `verify_jwt` stays `true` — it is pinned in the
  tracked `supabase/config.toml`, not passed on the command line, so a redeploy cannot
  silently drop the P0 guard.
- **NEVER restore the prohibited insecure v32** (PREL item 6, standing): no rollback path
  goes back past P0 `1343513`. Both rollback targets above are strictly post-P0.
- **No database, bucket, or RLS change ships with this release** — PB verified zero DDL
  prerequisite, so there is no data migration to reverse. The RLS-hardening option stays
  POST-release and is a separate Brent decision.
- **Ordering risk if the edge deploy fails mid-way:** the two functions share
  `_shared/imageFetch.ts`. Both are currently on the OLD code, so a partial deploy leaves a
  mixed pair. If the second deploy fails, either complete it or roll the first back to its
  captured version above before pushing `main`.

### PREL item 5 — RELEASED 2026-08-03. `main` = 98dfdf7. THE OVERHAUL IS LIVE.
The `supabase functions deploy` calls were refused by this PM session's permission
classifier and were NOT routed around via the MCP write path (memory records MCP writes as
denied here and the CLI as the approved path; channel-shopping a production deploy would
defeat the intent of the block). **Brent ran both deploys himself**; the PM verified each
against the Supabase API and the deployed bundles.
- **Edge deploys (Brent, verified by PM):** `generate-story` **v17 → v18**
  (`ezbr_sha256` d057356a… → dbee0feb…), `generate-scene-images` **v33 → v34**
  (3b4d40c3… → 6e5402d1…). Both `verify_jwt: true` preserved.
  **CLI TRAP RECORDED:** the deploy prints `No change found in Function: <slug>` even on a
  successful deploy — it is MISLEADING. The version bump and the `ezbr_sha256` change are
  the real evidence; do not trust that message. It also warns that `import_map` via
  config.toml is deprecated in favour of `deno.json` — cosmetic here (imports resolved; the
  `_shared` modules are in both bundles), but it is a real deprecation → backlog.
- **Deployed-bundle verification (PM, by content, not by version number alone):**
  `generate-story` v18 carries `emit_story` + `PROVIDER_OUTPUT_INVALID` (PD),
  `researchModel` + `thinkingLevel` (PC), `skippedImages` + `PROP_NOT_RECURRING`,
  `liturgia-images` (PB-EDGE), the live `const MODEL = 'claude-opus-5'` with
  `thinking: { type: 'disabled' }` and `max_tokens: 16384` exactly as decided — and the
  legacy parse path is GONE (`Respuesta cruda` / `No se encontró JSON válido` = 0 hits).
  The one remaining dated ID is inside the explanatory comment only.
  `generate-scene-images` v34 carries `FORBIDDEN_BUCKET`, `safeMode`/`desconocido` (PF
  hygiene), `modelTier`, and the deployed allowlist is EXACTLY the reviewed set —
  `public/cuentacuentos-drafts/`, `sign/cuentacuentos-drafts/`,
  `public/liturgia-images/` — with **`sign/liturgia-images` correctly ABSENT** per the PB
  spec's explicit requirement.
- **Supervised synthetic smoke (item 4's remaining half), run live against production:**
  both functions return **OPTIONS 200 with CORS before auth** and refuse an unauthenticated
  POST with **401 `UNAUTHORIZED_NO_AUTH_HEADER`** — the D1 fail-closed contract confirmed in
  production. (A credentialed end-to-end story generation is Brent's to exercise in the app;
  the PM does not hold user credentials and did not attempt one.)
- **`main` push (PM, on Brent's explicit instruction):** pre-merge checks all passed —
  approved SHA unchanged at 98dfdf7, `origin/main` still f5cfc7d (had not moved), clean
  fast-forward of 150 commits, `main` checked out in zero worktrees, no Bridge activity,
  shared checkout untouched on `feat/mat-wire`. Pushed `prel/integration:main`,
  **f5cfc7d → 98dfdf7**, 117 files / +62368 / −7303. Fast-forward, no merge commit.
  All protected refs verified intact after the push.
- **Item 7 — DONE 2026-08-03.** PLAN.md, LEDGER.md, PLAN-MATERIALES.md and all 32 `reviews/`
  files MOVED (not copied) into the released repo at `docs/plan/`, on `main`. META updated
  above. The move is deliberate rather than a snapshot: two living copies of a 200 KB
  working record would drift, and the next PM session must not be able to read the wrong
  one. The old external path keeps a pointer file only. **PREL items 1–7 are now complete;
  the phase is closed.**
- **Post-release options, each Brent's own decision (none is scheduled):** the RLS-hardening
  pass (drop the `cuentacuentos-drafts` own-folder UPDATE policy — unblocked in principle now
  that no deployed client should still call `upsert:true`), and `PD-REFINE` (`refine-story`
  still has no strict provider-output validation; deferred post-release by his 2026-07-31
  decision).

**Required PREL inputs/acceptance:**
1. Record the final reviewed tip SHA and parentage for every surviving lineage. Merge only
   final descendant tips — do not merge PA separately when a PFE descendant already contains
   it, and do not merge frozen `fase-f`@7d32182 when a PF descendant contains it.
2. Create an integration branch from then-current `origin/main`; preserve ancestry with
   explicit merges unless Brent approves a documented alternative. Do not independently squash
   branches with overlapping history. Prove current-main fixes after P0 remain present.
3. Integrate the final PFE/PA-side lineage with the final PF/PC/PD-side lineage and any
   cross-lineage PB/PH branch according to the recorded DAG; re-check changed-path overlap and
   resolve conflicts by contract, not "ours/theirs".
4. Run combined Node and Deno D6 gates, PF corpus consistency, auth-before-body regressions,
   persistence/reload/cancellation tests, and a supervised synthetic smoke on the integrated
   tree before any push or deploy.
5. Sequence infrastructure before consumers: bucket/RLS changes before code that writes new
   paths; required env/secrets (including `GEMINI_RESEARCH_MODEL`) before edge deployment;
   separately authorized edge-function deploys before the frontend release that depends on
   their response contract. Record deployed function names, commit SHAs, config, and canary
   results.
6. Prepare forward-fix/rollback instructions that never restore the prohibited insecure v32;
   get Brent's explicit authorization separately for merges, each edge deploy, and the `main`
   push. A `main` push is the production release.
7. Move or snapshot the currently unversioned PLAN/LEDGER/review record into the released
   repository — or another versioned archive — as already promised in META.

## Decision log
| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-07-27 | Degrade-for-non-security (D4) | Round-1 review: correct-in-isolation validation broke real editor flows | Brent |
| 2026-07-28 | No web-URL image references (D3) | No product need; the pin is the core of FASE F | Brent |
| 2026-07-28 | Frontend items: one branch off `fase-a-complete` | Target file is rewritten by FASE A (+1901/−1018); no conflict-free host exists | Brent |
| 2026-07-28 | Adopt AGENT-WORKFLOW SOP mid-project; Fable=PM; existing state seeded into this file + LEDGER, prior history stays in the writeups | Two review rounds were spent catching the author reviewing itself | Brent |
| 2026-07-29 | D7 mutation-proof exception codified; D6 runtime pin (Node 22.x reference) | Codex NOTES ON THE PLAN, PFE final review round 1 | Codex Sol |
| 2026-07-29 | PFE execution deviations accepted: skipped-notice block relocated verbatim from `renderConfigStep()` to the shared container (A3 unreachable otherwise); notice semantics are accumulate+dedup with manual dismiss, not replace (concurrent pipeline would let an empty last response erase a real report) | PM review r2, Codex PASS r3 | executor r2 |
| 2026-07-29 | PFE CLOSED at `185c370` (Codex PASS). Merge deferred to PREL. | §3.8 close | Codex Sol / PM |
| 2026-07-29 | SOP operating rule: every PM turn ends with ONE of three prompts by PM judgment — executor (Opus), review (Sol), or PM bootstrap (fresh Fable). No idling on a trigger. Additionally: a PM session that authored a branch must rotate before triaging that branch's review. | Brent correction + author-conflict on fase-f | Brent / PM |
| 2026-07-29 | PF final review FAIL (4B/2S) accepted after PM reproduction of [B1] (both halves, tip+base) and code-verification of [B2]-[B4]. Remediation on NEW branch `pf-fix-7d32182`; `fase-f`@7d32182 frozen (review-pinned SHA + PFE contract anchor). | A review is a claim; reproductions twice changed classifications in this project | Codex Sol / PM |
| 2026-07-29 | [S1]/[S2] folded into the consolidated remediation round rather than backlogged | The corpus is the re-review's regression instrument; leaving known-dishonest cases in it while changing collector semantics would weaken the only guard, and the fixes ride the same corpus.ts edit + re-capture the B-fixes require | PM |
| 2026-07-29 | D4 refined (fatality binds to consumed entries); D6 gains the deno invocation + identity-extraction method | Codex NOTES ON THE PLAN, PF final review | Codex Sol |
| 2026-07-29 | PF remediation report misrouted to Sol before PM verification; her round 2 of 2 consumed on it. Recorded as process note: independence held, no invalidation; the lost PM pass would likely have caught the residue pre-verdict. Rhythm restated: executor → PM verify → Sol. | Misroute (accident, Brent) | PM |
| 2026-07-29 | PF second FAIL ([B3-R] sceneReferenceMode + sibling raw scalars) → Brent's gate per §1.5. PM reproduced the leak, swept the complete residue (4 scalars / 7 sites / 1 file), verified gates + D5 re-capture at 0066c0f. Recommendation on the table: narrow re-plan. NO further round without Brent's explicit word. | §1.5 cap semantics | Codex Sol / PM |
| 2026-07-29 | PFE follow-up item CLOSED: `skippedImages` on story error envelopes is additive-only AND already parsed by the PFE frontend (`InvokeError.skippedImages`, editor :653 at 185c370) | Codex contract check, PM grep-verified | Codex Sol / PM |
| 2026-07-29 | Brent chose close path (a): Sol single-item confirmation. CONFIRMED FIXED at c496490. **PF CLOSED** per §3.8; merge deferred to PREL. PC rebased: branch off `pf-fix-7d32182`@c496490, target `generate-story/handler.ts:59`. | §1.5 gate resolution | Brent / Codex Sol / PM |
| 2026-07-29 | §3.2 plan review returned FREEZE WITH AMENDMENTS, [P1]–[P8] all AMEND-REQUIRED; PM verified every load-bearing factual claim (ancestry ×6, path overlap 0, P0-in-main, index.ts env ownership) before applying. All eight applied verbatim-or-formatted; **PLAN FROZEN**. D3/D4 rewordings touch Brent-raised decisions while preserving their substance — flagged for his veto; a veto reverts the row and re-runs the freeze check. | Codex plan review | Codex Sol / PM |
| 2026-07-29 | New "Operating and review gates" section binds the three-prompt rule, PM-verify-before-review, misroute accounting, post-final-FAIL stop, and role separation as gates rather than history. `pf-fix-7d32182`@c496490 joins the protected refs as PF's closing state. | PLAN-review [P7]; PF close | Codex Sol / PM |
| 2026-07-29 | PC r1 FAIL accepted after PM reproduction of [B1] (enum-shaped finishReason leaks to log + response). [S1]/[N1]/Q4-runner-line folded into the ONE consolidated remediation (same file/suite, re-reviewed anyway). Sol's seven interpretation ACCEPTs + D-1..D-5 ACCEPTs recorded as BINDING — closed to relitigation. PROVIDER_UNAVAILABLE gloss clarified in the PC spec; D7 gains the both-shapes hygiene rule. | PC review r1 | Codex Sol / PM |
| 2026-07-29 | PC cap amendment 1024→2048 APPLIED per the spec's own canary mechanism (measured: thoughts 768 + truncation at 1024). Authorization exercised by Brent firing the contingent micro-prompt (PF precedent). Executor's test-name rename deviation accepted (a pin named 1024 asserting 2048 is a documentation defect). Freeze check renewed: plan remains FROZEN with this dated amendment. | [PC7] canary + micro-round @96cb2cc | Brent / PM |
| 2026-07-29 | **PC CLOSED** at 96cb2cc (Codex cap CONFIRMED after PASS 2/2 + canary). §3.8 close per the gates: PM verification + reviewer confirmation both present. PD chosen as next phase (continues the hot lineage; PH depends on it; PB/PG spec passes queue after). PD spec DRAFT written with six named gaps — Codex spec review is its gate; freeze check renewed (draft is marked DO NOT EXECUTE, so no executable surface changed). | §3.8; [P5] pattern | Brent (canary+confirm path) / Codex Sol / PM |
| 2026-07-29 | **PD SPEC FROZEN** per Codex spec review (EXECUTABLE verdict): G1–G6 decisions + [PD1]–[PD10] incorporated by reference from `reviews/PD-spec-review.md`. Two PM-draft premises struck as false, PM-verified against code (no caller scene-count — server owns "15, accept 12–16"; corpus stub invalid — fidelity upgrade sanctioned, baseline read-only). `PC-UI` extended (story warnings + error-body parsing + T-D.13); `PD-REFINE` named as release prerequisite; stale-comment backlog item absorbed into PD. Freeze check renewed. | PD spec review | Codex Sol / PM |
| 2026-07-30 | PD round-2 FAIL accepted: completeness, not behavior — the round-1 FILE required tightening the body-stream test to 400/CLIENT_INPUT_INVALID "in the same remediation"; the PM scoped the fix-list from the chat verdict + code-comment and declared it closed, so the executor (correctly obeying) never added it. Operating gate 7 added: remediation scope comes from the saved review file, read in full. Freeze check renewed. Phase at Brent's §1.5 gate. | PD review r2; PM self-finding | Codex Sol / PM |
| 2026-07-30 | **PD CLOSED** at db42745 (Codex CONFIRMED after Brent's re-plan; §3.8 gates satisfied: PM verification + reviewer confirmation). All FOUR build phases now DONE-unmerged. **PM ROTATION**: outgoing session ran PF-final→PFE-close→PC→PD; no author conflict, but context is heavy and the remaining work (PB/PG/PH spec passes, PREL) benefits from a fresh window. Successor bootstrap issued; PB spec pass is its first act. | §3.8; rotation judgment | Brent (re-plan+confirm path) / Codex Sol / PM |
| 2026-07-30 | Rotation completed: incoming PM re-verified every handoff fact with own hands (all 9 tips, ancestry ×10 incl. both cross-lineage negatives, deno 2.7.11, db42745 gates 297/0 / lint 94 / check 46, corpus blobs 91ec703…+b73fa3c…, no active Bridge tasks). **PB SPEC DRAFT written (DO NOT EXECUTE)** per the outline's named gaps, on a D5-verified base: both lineages read via `git show`, live bucket+RLS read via read-only SQL. Key verified findings folded into the draft: B5/editorStateV1 and A4 already live on 185c370 (PB preserves, not rebuilds); the D3/A7a refine-on-finalized flow verified link-by-link (drafts-only at release = user-visible regression); hash path RLS-compatible with zero DDL prerequisite; RLS hardening impossible pre-release (live main has 5 `upsert:true` sites). Draft decisions: two coordinated branches (no pre-PREL cross-merge); liturgia-images recommended as the explicit D3-permitted contract change (Brent veto flagged). Freeze check renewed: draft is marked DO NOT EXECUTE, no executable surface changed (PD-draft precedent). | Outline [P5]; D5; gate 2 | PM |
| 2026-07-30 | **PB SPEC FROZEN** per Codex spec review (EXECUTABLE verdict): G1–G7 binding texts + T-B.1–T-B.14 incorporated by reference from `reviews/PB-spec-review.md`. Four PM-draft premises struck, ALL FOUR PM-verified true against 185c370 before applying (B5 lives in the combined `editorStateV1`+`image_paths` contract, not editorStateV1 alone; the liturgia-images rewrite happens in `saveLiturgy`, not editor finalization; signed liturgia-images has no producer and zero live rows — public prefix only, sign form stays FORBIDDEN_BUCKET; partial failures filter-and-compact today and resolve the write — G4 mandates fail-closed logical writes as the intentional divergence). Upload-first structural 409 (`statusCode === "409"`, storage-js 2.90.1, captured from an approved non-production runtime) replaces the existence-check option. Two-branch topology confirmed (edge stands alone at db42745). Review plan recorded: FE executor → PM verify → EDGE executor → PM verify → Sol phase review = round 1/2 of the §1.5 cap. Freeze check renewed; FE executor round opened. | PB spec review | Codex Sol / PM |
| 2026-07-30 | PB-FE round 1 delivered honestly PARTIAL at `phase/pb-storage-fe`@9beccdb (3 commits: G6 capture at byte-identical base, fixture blob 70204600…; G2/G3 primitive; six-point rewire + 204 declared divergences) with the remainder plainly declared (G7/T-B.8 suite, T-B.9 G5 proof, dedicated T-B.1/5/6/12/13 suites, T-B.7 spy runs). PM verified the delivered slice with own hands: capture-timing diff EMPTY; tsc 1041↔1041 identity delta EMPTY both directions; eslint 159 identical; Vitest serial = exactly the 6 pre-existing Mesa failures (684 tests); classify-by-message mutation → exactly the 3 reported failures, revert pristine; comparator green; upsert/remove sweeps clean. Triage: **F1 → D6 Vitest command amended to `--no-file-parallelism` (dated in the row; freeze check renewed)**; **F2 → PLAN corrected, PM error owned** (truncated grep window); F3 (upload-order multiset comparison, persisted order still strict), F4 (failed-HEAD-probe URL carried verbatim per G2), F5 (fixture-only repairs of malformed placeholders, no assertion lines touched — PM-diffed), F6 (`_selected` suffix retired) all ACCEPTED pending Sol ratification at the phase review. Continuation round opened on the same branch. | Gate 2; §1.6 honesty | PM / executor |
| 2026-07-30 | **PB-FE half COMPLETE and PM-VERIFIED** at `phase/pb-storage-fe`@c79ea87 (continuation round: 4 test-only commits, +2904/−0, zero production changes). PM re-verified with own hands: gates (Vitest serial 755/6 = Mesa six; tsc 1041↔1041 identity delta EMPTY both directions; eslint 159); mock honesty (only supabase client + use-toast mocked; production editor/hook/primitive/ConstructorLiturgias imported); base-red re-proof of the wiring suite against base production files (6/6 fail on positional `_selected`/`upsert=true` paths); own G5-M2 mutation (drop `updated_at` witness → stale ack deletes the CURRENT draft — the B1 bug — exactly as reported); own N2 planted removal (3 flows fail — safe superset: `declineRecovery` also routes through `deleteDraftFromSupabase`); all reverts pristine. Fixture blob unchanged. Findings: PB-F7 (pre-existing coverImageOptions base64 leak into liturgia_elementos, PINNED not silenced → backlog), PB-F8 (orphan-purge A4a block unreachable from the real remove-prop path; both paths correct, both now covered N3a/N3b), PB-F9 (node:crypto ↔ WebCrypto hash agreement). EDGE round opened. | Gate 2 | PM / executor |
| 2026-07-30 | **PB-EDGE half COMPLETE and PM-VERIFIED** at `phase/pb-storage-edge`@10d1190 (2 commits off db42745; 4 files +1201/−8; production change = ONE allowlist entry `/storage/v1/object/public/liturgia-images/` + comments, exactly G1). PM re-verified with own hands: merge-base exact; corpus blobs byte-identical (91ec703…/b73fa3c…); gates 325/0, lint 94, check 46; base-red 16/12 split reproduced with base `imageFetch.ts` under the committed suites; own M4 mutation (traversal guard disabled → exactly PB-P5/PB-S3/PB-I3 fail — the guard PB makes load-bearing between two allowed buckets) and own M3b mutation (sign-prefix added → exactly PB-P2/PB-S2b/PB-I2b fail); reverts pristine. Findings triaged: **F1 fmt-gate premise false at base (file fmt-dirty at db42745, PM-confirmed) → measured zero-new-dirt substitute ACCEPTED per the ratified PD-F4 precedent** (new files fmt-clean, PM-confirmed); F2 (one-line `DRAFTS_BUCKET_PATH` doc correction — the widening made it false) ACCEPTED; F3 (PB-I3b reclassified base-red — refine slot collected first at base; safe direction) ACCEPTED. All three to Sol for ratification. **Both PB halves now complete; Sol phase review round 1/2 opened** per the recorded review plan. | Gate 2 | PM / executor |
| 2026-07-30 | **PB review r1 FAIL accepted** (5 BLOCKING, all FE-side; `reviews/PB-review-1.md`). PM reproduced [B1]/[B3]/[B5] with own hands and owns [B2] (the mock audit passed `use-toast` as a boundary — G7's list never included it); PB-F7's backlog disposition RETRACTED per [B1] (backlog row struck; in-phase fix). All r1 ratifications recorded as BINDING and closed to relitigation (FE F3-F6, PB-F8/F9, EDGE F1-F3 with the 27-hunk correction, D6 serial-vitest amendment). Consolidated remediation opened: fresh executor on `phase/pb-storage-fe` atop c79ea87, the five [B]-item lists from the FILE verbatim; EDGE@10d1190 untouched. Sol round 2/2 is FINAL — a second FAIL goes to Brent (gate 5). | PB review r1; gate 7 | Codex Sol / PM |
| 2026-07-30 | **PB remediation landed & PM-verified** at `phase/pb-storage-fe`@5f7b6bd (5 commits; production = liturgyService.ts only; all five [B] items with base-red/mutation evidence; leak surface widened beyond the review's hint to character/scene option arrays and covered). PM re-verified: [B1] base-red verbatim; one production 409-as-failure mutation felled exactly the three 409-success proofs; tsc 1041↔1041 delta EMPTY both directions; eslint 159; Vitest serial 760/6 Mesa-six (3 clean runs; 1 known-class contention flake at machine load ~40-47, recorded). Executor F1-F6 accepted; F3 (use-toast mock persisting in G5/criteria suites — the r1 file named only the wiring suite) referred to Sol as a frozen question. **Sol FINAL round 2/2 opened**: judges the remediation matrix + permitted related residue (gate 3); a FAIL goes to Brent (gate 5). | Gate 2; gate 3 | PM / executor |
| 2026-07-31 | **PB CLOSED** at `phase/pb-storage-fe`@5f7b6bd + `phase/pb-storage-edge`@10d1190 (Sol r2/2 PASS/CONFIRMED, `reviews/PB-review-2.md`: B1–B5 all FIXED with her own adversarial B1 probes incl. the asymmetric shared-bytes case; F3 ruled acceptable non-G7 residue with the G5-header inaccuracy noted non-blocking; F1/F2 concurred; zero new remediation defects; FE gates concurred; EDGE evidence carried unchanged). §3.8 gates satisfied: PM verification + reviewer PASS both present; no gate-5 trigger, so no Brent close-word required (PC precedent). Close block written; PREL lineage tips updated; backlog +1 nit (G5 header). **PM ROTATION**: this session ran the full PB phase (bootstrap → spec → 2 FE rounds → EDGE → r1 triage → remediation → close); context heavy; successor bootstrap issued — PG spec pass is its first act, PH still blocked on Brent's product answers (surfaced 2026-07-30, pending), Brent's liturgia-images veto stands open through PREL. Freeze check renewed. | §3.8; rotation judgment | Codex Sol / PM |
| 2026-07-31 | Rotation completed: incoming PM re-verified every handoff fact with own hands (11 tips, ancestry ×14 incl. the three negatives, blobs ×3, FE gates at 5f7b6bd — Vitest serial 760/6 Mesa-six at load ~1.3, tsc 1041, eslint 159, node v22.22.0 — and EDGE gates at 10d1190 — 325/0, lint 94, check 46, deno 2.7.11; `jb list` clean). **PG SPEC DRAFT written (DO NOT EXECUTE)** per the outline's named gaps, on a D5-verified base: seed FASE G premise re-verified true (`concurrency.ts` has no cancellation machinery) but its file targets rebased — the live pipeline is `storyImagePipelineRunner.ts` (FASE A), the pipeline stagger is runner-internal, and `runWithConcurrency` belongs to PB's upload path (excluded: G4 fail-closed writes are not cancellable mid-write). Key verified findings folded into the draft: the AbortSignal chain is severed at two links (all 9 factory providers ignore `ctx.signal`; the invoke wrapper passes no signal) while functions-js 2.90.1 already supports `signal`; post-cancel items strand in `running` (or phantom `error`), and the stranded status is load-bearing — `collectCoverEndTasks` excludes `running` items from re-collection; T-A2.4's ignored-signal no-merge/no-upsert invariant is ALREADY pinned (contract/integration suites) but no test asserts post-cancel STATUS; the edge handler never observes `req.signal`, so cancellation cannot recall dispatched spend (honesty rule in the spec). Base decision recorded: `phase/pg-cancellation` off 5f7b6bd (avoids forking the PB-edited editor). Freeze check renewed: draft is marked DO NOT EXECUTE, no executable surface changed (PD/PB-draft precedent). | Outline [P5]; D5; gate 2 | PM |
| 2026-07-31 | **PG SPEC FROZEN** per Codex spec review (EXECUTABLE verdict): G1–G8 binding texts + T-G.1–T-G.13 incorporated by reference from `reviews/PG-spec-review.md`. Five strikes, ALL FIVE PM-verified against the code before applying; two are owned PM errors (registry-survival "unpinned" and "no post-cancel status assertion" — both refuted by `pipelineRunnerA2.outcomes.test.ts:474-512`; the true gap narrowed to synchronous `running→pending` normalization) and one was an unsafe PM design (decision 4's unconditional abort-catch `pending` write — replaced by G3's token-ownership rule; PM verified the same-id stomp hazard pre-exists at the un-guarded catch :473-480, making G3's independent token check a required fix, proven by T-G.8). Destructive-lifecycle summary corrected (unmount = cancel only; recovery invalidates at :1425/:1477/:1489). Cover/end Cancelar IN (G6); notice residue ACCEPTED with a T-G.13 mutation pin; every exclusion recorded as a G8 residual. Review plan recorded: ONE executor round → PM verify → Sol phase review round 1/2 of the §1.5 cap. Freeze check renewed; PG executor round opened. | PG spec review | Codex Sol / PM |
| 2026-07-31 | **Parallel initiative opened: `PLAN-MATERIALES.md`** (materials-constrained children's activity generation, phases M1–M3). File-disjoint from every open phase of THIS plan (PG = story pipeline/editor; M = ChildrenActivityDialog + children publish service + children EFs — zero path overlap, PM-verified). Shares LEDGER.md (`M-*` labels) + reviews/ (`M-*.md`); inherits SOP roles/caps, operating gates 1–7, and D5–D9 semantics by reference. Brent's product decisions locked in that file (strict-only constraint; pre-check all; manual save per item; constraint on all refinement types). That file freezes on its own Codex plan review PASS. THIS plan's phases, sequencing, and freeze state are unchanged. Freeze check renewed. | New goal outside the cuentacuentos overhaul; amending a frozen plan with unrelated phases would muddy PREL | Brent / PM |
| 2026-07-31 | **PG executor round COMPLETE and PM-VERIFIED** at `phase/pg-cancellation`@d3fbd58 (4 commits off 5f7b6bd; production = exactly the four G1 files; +2415/−25; supabase/ diff EMPTY; fixture blob unchanged). PM re-verified with own hands: full production diff G-text compliant (G2 loop-top+cancellableDelay; G3 sweep at cancel AND reserveRun-before-install, token-owned catch; G4 9/9 factories + same-instance `{body,signal}`; G6 step-level Cancelar keyed to the run, no lifecycle edits); gates Vitest serial 823/6 Mesa-six, tsc 1041↔1041 delta EMPTY both directions (path-normalized), eslint 159↔159 delta EMPTY; PB suites 122/122; base-red splits reproduced exactly (24F/10P with the named existing-true ten; 18F/1P; 5F/5P); own mutations M-PM-1 (reserveRun sweep removed → exactly the 8 T-G.8 cases), M-PM-2 (the STRUCK decision-4 rule recreated → exactly the 3 abort-reject stomp cases — T-G.8 demonstrably guards G3), M-PM-3 (wrapper signal severed → exactly the T-G.5 boundary case). Executor findings F1/F3/F4/F6/F9 ACCEPTED (F1 self-caught vacuous first T-G.12 proof, replaced — D7 honesty done right); **F2/F5/F7/F8 referred to Sol as frozen questions** (T-G.10 base-red reading; defensive classifier branch; additive pbBoundary extension; T-G.11 persisting-sibling runner-level substitution). **Sol phase review round 1/2 opened** (gate 3; FAIL ⇒ one consolidated remediation → FINAL 2/2 ⇒ Brent per gate 5). | Gate 2 | PM / executor |
| 2026-07-31 | **PG CLOSED** at `pg-fix-d3fbd58`@1b0cfed (Sol r2/2 PASS/CONFIRMED, `reviews/PG-review-2.md`: [B1] five-step matrix FIXED on her own M-SOL-2 re-run + her own gate-neuter probe; residue confined to the permitted additive boundary control + T-G.11 evidence; retitled prior case ruled honest; branch-name deviation RATIFIED with `phase/pg-cancellation`@d3fbd58 preserved; gates concurred 824/6 Mesa-six, tsc/eslint identity deltas empty; G1–G8 + T-G.1–T-G.13 MET IN FULL). §3.8 gates satisfied: PM verification + reviewer PASS both present; no gate-5 trigger, so no Brent close-word required (PC/PB precedent). Close block written; PREL FE lineage tip advances 5f7b6bd → **1b0cfed**; both PG refs join the protected set. **PM ROTATION**: this session ran the whole PG phase (bootstrap → spec draft → spec freeze → executor verify → r1 triage → remediation verify → close); context heavy; successor bootstrap issued. Remaining work ALL runs through Brent: PH spec (blocked on his two 2026-07-30 product answers), PC-UI disposition (build vs accept API-only observability), PD-REFINE sequencing, the liturgia-images veto (open through PREL), and PREL itself (his authority; cannot begin until the PC-UI disposition is recorded). Freeze check renewed. | §3.8; rotation judgment | Codex Sol / PM |
| 2026-07-31 | **PREL INPUT RECORD compiled** into the PREL section (item 1 PREPARATION, not execution) after full bootstrap re-verification with own hands: 13 refs at pinned SHAs; ancestry ×16 incl. the three negatives; 3 read-only blobs exact; both gate sets re-run at the tips in detached worktrees (FE @1b0cfed 824/6 Mesa-six / tsc 1041 / eslint 159 @ node v22.22.0; EDGE @10d1190 325/0 / 94 / 46 @ deno 2.7.11); M-track zero path overlap re-verified. NEW verified integration facts recorded: merge-base(main, both tips) = exactly 1343513 (held through the same-day M1 merge d79d329→7f3600f — record refreshed in place, labeled); main's post-P0 commits overlap the EDGE lineage on ONE file (`generate-story/handler.ts` — d79d329's bare-alias `claude-opus-5` pin + thinking-disabled + 8192 cap vs the PD rewrite's dated ID + 16384 + no knob; semantic merge rule recorded: carry main's fix intent into the PD handler, model/knob choice is a recorded PREL decision); FE overlap ZERO; ambient unmerged `fix/story-trunc` (91ae82e→dfdccf0 same day, still active) touches the same file (intent superseded by PD's typed 502; disposition Brent's at PREL). No executable surface changed; freeze check renewed. Per gate 1 judgment, this turn ends with the consolidated Brent-gate message — the five open decisions (PH ×2 answers, PC-UI, PD-REFINE sequencing, liturgia-images veto, PREL start word) are all his; no executor/reviewer/bootstrap prompt exists to issue. | PREL item 1; PG-close handoff; gate 1 | PM |
| 2026-07-31 | **BRENT'S FIVE PROGRAM ANSWERS recorded** (responding to the consolidated gate message): (1) PH cover/end cost option B CONFIRMED as specced — 2 pro-quality options per cover/end batch, regenerate APPENDS; he reserves the right to change later (treat as the product default, not immutable). (2) NO hard total-cost ceiling. (3) **PC-UI disposition = BUILD** — the named release prerequisite becomes buildable phase **PC-UI** on the FE lineage; spec DRAFT written this turn (DO NOT EXECUTE) with Codex spec review as its gate. (4) **PD-REFINE explicitly deferred POST-RELEASE** — the release ships with strict provider-output validation on initial `generate-story` only; backlog row re-dated; this is his recorded release decision, PREL's item list adjusts (PD-REFINE no longer gates release). (5) **liturgia-images veto DECLINED** — the D3 contract change stands as reviewed on the unmerged edge branch; the veto window is CLOSED (PREL input record updated in place, labeled). Sequencing: PC-UI first (release-gating, scope fully accumulated from PLAN-review [P4] + PD spec review), PH spec pass queues after PC-UI closes — both edit `CuentacuentoEditor.tsx`, and the PG fork-avoidance precedent puts PH's base at PC-UI's reviewed tip. Freeze check renewed: no executable surface changed this row (PC-UI's executable spec exists only after its spec review freezes it). | Brent's answers 1–5; gate 1 | Brent / PM |
| 2026-07-31 | **PC-UI SPEC FROZEN** per Codex spec review (EXECUTABLE WITH THE TEXT BELOW): G1–G10 binding texts + T-U.1–T-U.12 incorporated by reference from `reviews/PCUI-spec-review.md`. Three PM-draft strikes, ALL THREE PM-verified against the pinned code before applying — [S1] false persistence cites (caller-side `buildAuthoritativeDraftPatch` + a comment cited as the seam; real seam = hook :1122-1160 / :1345-1365 / :1491-1519, editor :1244-1266 — cite error owned), [S2] `source:code` not a unique warning identity (per-result emission makes duplicates legal; occurrence-safe keys, multiplicity preserved — premise error owned), [S3] request-derived all-failed denominator unsound (post-materialization `NO_IMAGES`/skipped emits no warning — design error owned). **G6 product deviation recorded: NO all-failed banner distinction in PC-UI; flagged for Brent's veto** (a veto queues a separately reviewed additive edge contract, it does not change PC-UI). Her review independently reproduced the D6 baseline (824/6 Mesa-six, tsc 1041, eslint 159, node v22.22.0) from a git-archive snapshot. Review plan recorded: ONE executor round on `phase/pcui-warnings` off 1b0cfed → PM verify (incl. re-running at least one G8 mutation, one T-U.4 lifecycle case, the D6 identity deltas, and the supabase/** empty-diff check) → Sol phase review round 1/2 of the §1.5 cap. Freeze check renewed; PC-UI executor round opened. | PC-UI spec review | Codex Sol / PM |
| 2026-08-01 | **PC-UI executor round COMPLETE and PM-VERIFIED** at `phase/pcui-warnings`@8ceec7c (4 commits off 1b0cfed; production = exactly the two G1 files; +54 tests). PM re-verified with own hands: full production diff G-compliant; gates Vitest serial 878/6 Mesa-six, tsc 1041↔1041 and eslint 159↔159 identity deltas EMPTY both directions (one PM measurement artifact — hybrid path-scoped base checkout — identified and eliminated, method note in the outcome block); base-red 47/30 reproduced exactly; own mutations M-D13-ROUNDTRIP (G8 placement → exactly the 2 required reds; naive placement → 32/32 green, REPRODUCING executor finding F1's two-channel healing), M-U4-REGEN (1 red), M-F3-TOPLEVEL (1 red, the named case); D5 fixture strings byte-match the edge; boundary control verified additive; mock surface = supabase client only. Findings triaged: F1 VERIFIED+ACCEPTED (recorded for the reviewer); **D2 (approval-path persistence in the T-D.13 chain) + D3 (real debounce waits) + the `persistDraftRow` control referred to Sol as frozen questions**; F5 self-caught defects exemplary D7; F7/G6 verified clean. **Sol phase review round 1/2 opened** (gate 3; FAIL ⇒ one consolidated remediation → FINAL 2/2 ⇒ Brent per gate 5). | Gate 2 | PM / executor |
| 2026-08-01 | **PC-UI CLOSED** at `phase/pcui-warnings`@8ceec7c (Sol r1/2 **PASS/CONFIRMED**, `reviews/PCUI-review-1.md`: G1–G10 + T-U.1–T-U.12 MET on her own evidence — independent base-red 47/30, all five G8 mutations incl. the naive-placement control confirming F1's two-channel record, M-F3 pair, gates concurred 878/6 Mesa-six with tsc/eslint deltas empty both directions and the ambient-Node-26 trap caught and discarded; D2/D3/`persistDraftRow`/F1 all RATIFIED; scope/coupling confirmed). §3.8 gates satisfied: PM verification + reviewer PASS both present; no gate-5 trigger, so no Brent close-word required (PC/PB/PG precedent). Close block written; PREL FE lineage tip advances 1b0cfed → **8ceec7c**; `phase/pcui-warnings` joins the protected set; PFE-F3 backlog row CLOSED; **PREL now waits on PH only**. Standing Brent items: the G6 no-banner deviation (veto open, non-blocking) and the `fix/story-trunc` disposition at PREL. **PM ROTATION**: this session ran bootstrap → PREL input record → Brent's five answers → PC-UI spec draft → spec freeze (3 strikes verified) → executor verification (own mutations) → this close; context heavy; successor bootstrap issued — **PH spec pass is its first act** (base = 8ceec7c per the reviewer-ratified PC-UI G1 sequencing rule; Brent's two product answers recorded 2026-07-31). Freeze check renewed. | §3.8; rotation judgment | Codex Sol / PM |
| 2026-08-01 | **PH SPEC DRAFT written (DO NOT EXECUTE)** by the incoming PM after full bootstrap re-verification with own hands (16 refs, ancestry ×14 + 3 negatives, merge-base(main, each tip) = 1343513, blobs ×3, M1/M2 overlap ∅, FE gates at 8ceec7c 878/6 Mesa-six / tsc 1041 / eslint 159 @ v22.22.0, EDGE gates at 10d1190 325/0 / 94 / 46 @ deno 2.7.11). Draft on a D5-verified base (`git show` at 8ceec7c / 10d1190 only): the sheet/scene append pattern already exists (PH extends it to cover/end); count 4→2 pro; regenerate = APPEND per Brent's recorded default; concurrent-click hazard named; prices refreshed from the live official page (flash $0.067 / pro $0.134 per image — seed arithmetic still current); the outline's cross-lineage-base clause annotated OBSOLETE (labeled). Freeze check renewed (draft marked DO NOT EXECUTE — PD/PB/PG/PC-UI-draft precedent). | Outline [P5]; D5; gate 2 | PM |
| 2026-08-02 | **PH SPEC FROZEN** per Codex spec review (EXECUTABLE WITH THE TEXT BELOW): G1–G10 binding texts + T-H.1–T-H.12 incorporated by reference from `reviews/PH-spec-review.md`. Three PM-draft strikes, ALL THREE PM-verified against the pinned code before applying — [S1] the zero-image premise was incomplete (429/500 requires `errors.length > 0`; all-fulfilled-but-invalid ⇒ 200 `success:false, images:[]` at handler :1392-1400; FE wrapper rejects both shapes, editor :503-505); [S2] "editor is the only signature consumer" false (SEVEN direct suite constructions confirmed: taskFactories.test.ts :478/:539/:970/:991/:1247 + PG.signal :221/:244; three are signature-only mechanical adaptations, authorized by G1/G2; count divergences stay exactly four); [S3] a per-item guard admits the cover↔end displacement race (`reserveRun` global displacement confirmed at runner :828-870; the guarantee is the LIVE `pipeline.isBusy()`, hook :58-59). Her review independently reproduced the D6 base (878/6 Mesa-six, tsc 1041, eslint 159 @ v22.22.0), the four-pin count sweep, and the refreshed prices (official page 2026-08-02). Review plan recorded: ONE executor round on `phase/ph-costs` off 8ceec7c → PM verify → Sol phase review round 1/2 of the §1.5 cap. Freeze check renewed; PH executor round opened. | PH spec review | Codex Sol / PM |
| 2026-08-02 | **PH r1 returned honest FINDINGS (§1.6) — accepted after full PM verification; G1 SCOPE AMENDMENT recorded; consolidated continuation round opened.** The build @39e1736 meets T-H.1–T-H.9/T-H.11 (PM re-ran: gates with tsc/eslint identity deltas EMPTY; base-red factory 16/18 + concurrency 6/9; mutations [A] in exact strong form → only the 2 race cases, and [C] → both cancel cases `[4] vs [2]`) but full Vitest = **924/16**: the Mesa six + TEN failures in five frozen suites the executor rightly did not touch (blob-identical to 8ceec7c). **[PH-F1] both mechanisms PM-verified, one CORRECTED:** (a) SEVEN stale copy-handle selector lines (f4fix :496/:633, f4fix3 :454/:472, pfe2 :219, pfe3 :256, pg.cancel :539) — PM-widened: exactly 8 of 10 recover; (b) pfe2 B2a/B2b: the executor's settle remedy did NOT reproduce — PM instrumentation shows the G5 guard refusing on a run pfe2's LEGACY mock leaves open (both items `save-failed`, `running=true` indefinitely); at base, `runItems` displacement papered over the same zombie (B2a/B2b unknowingly exploited the [S3] hazard); **production PROVEN clean by a PM probe under pbBoundary** (a save-failed batch closes the run; the next append dispatches, invokes 1→2). **NEW [B1-PM] BLOCKING (G5 letter):** visual disabled state is per-item while the guard is global — enabled-looking inert controls in sibling-run/refine windows (+ header during approval, pre-existing shape); spend-safety closed either way. **G1 SCOPE AMENDMENT (freeze check renewed; ratification = Sol's at r1/2):** the five frozen suite FILES join the authorized test-adaptation list for EXACTLY the seven widenings + a deterministic pfe2 harness fix that lets its auto-kick run close — assertions untouched; any assertion change stays STOP+FINDING. [PH-F2] (selection not persisted by the act of selecting — pre-existing, PM-code-verified) → backlog. Executor assumptions (guarded clear; non-empty-only title) accepted pending Sol. Continuation: ONE consolidated round, fresh executor, same branch atop 39e1736 ([B1-PM] + the ten recoveries + full gates); then PM verify → Sol phase review r1/2. | Gate 2; §1.6; [PH-F1] | PM / executor |
| 2026-08-03 | **PH continuation round COMPLETE and PM-VERIFIED at `phase/ph-costs`@9d96c41** — [B1-PM] closed (headers + additive `regenerateDisabled`, guards verbatim, sheet/scene DOM-identical); the ten frozen-suite failures recovered under the amendment (seven widenings + pfe2's three hunks; zero assertion/gesture changes, PM-diffed); +3 matrix tests base-red at 39e1736 (3/9, exact shapes reproduced). **The r1-triage "run never closes" claim CORRECTED (executor r2, PM-verified by experiment; labeled in the r1 block):** the run closes once the failure window ends — the wait-for-actionability is the green-maker (invalid payload + wait ⇒ pfe2 4/4, PM-reproduced), the valid-PNG fix removes the manufactured write failures (invalid-base64 diagnosis verified at `decodeBase64Strict`:101 + strict decode). Gates at tip, all PM-re-run: Vitest serial **927/6 = the Mesa six only**; tsc **1041↔1041** and eslint **159↔159** identity deltas EMPTY both directions vs 8ceec7c. Executor deviation (neutral story ids) + assumption (batch-surfaces-only [B1-PM] scope) accepted pending Sol. **Sol phase review round 1/2 opened** (target 9d96c41; frozen question set incl. the G1 scope-amendment ratification, [B1-PM]'s G5 reading, the r1/r2 assumptions, and the [PH-F1] record with its corrected mechanism). FAIL ⇒ ONE consolidated remediation → FINAL 2/2 ⇒ Brent (gate 5). | Gate 2; gate 3 | PM / executor |
| 2026-08-03 | **PH review r1 FAIL accepted after PM reproduction of [B1] — both halves, own hands** (strengthened post-recovery `selectedIndex()` assertion at 9d96c41 → `expected -1 to be 1`; her fix direction on the two GENERATE returns → same assertion green; reverts pristine): the append's generated snapshot carries options but not the live selection, so the queue persists the pre-append `null` and real recovery restores four options with nothing selected — G6/T-H.7's frozen wording governs. All other findings MET and every referred item RATIFIED (amendment, [B1-PM] global reading, r1/r2 assumptions, [PH-F1] record + corrected mechanism, cost model) — BINDING, closed to relitigation. **PM error owned (the PB-F7 class, 4th instance):** r1 triage used [PH-F2] as a waiver and accepted T-H.7's re-scoped positional assertion — an assertion that could not fail when selection wiring was severed (D7) — where G6's letter required the selection to survive; Sol ratifies the F2 FACT (backlog stands) but strikes the waiver. CONTRACT-COUPLED: NO (PM-verified: `DraftPatch`/`mergePatch` already carry selection keys by presence). Consolidated remediation opened per the FILE's five items verbatim — fresh executor atop 9d96c41, §1.5 executor round 3/3; then PM verify → **Sol round 2/2 FINAL; a second FAIL goes to Brent (gate 5)**. | PH review r1; gate 7 | Codex Sol / PM |
| 2026-08-03 | **PH [B1] remediation landed & PM-VERIFIED at `phase/ph-costs`@ccb34f7** (3 commits atop 9d96c41; production = `taskFactories.ts` ONLY, +11/−2: both GENERATE patches carry the live selection read AFTER the guarded clear — append the surviving value, replace `null`; refine returns deliberately left bare and that boundary now pinned). Matrix 18→22 with full-patch `toEqual` on both branches + a production-`persist` block asserting what the QUEUE receives; T-H.7 strengthened at BOTH layers (persisted `selected_cover` and recovered `selectedIndex()`), its docstring naming the D7 defect the positional-only assertion had. PM re-verified with own hands: base-red at 9d96c41 → **11 failed** (ten matrix + T-H.7); **own [M2-PM] read-order mutation** (refs captured before the clear) → EXACTLY the 4 replace cases, 18 green — the ORDER is pinned, not just the key; gates Vitest **931/6 = Mesa six only**, tsc **1041↔1041** (458 distinct each side) and eslint **159↔159** identity deltas EMPTY both directions; hygiene exact with `main` moved to f5cfc7d (merge-base still exactly 1343513, its 9 new files overlap neither lineage nor PH). **Own contract check beyond the review:** `categoriesFromPatch` keys only on `coverOptions`/`endOptions` and the selection fields are first-class `CuentacuentosDraftFull` columns — the fix rides the existing contract, CONTRACT-COUPLED: NO confirmed. Executor deviation ACCEPTED and referred to Sol: two `toEqual` pins in `taskFactories.test.ts`'s already-divergent GENERATE blocks needed `selected*: null` — a THIRD divergence class (patch-shape), mechanically forced, raised not smuggled. Review-file correction recorded (the a3 blob string quoted in `PH-review-1.md` is not an object in this repo; the real blob is byte-identical base↔head). **Sol FINAL round 2/2 opened** (gate 3: judges the remediation matrix + permitted residue). FAIL ⇒ Brent (gate 5). | Gate 2; gate 3 | PM / executor |
| 2026-08-03 | **PH CLOSED** at `phase/ph-costs`@ccb34f7 (Sol FINAL r2/2 **PASS / CONFIRMED FIXED**, `reviews/PH-review-2.md`: [B1]'s five-item matrix FIXED IN FULL on her own evidence — independent base-red 11/12, her own [M2-PM] reproduction felling exactly the 4 replace cases, and a stronger full-multiline tsc comparison that was also empty; the third patch-shape divergence class RATIFIED as in-scope residue; the r1 a3-blob transcription CONFIRMED corrected; the existing-contract / no-new-upload-category check CONFIRMED; residue CLEAN; **G1–G10 and T-H.1–T-H.12 MET IN FULL**). §3.8 gates satisfied: PM verification + reviewer PASS both present; no gate-5 trigger, so no Brent close-word required (PC/PB/PG/PC-UI precedent). Close block written; **PREL FE lineage tip advances 8ceec7c → ccb34f7 and `phase/ph-costs` joins the protected set**; PREL input record refreshed in place (labeled) — main f5cfc7d, merge-base still exactly 1343513, FE overlap ZERO / EDGE overlap the one handler file, `fix/story-trunc` still unmerged at dfdccf0; PH's release-visible product changes added to PREL's carry list. **THIS WAS THE LAST BUILD PHASE: eight phases DONE-unmerged, PREL waits on Brent's start word alone.** **PM ROTATION**: this session ran bootstrap → PH spec draft → spec freeze (3 strikes verified) → r1 verification + [PH-F1] triage → r2 verification → review r1 triage with own [B1] reproduction → r3 verification → this close; context heavy; successor bootstrap issued. Freeze check renewed. | §3.8; rotation judgment | Codex Sol / PM |
| 2026-08-03 | **PREL bootstrap re-verification completed; PREL INPUT RECORD confirmed and corrected in place (labeled); PM HOLDS.** Incoming PM re-verified every handoff fact with own hands (16 refs; FE chain ×10 + EDGE chain ×4 + the three negatives; merge-base(main, each tip) = exactly 1343513 with `main` = `origin/main` = f5cfc7d UNMOVED; overlap FE ZERO / EDGE exactly `generate-story/handler.ts`, computed from each lineage's diff vs 2e9eeae; blobs ×4 exact; FE gates @ccb34f7 931/6 Mesa-six / tsc 1041 / eslint 159 @ node v22.22.0; EDGE gates @10d1190 325/0 / 94 / 46 @ deno 2.7.11; `jb list` clean, shared checkout and protected worktrees untouched). THREE new facts recorded: (1) **cross-lineage conflict surface PROVEN EMPTY** — FE-unique ∩ EDGE-unique = ∅ and the FE lineage touches no `supabase/**` path at all, so the entire integration has ONE conflict file and it is main × EDGE, never FE × EDGE; (2) **the EDGE lineage has NO remote copy** — 10d1190/db42745/96cb2cc/c496490/7d32182 are unreachable from every `origin/*` ref while the whole FE lineage resolves through `origin/phase/ph-costs`, so four closed reviewed phases live on one disk (a branch-ref push does not deploy and is not D9's `main` push, but is still separately authorized — recorded, NOT executed); (3) **`fix/story-trunc`@dfdccf0 read in full** — its three changes are each superseded by the EDGE lineage (16000 vs the tip's 16384; a max_tokens throw PD already types as 502; and `await response.text()` into two research-error logs, which is the PF [B3] raw-provider-body class the tip closes via `bodyShape()`), so one of them is actively contrary to a reviewed invariant. One labeled correction: "M3b in flight" is stale — `fix/child-race-mat`@318a75e ⊂ main with zero commits ahead; the M track is fully landed. No executable surface changed; freeze check renewed. Per gate 1 this turn ends with the consolidated Brent-gate message — the PREL start word, the `fix/story-trunc` disposition, the standing G6 no-banner veto, and the newly surfaced edge-lineage push question are all his; no executor/reviewer/bootstrap prompt exists to issue. | PREL preparation; PH-close handoff; gate 1 | PM |

## Backlog (SHOULD-FIX carry-ins, with origin)
- ~~**`PC-UI` — named release prerequisite (PLAN-review [P4], EXTENDED by PD spec review)**~~
  **PROMOTED TO PHASE PC-UI 2026-07-31 (Brent: BUILD)** — the accumulated scope moved into
  the phase section: render PC's `warnings` in the editor (non-blocking Spanish notice;
  all-failed banner), PFE lineage; PLUS (PD G2/G3): parse `warnings` from both success data
  AND `FunctionsHttpError.context` bodies; accept `source:"story"` / `PROP_NOT_RECURRING`;
  and own T-D.13 (`landmarkVisible` response → `Story.scenes` → persist/reload →
  scene-image request, mutation-proven). PREL waits on the phase's close.
- **`PD-REFINE` — was a named release prerequisite (PD spec review G6); Brent 2026-07-31:
  explicitly deferred POST-RELEASE.** Refinement-specific scene-count + image/ID-preservation
  semantics, then typed provider-output validation for `refine-story` (own D5 caller-shape
  check + D7 tests). Until it closes, PD's strict-output guarantee covers initial
  `generate-story` only — the release ships with that gap recorded as Brent's decision.
- ~~Stale knob-rationale comment at `handler.ts:70-72`~~ — ABSORBED into PD's scope (rides
  the same handler edit, per the spec's scope boundary).
- ~~**PFE follow-up (opened per the coupling rule, PD F3):** malformed-JSON on the
  `generate-story` body path changes its top-level response: 422 `INVALID_IMAGE_REF` (PF's
  bounded reader) → 400 `CLIENT_INPUT_INVALID`~~ **CLOSED 2026-08-01 at PC-UI** (G9/T-U.11:
  positive consumer proof — the unique Spanish 400 detail reaches the red surface via the
  production context parser; top-level `INVALID_IMAGE_REF` follows the generic detail path
  with no branch; per-entry copy retained; `M-F3-DETAIL`/`M-F3-TOPLEVEL` pinned, PM +
  reviewer independently re-run). (2026-07-30 → 2026-08-01)
- ~~`coverImageOptions`/`endImageOptions` base64 leak into `liturgia_elementos` (PB-F7)~~
  **STRUCK from backlog 2026-07-30 by PB review r1 [B1]:** the leak contradicts frozen
  G5 step-4 / T-B.9, so it is IN-PHASE remediation, not backlog. The "pre-existing at
  185c370, pinned not fixed" disposition was the PM's error, overturned by the review.
- **G5-suite header inaccuracy (Sol r2 note, non-blocking):** the header claims it mocks
  "only external boundaries" while naming `use-toast`; must not be cited as G7 evidence.
  One-line doc fix — rides the next FE round that touches these suites. (2026-07-31)
- **Reference-aware storage GC (opened by PB spec draft, from seed invariant 7):**
  content-hash immutability accumulates orphaned objects by design (re-selection,
  re-finalization, abandoned drafts). A delete/GC pass must be reference-aware across
  `image_paths`, `editorStateV1`, and finalized element configs — separate ticket, never
  part of PB. (2026-07-30)
- **Post-release RLS hardening option (opened by PB spec draft):** drop the
  `cuentacuentos-drafts` own-folder UPDATE policy once NO deployed client still calls
  `upsert:true` (live main has 5 such sites today, so this cannot precede the frontend
  release). PREL-sequenced infra decision for Brent; PB ships app-level immutability only.
  (2026-07-30)
- **Cover/end selection does not persist on the act of selecting ([PH-F2], origin PH r1
  2026-08-02; pre-existing at 8ceec7c, PM-code-verified):** `selected_cover`/`selected_end`
  ride along only when some OTHER write fires (authoritative envelope, manual save, or a
  buffer change in the A3/S5 auto-persist list — which omits selections). A user who selects
  and closes without any such write loses the selection on reload. Fix would extend the
  auto-persist list — outside PH's file scope; product-visible; for a later phase or PREL
  backlog triage.
- **Children's first names interpolated into AI prompts** (`generate-story`, `refine-story`) —
  violates CLAUDE.md:100 member-PII rule; pre-existing, flagged in FASE F round 1. Highest-priority
  backlog item.
- `generate-graphic` still `verify_jwt=false` live (A-graphic; source not in repo).
- English Gemini error strings in client-facing JSON (pre-existing carry-over vs D8).
- FASE F cleanup list: duplicated retry helpers, duplicated CORS constants, dead `fetchImpl`
  knobs, consumed-count constants duplicated module↔handlers — see memory `casa-fase-f-review2`.
- `maxTotalImageBytes = 14 MB` unmeasured against production photo sizes.
- HEIC works on Safari (canvas re-encode) but falls through on Chrome — document the asymmetry. (PFE r1 [S1])
- Scene-path skipped-notices accumulate and never auto-clear within a story; stale line persists
  until manual dismiss after the user fixes a photo and regenerates. Clean fix needs a
  pipeline-start hook. (PFE r2 [S2])
- ~~PFE follow-up (PF [B4] additive `skippedImages` on story error envelopes)~~ **CLOSED
  2026-07-29:** additive-only confirmed; PFE frontend already parses `InvokeError.skippedImages`
  on error paths (editor :653 at `cc-downscale-a`@185c370). Verified by Codex re-review + PM.
