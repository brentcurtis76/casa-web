CODEX REVIEW — M2 ROUND 2/2 FINAL — `feat/mat-svc`@`60e9160`

VERDICT: PASS

Round-1 [B1] is CLOSED. The remediation removes every collaborator-module mock,
executes the real lesson/calendar/publication services behind the single allowed
Supabase-client mock, captures content at the actual Supabase INSERT/UPDATE boundary,
and requires successful completion of every publish evidence path. The original
[A3]-[A7] cases remain sensitive, and the added republish test honestly exercises the
real UPDATE and publication-version increment paths.

This is the final round under the §1.5 two-round cap. There are no remaining BLOCKING,
correctness, contract, security, architecture, test-honesty, or scope findings. M2 is
eligible for PM close and Brent-authorized dormant merge handling.

## REVIEW SCOPE AND WORKTREE SAFETY

- I ran `jb list` before repository work.
- The shared worktree was already on exact target
  `60e9160dbc47bfc15a00777b26f3a0259c047558`; I did not switch it.
- `main` and `origin/main` remain
  `7f3600f469a57a01e13937f8eb2c61d9a9c4281d`; the merge-base is the same SHA;
  local and remote `feat/mat-svc` both resolve to the target.
- The remediation range `dcf7588..60e9160` contains exactly one commit and changes
  only
  `src/lib/children-ministry/__tests__/liturgyChildrenPublishService.materials.test.ts`,
  `+302/-111`. `git diff --check` is clean.
- The existing 13-test service suite is byte-identical to round 1 and `main`:
  SHA-256 `13e105e184e76c526a45c9e927c0138a0b47946c223860ea4a36c2d40fd076bd`.
- The ambient `.gitignore` modification remained untouched and is still the sole
  dirty path in `casa-web`.
- Base and mutation checks ran in disposable detached worktrees, which were removed.
  No branch, provider, deploy, source file, or plan file was changed. This review is
  the only persistent file written.

Per the prompt, this final round judges the round-1 [B1] matrix and permitted related
residue only. Round-1's closed rulings on production behavior, A1/A2/A8-A10, the
array-guarded spread, and typed mock signatures were not relitigated.

## [B1] REMEDIATION MATRIX

| Item | Ruling | Independent evidence |
|---|---|---|
| R1 — Supabase-only boundary | **CLOSED** | Static audit finds exactly one `vi.mock`, at line 209, for `@/integrations/supabase/client`. The three collaborator mocks are gone; production imports resolve the real publish, materials-list, lesson, calendar, and publication-state modules. |
| R2 — persistence capture | **CLOSED** | `lessonInsertPayload` and `lessonUpdatePayload` select recorded `church_children_lessons` writes and throw if absent. `persistedContent`/`rewrittenContent` parse those real lesson-service payloads. EF bodies remain captured directly from `functions.invoke`. |
| R3 — successful flows | **CLOSED** | `publishExpectingSuccess` requires empty warnings, every group successful, and the exact publication count; [A3]-[A5] additionally assert `result.success` and generated totals. Refine cases assert success before body/content evidence. The publication insert path is fully stubbed, so publish no longer dies after lesson persistence. |
| R4 — preserved and strengthened evidence | **CLOSED** | All prior [A3]-[A7] cases remain. The one new republish case forces lesson/calendar UPDATE paths and the existing-publication branch, verifies snapshot/body equality, and observes the real publication service's version `3 → 4`. Base-red and both omission mutations reproduce exactly. |

## DISPATCHER FIDELITY AND TEST HONESTY

The table-keyed chain matches the real call shapes used by the reviewed paths:

- `liturgias`: pre-flight `select('id').eq(...).maybeSingle()`;
- `church_children_lessons`: publish idempotency `maybeSingle`, refine `single`, and
  INSERT/UPDATE followed by `select('*').single()`;
- `church_children_lesson_materials`: lookup plus INSERT/UPDATE upsert shapes;
- `church_children_calendar`: date/group lookup plus INSERT/UPDATE shapes;
- `church_children_publication_state`: liturgy/group lookup, INSERT, the
  `select('publish_version').eq('id', ...).single()` read used by the real increment,
  and UPDATE;
- auth `getUser`/`getSession`/`refreshSession` and `functions.invoke`.

