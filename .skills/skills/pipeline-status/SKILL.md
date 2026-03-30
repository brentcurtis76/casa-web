---
name: pipeline-status
description: "Dashboard for checking Jake's bridge pipeline task queue — what's running, completed, failed, or stuck. MUST use this skill when the user mentions: pipeline status, bridge tasks, bridge status, task queue, what's running, what failed, failed tasks, stuck tasks, task history, task monitor, pipeline dashboard, or '/pipeline-status'. Also trigger for casual phrasings like 'how's the pipeline', 'anything stuck', 'is my task done', 'did that task finish', 'what broke', 'any tasks in the queue', or 'check on the bridge'. This is specifically about the TASK QUEUE — not project health (use genera-project or casa-project for database/edge-function health), not the recommendations backlog (use recommendations-backlog), and not code review (use code-review). If the user asks 'is my CASA/GENERA task done' or 'did the bridge pick up my task', that IS this skill."
---

# Pipeline Status Monitor

You are a dashboard for Brent's multi-agent pipeline. Your job is to give a clear, scannable overview of what the bridge has been doing — what's running, what shipped, what broke, and what might be stuck.

## Why This Exists

The bridge pipeline runs tasks asynchronously through multiple agents (PM → Architect → DB → Developer → Security → UX → Refactor → QA → PM Final Review). Tasks can take minutes to hours. Without a quick way to check in, it's easy to lose track of what's in flight, what finished while you weren't looking, or what silently failed. This skill gives Brent a single command to get that picture.

## MCP Dependencies

- `jake_bridge` — `bridge_list_tasks`, `bridge_check_task`

## Procedure

### Step 1 — Fetch Recent Tasks

Call `bridge_list_tasks` to get the most recent tasks. If the user asked about a specific status (e.g., "any failed tasks"), filter accordingly. Otherwise, fetch all recent tasks (default limit is fine).

### Step 2 — Enrich with Details

For any task that looks interesting — running tasks, recently failed tasks, or tasks the user specifically asked about — call `bridge_check_task` to get the full result and thread history.

"Interesting" means:
- Status is `running` or `in_progress` (always check these)
- Status is `failed` (always check these)
- Status is `done` but completed in the last hour (worth surfacing)
- The user specifically mentioned a task or project

Don't check every single completed task from days ago — that's noise.

### Step 3 — Detect Stuck Tasks

A task might be stuck if:
- Status is `running` or `in_progress` but it was created more than 2 hours ago
- Status is `pending` and was created more than 30 minutes ago (the bridge polls every 60s, so pending tasks should get picked up quickly)

Flag these explicitly — they likely need Brent's attention.

### Step 4 — Format the Dashboard

Present the information in a clean, scannable format. Group by status:

```
## Pipeline Dashboard — [Date Time]

### Active (N)
- [task-id] [project] — [title] — running for [duration]

### Recently Completed (N)
- [task-id] [project] — [title] — completed [when] — [verdict: SHIP_IT/ITERATE/etc.]

### Failed (N)
- [task-id] [project] — [title] — failed [when] — [brief error]

### Stuck (N)
- [task-id] [project] — [title] — [status] for [duration] — likely needs attention

### Summary
[Total tasks in period] | [N completed] | [N failed] | [N active] | [N stuck]
```

Adapt this format based on what's actually there — if there are no failed tasks, don't show an empty "Failed" section. Keep it tight.

### Step 5 — Offer Actions

Based on what you found, suggest next steps:
- If a task is stuck: "Want me to check the logs for [task]?"
- If a task failed: "Want me to retry [task] or investigate what went wrong?"
- If everything looks clean: "All clear — nothing needs attention."
- If there are completed tasks with ITERATE verdicts: "Task [X] needs iteration — want me to check what QA flagged?"

## What This Skill Does NOT Do

- It does not post new tasks to the bridge — that's done through the GENERA/CASA project skills or direct bridge commands
- It does not modify task state — it's read-only
- It does not replace the project-specific health checks in GENERA/CASA skills — those check database errors, edge functions, etc. This skill is about the pipeline task queue specifically
