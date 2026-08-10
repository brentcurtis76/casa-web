SESSION: AUDIO · E3b · REVIEW

Plan review of **E3b, revision 19** of the AUDIO plan (CASA podcast). You failed r18 with 5
BLOCKING and 1 SHOULD-FIX. **All six were accepted; none was argued down.** This is the re-review,
round 2 of 2 under SOP §1.5.

WHERE THE PLAN LIVES: only on branch `docs/plan-audio`, never `main`. Read
`git show docs/plan-audio:docs/plan/audio/PLAN.md`, section `## Phase E3b`. `E3a`'s code is on
`phase/E3a-slug@6054d55` and is still not merged into `main`.

WHAT CHANGED — verify each landed and introduced nothing new:

- **B1** split in three. (a) Your measurement of the nested `.or()` (`status=200, error=null,
  rows=1`) is recorded in the phase body **with attribution to you**, and the ledger states plainly
  that the PM proposed it without measuring. (b) `E3b.2` moves out of the pure test into a new
  `tests/e2e/reflexiones-paginacion.spec.ts` **against local PostgREST**, 13 test-owned `8000` rows,
  a real second-page request, exact cleanup, and `FINDINGS` if the `.or()` misbehaves. (c) New
  **`E3b.5`**: `desde` is untrusted input — invalid timestamp, invalid UUID, truncated encoding and
  injected PostgREST grammar must all fall back to page 1 without reaching the filter.
- **B2** — the negative fixture is rebuilt as you specified: publish an `8000` row so E3a's trigger
  assigns a slug, unpublish it (D12 preserves the slug), request it anonymously by that known slug,
  with an admin control proving the row still exists. The plan now states explicitly that the r18
  claim about the seed's NULL-slug draft was **false**.
- **B3** — `E3b.10` no longer says "shows or copies". It requires a copy/share control producing
  literally `https://www.anglicanasanandres.cl/reflexiones/<slug>` from `CANONICAL_ORIGIN`, with a
  declared mutation.
- **B4** — a new fixtures section decides the null cases: **no preacher → omit the line entirely**
  (no invented name, no "Anónimo"); **no cover → neutral placeholder**, never a broken box or empty
  `alt`; same on both pages. It also declares the consequence you flagged: **E4-spike's test episode
  must carry both**, because E3b will not invent them.
- **B5** — the stale global prose is fixed (the r17 line calling E3b a draft, and the META still
  calling E3a a freeze candidate). And the dependency gap is now a **hard precondition**: E3b cannot
  start until `phase/E3a-slug` is merged, with `git merge-base --is-ancestor 6054d55 main` as the
  executor's first check and `FINDINGS` if it fails.
- **S1** — new `E3b.11`: a stable Spanish error state, never a perpetual spinner or blank page.
- **Your MUTATION RULING** — the fixture arrangement is now **frozen in E3b.3** rather than left to
  executor judgement: repeated `published_at` across the page boundary, `id`s deliberately out of
  insertion order, and the between-request insertion sorting **before** the cursor.

Criteria went 11 → 13; files 7 → 8.

ASSESS — only what this revision touches, plus anything it broke
1. Is each of B1(a,b,c), B2, B3, B4, B5, S1 genuinely closed?
2. **Do the three declared mutations now die under the frozen fixture?** That was your ruling's
   point: verify the arrangement actually forces them.
3. `E3b.5`: are four cases enough, and is "fall back to page 1" the right behaviour versus showing
   an error? Is there an injection path the contract still misses?
4. Did any r19 edit introduce a new contradiction? The document is spliced by hand each round and
   that is exactly how B5 happened twice.
5. Sizing: 8 files, 13 criteria. Still one session?
6. Freeze or not. If not, say plainly whether the gap warrants another round or should be carried
   into execution as a mandatory amendment — there will not be an r20 without Brent overriding the
   §1.5 cap, as he did once for E3a.

Taste is a NIT. Only correctness, contract violations, security and architectural violations are
BLOCKING. Output using the CODEX REVIEW format.
