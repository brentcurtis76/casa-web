# HANDOFF — Workflow pilot (LANE 2: the process)

> Paste this into a fresh conversation to start the process lane.
> Its sibling is `HANDOFF-FEATURE.md` (lane 1). **This lane observes lane 1. It does not steer it.**

---

You run the workflow pilot for Brent. Your subject is *how the work gets done*, not the work.

Read first: `docs/plan/SOP-PILOT.md`, `docs/plan/AGENT-WORKFLOW.md`, then the `LEDGER.md` entries
dated 2026-08-10 onward. Say what you found before proposing anything.

Repo: `/Users/brentcurtis/dev/casa-web`. Working branch: `pilot/sop-v2` at
`/Users/brentcurtis/dev/casa-pilot`.

## The question

Brent's workflow — Fable plans, a fresh Opus executes, Codex reviews with final say — produces good
code and is too slow. Measured from his own ledgers **before** any change:

```
CASA    9 of 10 phases FAILED first review     median 6.5 rounds/phase, worst 10
FNE     19 FAIL / 16 PASS across 35 reviews    ~23 BLOCKING findings passed the PM stage undetected
plans   M-PLAN took 3 review rounds            FNE's PLAN took 4
```

The hypothesis under test: work reaches the reviewer not-ready, and each rejection costs a full
cycle. Cutting per-run latency saves minutes; raising first-pass rate deletes whole rounds.

## Changes under test

| | Change | Status |
|---|---|---|
| **C1** | Effort raised to `high` | **Dead as a variable** — Brent was already raising it by hand, so the baseline was measured at high effort |
| **C2** | Executor gets the reviewer's rubric up front, as a mandatory pre-submission self-review | Under test |
| **C3** | PM stops self-verifying; a fresh-context reviewer runs instead | Under test |
| **C5** | *Proposed.* Evidence log before any plan goes to review: every asserted fact carries the command that produced it; unverified claims labelled inline | Not yet applied |

## Scoreboard — update this as lane 1 produces entries

| Date | Item | Loop | First-review | Rounds | Notes |
|---|---|---|---|---|---|
| 2026-08-10 | PD-REFINE | execution | **PASS** | 1 | C3 PASS (0 blocking), then Codex PASS (0 blocking). Baseline 1/10 |
| 2026-08-10 | PLAN-BILINGUE v2 | planning | **FAIL** | 1 | Codex: 11 BLOCKING, 11 missing phases. Baseline M-PLAN = 3 rounds |

**Execution loop: 1/1. Planning loop: 0/1.** The stopping rule needs 4 phases; do not call it early.

## What has actually been learned

1. **C2 works on execution and fails on planning, structurally.** Self-review catches sloppiness in
   what you did. It cannot discover a fact you never looked up. The bilingual plan's self-review
   named its own blind spot verbatim — *"I did not verify print/PDF, presentation, notifications"* —
   and was submitted anyway. All three turned out to hide blocking findings.
2. **Cross-family review added almost nothing on execution.** Codex's findings on PD-REFINE were a
   strict subset of the fresh-context Claude reviewer's. Both independently converged on the same
   weak test via mutation testing. The one thing Codex added was checking the tool schema against
   live vendor docs — a *capability* gap (web access), not a model-family gap.
3. **But cross-family review was devastating on planning.** Eleven blockers nobody else had found.
   **Do not drop the second reviewer on one good execution result.**
4. **Two PM process bugs, both real:**
   - A question was asked of Brent that the codebase could answer (`transcribe-meeting`). He
     answered in good faith, the code disagreed, and it entered the plan as verified fact.
     *Never ask what you can grep.*
   - `AGENT-WORKFLOW.md` never existed in the CASA repo — only in `fne-lms`. PD-REFINE's executor
     and both reviewers were held to a contract they could not read. Fixed 2026-08-10.
5. **The PM contaminated round 1** by running six verification commands before dispatching C3,
   which C3 exists to replace. Nothing was found and nothing was fed back, so the damage was small,
   but the rule was broken in the first round it existed.

## What the outside evidence does and does not support

Two deep-research runs, 50 claims adversarially verified, 22 killed. Load-bearing results:

- **Fan-out inside a single task made runs 1.15–2.3× SLOWER** in 6 of 6 comparisons — integration
  stays sequential and test-gated. Do **not** add subagents inside a phase.
- **Dependency-graph partitioning was Pareto-improving** (2.10× faster, +14 pass points) — but
  Python-only, and TS/Supabase dependency graphs are largely implicit.
- **The one thing three independent sources converge on is deterministic verification** — automated
  tests, version-control maturity, fast feedback — **not** more model-based review.
- **Refuted, do not act on:** "Opus 5 self-verifies so you can strip verification steps" (0-3);
  "review accuracy holds at lower effort than generation" (0-3); property-based testing repairs
  75.9% of flawed solutions (0-3); "multi-agent unanimity isn't evidence of correctness" (0-3).
- **Nothing measured whether a heavyweight multi-agent pipeline beats one good model behind strong
  CI gates.** Untested in either direction. Brent's ledger is better instrumented on this question
  than the published literature is.

## How you observe lane 1

The ledger is the interface. Lane 1 writes an entry per round with `ELAPSED`, `STAGE`, `EFFORT`
and `FIRST-PASS`; you read them and update the scoreboard above. Also read `docs/plan/reviews/`
for what each reviewer actually caught.

**You do not direct lane 1.** If you conclude the SOP needs changing, amend `SOP-PILOT.md` and tell
Brent; he decides whether lane 1 adopts it. A process lane that starts steering the feature lane
stops being able to measure it.

## Standing cautions

- n is small. Two data points. Resist concluding.
- Do not let this lane become theory. Every proposed change should trace to something that
  actually happened in the ledger.
- The stopping rule in `SOP-PILOT.md` includes a guardrail: BLOCKING findings escaping to final
  review must go **down**, never up. If that rises, the pilot reverts regardless of speed.
