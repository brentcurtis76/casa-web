CODEX REVIEW — PLAN-MATERIALES ROUND 1 — `main`@`d79d329`

VERDICT: FAIL

The initiative is directionally sound: the existing inventory table is the right reuse point,
the RLS predicates for lessons and inventory are aligned, both Edge Functions accept additive
JSON keys without rejecting old/new callers, the two prompt splice points are real, and the
current refine writer does drop additive content keys. I would not freeze the plan yet. Four
items remain execution-risking: the selected/persisted list is not the list the EF actually
uses at the M-D5 limits; generation is not required to wait for the lazy inventory fetch; M2's
type-parity criterion contradicts the base types and branch topology; and M3 combines a
905-line dialog edit with a full real-orchestrator test boundary under a line/session budget it
is very unlikely to meet.

I ran the required `jb list` before any repository action. The reviewed repository was on
`main` at exact commit `d79d32913a7efca6aa73c1250c380950a8744003`, with only the stated
ambient `.gitignore` modification. I made no checkout, branch, worktree, code change, deploy,
or provider call. This review is the only file written.

## BLOCKING

### [B1] M-D3 and M-D5 do not define one canonical, user-visible effective list

M3 constructs and displays checked inventory names plus one-offs, trimmed and CI-deduped. M2
then promises to send and persist that array **exactly as passed**. M1 alone applies the real
boundary contract: control removal, whitespace collapse, CI dedupe, 120-character truncation,
and a 60-item cap.

That creates observable lies at the feature's load-bearing boundary. With 61 inventory rows,
M3 opens all 61 checked and reports 61 selected; M2 snapshots all 61; the generate prompt gets
only 60. A name over 120 characters or a name that changes under whitespace/control
normalization likewise appears one way in the UI/content snapshot and another way to the model.
Refinement will reapply the EF sanitizer, so it is consistently constrained to the sanitized
subset, but `content.availableMaterials` is not a snapshot of the effective generation
contract and the user cannot tell which selection was ignored.

Required plan amendment:

- Freeze one canonical effective-list algorithm and order, not merely an EF security
  sanitizer. Keep the EF sanitizer as the trust boundary, but apply the same contract before
  invoke and persistence.
- Persist the canonical effective list that was actually eligible for the prompt. Do not
  persist an unsanitized/unbounded UI list as the alleged generation snapshot.
- Make the 60-item behavior visible and non-silent: prevent selection beyond the cap, or provide
  a deterministic warning/error and require the user to reduce the list. "All pre-checked"
  cannot coexist with silently ignoring rows 61+.
- Add shared conformance vectors across the FE and Deno implementations for 61 items, a
  121-character item, control/newline input, collapse-created duplicates, and ordering. Add an
  integration assertion that UI effective list = invoke body = persisted snapshot = prompt
  bullets.

Until this is resolved, the strict picker can claim that a material is available while making
it unavailable to both model calls.

### [B2] The materials step can become an unconstrained-generation race during loading

M3 specifies lazy fetch, loading copy, and an enabled fallback after fetch error, but never
states that `Generar` is disabled while the first inventory request is unresolved. Zero
selection is intentionally valid and omits the field. Therefore an implementation that follows
the text can render the step with zero selected items, allow an immediate click, and generate
unconstrained milliseconds before a non-empty inventory response would have pre-checked every
row. This defeats M-D1's "all pre-checked" normal path and is indistinguishable from the
explicit escape hatch.

Required plan amendment: `Generar` MUST remain disabled until the first inventory request for
the active dialog/liturgy context settles. It becomes enabled after success (including empty)
or after the explicit error fallback. Add a deferred-promise test proving no invoke occurs
while loading, then prove success pre-checks the returned rows and error/empty enables the
documented fallback.

### [B3] M2's type-parity acceptance is false at base and its declared base omits M1

The EF `GenerateChildrenLessonRequest` already declares `requestId?: string` at
`generate-children-lesson/index.ts:34-35`; the FE copy at
`src/types/childrenPublicationState.ts:71-88` does not. M2 says that copy "gains the field"
`availableMaterials`, while [A8] requires it to match the extracted EF request type
field-for-field. Those instructions cannot both be satisfied within the frozen M2 scope.

There is a second sequencing contradiction: the phase table puts M2 off
`main`@`d79d329`, yet [A8] compares against M1's new `prompt.ts`, which does not exist at that
base. M3 is then based on the M2 tip, so its review branch would also omit M1 even though the
feature's local source tree is supposed to represent the complete implementation.

