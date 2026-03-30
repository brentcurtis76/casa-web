---
name: code-review
description: "Quick, independent code review using multi-vendor LLM routing (GPT-5.3 Codex) to avoid self-grading bias. Delivers a structured review immediately, then dispatches to Codex for an independent second opinion. MUST use this skill when the user says: review this code, code review, check this PR, look over this file, review my changes, what do you think of this code, second opinion on code, check for bugs, '/code-review', or pastes a code snippet and asks for feedback. Works for any code — SecondBrain scripts, bridge infrastructure, pipeline configs, or project files (GENERA/CASA). This is for REVIEWING existing code, not writing new code or fixing bugs (those go through genera-project or casa-project bridge tasks). If someone says 'review' or 'look over' plus a file or code, this is the right skill."
---

# Ad-hoc Code Review

You provide independent code reviews using a two-phase approach: deliver a structured review immediately, then dispatch a background review to an independent AI vendor (GPT-5.3 Codex via the bridge) so Brent gets a second opinion without waiting.

## Why Two Phases

The self-grading bias problem is real — when the same model writes and reviews code, it tends to be lenient. The pipeline solves this by routing `code_review` tasks to Codex. But bridge tasks are asynchronous and can take minutes. Blocking the user while waiting for Codex defeats the purpose of a "quick review."

So the pattern is: give Brent a thorough, structured review right now (Phase 1), and simultaneously fire off a bridge task to Codex for an independent opinion (Phase 2). The Codex review arrives later via Telegram notification when the bridge task completes. This way Brent gets immediate value and independent verification without choosing between speed and rigor.

## MCP Dependencies

- `jake_bridge` — for posting review tasks to the multi-vendor router (bridge_post_task)

## Procedure

### Step 1 — Gather the Code

Figure out what's being reviewed and get the code into context:

| Source | Action |
|---|---|
| User pastes code in chat | Use it directly |
| File path in SecondBrain | Read the file |
| File in GENERA/CASA repo | Read if accessible; if not, note the path for the bridge task |
| "Review my recent changes" | Check git diff or ask which files |

If the user mentions a focus area ("check the error handling," "is this secure?"), note it — you'll use it in both phases.

### Step 2 — Understand Context

Before reviewing, understand what the code does and where it fits. This takes 30 seconds but dramatically improves review quality:

- Read surrounding files or imports if the code references them
- Check if there's a pattern in the codebase this code should follow
- Note the project context: SecondBrain (infrastructure), GENERA (Next.js, Law 21.719 PII rules), or CASA (Vite SPA, shared Supabase instance, Spanish-first)

### Step 3 — Phase 1: Deliver Your Review

Produce a structured review immediately. Use this format:

```
## Code Review — [file or description]

### Issues Found
**[SEVERITY]** [description]
  → [suggestion]

### Positive Notes
- [things done well — this matters, it's not filler]

### Recommendations
- [improvements that aren't bugs]

### Summary
[1-2 sentence overall assessment]
```

Severity levels:
- **CRITICAL** — bugs, security vulnerabilities, data loss risks
- **HIGH** — logic errors, missing error handling, race conditions
- **MEDIUM** — code smells, maintainability concerns, missing tests
- **LOW** — style, naming, minor improvements

Review for these areas (emphasize whatever the user asked about):
- **Correctness** — does it do what it claims?
- **Error handling** — what happens when things go wrong?
- **Security** — injection, auth bypass, data exposure, especially PII for GENERA
- **Edge cases** — empty inputs, concurrent access, large data
- **Readability** — could someone else maintain this?
- **Project patterns** — does it follow existing conventions?

### Step 4 — Phase 2: Dispatch to Codex

After delivering your review, post a bridge task for an independent review from a different vendor. This is the bias-avoidance step — Codex hasn't seen your review and will form its own opinion.

Determine the project:
- Code in SecondBrain → `project: "secondbrain"`
- Code in GENERA/FNE → `project: "genera"`
- Code in CASA → `project: "casa"`
- Snippet with no project → `project: "secondbrain"`

Post the task:
```json
{
  "title": "Code review: [file or description]",
  "prompt": "Review the following code for: correctness, security issues, edge cases, readability, and maintainability.\n\nContext: [what this code does and where it fits]\n\nCode:\n```[language]\n[the code]\n```\n\nFocus areas: [any specific concerns from the user]",
  "project": "[project]",
  "type": "code_review"
}
```

After posting, tell Brent:
> "I've also sent this to Codex for an independent review. You'll get a notification when it's ready — if it flags anything different from what I found, that's worth paying attention to."

Do NOT call `bridge_wait_for_task` — that blocks the conversation. The bridge sends a Telegram notification when the task completes. If Brent later asks "did the Codex review come back?", then use `bridge_check_task` to look it up.

### Step 5 — Handle Edge Cases

**Bridge is unavailable:** If `bridge_post_task` fails, your Phase 1 review is still valuable. Let Brent know: "I couldn't reach the bridge to dispatch to Codex, but here's my review. You can retry the independent review later with `/code-review`." Don't treat a bridge failure as a skill failure.

**File not accessible:** If the code is in a project repo you can't read directly (e.g., CASA component not mounted), still post the bridge task — the bridge runs in Claude Code which has full repo access. For your Phase 1 review, work with whatever context is available: the file path, the user's description, any code they pasted. If you genuinely can't produce a review (no code visible at all), say so and explain that the Codex review will have full access.

**User just wants your opinion, not Codex:** If the user says something like "just give me your take" or "quick review, no need for the full thing," skip Phase 2. The bridge dispatch is a bonus, not a requirement.

## When to Use This vs. the Full Pipeline

Use **this skill** when:
- Reviewing a single file or small set of changes
- The code is in SecondBrain (infrastructure, scripts, configs)
- The user wants a quick opinion, not a full pipeline run
- The changes are too small to justify PM → Architect → Dev → QA

Use **the full pipeline** (via GENERA/CASA skills) when:
- The change is a feature or bug fix in a project repo
- Multiple files are affected
- The change needs QA, security review, and deployment coordination
- The PM needs to spec acceptance criteria

## What This Skill Does NOT Do

- It doesn't implement fixes — it only reviews and reports
- It doesn't deploy anything
- It doesn't run tests (the full pipeline's QA agent does that)
- It doesn't replace the Security agent's deep review — for security-critical changes in project repos, use the full pipeline
