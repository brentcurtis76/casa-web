# D1-sink-triage — all 62 candidate-floor files

Phase **D1b-1**, criterion [D1b1.4] / [D1b.3]. **This document is D1b-2's starting input:** every file
labelled `D1b-2` below is work D1b-2 owns, and no other list of that work exists.

## How the 62 were produced, and that they reproduced

The literal block from `SURFACE-SCHEMA.md` §"Candidate-floor procedure", run from the repository root:

```bash
export LC_ALL=en_US.UTF-8
SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
/usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | /usr/bin/sort
```

62 paths. Repo-wide, before the liturgy-path filter, the same pipeline yields **154**. Both figures
match [D1b1.3]'s reference exactly, so no discrepancy needed reporting.

## Labels used

| Label | Meaning |
|---|---|
| `D1b-1` | Yields at least one record whose `sink/channel` is `PDF`, `email`, `WhatsApp`, `file download` or `print`. Recorded in `D1-surfaces-output.md`. |
| `D1b-2` | Yields records only on `slide render` or `toast/UI`. **D1b-2 writes them; this phase does not.** |
| `no surface` | Yields no record on any channel. Two distinct reasons occur and are always spelled out: the matched token is a **regex false positive** (the file has no emission at all), or the file emits but sits **outside the D1 inclusion boundary**. |

A file may be labelled `D1b-1` *and* still owe D1b-2 a toast record; the partition in `PLAN.md` is by
**record**, not by file. Where that happens the reason column says so.

**Twenty-eight files carry the `outside the inclusion boundary` reason, in five groups. They are what a
reviewer should read first**, because excluding a file that genuinely emits Spanish is the expensive
mistake here. Every group is re-derived with its full evidence chain in `D1-exclusions.md` §3.

---

## The 62

