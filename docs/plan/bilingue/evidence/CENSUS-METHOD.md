# CASA BILINGUE census method

METHOD METADATA

- SOURCE_SHA: `e0c9342edcd1d9eddea0662244bf1934bfdb5cb0`
- PLAN_SHA: `c842161d0edcba560a077fdb81b31edad2f23396`
- TARGET_OS: macOS, Darwin 24.3.0
- TARGET_LOCALE: `en_US.UTF-8`
- IMPLEMENTATION: `docs/plan/bilingue/evidence/census.sh`

This document fixes the method that D1b will run. It contains no run output. D1a executes the
implementation only to verify which files it selects; no count, total or file number from that run
is recorded in this or any other D1a artifact.

## Process and locale rules

`census.sh` runs under `/bin/bash` from the repository root of a clean checkout. It exports
`LC_ALL=en_US.UTF-8` once before invoking any measurement process. Every external process has an
absolute path. The implementation uses `/usr/bin/git`, `/usr/bin/find -E`, `/usr/bin/sort -u`,
`/usr/bin/grep`, `/usr/bin/wc`, and `/usr/bin/awk`; it does not invoke a shell alias, function, or
`PATH`-resolved replacement for those tools.

The source tree must match SOURCE_SHA under `src/` and `supabase/`. Documentation-only commits on top
of SOURCE_SHA are allowed. A changed tracked or untracked source file makes the script exit non-zero.
Every configured root must exist before collection begins.

## Shared file-selection rules

Both passes use the same selector, except that Pass B adds `src/lib/whatsapp` to the Pass A roots.
The accepted extensions are `.ts`, `.tsx`, and `.json`.

The exclusion rule runs in two stages. **Stage one** is these four `/usr/bin/find` name predicates,
in this order:

```text
-not -path '*__tests__*'
-not -name '*.test.*'
-not -name '*_test.*'
-not -regex '.* [0-9]\.(ts|tsx)'
```

The first three exclude test code under the two conventions this repository uses for test *modules*:
`__tests__/` directories and `*.test.ts`/`*.test.tsx` under `src/`, and the Deno underscore
convention `*_test.ts` used throughout `supabase/functions/`. **Why:** the census measures
user-visible copy surfaces, and the Spanish literals in a test module are ordinarily assertions and
fixtures — expected values quoted from the module under test — so counting them double-counts the
production string and inflates every sizing decision D1b feeds.
The fourth predicate excludes copied TypeScript artifacts whose basename ends in a space followed by
a decimal digit.

**Error direction of the four stage-one predicates: over-exclusion.** They read the path and ask
nothing about the content, so a file whose name matches is dropped whether or not it is a test. Two
named cases where that direction is wrong: a production module named `*_test.ts`, or placed inside a
`__tests__/` directory, is excluded although it emits copy; and a test that itself writes to a
user-visible sink is excluded although it emits. **This method does not claim either case is absent
at SOURCE_SHA.** D1a round 3 tried to establish the first with a pattern that looked for a
`Deno.test` declaration in every excluded file; that check was refuted and has been removed — see
*Exclusion safety is established by enumeration, not by pattern* below. What the predicates actually
exclude is enumerated in D1b's `evidence/D1-exclusions.md`, where a reviewer reads the list.

**Stage two** is a referrer-based predicate applied to `.json` paths only, fixed in the next
section. It exists because a name predicate cannot reach test *data*: a captured baseline follows no
naming convention, so there is no name to predicate on.

### Stage two: test data is excluded by who refers to it, not by what it is called

A `.json` that survives stage one is excluded when three conditions hold together: no other file
under `src/` or `supabase/` carries the same basename; it is named by at least one `.ts`/`.tsx` file
under those roots; and **every** file that names it is a test file. Anything short of all three
**keeps** the file through the ambiguity branch fixed below.

"Names it" is basename containment, not import resolution. That is deliberately looser than an
import graph — it counts `fixedElementFile: 'la-paz.json'` and
`fetch('/data/elementos-fijos/index.json')` as referrers, and neither is an `import` statement.

**Error direction of stage two: it over-includes under ambiguity, and it can over-exclude when the
basename evidence is complete but wrong.** The second half is not hypothetical, and this is the case
where the direction does not hold:

> If production reaches a `.json` by a path assembled at runtime or expanded from a glob — so that
> no `.ts`/`.tsx` writes the basename literally — while an unrelated test names that same basename
> literally, then every referrer this rule can see is a test, and the **production file is
> excluded**. Nothing in the rule detects that. The basename-collision branch does not cover it
> either: it fires when a second file shares the basename, which is a different situation.

