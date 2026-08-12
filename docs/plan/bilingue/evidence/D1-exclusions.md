# D1-exclusions — every path this method excluded, and why

Phase **D1b-1**, criterion [D1b.13]. `CENSUS-METHOD.md` §"Exclusion safety is established by
enumeration, not by pattern" says a reviewer confirms nothing real was dropped **by reading this
list**, not by trusting a regex. That is what this document is for.

Two independent exclusion mechanisms operate in this phase and are kept apart on purpose:

| | Mechanism | Excludes from | Sections |
|---|---|---|---|
| A | `census.sh`'s file selector — four stage-one name predicates plus one stage-two referrer predicate | the **corpus census** | §1, §2 |
| B | `SURFACE-SCHEMA.md` §"Exact liturgy-path inclusion rule" | the **surface inventory** | §3, §4 |

They are not the same set and neither implies the other. A file can be counted by the census and yield
no record, or be excluded from the census and still hold a recorded surface.

RUN METADATA — SOURCE_SHA `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`, macOS 15.3.1 /
`Darwin 24.3.0 arm64`, `LC_ALL=en_US.UTF-8` exported once, absolute binary paths throughout (D-K).

---

## Arithmetic, derived

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')

/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  | /usr/bin/sort -u > /tmp/all-candidates.txt

/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' \
  -not -regex '.* [0-9]\.(ts|tsx)' | /usr/bin/sort -u > /tmp/after-stage1.txt

