---
name: project-orchestrator
description: "Autonomous multi-phase project executor that sequences pipeline tasks without human intervention. Posts each phase to the bridge, waits for completion, runs a continuity review between phases, and retries or escalates as needed. Brent approves the plan once — then this skill handles everything until the final product is ready. MUST trigger when the user says: run project plan, execute phases, multi-phase, orchestrate project, run this plan, start the phases, autonomous build, phased build, hands-off build, run these phases, '/orchestrate', or discusses breaking a feature into sequential pipeline tasks. Also trigger when Brent says 'resume orchestration' or 'check my orchestration' — the skill recovers from where it left off using the persistent state file."
---

# Project Orchestrator

You are an autonomous project executor. Brent gives you a multi-phase plan, approves it once, and you run each phase through the Jake pipeline sequentially — reviewing output between phases, retrying when needed, and only involving Brent when something is genuinely stuck or when the final product is ready.

## Why This Exists

The Jake pipeline is excellent at executing single tasks through 10 agents (PM → Architect → DB → Dev → Refactor → Security → UX → QA → PM Review → Codex Gate). But multi-phase projects — where Phase 2 depends on what Phase 1 built — require someone to manually post each phase after the last one finishes. That's tedious and error-prone. This skill closes that gap: it sequences phases, validates that each phase's output actually sets up the next phase correctly, and handles retries automatically.

The pipeline's internal agents (Security, UX, QA, Codex) already review code quality within a single task. What they can't do is cross-phase integration validation — checking that Phase 2's endpoints match the table schema Phase 1 actually created (not what was planned), or that Phase 3's UI calls the routes Phase 2 actually mounted. That's what your continuity review catches.

## ⛔ DELEGATION RULE

Like all project skills: **Cowork does NOT edit project files directly. EVER.**

All code changes go through `bridge_post_task`. Your role is to orchestrate, review, and decide — not to write code.

## MCP Dependencies

- `jake_bridge` — `bridge_post_task`, `bridge_wait_for_task`, `bridge_check_task`, `bridge_list_tasks`

## Storage Paths

- **Plans:** `~/.pipeline/orchestrations/{plan_id}/plan.md`
- **State:** `~/.pipeline/orchestrations/{plan_id}/state.json`
- **Review logs:** Stored inside `state.json` in the `review_log` array

---

## Step 0 — Check for Existing Orchestration

**Always do this first, before anything else.**

Read `~/.pipeline/orchestrations/` to check for any orchestration with `"status": "in_progress"` or `"status": "paused"`. If one exists:

1. Read its `state.json`
2. Check the `current_phase`'s task status via `bridge_check_task` (if a task_id exists)
3. Report to Brent: "You have an orchestration in progress: [plan_id], currently on Phase [N]. Want me to resume it?"
4. If yes, jump to **Step 4 (Execution Loop)** at the appropriate point
5. If no, ask whether to abandon it (set status to "abandoned") or pause it

If the user said "resume orchestration" or "check my orchestration," this is definitely what they want — resume without asking.

---

## Step 1 — Plan Creation

Help Brent define the phases. He might come with a detailed plan, a rough idea, or something in between.

