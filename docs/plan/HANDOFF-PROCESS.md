# HANDOFF — Workflow pilot (LANE 2: the process)

> Paste this into a fresh conversation to start the process lane.
> Its sibling is `HANDOFF-FEATURE.md` (lane 1). **This lane observes lane 1. It does not steer it.**

---

You run the workflow pilot for Brent. Your subject is *how the work gets done*, not the work.

Read first, in order, and say what you found before proposing anything:

1. `~/.claude/agent-workflow/AGENT-WORKFLOW.md` — the SOP (**canonical, 511 lines — not a repo copy**)
2. `~/.claude/agent-workflow/workstreams.md` — where each workstream's plan, ledger and reviews live
3. `docs/plan/SOP-PILOT.md` — the pilot's design and stopping rule
4. `docs/plan/LEDGER.md` entries dated 2026-08-10 onward — the pilot and PD-REFINE record
5. `docs/plan/bilingue/LEDGER.md` — lane 1's ledger, **once `/plan-new BILINGUE` has created it**

Repo: `/Users/brentcurtis/dev/casa-web`. Working branch: `pilot/sop-v2` at
`/Users/brentcurtis/dev/casa-pilot`.

**Two ledgers, deliberately.** CASA's root `docs/plan/LEDGER.md` is shared by the CUENTOS and
MATERIALES workstreams and holds the PD-REFINE and pilot entries. BILINGUE is new work and gets its
own at `docs/plan/bilingue/LEDGER.md`. Watch both.

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
   - **The SOP reference was wrong, and the first fix was worse.** `SOP-PILOT.md` said
     "`AGENT-WORKFLOW.md`" with no path, which reads as repo-relative; Codex [B11] flagged that no
     such file existed in casa-web. The fix copied the **427-line** version from `fne-lms` into the
     repo — 84 lines behind the canonical 511-line file at `~/.claude/agent-workflow/`, missing
     §1.2 and §1.8 — creating a third drifting copy. Copy removed; the reference now points at the
     canonical path. **Lesson: a missing-file finding is not automatically a copy-the-file fix.
     Find where the file actually lives first.**
   - A whole layer existed that the PM never looked for: `~/.claude/agent-workflow/workstreams.md`,
     the registry mapping workstream nicknames to plan/ledger/review locations, plus the
     `/plan-new`, `/pm-boot` and `/exec` commands that implement SOP §3.1/§3.3/§3.4. The PM
     hand-rolled a planner prompt and a PM handoff that already existed as commands. **Check what
     tooling exists before building a worse version of it.**
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

## Where you run, and how you observe lane 1

**Run this conversation from `/Users/brentcurtis/dev/casa-pilot`** — the worktree on `pilot/sop-v2`.
It holds `SOP-PILOT.md`, both handoffs, the pilot ledger entries and the reviews. You write here.

**Lane 1 runs in `/Users/brentcurtis/dev/casa-web`** on a branch cut from `pilot/sop-v2`. Two
worktrees cannot share a branch, so you will never see its files in your own tree. Read them
directly off disk — same machine, different directory:

```
/Users/brentcurtis/dev/casa-web/docs/plan/bilingue/LEDGER.md      ← lane 1's ledger
/Users/brentcurtis/dev/casa-web/docs/plan/bilingue/reviews/       ← what each reviewer caught
/Users/brentcurtis/dev/casa-web/docs/plan/bilingue/PLAN.md        ← the plan as it stands
```

No fetching, no branch juggling. If a path is missing, `/plan-new BILINGUE` has not run yet.
Confirm with `git -C /Users/brentcurtis/dev/casa-web worktree list` if you need to see where lane 1
actually is.

The ledger is the interface. Lane 1 writes an entry per round with `ELAPSED`, `STAGE`, `EFFORT`
and `FIRST-PASS`; you read them and update the scoreboard above. Also read the root
`docs/plan/reviews/` in your own tree for the PD-REFINE and BILINGUE-v2 history.

**You do not direct lane 1.** If you conclude the SOP needs changing, amend `SOP-PILOT.md` and tell
Brent; he decides whether lane 1 adopts it. A process lane that starts steering the feature lane
stops being able to measure it.

## Standing cautions

- n is small. Two data points. Resist concluding.
- Do not let this lane become theory. Every proposed change should trace to something that
  actually happened in the ledger.
- The stopping rule in `SOP-PILOT.md` includes a guardrail: BLOCKING findings escaping to final
  review must go **down**, never up. If that rises, the pilot reverts regardless of speed.
