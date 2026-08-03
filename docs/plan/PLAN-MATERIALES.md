# PLAN — CASA materiales disponibles (children's activity generator)

META
- REPO / ROOT: /Users/brentcurtis/Documents/CASA/casa-web
- BASE: `main`@`d79d329` for M1. Later phases base on post-merge `main` (M-D8); the
  exact SHA is recorded in each executor prompt when its round opens. Worktree note:
  one pre-existing dirty file `.gitignore` — ambient, not this initiative's, leave
  untouched. Run `jb list` before any checkout (shared-worktree rule).
- BRANCH CONVENTION: `feat/mat-*` (≤20 chars)
- RELATION TO PLAN.md (cuentacuentos overhaul): **parallel initiative, file-disjoint
  from every open phase there** (PG = story pipeline/editor; this plan =
  ChildrenActivityDialog + MaterialsStepView + children publish service + children EFs
  — zero path overlap, PM-verified). Shares LEDGER.md (labels `M-*`) and reviews/
  (`M-*.md`). Inherits by reference from PLAN.md: SOP roles and caps (§1.5), Operating
  and review gates 1–7, and decisions **D5** (captured evidence, `git show`, never
  hand-written), **D6** (delta-based gates), **D7** (test honesty), **D8** (Spanish
  copy), **D9** (merge/deploy only on Brent's explicit word; EF deploys are a separate
  authorized step, never inside a phase).
- PLAN FROZEN: **yes — 2026-07-31**, per Codex round-3 PASS
  (`reviews/M-PLAN-review-3.md`; history: r1 FAIL 4B/6S → r2 FAIL 2B/2S → r3 PASS
  with zero findings). Brent's two retained product vetoes stay open (the visible
  >60 pre-check rule; whether M-REL1 requires a paid refine smoke) — exercising
  either is a product Decision-log amendment, not a defect. Any other change after
  this date requires a dated Decision-log entry and a renewed freeze check.

## Goal

In the liturgia builder's children's-activity generator (`ChildrenActivityDialog`,
opened from the Export step), add a materials step before generation: the user selects
from the church's persistent materials list (`church_children_inventory`), can type
one-off extras, and can save typed items into the permanent list — and both generation
and refinement design activities using ÚNICAMENTE those materials, so activities stop
requiring new purchases.

