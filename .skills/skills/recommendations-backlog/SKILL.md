---
name: recommendations-backlog
description: "Surface, triage, and act on the pipeline's recommendations backlog — non-blocking UX, Security, and QA findings from previous pipeline runs stored in recommendations-backlog.jsonl. MUST use this skill when the user mentions: recommendations, backlog, deferred findings, outstanding items, what's been deferred, show recommendations, backlog status, triage backlog, what did UX/security/QA flag, cleanup backlog, tech debt, '/recommendations', or asks to batch/bundle backlog items into pipeline tasks. Also trigger when someone asks 'any accessibility issues piling up', 'what did we defer', 'mark rec-XXX as resolved', or 'what non-blocking stuff got flagged'. This is about the ACCUMULATED FINDINGS from past runs — not pipeline task status (use pipeline-status), not project health checks (use genera-project or casa-project), and not individual code reviews (use code-review)."
---

# Recommendations Backlog Manager

You help Brent see, prioritize, and act on the non-blocking recommendations that accumulate from pipeline runs. Every time the PM agent does a final review, it extracts MEDIUM and LOW findings from UX, Security, and QA reports and appends them to a persistent backlog. Over time, this backlog grows — and without someone actively triaging it, useful findings get buried.

## Why This Exists

The pipeline is designed so that only CRITICAL and HIGH findings block a task from shipping. Everything else — accessibility improvements, code quality suggestions, minor security hardening, design polish — gets captured in the backlog with the intention of being absorbed into future tasks. The PM agent does absorb relevant items when it specs new tasks in the same feature area, but some recommendations touch areas that don't get new work for a while. This skill makes the backlog visible and actionable.

## Backlog Location

The backlog lives at:
```
~/SecondBrain/.pipeline/recommendations-backlog.jsonl
```

If this file doesn't exist or is empty, there are no outstanding recommendations. Let Brent know and suggest he check back after a few pipeline runs.

Each line is a JSON object:
```json
{
  "id": "rec-001",
  "source_agent": "ux",
  "source_task": "Phase 4 Multi-Role Users",
  "date": "2026-02-10",
  "severity": "MEDIUM",
  "category": "accessibility",
  "description": "Add aria-labels to role selector dropdown in user profile",
  "status": "open",
  "resolved_in_task": null
}
```

## Procedure

### Step 1 — Load the Backlog

Read `~/.pipeline/recommendations-backlog.jsonl` (which is at `/Users/brentcurtis/SecondBrain/.pipeline/recommendations-backlog.jsonl` on the host, but in the Cowork VM it may be at `/sessions/fervent-sharp-hopper/mnt/SecondBrain/.pipeline/recommendations-backlog.jsonl`).

Parse each line as JSON. Separate into `open` and `resolved` items.

### Step 2 — Determine Intent

| User says... | Action |
|---|---|
| "show recommendations" / "backlog status" | Show summary dashboard (Step 3) |
| "recommendations for genera/casa" | Filter by project and show (Step 3 with filter) |
| "triage backlog" / "prioritize" | Show grouped view with suggested priorities (Step 4) |
| "batch these into tasks" / "create tasks from backlog" | Help bundle recommendations into bridge tasks (Step 5) |
| "mark [X] as resolved" | Update the backlog entry (Step 6) |
| "what did security flag" / "UX recommendations" | Filter by source_agent (Step 3 with filter) |

### Step 3 — Dashboard View

Present a summary of the current backlog state:

```
## Recommendations Backlog — [Date]

**Open:** [N] | **Resolved:** [N] | **Total:** [N]

### By Source Agent
- UX: [N] open
- Security: [N] open
- QA: [N] open

### By Category
- accessibility: [N]
- input-validation: [N]
- design-consistency: [N]
- performance: [N]
- [etc.]

### By Project (inferred from source_task)
- GENERA: [N] open
- CASA: [N] open
- Other: [N] open

### Open Items
| ID | Severity | Agent | Category | Description | Age |
|----|----------|-------|----------|-------------|-----|
| rec-001 | MEDIUM | ux | accessibility | Add aria-labels to role selector... | 28d |
| rec-002 | LOW | security | input-validation | Rate-limit the public search endpoint | 14d |
```

Keep it scannable. If there are many items, show the top 10 by age (oldest first) and mention how many more exist.

### Step 4 — Triage View

Group recommendations by what could reasonably be bundled together into a single pipeline task:

1. **Group by feature area** — items that touch the same components or pages
2. **Group by category** — e.g., all accessibility items, all input-validation items
3. **Suggest priority** based on:
   - Severity (MEDIUM before LOW)
   - Age (older items have been waiting longer)
   - Clustering (if 3 items touch the same component, doing them together is efficient)
   - Project activity (if GENERA has upcoming work, bundle GENERA items now so the PM can absorb them)

Present like:
```
### Suggested Bundles

**Bundle 1: CASA Accessibility Sweep** (4 items, all MEDIUM)
- rec-003: Add aria-labels to liturgy planner
- rec-007: Keyboard navigation for song repository
- rec-011: Contrast ratio on calendar view
- rec-015: Screen reader support for presentation mode
→ These all affect CASA's UI accessibility and could be a single pipeline task.

**Bundle 2: GENERA Input Validation** (2 items, MEDIUM + LOW)
- rec-002: Sanitize course description input
- rec-009: Rate-limit grade submission endpoint
→ Both are input validation on GENERA's API layer.
```

### Step 5 — Create Bridge Tasks from Bundles

When Brent approves a bundle, post it as a bridge task:

1. Compose a clear task description that references all the backlog item IDs
2. Post via `bridge_post_task` with the appropriate `project`
3. Follow up with `bridge_wait_for_task`
4. When the task completes, update the backlog entries (Step 6)

The task prompt should mention the backlog IDs so the PM agent can reference them in its spec and mark them as absorbed:

```
Address the following recommendations from the pipeline backlog:
- rec-003: [description]
- rec-007: [description]
- rec-011: [description]
- rec-015: [description]

These are non-blocking UX findings from previous pipeline runs. The PM should absorb these into the task spec as acceptance criteria.
```

### Step 6 — Update Backlog Entries

To mark items as resolved, read the full file, update the relevant entries' `status` to `"resolved"` and set `resolved_in_task` to the task title, then write the file back.

Be careful with the JSONL format — each line must remain a valid JSON object, one per line, no trailing commas, no array wrapper.

## What This Skill Does NOT Do

- It doesn't create new backlog entries — that's the PM agent's job during final review
- It doesn't change severity levels — those were set by the source agent based on their assessment
- It doesn't override the pipeline's judgment about what blocks vs. what doesn't
- It doesn't touch the project codebases — all code changes go through bridge tasks
