CODEX REVIEW — M2 ROUND 1/2 — `feat/mat-svc`@`dcf7588`

VERDICT: FAIL

The production diff implements the frozen M-D2/M-D3/M-D5/M-D11 behavior correctly,
and every requested gate, base-red, and mutation result is reproducible. However, the
new service suite violates the frozen test boundary: it mocks three production
collaborator modules in addition to the Supabase client. Consequently the claimed
"persisted JSON through the real service stack, mock boundary = Supabase only" proof
does not exist. That is a D7/test-contract defect and is BLOCKING even though the
current production code reads correctly.

This is round 1 of the 2-round §1.5 cap. M2 needs one consolidated test-only
remediation and a final round-2 review. Merge remains blocked.

## REVIEW TARGETS AND WORKTREE SAFETY

- I ran `jb list` before repository work.
- The shared worktree was already on exact target
  `dcf758864bd14c03c226b59aed62eb8edeb31e16`; I did not switch it.
- The pre-existing `.gitignore` modification remained untouched and is still the sole
  dirty path in `casa-web`.
- `main`, `origin/main`, and the merge-base are exact
  `7f3600f469a57a01e13937f8eb2c61d9a9c4281d`; local and remote
  `feat/mat-svc` both resolve to the target.
- The range contains exactly `7fcb12d`, `ee9e30d`, and `dcf7588`.
- The diff contains exactly the five M2 allowlisted files, `+854/-2`, and
  `git diff --check` is clean. The existing 13-test service suite is byte-identical to
  `main` (SHA-256 `13e105e184e76c526a45c9e927c0138a0b47946c223860ea4a36c2d40fd076bd`).
- Base and mutation work ran in disposable detached worktrees, which were removed.
  No branch, provider, deploy, production file, or plan file was changed. This review
  is the only persistent file written.

## BLOCKING FINDING

### [B1] The materials suite does not honor the Supabase-only mock boundary

`src/lib/children-ministry/__tests__/liturgyChildrenPublishService.materials.test.ts`
explicitly mocks `childrenPublicationStateService` at lines 26-30, `lessonService` at
32-38, and `calendarService` at 40-44. It then calls mocked `createLesson` /
`updateLesson` and treats their arguments as persisted content (lines 264-273), rather
than letting the real persistence services carry those payloads to the mocked
Supabase client.

That contradicts Phase M2's test plan: the new service suite must mock ONLY
`@/integrations/supabase/client`, with the real publish service and real
`materialsList` under test. It also makes the suite's publish "happy path" incomplete:
`installHappyPath` stubs neither `createPublication` nor an existing publication, so
the publish scenarios proceed far enough to capture invoke/createLesson arguments but
then return failure at `upsert_publication`. None of [A3]-[A5]'s tests asserts that the
publish call succeeded. The scoped run therefore being 122/122 does not establish a
successful real persistence path.

The current tests do use the real `liturgyChildrenPublishService` and real
`materialsList`, and their Supabase `functions.invoke` capture is real. The defect is
specifically the persistence half of the required boundary and success path. The
existing untouched orchestration suite cannot substitute for it because that suite
uses the same collaborator-mock topology and predates the frozen M2 proof.

Required round-2 remediation:

1. Remove the three collaborator-module mocks from the new materials suite. Mock only
   `@/integrations/supabase/client` with a chain stub covering the actual lesson,
   calendar, publication, auth/session, liturgy-verification, and EF call shapes.
2. Capture the generated/refined content at the Supabase insert/update boundary reached
   through the real `lessonService`, and retain direct capture of the real
   `functions.invoke` bodies.
3. Make the publish cases complete successfully and assert that success in the tests
   used as [A3]-[A5] evidence.
4. Preserve the required [A3]-[A7] cases and reproduce the same base-red and omission
   mutations after the boundary repair. Keep the existing 13-test service suite
   untouched and stay inside the five-file M2 allowlist.

## INDEPENDENT GATE AND MUTATION REPRODUCTION

Canonical runtime for Vitest was Node `v22.22.0`.

| Check | Base `7f3600f` | Target `dcf7588` | Ruling |
|---|---:|---:|---|
| Scoped `src/lib/children-ministry/__tests__/` | — | 122/122 passed | green, including untouched 13/13 service suite |
| `tsc -p tsconfig.app.json --noEmit` | 1033 diagnostics | 1033 diagnostics | zero count delta; changed surface has only the same four shifted pre-existing service diagnostics |
| `eslint .` | 159 (114 errors / 45 warnings) | 159 (114 / 45) | identical; all five changed files lint clean in isolation |
| Vitest serial | 6 failed / 261 passed | 6 failed / 318 passed | exact Mesa-six at both revisions; +57 passing M2 tests |
| Branch suite with service + types restored to base | — | 10 failed / 9 passed | exact required base-red |
| Drop FE M-D5 step 1 | — | 1 failed / 37 passed | V10 alone fails |
| Force-include empty publish field | — | 3 failed / 16 passed | exactly the three [A5] cases |
| Never omit/remove refine snapshot | — | 6 failed / 13 passed | exactly the six unusable/absent cases |

The mutations are genuinely sensitive and reproducible. They do not cure [B1]: they
operate above the mocked persistence collaborators, so the missing real persistence
boundary remains missing.

## ACCEPTANCE MATRIX