Codex found this in D1a round 3 ([B1]). Round 3's artifact stated that a looser referrer set can
only ever keep a data file — **that claim was false and is retracted.** The live `index.json`
basename collision at SOURCE_SHA is benign and does not validate the general claim. What is excluded
is enumerated for review in D1b (`D1-exclusions.md`, D1b.13); this rule is not asked to guarantee
the result.

#### The ambiguity branch, and the reason it records

`census.sh` implements stage two as three named branches. The first two are ambiguity and they keep:

| Branch | Condition | Outcome | Reason recorded |
|---|---|---|---|
| 1 | More than one file under `src/`/`supabase/` carries this basename, so a literal referrer cannot be attributed to this path | keep | `basename-collision` |
| 2 | No `.ts`/`.tsx` under those roots writes the basename as text | keep | `no-literal-referrer` |
| 3 | Any non-test referrer → keep · every referrer is a test file → exclude | resolved | none |

Branch 2 is where three distinct situations come to rest, indistinguishable from each other: a path
assembled at runtime, a glob expansion, and a referrer that lives outside the referrer roots (a
build script, a Deno task, a CI workflow). **The branch does not detect them and does not claim to.**
It keeps the file and says the evidence was absent.

Each ambiguous keep is written once to **stderr**, as
`AMBIGUOUS_KEEP<TAB><path><TAB>reason=<reason>`; stdout carries census rows only. D1b captures that
channel (`2> …`) and lists every such file, with its reason, in `D1-exclusions.md` — an
over-inclusion is as much a finding for a reviewer as an exclusion.

A referrer counts as a test file when its path matches this exact ERE — the same three conventions
stage one uses:

```text
(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$
```

`census.sh` implements this as `json_is_test_evidence`. Applied standalone to the stage-one `.json`
candidates over the configured roots, it classifies the following path as test evidence:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -name '*.json' \
  -not -path '*__tests__*' -not -name '*.test.*' -not -name '*_test.*' | /usr/bin/sort -u \
| while IFS= read -r f; do
    refs=$(/usr/bin/grep -rlF --include='*.ts' --include='*.tsx' -- "${f##*/}" src supabase \
      | /usr/bin/sort -u || true)
    [ -n "$refs" ] || { printf 'NO REFERRER (kept): %s\n' "$f"; continue; }
    printf '%s\n' "$refs" \
      | /usr/bin/grep -qvE '(^|/)__tests__/|\.test\.[^/]+$|_test\.[^/]+$' \
      || printf 'TEST EVIDENCE (excluded): %s\n' "$f"
  done
```

```text
TEST EVIDENCE (excluded): supabase/functions/generate-story/corpus_pd_base.json
```

`corpus_pd_base.json` is a captured baseline of the prompt corpus, re-captured by a documented
script and read only by `corpus_parity_test.ts`. It is not named `*_test.*`, does not sit in a
`__tests__` directory, and follows no naming convention at all — no name predicate could have
reached it, and the next captured baseline will be named differently again.

**What this rule cannot do.** It reads referrers inside `src/` and `supabase/` only, so a `.json`
referenced solely from a build script, a Deno task or a CI workflow reaches branch 2 and is kept
under `no-literal-referrer` — the right outcome by accident, not a correct classification, and the
recorded reason says so. It applies to `.json` alone:
a `.ts` module that is test-only but named like production is not caught, because excluding a `.ts`
on referrer evidence could drop real copy. And it cannot decide whether a *production* referrer
actually renders the file's Spanish to a user; that question belongs to the call-path audit fixed in
`SURFACE-SCHEMA.md`.

### Exclusion safety is established by enumeration, not by pattern

`*_test.*` was absent from stage one until D1a round 2. Only the dot convention was excluded, so the
Deno test files inside the roots were selected and counted. Adding the predicate corrected that.

Round 3 then tried to show that the predicate is safe — that everything it excludes really is a test
— with a pattern that required each excluded file to declare `Deno.test`. **That check has been
deleted, and the claim it supported with it.** A regex over text cannot tell code from a comment or
a string literal, which Codex demonstrated by construction:

```bash
printf '// Deno.test("x", () => {});\n' > a_test.ts   # PASSES — a comment counts as a test
printf 'const note = "Deno.test(";\n'    > b_test.ts   # PASSES — a string literal counts
printf 'Deno["test"]("x", () => {});\n'  > c_test.ts   # FAILS  — a real test is flagged non-test
```

**No cleverer pattern replaces it.** Any pattern strong enough to make the claim would be making the
same kind of claim, and would fail on the next construction (D-O). What replaces it is
enumeration: **D1b writes `evidence/D1-exclusions.md`** listing every path this method excluded, the
rule that excluded it, and its evidence, together with every file kept under the ambiguity branch and
its recorded reason (D1b.13). A reviewer confirms nothing real was dropped by reading that short
derived list. **This artifact makes no claim that a given file is or is not a test.** It states the
rules, and the direction in which each is wrong.

One bounded piece of evidence survives, stated with its limits rather than as a guarantee — that no
module *statically written* to import a `*_test` module exists under the two roots at SOURCE_SHA:

```bash
/usr/bin/grep -rnE "from ['\"][^'\"]*_test(\.ts)?['\"]" src supabase \
  '--include=*.ts' '--include=*.tsx' | /usr/bin/grep -vE '_test\.ts:'