/usr/bin/wc -l < /tmp/all-candidates.txt    # -> 250
/usr/bin/wc -l < /tmp/after-stage1.txt      # -> 174
/usr/bin/comm -23 /tmp/all-candidates.txt /tmp/after-stage1.txt | /usr/bin/wc -l   # -> 76
```

| Step | Files |
|---|---:|
| Candidates over the Pass B roots, before any predicate | 250 |
| After stage one | 174 |
| After stage two | 173 — matches `PASS_B_SUMMARY files=173` |
| **Stage-one excluded** | **76** |
| **Stage-two excluded** | **1** |
| **Total excluded (§1 + §2)** | **77** |
| Ambiguity-branch **keeps** (§2b) | 1 |

Pass A's 168 files are the same selector over the Pass A roots, i.e. without `src/lib/whatsapp`; the
five-file difference is that directory.

---

## §1 — Stage one: the four frozen name predicates

Applied in the order `CENSUS-METHOD.md` fixes. Attribution below assigns each excluded path to the
**first** predicate that matches it.

```bash
while IFS= read -r p; do
  b=${p##*/}
  if   [[ "$p" == *__tests__* ]]; then echo "P1 $p"
  elif [[ "$b" == *.test.*    ]]; then echo "P2 $p"
  elif [[ "$b" == *_test.*    ]]; then echo "P3 $p"
  else                                 echo "P4 $p"
  fi
done < <(/usr/bin/comm -23 /tmp/all-candidates.txt /tmp/after-stage1.txt) \
  | /usr/bin/cut -d' ' -f1 | /usr/bin/sort | /usr/bin/uniq -c
#   56 P1
#   12 P3
#    8 P4
```

| Predicate | Rule | Excluded |
|---|---|---:|
| P1 | `-not -path '*__tests__*'` | 56 |
| P2 | `-not -name '*.test.*'` | **0** |
| P3 | `-not -name '*_test.*'` | 12 |
| P4 | `-not -regex '.* [0-9]\.(ts|tsx)'` | 8 |

**P2 excludes nothing on its own.** Every `*.test.tsx` inside the roots already lives in a
`__tests__/` directory, so P1 claims it first. P2 is not redundant — it would fire on a
`*.test.ts` placed outside `__tests__/` — but at this commit its independent contribution is zero, and
saying so is more useful than implying four active predicates.

**Direction of error, restated from `CENSUS-METHOD.md`: over-exclusion.** All four read the path and
ask nothing about the content. Concretely, at this commit **eight of the 56 P1 exclusions carry no test
convention in their own basename** and are dropped purely for living in a `__tests__/` directory:

```bash
/usr/bin/comm -23 /tmp/all-candidates.txt /tmp/after-stage1.txt \
  | /usr/bin/grep '__tests__' | /usr/bin/grep -vE '\.test\.|_test\.'
```

```text
src/lib/cuentacuentos/__tests__/pbBaseCapture.divergences.ts
src/lib/cuentacuentos/__tests__/pbBaseCapture.harness.ts
src/lib/cuentacuentos/__tests__/pbBoundary.ts
src/lib/cuentacuentos/__tests__/pbImageFixtures.ts
src/lib/cuentacuentos/__tests__/pbStorageErrors.ts
src/lib/cuentacuentos/__tests__/pb_fe_base_185c370.json
src/lib/cuentacuentos/__tests__/pcuiWarningFixtures.ts
src/lib/cuentacuentos/__tests__/phFixtures.ts
```

These are harnesses and fixtures by name and by location. **That is a description of what they look
like, not a claim that they are not production modules** — `CENSUS-METHOD.md` retracted exactly that
kind of claim in D1a round 3, and this document does not reintroduce it. The reviewer has the list.

The eight P4 exclusions are the case that predicate cannot decide: a basename ending in a space and a
digit is read as a copied artifact, and the predicate reads the shape, not the provenance. Two of them
(`UniversalSlide 2.tsx`, `UniversalSlide 3.tsx`) are near-duplicates of a file that **does** hold a
recorded surface — see `D1-surfaces-output.md` §4a, record R-24 on `UniversalSlide.tsx:486`. If either
copy is live rather than dead, its copy of that surface is uncounted. Nothing in this method decides
which.

### P1 list (56)

```text
src/components/liturgia-builder/__tests__/ChildrenActivityDialog.materials.test.tsx
src/components/liturgia-builder/__tests__/MaterialsStepView.test.tsx
src/components/liturgia-builder/__tests__/Portadas.refine.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.a4.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.a6.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.b1.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.e.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4fix.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.f4fix3.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pb.g5.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pb.wiring.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pcui.d13.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pcui.warnings.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pfe2.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pfe3.integration.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.pg.cancel.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.cancel.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.concurrency.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.persist.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.ph.surfaces.test.tsx
src/components/liturgia-builder/editors/__tests__/CuentacuentoEditor.smoke.test.tsx
src/hooks/presentation/__tests__/usePresentationState.test.ts
src/lib/children-ministry/__tests__/childrenLessonPdfExporter.test.ts
src/lib/children-ministry/__tests__/lessonOutputValidation.test.ts
src/lib/children-ministry/__tests__/liturgyChildrenPublishService.materials.test.ts
src/lib/children-ministry/__tests__/liturgyChildrenPublishService.test.ts
src/lib/children-ministry/__tests__/materialsList.test.ts
src/lib/children-ministry/__tests__/parseMaterials.test.ts
src/lib/cuentacuentos/__tests__/approvalGate.a3.test.ts
src/lib/cuentacuentos/__tests__/concurrency.test.ts
src/lib/cuentacuentos/__tests__/concurrencyPG.cancel.test.ts
src/lib/cuentacuentos/__tests__/downscaleImage.test.ts
src/lib/cuentacuentos/__tests__/imageFeedback.test.ts
src/lib/cuentacuentos/__tests__/immutableImageUpload.test.ts
src/lib/cuentacuentos/__tests__/pbBaseCapture.divergences.ts
src/lib/cuentacuentos/__tests__/pbBaseCapture.harness.ts
src/lib/cuentacuentos/__tests__/pbBaseCapture.test.tsx
src/lib/cuentacuentos/__tests__/pbBoundary.ts
src/lib/cuentacuentos/__tests__/pbCriteria.test.tsx
src/lib/cuentacuentos/__tests__/pbImageFixtures.ts
src/lib/cuentacuentos/__tests__/pbNoDelete.test.tsx
src/lib/cuentacuentos/__tests__/pbStorageErrors.ts
src/lib/cuentacuentos/__tests__/pb_fe_base_185c370.json
src/lib/cuentacuentos/__tests__/pcuiWarningFixtures.ts
src/lib/cuentacuentos/__tests__/phFixtures.ts
src/lib/cuentacuentos/__tests__/pipelineTaskAdapter.test.ts
src/lib/cuentacuentos/__tests__/recoverySnapshot.a3.test.ts
src/lib/cuentacuentos/__tests__/taskFactories.test.ts
src/lib/cuentacuentos/__tests__/taskFactoriesPG.signal.test.ts
src/lib/cuentacuentos/__tests__/taskFactoriesPH.append.test.ts
src/lib/liturgia/__tests__/liturgyService.test.ts
src/lib/presentation/__tests__/presentationService.test.ts
src/lib/whatsapp/__tests__/payload.test.ts
src/lib/whatsapp/__tests__/phone.test.ts
src/lib/whatsapp/__tests__/summary.test.ts
```

### P3 list (12)

```text
supabase/functions/generate-children-lesson/prompt_test.ts
supabase/functions/generate-oraciones/handler_test.ts
supabase/functions/generate-story/corpus_parity_test.ts
supabase/functions/generate-story/handler_contract_test.ts
supabase/functions/generate-story/handler_imageFetch_test.ts
supabase/functions/generate-story/handler_pb_storage_test.ts
supabase/functions/generate-story/handler_research_test.ts
supabase/functions/generate-story/handler_test.ts
supabase/functions/process-reflexion-pdf/handler_test.ts
supabase/functions/refine-children-lesson/prompt_test.ts
supabase/functions/refine-story/handler_contract_test.ts
supabase/functions/refine-story/handler_test.ts
```

### P4 list (8)

```text
src/components/liturgia-builder/UniversalSlide 2.tsx
src/components/liturgia-builder/UniversalSlide 3.tsx
src/components/presentation/PresenterView 2.tsx
src/components/presentation/PresenterView 3.tsx
src/components/presentation/PresenterView 4.tsx
src/components/presentation/SlidePreview 2.tsx
src/lib/presentation/types 2.ts
src/lib/presentation/types 3.ts
```

---

## §2 — Stage two: the `.json` referrer predicate

Applied to `.json` paths that survived stage one. Re-derived standalone with the procedure from
`CENSUS-METHOD.md`, over the census's own roots:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -name '*.json' \
  -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' | /usr/bin/sort -u \
| while IFS= read -r f; do
    refs=$(/usr/bin/grep -rlF --include='*.ts' --include='*.tsx' -- "${f##*/}" src supabase \
      | /usr/bin/sort -u || true)
    coll=$(/usr/bin/find src supabase -type f \
      | /usr/bin/awk -F/ -v want="${f##*/}" '$NF == want' | /usr/bin/wc -l | /usr/bin/awk '{print $1}')
    if [ "$coll" -gt 1 ]; then printf 'AMBIGUOUS_KEEP (basename-collision, %s): %s\n' "$coll" "$f"; continue; fi
    [ -n "$refs" ] || { printf 'AMBIGUOUS_KEEP (no-literal-referrer): %s\n' "$f"; continue; }
    if printf '%s\n' "$refs" | /usr/bin/grep -qvE '(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$'; then
      printf 'RESOLVED KEEP (non-test referrer): %s\n' "$f"
    else
      printf 'STAGE-TWO EXCLUDED (all referrers are tests): %s\n' "$f"
      printf '   referrers: %s\n' "$(printf '%s' "$refs" | /usr/bin/tr '\n' ' ')"
    fi
  done
```

Literal output:

```text
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/accion-de-gracias.json
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/bendicion-final.json
AMBIGUOUS_KEEP (basename-collision, 2): src/data/elementos-fijos/index.json
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/la-paz.json
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/ofrenda.json
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/padre-nuestro.json
RESOLVED KEEP (non-test referrer): src/data/elementos-fijos/santa-cena.json
STAGE-TWO EXCLUDED (all referrers are tests): supabase/functions/generate-story/corpus_pd_base.json
   referrers: supabase/functions/generate-story/corpus_parity_test.ts
```

### §2a — The one stage-two exclusion

| Path | Rule | Evidence |
|---|---|---|
| `supabase/functions/generate-story/corpus_pd_base.json` | Stage two branch 3 — every literal referrer is a test file | Exactly one referrer, `supabase/functions/generate-story/corpus_parity_test.ts`, which matches the test ERE `(^|/)__tests__/\|\.test\.[^/]+$\|_test\.[^/]+$`. No basename collision. It is a captured baseline of the prompt corpus, re-captured by the documented command recorded at `corpus_parity_test.ts:15`. |

**Direction of error, from `CENSUS-METHOD.md`: over-includes under ambiguity, and can over-exclude when
the basename evidence is complete but wrong.** The named case where the direction does not hold: a
`.json` production reaches by a runtime-assembled path or a glob — so no `.ts`/`.tsx` writes its
basename — while an unrelated test names that basename literally. Every referrer the rule can see is
then a test, and the production file is dropped. Nothing in the rule detects that, and this document
does not claim the case is absent here.

### §2b — The ambiguity keep, enumerated ([D1b.13], D1a.10)

An over-inclusion is as much a finding as an exclusion, so the keeps are listed too. `census.sh` writes
each one **to stderr only**, which is why `2>/dev/null` is a BLOCKING finding in this phase
([D1b1.2], [D1b.14]). The captured stream, verbatim and complete, is `D1-census-stderr.txt`:

```text
AMBIGUOUS_KEEP	src/data/elementos-fijos/index.json	reason=basename-collision
```

| Path | Branch | Reason | What the reason means here |
|---|---|---|---|
| `src/data/elementos-fijos/index.json` | 1 | `basename-collision` | Two files under `src/`/`supabase/` are named `index.json`, so a literal referrer cannot be attributed to this one. The file is **kept** — counted in both passes — and the record says the evidence was absent, not that the file was proven to be production. |

One keep, one reason value. Branch 2 (`no-literal-referrer`) fired zero times at this commit; that is
an observation about these roots at this SHA, not a property of the branch.

---

## §3 — Inclusion-boundary exclusions inside the 62

Mechanism B. These files **are** in the candidate floor and **do** emit text; they are excluded from
the surface inventory because `SURFACE-SCHEMA.md` §"Exact liturgy-path inclusion rule" clause 1 finds
no chain from the builder-anchored workflow. Twenty-six of the 62, in five groups.

The rule is explicit that this direction is deliberate: *"If no such chain is found, the rule requires
exclusion; resemblance, shared data, and a path-name match cannot substitute for evidence."* Each
group therefore records the chain **before** the verdict, and the two named boundary probes get the
fullest treatment ([D1b1.5]).

### Group 1 — the 15 `children-ministry` admin components — **named probe**

`SURFACE-SCHEMA.md`: *"a `src/components/children-ministry` admin emission is not included merely
because the admin module shares child lessons, calendars, inventory, volunteers, or assignments with
the builder. It is included only if that exact text flows into the builder UI or a child packet…
Text visible only on the independent `/admin/ninos` route remains outside the boundary."*

Chain, recorded before the decision:

```bash
/usr/bin/grep -rn "components/children-ministry" src --include='*.tsx' --include='*.ts' \
  | /usr/bin/grep -vE '^src/components/children-ministry/'
```

```text
src/pages/ChildrenMinistryPage.tsx:13:import LessonManager from '@/components/children-ministry/LessonManager';
src/pages/ChildrenMinistryPage.tsx:14:import ChildrenCalendar from '@/components/children-ministry/ChildrenCalendar';
src/pages/ChildrenMinistryPage.tsx:15:import VolunteerManager from '@/components/children-ministry/VolunteerManager';
src/pages/ChildrenMinistryPage.tsx:16:import ChildrenDashboard from '@/components/children-ministry/ChildrenDashboard';
src/pages/ChildrenMinistryPage.tsx:17:import InventoryManager from '@/components/children-ministry/InventoryManager';
src/pages/ChildrenMinistryPage.tsx:18:import AttendanceReports from '@/components/children-ministry/AttendanceReports';
```

One importer outside the directory, and it is routed as the independent admin route:

```bash
/usr/bin/grep -n "ChildrenMinistryPage" src/appRoutes.tsx
# 32:import ChildrenMinistryPage from "./pages/ChildrenMinistryPage";
# 70:  { path: "/admin/ninos", element: <ProtectedRoute requires={{ resource: 'children_ministry', action: 'read' }}><ChildrenMinistryPage /></ProtectedRoute> },
```

The second half of the probe is the packet. The builder's children path is
`src/components/liturgia-builder/ChildrenActivityDialog.tsx`, and it imports **services**, not these
components:

```bash
/usr/bin/grep -nE "children-ministry" src/components/liturgia-builder/ChildrenActivityDialog.tsx
# 50:import { getAgeGroups } from '@/lib/children-ministry/ageGroupService';
# 54:} from '@/lib/children-ministry/inventoryService';
# 58:} from '@/lib/children-ministry/materialsList';
# 63:} from '@/lib/children-ministry/liturgyChildrenPublishService';
```

And the packet email composes its text from database rows, not from any component literal:
`send-children-service-packet/index.ts:338-362` reads `lesson.title`, `calendar.date`,
`start_time`/`end_time`, `church_children_age_groups.name` and `materials_needed`, and wraps them in
its own literals (recorded in `D1-surfaces-output.md` §3).

**Verdict: excluded.** All 15 emit only through `/admin/ninos`. Their emissions are `toast(` in every
case, so even if the boundary were overturned they would become **D1b-2's**, not this phase's — the
`children-ministry` block is the largest in the 62 and yields no `D1b-1` record either way.

*Direction of error: this is an import-graph argument. A component reached by a lazily imported or
dynamically composed route would not appear in the grep above.*

### Group 2 — the 7 `graphics` modules

```bash
/usr/bin/grep -rn "components/graphics" src --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '^src/components/graphics/'
# src/hooks/useCoordinateMapper.ts:2      — from graphicsTypes: value FORMAT_DIMENSIONS, type FormatType
# src/hooks/useResizeElement.ts:2         — from graphicsTypes: type ResizeHandle
# src/lib/covers/coverPromptBuilder.ts:8  — a comment naming a companion module
# src/pages/GraphicsGeneratorPage.tsx:3,4 — GraphicsGeneratorV2, SavedBatches
/usr/bin/grep -n "GraphicsGeneratorPage" src/appRoutes.tsx
# 10:import GraphicsGeneratorPage from "./pages/GraphicsGeneratorPage";
# 46:  { path: "/admin/graphics", element: <GraphicsGeneratorPage /> },
```

Read precisely: **only one referrer names any of the seven excluded files**, and it is the standalone
page. The two hooks import from `@/components/graphics/graphicsTypes` — a dimension constant and two
types — and `graphicsTypes.ts` is neither in the 62 nor an emitter; a dimension constant is not a
text-flow chain under clause 2. `coverPromptBuilder.ts:8` is a comment.

**Verdict: excluded** — `DragCanvasEditor`, `GraphicsGenerator`, `GraphicsGeneratorV2`, `SavedBatches`,
`ThemeManager`, `canvasCompositor`, `templateCompositor`.

**This is the most consequential exclusion in the phase and should be read as a scoping fact, not as a
finding that no copy exists there.** `templateCompositor.ts` alone bakes text into pixels at 21
`fillText` sites and downloads the result (`downloadAllGraphics`, 2131); `canvasCompositor.ts` adds 7
more. That is a substantial `file download` surface with the same unrecoverable-after-render property
as `slideRenderer` — it simply belongs to the announcement-graphics workflow, which this plan's
inclusion rule does not cover. If BILINGUE later widens beyond the liturgy path, `/admin/graphics` is
the first place to look.

### Group 3 — the standalone `oraciones` component graph — **the closest call**

**Rewritten at round 1 remediation.** Codex [B4] found that round 1's reason rested on a false
persistence distinction, and it was right: the standalone generator and the builder **do** share
`liturgias` and `liturgia_lecturas`. Round 1's phrase "the legacy `liturgias` table rather than the
builder's liturgy" is retracted. The verdict survives, but on a different and narrower fact, traced
below. This group also grew from 2 files to 4 — see "a triage inconsistency" at the end.

#### The component graph is closed

```bash
/usr/bin/grep -rn "OracionesAntifonalesGenerator" src --include='*.tsx' --include='*.ts' \
  | /usr/bin/grep -v '^src/components/liturgia/OracionesAntifonalesGenerator.tsx'
# src/components/liturgia/index.ts:5      — barrel re-export
# src/pages/OracionesAntifonalesPage.tsx:5,27
/usr/bin/grep -n "OracionesAntifonales" src/appRoutes.tsx
# 57:  { path: "/admin/liturgia/oraciones", element: <ProtectedRoute requires={{ resource: 'oraciones', action: 'write' }}><OracionesAntifonalesPage /></ProtectedRoute> },
/usr/bin/grep -rn "SlideGenerator\|LiturgiaForm\|SavedLiturgias\|BiblePassageFetcher" src \
  --include='*.ts' --include='*.tsx' | /usr/bin/grep -vE '^src/components/liturgia/(SlideGenerator|LiturgiaForm|SavedLiturgias|BiblePassageFetcher)\.tsx'
# SlideGenerator        <- OracionesAntifonalesGenerator.tsx:31,495   + index.ts:11 (barrel)
# LiturgiaForm          <- OracionesAntifonalesGenerator.tsx:29,390   + index.ts:6  (barrel)
# SavedLiturgias        <- OracionesAntifonalesGenerator.tsx:32,394
# BiblePassageFetcher   <- LiturgiaForm.tsx:17,222                    + index.ts:7  (barrel)
```

Every referrer is inside the graph or the barrel. The single entry point is
`/admin/liturgia/oraciones`. Nothing in `liturgia-builder/`, `PresenterPage` or `OutputPage` imports
any of them.

#### The tables are shared — the part round 1 got wrong

```bash
for t in liturgias liturgia_lecturas liturgia_oraciones liturgia_elementos; do
  printf '\n--- %s ---\n' "$t"
  /usr/bin/grep -rn "from('$t')" src supabase --include='*.ts' --include='*.tsx' \
    | /usr/bin/grep -vE '_test\.|\.test\.'
done
```

| Table | Standalone graph | Builder / export path |
|---|---|---|
| `liturgias` | writes — `OracionesAntifonalesGenerator.tsx:240`; reads — `SavedLiturgias.tsx:63,95` | `liturgyService.ts:556` (save), `:814` (**`loadLiturgy`**), `:922`, `:953` (`listLiturgies`), `:981`; also `presentationService.ts:190,218` |
| `liturgia_lecturas` | writes — `OracionesAntifonalesGenerator.tsx:265` | `liturgyService.ts:590,604` (save), **`:828` (`loadLiturgy`)** |
| `liturgia_oraciones` | writes — `OracionesAntifonalesGenerator.tsx:281`; reads — `SavedLiturgias.tsx:66,140` | **nothing** |
| `liturgia_elementos` | **nothing** | `liturgyService.ts:762,780`, **`:835` (`loadLiturgy`)**, `presentationService.ts:232`, `saveToLiturgyService.ts:380` |

So round 1's claim is refuted twice over: a row this generator writes to `liturgias` **is** listed by
the builder's `listLiturgies` and **is** loadable by `loadLiturgy`, and the readings it writes to
`liturgia_lecturas` are read by `loadLiturgy:828` and end up in the celebrant PDF's
`database content` record. Those are real chains and they are now named in that record's reason.

#### The fact the verdict actually rests on

`loadLiturgy` queries exactly three tables:

```bash
/usr/bin/sed -n '810,914p' src/lib/liturgia/liturgyService.ts | /usr/bin/grep -nE "\.from\("
#  5:      .from('liturgias')
# 19:      .from('liturgia_lecturas')
# 26:      .from('liturgia_elementos')
```

**The prayer text is not in any of them.** The generator writes its prayers to `liturgia_oraciones`
(`OracionesAntifonalesGenerator.tsx:281`), and the only reader of that table anywhere in `src/` or
`supabase/` is `SavedLiturgias.tsx:66,140` — which loops the prayers back into the same standalone
page via `onLoad`, reconstructing them with its own Spanish `titulo` literals at 145-155. The builder's
element store is `liturgia_elementos`, which the generator never writes.

So the *prayer text* — the copy `SlideGenerator` paints into canvases and downloads — has **no path
into the builder or any export**, while the *title, summary and readings* around it do. That is the
distinction that decides the group, and it is narrower than round 1 claimed.

**Verdict: excluded, and still the decision most likely to be overturned.** The cost is concrete:
`SlideGenerator.tsx` downloads PNGs named `oracion_<tipo>_<NN>_<kind>.png` (351-395) and PDFs named
`oracion_<tipo>.pdf` and `oraciones_antifonales_completas.pdf` (417, 442), and paints prayer text into
canvases with 4 `fillText` calls. Overturning this adds `PDF` and `file download` records for
`SlideGenerator.tsx` to **this** phase. The four files move together.

*Direction of error: `liturgia_oraciones` having exactly one writer and one reader is a fact about this
commit, not a property. A future builder read of that table would silently pull the prayer text into
the export path, and nothing here would flag it.*

#### A triage inconsistency this trace exposed — executor-found, not in the Codex verdict

Working [B4] surfaced a defect the reviewer did not raise. Round 1's triage labelled
`BiblePassageFetcher.tsx` (#30) and `SavedLiturgias.tsx` (#32) as `D1b-2` while giving their reason as
"reached from `LiturgiaForm.tsx` and `OracionesAntifonalesGenerator.tsx`" — the very chain that puts
them **outside** the boundary. The stated reason contradicted the assigned label. Both are now
`no surface`, on the Group 3 chain, and the tallies in `D1-sink-triage.md` are re-derived:
`D1b-2` 17 → 15, `no surface` 29 → 31, boundary exclusions 26 → 28.

### Group 4 — `src/components/sermon-editor/admin/MusicTrackManager.tsx`

Sermon-editor administration. Its only floor token is a `sonner` import, and no importer chain reaches
it from `ConstructorLiturgiasPage`, `PresenterPage` or `OutputPage`. **Verdict: excluded**; even
overturned it would be a `toast/UI` record, i.e. D1b-2's.

### Group 5 — `supabase/functions/whatsapp-signup/index.ts` — **named probe**

`SURFACE-SCHEMA.md`: *"A `whatsapp-signup` emission is not included merely because the captured phone
may later receive a liturgy-related notification. It is included only if that exact emitted text
participates in the keyed reminder/status/reply chain in clause 1. Onboarding, consent, and generic
marketing remain outside the boundary."*

Chain, recorded before the decision:

```bash
/usr/bin/grep -rn "whatsapp-signup" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -v 'supabase/functions/whatsapp-signup/'
# src/components/sections/InstagramFeed.tsx:76:      const { data, error } = await supabase.functions.invoke("whatsapp-signup", {
```

One caller: a public marketing section. What the function emits is a **single email to an
administrator** (`index.ts:54-64`) whose subject and body ask that a named contact be added to the
CASA WhatsApp broadcast list. It sends nothing over WhatsApp, writes no assignment row, and its text
appears in no reminder, status or reply. The keyed chain — `buildPayload` → template quick-reply →
`wa-webhook` `parsePayload` → assignment update — does not touch it.

**Verdict: excluded**, on the emitted text, not on the path name.

Two notes recorded because they are findings even though the file is out of scope. Its destination
address is a **hardcoded personal Gmail address** at `index.ts:49`; the value is not reproduced here
(D-D), and `supabase/functions/prayer-request/index.ts:49` shares the pattern. And this is the one
file in the 62 whose Spanish is fully accented, so the census sees it clearly while the boundary
excludes it — the two mechanisms disagreeing is exactly why they are documented separately.

---

## §4 — Inclusion-boundary exclusions outside the 62

Mechanism B applied to the reverse audit's eight extra terminal-call files
(`D1-surfaces-output.md` §1a). None is in the candidate floor, because the floor's path filter does not
match them; each was still checked against the inclusion rule rather than dismissed by that filter.

| Path | Terminal it reaches | Rule that excludes it |
|---|---|---|
| `src/components/financial/PayrollSlipPDF.ts` | jsPDF | Clause 1 — payroll, no liturgy workflow. |
| `src/lib/financial/reportPdfGenerator.ts` | jsPDF | Clause 1 — financial reporting. |
| `src/components/sermon-editor/DistributionPanel.tsx` | `a.download = 'sermon_<title>_spotify.zip'` (188) | Clause 1 — reached from `SermonEditorContainer.tsx:487`; sermon audio distribution is not a builder-anchored liturgy export. |
| `src/lib/sermon-editor/mp3Encoder.ts` | audio encode | Clause 2 — emits no user-visible text at all. |
| `src/pages/AdminSignups.tsx` | `a.download = 'inscripciones-<formType>-<date>.csv'` (91) | Clause 1 — event-signup administration. **Emits Spanish through this phase's `file download` channel**; excluded on workflow, not on absence of copy. |
| `supabase/functions/prayer-request/index.ts` | Resend | Clause 1 — a public prayer-request form, not a prayer produced from liturgy-workflow data. Subject at line 58 begins `Nueva petición de oración`. Same hardcoded personal recipient shape as Group 5. |
| `supabase/functions/send-mesa-notifications/index.ts` | `sendEmail` (351) | Clause 1 — Mesa Abierta ministry. |
| `supabase/functions/send-signup-confirmation/index.ts` | `sendEmail` (104) | Clause 1 — event signup confirmations. |

---

## §5 — What this enumeration does not establish

Under D-N and D-O, stated rather than implied:

1. **It does not establish that every excluded file is a test, dead, or copy-free.** §1 lists what the
   four predicates removed; it makes no claim about any file's nature. `CENSUS-METHOD.md` deleted the
   pattern that tried to make that claim, and it is not reintroduced here.
2. **It does not establish that no real copy surface was dropped.** It establishes that the dropped
   paths are *enumerated and readable*, which is the substitute the method chose for a guarantee it
   cannot give.
3. **The two mechanisms have opposite error directions and both are visible above.** Stage one and
   stage two over-exclude on evidence they cannot see; the inclusion rule over-excludes by design when
   no chain is found. Nothing here fails toward over-inclusion except `census.sh`'s ambiguity branch,
   which kept one file.
4. **Every §3/§4 verdict rests on a static import graph.** A lazily imported route, a dynamically
   composed component, or a specifier assembled at runtime produces no line in any grep above and would
   silently keep a file out. *Direction: under-report.*
5. **Nothing here speaks to any commit other than SOURCE_SHA.**
