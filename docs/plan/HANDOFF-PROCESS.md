# HANDOFF — CASA lean workflow pilot

Use this handoff for a process-review conversation. It observes CASA's coding
flow and updates process records; it does not implement feature code.

## Read first

1. `~/.claude/agent-workflow/AGENT-WORKFLOW.md` — rollback baseline.
2. `~/.claude/agent-workflow/LEAN-WORKFLOW.md` — active CASA/FNE overlay.
3. `~/.claude/agent-workflow/workstreams.md` — logical plan locations and current
   worktree-resolution rules.
4. `docs/plan/SOP-PILOT.md` — CASA guardrails, corrected history, and scorecard.
5. The live phase's plan, ledger, prompts, reviews, and evidence in its actual
   worktree.

Run from `/Users/brentcurtis/dev/casa-pilot`, but do not assume this worktree owns
every CASA phase. Resolve the repository with:

```bash
git worktree list
git status --short --branch
git rev-parse --path-format=absolute --git-common-dir
```

Every CASA worktree sharing `/Users/brentcurtis/dev/casa-web/.git` uses the lean
overlay, regardless of its directory or branch.

## Question under test

Can CASA reduce elapsed time, human handoffs, and cumulative attempts while
preserving required gates and independent Codex review?

The active flow is:

```text
current-phase contract → durable executor → all CASA gates → Codex review
                                      ↑                ↓ FAIL
                                      └── same session ┘
                                                   ↓ PASS
                                            mechanical close
```

There is no routine PM re-verification pass, no additional fresh-context Claude
review, and no fresh executor for ordinary remediation. High-risk phases receive
contract falsification before code; all phases retain the full CASA gate suite
and independent Codex final review.

## Historical correction

Do not count BILINGUE D1a rounds 2 or 3 as evidence for the old C3 fresh-context
reviewer. The authoritative ledger identifies the actor as the existing
`BILINGUE · plan · PM` session. PD-REFINE is the original pilot's one clear C3
execution sample. The old conclusion was based on a role-attribution error.

## What to record

For each of the next four completed CASA phases, read actual timestamps and gate
results from the authoritative ledger. Record:

- elapsed time from PM bootstrap to Codex PASS;
- human handoffs/task switches;
- cumulative attempts (never reset after re-plan);
- Codex blocking findings before PASS; and
- defects, rollbacks, security/privacy incidents, or red-gate overrides after
  PASS.

Do not infer missing timestamps. Mark them missing. Do not count a pre-PASS Codex
finding as an escaped production defect.

## Safety

- Do not move, prune, or delete worktrees while measuring the workflow.
- Do not merge, push, deploy, or touch production from the process lane.
- Do not treat reviewer agreement as correctness; the repository gates and
  post-PASS guardrail remain decisive.
- Four phases are a pilot sample, not proof. Report the observed change and its
  uncertainty.
