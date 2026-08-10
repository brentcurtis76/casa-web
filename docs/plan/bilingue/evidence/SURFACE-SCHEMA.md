# CASA BILINGUE surface schema and audit method

METHOD METADATA

- SOURCE_SHA: `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`
- PLAN_SHA: `c842161d0edcba560a077fdb81b31edad2f23396`
- TARGET_OS: macOS, Darwin 24.3.0
- TARGET_LOCALE: `en_US.UTF-8`

This document defines the record, boundary, and audit procedure that D1b must apply. It does not
classify an actual surface and contains no run output.

## Record syntax

Each emission is represented by one Markdown list item with these keys in this order:

```text
- path: `<repository-relative path>`
  symbol-or-line: `<symbol name or one-based source line>`
  sink/channel: `<allowed scalar>`
  audience: `{<allowed members>}`
  text-origin: `<allowed scalar>`
  language-axis: `{<allowed members>}`
  reason: `<non-empty evidence chain>`
```

Backticks delimit scalar values. Braces delimit sets. Set members use the spelling below, are
comma-separated, and appear in the order shown below. No field may be blank. One source file may
yield many records; different text origins, emissions, sinks, or language-axis sets require separate
records. A composite payload with text from more than one origin is split into one record per origin,
even when one API call sends the payload. This keeps `text-origin` mechanically scalar.

## Fields and allowed values

| Field | Cardinality | Allowed value and meaning |
|---|---|---|
| `path` | scalar | Existing repository-relative `.ts`, `.tsx`, or `.json` path that declares or emits the text. |
| `symbol-or-line` | scalar | Exported/local symbol when stable; otherwise a one-based source line at SOURCE_SHA. |
| `sink/channel` | scalar | `PDF`, `email`, `WhatsApp`, `slide render`, `toast/UI`, `file download`, or `print`. If one origin reaches distinct sinks, write one record for each sink. |
| `audience` | non-empty set | Any ordered subset of `operator`, `congregation`, `recipient`. `recipient` means a named person. |
| `text-origin` | scalar | `literal in source`, `declaration/registry in source`, `database content`, `AI-generated`, `canonical JSON`, or `external registry`. Use the origin of the emitted text, not the location of the renderer. |
| `language-axis` | non-empty set | Any ordered subset of `UI copy`, `stored-or-output copy`, `channel-fixed`, `generation instruction`, `UNVERIFIED (materiality: BLOCKS-REPLAN)`, or `UNVERIFIED (materiality: DETAIL)`. |
| `reason` | scalar | A concise, non-empty origin-to-sink evidence chain and why the chosen audience and language axes apply. For an external registry, identify the source accessor or template key without copying its body. |

`UI copy` follows the operator locale. `stored-or-output copy` follows the liturgy language.
`channel-fixed` is recipient-facing copy whose language is fixed independently by an external
registry. `generation instruction` controls generated content. `UNVERIFIED` is allowed only with
exactly one materiality value: `BLOCKS-REPLAN` when the unresolved choice can change feature scope,
sequencing, data shape, or compliance; `DETAIL` otherwise. The D1 reviewer approves materiality.

Presentation may require both `UI copy` and `stored-or-output copy`, because operator chrome and
projected content have independent language axes. WhatsApp may require `channel-fixed` without either
of those axes. The set model is deliberate; do not collapse a mixed presentation into one value.

## Exact liturgy-path inclusion rule

Apply the rule to an emission, not to an entire file. A candidate is in scope if and only if both
clauses below hold:

1. The text is visible to an operator, congregation, or named recipient through at least one allowed
   sink/channel during one of these workflows:
   - creating, editing, saving, previewing, presenting, printing, downloading, or exporting a liturgy
     that begins at `src/pages/ConstructorLiturgiasPage.tsx`;
   - presenting that liturgy through `src/pages/PresenterPage.tsx` or `src/pages/OutputPage.tsx`;
   - producing a story, prayer, Bible passage, cover, child packet, music packet, or notification from
     data selected or saved in that liturgy workflow; or
   - sending a reminder, status message, or reply whose runtime assignment/publication is keyed to
     that liturgy or to a child/music service packet produced from it.
