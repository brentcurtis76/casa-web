CODEX REVIEW — PG ROUND 2/2 FINAL — pg-fix-d3fbd58@1b0cfed

VERDICT: PASS / CONFIRMED

The sole round-1 blocker, [B1], is fixed. The new real-editor T-G.11 case
deterministically parks a cover write in `persisting`, proves that the real Cancelar leaves that
write alone while normalizing its sibling, and is sensitive both to the forbidden
`persisting` sweep and to removal of the parking mechanism. The remediation is exactly one
test-only commit touching the two permitted files; I found no production, contract, or
out-of-scope residue.

The round-1 ratifications of F2/F5/F7, F1/F3/F4/F6/F9, gates, and scope remain binding. This
final round addresses only [B1], its permitted related residue, the branch-name deviation, and
the updated gates.

## REVIEW TARGETS AND METHOD

- Closing target: `pg-fix-d3fbd58` at
  `1b0cfed870ba2dbcd39cb9deabb9804542aca569`.
- Reviewed parent: `phase/pg-cancellation` at
  `d3fbd585be440517d27a9862266e19b7e6624152`; frozen PB base remains
  `5f7b6bdb5095351a2da3f4d5e530f16673e6c626`.
- The remediation range is exactly one commit. `git merge-base` is exactly `d3fbd58`, and
  `git merge-base --is-ancestor d3fbd58 1b0cfed` succeeds.
- The range is exactly two test files, +147/-2: 128/1 in the real-editor PG suite and 19/1 in
  `pbBoundary.ts`. `supabase/**` has an empty diff; there is no production-file change;
  `PipelineItemStatus` is untouched; and `git diff --check` is clean.
- The frozen PB fixture remains blob
  `70204600a10ad1e43595da9a93856b4a6b34b459` at both parent and tip.
- I ran `jb list` before creating detached disposable worktrees. All Node executions used
  Node `v22.22.0` and serial Vitest. Production and committed tests were read at the pinned
  SHAs. No provider call, protected-ref checkout, merge, deploy, or production edit was made.
- Both required temporary mutations were applied only in the detached tip worktree, reverted,
  and followed by a clean tracked-state check. The tip and parent disposable worktrees were
  then removed; both protected refs remained pinned.

## Q1 — [B1] REMEDIATION MATRIX

| Step | Ruling | Independent evidence |
|---|---|---|
| [B1].1 — additive persistence gate | **FIXED** | `BoundaryControls.upsertGate` is opt-in and defaults to `null`. The upsert call is constructed and pushed to `upserts` before the hook is consulted; the hook runs before any simulated draft row is read or changed. With the default `null`, the path performs only the new null check: there is no `await`, extra tick, response change, or row-order change. `resetBoundary()` uses `Object.assign(ctl, makeDefaultControls())`, so it restores `upsertGate: null`. The seven-file PB family passed 135/135. |
| [B1].2 — park a real editor item in `persisting` | **FIXED** | The new case drives the production editor through scene approval into the cover/end run, waits for one cover and one end paid-boundary invocation, arms the gate, resolves the cover provider, and records exactly one new draft upsert. Before clicking, it requires a captured gated call, exactly one `Guardando...` button, and exactly one sibling `Generando...` button. This establishes real `persisting` rather than the former completed-persistence fast path. |
| [B1].3 — cancel and recovery assertions | **FIXED** | The helper requires exactly one enabled real `Cancelar` and clicks it. The case then proves the cover invocation's paid-boundary signal is aborted, the cover remains `Guardando...`, no persistence call is reissued, the sibling spinner and run control disappear, `Generar "Fin"` is enabled, and no invocation appears over 1.2 seconds. Releasing the gate removes `Guardando...`, produces no `Reintentar guardado`, preserves the applied cover UI, leaves `Regenerar` enabled, and exposes four `coverPaths` in the parked payload. Clicking `Generar "Fin"` dispatches the second end invocation without remount. |
| [B1].4 — M-SOL-2 sensitivity | **FIXED** | I changed the invalidation sweep from `status === 'running'` to `status === 'running' || status === 'persisting'` and ran the editor and runner files together. Result: exactly **2 failed / 34 passed**. The new editor case failed at its post-cancel `Guardando...` assertion; T-G.9a failed with expected `persisting`, received `pending`. Thus the forbidden behavior is now detected at both the G7 editor bar and the runner layer. The mutation was reverted. |
| [B1].5 — normal evidence and gates | **FIXED** | At the pristine tip, the new case passed as part of PG 64/64; the seven-file PB family passed 135/135; and the full serial run contained only the frozen Mesa six. As an additional adversarial probe, I changed the gate predicate to `if (true || !armed ...)`, preventing the park. The filtered new case failed at `expect(gatedCall).not.toBeNull()` (1 failed / 10 skipped). This proves the park is load-bearing and cannot silently collapse to the fast path. The probe was reverted. |