# exit 1, no output
```

That search sees written specifiers only. A dynamic `import()`, a specifier assembled at runtime, a
re-export chain, and an importer outside `src/`/`supabase/` are all invisible to it, and it says
nothing about whether a test file reaches a user by some other route — a test that itself wrote to a
user-visible sink would satisfy it and still be excluded. Only the call-path audit fixed in
`SURFACE-SCHEMA.md` bears on that, and it is scoped to production surfaces. Stated blind spot under
D-N and D-O, not a proven absence.

### A retracted claim

Round 2 of this artifact stated: *"No other test, spec, mock or fixture convention occurs in the
configured roots at SOURCE_SHA."* **That claim is retracted.** It was falsified by
`corpus_pd_base.json`, which is test evidence inside the roots and which the survey below does not
see — the survey searches names, and that file's name says nothing. Codex found it in D1a round 1 of
final review. The failure was not the survey; it was extending a name-based finding into a claim
about fixtures, which are not identified by name.

What the survey below actually supports is narrower, and is all that is claimed now: **no test, spec
or mock *naming* convention beyond the three already excluded occurs in the configured roots at
SOURCE_SHA.** Test *data* does occur there, under no naming convention at all, and stage two above is
what catches it. Over the candidate set produced by the roots and the extension filter, every path
whose name contains `test` in any case is covered by one of the three name predicates, and
`.spec.`/`_spec.`, `__mocks__`, and `test/` or `tests/` directory segments match nothing:

```bash
export LC_ALL=en_US.UTF-8
ROOTS=$(/usr/bin/sed -n '/^PASS_A_ROOTS=(/,/^)/p' docs/plan/bilingue/evidence/census.sh \
  | /usr/bin/grep -vE '^(PASS_A_ROOTS=\(|\))' | /usr/bin/tr -d ' ')
/usr/bin/find -E $(echo $ROOTS) src/lib/whatsapp -type f -regex '.*\.(ts|tsx|json)$' \
  -not -regex '.* [0-9]\.(ts|tsx)' | /usr/bin/sort -u > /tmp/candidates.txt
/usr/bin/grep -iE 'test' /tmp/candidates.txt \
  | /usr/bin/grep -vE '__tests__|/[^/]*\.test\.[^/]*$|_test\.(ts|tsx|json)$'