Required plan amendment: either add `requestId?: string` to M2's explicit scope and criteria,
or narrow [A8] to exact parity of the newly introduced field and acknowledge the pre-existing
copy drift. Prefer making M2 from post-M1 `main` (after M1 merge), and M3 from that M2 tip, so
each phase can inspect/test the contracts on which it depends. If independent off-base branches
are intentional, remove criteria that require files absent from those branches and define the
integration-review point explicitly.

### [B4] M3 is not credibly one fresh executor session under its own test boundary and cap

`ChildrenActivityDialog.tsx` is exactly 905 lines. M3 adds a stateful async view, two entry
paths, inventory query lifecycle, grouped checkbox UI, bulk controls, one-off editing,
per-item persistence, auth-derived insert data, stale-result guards, and generation wiring.
Its test must exercise the real M2 orchestration while mocking only the Supabase client and
toast. That means the component suite must recreate every live query shape used by age-group
loading, existing-lesson loading, inventory, liturgy verification, auth/session refresh,
lesson upsert, lesson-material upsert, calendar upsert, publication upsert, post-generation
refresh, and EF invocation. The existing real orchestration suite avoids this exact burden by
mocking `lessonService`, `calendarService`, and `childrenPublicationStateService`.

That is not compatible with a credible `<=~600` net-line cap once production UI plus nine
substantive component scenarios are counted, and it creates a large brittle chain fake whose
failures will not localize to the materials behavior.

Required plan amendment: split M3 before execution, or change the test topology. A sound split
is (a) extracted materials state/view plus pure normalization and focused UI/service-boundary
tests, then (b) the small dialog routing/wiring change with one real-M2 end-to-end proof.
Alternatively allow inventory/children collaborator mocks for UI-state tests and retain one
separate real-service wiring test that mocks only Supabase. Keep both merge-gated behind the M1
deploy so the intermediate extraction is inert. Make `MaterialsStepView.tsx` mandatory rather
than an optional escape hatch if the phase remains single.

## SHOULD-FIX

### [S1] The verified RBAC map and Backlog omit a later Liturgist grant

The table policies are as claimed: age-group SELECT and inventory SELECT both require
`children_ministry/read`; lesson INSERT and inventory INSERT both require
`children_ministry/write` (`20260215100000...:300-316,484-488`). This supports the important
M-D9 conclusion that a user who can successfully run the existing publish flow gains no new
permission class from the picker.

However, the "general_admin, coordinator, volunteer only" code-map statement stops at the
initial RBAC migration. `20260216190000_casa_children_publication_state.sql:199-216` later
grants the `liturgist` role both children read and write. Consequently the Backlog statement
that a pure Liturgist cannot use the dialog is false. A pure `equipo_pastoral` user remains
without the grant; a children volunteer has read only and can see age groups/inventory but
cannot generate or quick-add successfully. Correct the verified map, M-D9 explanation, and
Backlog role observation without changing the permission-surface decision.

### [S2] M2 should make the content object additive-key-safe, not special-case only this key

The reader audit is accurate: `parseLessonPhases`, ExportPanel, the raw detail/editor views,
and the known packet sender behavior do not reject an added object key. The current refine
writer at `liturgyChildrenPublishService.ts:658-662` reconstructs exactly three keys and drops
every unknown key. The plan changes that whitelist from three keys to four, which saves this
initiative's key but retains the same data-loss trap for manual/future additive content.

Preserve unknown object keys during refinement while replacing the three model-owned keys and
conditionally retaining/removing only `availableMaterials`. Add a sentinel-key round-trip
test. Also strengthen [A7]: a mixed array such as `["papel", 7]` is array-shaped but not a
`string[]`; do not let an `Array.isArray && length` check reserialize it as a valid snapshot.
Cover mixed entries and whitespace-only strings, not only a scalar and `[]`.

### [S3] M-D2 needs direct empty-array golden tests in both prompt modules

M-D2 makes absent **and empty** byte identity the deploy-order contract. M1 [A3] directly
goldens only field-absent output; the sanitizer's separate `[]` assertion does not prove that
each prompt builder uses the sanitizer result correctly. Require the base literal to match for
both `undefined` and `[]` in both generate and refine builders, with the same splice mutation
proof. This is cheap and protects the exact interoperability bet the rollout relies on.

### [S4] Quick-add success needs a terminal UI state and duplicate behavior

The plan defines payload and toasts but not what happens to the item/action after a successful
save. If the extra remains with an active `Guardar en inventario` button, repeated clicks can
insert duplicate permanent rows; an extra whose name already matches an inventory row can do
the same. Define success to incorporate/mark the returned inventory row and disable or replace
the save action for that extra. Define the case-insensitive existing-name behavior. Test a
double click/repeated action and confirm generation still includes the name exactly once.