| # | Path | Label | Reason |
|---:|---|---|---|
| 1 | `src/components/children-ministry/AssignVolunteerDialog.tsx` | `no surface` | Boundary probe 2. Reached only from `src/pages/ChildrenMinistryPage.tsx`, routed at `appRoutes.tsx:70` as `/admin/ninos`. No import path from `ConstructorLiturgiasPage`/`PresenterPage`/`OutputPage`, and the children's packet email composes its text from `church_children_*` rows rather than from these components. 4 `toast(` emissions, all on `/admin/ninos` only. |
| 2 | `src/components/children-ministry/AttendanceDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 4 `toast(`. |
| 3 | `src/components/children-ministry/AvailabilityEditor.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 4 | `src/components/children-ministry/ChildrenCalendar.tsx` | `no surface` | Boundary probe 2, same chain as #1. 1 `toast(`. |
| 5 | `src/components/children-ministry/InventoryEditDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 5 `toast(`. |
| 6 | `src/components/children-ministry/InventoryManager.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 7 | `src/components/children-ministry/LessonDetailSheet.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 8 | `src/components/children-ministry/LessonEditDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 5 `toast(`. |
| 9 | `src/components/children-ministry/LessonManager.tsx` | `no surface` | Boundary probe 2, same chain as #1. 2 `toast(`. |
| 10 | `src/components/children-ministry/RestockDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 11 | `src/components/children-ministry/SessionDetailSheet.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 12 | `src/components/children-ministry/SessionEditDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 5 `toast(`. |
| 13 | `src/components/children-ministry/VolunteerDetailSheet.tsx` | `no surface` | Boundary probe 2, same chain as #1. 3 `toast(`. |
| 14 | `src/components/children-ministry/VolunteerEditDialog.tsx` | `no surface` | Boundary probe 2, same chain as #1. 5 `toast(`. |
| 15 | `src/components/children-ministry/VolunteerManager.tsx` | `no surface` | Boundary probe 2, same chain as #1. 1 `toast(`. |
| 16 | `src/components/graphics/DragCanvasEditor.tsx` | `no surface` | Outside the boundary. `src/components/graphics/**` is reached only from `src/pages/GraphicsGeneratorPage.tsx`, routed at `appRoutes.tsx:46` as `/admin/graphics`. Matched on `getContext(` alone; the file draws no text. |
| 17 | `src/components/graphics/GraphicsGenerator.tsx` | `no surface` | Outside the boundary, same chain as #16. Emits real text — 12 `toast(` and a `link.download` at 654 — but the announcement-graphics workflow has no chain to the builder. |
| 18 | `src/components/graphics/GraphicsGeneratorV2.tsx` | `no surface` | Outside the boundary, same chain as #16. 11 `toast(`, `toDataURL` at 261, `downloadAllGraphics` at 1044. |
| 19 | `src/components/graphics/SavedBatches.tsx` | `no surface` | Outside the boundary, same chain as #16. Downloads `<title>_<format>.png` at 151. |
| 20 | `src/components/graphics/ThemeManager.tsx` | `no surface` | Outside the boundary, same chain as #16. 10 `toast(`. |
| 21 | `src/components/graphics/canvasCompositor.ts` | `no surface` | Outside the boundary, same chain as #16. Bakes text into pixels with 7 `fillText` calls — a real surface on `/admin/graphics`, not on any liturgy path. |
| 22 | `src/components/graphics/templateCompositor.ts` | `no surface` | Outside the boundary, same chain as #16. 21 `fillText` plus `downloadAllGraphics` at 2131. The largest text-into-pixels site in the repository and the strongest single argument for auditing `/admin/graphics` in a later phase. |
| 23 | `src/components/liturgia-builder/ChildrenActivityDialog.tsx` | `D1b-2` | In the builder (`ConstructorLiturgias.tsx`). 15 `toast(` and no output-channel emission of its own; it drives the children's lesson data that #45 later typesets. Imports `@/lib/children-ministry/*` services, **not** the `/admin/ninos` components of #1-15 — this is the evidence that separates the two. |
| 24 | `src/components/liturgia-builder/ContextoTransversal.tsx` | `D1b-2` | In the builder. 8 `toast(`; no PDF/email/WhatsApp/download emission. |
| 25 | `src/components/liturgia-builder/ExportPanel.tsx` | `D1b-1` | Two `file download` records (lines 521, 628) in `D1-surfaces-output.md` §4b, and the invocation root for `send-music-service-packet` (344) and `send-children-service-packet` (389). **Also owes D1b-2** 5 `toast(` records. |
| 26 | `src/components/liturgia-builder/Portadas.tsx` | `D1b-1` | Audit find R-25: `subtitle: context.preacher` at 315/449 is baked into cover pixels and reaches the projection PDF. **Also owes D1b-2** 7 `toast(` records. |
| 27 | `src/components/liturgia-builder/UniversalSlide.tsx` | `D1b-1` | Audit find R-24: the literal `Reflexión` at 486 is rasterised into the exported PDF/PPTX. **Also owes D1b-2** its `slide render` records — this file is the slide renderer, so its principal ownership is D1b-2's. |
| 28 | `src/components/liturgia-builder/editors/CuentacuentoEditor.tsx` | `D1b-2` | In the builder. 1 `toast(`. The story text it edits reaches PDF through #47, which holds that record. |
| 29 | `src/components/liturgia-builder/editors/CustomElementEditor.tsx` | `D1b-2` | In the builder. 6 `toast(`; the custom element's `bodyText` reaches the celebrant PDF, and that record sits on #48. |
| 30 | `src/components/liturgia/BiblePassageFetcher.tsx` | `no surface` | Outside the boundary, Group 3. **Corrected at round 1 remediation** — round 1 labelled this `D1b-2` while giving as its reason the very chain that excludes it. Its only referrer is `LiturgiaForm.tsx:17,222`, whose only referrer is `OracionesAntifonalesGenerator.tsx:29,390`. 5 `toast(`, all on `/admin/liturgia/oraciones`. The builder calls the same `fetch-bible-passage` edge function through its own component — `liturgia-builder/ContextoTransversal.tsx:213` — not through this one; `/usr/bin/grep -rn "fetch-bible-passage" src` returns exactly three call sites, and the third is `presentation/BibleVerseCreator.tsx:86`. |
| 31 | `src/components/liturgia/OracionesAntifonalesGenerator.tsx` | `no surface` | Outside the boundary — **the closest call in this phase**, flagged for the reviewer. Reached only from `src/pages/OracionesAntifonalesPage.tsx`, routed at `appRoutes.tsx:57` as `/admin/liturgia/oraciones`. It inserts into the legacy `liturgias` table (239-243), not into the builder's liturgy, and the builder has its own prayer generator (`editors/OracionEditor.tsx:326` calls the same `generate-oraciones` function). 7 `toast(`. Full chain in `D1-exclusions.md` §3. |
| 32 | `src/components/liturgia/SavedLiturgias.tsx` | `no surface` | Outside the boundary, Group 3. **Corrected at round 1 remediation**, same defect as #30. Its only referrer is `OracionesAntifonalesGenerator.tsx:32,394`. 3 `toast(`. It is also the **only reader of `liturgia_oraciones` in the repository** (66, 140) and reconstructs the prayers with its own Spanish `titulo` literals at 145-155 — feeding them back into the same standalone page, never into the builder. That read is what makes the Group 3 verdict narrow rather than absolute. |
| 33 | `src/components/liturgia/SlideGenerator.tsx` | `no surface` | Outside the boundary, inherited from #31 — its only referrer is `OracionesAntifonalesGenerator.tsx:495` (plus the barrel `liturgia/index.ts:11`). It emits heavily: 4 `fillText`, PNG downloads named `oracion_<tipo>_<NN>_<kind>.png` (351-395) and PDFs named `oracion_<tipo>.pdf` / `oraciones_antifonales_completas.pdf` (417, 442). **If the reviewer overturns #31, this file becomes `D1b-1` and gains PDF and file-download records.** |
| 34 | `src/components/liturgia/constants.ts` | `D1b-2` | A UI label registry. `downloadAll: 'Descargar Todo'` (150) is a button caption, not text carried by a download; `fileNamePattern` (192) documents #33's naming and is inert at this commit. |
| 35 | `src/components/music-library/ChordChartUpload.tsx` | `D1b-2` | 5 `toast(`. Uploads chord charts that #51 later merges into the music packet PDF; that record sits on #51. |
| 36 | `src/components/music-library/StemUploadGrid.tsx` | `D1b-2` | 3 `toast(`. |
| 37 | `src/components/music-scheduling/ServiceDateManager.tsx` | `D1b-2` | 2 `toast(`. Its four `resend` matches are the React state name `resendingPacket` — a **regex false positive** for the email service. It does *trigger* the packet email (`invoke('send-music-service-packet')` at 135) but emits none of its text; those records sit on #58. |
| 38 | `src/components/presentation/ImageOverlayControls.tsx` | `D1b-2` | `sonner` import; toast-only. |
| 39 | `src/components/presentation/PresenterView.tsx` | `D1b-2` | `sonner` import; toast-only. Also the root that reaches #52's `file download` records via `ExportDialog` (1344). |
| 40 | `src/components/presentation/SlideStrip.tsx` | `D1b-2` | `sonner` import; toast-only. |
| 41 | `src/components/presentation/VideoBackgroundControls.tsx` | `D1b-2` | `sonner` import; toast-only. |
| 42 | `src/components/sermon-editor/admin/MusicTrackManager.tsx` | `no surface` | Outside the boundary. Sermon-editor admin; `sonner` import only, and no chain from the builder-anchored workflow. |
| 43 | `src/hooks/useCuentacuentosDraft.ts` | `no surface` | **Regex false positive.** Its 5 `download` matches are `supabase.storage.…download(path)` (594) and log strings — reads *from* storage, not a user-facing file download. No emission. |
| 44 | `src/hooks/useMusicLibrary.ts` | `D1b-2` | 108 `toast(` — the largest single toast site in the 62 and a significant slice of D1b-2's work. No output-channel emission. |
| 45 | `src/lib/children-ministry/childrenLessonPdfExporter.ts` | `D1b-1` | Two `PDF` records (chrome; lesson content) in §4b. |
| 46 | `src/lib/cuentacuentos/downscaleImage.ts` | `no surface` | **Regex false positive**, and the case [D1b1.4] anticipated. `getContext(`/`toDataURL` are used to resize an uploaded reference image; the module renders no text. Its only production referrer is `CuentacuentoEditor.tsx:64`. |
| 47 | `src/lib/cuentacuentos/storyPdfExporter.ts` | `D1b-1` | Two `PDF` records (booklet furniture; AI-generated story text) in §4b. |
| 48 | `src/lib/liturgia/exportService.ts` | `D1b-1` | Six records in §4a — five `PDF`, one `file download`. The densest single file in this phase. |
| 49 | `src/lib/liturgia/liturgyService.ts` | `no surface` | **Regex false positive.** Both `download` matches belong to `downloadPortadaImage` (97) and a log line (114), which read cover art *from* storage. Persistence service; emits no user-visible text. |
| 50 | `src/lib/liturgia/slideRenderer.tsx` | `D1b-1` | One `PDF` record in §4a — the rasterisation hand-off after which slide text is pixels. |
| 51 | `src/lib/music-planning/packetGenerationService.ts` | `D1b-1` | Two `PDF` records in §4b. Built with `pdf-lib`, not jsPDF. |
| 52 | `src/lib/presentation/exportImport.ts` | `D1b-1` | Two `file download` records in §4b — the file name and the exported payload. |
| 53 | `src/lib/whatsapp/templates.ts` | `D1b-1` | Two `WhatsApp` records in §2 (bodies; quick-reply button labels). Required by [D1b.5] / [D1b1.8]; the 24–48 h re-approval lead time is recorded as a constraint. |
| 54 | `src/pages/ConstructorLiturgiasPage.tsx` | `D1b-2` | The builder's workflow root. 6 `toast(`; its 2 `download` matches are the `downloadPortadaImage` import and call (39, 108) — the same storage read as #49, a **regex false positive**. |
| 55 | `supabase/functions/_shared/whatsapp/graph.ts` | `D1b-1` | One `WhatsApp` record in §2 — the `sendText` free-text terminal, which is registry-free and therefore approval-free. |
| 56 | `supabase/functions/_shared/whatsapp/send-core.ts` | `D1b-1` | One `WhatsApp` record in §2 — the registry-resident copy, addressed by `templateName` + `languageCode: "es"`. **Also owes D1b-2** its six Spanish `SendOutcome.reason` literals (71-84), which surface as operator toasts. |
| 57 | `supabase/functions/send-children-service-packet/index.ts` | `D1b-1` | Four `email` records in §3. |
| 58 | `supabase/functions/send-music-service-packet/index.ts` | `D1b-1` | Four `email` records in §3 plus one `WhatsApp` record in §2 (the `asignacion_servicio` fan-out at 555-570). |
| 59 | `supabase/functions/wa-reminders/index.ts` | `D1b-1` | Two `WhatsApp` records in §2, one of them audit find R-05. |
| 60 | `supabase/functions/wa-send/index.ts` | `D1b-2` | A validating relay: it forwards `templateName` and variables to `sendWhatsAppOne` and emits no recipient-facing text of its own. Its Spanish literal `error desconocido` (83) returns in the JSON body and surfaces as an operator toast. |
| 61 | `supabase/functions/wa-webhook/index.ts` | `D1b-1` | Two `WhatsApp` records in §2, including the mandatory inbound reply-handler seed. Required by [D1b.5] / [D1b1.8]. |
| 62 | `supabase/functions/whatsapp-signup/index.ts` | `no surface` | Boundary probe 1. Outside the boundary — its only caller is `src/components/sections/InstagramFeed.tsx:76`, a public marketing section, and the email it sends (54-64) asks an administrator to add a contact to the WhatsApp broadcast list. That text does not participate in the keyed reminder/status/reply chain, which `SURFACE-SCHEMA.md` makes the sole test for a `whatsapp-signup` emission. Full chain in `D1-exclusions.md` §3. |

---

## Tally

| Label | Files |
|---|---:|
| `D1b-1` | 16 |
| `D1b-2` | 15 |
| `no surface` | 31 |
| **Total** | **62** |

Counted from the table's own label column, not by hand:

```bash
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/awk -F' \\| ' '{print $3}' | /usr/bin/sort | /usr/bin/uniq -c
#   16 `D1b-1`
#   15 `D1b-2`
#   31 `no surface`
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/awk -F' \\| ' '$3=="`no surface`"' | /usr/bin/grep -c 'false positive'   # -> 3
/usr/bin/grep -E '^\| [0-9]+ \| `' docs/plan/bilingue/evidence/D1-sink-triage.md \
  | /usr/bin/awk -F' \\| ' '$3=="`no surface`"' | /usr/bin/grep -cE 'boundary|Boundary' # -> 28
```

So of the 31 `no surface`: **3** are regex false positives with no emission at all (#43, #46, #49) and
**28 emit but sit outside the D1 inclusion boundary** — 15 `children-ministry` admin components,
7 `graphics` modules, the 4-file standalone `oraciones` graph (#30, #31, #32, #33),
`MusicTrackManager`, and `whatsapp-signup`. Two further false-positive *tokens* are noted on #37 and
#54, but those two files are labelled `D1b-2` for their real toast emissions and so do not appear in
the 3.

**Changed at round 1 remediation:** #30 and #32 moved from `D1b-2` to `no surface`. Round 1 labelled
them `D1b-2` while giving as their reason the very referrer chain that excludes them — the reason
contradicted the label. Found while working Codex [B4]; not itself a Codex finding. See
`D1-exclusions.md` §3 Group 3.

## What D1b-2 inherits

- The 15 files labelled `D1b-2`, plus the toast/slide-render halves explicitly noted on `D1b-1` files
  #25, #26, #27 and #56.
- `LITURGY_ORDER` as its mandatory declaration seed — untouched here by design.
- One audit find handed over: `supabase/functions/_shared/whatsapp/phone.ts` (not in the 62) emits six
  Spanish rejection reasons that reach an operator toast through `describePacketSendResult`.
- The 28 boundary exclusions, if the reviewer overturns any of them. #30, #31, #32 and #33 are the group most
  likely to move, and they move together.
