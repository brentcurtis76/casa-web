# D1-surfaces-output — recipient-facing channels

Phase **D1b-1**. One record per emission whose `sink/channel` is `PDF`, `email`, `WhatsApp`,
`file download`, or `print`. Records follow `SURFACE-SCHEMA.md` exactly: seven fields, no blanks.

RUN METADATA

- SOURCE_SHA: `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`
- BASE_SHA (this branch): recorded in `fixtures/D1-census.json` → `base_sha`
- TARGET_OS: macOS 15.3.1, `Darwin 24.3.0 arm64`
- TARGET_LOCALE: `en_US.UTF-8` (exported once)
- Method integrity verified 4/4 before any measurement — see `reviews/D1b1-r1-review-request.md` §gates.

**Revised at round 1 remediation** after Codex `FAIL(4)`. All four blockers were verified against source
and accepted; §0, §1, §2, §3, §4 and §7 changed. The remediation log is
`reviews/D1b1-r1-review-request.md` §0.

**This is a lower-bound inventory, not a complete one** (D-N). §6 states what it structurally cannot
see and in which direction each gap fails. **D1 describes; it does not prescribe** (D-E): nothing here
recommends how any surface should be made bilingual.

**No personal-data values appear in this document** (D-D, CASA `CLAUDE.md`). Celebrant, preacher,
musician, volunteer and recipient identities are described by role and by the shape of the field that
carries them. Two source files contain a hardcoded personal email address; they are referenced by path
and line only, and the value is not reproduced.

---

## 0. Axis and splitting conventions, stated once

### 0.1 One record per emission *and* per text origin

`SURFACE-SCHEMA.md` §"Record syntax": *"A composite payload with text from more than one origin is
split into one record per origin, even when one API call sends the payload."* Round 1 violated this in
four places and the reviewer was right to block on it. Applied literally here, that means a single
`fetch` to Resend or a single `sendTemplate` call routinely yields **three or four** records — chrome
literals, database content, and a proper noun each get their own — and the totals in §7 reflect that.

### 0.2 Which axis, and why

`SURFACE-SCHEMA.md` defines `UI copy` as "follows the operator locale", `stored-or-output copy` as
"follows the liturgy language", and `channel-fixed` as "recipient-facing copy whose language is fixed
**independently by an external registry**". Four situations recur, and each is decided the same way
every time rather than per record:

| Situation | Axis | Why |
|---|---|---|
| Operator-read chrome inside an exported document — PDF section headers, element labels, file names | `UI copy` | It follows whatever locale the operator's app is in. |
| Liturgy content carried into an export or an email — prayers, readings, slide text, lesson text, song titles | `stored-or-output copy` | It follows the language the liturgy was authored in. |
| WhatsApp copy that **is** the approved template body or its registered button labels | `channel-fixed` | Its language is fixed in WhatsApp Business Manager, which is exactly what the schema reserves this value for. |
| **Recipient-facing copy with no registry behind it** — every email literal, WhatsApp free text sent by `sendText`, and template *variables* | `UNVERIFIED (materiality: BLOCKS-REPLAN)` | See 0.3. |

Two narrower cases:

- **A proper noun** — a musician's, volunteer's, celebrant's or preacher's name — has no language and
  follows no axis. The schema forbids a blank field, so these carry
  `UNVERIFIED (materiality: DETAIL)`: the choice is real but cosmetic, since a name is not translated.
- **A date rendered by the platform's locale data** (`toLocaleDateString('es-CL', …)`) is neither
  database content nor a repository string. It is split out of whatever record it was embedded in and
  given the axis of the document that displays it.

### 0.3 The gap this phase found in the schema

The schema has **no axis for a recipient's own language preference**, and an email to a musician or a
children's volunteer is neither operator chrome nor liturgy content. Whether that copy follows the
operator locale, the liturgy language, or a per-recipient setting changes **data shape** — the third
would need a per-recipient language column — so the materiality is `BLOCKS-REPLAN`, not `DETAIL`.

