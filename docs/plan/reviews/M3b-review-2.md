CODEX REVIEW — M3b ROUND 2/2 — FINAL — `feat/mat-wire`@`f5cfc7d`

VERDICT: PASS

[B1] is closed under the exact cross-context interleaving from round 1. The
per-attempt symbol makes guard release owner-safe; reset still releases an abandoned
context immediately; a stale completion cannot clear a newer owner's ref or spinner;
and the active owner clears both ref and visible state on success or failure. I found
no new defect in the `+99/-8` remediation.

Accordingly, [A6] is now FULLY MET. Together with the binding round-1 rulings,
[A1]-[A11] are complete. The accepted [A11] numerical deviation, the two accepted
architecture-masked survivors, the verified cap-predicate repair, the frozen
decisions, and the legacy-dialog ruling remain closed and unchanged. I find no
remaining release-safety reason to block Brent's merge.

## REVIEW TARGET AND SCOPE

- The shared `casa-web` worktree is at exact target
  `f5cfc7d12c22d82ac6208a96e77fe499031090dc`; local and remote
  `feat/mat-wire` agree. `main` and `origin/main` remain at exact
  `b7b27e9b7f082f8d85a28065e800243466cdebf4`.
- `8e25390..f5cfc7d` is exactly one commit and two files, `+99/-8`: 25 changed
  production lines in `ChildrenActivityDialog.tsx` and an 82-line addition to
  `ChildrenActivityDialog.materials.test.tsx`. `git diff --check` is clean.
- The production delta is exactly the three expected guard hunks: ref ownership
  type/comment, fresh-symbol claim, and owner-conditional `finally`. There are no
  unrelated dialog changes. `resetMaterialsState` is byte-unchanged in this range.
- The test delta is one new [A6]/[B1] case. The original same-tick two-click witness
  is unchanged.
- The pre-existing `.gitignore` modification remained untouched. Mutation runs used
  one disposable detached worktree, which was removed; no branch or application file
  was changed by this review.
- All reported Node commands used canonical Node `v22.22.0`, not ambient Node 26.

## [B1] OWNER-SAFE RELEASE — CLOSED

The implementation establishes the required ownership invariant:

1. Context A passes the ref guard, creates a fresh `Symbol('savingExtra')`, stores it
   in `savingExtraRef`, and captures it locally as A's owner.
2. A materials reset increments the context token, nulls the ref and visible spinner,
   and therefore permits context B to save immediately. This preserves the required
   abandonment semantics.
3. Context B creates and stores a distinct symbol. When A later settles, its existing
   context checks suppress stale success/error UI. In `finally`, A's symbol does not
   equal the ref's B symbol, so A changes neither the ref nor `savingExtra`.
4. While B is pending, another B save click still sees a non-null ref and returns
   before `currentUserId` or the real inventory insert boundary. No third insert is
   admitted.
5. When B settles, its symbol still owns the ref. Its `finally` nulls the ref and,
   because B is current, clears the visible spinner. The same path runs after either
   success or failure.

Identity, rather than material name, is the correct discriminator. It handles the
same name being re-added after reset and has no serialization or equality ambiguity.
The symbol exists only in the ref and its attempt's async closure; active ownership is
released at settlement, while an abandoned attempt retains no lifetime beyond its
already-pending operation. I found no symbol-lifecycle leak.

Spinner behavior is consistent across every relevant transition. Reset clears the
old spinner. A stale owner cannot clear B's spinner. B's normal settlement clears its
own spinner. If B is itself abandoned, the next reset already clears its ref and
spinner, and B's later owner mismatch cannot disturb a subsequent context.

## REGRESSION AND TEST-HONESTY RULING

The new case honestly reproduces the round-1 interleaving:

- A's inventory insert is deferred, a liturgy change resets the materials context,
  and B then claims the guard with its own deferred insert.
- A settles stale. The case checks that A produces no success toast and no stale
  inventory row in B.
- A second, visibly enabled save action in B is actually clicked while B remains in
  flight. The assertion remains exactly two recorded
  `church_children_inventory` insert payloads, named `Plumones` and `Cartulina`.