# exit 1, no output
/usr/bin/grep -iE '__mocks__|[._]spec\.|/tests?/' /tmp/candidates.txt
# exit 1, no output
```

The fixture helpers *named as such* — `pbImageFixtures.ts`, `pcuiWarningFixtures.ts` and
`phFixtures.ts` — all sit inside `src/lib/cuentacuentos/__tests__/` and are already excluded by the
first predicate. They are not the whole population of test evidence in the roots, and this paragraph
no longer claims they are: unnamed test data is stage two's problem, not stage one's. No predicate is
added for a *naming* convention that matches no file: the method is locked
against SOURCE_SHA, so an exclusion that removes nothing could never be justified against a file,
and adding one would be untestable decoration. A new convention appearing later is an extension, and
the extension rule below governs it.

**Where this survey's direction does not hold.** It is a search over *names*, at SOURCE_SHA, over the
candidate set the roots and the extension filter produce. It cannot see a test, fixture or mock that
is not identified by its name — which is precisely what falsified the round 2 version of the claim —
and it says nothing about any other commit. Its error direction is therefore over-confidence in
stage one's coverage, and the correction for that is stage two plus the D1b enumeration, not a wider
regex.

The copied-artifact exclusion is implemented with BSD extended regular expressions by invoking
`/usr/bin/find -E` and applying `.* [0-9]\.(ts|tsx)`. Bare `find -regex` is not interchangeable with
this rule. All selected paths are normalized by `/usr/bin/sort -u` before either pass.

The complete Pass A roots are:

```text
src/components/liturgia-builder
src/components/liturgia
src/lib/liturgia
src/pages/ConstructorLiturgiasPage.tsx
src/data/elementos-fijos
src/components/presentation
src/lib/presentation
src/hooks/presentation
src/lib/cuentacuentos
src/lib/children-ministry
src/lib/music-planning
src/types/shared/liturgy.ts
supabase/functions/generate-story
supabase/functions/refine-story
supabase/functions/generate-oraciones
supabase/functions/generate-children-lesson
supabase/functions/refine-children-lesson
supabase/functions/fetch-bible-passage
supabase/functions/process-reflexion-pdf
supabase/functions/send-children-service-packet
supabase/functions/send-music-service-packet
supabase/functions/wa-send
supabase/functions/wa-reminders
supabase/functions/_shared/whatsapp
```

The Pass B roots are exactly the Pass A roots plus:

```text
src/lib/whatsapp
```

## Pass A

Pass A uses this exact ERE character class:

```text
[áéíóúñüÁÉÍÓÚÑÜ¿¡]
```

Its codepoints, in class order, are:

```text
U+00E1 U+00E9 U+00ED U+00F3 U+00FA U+00F1 U+00FC
U+00C1 U+00C9 U+00CD U+00D3 U+00DA U+00D1 U+00DC U+00BF U+00A1
```

For `.ts` and `.tsx`, a matching line is excluded when the original line matches this exact ERE:

```text
^[[:space:]]*(//|\*|/\*)
```

That is a deliberate line-oriented rule. It removes full-line comments and block-comment lines
whose first non-space token is `*` or `/*`; it retains code followed by an inline comment and does
not attempt to parse strings. JSON is not passed through the comment filter.

## Pass B

Pass B reads the committed `wordlist-passB.txt`, ignoring blank lines and lines beginning with `#`.
It joins these entries with `|` and matches the exact ERE `\b(WORDS)\b` using `/usr/bin/grep -E`.
Matching is case-sensitive: no `-i` flag or case folding is permitted. The boundary is BSD grep's
`\b` word boundary under the exported locale. The comment treatment is identical to Pass A.

The complete list is:

```text
Guardar
Guardando
Cancelar
Cerrar
Buscar
Eliminar
Editar
Nuevo
Nueva
Crear
Agregar
Borrar
Aceptar
Volver
Siguiente
Anterior
Enviar
Enviando
Descargar
Cargando
Cargar
Seleccionar
Elegir
Filtrar
Ordenar
Mostrar
Ocultar
Copiar
Confirmar
Continuar
Salir
Ayuda
Nombre
Fecha
Archivo
Imagen
Todos
Todas
Ninguno
Ninguna
Mensaje
Correo
Usuario
Cantidad
Actualizar
Activar
Desactivar
Duplicar
Vista previa
```

The following ambiguous or English-overlapping tokens are deliberately excluded:

```text
Error
Total
Ver
Sin
Con
Para
Tipo
Lista
Estado
Hora
```

This is a precision-over-recall choice: a Pass B match should be useful evidence of Spanish UI copy,
even though the method knowingly misses unaccented Spanish outside the frozen list. Adding, removing,
recasing, or stemming a token changes the method and is forbidden in D1b.

## Reporting and arithmetic

The passes are reported separately. They are not unioned and neither is labelled as the census's
single authoritative answer. For each pass, `census.sh` emits one row per selected path and a summary
row. Pass A records matching non-comment lines. Pass B records matching non-comment lines and the
subset whose line has no Pass A character. Shell integer arithmetic accumulates those per-path values.

The script never prints source-line contents. This keeps paths and measurements available without
copying values that could contain personal data.

## Structural blind spots and extension rule

This method is a reproducible candidate floor, not a completeness proof. It cannot find declarations
outside the frozen roots, Spanish without a Pass A character or a frozen Pass B token, text assembled
dynamically without one of those markers, runtime database values, external registries, text baked
into image pixels, or a declaration whose emitted value only becomes visible through a separate file.

D1b addresses part of that blind spot with the call-path audit fixed in `SURFACE-SCHEMA.md`. A future
extension must add a new reviewed method phase before measuring: examples include a repository-wide
AST literal pass, runtime sink instrumentation, database provenance fixtures, OCR over generated
assets, and explicit exports from external registries. Results from distinct methods remain separately
labelled rather than silently merged.