**Q1 answer: FIXED.** The real-editor proof now detects precisely the production mutation that
escaped the round-1 editor case, and the independent gate-neuter probe detects loss of the test
precondition itself.

## Q2 — REMEDIATION RESIDUE SWEEP

The remediation is confined to the permitted residue. The only changed surfaces are the
additive `pbBoundary.ts` control and the new/retitled T-G.11 editor evidence. There is no
cancellation-production change, Storage change, lifecycle change, status-union change, edge
change, fixture change, or wire-envelope change.

The `upsertGate` extension meets the binding F7 standard:

- observation remains synchronous because `upserts.push(call)` precedes the gate;
- simulated-row mutation remains downstream of the optional wait;
- `null` is the default and adds no await or scheduling boundary;
- `resetBoundary()` reconstructs and assigns the null default; and
- all seven selected PB suites remain green at 135/135.

The prior case's new title is honest. It now expressly scopes itself to persistence already
completed at click time and claims only that cancellation does not visually revert the applied
cover options while the unapplied end remains collectible. It is no longer presented as proof
about an in-flight persistence sibling; the new parked case exclusively carries that claim.

No new remediation defect or disallowed residue was found.

## Q3 — BRANCH-NAME DEVIATION

**RATIFY.** `phase/pg-cancellation` is preserved exactly at `d3fbd58`, where it is already
checked out in the executor worktree. `pg-fix-d3fbd58` contains exactly one fast-forward commit
from that tip, with ancestry verified in both directions relevant to the close. The separate
fix-branch name is an operational accommodation, not a topology or scope change, and follows
the existing `pf-fix-7d32182` and `a3-f4-fix-5971d5f` precedent. I ratify
`pg-fix-d3fbd58@1b0cfed` as PG's closing branch/tip while retaining
`phase/pg-cancellation@d3fbd58` unchanged.

## Q4 — GATE CONCURRENCE

**CONCUR.** My clean-tip executions under Node v22.22.0 produced:

```text
PG focused, serial:       4 files, 64 passed / 0 failed
PB family, serial:        7 files, 135 passed / 0 failed
Full Vitest, serial:      66 files; 818 passed / 6 failed = 824 total
Full failure set:         exactly the six named MesaAbiertaDashboard cases

tsc parent/tip:           1041 / 1041 diagnostics
normalized identity diff: 0 removed / 0 added

ESLint parent/tip:        159 / 159 problems (116 errors, 43 warnings)
normalized multiset diff: 0 removed / 0 added
```

For TypeScript I excluded position and normalized detached-worktree paths before the
bidirectional multiset comparison. For ESLint I compared rule + message + relative file with
multiplicity and no line/column. Both deltas are empty in both directions.

## Q5 — FINAL PHASE VERDICT

**PASS / CONFIRMED.** Round 1 left only G7/T-G.11's real-editor persisting-sibling evidence
open. [B1] now supplies that deterministic proof and the required mutation sensitivity without
changing production. The binding round-1 findings therefore combine with this remediation as
follows:

- G1–G6: **MET** (binding round-1 rulings).
- G7: **MET IN FULL**; the real-editor bar now includes the parked `persisting` sibling proof.
- G8: **MET** (binding round-1 ruling; no frozen residual was touched).
- T-G.1 through T-G.10 and T-G.12 through T-G.13: **MET** (binding round-1 rulings).
- T-G.11: **MET IN FULL** at the real-editor/G7 layer, with M-SOL-2 and the independent
  gate-neuter probe both load-bearing.

## FINAL CLOSE

- [B1] five-step remediation matrix: **FIXED**.
- Permitted residue only: **CONFIRMED**.
- Additive F7 boundary standard: **CONFIRMED**.
- Retitled prior case: **HONEST FOR ITS NARROWED CLAIM**.
- Branch-name deviation: **RATIFIED**.
- Gates: **CONCUR / D6 SATISFIED**.
- G1–G8 and T-G.1–T-G.13: **MET IN FULL**.

PG is confirmed for final phase close at `pg-fix-d3fbd58@1b0cfed`. No blocking or
low-confidence item remains.