An unmodelled table throws. Missing chain methods or terminal shapes also fail rather
than silently producing data. Each chain is newly constructed, records its operation,
payload, filters, selected columns, and terminal, and resolves only at
`single`/`maybeSingle`; there is no shared mutable query object across calls.

The added republish assertion is not ornamental. I mutated the real
`incrementPublishVersion` calculation from `currentVersion + 1` to `currentVersion` in
a detached worktree: exactly the new republish test failed, with actual `3` versus
expected `4`; the other 19 tests passed. Its no-INSERT assertion and UPDATE payload
capture also ensure it cannot pass by falling back to the create branch.

I found no vacuous stub, assertion that cannot fail, mismodelled table name, or hidden
collaborator mock in the remediation surface.

## INDEPENDENT REPRODUCTION

Canonical runtime was Node `v22.22.0`.

| Check | Result |
|---|---:|
| Scoped `src/lib/children-ministry/__tests__/` | 123/123 passed |
| Materials service suite | 20/20 passed |
| Branch suite with service + types restored to `7f3600f` | 11 failed / 9 passed |
| Force-include empty publish field | exactly 3 failed / 17 passed — the three [A5] cases |
| Never omit/remove refine snapshot | exactly 6 failed / 14 passed — the six unusable/absent cases |
| Break real publication increment (`+1` removed) | exactly 1 failed / 19 passed — new republish case |
| `tsc -p tsconfig.app.json --noEmit` | 1033 diagnostics; no diagnostic in the remediated file |
| `eslint .` | 159 (114 errors / 45 warnings); remediated file clean in isolation |
| Full Vitest serial | 6 failed / 319 passed; exact Mesa-six |

The base-red survivors are the omission claims that already hold in base by
construction. The added eleventh failure is precisely the new republish snapshot case,
not an unrelated failure.

## RESIDUE CHECK

The `+302/-111` one-file diff consists only of [B1] remediation and its permitted
strengthening:

- removal of the three collaborator mocks and their direct imports/stubs;
- Supabase chain dispatcher and recorded-query state;
- INSERT/UPDATE boundary capture helpers;
- successful publish wrapper and success assertions;
- conversion of refine fixtures to the real `getLesson` path;
- one republish/UPDATE/version-increment test;
- comments and types required by those changes.

There is no production edit, unrelated test scenario, component/EF/parseMaterials
touch, existing-suite edit, or scope creep.

## ACCEPTANCE RULING

[A3]-[A7] are now **FULLY MET — behavior and required proof**:

- [A3]: real publish service canonicalizes and the direct invoke boundary receives the
  canonical, capped list.
- [A4]: the same canonical list reaches the invoke body and the real lesson-service
  INSERT payload; the added test proves the same equality on UPDATE/republish.
- [A5]: omitted, empty, and canonical-empty inputs omit the key from both direct invoke
  and real persistence payloads; the exact three-test mutation proves sensitivity.
- [A6]: every refinement type receives a usable canonical snapshot; noncanonical and
  over-cap snapshots heal identically in body and real UPDATE payload; every unusable
  or absent form is omitted/removed.
- [A7]: the real UPDATE payload preserves object-form sibling sentinels, overwrites the
  three owned keys, reserializes usable snapshots, and removes only unusable snapshots.

Together with the binding round-1 rulings that [A1]/[A2]/[A8]-[A10] are MET, M2 now
meets all [A1]-[A10].

## BLOCKING FINDINGS

None.

## SHOULD-FIX

None.

## NITS

None.

## FINAL QUESTION ANSWERS

### Q1 — Is [B1] closed as intended?

**Yes.** Persistence runs through the real services, the sole module mock is the
Supabase client, INSERT and UPDATE payloads are captured at that boundary, and every
evidence flow asserts successful completion.

### Q2 — Did the repair introduce a defect?

**No.** The dispatcher matches the real table and call shapes, rejects unmodelled
tables, and the success/capture helpers throw or assert when their prerequisites are
missing. The added republish test is mutation-proven and traverses the actual UPDATE
and increment services.

### Q3 — Any residue beyond remediation scope?

**No.** The full one-file diff is [B1] machinery, proof conversion, success assertions,
and the PM-accepted single strengthening test.

### Q4 — Are [A3]-[A7] fully met?

**Yes — behavior plus the frozen real-boundary proof.**

FINAL CAP RULING: M2 PASS. No gate-5 escalation is required.
