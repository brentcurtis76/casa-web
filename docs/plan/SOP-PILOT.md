# CASA lean workflow pilot

Status: **ACTIVE**, version 2 from 2026-08-11.

The executable rules live once at
`~/.claude/agent-workflow/LEAN-WORKFLOW.md`. They activate for every checkout
whose Git common directory is `/Users/brentcurtis/dev/casa-web/.git`, including
`casa-web`, `casa-pilot`, `casa-upgrade`, `casa-e3a`, `casa-e3b`, and
`casa-p2-review`. This file records CASA-specific gates, measurements, and pilot
history; it is not another copy of the shared workflow.

Rollback is safe: mark the shared overlay inactive or remove CASA from its
activation list. `~/.claude/agent-workflow/AGENT-WORKFLOW.md` remains unchanged.

## Project guardrails

The active checkout's `CLAUDE.md` remains authoritative. In particular:

- never touch the 11 Life OS tables in CASA's shared Supabase project;
- additive migrations only; synthetic test data only; member PII never enters
  prompts, commits, logs, or Open Brain;
- branch names are at most 20 characters;
- run `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and
  `npx playwright test` before a code phase is review-ready; and
- never merge to `main` without Brent's explicit instruction.

Any phase involving the shared database, migrations, auth/RBAC/RLS, PII,
publication, deployment/release, external messaging, or security is `HIGH` risk.
Ordinary isolated UI or documentation work may be `STANDARD`. Inventory work
whose completeness cannot be established is `DISCOVERY` and must name blind
spots and safe failure direction.

## Starting gate baseline

Verified 2026-08-11 in the clean `main` worktree at
`d5b16e8fc71e3abfc3b4de19d7f51338b75b40f9`:

- `npx tsc --noEmit` passed;
- `npm run build` passed;
- `npm run lint` failed with 118 errors and 43 warnings; and
- `npm test -- --run` failed 15 of 1,099 tests across three files.

The live D1a checkout had the same broad lint/test classes, with one fewer lint
error and one fewer failing test file. This establishes repository debt, not a
waiver. Under the shared baseline-red protocol, CASA stays blocked from a
production-quality close until a bounded stabilization phase restores the hard
gates. Record the base result once and compare exact failure IDs; do not spend
every feature round rediscovering the counts or quietly call them green.

CASA browser tests are additionally protected by the repository safety guard.
The 2026-08-11 local run stopped because `.env.test` was absent. Never bypass the
guard or point the suite at CASA's shared Life OS Supabase project; configure the
documented isolated test environment first.

## Why version 1 was replaced

CASA's pre-pilot baseline was slow: first-review PASS was 1 of 10 sampled phases
and the median was about 6.5 recorded rounds per phase. Version 1 attempted to
improve readiness by adding a fresh-context Claude review before final Codex
review. That preserved quality but added another serial handoff.

The evidence does not support the earlier broad claim that this fresh-context
stage found D1a's blockers. In `docs/plan/bilingue/LEDGER.md`, D1a rounds 2 and 3
were performed by the existing `BILINGUE · plan · PM` session. They were not the
new C3 reviewer. The only clean C3 execution sample in the original pilot was
PD-REFINE. Conclusions that treated D1a as additional C3 evidence are retired.

Version 2 tests a simpler hypothesis: production quality comes from a bounded,
evidence-backed phase contract, deterministic gates, and one genuinely
independent final review—not from repeatedly moving the same diff through fresh
conversations.

## CASA test sample

Apply version 2 to the next four completed CASA phases across any workstream. Do
not restart completed phases or reset an in-progress phase's attempt count.

For each phase, append the shared overlay's actual metrics to its authoritative
ledger:

```text
STARTED: <ISO-8601>
ENDED: <ISO-8601>
ATTEMPT: <cumulative>
RISK: STANDARD | HIGH | DISCOVERY
HANDOFFS: <count>
GATES: <commands and results>
CODEX: PASS | FAIL(<blocking count>) | FINDINGS
ESCAPED DEFECT: none | <post-PASS defect>
```

Evaluate after four phases against the historical baseline:

- median elapsed time from PM bootstrap to final PASS;
- median human handoffs;
- cumulative attempts to PASS;
- post-PASS defects, rollbacks, security/privacy incidents, and red-gate
  overrides.

Keep the faster flow only if time and handoffs fall without worsening the quality
guardrails. A blocker Codex catches before PASS is not an escaped defect.

## Worktree discipline

Before every phase, run `git worktree list`, `git status --short --branch`,
`git rev-parse --show-toplevel`, and
`git rev-parse --path-format=absolute --git-common-dir`. Use the phase branch and
live plan/ledger to choose the checkout. Never delete or move a dirty, ahead, or
unreviewed worktree as part of this pilot.
