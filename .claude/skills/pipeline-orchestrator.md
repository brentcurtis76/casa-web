# Pipeline Orchestrator

> Entry point for the autonomous pipeline. Reads pipeline state, determines which agent runs next, and manages transitions between steps. Invoke this skill whenever you see `/pipeline-start`, `/pipeline-status`, `/pipeline-next`, or when asked to "run the pipeline", "start a pipeline task", or "check pipeline status".

## What This Skill Does

The orchestrator is the conductor — it doesn't do the work itself, but it knows who should work next and what state the pipeline is in. It reads `.pipeline/` state files, identifies the current step, and tells you which agent skill to invoke next.

## Pipeline Flows

This pipeline supports two flow variants. The project's `pipeline-context.md` determines which flow to use.

### 10-Step Flow (FNE)

| Step | Agent | Output File | Next Step |
|------|-------|-------------|-----------|
| 1 | PM (spec) | `current-task.md` | → 2 |
| 2 | Architect (review) | `architect-review.md` | → 3 |
| 3 | DB Agent | `db-report.md` | → 4 |
| 4 | Developer | `dev-report.md` | → 5 |
| 5 | Security | `security-report.md` | → 6 |
| 6 | UX Reviewer | `ux-report.md` | → 7 |
| 7 | Architect (gate) | PASS or `gate-blocked.md` | → 8 (pass) or back to blocker |
| 8 | Architect (deploy) | `staging-url.txt` | → 9 |
| 9 | QA | `qa-report.md` | → 10 |
| 10 | PM (final review) | `pm-final-verdict.md` | → done or iterate |

### 9-Step Flow (CASA, Life OS)

| Step | Agent | Output File | Next Step |
|------|-------|-------------|-----------|
| 1 | PM (spec) | `current-task.md` | → 2 |
| 2 | Architect (review) | `architect-review.md` | → 3 |
| 3 | DB Agent | `db-report.md` | → 4 |
| 4 | Developer | `dev-report.md` | → 5 |
| 5 | Security | `security-report.md` | → 6 |
| 6 | UX Reviewer | `ux-report.md` | → 7 |
| 7 | PM (review) | `pm-review.md` | → 8 (on approve) |
| 8 | Architect (deploy) | `staging-url.txt` | → 9 |
| 9 | QA | `qa-report.md` | → done or iterate |

## How to Determine Current Step

Read these files in `.pipeline/` to figure out where things stand:

1. **`agent-status.json`** — Who ran last and whether they finished
2. **`iteration-count.txt`** — Current iteration (0 = first pass)
3. **Report files** — Which reports exist tells you how far the pipeline progressed
4. **`recommendations-backlog.jsonl`** — Persistent backlog of non-blocking recommendations from UX, Security, and QA across all tasks. The PM reads this during spec and writes to it during final review.

### Decision Logic

```
IF no current-task.md exists:
  → Step 1: Invoke PM (spec mode)

IF current-task.md exists BUT no architect-review.md:
  → Step 2: Invoke Architect (review mode)

IF architect-review.md exists BUT no db-report.md:
  → Step 3: Invoke DB Agent

IF db-report.md exists BUT no dev-report.md:
  → Step 4: Invoke Developer

IF dev-report.md exists BUT no security-report.md:
  → Step 5: Invoke Security

IF security-report.md exists BUT no ux-report.md:
  → Step 6: Invoke UX Reviewer

[10-step flow only]
IF ux-report.md exists BUT no staging-url.txt AND no gate-blocked.md:
  → Step 7: Invoke Architect (gate mode)

IF gate-blocked.md exists:
  → Route back to the agent named in gate-blocked.md

IF staging-url.txt exists BUT no qa-report.md:
  → Step 9: Invoke QA

IF qa-report.md exists BUT no pm-final-verdict.md:
  → Step 10: Invoke PM (final review mode)

[9-step flow only]
IF ux-report.md exists BUT no pm-review.md:
  → Step 7: Invoke PM (review mode)

IF pm-review.md exists with APPROVE BUT no staging-url.txt:
  → Step 8: Invoke Architect (deploy mode)

IF staging-url.txt exists BUT no qa-report.md:
  → Step 9: Invoke QA
```

## Iteration Handling

When QA or PM requests fixes (via `qa-fixes-required.md` or an iterate verdict):

1. Read the iteration count from `iteration-count.txt`
2. Increment it by 1
3. Archive the current iteration's reports to `.pipeline/archive/iteration-N/`
4. Route back to the appropriate agent (usually Developer for code fixes, DB for schema fixes)
5. The pipeline resumes from that point forward

Remember: on iteration 2+, all agent reports should be **deltas only** — what changed since last iteration. This is critical for keeping context windows manageable.

## Starting a New Task

When the user provides a new task or says `/pipeline-start`:

1. Check if there's an active pipeline task (`current-task.md` exists with incomplete status)
   - If yes, warn the user and ask whether to archive and start fresh
2. Read `request.txt` if it exists (the user's raw request)
3. Check `recommendations-backlog.jsonl` for open items — report the count to the user so they're aware of outstanding recommendations. The PM will evaluate which ones to absorb into the new task during spec.
4. Invoke the PM agent in spec mode to create `current-task.md`

## Invoking Agent Skills

Each agent has its own skill file in `.claude/skills/`. To run the next agent:

1. Read `pipeline-context.md` to load project-specific context
2. Read the appropriate agent skill (e.g., `pipeline-pm.md`)
3. Follow the skill's procedure
4. The agent will update `agent-status.json` and write its report

## Status Check

When asked for pipeline status (`/pipeline-status`):

1. Read `agent-status.json` for who ran last
2. Read `iteration-count.txt` for current iteration
3. List which report files exist in `.pipeline/`
4. Determine the current step using the decision logic above
5. Read `recommendations-backlog.jsonl` and count open vs resolved items
6. Report: current step, last agent, iteration count, any blockers, and backlog summary (e.g., "5 open recommendations, 12 resolved")

## Error Recovery

If `agent-status.json` shows a `"failed"` status:
- Report the error to the user
- The user decides whether to retry the same agent or skip ahead
- On retry, the agent starts fresh (its previous incomplete report should be deleted)

If an agent's status is `"running"` with no `"completed"` timestamp and significant time has passed:
- Treat as a potential crash
- Check if the report file exists and is complete
- If report exists and looks complete, update status to `"complete"` and proceed
- If report is missing or incomplete, treat as failed