| Criterion | Ruling | Evidence |
|---|---|---|
| [A1] | MET | Executor record pins the pre-edit `7f3600f` baselines; I independently replayed base/target gates. |
| [A2] | MET | V1-V11 are verbatim, every-vector fixed-point and expected-output idempotence pass, the cap-after-dedupe witness is discriminating, and V10 alone kills step 1. |
| [A3] | BEHAVIOR MET; REQUIRED PROOF NOT MET | Production canonicalizes once before group dispatch and the invoke capture receives the canonical form, but the suite violates its frozen topology. |
| [A4] | BEHAVIOR MET; REQUIRED PROOF NOT MET | Code uses the same canonical array for body and snapshot; the test compares both values, but "persisted" content is only an argument to mocked `createLesson`. |
| [A5] | BEHAVIOR MET; REQUIRED PROOF NOT MET | Omitted, empty, and canonical-empty cases omit both keys; the three-test mutation is exact, but the persistence boundary is mocked above Supabase. |
| [A6] | BEHAVIOR MET; REQUIRED PROOF NOT MET | All eight refinement types pass; noncanonical and >60 snapshots heal identically in body/content; scalar, mixed, empty, and whitespace-only snapshots are omitted/removed. The real `updateLesson` path is bypassed. |
| [A7] | BEHAVIOR MET; REQUIRED PROOF NOT MET | Object-form sibling sentinels survive and unusable snapshots are removed; base-red is real, but persistence again stops at mocked `updateLesson`. |
| [A8] | MET | FE and EF `GenerateChildrenLessonRequest` copies are field-for-field identical, including `previewPromptOnly`, `requestId`, and `availableMaterials`; no residual copy drift. |
| [A9] | MET | Gate deltas are clean under Node 22.22.0; new and changed files add no tsc/eslint identity, and the Mesa-six is unchanged. |
| [A10] | MET | Exactly the five listed paths changed; no component, EF, `parseMaterials`, duration/count, or existing-suite edit. |

## SHOULD-FIX

None beyond [B1].

## NITS

None.

## FROZEN-QUESTION ANSWERS

### Q1 — [A1]-[A10]

The production implementation meets the substantive behavior of every numbered
criterion, and [A1]/[A2]/[A8]-[A10] are fully met. M2 as a reviewed phase does not meet
the complete frozen contract because [A3]-[A7]'s service evidence is produced across a
nonconforming mock boundary. That is why this is FAIL rather than a production-code
PASS with a taste note.

### Q2 — real bodies, persisted JSON, and mutations

- Real invoke bodies through the real publish/refine service and real
  `materialsList`: **yes**.
- Persisted JSON through the real persistence services with Supabase as the only mock:
  **no**. `lessonService`, `calendarService`, and
  `childrenPublicationStateService` are mocked.
- Force-include mutation: **reproduced**, exactly the three [A5] tests.
- Never-omit mutation: **reproduced**, exactly the six unusable/absent-snapshot tests.

### Q3 — M-D5 twin and M-D11

The FE twin faithfully implements all seven M-D5 steps, constants, UTF-16 truncation,
locale-less case fold, first-wins order, and cap. Its `string[]` input intentionally
does not tolerate non-arrays or non-strings; that leniency belongs only to the Deno
trust boundary under the frozen plan.

M-D11 is correct in production: usable means all-string array, canonicalized once,
then non-empty. One canonical result feeds both the refine body and rewritten content.
Invalid or canonical-empty values omit/remove the key, while object-form siblings are
preserved. The current suite demonstrates those values but must be repaired at the
persistence boundary under [B1].

### Q4 — guarded spread for array-form legacy content

**ACCEPTED; no dated plan amendment is required.** M-D11's “unknown sibling keys” are
members of object-form content. Array elements are an alternate legacy content shape,
not sibling object keys. Spreading an array into the new object would not preserve that
shape; it would invent numeric object properties alongside the three refined keys and
retain stale phase data. Keeping the historical three-key rebuild for non-object-form
legacy content is the correct reading of M-D11's additive-key-safe intent, especially
given the Backlog's explicit record that array-form content exists.

### Q5 — typed mock signatures

**ACCEPTED.** Explicit call signatures are a type-safe replacement for the precedent
`(...args: unknown[])` wrappers and avoid three new TS2556 identities, as [A9]
requires. This ruling concerns how the allowed Supabase mock is typed; it does not
ratify the three extra collaborator-module mocks identified in [B1].

### Q6 — FE/EF request parity

The copies match field-for-field: liturgy fields; nested story title/summary/
spiritualConnection/scenes; age group and label; optional duration/count bounds;
`previewPromptOnly`; `requestId`; and `availableMaterials`. There is no residual drift.

### Q7 — scope creep

None. The five-file allowlist is exact. Components, Edge Functions,
`parseMaterials`, hardcoded duration/counts, and the existing service suite are
untouched.

### Q8 — M3a/M3b readiness

The production API does not make M3a/M3b harder than frozen: the optional service
parameter is ready for M3b, both cap constants are exported for M3a, canonicalization
is fixed-point-safe when M3b passes an already canonical UI list, and the 60-item cap
semantics remain intact. [B1] must be fixed before merge so M3b's later real-M2
end-to-end proof builds on an honestly verified persistence boundary.