**The D1 reviewer approved this classification at round 1** ("I approve `BLOCKS-REPLAN` for the six
email-copy records and music-packet PDF chrome"), per D-I. Round 1's remediation extends the same
treatment to registry-free WhatsApp copy, which round 1 had mislabelled `channel-fixed` — see §2.
Stated as an observation about the schema, not a proposal to change it (D-E, D-L).

---

## 1. Surfaces the call-path audit found that the candidate-floor regex did not — [D1b1.7]

[D1b1.7] requires this list first and unmissable, and requires an explicit statement when it is empty.
It is **not** empty, but the answer has two halves and they must not be blurred.

### 1a. At file level: the audit found **no in-scope file** outside the 62

The reverse audit searched the whole repository for every terminal call belonging to this phase's five
channels, independently of the candidate floor's path filter:

```bash
export LC_ALL=en_US.UTF-8
TERM='api\.resend\.com|resend\.emails\.send|new Resend|nodemailer|createTransport|\.download[[:space:]]*=|window\.print|\bprint\(\)|new jsPDF|jsPDF\(|PDFDocument\.create|pdfDoc\.save\(|pptx\.writeFile|graph\.facebook\.com|sendText\(|sendTemplate\(|messaging_product'
/usr/bin/grep -rlE "$TERM" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.|_test\.| [0-9]\.tsx?$' | /usr/bin/sort > /tmp/audit-terminals.txt
```

Literal output — 24 files:

```text
src/components/financial/PayrollSlipPDF.ts
src/components/graphics/GraphicsGenerator.tsx
src/components/graphics/SavedBatches.tsx
src/components/graphics/templateCompositor.ts
src/components/liturgia-builder/ExportPanel.tsx
src/components/liturgia/SlideGenerator.tsx
src/components/sermon-editor/DistributionPanel.tsx
src/lib/children-ministry/childrenLessonPdfExporter.ts
src/lib/cuentacuentos/storyPdfExporter.ts
src/lib/financial/reportPdfGenerator.ts
src/lib/liturgia/exportService.ts
src/lib/music-planning/packetGenerationService.ts
src/lib/presentation/exportImport.ts
src/lib/sermon-editor/mp3Encoder.ts
src/pages/AdminSignups.tsx
supabase/functions/_shared/whatsapp/graph.ts
supabase/functions/_shared/whatsapp/send-core.ts
supabase/functions/prayer-request/index.ts
supabase/functions/send-children-service-packet/index.ts
supabase/functions/send-mesa-notifications/index.ts
supabase/functions/send-music-service-packet/index.ts
supabase/functions/send-signup-confirmation/index.ts
supabase/functions/wa-webhook/index.ts
supabase/functions/whatsapp-signup/index.ts
```

The set difference against the candidate floor, with its literal output:

```bash
# /tmp/floor.txt is the candidate floor, reproduced by the block in D1-sink-triage.md
/usr/bin/comm -12 /tmp/audit-terminals.txt /tmp/floor.txt | /usr/bin/wc -l   # -> 16 in both
/usr/bin/comm -23 /tmp/audit-terminals.txt /tmp/floor.txt                    # -> the 8 below
```

```text
src/components/financial/PayrollSlipPDF.ts
src/components/sermon-editor/DistributionPanel.tsx
src/lib/financial/reportPdfGenerator.ts
src/lib/sermon-editor/mp3Encoder.ts
src/pages/AdminSignups.tsx
supabase/functions/prayer-request/index.ts
supabase/functions/send-mesa-notifications/index.ts
supabase/functions/send-signup-confirmation/index.ts
```

Each of the 8 was checked against the inclusion rule and each fails clause 1 — no chain from the
builder-anchored workflow. Evidence per file is in `D1-exclusions.md` §4. Two are worth naming here
because they emit real Spanish through this phase's channels and are excluded only by the boundary,
not by absence of copy: `src/pages/AdminSignups.tsx:91` downloads
`inscripciones-<formType>-<date>.csv`, and `supabase/functions/prayer-request/index.ts:58` emails a
subject beginning `Nueva petición de oración`.

**So the regex's liturgy-path filter did not drop an in-scope file at this commit.** That is a
statement about eight files and one terminal-call pattern set, not a completeness claim: a channel
reached by a construct outside `TERM` — a helper that wraps `fetch` to an email vendor, a dynamically
imported PDF library, a Graph call assembled from string fragments — would appear in neither list.

### 1b. At record level: five findings the floor pointed nowhere near

These are the phase's actual audit yield. In each case either the file is not in the 62 at all, or it
is in the 62 for a **different** sink than the one that carries the text.

| # | Where | Why the regex did not find it |
|---|---|---|
| R-01 | `src/lib/whatsapp/templates.ts` — **the whole file** | **`WA_TEMPLATES` has no importer anywhere in `src/` or `supabase/`.** The regex nominated this file on the literal token `WA_TEMPLATES`, which occurs only in its own declaration. Nothing reads it; every sender hardcodes its own template name. Found by tracing the value rather than the token — see §2 for the full trace and what it means. |
| R-05 | `supabase/functions/wa-reminders/index.ts:24-31,125` | `formatDateEs`'s Spanish month names and the `"voluntario"` role fallback are substituted into an approved template body as `{{2}}`/`{{3}}`. The file is in the 62 via `templateName`; the emitted Spanish is nowhere in the template registry, and Pass A scores this file **0**. |
| R-24 | `src/components/liturgia-builder/UniversalSlide.tsx:486` | The literal `Reflexión` label is rasterised into the reflection-cover image and lands in the projection PDF/PPTX. The file is in the 62 via `toDataURL` — a *slide render* token, i.e. D1b-2's sink — not via any PDF token. |
| R-25 | `src/components/liturgia-builder/Portadas.tsx:315,449` | The preacher name is passed as a cover subtitle and **baked into cover pixels**. The file is in the 62 only via `toast(`. No text search can recover this string from the exported PDF. |
| — | `supabase/functions/_shared/whatsapp/payload.ts:42` | Not in the 62 at all. Holds the opt-out keyword grammar (`stop\|baja\|…`). **It is not a record**: the schema requires an emission and this code only *recognises* text. It is a language-coupled surface all the same — see §5. |

One further audit find belongs to D1b-2 and is handed over rather than recorded here:
`supabase/functions/_shared/whatsapp/phone.ts:20-49` returns six Spanish rejection reasons
(`Sin número de teléfono`, `Solo se aceptan móviles chilenos…`, …) that travel through
`sendWhatsAppOne`'s `SendOutcome.reason` into `describePacketSendResult` and out as an operator toast.
The file is **not** in the 62. Its sink is `toast/UI`, so the record is D1b-2's.

---

## 2. Records — `WhatsApp`

### 2.0 R-01: what the trace actually shows, before the records

Round 1 asserted a chain `WA_TEMPLATES[name].name → SendInput.templateName → sendTemplate → Graph API`.
**That chain does not exist.** Re-derived:

```bash
export LC_ALL=en_US.UTF-8
/usr/bin/grep -rn "WA_TEMPLATES\|getTemplate\|whatsapp/templates" src supabase \
  --include='*.ts' --include='*.tsx' | /usr/bin/grep -v '^src/lib/whatsapp/templates.ts'
# src/types/shared/liturgy.ts:422:export function getTemplate(templateId: string): LiturgyTemplate | undefined {
#   — an unrelated same-named function for liturgy templates. No importer of WA_TEMPLATES exists.

/usr/bin/grep -rn "templateName" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '_test\.|\.test\.'
# supabase/functions/send-music-service-packet/index.ts:558:  templateName: "asignacion_servicio",
# supabase/functions/wa-reminders/index.ts:57: const templateName = kind === "reminder_1week"
#                                              ? "recordatorio_semana" : "recordatorio_dia";
# …remaining hits are the type declaration and log fields in graph.ts / send-core.ts
```

Three facts follow, and all three change how this file must be recorded:

1. **Every send site hardcodes its own template-name string literal.** No value flows out of
   `templates.ts` into any sender.
2. **The runtime boundary makes such a flow impossible at this commit.** `templates.ts` is a browser
   module under `src/`; every sender is a Deno edge function under `supabase/functions/`, and no edge
   function imports from `src/` (`/usr/bin/grep -rn "from \"../../../src\|from '@/lib" supabase/functions`
   → no output). `src/lib/whatsapp/index.ts` re-exports `templates.ts`, but the only browser importers
   of that barrel — `ExportPanel.tsx:68`, `ServiceDateManager.tsx:62` — take `describePacketSendResult`
   from `summary.ts`, not the registry.
3. **Three of the six declared templates are never named by any sender:**

   ```bash
   for t in asignacion_servicio recordatorio_semana recordatorio_dia \
            cambio_servicio solicitud_disponibilidad opt_in_bienvenida; do
     printf '%-28s ' "$t"
     /usr/bin/grep -rn "\"$t\"\|'$t'" src supabase --include='*.ts' --include='*.tsx' \
       | /usr/bin/grep -v 'src/lib/whatsapp/templates.ts' | /usr/bin/tr '\n' ' '; echo
   done
   # asignacion_servicio          send-music-service-packet/index.ts:558
   # recordatorio_semana          wa-reminders/index.ts:57
   # recordatorio_dia             wa-reminders/index.ts:57
   # cambio_servicio              (none)
   # solicitud_disponibilidad     (none)
   # opt_in_bienvenida            (none)
   ```

So `templates.ts` is a **hand-maintained mirror** of copy registered in WhatsApp Business Manager, not
a link in any emission path, and its fidelity to the registered copy is unverified by anything in this
repository. It still gets records, because [D1b.5]/[D1b1.8] require them — but the records say what it
is. Where the *emitted* copy is concerned, the record that matters is 2.3, whose `text-origin` is
`external registry`.

**This also corrects a claim round 1 made elsewhere:** `opt_in_bienvenida` is the template that tells
recipients how to opt out, and **no code path in this repository sends it.** The opt-out promise it
carries is therefore not made by this codebase at this commit, which changes the reason on record 2.6.

### 2.1–2.11 The records

- path: `src/lib/whatsapp/templates.ts`
  symbol-or-line: `WA_TEMPLATES` (lines 19-73)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `declaration/registry in source`
  language-axis: `{channel-fixed}`
  reason: Six template definitions with `language: 'es'` and Spanish `body` copy carrying `{{1}}`–`{{3}}` placeholders. **Not an emission path** — §2.0 shows no importer exists, the runtime boundary forbids one, and three of the six are named by no sender. This is the in-repo mirror of copy registered in WhatsApp Business Manager; the axis describes the registered copy it mirrors, and the drift between the two is undetected by anything here. Recorded because [D1b.5]/[D1b1.8] require this file to appear. **Constraint, not a string:** the header at lines 1-5 records that editing a body in WhatsApp Manager triggers re-approval of **24–48 h**, so any English rollout of these bodies is gated on a Meta approval cycle per template — and, given the mirror, editing this file alone would change nothing that reaches a phone.

- path: `src/lib/whatsapp/templates.ts`
  symbol-or-line: `WA_TEMPLATES.*.buttons[].label` (lines 27, 36, 45)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `declaration/registry in source`
  language-axis: `{channel-fixed}`
  reason: Separate emission from the body — quick-reply button labels (`Confirmar`, `No puedo`) render as tappable chips, are capped at 25 characters by WhatsApp, and are registered with the template rather than passed per send. Recorded separately because the emission, the length constraint and the re-approval unit all differ from the body. The same mirror caveat in §2.0 applies: `graph.ts:44-53` attaches only `quick_reply` **payloads** per send; the labels themselves come from the registry, never from this file.

- path: `supabase/functions/_shared/whatsapp/send-core.ts`
  symbol-or-line: `sendWhatsAppOne` (lines 87-93)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `external registry`
  language-axis: `{channel-fixed}`
  reason: **The record for the copy a recipient actually reads.** `sendTemplate` is called with a `templateName` string and `languageCode: "es"` hardcoded here; the body is resolved by Meta from WhatsApp Business Manager. Chain: caller's literal name → `SendInput.templateName` → `sendTemplate` (`graph.ts:99-104`) → `buildTemplatePayload` (`graph.ts:34-67`) → `POST https://graph.facebook.com/v23.0/{phone_number_id}/messages` (`graph.ts:73-81`). Identified by accessor and template key without copying any body, as `SURFACE-SCHEMA.md` requires for an external registry.

- path: `supabase/functions/_shared/whatsapp/graph.ts`
  symbol-or-line: `sendText` (lines 106-116)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The free-text terminal. Unlike `sendTemplate` it is **not** registry-bound, so any string a caller passes reaches the recipient's phone with no approval step — which is precisely why its axis is not `channel-fixed`: no external registry fixes this language. Chain: caller's `body` → `postGraph` → `type: "text"` payload → Graph API. Recorded as the terminal that makes the two `wa-webhook` records below possible; both of its in-scope callers are recorded separately.

- path: `supabase/functions/wa-webhook/index.ts`
  symbol-or-line: line 137
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The **inbound round-trip** — the mandatory reply-handler seed for [D1b1.6]. A quick-reply tap arrives as `messages[].button.payload`, is parsed by `parsePayload` (`payload.ts:27-38`), applied to `music_service_assignments` / `church_children_session_assignments` / `music_rehearsal_attendees` by `applyAssignmentUpdate` (lines 40-67), and acknowledged by a Spanish `sendText` confirmation. This string is a source literal sent registry-free, so it needs no re-approval **and** carries no registry-fixed language — it is recipient-facing copy with no defined axis, exactly like the email bodies in §3. It is the emission review 5 caught the original sink regex missing.

- path: `supabase/functions/wa-webhook/index.ts`
  symbol-or-line: line 150
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Separate emission with a separate trigger: an inbound free-text message matching `isOptOutMessage` (`payload.ts:42-52`) sets `whatsapp_suppressed` on the matching musician or volunteer row (`suppressByPhone`, lines 69-109) and replies with a Spanish opt-out confirmation, again through registry-free `sendText`. **Correction to round 1:** this cannot be called the compliance leg of a promise made by `opt_in_bienvenida`, because §2.0 shows that template is sent by no code path here. What the reply is coupled to is the keyword grammar in §5, and to whatever opt-in copy was registered outside this repository.

- path: `supabase/functions/wa-reminders/index.ts`
  symbol-or-line: `formatDateEs` (lines 24-31); `rol` fallback (line 125)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: **Audit find R-05.** Twelve Spanish month names and the fallback role word `"voluntario"` are assembled here and passed as `variables: [display_name, fecha, rol]` (line 132) into `sendWhatsAppOne` → `sendTemplate`, where they substitute `{{2}}` and `{{3}}` of `recordatorio_semana` / `recordatorio_dia`. **A template variable is not registry-fixed** — Meta approves the body, not the substitutions — so this Spanish needs no re-approval and follows no registry language; localising the approved bodies alone would leave a Spanish date inside an English message. `census.sh` scores this file `PASS_A hits=0`, `PASS_B hits=0`: none of the month names carries an accent or a frozen word-list token.

- path: `supabase/functions/wa-reminders/index.ts`
  symbol-or-line: line 132 (`variables[0]`)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: `music_musicians.display_name`, selected at lines 79-86 and substituted as `{{1}}`. Separate record because the origin is a database column rather than a source literal. Per §0.2, a proper noun follows no language axis — it is not translated by any localisation — so the axis is unresolved but cosmetic. Recorded by column and role only; no value is reproduced (D-D).

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: line 558 (`templateName: "asignacion_servicio"`)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `external registry`
  language-axis: `{channel-fixed}`
  reason: The publication fan-out's registry-resident half. After the email loop, each opted-in musician with an unconfirmed assignment is sent the `asignacion_servicio` template through `sendWhatsAppOne`, with quick-reply payloads from `buildPayload("confirm"|"decline", "music", assignmentId)` whose replies land in `wa-webhook` above. The body is resolved by Meta, not by this repository. Chain root: `ExportPanel.tsx:344` / `ServiceDateManager.tsx:135` `supabase.functions.invoke('send-music-service-packet')`.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: line 560 (`variables[1]`, from `formattedDate` at 377)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Split from the record above per §0.1 — the same `sendTemplate` call carries text from three origins. `formattedDate` is built at line 377 from the Spanish `days` and `months` literal tables at 354-376 and substituted as `{{2}}`. Registry-free like R-05, and the same failure mode: translating the approved body would leave this date in Spanish.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: line 560 (`variables[0]`, `variables[2]`)
  sink/channel: `WhatsApp`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: The third origin in the same call — `candidate.displayName` (a proper noun) and `candidate.rol` (the assigned instrument or role, read from `music_service_assignments`) substituted as `{{1}}` and `{{3}}`. Split per §0.1. Axis per §0.2: a name follows none, and the role string is stored data whose language is whatever an operator typed. No value reproduced (D-D).

---

## 3. Records — `email`

Every literal below carries `UNVERIFIED (materiality: BLOCKS-REPLAN)` for the reason stated in §0.3 and
approved by the reviewer at round 1. Database-sourced content in the same emails carries
`stored-or-output copy`, and proper nouns carry `UNVERIFIED (materiality: DETAIL)` — each split into
its own record per §0.1.

### 3a. The musician packet email

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: lines 429-462 (`emailHtml` literals)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The packet email body's own copy, composed as an HTML template literal and POSTed to `https://api.resend.com/emails` at lines 465-477 — greeting, the packet sentence, the `Canciones:` heading, the closing request and the two footer lines. Chain: `ExportPanel.tsx:344` or `ServiceDateManager.tsx:135` `invoke('send-music-service-packet')` → this handler → Resend → the musician's inbox. **The whole body is written without accents** (`Comunidad Anglicana San Andres`, `Actualizacion`, `valido`, `aun no esta`), which is why `census.sh` scores this 606-line file `PASS_A hits=1`.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: line 437 (`musician.displayName`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: Split from the body per §0.1 — the salutation interpolates the recipient's own name from `music_musicians`. A proper noun follows no axis (§0.2). Recorded by field and position; no value reproduced (D-D).

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: lines 352-396 (`months`, `days`, `serviceTypeLabels`, `emailSubject`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Separate emission — the subject line, delivered even when the body is never opened. Built from a Spanish day/month table (354-376), a `serviceTypeLabels` map (`Domingo Principal` / `Servicio Especial` / `Ensayo`, 379-383) and an `Actualizacion v<n>` prefix for republished packets. The same `formattedDate` also appears in the body sentence at 439 and as the WhatsApp `{{2}}` in §2.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: lines 312-317, 333, 341 (`sourceTypeLabels`, badge and fallback literals)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Split out of round 1's song-list record per §0.1, which mixed two origins in one entry. These are the source literals inside the song list: the `sourceTypeLabels` map (`Enlace` for a generic link, alongside the brand names `YouTube` / `Spotify` / `Audio`), the `Referencia` fallback label at 341, and the `Stems disponibles` badge at 333.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: lines 319-350 (`songListHtml`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The other origin in the same fragment — `music_songs.title`, `music_setlist_items.liturgical_moment`, and the audio-reference `description` values, ordered by `sort_order`. This text follows the language the setlist was authored in, independently of the labels around it.

- path: `supabase/functions/send-music-service-packet/index.ts`
  symbol-or-line: lines 424-427 (`packetSection`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: A conditional emission with its own trigger: when a generated packet PDF exists, the email carries a `Descargar Paquete Musical (PDF)` call-to-action plus an `Enlace valido por 24 horas` caveat over a 24-hour signed storage URL (288-303); when it does not, a different Spanish sentence is sent instead. Recorded separately because which of the two strings is emitted depends on packet-generation state, not on the email path.

### 3b. The children's-volunteer packet email

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: `buildConsolidatedEmailHtml` literals (lines 105-160)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The email shell's own copy — header (`CASA - Actividad de Ninos`, `Comunidad Anglicana San Andres`), salutation, one of two intro sentences depending on how many age groups the volunteer serves, and the automated-generation footer. POSTed to `https://api.resend.com/emails` at 385-397. Chain root: `ExportPanel.tsx:389` `invoke('send-children-service-packet')`. Also unaccented throughout — `census.sh` scores this 474-line file `PASS_A hits=0`.

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: line 135 (`escapeHtml(recipient.displayName)`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: Split from the shell per §0.1 — the salutation interpolates the volunteer's own name from `church_children_volunteers`, HTML-escaped by `escapeHtml` (25-33). A proper noun follows no axis (§0.2). No value reproduced (D-D).

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: `buildGroupSectionHtml` (lines 68-100)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The per-age-group section inside the same email — the field labels `Grupo`, `Actividad`, `Fecha`, `Horario`, `Tu Rol`, the `Voluntario de <role>` construction at 84, and the two conditional headings `Estructura de la Actividad` and `Materiales Necesarios`. Recorded separately from the shell because one email repeats this block once per group the volunteer is assigned to, so the emission count is per assignment rather than per email.

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: line 354 (`volunteerRole`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Split from the subject line per §0.1 — round 1 combined the two while calling them two emissions. The role word (`Lider` / `Apoyo`) is mapped from the `lead` enum at assignment-collection time, stored on `GroupActivityData`, and rendered inside the group section at 84. Distinct emission point and distinct trigger from the subject.

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: lines 389-391 (`subject`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The subject line prefix `Actividad Infantil: <lesson title> - <group names>`, emitted per recipient regardless of whether the body is read, and branching on whether the volunteer serves one group or several.

- path: `supabase/functions/send-children-service-packet/index.ts`
  symbol-or-line: lines 338-362 (`lessonTitle`, `ageGroupName`, `materials`, `activityDate`, `activityTime`, `phaseHtml`)
  sink/channel: `email`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The substantive content of the same email — lesson title, age-group name, the comma-split `materials_needed` list, the calendar date and start/end times, and the phase structure — read from `church_children_*` rows and HTML-escaped before insertion. Separate record because this text follows whatever language the lesson was authored in, independently of the surrounding chrome.

---

## 4. Records — `PDF`, `file download`

### 4a. The celebrant guide and the projection export

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: `getElementLabel` (lines 185-208)
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `declaration/registry in source`
  language-axis: `{UI copy}`
  reason: A nineteen-entry map of liturgy element types to Spanish display labels (`Oración de Invocación`, `Lectura Bíblica`, `Acción de Gracias`, …). Chain: `exportToCelebrantPDF` (line 330) → `elementTitle` → `pdf.text(elementTitle.toUpperCase(), …)` at 332 → `pdf.save(fileName)` at 682. Declared in one place and rendered in another, which is the shape the census structurally cannot follow.

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: `exportToCelebrantPDF`, `renderCelebrantCoverPage` (lines 242-811)
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: The celebrant guide's own chrome, distinct from the element labels above: `GUÍA LITÚRGICA` (738), `CONTEXTO DE LA REFLEXIÓN` (280), the speaker labels `CONGREGACIÓN:` / `CELEBRANTE:` (377, 380, 409, 597, 600, 621), the placeholder brackets `[N slides de proyección]` (348), `[Slide de portada - ver proyección]` (545), `[Sin anuncios configurados]` (537), `[Imagen personalizada: …]` (575), the `Cuento para niños:` and `Conexión espiritual:` labels (458, 476), the announcement field labels `Lugar:` / `Fecha:` (523, 527), the `Celebrante:` / `Predicador:` cover labels (789, 801), the error line `[Error al procesar <type>]` (661), and the closing rule `— Fin de la Guía Litúrgica · N elementos · N páginas —` (679). All reach the reader through `pdf.text` and the terminal `pdf.save` at 682.

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: line 761 (`toLocaleDateString('es-CL', …)`)
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: The cover date is rendered with the locale tag `es-CL` pinned in source, so the weekday and month names come from the platform's Spanish CLDR data rather than from any repository string. Recorded separately because no text search of this repository can enumerate the strings it emits — the copy lives in the runtime's locale data. Axis per §0.2: it takes the axis of the document that displays it, and the celebrant guide is operator-read.

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: `exportToCelebrantPDF` content branches (lines 343-650)
  sink/channel: `PDF`
  audience: `{operator, congregation}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The liturgy's own text carried into the guide — `slide.content.primary` / `.secondary` for prayers and fixed elements (394, 417, 609, 628), `liturgyContext.summary` (293), `reading.reference` / `.version` / `.text` for Bible passages (433, 439), `storyData.title` and `.spiritualConnection` (461, 482), announcement `title` / `content` / `location` / `date` (499-527), and `customConfig.bodyText` (553). Separate record from the chrome above: this follows the liturgy language, the chrome follows the operator locale, and `SURFACE-SCHEMA.md` requires the mixed presentation not to be collapsed.

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: `renderCelebrantCoverPage` (lines 785-806)
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: `liturgyContext.celebrant` and `liturgyContext.preacher` drawn onto the cover next to their Spanish labels (which are the chrome record above). Recorded because this is a **personal-data-bearing** emission on the PDF channel; the record names the field and the position, never a value (D-D). Axis per §0.2: proper nouns follow none.

- path: `src/lib/liturgia/exportService.ts`
  symbol-or-line: `generateFileName` (lines 49-57); line 681
  sink/channel: `file download`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: The downloaded file's name is user-visible text delivered by the download itself. `Liturgia_<safeTitle>_<date>.<ext>` with the Spanish default `'Liturgia'` when the liturgy is untitled, plus the `_Celebrante.pdf` suffix substituted at 681. Terminals: `pdf.save(fileName)` (179, 682) and `pptx.writeFile({ fileName })` (131). The sanitiser at 55 deliberately preserves `áéíóúÁÉÍÓÚñÑ`, so accented liturgy titles survive into the file name.

- path: `src/lib/liturgia/slideRenderer.tsx`
  symbol-or-line: `renderSlideToImage` (lines 19-60)
  sink/channel: `PDF`
  audience: `{congregation, operator}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The projection export's text path, and a structural blind spot made concrete. Every slide is mounted off-screen as a `UniversalSlide`, rasterised by `html2canvas`, and embedded as a PNG — `exportService.ts:115` into PPTX and `:170` into `pdf-projection`. **After this hand-off the slide text is pixels**: it is not recoverable by any text search of the produced PDF, and no localisation of the PDF layer can reach it. The text originates as slide content saved from the builder.

- path: `src/components/liturgia-builder/UniversalSlide.tsx`
  symbol-or-line: line 486
  sink/channel: `PDF`
  audience: `{congregation, operator}`
  text-origin: `literal in source`
  language-axis: `{stored-or-output copy}`
  reason: **Audit find R-24.** A hardcoded `Reflexión` label rendered inside the slide body, so it is rasterised by `slideRenderer` along with the slide content and lands in the projection PDF and the PPTX. The candidate floor nominated this file only through `toDataURL` — a slide-render token belonging to D1b-2 — so nothing in the regex output points at a PDF emission here. `census.sh` scores this 1,385-line file `PASS_A hits=4`.

- path: `src/components/liturgia-builder/Portadas.tsx`
  symbol-or-line: lines 315, 449
  sink/channel: `PDF`
  audience: `{congregation, operator}`
  text-origin: `database content`
  language-axis: `{UNVERIFIED (materiality: DETAIL)}`
  reason: **Audit find R-25.** The reflection cover is composed with `subtitle: context.preacher` and handed to `UniversalSlide`, so the preacher's name is **baked into cover pixels** and travels through `slideRenderer` into the projection PDF/PPTX. The file appears in the 62 only via `toast(`. Personal data by mechanism: the record names the field and the composition site; the value is neither read nor reproduced (D-D). Recovering or replacing this text in an exported deck would require OCR or regeneration, which `SURFACE-SCHEMA.md` §"Structural blind spots" names as a method extension rather than a capability of this pass.

### 4b. The story and children's-activity PDFs

- path: `src/lib/cuentacuentos/storyPdfExporter.ts`
  symbol-or-line: lines 327, 344, 432, 571, 621
  sink/channel: `PDF`
  audience: `{congregation, recipient}`
  text-origin: `literal in source`
  language-axis: `{stored-or-output copy}`
  reason: The story booklet's fixed furniture — the cover subtitle `Un cuento para la familia`, the reflection-page heading `Para reflexionar en familia`, the per-scene label at 432 and the `CASA` colophon on cover and back page. The module returns `pdf.output('blob')` (158); `ExportPanel.tsx:628` names the blob and clicks a synthetic anchor. Axis per §0.2: this booklet is a per-liturgy artefact whose furniture sits inside liturgy content, not operator chrome — round 1 labelled it `UI copy`, which was inconsistent with its own convention.

- path: `src/lib/cuentacuentos/storyPdfExporter.ts`
  symbol-or-line: lines 319, 462, 602
  sink/channel: `PDF`
  audience: `{congregation, recipient}`
  text-origin: `AI-generated`
  language-axis: `{stored-or-output copy}`
  reason: The story title, the per-scene narration and the reflection questions are produced by the `generate-story` / `refine-story` edge functions, saved with the liturgy's cuentacuentos element, and typeset here. Separate record: this text is regenerated rather than translated, whereas the furniture above is a source literal.

- path: `src/lib/children-ministry/childrenLessonPdfExporter.ts`
  symbol-or-line: lines 66-76, 211, 245, 291, 302, 318, 415, 421, 493, 521, 570-576, 620-624
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: The children's activity guide's chrome: the three phase labels (`Movimiento`, `Expresión y Conversación`, `Reflexión y Meta-aprendizaje`, 66-76), the cover title `ACTIVIDAD INFANTIL` (211), the `Basado en: "<story title>"` line (291), the footer `CASA · Comunidad Anglicana San Andrés` (302), the section headers `Materiales` / `Secuencia de Actividades` / `Adaptaciones por Grupo` / `Plan de Voluntarios` (415, 493, 570, 620), the empty-state `Sin materiales requeridos` (421), the `Fase N: <label>` band (521), the four group-size labels with their Spanish counts (573-576) and the `Líder` / `Apoyo` role words (623-624). Chain: `ExportPanel.tsx:513` `exportChildrenLessonToPDF` → blob → download at 517-525.

- path: `src/lib/children-ministry/childrenLessonPdfExporter.ts`
  symbol-or-line: `ChildrenLessonPdfData` content fields, rendered at 220, 270, 282, 541-552, 587-603, 634-644
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The lesson's own text — activity name, age-group label, materials, phase sequence, adaptations and volunteer plan — assembled in `ExportPanel.tsx:496-509` from `church_children_*` rows plus the liturgy title and the cuentacuentos story title. Separate record: authored content, not chrome.

- path: `src/components/liturgia-builder/ExportPanel.tsx`
  symbol-or-line: line 484 (`liturgyDateLabel`)
  sink/channel: `PDF`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: Split out of the record above per §0.1 — round 1 folded this into the children's PDF database-content record, but the date is neither database text nor a repository string. It is generated by `toLocaleDateString('es-CL', …)` with the locale tag pinned in source, and rendered on the guide's cover meta line at `childrenLessonPdfExporter.ts:270`. Axis per §0.2: the guide is operator-read.

- path: `src/lib/music-planning/packetGenerationService.ts`
  symbol-or-line: lines 53, 61, 105, 132
  sink/channel: `PDF`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: The music packet PDF cover, drawn with **`pdf-lib`** (`page.drawText`, `pdfDoc.save()` at 278) rather than jsPDF — a second, independent PDF stack in the same codebase. Literals: `CASA` (53), `Comunidad Anglicana San Andres` (61), the `Canciones` section heading (105) and the footer `Generado por CASA - Sistema de Gestion Comunitaria` (132), all unaccented, which is why `census.sh` scores this file `PASS_A hits=0`. The PDF is uploaded to storage (284-290) and reaches the musician as the 24-hour signed link in the packet email, so its audience is the same recipient as §3 and it carries the same unresolved axis. The reviewer approved this materiality at round 1.

- path: `src/lib/music-planning/packetGenerationService.ts`
  symbol-or-line: lines 73, 105-119 (`title`, song rows)
  sink/channel: `PDF`
  audience: `{recipient}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The packet's authored content — the setlist title and one drawn line per song, from `music_songs` and `music_setlist_items`. Separate record from the fixed cover furniture above.

- path: `src/components/liturgia-builder/ExportPanel.tsx`
  symbol-or-line: lines 311-319 (`dateParts` → `serviceDateLabel`)
  sink/channel: `PDF`
  audience: `{recipient}`
  text-origin: `literal in source`
  language-axis: `{UNVERIFIED (materiality: BLOCKS-REPLAN)}`
  reason: Split out per §0.1 — round 1 recorded `params.serviceDateLabel` as database content inside the packet PDF's content record, but it is not database text. It is generated at `ExportPanel.tsx:311` by `toLocaleDateString('es-CL', …)`, passed through `packetGenerationService`'s params (31, 41, 240) and drawn on the packet cover at 84. Recipient-facing, so it carries the packet PDF's axis rather than the operator-guide `UI copy` used at 484.

- path: `src/components/liturgia-builder/ExportPanel.tsx`
  symbol-or-line: lines 521, 628
  sink/channel: `file download`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: Two downloaded file names, each user-visible text delivered by the download: `<liturgy title>_Actividad_Ninos.pdf` with the Spanish default `'Actividad'` when the liturgy is untitled, and `<story title>_cuento.pdf`. Both are emitted by assigning `a.download` and clicking a synthetic anchor over an object URL (517-525, 624-632).

- path: `src/lib/presentation/exportImport.ts`
  symbol-or-line: `exportPresentation` (lines 225-240)
  sink/channel: `file download`
  audience: `{operator}`
  text-origin: `literal in source`
  language-axis: `{UI copy}`
  reason: The presentation state export. A JSON blob is written to an object URL and downloaded under a name built at 225-229, defaulting to a Spanish-derived pattern when the caller supplies none. Chain: `PresenterView.tsx:1344` `<ExportDialog>` → `ExportDialog.tsx:22` `exportPresentation` → `a.download` at 237. In scope because `PresenterPage.tsx` is a named workflow root in the inclusion rule.

- path: `src/lib/presentation/exportImport.ts`
  symbol-or-line: `exportPresentation` payload (lines 161-234)
  sink/channel: `file download`
  audience: `{operator}`
  text-origin: `database content`
  language-axis: `{stored-or-output copy}`
  reason: The downloaded JSON carries the presentation's slide text verbatim, so the file is itself a copy surface and not only a name. Separate record: the payload follows the liturgy language while the file name follows operator chrome.

---

## 5. `print` — no records, and the probes that establish it

[D1b1.6] asks for at least one terminal call per channel. For `print` there is none at SOURCE_SHA.
**Three probes, all empty:**

```bash
/usr/bin/grep -rnE "window\.print|\.print\(\)|react-to-print|print-js|printJS|useReactToPrint" \
  src supabase --include='*.ts' --include='*.tsx'          # exit 1, no output
/usr/bin/grep -rn "@media print" src --include='*.css' --include='*.tsx' --include='*.ts'
                                                            # exit 1, no output
/usr/bin/grep -nE '"[^"]*print[^"]*"' package.json          # exit 1, no output
```

**What this establishes is those three searches, at this commit** — nothing more. Browser print via
the operating system's own Cmd-P on any rendered page is outside every one of them, and this
repository could not detect it if it happened. The practical printing route at this commit is the
celebrant PDF, which is recorded under `PDF` above. Direction of error: **under-report** — if a print
path exists behind an alias or a dynamically imported helper, these probes miss it.

### A language-coupled surface that is deliberately *not* a record

`supabase/functions/_shared/whatsapp/payload.ts:42` holds
`STOP_RE = /\b(stop|baja|no enviar mas|no quiero recibir)\b/`, applied after lower-casing and
diacritic-stripping (44-52). `src/lib/whatsapp/payload.ts` is a hand-maintained browser-side duplicate
of the same grammar, and its header says so.

It gets **no record** because `SURFACE-SCHEMA.md` records *emissions*, and this code only recognises
inbound text. It is written down here because it is nonetheless coupled to a recorded emission: the
opt-out reply at `wa-webhook:150` fires only when this regex matches. Note the correction in §2.0 —
the `opt_in_bienvenida` template that would advertise this vocabulary to recipients is **sent by no
code path in this repository**, so whatever tells a recipient which word to send lives outside it.
Stated as an observation, not a recommendation (D-E).

---

## 6. What this inventory structurally cannot see — [D1b1.11], D-N, D-O

Each item names the gap, the **direction** in which it fails, and what a later method phase would need.
None of this is asserted to be exhaustive; that is the point of stating it.

1. **Text declared in one file and rendered in another.** `getElementLabel` and the phase-label table
   in the children's exporter were found only because the audit followed the value, not the file.
   *Direction: under-report.* A declaration whose consumer this audit did not walk produces no record.
   Extension: an AST value-flow graph.
2. **A declaration that is a mirror rather than a link.** R-01 is the sharpest case: `WA_TEMPLATES`
   *looks* like the source of the WhatsApp copy and is not connected to it at all. *Direction: this one
   fails toward **over**-report* — it invites recording a chain that does not exist, which is exactly
   what round 1 did. The only defence is tracing the value in both directions; a token search cannot
   distinguish a registry from its documentation.
3. **Unaccented Spanish outside the frozen word list.** Measured, not asserted:
   `send-children-service-packet/index.ts` carries a complete Spanish email and scores `PASS_A hits=0`,
   `PASS_B hits=1`; `send-music-service-packet/index.ts` scores `PASS_A hits=1`, `PASS_B hits=2` over
   606 lines; `wa-reminders/index.ts` and `packetGenerationService.ts` both score `PASS_A hits=0` while
   emitting Spanish. *Direction: under-report, and worst exactly on this phase's channels* — the edge
   functions were written without accents. Extension: a lexical model rather than a frozen list.
4. **Text baked into pixels.** `slideRenderer` rasterises every exported slide, and `Portadas` bakes a
   preacher name into cover art. *Direction: under-report, and unrecoverable after the fact.*
   Extension: OCR over generated assets.
5. **External registry contents.** The WhatsApp body a recipient reads lives in WhatsApp Business
   Manager. This audit records the accessor and the key; it never read the approved copy. *Direction:
   the in-repo mirror may be wrong about the emitted copy in either direction, and §2.0 shows nothing
   here would detect it.* Extension: an export from the registry.
6. **Platform locale data.** Three sites call `toLocaleDateString('es-CL', …)`. The strings emitted are
   CLDR data, not repository text, and cannot be enumerated from this codebase at all. *Direction:
   under-report of the actual emitted vocabulary.*
7. **Runtime-constructed reach.** A path assembled at runtime, a dynamic import, or a Graph call built
   from fragments appears in neither `census.sh`'s roots nor the §1a terminal set. `census.sh`'s
   ambiguity branch is where such cases come to rest, and it recorded **one** keep at this commit —
   it does not detect them, and does not claim to. *Direction: under-report.*
8. **The candidate floor is a floor.** It was wrong by 3× once. The §1a sweep raises confidence for
   eight files and one pattern set; it does not convert the floor into a contract. *Direction:
   under-report.*
9. **The audit is one reader's traversal.** Every chain above was walked statically, by hand, from a
   named root. A branch nobody walked leaves no trace and no `UNVERIFIED` record — the failure mode is
   silent, and round 1's four blockers were all of this kind. *Direction: under-report for coverage,
   over-report for confidence.* Extension: runtime instrumentation at each sink, the only method listed
   here that fails in the opposite direction.

**This document does not claim to have found every recipient-facing emission**, and no absolute about
what it "drops" or "cannot miss" appears anywhere in it (D-O).

---

## 7. Record count by `sink/channel`

| `sink/channel` | Records |
|---|---:|
| PDF | 16 |
| email | 12 |
| WhatsApp | 11 |
| file download | 4 |
| print | 0 — see §5 |
| **Total** | **43** |

Well under the 200-record split trigger. Derived, not counted by hand:

```bash
/usr/bin/grep -c '^- path: ' docs/plan/bilingue/evidence/D1-surfaces-output.md
/usr/bin/grep '^  sink/channel: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
```

Every record carries all seven fields, and no field is blank ([D1b.6]):

```bash
for k in 'path' 'symbol-or-line' 'sink/channel' 'audience' 'text-origin' 'language-axis' 'reason'; do
  /usr/bin/grep -cE "^([- ]) *${k}: " docs/plan/bilingue/evidence/D1-surfaces-output.md
done
/usr/bin/grep -nE "^[- ] *(path|symbol-or-line|sink/channel|audience|text-origin|language-axis|reason): *$" \
  docs/plan/bilingue/evidence/D1-surfaces-output.md   # exit 1, no output
```

The axis distribution, and every `UNVERIFIED` carrying `materiality:` ([D1b.7], D-I):

```bash
/usr/bin/grep '^  language-axis: ' docs/plan/bilingue/evidence/D1-surfaces-output.md \
  | /usr/bin/sort | /usr/bin/uniq -c
```

The round-1 → round-2 movement, for the reviewer's convenience: 35 → 43 records. Eight added by
splitting composite payloads per origin ([B2]); five reclassified from `channel-fixed` to
`UNVERIFIED (materiality: BLOCKS-REPLAN)` ([B3]); six proper-noun and locale-date records moved to
their own entries with the axes §0.2 fixes; no record removed.
