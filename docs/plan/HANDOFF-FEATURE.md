# HANDOFF — Bilingual liturgies (LANE 1: the feature)

> Start a fresh conversation and run `/plan-new BILINGUE`, then paste this as context.
> Its sibling is `HANDOFF-PROCESS.md` (lane 2), which watches this lane but does not steer it.

---

## How to start

```
/plan-new BILINGUE
```

That is SOP §3.1 — a planning session that writes `PLAN.md` and nothing else. It will create the
workstream at `docs/plan/bilingue/` with its own `LEDGER.md`, `reviews/`, `evidence/` and
`prompts/`. This is **new** work, so it needs no row in `~/.claude/agent-workflow/workstreams.md`.

Do **not** start with `/pm-boot`. That is §3.3 and assumes a frozen plan with a phase to run.
There is neither: the previous plan failed review and nothing is frozen.

Repo: `/Users/brentcurtis/dev/casa-web`. Docs currently live on branch `pilot/sop-v2` at
`/Users/brentcurtis/dev/casa-pilot`.

## Required reading before drafting anything

1. `~/.claude/agent-workflow/AGENT-WORKFLOW.md` — the SOP (canonical, 511 lines). Not the repo.
2. `~/.claude/agent-workflow/workstreams.md` — where each workstream's files live
3. `docs/plan/SOP-PILOT.md` — active amendments
4. `docs/plan/PLAN-BILINGUE.md` — **the failed first attempt.** Read it as history, not as a base
5. `docs/plan/reviews/BILINGUE-PLAN-review-1.md` — **why it failed. This is the important one.**

Note that CASA's root `docs/plan/LEDGER.md` is **shared** by the CUENTOS and MATERIALES
workstreams. Do not write BILINGUE entries into it; yours go to `docs/plan/bilingue/LEDGER.md`.

## What Brent wants

Liturgies creatable end-to-end in English, plus the ability to duplicate an existing liturgy into
the other language so a church can run services in both.

## Decisions already made — do not re-litigate

| Decision | Value |
|---|---|
| Scope | Liturgy output **and** the builder UI — not the whole app |
| Translation | Translate existing content; do **not** regenerate |
| Pairing | Independent copies; no sync, no cascade |
| Language lifetime | **Fixed at birth.** Duplication is the only route to the other language |
| Bible translations | NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB |
| Songs | English songs get **uploaded to the catalog**, never machine-translated |

Only Brent can answer these, and they block specific phases: the **default** English Bible
translation (NIV planned; NRSV is the usual Anglican lectionary choice), and the **English
liturgical texts** for the Lord's Prayer, the Peace, the communion dialogue, the blessing and any
creed in use.

## The first attempt failed. Understand why before you repeat it.

11 BLOCKING findings, 11 missing phases, 2 frozen decisions disputed. It was not close, and the
verdict was accepted without contest. The cause was not bad judgement — it was **asserting facts
nobody had checked.** Six examples, each corrected by a single query the planner never ran:

- `source_id` was declared "semantics unknown, executor must STOP." One JOIN answers it: 142
  non-null rows = 116 song slugs + 26 cuentacuentos ids.
- Cover images were listed as an unverified risk. They are a confirmed fact: 30 of 60 covers have
  text baked into the pixels, and `Portadas.tsx` bakes title/subtitle into every new one.
- B1 was described as "risk: none material." Type regeneration is a **+5,265-line** diff.
- B2 targeted `LiturgiaForm`, which belongs to the antifonal-prayer flow. The builder creates
  through `ContextoTransversal`.
- The plan had **no PII design at all**, and would have sent celebrant and contact data to a
  translator — against CASA's own hard rule.
- Brent was asked whether `transcribe-meeting` is in the liturgy path. He said yes. Its only caller
  is `src/lib/leadership/transcriptionService.ts`. **Never ask what you can grep.**

## Your first phase is discovery. It produces an inventory, not code.

The reviewer's first missing phase, and the agreed next step. Every answer carries the command or
query that produced it:

1. **Every surface that emits user-visible text**, classified as *UI copy* (follows operator
   locale) or *stored/output copy* (follows liturgy language). Known to exist and unplanned for:
   celebrant PDF, story PDF, children-activity PDF, music packet PDF, presentation
   navigation/labels/dates, children and music email, WhatsApp templates.
2. **A field-by-field translation matrix** across all **52** distinct `tipo` values — not the 18
   fixed ones — saying for each field: translate / re-fetch / copy verbatim / clear / human-select.
3. **Every field that can hold personal data**, including inside `custom_content` and announcements.
   This gates the whole translation design.
4. **Asset reality** — which images carry baked-in text, and what the cover generator does.
5. **Publication behaviour** — `published_resources` has no language column and allows one active
   resource per type, so publishing English would deactivate Spanish. Confirm and characterise.
6. **Related artifacts** hanging off a liturgy: 18 children lessons, 18 children publications, 2
   music publications, 3 cuentacuentos drafts, reflection PDFs, presentation sessions. For each:
   copy / translate / detach / clear.
7. **The real string count**, by directory, with the exact command. The previous "~362" was an
   unreproducible regex estimate; a conservative scan found 396 plus 120 more in omitted surfaces.

Only after that does anyone re-draft. **The scope decision — full feature vs English-creation-only
— gets made from the findings, not before.** Roughly four of the eleven blockers live in the
duplication half, so narrowing helps but does not remove the need for discovery.

## Rules

- **Never ask Brent a question the codebase can answer.** His questions are for pastoral, product
  and taste decisions only.
- **Show your homework.** Every asserted fact carries the command that produced it. Anything
  unverified is labelled `UNVERIFIED` inline — not confessed in a self-review at the bottom. The
  last plan's self-review named its own blind spot and shipped anyway.
- Additive migrations only, no column renames, and the 11 Life OS tables are untouchable.
- Branch names ≤20 chars. Never merge to `main` without Brent saying so.
- Write a `docs/plan/bilingue/LEDGER.md` entry every round with `ELAPSED`, `STAGE`, `EFFORT` and
  `FIRST-PASS`. Lane 2 reads those to measure whether the process is improving. It is the only
  thing that lane asks of you.
