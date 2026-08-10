# SOP PILOT — reducing rework rounds without reducing scrutiny

Status: **ACTIVE PILOT**, started 2026-08-10, project CASA only.
Supersedes nothing. This is an amendment layer over `AGENT-WORKFLOW.md` §1–§4.
If the pilot fails its stopping rule, delete this file and the SOP is unchanged.

---

## 1. Why

Measured from this repo's own artifacts on 2026-08-10, not from any external claim.

**First-review PASS rate: 1 of 10 phases.**

| Phase | review-1 | review-2 | review-3 |
|---|---|---|---|
| M1 | PASS | — | — |
| M2 | FAIL | PASS | — |
| M3a | FAIL | PASS | — |
| M3b | FAIL | PASS | — |
| PB | FAIL | PASS | — |
| PC | FAIL | PASS | — |
| PG | FAIL | PASS | — |
| PD | FAIL | FAIL | — |
| PF | FAIL | FAIL | — |
| M-PLAN | FAIL | FAIL | PASS |

**Ledger rounds per phase:** PH 10 · PFE 8 · PD/M3a/M3b/M2 7 · PREL/PG/PC 6 · PF/PB 5 · M1 4.
Median ≈ 6.5.

The same pattern holds on GENERA: 19 FAIL / 16 PASS across 35 reviews, ~23 BLOCKING findings
that reached Codex *after* the PM had declared the phase clean, A1 at 11 rounds.

The diagnosis this pilot tests: **work is reaching the reviewer not-ready, and each rejection
costs a full executor + verification cycle.** Per-run latency is a minutes-scale problem;
first-pass rate is a rounds-scale problem. They are not the same size.

---

## 2. What changes

### C1 — Effort is explicit, and held constant within a session — **NOT A VARIABLE**

**Corrected 2026-08-10 by Brent, before phase 1 ran.** The config said `medium`, but in practice
he had been raising effort manually on essentially every session. So the baseline below — 1/10
first-review PASS, median 6.5 rounds — was already measured at high effort.

That kills the tempting hypothesis. The rework is not an effort problem, and C1 cannot be
credited with any improvement the pilot shows. Setting the global default to `high` is kept only
so the config stops lying about what actually runs. **C2 and C3 carry the entire pilot.**

Original rationale retained below for the record.

`~/.claude/settings.json` was running `effortLevel: "medium"`. Anthropic's documented API
default is `high` for both Fable 5 and Opus 5; effort governs *all* response tokens — thinking,
text, **and tool calls** — so `medium` produced fewer verification tool calls, not merely
shorter reasoning. Anthropic shipped `medium` as Claude Code's default on 2026-03-04 for latency
and reversed it on 2026-04-07 after quality complaints.

- Global is now `high`. **Changed 2026-08-10.**
- Executor may run `xhigh` on demanding phases (Anthropic's stated guidance for Opus 5 on
  demanding coding/agentic work).
- **Do not vary effort mid-conversation.** Changing it invalidates cached prefixes and raises
  time-to-first-token. Pick the level when the session opens; keep it.

Expect this change to make individual runs *slower*. That is the intended direction of trade.

### C2 — The executor is judged against the rubric it will actually be judged against

Today the executor is given acceptance criteria (§3.4) and the reviewer judges against a
*broader* rubric (§3.6): correctness, error handling, security, edge cases, scope creep, and
"anything that will make the NEXT phase harder." The executor never sees that second list.

**Change:** the §3.6 reviewer checklist is pasted into every executor prompt as a
pre-submission gate. Before emitting its report, the executor must self-check against it and
include a new report section:

```
PRE-SUBMISSION SELF-REVIEW (against §3.6 reviewer rubric)
- Acceptance criteria: <each ID, met/not met, how verified>
- Correctness / error handling / edge cases: <what I checked, what I could not>
- Frozen decisions (PLAN.md): <which apply, why this does not violate them>
- Scope creep: <anything touched outside SCOPE, and why>
- Next-phase cost: <anything I did that makes the next phase harder>
- Weakest part of this diff: <name it — the reviewer will find it anyway>
```

Rationale: this costs one paste and some executor tokens. It cannot reduce scrutiny — it adds
a check that did not exist. It is the cheapest available explanation for a 1-in-10 first-pass
rate.

### C3 — The PM's verification pass becomes a fresh-context adversarial review

§3.3 requires the PM to independently re-run tests, read the diff, and check each criterion.
Measured outcome: ~23 BLOCKING findings on GENERA passed through this stage and were caught
downstream. The stage is costing a serial pass and not filtering.

Two things are confounded in the current design. The downstream reviewer is both **a different
model family** *and* **a fresh context seeded with minimal information**. The one study
measuring cross-family review (arXiv 2604.19049) varies both at once and says so; its author
performed no ablation. If the benefit is mostly *fresh context*, it is available far earlier
and far cheaper.

**Change:** the PM no longer self-verifies. It writes the executor prompt and the ledger, and
dispatches a **fresh-context reviewer** — new session, no conversation history, seeded only
with the diff, PLAN.md acceptance criteria, the frozen decisions, and the §3.6 rubric — running
at `high` effort.

**No stage is removed.** A verification pass that demonstrably did not filter is replaced by
one designed to. The final cross-family review is untouched and retains final say on BLOCKING.

### C4 — Instrumentation

Nobody currently knows where the wall-clock goes; no source in the research corpus measures
anything resembling this pipeline. Every ledger round entry gains:

```
- ELAPSED: <wall-clock for this round, minutes>
- STAGE: executor <m> | fresh review <m> | triage <m>
- EFFORT: <level used by each actor this round>
- FIRST-PASS: <yes/no — did the first review of this phase PASS?>
```

Without this, the next iteration of the SOP is guesswork.

---

## 3. Metric and stopping rule

**Primary metric:** first-review PASS rate. Baseline **1/10 (10%)**.
**Secondary:** rounds per phase. Baseline median **6.5**.
**Guardrail:** BLOCKING findings that escape to the final cross-family review. Baseline: the
majority of them. This must go **down**, never up. If it rises, the pilot has traded quality
for speed and must be reverted regardless of the primary metric.

**Sample:** the next 4 CASA phases.

**Stop and revert if:**
- the guardrail rises, or
- first-review PASS rate is not above 3/4 phases by phase 4, or
- median rounds per phase does not fall below 5.

**Adopt into `AGENT-WORKFLOW.md` if:** first-review PASS ≥ 3/4 and the guardrail holds or falls.

An honest caveat: n=4 on a single project cannot separate C1 from C2 from C3. This pilot is
built to detect *whether the bundle helps*, not which part of it does. If the bundle works, the
next pilot ablates.

---

## 4. What this pilot deliberately does NOT do

- **No subagent fan-out inside a phase.** Measured: fan-out within a single task made runs
  1.15–2.3× *slower* in 6 of 6 comparisons (arXiv 2603.21489), because integration stays
  sequential and test-gated — which is exactly what the review gate is here.
- **No dropping the cross-family reviewer.** The strongest published argument against giving an
  LLM reviewer final say failed adversarial verification and cannot be used as a basis.
- **No lowering reviewer effort.** The claim that review accuracy holds at lower effort than
  generation was refuted 0-3 in verification. There is no evidence either way; do not run the
  reviewer cheap.
- **No property-based or mutation testing yet.** The supporting results were refuted 0-3. Not
  ruled out — unsupported by anything currently verified.
- **No fast mode.** It is Opus-only, so enabling it switches off Fable 5 — a model change, not
  a speed change — and it is a research preview whose headline latency figure failed
  verification.
