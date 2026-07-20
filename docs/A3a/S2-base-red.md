# A3a/S2 — BASE-RED Evidence: Cases 2, 3, 11

Base HEAD: `02f7909` (bridge/task-1157)
Test file: `src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx`

## Expected pass/fail split on base

| Case | Description | Expected |
|------|-------------|----------|
| 1    | Debounce drain + authoritative commit + transition + auto-kick | PASS |
| 2    | Stale closure in buildAuthoritativeDraftPatch | **FAIL** |
| 3    | Late debounce overwrites committed step | **FAIL** |
| 4    | Lifecycle change before enqueue drops old authoritative | PASS |
| 5    | Unmount during blocked persistence → no onStoryCreated | PASS |
| 6    | canApprove gate consulted for no-failure case | PASS |
| 7    | canApprove gate open when no pipeline save-failed entries | PASS |
| 8    | Authoritative rejection preserves story step, no auto-kick | PASS |
| 9    | Finalization calls onStoryCreated after commit | PASS |
| 10A  | Finalization rejection → no onStoryCreated | PASS |
| 10B  | Blocked finalize → onStoryCreated called exactly once | PASS |
| 11   | Late debounce (fake timers variant) overwrites committed step | **FAIL** |

---

## Case 2: Stale closure in `buildAuthoritativeDraftPatch`

Command: `npx vitest run src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx -t "Case 2"`

Failure:
```
AssertionError: Expected authoritative patch to have newest edit 'NEW EDIT' but got 'ORIGINAL EDIT'. This reveals the stale closure defect in buildAuthoritativeDraftPatch.

- Expected: "NEW EDIT"
+ Received: "ORIGINAL EDIT"
```

Why this proves defect X:
`buildAuthoritativeDraftPatch` is a `useCallback` with `editingScenePrompt` in its dependency array. The callback is rebuilt only when deps change, which means the closure captures the value of `editingScenePrompt` from the LAST render before the approval click. When a user edits the prompt to 'ORIGINAL EDIT', clicks approve, and while the authoritative upsert is blocked edits again to 'NEW EDIT', the authoritative patch was already built with the stale 'ORIGINAL EDIT' closure. A correct implementation would read `editingScenePrompt` from a live ref at patch-build time, ensuring the newest edit ('NEW EDIT') is captured in the committed snapshot.

---

## Case 3: Late debounce overwrites committed step

Command: `npx vitest run src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx -t "Case 3"`

Failure:
```
AssertionError: Expected no post-authoritative 'scenes' upsert but found 1. This reveals the debounce-overwrites-committed-step defect.

- Expected length: 0
+ Received length: 1
```

Why this proves defect X:
`performDraftWrite` chains new writes onto `writeTailRef.current` — the tail of the serialized write queue. When a user arms a debounce WHILE an authoritative write is in-flight (blocked), the debounce write chains AFTER the authoritative write. When the authoritative write completes (committing `current_step='cover'`), the queued debounce executes with its stale `current_step='scenes'` patch. This write goes through to the database, overwriting the newly committed step. A correct implementation would compare `current_step` in the patch against a live `currentStepRef` at write-start time and discard stale patches whose step is behind the live step.

---

## Case 11: Late debounce (fake timers variant) overwrites committed step

Command: `npx vitest run src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx -t "Case 11"`

Failure:
```
AssertionError: Expected no stale 'scenes' upsert after committing 'cover', but found 1. This proves the late-debounce-overwrites-committed-step defect.

- Expected length: 0
+ Received length: 1
```

Why this proves defect X:
Identical structural defect to Case 3, exercised with a different fixture (`characters-approved` story starting at the scenes step) and verified using fake timer control to deterministically advance the debounce timer and ensure the debounce write is chained onto the write queue AFTER the blocked authoritative write. The late debounce fires its upsert after the authoritative commit resolves, writing `current_step='scenes'` to the database after `current_step='cover'` was already committed. This confirms the defect is not fixture-specific but inherent to the write-queue serialization model without a step-staleness guard.

---

## Escape hatch removal

The original test file contained silent escape hatches at Case 2 (lines 515-518), Case 3 (lines 623-627), and Case 11 (lines 1100-1103). These caused the tests to silently pass when the authoritative upsert was not found in `upsertCalls`, hiding potential setup failures. These have been replaced with hard assertions:

- Case 2: `expect(authUpserts).toHaveLength(1)` — fails at setup if auth upsert is absent
- Cases 3, 11: `expect(authIdx).toBeGreaterThanOrEqual(0)` — fails at setup if auth upsert is absent

If either hard assertion fails (rather than the base-defect assertion), the test setup is broken — not the base defect being demonstrated.

## Case 7 rewrite

The original Case 7 tested `expect(approveBtn).not.toBeDisabled()` which failed because the "Aprobar escenas" button is disabled due to `scenesSelected < story.scenes.length` (no scene images selected in the fixture), regardless of pipeline state. This was unrelated to the `isBusySaving` gate.

The rewrite tests the gate CONTRACT: with no pipeline save-failed entries (`saveFailedCount=0`, `isBusySaving=false`), `canApprove` returns true and a click on the approve button produces exactly one authoritative `scenes→cover` upsert followed by transition to the cover step. The button's UI `disabled` attribute is not tested — only the handler's gate behavior.