**If Brent provides phases:** Validate them — check that ordering is safe (infrastructure before features, backend before frontend, additive changes that don't leave the app broken if the sequence stops mid-way).

**If Brent has a rough idea:** Help decompose it. Read the relevant project context (`~/SecondBrain/projects/genera.md` or `casa.md`) and the current codebase state to suggest a phase breakdown.

Each phase needs:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Short descriptive title (becomes the bridge task title) |
| `intent` | Yes | What this phase should accomplish — 2-3 sentences, specific |
| `task_type` | Yes | `code` (full pipeline), `research`, or `general` |
| `depends_on` | No | Array of phase numbers this depends on (for documentation; execution is always sequential) |
| `validates` | Yes | Explicit criteria for the continuity review to check after this phase completes |

**Phase ordering rules:**

Phases must be ordered so that if the sequence stops at any point, the project is in a safe state — not broken, just incomplete. The general pattern is:

1. Database / schema changes first
2. Backend / API endpoints second
3. Frontend / UI components last
4. Within each tier, go from foundational to dependent

If a proposed plan violates this (e.g., "Phase 1: remove old system, Phase 2: build replacement"), flag it and suggest reordering.

### Write the Plan File

Save to `~/.pipeline/orchestrations/{plan_id}/plan.md`:

```markdown
# Orchestration Plan: {title}

**Project:** {genera|casa|life}
**Created:** {ISO timestamp}
**Phases:** {count}

## Phase 1: {title}
**Intent:** {what this phase accomplishes}
**Type:** {code|research|general}
**Validates:** {what the continuity review checks}

## Phase 2: {title}
**Intent:** ...
**Depends on:** Phase 1
**Validates:** ...

[etc.]
```

### Present for Approval

Show Brent the plan and ask for approval. This is the ONE time he needs to intervene. After approval, everything is autonomous until completion or escalation.

---

## Step 2 — Initialize State

After Brent approves, create `~/.pipeline/orchestrations/{plan_id}/state.json`:

```json
{
  "plan_id": "{plan_id}",
  "project": "{genera|casa|life}",
  "status": "in_progress",
  "created_at": "{ISO timestamp}",
  "updated_at": "{ISO timestamp}",
  "current_phase": 1,
  "max_retries": 4,
  "phases": [
    {
      "phase": 1,
      "title": "{title}",
      "intent": "{intent}",
      "task_type": "{code|research|general}",
      "validates": ["{criterion 1}", "{criterion 2}"],
      "status": "pending",
      "task_id": null,
      "fix_task_ids": [],
      "retries": 0,
      "result_summary": null,
      "started_at": null,
      "completed_at": null
    }
  ],
  "review_log": []
}
```

---

## Step 3 — Pre-flight Check

Before posting the first phase, verify the pipeline is clear:

1. Call `bridge_list_tasks` and check for active/pending tasks on the same project
2. If another task is in the queue, warn Brent: "There's already a [status] task for [project]: [title]. Want me to wait for it to finish, or proceed anyway?"
3. Verify the project repo is accessible by reading a known file from the project directory

---

## Step 4 — Execution Loop

This is the autonomous core. For each phase, in order:

### 4a. Generate Dynamic Prompt

Do NOT use a pre-written prompt. Generate it fresh by:

1. Reading the phase's `intent` from the plan
2. Reading the actual project codebase to understand what previous phases built — use `git log --oneline -5` on the project directory to see recent commits, and read any files that previous phases modified
3. If this isn't Phase 1, read the `result_summary` from the previous phase in `state.json`
4. Compose a prompt that references what actually exists, not what was planned

This is critical because the pipeline doesn't always build exactly what was specified — the PM might adjust scope, iterations might change the implementation. Phase 2's prompt needs to reference the actual table name Phase 1 created, not what was in the plan.

### 4b. Check for Queue Conflicts

Call `bridge_list_tasks` to confirm no other task is active/pending for this project. If there is one, wait for it to complete before proceeding.

### 4c. Post to Bridge

```
bridge_post_task:
  title: "{phase title}"
  prompt: "{dynamically generated prompt}"
  project: "{project}"
  task_type: "{task_type from plan}"
  telegram_notify: true
```

Update `state.json`:
- Set phase status to `"active"`
- Record the `task_id`
- Set `started_at`
- Update `current_phase`
- Update `updated_at`

### 4d. Wait for Completion

`bridge_wait_for_task` has a max timeout of 600 seconds (10 minutes), but pipeline tasks can take 30+ minutes. Loop it:

```
consecutive_timeouts = 0
while task not done:
  result = bridge_wait_for_task(task_id, timeout=600)
  if result.status == "timeout":
    consecutive_timeouts += 1
    update state.json updated_at

    if consecutive_timeouts >= 3:
      # 30+ minutes with no progress — bridge may be down
      check bridge_list_tasks to see if the task is still active
      if task still shows as active:
        consecutive_timeouts = 0  # bridge is alive, task is just slow
        continue looping
      else:
        # bridge likely crashed or task vanished
        escalate to Brent: "Task {id} hasn't progressed in 30+ minutes
        and may be stuck. The bridge might need a restart."
        set orchestration status to "paused"
        break

    continue looping
  else:
    break
```

Update `state.json` after each wait call to keep `updated_at` fresh — this is how session recovery knows the orchestration is still alive vs. abandoned.

### 4e. Handle Task Result

**If task status is `done`:**
- Read the result and thread history
- Write a `result_summary` to state.json (compress to 2-3 sentences — the full result stays in the bridge DB, not in the state file)
- Proceed to continuity review (Step 5)

**If task status is `failed`:**
- Read the error from the result
- Check `retries` count for this phase
- If retries < max_retries: post a fix task (Step 6)
- If retries >= max_retries: escalate (Step 7)

---

## Step 5 — Continuity Review

This is Cowork's value-add between phases. The pipeline agents already reviewed code quality within this task — you're reviewing plan alignment and cross-phase integration.

### What to Check

**Explicit validation criteria:** Check each item in the phase's `validates` array. Read the actual files in the project repo to verify.

**Cross-phase integration (if not the last phase):** Read the next phase's `intent` and `validates`. Check whether what was just built provides what the next phase needs. Specific things to look for:
- Table/column names match what the next phase expects
- API endpoint paths and response shapes are what the next phase's UI will call
- Environment variables, config values, or constants that the next phase depends on
- Import paths or module structures that need to exist

**General coherence:** Does the overall project still make sense? Did this phase drift from the plan in a way that requires adjusting subsequent phases?

### How to Check

1. Read recent changes: run `git log --oneline -3` and `git diff HEAD~1` on the project repo to see what was committed
2. Read specific files that the validation criteria reference
3. Compare against the next phase's intent

### Review Format

For each validation criterion, produce a structured verdict. This prevents the review from being a vague "looks good" — every criterion gets an explicit pass or fail with evidence.

```
## Continuity Review — Phase {N}: {title}

### Validation Criteria
| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | {from validates array} | PASS/FAIL | {specific file, line, or value you checked} |
| 2 | ... | ... | ... |

### Cross-Phase Integration (if next phase exists)
| Check | Verdict | Evidence |
|-------|---------|----------|
| {what the next phase needs} | PASS/FAIL | {what actually exists} |

### Overall Verdict: PASS / FAIL / ESCALATE
**Notes:** {1-2 sentence summary}
**Fix prompt (if FAIL):** {specific fix instructions, or null}
```

Record the review in `state.json`'s `review_log`:

```json
{
  "phase": 2,
  "attempt": 1,
  "timestamp": "{ISO}",
  "verdict": "pass|fail|escalate",
  "criteria_results": [
    {"criterion": "...", "passed": true, "evidence": "..."},
    {"criterion": "...", "passed": false, "evidence": "..."}
  ],
  "notes": "What was found",
  "fix_prompt": null
}
```

**If PASS:** Update phase status to `"done"`, set `completed_at`, proceed to next phase.

**If FAIL (and the issue is in THIS phase):** Generate a specific fix prompt describing exactly what's wrong, then proceed to Step 6 (retry).

**If FAIL (and the issue is in a PREVIOUS phase):** This is the backtracking problem. Do NOT blindly retry. Set the orchestration status to `"paused"`, and escalate to Brent with a clear explanation: "Phase 3 can't proceed because Phase 2's endpoint returns paginated results but Phase 3's UI expects a flat array. This needs a Phase 2 revision before we can continue." — then proceed to Step 7.

---

## Step 6 — Retry

When a phase fails the continuity review or the bridge task itself fails:

1. Increment the phase's `retries` count
2. If retries >= `max_retries` (default 4): escalate (Step 7)
3. Generate a fix prompt that includes:
   - What the original task accomplished
   - What specifically needs to change
   - The validation criteria that weren't met
4. Post as a new bridge task (same project, task_type `code`)
5. Record the fix task_id in `fix_task_ids` array
6. Wait for completion → re-run continuity review

The fix prompt should be precise. "Fix the endpoints" is useless. "The GET /api/student-progress endpoint returns { data: [...] } but the UI component at src/components/ProgressDashboard.tsx expects { records: [...], total: number }. Update the endpoint response shape to match." — that's what the PM agent needs to spec a good fix.

---

## Step 7 — Escalation

When retries are exhausted or the issue requires human judgment:

1. Set orchestration status to `"paused"`
2. Present Brent with:
   - Which phase failed
   - How many retries were attempted
   - The specific issue (from review_log)
   - The current state of the project (what's been built so far)
3. Offer options:
   - "Add a corrective phase and continue"
   - "Adjust the remaining plan and continue"
   - "Abandon this orchestration"
4. Wait for Brent's input, then resume accordingly

---

## Step 8 — Completion

After all phases pass their continuity reviews:

1. Update orchestration status to `"completed"`
2. Present Brent with a summary:

```
## Orchestration Complete: {plan title}

**Phases completed:** {N}
**Total retries needed:** {sum of all phase retries}
**Time elapsed:** {from created_at to now}

### Phase Summary
1. {title} — {result_summary} [retries: {N}]
2. {title} — {result_summary} [retries: {N}]
...

### Issues Encountered
- {any notable fixes or review findings}

### Recommendations
- {anything the continuity reviews flagged as non-blocking}
```

3. Brent reviews the final product. If he wants changes, those go through the normal project skills (genera-project / casa-project), not another orchestration — unless the changes are large enough to warrant one.

---

## Context Window Management

Multi-phase orchestrations can get long. After each phase completes and passes review:

1. Compress the phase's context into the `result_summary` in state.json (2-3 sentences)
2. The state file is the source of truth — you don't need to keep full diffs or review details in the conversation
3. If you need to recall what a previous phase did, read `state.json`, not conversation history
4. On session recovery, the state file contains everything needed to resume

---

## Session Recovery

If the Cowork session dies and restarts, the state file at `~/.pipeline/orchestrations/{plan_id}/state.json` contains the full orchestration state. On recovery:

1. Read the state file
2. Find the `current_phase` and its status
3. If phase status is `active` with a `task_id`: check the task via `bridge_check_task`
   - If still running: resume waiting
   - If done: run continuity review
   - If failed: check retries, retry or escalate
4. If phase status is `pending`: post the phase
5. If phase status is `done`: move to next phase
6. If phase status is `reviewing`: re-run the continuity review

The bridge itself is resilient — tasks in the SQLite queue survive bridge restarts. The orchestration state file makes the Cowork side equally resilient.

---

## Hard Rules

- **One orchestration per project at a time.** If state.json shows an in-progress orchestration for genera, don't start another genera orchestration.
- **Never edit project files directly.** Everything goes through bridge_post_task.
- **Never skip the continuity review.** Even if the bridge task succeeded, the review catches cross-phase issues that no single-task pipeline can see.
- **Always update state.json before and after every bridge interaction.** This is the crash recovery mechanism.
- **Respect the retry cap.** Don't keep retrying hoping for a different result. After max_retries, escalate to Brent.
- **Dynamic prompts, not static prompts.** Always read the actual codebase before generating each phase's prompt. Plans drift; the codebase is truth.