**Product decisions (Brent, 2026-07-31, binding):** strict constraint (only listed
materials; no-material activities remain allowed) · inventory list opens ALL
pre-checked · typed one-offs are "solo esta vez" with a per-item "Guardar en
inventario" action · the constraint applies to ALL refinement types.
**Cap consequence (from review [B1], flagged for Brent's veto):** the effective list
is hard-capped at 60 entries; when the inventory exceeds 60, the step pre-checks the
first 60 canonical-distinct names in M-D12 order and says so visibly — "pre-check
all" cannot silently
coexist with a cap. Current inventory is far below 60, so this is an edge-case rule,
not a UX change today.

## Non-goals

- No authz changes to the children EFs (they rely on platform-default JWT
  verification only — pre-existing gap, recorded in Backlog, untouched here).
- No `validateLesson` subset enforcement (string-matching "papel blanco" vs "papel" is
  brittle; the constraint is prompt-level by design).
- No new tables, no migrations, no RLS/grant changes.
- No changes to hardcoded `durationMax: 30` / children 2–15; no inventory admin UI
  changes; no `send-children-service-packet` fixes; no TanStack Query adoption.

## Frozen architectural decisions

| # | Decision | Since | Raised by |
|---|---|---|---|
| M-D1 | Persistent list = existing `church_children_inventory`; no new table. Picker consumes `name` + `category`; never filter by `quantity > 0` (create paths default 0). Fetch failure/empty inventory degrades to unconstrained generation. | 2026-07-31 | PM / Brent |
| M-D2 | One optional field end-to-end: `availableMaterials?: string[]` (names, never ids). Absent **and empty** ⇒ **byte-identical prompts to base** in both EFs (golden-tested for `undefined` AND `[]`), so any FE/EF deploy order interoperates. | 2026-07-31; [S3] 2026-07-31 | PM |
| M-D3 | Per-lesson snapshot: the **canonical effective list** (M-D5) persists as `availableMaterials` inside the lesson `content` JSON. Refine reads the snapshot only (never re-fetches inventory) and MUST re-serialize it. Picking up newly bought materials = Regenerar (which passes through the picker). | 2026-07-31 | PM |
| M-D4 | Strict-only constraint wording (normative Spanish blocks in M1 spec), applied in refine for EVERY `refinementType` whenever the snapshot exists. | 2026-07-31 | Brent |
| M-D5 | **Canonical effective-list algorithm — ONE algorithm, two implementations** (FE `src/lib/children-ministry/materialsList.ts`, Deno `_shared/availableMaterials.ts`), applied per item IN THIS ORDER: (1) replace control chars U+0000–U+001F / U+007F–U+009F with a space; (2) collapse whitespace runs to one space; (3) trim; (4) drop empties; (5) truncate to **120 UTF-16 code units** (the unit of JS `.slice(0, 120)` and HTML `maxLength`), **then trim again and drop if empty** ([B1-R] fixed point); (6) case-insensitive dedupe on the truncated value via `String.prototype.toLowerCase()` with NO locale argument, first occurrence wins; (7) cap the list at **60**, input order preserved throughout. **The algorithm is a fixed point: both suites assert `f(f(x)) === f(x)` for EVERY conformance-vector input** ([B1-R]). Both implementations MUST pass the normative conformance vectors (§Conformance vectors). The EF copy stays the trust boundary (also drops non-string entries); the FE copy is the product contract applied **before invoke and before persistence**, so UI effective list = invoke body = persisted snapshot = prompt bullets ([B1]). | 2026-07-31 ([B1]); [B1-R] 2026-07-31 | Codex Sol / PM |
| M-D6 | Quick-add uses `createInventoryItem` with `{category: 'other', quantity: 0, min_quantity: 0, location: 'Sala Infantil'}` (+ nullable fields per `ChildrenInventoryRow`, `created_by` = user id or null; `ChildrenInventoryInsert` is non-partial). A failed save NEVER blocks generation. **Terminal state on success:** the item leaves the extras section (its save action with it) and joins its category group, checked; repeated saves are guarded; a typed name that case-insensitively matches an existing inventory row checks that row instead of inserting ([S4]). | 2026-07-31; [S4] 2026-07-31 | PM / Brent / Codex Sol |
| M-D7 | Regenerar (single group) routes through the materials step too — never silently reuses a stale selection. Within one dialog session the checkbox state persists. | 2026-07-31 | PM |
| M-D8 | Sequencing & rollout: M1 (off `main`@d79d329) → merge → **M-REL1 release gate (Brent-authorized deploy of both children EFs, evidence recorded)** → M2 (off post-M1 `main`) → merge → M3a (off post-M2 `main`) → merge (inert) → M3b (off post-M3a `main`) → merge (feature live). Hard rules: **no M2/M3a/M3b merge before M-REL1**; each phase branches from post-merge `main` so its tree contains everything it depends on ([B3]). Deploy from casa-web, Supabase CLI ≥ 2.110. | 2026-07-31 ([B3]/[S6]) | Codex Sol / PM |
| M-D9 | Zero permission-surface change: inventory SELECT/INSERT use the same `children_ministry` read/write actions the dialog's existing flow already requires (age-groups SELECT, lessons INSERT). Grant holders today: general_admin (bypass), children coordinator (read/write/manage), children volunteer (read), **and liturgist (read+write since `20260216190000_casa_children_publication_state.sql:199-216`)** ([S1] correction). A children-volunteer (read-only) can see the picker but cannot generate or quick-add — pre-existing RLS behavior, unchanged. | 2026-07-31; corrected [S1] | PM / Codex Sol |
| M-D10 | **Generation gating ([B2]):** in the materials step, `Generar` stays disabled until the FIRST inventory request for the active dialog/liturgy context settles — enabled after success (including empty inventory) or after the explicit error fallback. A pending fetch can never be bypassed into an unintended unconstrained generation. | 2026-07-31 ([B2]) | Codex Sol |
| M-D11 | **Additive-key-safe content writes + canonical refine snapshots ([S2]/[B2-R]):** the refine writer preserves ALL unknown `content` keys (spread parsed content, overwrite the three model-owned keys, then explicitly set or remove ONLY `availableMaterials`). A **usable** snapshot is one that is (1) an array with every entry a string, (2) canonicalized ONCE through the FE M-D5 implementation, and (3) non-empty after canonicalization. The SAME canonical result feeds the refine invoke body AND the rewritten `newContent` (healing historical or hand-edited content — `LessonEditDialog` exposes raw JSON). Invalid (scalar, mixed array) or canonical-empty input ⇒ the key is omitted from the body and removed from `newContent`; sibling keys always preserved. | 2026-07-31 ([S2]); [B2-R] 2026-07-31 | Codex Sol / PM |
| M-D12 | **Deterministic ordering contract ([S2-R]):** ONE order everywhere — fixed category order `craft → book → supply → equipment → other`, then `getInventory()` name order within each category, then extras in entry order. Used for: rendering, initial pre-check, bulk selection, and effective-list construction (hence prompt order). When inventory exceeds the cap, "first 60" means the first 60 **canonical-distinct names** in this order (not raw rows), so canonical name collisions never under-fill the selection. | 2026-07-31 ([S2-R]) | Codex Sol / PM |

## Conformance vectors (normative — implemented verbatim in BOTH the Vitest and Deno suites, cited as "PLAN-MATERIALES §Conformance vectors")

| # | Input | Canonical output |
|---|---|---|
| V1 | 61 distinct names `m01`…`m61` | `m01`…`m60` (first 60, order kept) |
| V2 | one 121-char name | its first 120 chars |
| V3 | `"témpera\n## Nueva Sección"` | `"témpera ## Nueva Sección"` |
| V4 | `["Papel", "papel", " PAPEL "]` | `["Papel"]` |
| V5 | `["  lápices   de   colores  "]` | `["lápices de colores"]` |
| V6 | `["   ", "\t\n"]` | `[]` |
| V7 | `["papel", "", "tijeras"]` | `["papel", "tijeras"]` |
| V8 | `["c", "a", "b"]` | `["c", "a", "b"]` (no sorting) |
| V9 | one 122-unit string: 119×`a` + `" bc"` | 119×`a` — truncation at 120 lands on the space; the step-5 re-trim removes it ([B1-R] fixed-point witness) |
| V10 | `"papel\u0000rojo"` | `"papel rojo"` — U+0000 → space via step 1; step 2 alone CANNOT produce this (non-whitespace control), so dropping step 1 turns V10 red ([B1-R] mutation witness) |
| V11 | `["Témpera", "témpera"]` | `["Témpera"]` (accented case-fold via `toLowerCase()`) |

Plus per-boundary rules: EF sanitizer drops non-string entries (Deno-only vector);
FE snapshot usability per M-D11. Both suites prove the **fixed point**
`f(f(x)) === f(x)` for every vector input ([B1-R]); the Deno suite additionally
proves **idempotence at the trust boundary**: `sanitize(v) === v` for every canonical
output above ([B1] — the EF must not re-shape what the FE already canonicalized).

## Phase index

| ID | Name | Status | Branch | Depends on |
|----|------|--------|--------|-----------|
| M1 | EF contract: `availableMaterials` in both prompts | **DONE + MERGED** — closed 2026-07-31 at `feat/mat-ef`@7f3600f (Sol PASS r1/2, `reviews/M1-review-1.md`); Brent-authorized ff merge pushed same day: `main`=`origin/main`=7f3600f (ref-only merge, shared worktree untouched). M-REL1 pending. | `feat/mat-ef` off `main`@d79d329 | — |
| M-REL1 | Release gate: deploy both children EFs (NOT a phase — Brent's authority) | **DONE** — executed 2026-07-31: generate v8→v9 (ezbr 86083269b00f), refine v11→v12 (ezbr c8d008bfb3fe) at tree 7f3600f; previewPromptOnly smoke PASS both directions; full evidence a–e in LEDGER | — | M1 merged ✓ |
| M2 | Canonical list module + service threading + snapshot + refine round-trip | **DONE** — closed 2026-07-31 at `feat/mat-svc`@60e9160 (Sol r2/2 PASS, `reviews/M2-review-2.md`: [B1] CLOSED, [A1]–[A10] fully met, zero findings); merge (dormant) awaits Brent | `feat/mat-svc` off `main`@7f3600f | M1 merged ✓; M-REL1 ✓ |
| M3a | `MaterialsStepView` presentational component | **DONE** — closed 2026-08-02 at `feat/mat-view`@b7b27e9 (Sol r2/2 PASS, `reviews/M3a-review-2.md`: [B1] CLOSED, [A1]–[A11] fully met, zero findings); merge (inert) awaits Brent | `feat/mat-view` off `main`@60e9160 | M2 merged ✓ (60e9160) |
| M3b | Dialog wiring: routing, fetch lifecycle, quick-add, threading | **DONE** — closed 2026-08-02 at `feat/mat-wire`@f5cfc7d (Sol r2/2 FINAL PASS, `reviews/M3b-review-2.md`: [B1] CLOSED, [A1]–[A11] complete, zero findings, "Brent may merge and make the feature live"); merge = FEATURE LIVE, awaits Brent | `feat/mat-wire` off `main`@b7b27e9 | M3a merged ✓ (b7b27e9); M-REL1 ✓ |

## Phase M1 — EF contract (`feat/mat-ef`)

**Scope:** Both children EFs learn the optional field. The EFs are single-file with
top-level `serve()` (untestable by import), so M1 does a **minimal prompt-module
extraction** — NOT the full handler/authz split: move the pure types +
`buildSystemPrompt` + `buildUserPrompt` (+ refine's `REFINEMENT_INSTRUCTIONS`) into a
`prompt.ts` per function; each `index.ts` changes only imports + deleted duplicate
declarations, `serve()` logic byte-for-byte otherwise.

Files (8): `supabase/functions/_shared/availableMaterials.ts` (+`_test.ts`),
`generate-children-lesson/prompt.ts` (+`prompt_test.ts`) + `index.ts`,
`refine-children-lesson/prompt.ts` (+`prompt_test.ts`) + `index.ts`.

**Normative prompt blocks (M-D4).** Generate — spliced so the block replaces the blank
line between `**Rango de Niños:** …` (index.ts:233) and `---` (:235); absent/empty ⇒
byte-identical output:

```
**Materiales Disponibles (inventario de la iglesia):**
- <item…>

**Restricción de Materiales:**
- Diseña la actividad usando ÚNICAMENTE materiales de la lista anterior.
- NO propongas comprar, conseguir ni pedir materiales que no estén en la lista.
- No es necesario usar todos los materiales; elige solo los que aporten a la actividad.
- Las fases sin materiales (movimiento, canto, conversación) son bienvenidas y válidas.
- En el campo "materials" incluye únicamente elementos de la lista anterior.
```

Refine — new section between `## Tipo de Refinamiento` (:154-155) and `## Feedback del
Usuario` (:157), applied for every `refinementType` when the field is present:

```
## Materiales Disponibles
La iglesia dispone únicamente de estos materiales:
- <item…>

Cualquier material que agregues o sustituyas DEBE provenir de esta lista. No propongas
materiales fuera de la lista. Las actividades o fases sin materiales están permitidas.
```

**Out of scope:** any FE file; authz; `validateLesson` semantics; model IDs;
`send-children-service-packet`; any deploy (M-D8/D9).

**Acceptance criteria:**
1. [A1] Baselines recorded BEFORE any edit: `deno test --allow-all .` / `deno lint .` /
   `deno check .` from `supabase/functions/` (deno 2.7.11) at base, plus the three FE
   D6 baselines. (Deno baseline may be non-clean — stray `* 2.ts` duplicates exist.)
2. [A2] All new Deno suites green; zero NEW failing/lint/check identities vs [A1].
3. [A3] Golden tests: `buildUserPrompt` output for BOTH `availableMaterials: undefined`
   AND `[]` strictly equals the base literal, in BOTH EFs ([S3]); literals captured via
   `git show d79d329:…` (D5), never retyped.
4. [A4] Present-field test proves the exact normative generate block, items in order.
5. [A5] Refine test (parameterized over all 8 types) proves the refine block appears
   for every type when the field is present, and never when absent/empty (golden).
6. [A6] Sanitizer implements M-D5 and passes ALL §Conformance vectors (V1–V11)
   verbatim, plus Deno-only rules (undefined/null/non-array ⇒ `[]`; non-string
   entries dropped), the idempotence proof `sanitize(v) === v` over every canonical
   vector output, AND the fixed-point proof `sanitize(sanitize(x)) === sanitize(x)`
   for every vector input ([B1-R]).
7. [A7] D7 evidence recorded per test: mutation proofs for the goldens (perturb the
   splice → red) and sanitizer (drop the control-replacement step → **V10 red**; V3's
   newline alone cannot catch this, [B1-R]); "file absent at base" is NOT claimed as
   base-red.
8. [A8] Both `index.ts` diffs confined to imports + removed duplicates (diff-inspected).
9. [A9] `GenerateChildrenLessonRequest` and `RefineRequest` both declare
   `availableMaterials?: string[]`.
10. [A10] FE gates: zero NEW identities vs D6 baselines (no FE file touched).
11. [A11] No file outside `supabase/functions/{_shared,generate-children-lesson,refine-children-lesson}`; no deploy.

**Test plan:** named tests per [A3]–[A6] in the three `*_test.ts` files.
Commands: `cd supabase/functions && deno test --allow-all . && deno lint . && deno check .`;
FE: `npx tsc -p tsconfig.app.json --noEmit` · `npx eslint .` · `npx vitest run --no-file-parallelism` (Node v22.22.0).
**Definition of done:** criteria checked, gates delta-clean, branch mergeable, no BLOCKING findings.
**Risks:** golden-literal drift (mitigated by D5 capture); unknown Deno baseline (absorbed by delta wording, [A1] mandatory).
**Rollback:** revert branch; production EFs untouched (no deploy in-phase).

## M-REL1 — Release gate (NOT a phase; Brent's authority, per inherited D9 + [S6])

After M1 is CLOSED and merged, Brent authorizes the deploy of BOTH functions. The
authorized operator records in LEDGER.md: (a) the exact command
(`supabase functions deploy generate-children-lesson refine-children-lesson` from
casa-web) and Supabase CLI version (≥ 2.110); (b) the deployed `main` SHA; (c)
`supabase functions list` version/updated evidence before and after, both functions;
(d) generate-side smoke via an authenticated `previewPromptOnly: true` invoke — WITH
`availableMaterials` the preview contains `Restricción de Materiales`, WITHOUT it the
preview matches the base prompt (zero model cost); (e) refine-side evidence = the
version bump in (c) (refine has no preview flag; a paid smoke only on Brent's word).
**No M2/M3a/M3b merge happens before this gate is recorded.**

Config note (corrected per [S6]): the project-root `supabase/config.toml` does not
list either children EF; the nested per-function `config.toml` files exist with
inconsistent table shapes and are not the authoritative project-root form. Effective
JWT verification is TRUE because it is the platform/CLI default and the deploy must
NOT pass `--no-verify-jwt`.

## Phase M2 — Canonical list + service threading + snapshot (`feat/mat-svc`, off post-M1 `main`)

**Scope (5 files):** new `src/lib/children-ministry/materialsList.ts`
(`buildEffectiveMaterialsList(names: string[]): string[]` implementing M-D5) +
`__tests__/materialsList.test.ts` (§Conformance vectors verbatim + FE idempotence
`canonical(canonical(x)) === canonical(x)`);
`src/lib/children-ministry/liturgyChildrenPublishService.ts`;
`src/types/childrenPublicationState.ts`;
new `__tests__/liturgyChildrenPublishService.materials.test.ts`.

Service changes: `PublishChildrenActivitiesParams` (:151-165) and `SingleGroupContext`
(:167-178) gain `availableMaterials?: string[]`; the service applies
`buildEffectiveMaterialsList` ONCE per publish call and uses the SAME canonical result
for the conditional spread into `generationRequest` (:210-222) AND the content
snapshot (:246-250) — never the raw param ([B1]). Refine (:563-699): widen
`parsedContent`, qualify the snapshot per M-D11 — including canonicalizing it ONCE
through `buildEffectiveMaterialsList` — and use the SAME canonical result for the EF
body (:623-629) and the rewritten `newContent` (:658-662), additive-key-safely per
M-D11 ([B2-R]).
Types file: add `availableMaterials?: string[]` AND the missing `requestId?: string`
(pre-existing drift, [B3]) so the copy matches the EF `prompt.ts` field-for-field.

**Out of scope:** any component; EF files; `parseMaterials`; hardcoded duration/counts.

**Acceptance criteria:**
1. [A1] FE D6 baselines re-recorded at branch base (post-M1 `main`, SHA in the
   executor prompt) before edits.
2. [A2] `materialsList.ts` passes ALL §Conformance vectors verbatim + FE idempotence.
3. [A3] Invoke body carries the CANONICAL list (not the raw param) when params carry a
   non-empty array — proven with a raw input whose canonical form differs (e.g. V4/V5
   material) (base-red).
4. [A4] Persisted content snapshot === the same canonical list === the invoke body
   ([B1] equality, asserted in one test on both captures) (base-red).
5. [A5] When params omit/empty the field, or canonicalization yields `[]`: invoke body
   has NO key AND content JSON has no key (mutation proof: force-include → red).
6. [A6] Refine sends the CANONICAL usable snapshot for every `refinementType`
   (base-red), asserting `refine body === rewritten snapshot` for a
   valid-but-noncanonical input (V4/V5-style) AND a >60 input (exactly 60 reach
   both); M-D11-unusable inputs — `"papel"`, `["papel", 7]`, `[]`, `["   "]` — are
   neither sent nor rewritten (key omitted from body, removed from content)
   ([S2]/[B2-R]).
7. [A7] Refine `newContent` preserves unknown sibling keys (sentinel-key round-trip,
   base-red — base drops it) AND re-serializes the canonical snapshot (base-red); a
   lesson without a usable snapshot writes content without the key while keeping
   sentinels (mutation proof).
8. [A8] FE `GenerateChildrenLessonRequest` matches EF `prompt.ts` field-for-field,
   including `requestId?: string` ([B3]).
9. [A9] Zero NEW tsc/eslint/vitest identities vs D6 baselines (Mesa-six unchanged).
10. [A10] Only the 5 listed files touched.

**Test plan:** named tests per [A2]–[A7]; service suite mocks ONLY
`@/integrations/supabase/client` (chain-stub per `Portadas.refine.test.tsx`), real
service + real `materialsList` under test.
Commands: `npx vitest run src/lib/children-ministry/__tests__/ --no-file-parallelism`, then the three FE gates.
**Definition of done:** criteria checked, gates delta-clean, mergeable **dormant**.
**Risks:** mock chain must support the service's exact call shapes.
**Rollback:** revert; optional unused param breaks no caller.

## Phase M3a — `MaterialsStepView` presentational component (`feat/mat-view`, off post-M2 `main`)

**Scope (2 files):** new `src/components/liturgia-builder/MaterialsStepView.tsx` —
**purely presentational, props-driven, no data fetching, no supabase imports** — +
new `__tests__/MaterialsStepView.test.tsx` (props/interaction only; NO supabase or
toast mocks needed — this is the [B4] topology fix).

Props contract (executor may refine names, not semantics): inventory items + checked
id set + extras list + per-extra saving flag + `isLoading` / `loadError` /
`capReached` / `effectiveCount` + callbacks `onToggleItem`, `onToggleAll(bool)`,
`onAddExtra(name)`, `onSaveExtra(name)`.

Renders: context line `Generarás para: {grupos}`; intro `Selecciona los materiales con
los que cuenta la iglesia. La actividad se diseñará usando solo estos materiales.`;
loading `Cargando materiales disponibles…`; error `No se pudieron cargar los
materiales del inventario. Puedes generar sin restricción de materiales.`; empty `El
inventario de materiales está vacío. Agrega materiales aquí o genera sin
restricción.`; category groups in M-D12 order — Manualidades / Libros / Suministros /
Equipamiento / Otros, name-ordered within — with checkboxes (+ `x{quantity}` badge
when > 0; names > 120 UTF-16 code units get the hint `(se usará abreviado)` per
M-D5/V2); bulk `Seleccionar todos` / `Quitar selección`;
counter `{effectiveCount}/60 materiales seleccionados`; **cap UX ([B1]): when
`capReached`, unchecked checkboxes and the one-off `Agregar` control are disabled with
the line `Límite de 60 materiales alcanzado. Quita alguno para agregar otros.`**;
one-off input (`Agregar material adicional…`, maxLength 120) + `Agregar`; extras
section `Adicionales (solo esta vez)` with per-item `Guardar en inventario`
(spinner while saving); zero-selection note `Sin materiales seleccionados: la
actividad se generará sin restricción de materiales.`

**Out of scope:** ChildrenActivityDialog; any service; footer buttons (Volver/Generar
live in the dialog's `DialogFooter` — M3b).

**Acceptance criteria:**
1. [A1] FE D6 baselines re-recorded at branch base before edits.
2. [A2] Component contains no supabase/service imports (grep-checkable) and performs
   no fetching — state in, callbacks out.
3. [A3] Groups render under the five Spanish headers with checked state from props.
4. [A4] Cap UX: `capReached` disables every unchecked checkbox + `Agregar` and shows
   the cap line; checked items remain toggleable.
5. [A5] Bulk toggles fire `onToggleAll` correctly; counter shows `{n}/60`.
6. [A6] Loading / error / empty states render their exact Spanish copy.
7. [A7] One-off flow: `Agregar` fires `onAddExtra` with the typed value; input
   enforces maxLength 120; extras render with working `Guardar en inventario` +
   saving-state disable.
8. [A8] Long-name hint `(se usará abreviado)` renders exactly for names > 120 UTF-16
   code units.
9. [A9] D7: every assertion has a recorded mutation proof (new component — base-red
   impossible; e.g. remove the cap-disable prop wiring → [A4] red).
10. [A10] All copy Spanish per this spec (D8); zero NEW gate identities vs baselines.
11. [A11] Only the 2 listed files; component exported but not yet imported anywhere
    (inert, mergeable).

**Test plan:** named tests per [A3]–[A8].
Commands: `npx vitest run src/components/liturgia-builder/__tests__/MaterialsStepView.test.tsx --no-file-parallelism`, then the three FE gates.
**Definition of done:** criteria checked, gates delta-clean, mergeable inert.
**Risks:** Radix Checkbox interactions in jsdom (follow Portadas fireEvent patterns).
**Rollback:** revert; nothing imports the component.

## Phase M3b — Dialog wiring (`feat/mat-wire`, off post-M3a `main`)

**Scope (2 files):** `src/components/liturgia-builder/ChildrenActivityDialog.tsx` +
new `__tests__/ChildrenActivityDialog.materials.test.tsx`.

Behaviour: ViewState union (:93) gains `'materials'`. Select-footer button becomes
**"Continuar"** — stages `pendingGroupIds` and navigates; no generation/invoke
occurs, and the inventory fetch begins on materials entry ([S1-R]). Regenerar (:331)
stages `[groupId]` and routes through the step (M-D7). Dialog owns: lazy inventory
fetch on first entry (existing `isActiveRef`/`liturgyIdRef` guard pattern) with
**M-D10 gating** (`Generar` disabled until the first fetch for the active context
settles; enabled on success incl. empty, or on error fallback); pre-check ALL on
success — or, when N > 60, the first 60 canonical-distinct names in M-D12 order +
visible notice `El inventario tiene {N} materiales; se preseleccionaron los primeros
60.` ([B1]/[S2-R]); quick-add
implementation per M-D6/[S4] (ci-match against inventory checks the existing row +
toast `Ese material ya está en el inventario; quedó seleccionado.`, ci-match against
an existing extra is a no-op; success toast `Material guardado en el inventario`,
failure toast `No se pudo guardar el material. Puedes usarlo solo esta vez.`);
computes the canonical effective list via `buildEffectiveMaterialsList` (checked names
+ extras in M-D12 order) and passes it as `availableMaterials` to
`publishChildrenActivities`; renders `MaterialsStepView`; footer `Volver` | `Generar`/
`Generando…`. **[S5] context reset:** on `liturgyId` change AND in `resetAll`, clear
`pendingGroupIds`, view state, selections, extras, inventory items/loading/error, and
generation eligibility; a stale fetch promise from a previous context can neither mark
the new context loaded/error nor enable `Generar`; the active context's own fetch
still settles normally.

**Out of scope:** ExportPanel; MaterialsStepView internals (frozen from M3a); services
(frozen from M2); EFs; inventory admin components.

**Acceptance criteria:**
1. [A1] FE D6 baselines re-recorded at branch base before edits.
2. [A2] Continuar navigates to the materials view with zero `functions.invoke` calls
   (base-red — base generates immediately); Regenerar routes through the step and then
   generates ONLY that group (base-red).
3. [A3] **[B2] deferred-promise test:** while the first inventory fetch is unresolved,
   `Generar` is disabled and no invoke can occur; resolution pre-checks the returned
   rows (or the first 60 canonical-distinct in M-D12 order + notice when > 60);
   rejection shows the error fallback and enables `Generar` (unconstrained).
4. [A4] **[B1] equality, end-to-end:** ONE test with the REAL M2 service + REAL
   `materialsList` (mocking ONLY `@/integrations/supabase/client` + `use-toast`)
   asserts UI effective list === invoke body `availableMaterials` === persisted
   content snapshot, using an input whose canonical form differs from its raw form.
5. [A5] Zero selection ⇒ no `availableMaterials` key sent (mutation proof) + the
   sin-restricción note visible (base-red).
6. [A6] Quick-add: insert payload exactly M-D6 defaults; a rejected insert keeps the
   item usable and never blocks Generar (D7 pair); repeated save attempts insert at
   most once; post-save generation includes the name exactly once ([S4]).
7. [A7] Quick-add ci-duplicate: typing a name matching an inventory row checks that
   row (no insert); matching an existing extra adds nothing.
8. [A8] **[S5] battery:** `liturgyId` change resets all new state and view; a stale
   fetch cannot mark the new context loaded/error or enable `Generar`; the new
   context's fetch settles normally; `resetAll` clears everything new.
9. [A9] Footer copy Spanish (`Continuar` / `Volver` / `Generar` / `Generando…`) (D8).
10. [A10] Tests other than [A4] MAY mock collaborator service modules
    (`liturgyChildrenPublishService`, `inventoryService`, `lessonService`,
    `calendarService`, `childrenPublicationStateService`) for UI-state scenarios —
    the [B4] topology rule; [A4] is the single full-stack proof.
11. [A11] Zero NEW gate identities vs D6 baselines; net diff ≤ ~600 lines, 2 files.

**Test plan:** named tests per [A2]–[A8] under the [A10] topology.
Commands: `npx vitest run src/components/liturgia-builder/__tests__/ChildrenActivityDialog.materials.test.tsx --no-file-parallelism`, then the three FE gates.
**Definition of done:** criteria checked, gates delta-clean, mergeable; feature goes
live on merge (M-REL1 already done per M-D8).
**Risks:** dialog is 905 lines pre-change; the M3a extraction keeps the added surface
mostly outside it. Deferred-promise control flow in tests (use manually-resolved
promises, established pattern).
**Rollback:** revert; M2/M3a stay merged but dormant.

## Verified code map (anchors at `main`@d79d329 unless noted)

PM-hand-verified 2026-07-31: `ChildrenActivityDialog.tsx` :93 ViewState · :219
resetAll · :244 runGenerationForGroups/params · :331 handleRegenerate (direct call) ·
publish service :151/:167/:210-222/:246-250 · refine :591-597/:623-629/:658-662
(3-key rebuild = drops unknown keys) · `generate-children-lesson/index.ts` :196-246
buildUserPrompt, :229-235 splice point, :264 lenient parse, :17-36 request iface
**including `requestId?: string`** · FE copy `childrenPublicationState.ts:71-88`
**lacks `requestId`** ([B3]) · `refine-children-lesson/index.ts` :60-69 RefineRequest,
:71-80 8 types, :154-157 insertion point, system rule 8 (empty materials allowed) ·
RBAC seed `20260209000000_casa_rbac_schema.sql` :313/:409-421 **plus the later
liturgist grant `20260216190000_casa_children_publication_state.sql:199-216`
(children_ministry read+write)** ([S1]) · `InventoryEditDialog.tsx` create defaults ·
`ChildrenInventoryInsert` non-partial (`childrenMinistry.ts:167`) · existing publish
orchestration suite `__tests__/liturgyChildrenPublishService.test.ts` mocks
`childrenPublicationStateService`/`lessonService`/`calendarService` + supabase client
([B4] boundary precedent) · root `supabase/config.toml` has no children-EF entries;
JWT verification is platform/CLI default ([S6]).
Explorer/designer-verified (Codex round-1 concurred on the load-bearing ones):
children RLS `20260215100000_…children_ministry_schema.sql` :188-200/:300-319/:484-494
· `inventoryService.ts` :15-23/:42-53 · `InventoryTable.tsx` :42-48 category labels ·
content-JSON readers additive-key-tolerant (dialog `parseLessonPhases` :66-74,
ExportPanel :455-471, `send-children-service-packet` :314, LessonDetailSheet raw
render, LessonEditDialog textarea) · `previewPromptOnly` :280-293 ·
`ensureFreshSession` :125-147.

## Decision log

| Date | Decision | Rationale | Raised by |
|---|---|---|---|
| 2026-07-31 | Initiative opened as a parallel plan file; product decisions locked (strict-only / pre-check all / manual save per item / constraint on all refinement types); M-D1–M-D9 drafted; Codex plan review requested | Separate goal from the frozen cuentacuentos plan; zero path overlap with its open phases | Brent / PM |
| 2026-07-31 | **Round-1 plan review FAIL (4B/6S) — all ten findings applied.** PM verified every load-bearing review claim with own hands before amending (`requestId` drift EF:17-36 vs FE:71-88; liturgist grant `20260216190000:199-216` — [S1] is an owned PM error, the RBAC sweep stopped at the seed migration; the existing orchestration suite's service-mock boundary; root config.toml empty of children entries). Applied: [B1] canonical effective-list contract (M-D5 rewrite, `materialsList.ts`, §Conformance vectors, cap UX — **the >60 pre-check-first-60 rule slightly narrows Brent's "pre-check all" and is flagged for his veto**); [B2] M-D10 generation gating; [B3] `requestId` into M2 scope + sequential post-merge bases (M-D8); [B4] M3 split into M3a (presentational view) + M3b (wiring) with the single-real-e2e topology, `MaterialsStepView` mandatory; [S1] M-D9/map/backlog corrected; [S2] M-D11 additive-key-safe writes + snapshot validity; [S3] empty-array goldens in M-D2/M1[A3]; [S4] quick-add terminal state + ci-duplicate rules in M-D6; [S5] context-reset battery in M3b; [S6] M-REL1 release gate + config wording. Round 2 requested. | `reviews/M-PLAN-review.md` | Codex Sol / PM |
| 2026-07-31 | **Round-2 plan review FAIL (2B/2S; 8/10 round-1 items ruled FIXED) — all four findings applied.** [B1-R]: M-D5 step 5 truncates then re-trims (true fixed point); unit frozen = UTF-16 code units; case-fold frozen = locale-less `toLowerCase()`; vectors V9 (truncation-onto-whitespace witness) / V10 (U+0000 mutation witness — V3's newline provably cannot catch a dropped control step) / V11 (accented case pair) added; both suites now assert `f(f(x)) === f(x)` for every vector input; M1[A6]/[A7] updated. [B2-R]: M-D11 usable-snapshot rule = string-array → canonicalized ONCE via the FE M-D5 implementation → non-empty; the SAME canonical result feeds the refine body AND the rewritten content (healing hand-edited/historical JSON); unusable or canonical-empty ⇒ key omitted from body and removed from content, siblings preserved; M2 spec + [A6]/[A7] extended (noncanonical, >60, `[]`, whitespace-only; `refine body === rewritten snapshot` assertions). [S1-R]: Continuar wording corrected — no generation/invoke; the inventory fetch legitimately starts on materials entry. [S2-R]: M-D12 deterministic ordering contract (fixed category order → inventory name order within → extras entry order; "first 60" = canonical-distinct names) bound across render, pre-check, bulk, and effective-list construction. Editorial repair: a literal U+0000 byte accidentally embedded during editing was replaced with the textual escape `\u0000` (file restored to valid UTF-8 text). Round 3 requested. | `reviews/M-PLAN-review-2.md` | Codex Sol / PM |
| 2026-07-31 | **PLAN FROZEN** per Codex round-3 PASS (`reviews/M-PLAN-review-3.md`: all four r2 amendments ruled FIXED, zero new findings; reviewer independently re-verified V1–V11 arithmetic, fixed-point coherence beyond the named examples incl. sliced-surrogate stability under the UTF-16 unit, M-D11 ↔ M-D2/M-D3 coherence, and M-D12 ↔ M3a props compatibility). Freeze subject only to Brent's two retained product vetoes (>60 visible pre-check rule; paid refine smoke at M-REL1) — open, non-blocking. **M1 executor round 1 OPENED**: prompt issued in-conversation for a fresh Opus session; report returns to PM only (gate 2); Sol's M1 phase review will be round 1/2 of the §1.5 cap. | §1.7 plan loop complete (FAIL → FAIL → PASS) | Codex Sol / PM / Brent |
| 2026-07-31 | **M1 CLOSED** at `feat/mat-ef`@7f3600f (Sol PASS round 1/2, `reviews/M1-review-1.md`; §3.8 gates satisfied: PM verification + reviewer PASS, no gate-5 trigger). Execution deviations RATIFIED as binding: (D1) M-D5 step 1 as an explicit UTF-16 code-unit scan — behaviorally identical to the frozen ranges, avoids a new `no-control-regex` identity, V10-proven; (D2) commit-tree/private-index authorship — provenance machinery, ancestry exact, forced by the mid-round interactive checkout; (D3) refine `prompt.ts` carries the transitive type closure (RefinementType/LessonPhase/CurrentLesson). Q6 ruled: the refine block's internal line wrap is NORMATIVE-AS-WRITTEN. One NIT logged to Backlog (cap-test input self-proof). **Baseline correction: `npx tsc -p tsconfig.app.json --noEmit` at d79d329 = 1033 diagnostics — supersedes the older 1041 pin (different lineage) for all M-suite prompts; delta-vs-base stays the binding form.** Operational hazard recorded for Brent: an interactive session checked out `fix/story-trunc`@91ae82e in the shared casa-web worktree mid-round (file-disjoint, no contamination; `jb list` cannot see interactive sessions) — worktree ownership during rounds needs a rule. Merge and M-REL1 remain Brent-authorized separate actions. | §3.8 close | Codex Sol / PM |
| 2026-07-31 | **M2 review r1 FAIL accepted** (1 BLOCKING, `reviews/M2-review-1.md` [B1]): the materials suite mocks `childrenPublicationStateService`/`lessonService`/`calendarService` in addition to the Supabase client, captures "persisted" content from mocked collaborator args, and its publish happy-path never completes (bare `createPublication` stub; no publish-success assertion) — so the frozen "real service stack, Supabase-only mock" proof does not exist. PM reproduced the mock list and happy-path gap at source and OWNS the gate-2 miss (verified invoke-capture reality but never audited the suite's `vi.mock` list against the frozen boundary — added to PM verification checklist: audit mock boundaries verbatim). Sol rulings recorded as BINDING: production behavior correct across A1–A10 substance; deviation (array-guarded M-D11 spread) ACCEPTED, no plan amendment needed; typed mock signatures ACCEPTED. Consolidated TEST-ONLY remediation opened on `feat/mat-svc` atop dcf7588 (expected surface: the materials suite file only). **Round 2/2 is FINAL — a second FAIL goes to Brent (gate 5).** | M2 review r1; gate 7 | Codex Sol / PM |
| 2026-08-02 | **M3b CLOSED — FINAL PHASE** at `feat/mat-wire`@f5cfc7d (Sol r2/2 FINAL PASS, `reviews/M3b-review-2.md`; §3.8 gates satisfied; no gate-5). [B1] owner-safe release ruled CLOSED on her own reproductions: the unconditional-finally mutation fells ONLY the new cross-context case (3 inserts observed), the state-guard mutation fells ONLY the same-tick witness (2 vs 1) — the two tests witness different halves of the guard (synchronous admission vs owner-safe async release); no symbol-lifecycle leak; spinner consistent across every transition. [A6] FULLY MET → **[A1]–[A11] complete for every phase of this plan**. Binding r1 dispositions carried forward unchanged ([A11] overage accepted; M3b/M4 survivors architecture-masked; cap-predicate repair verified). Her ruling: "Brent may merge `feat/mat-wire` and make the feature live." All build phases now DONE; M1 merged+deployed, M2/M3a merged, M3b merge pending Brent = release. | §3.8 close | Codex Sol / PM |
| 2026-08-02 | **M3a CLOSED** at `feat/mat-view`@b7b27e9 (Sol FINAL r2/2 PASS, `reviews/M3a-review-2.md`; §3.8 gates satisfied; no gate-5). [B1] unit-witness remediation ruled CLOSED on her own reproduction (code-point mutant fails ONLY the new supplementary-plane case; ASCII case green; production blob identical across both revisions); [A8]/[A9] FULLY MET, completing [A1]–[A11] with the binding r1 rulings (7 deviations stand ACCEPTED). Reviewer note adopted: she discarded an ambient Node 26.5.0 run and re-ran on pinned v22.22.0 — runtime pinning discipline reaffirmed. Merge of `feat/mat-view` (inert — nothing imports the component until M3b) is Brent's word; M3b branches from post-M3a `main` after it, carrying the binding notes: dialog's onToggleAll(true) owns M-D12 first-60 cap enforcement; parent guards repeat quick-add inserts and moves saved extras into the checked inventory group (M-D6). | §3.8 close | Codex Sol / PM |
| 2026-07-31 | **M2 CLOSED** at `feat/mat-svc`@60e9160 (Sol FINAL r2/2 PASS, `reviews/M2-review-2.md`; §3.8 gates satisfied: PM verification + reviewer PASS; no gate-5 trigger). All four [B1] remediation items ruled CLOSED with her own reproductions — incl. her adversarial mutation on the real `incrementPublishVersion` (+1 removed → exactly the new republish test red, 3-vs-4). Dispatcher fidelity, test honesty, and residue all clean; [A3]–[A7] now FULLY MET (behavior + real-boundary proof), joining the binding r1 rulings on [A1]/[A2]/[A8]–[A10]. The added republish test and `--silent` usage stand as accepted deviations. Merge of `feat/mat-svc` (dormant — nothing populates the param until M3b) remains Brent's word; M3a branches from post-M2 `main` after it. | §3.8 close | Codex Sol / PM |

## Backlog (observations — recorded, NOT in scope)

- **Children EFs have no in-function authz** (JWT verification is the platform/CLI
  default only; FASE 0-style `requireLiturgyWriter` absent) — pre-existing; candidate
  for a future hardening phase.
- **`send-children-service-packet` quirks** (pre-existing): expects array-form lesson
  `content` (object form silently skips phase HTML) and splits `materials_needed` on
  `', '` while writes are newline-serialized.
- **Role-grant asymmetry** (corrected per [S1]): liturgist HAS children_ministry
  read+write; pure `equipo_pastoral` has none (dialog unusable for them); children
  volunteer (read-only) can open the picker but generation/quick-add fail under RLS.
  Whether to align these is Brent's call, independent of this feature.
- Hardcoded `durationMax: 30` / children 2–15 in the publish service.
- **Extras removal affordance (M3a observation):** the frozen MaterialsStepView
  props have onAddExtra/onSaveExtra but no per-extra removal, so a mistyped
  one-off persists (checked-and-disabled) until the dialog resets on close or
  liturgy change (M3b [A8]). Future UX nicety; not an M3 defect.
- **NIT from M1 review (log-only, §1.4):** `_shared/availableMaterials_test.ts:136-142`
  "cap counts canonical entries" uses an input whose 60 distinct values precede all
  duplicates, so that one test cannot by itself distinguish cap-after-dedupe from a
  raw-first-60 cap. If the suite is ever touched, move a duplicate ahead of the final
  distinct value (Sol's probe shape: `['m01','M01','m02',…,'m60']`).
