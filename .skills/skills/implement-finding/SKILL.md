# Implement Finding Skill

## Trigger

### Trigger Phrases
- "implement finding" / "implement this finding"
- "implement insight" / "apply this insight"
- "implement YouTube finding #N"
- "let's implement the [finding description]"
- Invoked automatically by daily-briefing when Brent approves a YouTube Intel finding

### When NOT to Trigger
- User wants to see findings → use **youtube-intel** skill
- User wants the daily briefing → use **daily-briefing** skill
- User wants to run the full pipeline directly → use **genera-project** or **casa-project** skill

## Purpose

Planning gate between a raw YouTube Intel finding and a full pipeline run. This skill:
1. Takes a finding from `~/SecondBrain/data/youtube-intel/findings.json`
2. Researches the relevant parts of Brent's codebase to understand what exists
3. Produces a scoped implementation plan
4. Posts the pipeline task via `bridge_post_task`
5. Updates the finding's status in findings.json

This prevents the PM agent from misunderstanding scope or making wrong assumptions about the architecture.

## Execution Mode

This skill runs in TWO modes:

**Interactive mode** (Brent is in the conversation):
- Present the plan summary and ask for approval before posting the pipeline task

**Headless mode** (invoked via bridge_post_task from daily-briefing or scheduled task):
- Write the plan, then IMMEDIATELY post the pipeline task — do NOT ask for approval
- Brent already approved when he said "yes" in the briefing; asking again in a headless session creates a dead end
- The plan file persists at `~/SecondBrain/data/youtube-intel/plans/{video_id}.md` for review

**How to detect mode:** If the conversation started with a bridge task prompt (contains "Read the implement-finding skill"), you are in headless mode. Otherwise, interactive.

## Input

The finding object (from findings.json) with these fields:
- `video_id`, `title`, `channel`, `url`
- `relevance` (high/medium/low)
- `summary` — what's actionable
- `relevant_to` — array of: pipeline, memory, routing, workflow
- `key_insight` — the specific technique/pattern/tool
- `status` — tracking field: new/planned/implementing/implemented/skipped

## Steps

### 1. Understand the Finding
- Read the finding's `key_insight` and `summary`
- Identify which systems are affected from `relevant_to`:
  - `pipeline` → `~/SecondBrain/pipeline/agents/`, `~/SecondBrain/claude_code_router.py`
  - `memory` → Open Brain (Supabase pgvector), `~/SecondBrain/llm_clients.py`
  - `routing` → `~/SecondBrain/claude-code-router.yaml`, `~/SecondBrain/claude_code_router.py`
  - `workflow` → `~/SecondBrain/bridge.py`, `~/SecondBrain/jake_bridge_mcp.py`, skills

### 2. Research Current State
Based on `relevant_to`, read ONLY the files that matter:

**If pipeline:**
- Read `~/SecondBrain/pipeline/agents/` — list files, read relevant agent .md files
- Read `~/SecondBrain/claude_code_router.py` (routing logic)

**If memory:**
- Read `~/SecondBrain/llm_clients.py` (how memory is accessed)
- Check Open Brain schema if relevant

**If routing:**
- Read `~/SecondBrain/claude-code-router.yaml` (model assignments)
- Read `~/SecondBrain/claude_code_router.py` (routing logic)

**If workflow:**
- Read `~/SecondBrain/bridge.py` (bridge supervisor)
- Read relevant skill SKILL.md files if the finding affects a skill

Keep reads minimal — only what's needed to scope the change. Do NOT read the entire codebase.

### 3. Produce Implementation Plan
Write a plan as a markdown file to `~/SecondBrain/data/youtube-intel/plans/{video_id}.md` with:

```markdown
# Implementation Plan: [Finding Title]

**Source:** [Video Title](video_url) by [Channel]
**Relevance:** [high/medium/low]
**Key Insight:** [1-2 sentences]

## Current State
[What exists today in Brent's systems that this finding affects]

## Proposed Changes
[Numbered list of specific changes, each with:]
1. **File:** path/to/file
   **Change:** What to add/modify
   **Why:** How this implements the insight

## Scope
- **Project:** [life/genera/casa — determines which pipeline context to use]
- **Estimated complexity:** [small: 1-2 files | medium: 3-5 files | large: 6+ files]
- **Risk:** [low: additive only | medium: modifies existing behavior | high: changes core architecture]

## Pipeline Task Prompt
[The exact prompt that will be sent to bridge_post_task if approved]
```

### 4. Update Finding Status → "planned"
After writing the plan, update `~/SecondBrain/data/youtube-intel/findings.json`:
- Find the finding by `video_id`
- Set `"status": "planned"`
- Set `"plan_path": "plans/{video_id}.md"`
- Set `"planned_at": "<ISO timestamp>"`

### 5. Execute Pipeline Task
**Headless mode:** Post immediately.
**Interactive mode:** Show plan summary, ask "Want me to send this to the pipeline?", wait for approval.

When executing:
- Post `bridge_post_task` with:
  - **title:** "Implement: [short description]"
  - **prompt:** The "Pipeline Task Prompt" from the plan, prefixed with: "Read the implementation plan at ~/SecondBrain/data/youtube-intel/plans/{video_id}.md for full context. Then execute the changes described."
  - **project:** Determined from the plan's Scope section
  - **type:** "feature" or "refactor" based on whether it's additive or modifying
- Update finding status → "implementing" in findings.json
- Follow up with `bridge_wait_for_task`

### 6. Update Finding Status → "implemented"
After the pipeline task completes successfully:
- Update finding status → "implemented" in findings.json
- Set `"implemented_at": "<ISO timestamp>"`
- Set `"task_id": <bridge task ID>`
- If the task failed, set status → "planned" (back to planned, not lost)

## Notes
- Keep the planning context small — this skill exists specifically to avoid bloating the daily briefing's context
- The plan file persists so Brent can review it later or re-run the pipeline task
- If a finding touches multiple projects, split into separate pipeline tasks
- Plans directory: `~/SecondBrain/data/youtube-intel/plans/`
- Status values: `new` → `planned` → `implementing` → `implemented` (or `skipped`)
- The daily briefing uses the `status` field to show pending items that need attention