- B then resolves normally, moves `Cartulina` to checked inventory, emits the success
  copy, leaves `Tijeras` as a usable one-off, and still records exactly two inserts.

This goes through the real `inventoryService` and its Supabase query builder. The file
still contains exactly two `vi.mock` declarations—Supabase client and toast—and no
collaborator-module replacement. Insert payloads are observed at the client boundary,
not intercepted as arguments to an inventory-service stub.

The decisive mutation is killed precisely: replacing the owner-conditional release
with unconditional `savingExtraRef.current = null` makes only the new [B1] case fail
(**1 failed / 21 passed**) and records **3** inserts instead of 2. Restoring the code
returns the suite to 22/22.

The retained M5-family control remains independent and effective. Replacing the ref
admission guard with `savingExtra !== null` makes only the original same-tick witness
fail (**1 failed / 21 passed**) and records 2 inserts instead of 1; the new cross-
context case stays green. Thus the two tests witness different halves of the guard:
synchronous admission and owner-safe asynchronous release.

I found no vacuous assertion or mock-boundary regression in the added case. Its
enabled non-saving row is intentional UI behavior; the click reaching the handler and
producing no payload is what proves the live ref guard remains owned by B.

## ACCEPTANCE RULING

| Criterion | Final ruling | Round-2 basis |
|---|---|---|
| [A1]-[A5] | MET, binding | Closed in round 1; no related production hunk changed. |
| [A6] | **FULLY MET** | Unique owner token, reset-safe abandonment, stale-owner isolation, active-owner cleanup, real-boundary regression, and both mutation kills are verified. |
| [A7]-[A10] | MET, binding | Closed in round 1; no related behavior or mock boundary changed. |
| [A11] | MET with accepted deviation, binding | The round-1 overage disposition remains accepted; this remediation is the single permitted `+99/-8` commit and exact two-file scope. |

No related residue reopens an earlier ruling. In particular, the production change is
confined to quick-add ownership; it does not touch the materials cap/canonicalization,
generation routing, reset contract, refine flows, result flows, services, Edge
Functions, or legacy dialog handlers/rendering.

## INDEPENDENT RUNS AT `f5cfc7d`

| Check | Result |
|---|---:|
| Scoped M3b suite | **22/22 passed** |
| Unconditional-finally mutation | **1 failed / 21 passed**; only new [B1], 3 inserts observed |
| State-guard mutation | **1 failed / 21 passed**; only same-tick witness, 2 inserts observed |
| `tsc -p tsconfig.app.json --noEmit` | **1033** diagnostics; established identity preserved, including the same six pre-existing dialog diagnostics with line shifts only |
| `eslint .` | **159** problems (**114 errors / 45 warnings**); both changed files individually clean |
| Full Vitest, serial | **6 failed / 361 passed**; exactly the frozen six `MesaAbiertaDashboard` failures |

## SHOULD-FIX

None.

## NITS

None.

## SCOPED QUESTION ANSWERS

### Q1 — Is [B1] closed under the exact interleaving?

Yes. A stale context can neither release B's owner token nor clear B's spinner, and a
second click in B reaches no insert while B owns the ref. The targeted mutation proves
the regression detects the former three-insert behavior.

### Q2 — Any defect in the `+99/-8`?

No. Spinner transitions are context- and owner-consistent, symbol lifetime is bounded
by the in-flight attempt, reset semantics remain intact, and the new regression is
honest at the real service/client boundary.

### Q3 — Is [A6] fully met, completing [A1]-[A11]?

Yes. [A6] is FULLY MET. With all binding round-1 rulings carried forward, every
criterion [A1]-[A11] is met, including the already-accepted [A11] deviation.

### Q4 — Is there any remaining reason not to make this live?

No. The sole round-1 blocker is fixed and independently regression- and mutation-
verified. I found no new release blocker or should-fix residue.

FINAL CAP RULING: M3b PASS round 2/2 FINAL. Brent may merge `feat/mat-wire` and make
the feature live.
