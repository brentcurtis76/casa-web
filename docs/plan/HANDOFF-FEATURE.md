# HANDOFF — Bilingual liturgies (LANE 1: the feature)

> Paste this into a fresh conversation to start the feature lane.
> Its sibling is `HANDOFF-PROCESS.md` (lane 2), which watches this lane but does not steer it.

---

You are the PM for the bilingual-liturgies project on CASA. Read these first, in order, and say
what you found before doing anything else:

1. `docs/plan/AGENT-WORKFLOW.md` — the SOP you operate under
2. `docs/plan/SOP-PILOT.md` — active amendments to it
3. `docs/plan/PLAN-BILINGUE.md` — the plan, **v2, FAILED review, not frozen, not executable**
4. `docs/plan/reviews/BILINGUE-PLAN-review-1.md` — why it failed. **This is the important one.**
5. `docs/plan/LEDGER.md` — last 10 entries

Repo: `/Users/brentcurtis/dev/casa-web`. Plan branch/worktree: `pilot/sop-v2` at
`/Users/brentcurtis/dev/casa-pilot`.

## Where this stands

Brent wants liturgies creatable end-to-end in English, plus the ability to duplicate an existing
liturgy into the other language. A plan was drafted and **failed adversarial review with 11
BLOCKING findings and 11 missing phases.** The verdict was accepted, not contested.

The plan is not salvageable by patching. The reviewer's first missing phase is a discovery pass,
and that is the agreed next step.

## Decisions already made by Brent (do not re-litigate)

| Decision | Value |
|---|---|
| Scope | Liturgy output **and** the builder UI — not the whole app |
| Translation | Translate existing content; do **not** regenerate |
| Pairing | Independent copies; no sync, no cascade |
| Language lifetime | **Fixed at birth.** Duplication is the only route to the other language |
| Bible translations | NIV, KJV, NKJV, ESV, NLT, NASB, NRSVCE, MSG, AMP, WEB |
| Songs | English songs get **uploaded to the catalog**, never machine-translated |

Still open, and only Brent can answer: the **default** English Bible translation (NIV planned;
NRSV is the usual Anglican lectionary choice), and the **English liturgical texts** for the Lord's
Prayer, the Peace, the communion dialogue, the blessing and any creed in use.

## Your first job: B0, a discovery phase

Its output is an **inventory, not code**. Nothing ships from it. It exists because the last plan
asserted facts nobody had checked, and every one of the eleven blockers was one query or one grep
away.

B0 must produce, with the command or query that produced each answer:

1. **Every surface that emits user-visible text**, classified as *UI copy* (follows operator
   locale) or *stored/output copy* (follows liturgy language). Known to exist and unplanned for:
   celebrant PDF, story PDF, children-activity PDF, music packet PDF, presentation
   navigation/labels/dates, children and music email, WhatsApp templates.
2. **A field-by-field translation matrix** by element type — all 52 distinct `tipo`, not the 18
   fixed ones — saying for each field: translate / re-fetch / copy verbatim / clear / human-select.
3. **Every field that can hold personal data.** Celebrant, preacher, presenter, contacts, and
   anything inside `custom_content` or announcements. This gates the whole translation design;
   CASA's hard rule is that member PII never enters an AI prompt.
4. **Asset reality.** Which images have text baked into pixels (30 of 60 covers do), and what
   `Portadas.tsx` does on every new cover.
5. **Publication behaviour.** `published_resources` has no language column and allows one active
   resource per type — publishing English would deactivate Spanish. Confirm and characterise.
6. **Related artifacts** that hang off a liturgy: 18 children lessons, 18 children publications,
   2 music publications, 3 cuentacuentos drafts, reflection PDFs, presentation sessions. For each:
   copy / translate / detach / clear.
7. **The real string count**, by directory, with the exact command that produced it. The previous
   "~362" was an unreproducible regex estimate; a conservative scan found 396 + 120 more in
   omitted surfaces.

Only after B0 does anyone re-draft. The scope decision — full feature vs English-creation-only —
gets made from B0's findings, not before.

## Rules that bit us last time

- **Never ask Brent a question the codebase can answer.** A question was asked about
  `transcribe-meeting`; he answered in good faith; the code disagreed; it went into the plan as a
  verified fact. His questions are for pastoral, product and taste decisions only.
- **Show your homework.** Every asserted fact carries the command that produced it. Anything
  unverified is labelled `UNVERIFIED` inline, not confessed in a self-review at the bottom.
- **Additive migrations only**, no column renames, and the 11 Life OS tables are untouchable.
- Branch names ≤20 chars. Never merge to `main` without Brent saying so.

## Write to the ledger

Every round gets an entry in `docs/plan/LEDGER.md` with `ELAPSED`, `STAGE`, `EFFORT` and
`FIRST-PASS`. Lane 2 reads those entries to learn how the process is performing. If you do not
write them, the process lane goes blind — that is the only thing it asks of you.