2. There is a concrete text-flow chain from a declaration or runtime origin to the allowed sink. A
   shared table, user, phone number, date, module name, import, or route is not by itself a text-flow
   chain. The record's reason must name each source symbol, hand-off, and terminal sink that establishes
   the chain.

Declarations and registries are included when their value flows through that chain even if their own
file contains no sink call. Conversely, a file that contains a sink-like API is not included when it
does not emit user-visible text. Shared files are decided emission by emission.

The following boundary rules remove path-name judgment from the named probes:

- A `whatsapp-signup` emission is not included merely because the captured phone may later receive a
  liturgy-related notification. It is included only if that exact emitted text participates in the
  keyed reminder/status/reply chain in clause 1. Onboarding, consent, and generic marketing remain
  outside the boundary.
- A `src/components/children-ministry` admin emission is not included merely because the admin module
  shares child lessons, calendars, inventory, volunteers, or assignments with the builder. It is
  included only if that exact text flows into the builder UI or a child packet through clause 1.
  Text visible only on the independent `/admin/ninos` route remains outside the boundary.

D1b must record the evidence chain before deciding either probe. If no such chain is found, the rule
requires exclusion; resemblance, shared data, and a path-name match cannot substitute for evidence.

## Candidate-floor procedure

The fixed sink search is only a candidate floor. D1b runs this literal procedure from the repository
root and retains its path output as audit evidence:

```bash
export LC_ALL=en_US.UTF-8
SINKS='jsPDF|jspdf|\.save\(|resend|sendEmail|nodemailer|sendText|sendTemplate|templateName|WA_TEMPLATES|toDataURL|getContext\(|fillText|window\.print|download|toast\(|sonner'
/usr/bin/grep -rlE "$SINKS" src supabase --include='*.ts' --include='*.tsx' \
  | /usr/bin/grep -vE '__tests__|\.test\.| [0-9]\.tsx?$' \
  | /usr/bin/grep -iE 'liturgia|cuentacuento|children|music|presentation|graphics|export|wa-|whatsapp|packet' \
  | /usr/bin/sort
```

No path produced by this floor is automatically a surface. Every candidate is triaged under the
inclusion rule, and a candidate may yield no record or many records.

## Call-path audit

D1b performs both a forward and reverse audit on top of the candidate floor:

1. Forward audit: begin at each workflow root in the inclusion rule. Follow static imports, callbacks,
   values passed as props, service calls, `supabase.functions.invoke` names, stored identifiers, and
   declaration/registry lookups until an allowed sink is reached. At every module boundary, record the
   next symbol or endpoint. Stop a branch only at an allowed sink or with a written reason that it
   cannot emit user-visible text.
2. Reverse audit: for every allowed sink/channel, select at least one in-scope terminal call and trace
   its displayed payload backward to its literal, declaration, database, AI, JSON, or external origin.
   Trace separate language-axis components separately when one rendered view combines them.
3. Mandatory declaration seeds: audit `LITURGY_ORDER` and `WA_TEMPLATES` even though declaration files
   need not match the sink search. Mandatory round-trip seed: audit a WhatsApp reply handler, not only
   outbound send calls.
4. Reconcile: label each sink-search candidate as record-producing or non-emitting with a reason. Add
   every audit-discovered surface that the sink search or census did not nominate, and call that gap out
   in the later summary. Do not change the locked census or candidate-floor regex to absorb the find.
5. For each branch that cannot be resolved from source alone, create an `UNVERIFIED` record with
   reviewer-approved materiality. Do not infer runtime database text or external template contents.

## Structural blind spots and extension rule

Static tracing cannot prove all dynamic imports, computed function names, runtime database values,
external registry values, text baked into pixels, or dead-versus-live branches. The frozen root and
sink sets can also omit a new module. D1b therefore reports its inventory as a lower-bound artifact
and states which audit branches ended unresolved.

To extend the method, add a separately reviewed method phase before collecting new evidence. Possible
extensions are an AST import/value-flow graph, runtime instrumentation at each sink, database fixtures
with provenance, an export from each external registry, and OCR over generated image assets. A later
method may add records; it must not relabel this static audit as complete.