### [S5] Reset and stale-result criteria need to cover the group-specific state, not only inventory

`pendingGroupIds` is tied to the liturgy in which Continuar/Regenerar was clicked. The existing
open effect clears age groups and existing activities on a `liturgyId` change but does not
reset every dialog view state. M3 [A9] mentions discarding an old inventory result even though
inventory itself is church-global; it does not require the old pending groups/materials view
to be abandoned or require a fresh active request to become authoritative.

Bind a liturgy-change reset for `pendingGroupIds`, view, selection/extras/error/loading state,
and generation eligibility. The stale-promise test should prove the old promise cannot mark
the new context loaded/error or enable generation, and that the active context can still
settle normally.

### [S6] Turn the M-D8 deploy sentence into an auditable release gate

The order is technically sound: old EFs leniently ignore the additive request key, new EFs
accept old callers, M2 is dormant, and M3 is correctly forbidden before both deployed prompts
exist. But there is no named inter-phase artifact proving which commit was deployed or that
both functions received it.

Add an explicit Brent-authorized release checkpoint after M1 and before the M2/M3 release
chain: exact two-function deploy command, CLI/runtime record, deployed M1 commit, remote
function/version evidence, and authenticated smoke evidence for both prompt contracts. No
deploy belongs inside M1; this is a separate gate as inherited D9 requires.

The config-map wording should also be corrected. The project-root `supabase/config.toml` does
not explicitly list either children EF. The files under each function directory contain
`verify_jwt = true`, but they use inconsistent table shapes and are not the project-root
per-function configuration documented by Supabase. Effective JWT verification is still true
because it is the platform/CLI default and the deploy does not use `--no-verify-jwt`; describe
that reality instead of treating both nested files as authoritative. See
https://supabase.com/docs/guides/functions/function-configuration.

## NITS

None. The remaining items are contract or execution concerns, not editorial polish.

## NOTES ON THE PLAN ITSELF

- **Reality checks that pass:** `getInventory()` and `createInventoryItem()` have the claimed
  query/insert shapes; `ChildrenInventoryInsert` is non-partial; category labels match the five
  Spanish groups; inventory creation defaults are accurately derived; generate's blank-line
  splice is at `:233-235`; refine's insertion point is at `:154-157`; both handlers use a
  lenient `await req.json()` cast; `previewPromptOnly` and `ensureFreshSession` anchors are
  accurate; and the current refine writer really does drop unknown content keys.
- **M-D9 is substantively right after the factual role correction.** Inventory SELECT/INSERT
  uses the same permission actions as the age-group/lesson operations needed by a successful
  existing flow. No migration or policy widening is needed for this feature.
- **M1 size is reasonable.** Two small pure prompt extractions plus one sanitizer and focused
  Deno tests fit a fresh session. The requirement that handler logic remain unchanged is
  enforceable by diff review. M2 is also reasonably sized. M3 is the outlier described in [B4].
- **The named tests generally test behavior, not mere execution.** M1 targets exact prompt
  bytes/blocks; M2 targets invoke bodies and persisted JSON; M3 targets routing and the real
  invoke body. [B1]-[B4] are what prevent those good test intentions from being executable as
  written.
- **D6 wording is correct.** The plan consistently asks for like-for-like base/head identities,
  not a globally green dirty repository. D7 is coherent for the new files so long as reports do
  not count "module/file absent at base" as a behavioral base-red proof; the named mutation
  proofs are the right substitute for already-correct byte-identity and sanitizer behavior.
- **Regenerar is covered.** Routing a single staged group through the picker closes the obvious
  bypass. Error and empty-inventory paths are named. The missing path is the unresolved-loading
  race in [B2], not a missing Regenerar phase.
- **M-D3 is a good product architecture only after [B1] and [S2].** A per-lesson snapshot makes
  refinement reproducible and avoids changing an existing activity because inventory later
  changes. It must be the effective canonical prompt list and must coexist safely with other
  additive content keys.
- **No Brent product decision needs relitigation.** Consequences worth keeping explicit are:
  strictness remains prompt-level rather than enforced on model output; fetch failure/empty or
  deliberate zero selection produces truly unconstrained generation; a user with children
  read but not write can see the picker but quick-add/generation will fail under existing RLS;
  and pre-check-all makes the 60-item UX decision unavoidable rather than theoretical.

I would be willing to re-review a revision that closes [B1]-[B4]. I would not authorize plan
freeze or execution from this text as it stands.
